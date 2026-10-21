/**
 * CodeTogether - Real-Time Collaborative Code Editor
 * Backend Server (Node.js, Express, Socket.IO)
 * 
 * Manages rooms, participants, code state, and real-time synchronization
 * completely in-memory using JavaScript Maps.
 */

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Configurable Port with fallback
const PORT = process.env.PORT || 5000;

// CORS configuration for frontend dev servers
const corsOptions = {
  origin: (origin, callback) => {
    // Allow local development origins (localhost, 127.0.0.1 on any port)
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS origin not allowed'));
    }
  },
  methods: ['GET', 'POST'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// In-Memory Storage
// Map of roomId -> {
//   id: string,
//   code: string,
//   language: string,
//   participants: Map<socketId, { id: string, username: string }>
// }
const rooms = new Map();

// Starter code templates for supported languages
const STARTER_TEMPLATES = {
  javascript: `// JavaScript Starter Template
function greet(name) {
  return \`Hello, \${name}! Welcome to CodeTogether.\`;
}

console.log(greet("Developer"));
`,
  python: `# Python Starter Template
def greet(name):
    return f"Hello, {name}! Welcome to CodeTogether."

print(greet("Developer"))
`,
  java: `// Java Starter Template
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Developer! Welcome to CodeTogether.");
    }
}
`,
  c: `// C Starter Template
#include <stdio.h>

int main() {
    printf("Hello, Developer! Welcome to CodeTogether.\\n");
    return 0;
}
`,
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CodeTogether HTML Preview</title>
</head>
<body>
  <h1>Hello from CodeTogether!</h1>
  <p>Start collaborating in real-time with your team.</p>
</body>
</html>
`
};

/**
 * Generate a friendly unique room ID
 * Example: "room-k9m2p4"
 */
function generateRoomId() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let randomStr = '';
  for (let i = 0; i < 6; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `room-${randomStr}`;
}

// REST Endpoints
app.get('/', (req, res) => {
  res.send('CodeTogether backend is running.');
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    activeRoomsCount: rooms.size
  });
});

app.get('/api/rooms/:roomId/exists', (req, res) => {
  const { roomId } = req.params;
  const exists = rooms.has(roomId);
  res.json({ roomId, exists });
});

// Initialize Socket.IO
const io = new Server(server, {
  cors: corsOptions
});

io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  /**
   * Helper: Remove socket from all existing rooms it is currently in
   */
  const leaveCurrentRooms = () => {
    for (const [roomId, room] of rooms.entries()) {
      if (room.participants.has(socket.id)) {
        const user = room.participants.get(socket.id);
        room.participants.delete(socket.id);
        socket.leave(roomId);
        console.log(`[Leave] User '${user.username}' (${socket.id}) left room '${roomId}'`);

        // Check if room is now empty
        if (room.participants.size === 0) {
          rooms.delete(roomId);
          console.log(`[Room Deleted] Room '${roomId}' was empty and has been removed.`);
        } else {
          // Notify remaining users in the room
          const participantList = Array.from(room.participants.values());
          io.to(roomId).emit('participants-updated', {
            participants: participantList,
            userCount: participantList.length,
            message: `${user.username} left the room.`
          });
        }
      }
    }
  };

  /**
   * CREATE ROOM
   * Client requests to create a new room
   */
  socket.on('create-room', ({ username } = {}, callback) => {
    try {
      leaveCurrentRooms();

      let newRoomId = generateRoomId();
      // Ensure uniqueness
      while (rooms.has(newRoomId)) {
        newRoomId = generateRoomId();
      }

      const assignedUsername = (username && username.trim()) ? username.trim() : 'User 1';
      const initialLang = 'javascript';
      const initialCode = STARTER_TEMPLATES[initialLang];

      const roomData = {
        id: newRoomId,
        code: initialCode,
        language: initialLang,
        participants: new Map()
      };

      roomData.participants.set(socket.id, {
        id: socket.id,
        username: assignedUsername
      });

      rooms.set(newRoomId, roomData);
      socket.join(newRoomId);

      console.log(`[Room Created] Room: ${newRoomId} by ${assignedUsername} (${socket.id})`);

      const participantsList = Array.from(roomData.participants.values());

      const response = {
        success: true,
        roomId: newRoomId,
        code: roomData.code,
        language: roomData.language,
        participants: participantsList,
        username: assignedUsername
      };

      if (typeof callback === 'function') {
        callback(response);
      }
      socket.emit('room-created', response);
    } catch (err) {
      console.error('Error creating room:', err);
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Failed to create room' });
      }
    }
  });

  /**
   * JOIN ROOM
   * Client requests to join an existing room
   */
  socket.on('join-room', ({ roomId, username } = {}, callback) => {
    try {
      if (!roomId || !roomId.trim()) {
        const errorMsg = 'Please provide a valid Room ID.';
        if (typeof callback === 'function') callback({ success: false, message: errorMsg });
        socket.emit('room-error', { message: errorMsg });
        return;
      }

      const cleanRoomId = roomId.trim();

      // Check if room exists in memory
      if (!rooms.has(cleanRoomId)) {
        const errorMsg = `Room "${cleanRoomId}" does not exist. Please check the ID or create a new room.`;
        if (typeof callback === 'function') callback({ success: false, message: errorMsg });
        socket.emit('room-error', { message: errorMsg });
        return;
      }

      leaveCurrentRooms();

      const room = rooms.get(cleanRoomId);

      // Determine friendly username
      const nextUserNumber = room.participants.size + 1;
      const assignedUsername = (username && username.trim()) 
        ? username.trim() 
        : `User ${nextUserNumber}`;

      room.participants.set(socket.id, {
        id: socket.id,
        username: assignedUsername
      });

      socket.join(cleanRoomId);
      console.log(`[User Joined] ${assignedUsername} (${socket.id}) joined room '${cleanRoomId}'`);

      const participantsList = Array.from(room.participants.values());

      const response = {
        success: true,
        roomId: cleanRoomId,
        code: room.code,
        language: room.language,
        participants: participantsList,
        username: assignedUsername
      };

      // Acknowledge joined user
      if (typeof callback === 'function') {
        callback(response);
      }
      socket.emit('room-joined', response);

      // Broadcast updated participants to everyone in the room
      io.to(cleanRoomId).emit('participants-updated', {
        participants: participantsList,
        userCount: participantsList.length,
        message: `${assignedUsername} joined the room.`
      });
    } catch (err) {
      console.error('Error joining room:', err);
      if (typeof callback === 'function') {
        callback({ success: false, message: 'An error occurred while joining the room.' });
      }
    }
  });

  /**
   * CODE CHANGE
   * Triggered when a participant types in the editor
   */
  socket.on('code-change', ({ roomId, code }) => {
    if (!roomId) return;

    // Security & state check: verify room exists and socket is actually a member
    if (!rooms.has(roomId) || !socket.rooms.has(roomId)) {
      socket.emit('room-error', { message: 'Unauthorized code edit: You are not a member of this room.' });
      return;
    }

    const room = rooms.get(roomId);
    room.code = typeof code === 'string' ? code : '';

    // Broadcast only to OTHER participants in the same room to prevent infinite loops
    socket.to(roomId).emit('code-updated', {
      code: room.code,
      senderId: socket.id
    });
  });

  /**
   * LANGUAGE CHANGE
   * Triggered when a participant switches language selector
   */
  socket.on('language-change', ({ roomId, language }) => {
    if (!roomId) return;

    if (!rooms.has(roomId) || !socket.rooms.has(roomId)) {
      return;
    }

    const room = rooms.get(roomId);
    room.language = language;

    // Broadcast language change to other participants in the room
    socket.to(roomId).emit('language-updated', {
      language: room.language
    });
  });

  /**
   * CLEAR CODE
   * Triggered when user clicks "Clear Code" button
   */
  socket.on('clear-code', ({ roomId }) => {
    if (!roomId || !rooms.has(roomId) || !socket.rooms.has(roomId)) {
      return;
    }

    const room = rooms.get(roomId);
    room.code = '';

    // Broadcast empty code to ALL participants in the room (including sender)
    io.to(roomId).emit('code-updated', {
      code: '',
      senderId: socket.id,
      action: 'cleared'
    });
  });

  /**
   * RESET CODE
   * Restores starter template for the active room language
   */
  socket.on('reset-code', ({ roomId }) => {
    if (!roomId || !rooms.has(roomId) || !socket.rooms.has(roomId)) {
      return;
    }

    const room = rooms.get(roomId);
    const starter = STARTER_TEMPLATES[room.language] || STARTER_TEMPLATES.javascript;
    room.code = starter;

    // Broadcast reset code to ALL participants in the room
    io.to(roomId).emit('code-updated', {
      code: starter,
      senderId: socket.id,
      action: 'reset'
    });
  });

  /**
   * LEAVE ROOM
   * Explicitly triggered when user clicks "Leave Room" button
   */
  socket.on('leave-room', ({ roomId }, callback) => {
    leaveCurrentRooms();
    if (typeof callback === 'function') {
      callback({ success: true });
    }
  });

  /**
   * DISCONNECT
   * Socket disconnects (closes tab, refreshes, network loss)
   */
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
    leaveCurrentRooms();
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` CodeTogether Backend Server running on port ${PORT}`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(` Storage: In-Memory Rooms Map (No Database)`);
  console.log(`====================================================`);
});
