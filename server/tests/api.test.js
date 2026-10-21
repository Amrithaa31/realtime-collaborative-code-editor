process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_university_2026';

const http = require('http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ioClient = require('socket.io-client');
const { app, server } = require('../server');

let mongoServer;
let baseUrl;
let port;

// Helper to make JSON HTTP requests
const request = (path, method = 'GET', body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      url,
      {
        method,
        headers
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(rawData);
          } catch (e) {
            parsed = rawData;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const runAllTests = async () => {
  console.log('=== STARTING END-TO-END AUTOMATED TEST SUITE ===\n');
  let passedCount = 0;
  let failedCount = 0;

  const test = async (title, fn) => {
    try {
      await fn();
      console.log(`  ✓ ${title}`);
      passedCount++;
    } catch (err) {
      console.error(`  ✗ ${title}`);
      console.error(`    Error: ${err.message}`);
      failedCount++;
    }
  };

  try {
    // 1. Setup in-memory MongoDB
    console.log('[Setup] Starting in-memory MongoDB instance...');
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    console.log('[Setup] Connected to in-memory MongoDB.');

    // 2. Start HTTP & Socket server on an ephemeral free port
    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        console.log(`[Setup] Server listening on ${baseUrl}\n`);
        resolve();
      });
    });

    let user1Token, user1Id;
    let user2Token, user2Id;
    let testRoomId;

    // Test 1: Health check
    await test('Health Check Endpoint (GET /api/health)', async () => {
      const res = await request('/api/health');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.status !== 'ok') throw new Error('Status is not ok');
      if (!res.body.database.connected) throw new Error('Database is not connected');
    });

    // Test 2: User Registration
    await test('User Registration - Success (POST /api/auth/register)', async () => {
      const res = await request('/api/auth/register', 'POST', {
        name: 'Alice Developer',
        email: 'alice@university.edu',
        password: 'password123',
        confirmPassword: 'password123'
      });
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (!res.body.token) throw new Error('Token not returned');
      if (res.body.user.email !== 'alice@university.edu') throw new Error('Email mismatch');
      if (res.body.user.passwordHash) throw new Error('Password hash leaked in response!');
      user1Token = res.body.token;
      user1Id = res.body.user.id;
    });

    // Test 3: Duplicate Registration
    await test('User Registration - Reject Duplicate Email', async () => {
      const res = await request('/api/auth/register', 'POST', {
        name: 'Alice Duplicate',
        email: 'alice@university.edu',
        password: 'password123',
        confirmPassword: 'password123'
      });
      if (res.status !== 409) throw new Error(`Expected 409 Conflict, got ${res.status}`);
    });

    // Test 4: Register second user
    await test('Register Second User (Bob)', async () => {
      const res = await request('/api/auth/register', 'POST', {
        name: 'Bob Programmer',
        email: 'bob@university.edu',
        password: 'password123',
        confirmPassword: 'password123'
      });
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      user2Token = res.body.token;
      user2Id = res.body.user.id;
    });

    // Test 5: User Login
    await test('User Login - Success (POST /api/auth/login)', async () => {
      const res = await request('/api/auth/login', 'POST', {
        email: 'alice@university.edu',
        password: 'password123'
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.token) throw new Error('Token missing from login');
    });

    // Test 6: User Login - Invalid credentials
    await test('User Login - Invalid Password Rejected', async () => {
      const res = await request('/api/auth/login', 'POST', {
        email: 'alice@university.edu',
        password: 'wrongpassword'
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // Test 7: Protected Route without token
    await test('Protected Route (GET /api/auth/me) - Deny Unauthenticated', async () => {
      const res = await request('/api/auth/me');
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // Test 8: Protected Route with valid token
    await test('Protected Route (GET /api/auth/me) - Authorize User', async () => {
      const res = await request('/api/auth/me', 'GET', null, user1Token);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.user.email !== 'alice@university.edu') throw new Error('User email mismatch');
    });

    // Test 9: Create Room
    await test('Create Room (POST /api/rooms)', async () => {
      const res = await request(
        '/api/rooms',
        'POST',
        { name: 'CS301 Lab Room', language: 'python' },
        user1Token
      );
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      if (!res.body.room.roomId) throw new Error('roomId was not generated');
      testRoomId = res.body.room.roomId;
    });

    // Test 10: List Rooms
    await test('List Rooms (GET /api/rooms)', async () => {
      const res = await request('/api/rooms', 'GET', null, user1Token);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.rooms) || res.body.rooms.length === 0) {
        throw new Error('Expected at least one room');
      }
      if (res.body.rooms[0].roomId !== testRoomId) {
        throw new Error('Created room not found in room list');
      }
    });

    // Test 11: Non-member cannot access private room
    await test('Room Access Control - Reject Non-Member Access', async () => {
      const res = await request(`/api/rooms/${testRoomId}`, 'GET', null, user2Token);
      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    });

    // Test 12: User 2 joins the room
    await test('Join Room (POST /api/rooms/:roomId/join)', async () => {
      const res = await request(`/api/rooms/${testRoomId}/join`, 'POST', null, user2Token);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const isMember = res.body.room.members.some((m) => m._id === user2Id || m.email === 'bob@university.edu');
      if (!isMember) throw new Error('User 2 was not added to members');
    });

    // Test 13: User 2 can now access the room
    await test('Authorized Member Access (GET /api/rooms/:roomId)', async () => {
      const res = await request(`/api/rooms/${testRoomId}`, 'GET', null, user2Token);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    // Test 14: Save and Retrieve Document
    await test('Document Update & Persistence (PUT & GET /api/documents/:roomId)', async () => {
      const newCode = 'print("Hello from Python Collaborative Session")';
      const putRes = await request(
        `/api/documents/${testRoomId}`,
        'PUT',
        { content: newCode, language: 'python' },
        user1Token
      );
      if (putRes.status !== 200) throw new Error(`Expected 200, got ${putRes.status}`);

      // User 2 retrieves updated document
      const getRes = await request(`/api/documents/${testRoomId}`, 'GET', null, user2Token);
      if (getRes.status !== 200) throw new Error(`Expected 200, got ${getRes.status}`);
      if (getRes.body.document.content !== newCode) throw new Error('Persisted content mismatch');
      if (getRes.body.document.language !== 'python') throw new Error('Persisted language mismatch');
    });

    // Test 15: Socket.IO Real-time Collaboration
    await test('Socket.IO Real-Time Synchronization & Room Isolation', async () => {
      // Connect User 1 Socket
      const socket1 = ioClient(baseUrl, {
        auth: { token: user1Token },
        transports: ['websocket']
      });

      // Connect User 2 Socket
      const socket2 = ioClient(baseUrl, {
        auth: { token: user2Token },
        transports: ['websocket']
      });

      await new Promise((resolve, reject) => {
        let u1Ready = false;
        let u2Ready = false;
        socket1.on('connect', () => {
          u1Ready = true;
          if (u1Ready && u2Ready) resolve();
        });
        socket2.on('connect', () => {
          u2Ready = true;
          if (u1Ready && u2Ready) resolve();
        });
        setTimeout(() => reject(new Error('Socket connection timeout')), 3000);
      });

      // User 1 joins room
      await new Promise((resolve) => {
        socket1.emit('join-room', { roomId: testRoomId }, resolve);
      });

      // User 2 joins room and receives room-init
      const initData = await new Promise((resolve, reject) => {
        socket2.on('room-init', (data) => resolve(data));
        socket2.emit('join-room', { roomId: testRoomId });
        setTimeout(() => reject(new Error('room-init timeout')), 3000);
      });

      if (!initData.roomId || initData.roomId !== testRoomId) {
        throw new Error('room-init returned invalid roomId');
      }

      // Test real-time code broadcast: User 1 types, User 2 receives
      const receivedCodePromise = new Promise((resolve, reject) => {
        socket2.on('code-update', (data) => resolve(data));
        setTimeout(() => reject(new Error('code-update timeout')), 3000);
      });

      const updatedLiveCode = 'console.log("Real-time sync verified!");';
      socket1.emit('code-change', {
        roomId: testRoomId,
        code: updatedLiveCode
      });

      const receivedCode = await receivedCodePromise;
      if (receivedCode.code !== updatedLiveCode) {
        throw new Error(`Expected "${updatedLiveCode}", got "${receivedCode.code}"`);
      }

      // Test real-time language broadcast: User 2 switches language, User 1 receives
      const receivedLangPromise = new Promise((resolve, reject) => {
        socket1.on('language-update', (data) => resolve(data));
        setTimeout(() => reject(new Error('language-update timeout')), 3000);
      });

      socket2.emit('language-change', {
        roomId: testRoomId,
        language: 'java'
      });

      const receivedLang = await receivedLangPromise;
      if (receivedLang.language !== 'java') {
        throw new Error(`Expected "java", got "${receivedLang.language}"`);
      }

      socket1.disconnect();
      socket2.disconnect();
    });

    // Test 16: Room Deletion Authorization
    await test('Room Deletion - Non-Owner Rejection & Owner Deletion', async () => {
      // User 2 tries to delete Alice's room
      const unauthRes = await request(`/api/rooms/${testRoomId}`, 'DELETE', null, user2Token);
      if (unauthRes.status !== 403) throw new Error(`Expected 403 for non-owner, got ${unauthRes.status}`);

      // User 1 (owner) deletes room
      const authRes = await request(`/api/rooms/${testRoomId}`, 'DELETE', null, user1Token);
      if (authRes.status !== 200) throw new Error(`Expected 200, got ${authRes.status}`);

      // Verify room is deleted
      const checkRes = await request(`/api/rooms/${testRoomId}`, 'GET', null, user1Token);
      if (checkRes.status !== 404) throw new Error(`Expected 404 after deletion, got ${checkRes.status}`);
    });
  } catch (globalErr) {
    console.error('Fatal test execution error:', globalErr);
    failedCount++;
  } finally {
    // Teardown
    console.log('\n[Teardown] Stopping servers...');
    if (server) {
      server.close();
    }
    if (mongoose.connection) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log('[Teardown] Cleaned up.');

    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log(`========================================\n`);

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
};

runAllTests();
