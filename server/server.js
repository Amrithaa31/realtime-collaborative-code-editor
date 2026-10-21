const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const STORAGE_FILE = path.join(__dirname, 'saved-code.json');

// Middlewares
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// In-memory active room storage:
// roomId -> { code: string, language: string, users: Set(socketId) }
const activeRooms = new Map();

// Helper to read saved code from saved-code.json
function loadSavedData() {
  try {
    if (!fs.existsSync(STORAGE_FILE)) {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify({}, null, 2), 'utf-8');
      return {};
    }
    const data = fs.readFileSync(STORAGE_FILE, 'utf-8');
    return JSON.parse(data || '{}');
  } catch (err) {
    console.error('Error reading saved-code.json:', err.message);
    return {};
  }
}

// Helper to write saved code to saved-code.json
function persistData(roomId, code, language) {
  try {
    const allData = loadSavedData();
    allData[roomId] = {
      code,
      language: language || 'javascript',
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(allData, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing to saved-code.json:', err.message);
    return false;
  }
}

// Helper to get or initialize room data
function getRoomData(roomId) {
  if (activeRooms.has(roomId)) {
    return activeRooms.get(roomId);
  }

  // Check saved-code.json if previously saved
  const savedData = loadSavedData();
  const savedRoom = savedData[roomId];

  const initialCode = savedRoom
    ? savedRoom.code
    : `// Welcome to Real-Time Collaborative Code Editor!\n// Room: ${roomId}\n\nfunction main() {\n  console.log("Hello from room ${roomId}!");\n}\n\nmain();\n`;

  const initialLang = savedRoom ? savedRoom.language : 'javascript';

  const roomState = {
    code: initialCode,
    language: initialLang,
    users: new Set()
  };

  activeRooms.set(roomId, roomState);
  return roomState;
}

// REST Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Collaborative Code Editor Server running locally on port ' + PORT,
    activeRoomsCount: activeRooms.size
  });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = getRoomData(roomId);
  res.json({
    roomId,
    code: room.code,
    language: room.language,
    userCount: room.users.size
  });
});

app.post('/api/rooms/:roomId/save', (req, res) => {
  const { roomId } = req.params;
  const { code, language } = req.body;
  const success = persistData(roomId, code, language);
  if (success) {
    res.json({ success: true, message: 'Code saved successfully to saved-code.json' });
  } else {
    res.status(500).json({ success: false, message: 'Failed to write code to disk' });
  }
});

// Socket.IO Real-time setup
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

io.on('connection', (socket) => {
  let currentRoomId = null;

  // Event: create-room
  socket.on('create-room', (callback) => {
    // Generate clean 6-character room id
    const newRoomId = 'room-' + Math.random().toString(36).substring(2, 8);
    const room = getRoomData(newRoomId);

    if (typeof callback === 'function') {
      callback({ roomId: newRoomId, code: room.code, language: room.language });
    }
  });

  // Event: join-room
  socket.on('join-room', ({ roomId }, callback) => {
    if (!roomId || !roomId.trim()) {
      if (typeof callback === 'function') callback({ error: 'Room ID is required' });
      return;
    }

    const cleanRoomId = roomId.trim();

    // Leave any previous room
    if (currentRoomId) {
      socket.leave(currentRoomId);
      const prevRoom = activeRooms.get(currentRoomId);
      if (prevRoom) {
        prevRoom.users.delete(socket.id);
        io.to(currentRoomId).emit('user-count-update', { userCount: prevRoom.users.size });
      }
    }

    currentRoomId = cleanRoomId;
    socket.join(cleanRoomId);

    const room = getRoomData(cleanRoomId);
    room.users.add(socket.id);

    // Notify room of user count
    io.to(cleanRoomId).emit('user-count-update', { userCount: room.users.size });

    // Send latest existing room code & language to the newly joined user
    if (typeof callback === 'function') {
      callback({
        success: true,
        roomId: cleanRoomId,
        code: room.code,
        language: room.language,
        userCount: room.users.size
      });
    }

    socket.emit('code-update', { code: room.code, language: room.language });
  });

  // Event: code-change (Broadcast to other users in the room)
  socket.on('code-change', ({ roomId, code }) => {
    if (!roomId) return;
    const room = getRoomData(roomId);
    room.code = code || '';

    // Broadcast change to other users in the same room only
    socket.to(roomId).emit('code-update', { code: room.code });
  });

  // Event: language-change
  socket.on('language-change', ({ roomId, language }) => {
    if (!roomId) return;
    const room = getRoomData(roomId);
    room.language = language;

    // Broadcast language change to other users in the room
    socket.to(roomId).emit('language-update', { language });
  });

  // Event: save-code (Persists code to saved-code.json)
  socket.on('save-code', ({ roomId, code, language }, callback) => {
    if (!roomId) return;
    const room = getRoomData(roomId);
    room.code = code !== undefined ? code : room.code;
    room.language = language || room.language;

    const saved = persistData(roomId, room.code, room.language);
    const timestamp = new Date().toLocaleTimeString();

    if (saved) {
      if (typeof callback === 'function') {
        callback({ success: true, timestamp });
      }
      io.to(roomId).emit('save-notification', { timestamp });
    } else {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Could not save to file' });
      }
    }
  });

  // Event: clear-code
  socket.on('clear-code', ({ roomId }) => {
    if (!roomId) return;
    const room = getRoomData(roomId);
    room.code = '';

    io.to(roomId).emit('code-update', { code: '' });
  });

  // Event: disconnect
  socket.on('disconnect', () => {
    if (currentRoomId && activeRooms.has(currentRoomId)) {
      const room = activeRooms.get(currentRoomId);
      room.users.delete(socket.id);
      io.to(currentRoomId).emit('user-count-update', { userCount: room.users.size });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Collaborative Code Editor Server running locally on http://localhost:${PORT}`);
  console.log(`Saved code storage: ${STORAGE_FILE}`);
});

module.exports = { app, server };
