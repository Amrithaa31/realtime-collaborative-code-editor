const jwt = require('jsonwebtoken');
const Room = require('../models/Room');
const Document = require('../models/Document');
const User = require('../models/User');

// In-memory state for active rooms
// roomId -> { content: string, language: string, version: number, participants: Map(socketId => user) }
const activeRooms = new Map();

const setupSocket = (io) => {
  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1] ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'university_project_jwt_secret_key_2026'
      );

      const user = await User.findById(decoded.id).select('name email');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = {
        id: user._id.toString(),
        name: user.name,
        email: user.email
      };

      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    // Keep track of which rooms this socket is currently joined to
    const userRooms = new Set();

    // Event: join-room
    socket.on('join-room', async ({ roomId }, callback) => {
      try {
        if (!roomId) {
          if (callback) callback({ error: 'Room ID is required' });
          return;
        }

        // Verify room existence and user membership in database
        const room = await Room.findOne({ roomId });
        if (!room) {
          if (callback) callback({ error: 'Room not found' });
          return;
        }

        const isOwner = room.owner.toString() === socket.user.id;
        const isMember = room.members.some((m) => m.toString() === socket.user.id);

        if (!isOwner && !isMember) {
          if (callback) callback({ error: 'Access denied: You are not a member of this room' });
          return;
        }

        // Initialize in-memory room state if not present
        if (!activeRooms.has(roomId)) {
          const doc = await Document.findOne({ roomId });
          activeRooms.set(roomId, {
            content: doc ? doc.content : '',
            language: doc ? doc.language : 'javascript',
            version: 1,
            participants: new Map()
          });
        }

        const currentRoomState = activeRooms.get(roomId);
        currentRoomState.participants.set(socket.id, {
          socketId: socket.id,
          userId: socket.user.id,
          name: socket.user.name,
          email: socket.user.email
        });

        socket.join(roomId);
        userRooms.add(roomId);

        const participantList = Array.from(currentRoomState.participants.values());

        // Send current document state and participants list to the joining user
        socket.emit('room-init', {
          roomId,
          content: currentRoomState.content,
          language: currentRoomState.language,
          version: currentRoomState.version,
          participants: participantList
        });

        // Notify other room participants
        socket.to(roomId).emit('user-joined', {
          user: socket.user,
          participants: participantList
        });

        if (callback) {
          callback({
            success: true,
            room: {
              name: room.name,
              roomId: room.roomId
            }
          });
        }
      } catch (err) {
        console.error('Error in join-room socket handler:', err);
        if (callback) callback({ error: 'Internal server error joining room' });
      }
    });

    // Event: code-change
    socket.on('code-change', async ({ roomId, code, version }) => {
      try {
        if (!userRooms.has(roomId) || !activeRooms.has(roomId)) {
          return; // Disallow unauthorized or out-of-room changes
        }

        const roomState = activeRooms.get(roomId);
        roomState.content = typeof code === 'string' ? code : '';
        roomState.version = (roomState.version || 0) + 1;

        // Broadcast code update to all other sockets in the room
        socket.to(roomId).emit('code-update', {
          code: roomState.content,
          version: roomState.version,
          senderId: socket.user.id,
          senderName: socket.user.name
        });
      } catch (err) {
        console.error('Error in code-change socket handler:', err);
      }
    });

    // Event: language-change
    socket.on('language-change', async ({ roomId, language }) => {
      try {
        if (!userRooms.has(roomId) || !activeRooms.has(roomId)) {
          return;
        }

        const roomState = activeRooms.get(roomId);
        roomState.language = language;

        // Broadcast language change to other sockets in the room
        socket.to(roomId).emit('language-update', {
          language,
          senderId: socket.user.id,
          senderName: socket.user.name
        });
      } catch (err) {
        console.error('Error in language-change socket handler:', err);
      }
    });

    // Event: leave-room
    socket.on('leave-room', ({ roomId }) => {
      handleLeaveRoom(socket, roomId);
    });

    // Event: disconnect
    socket.on('disconnect', () => {
      for (const roomId of userRooms) {
        handleLeaveRoom(socket, roomId);
      }
    });
  });

  // Helper to remove socket from a room and notify others
  const handleLeaveRoom = async (socket, roomId) => {
    if (!activeRooms.has(roomId)) return;

    const roomState = activeRooms.get(roomId);
    roomState.participants.delete(socket.id);
    socket.leave(roomId);

    const participantList = Array.from(roomState.participants.values());

    socket.to(roomId).emit('user-left', {
      user: socket.user,
      participants: participantList
    });

    // If room is empty, persist active content to MongoDB and clear in-memory state
    if (roomState.participants.size === 0) {
      try {
        await Document.updateOne(
          { roomId },
          {
            $set: {
              content: roomState.content,
              language: roomState.language,
              updatedAt: new Date()
            }
          }
        );
      } catch (err) {
        console.error('Error persisting room state on empty:', err);
      }
      activeRooms.delete(roomId);
    }
  };
};

module.exports = setupSocket;
