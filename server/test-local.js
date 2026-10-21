const http = require('http');
const fs = require('fs');
const path = require('path');
const ioClient = require('socket.io-client');
const { app, server } = require('./server');

const STORAGE_FILE = path.join(__dirname, 'saved-code.json');
const SERVER_URL = 'http://localhost:5000';

const runTests = async () => {
  console.log('=== STARTING LOCALHOST COLLABORATIVE EDITOR TESTS ===\n');
  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  };

  try {
    // Test 1: Health check endpoint
    await test('Health check (GET /api/health)', async () => {
      await new Promise((resolve, reject) => {
        http.get(`${SERVER_URL}/api/health`, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            const json = JSON.parse(data);
            if (res.statusCode === 200 && json.status === 'ok') {
              resolve();
            } else {
              reject(new Error(`Unexpected response: ${res.statusCode} ${data}`));
            }
          });
        }).on('error', reject);
      });
    });

    // Test 2: Dual Socket.IO connections & room creation
    let socket1, socket2, socketOtherRoom;
    const testRoom = 'test-room-' + Date.now();

    await test('Socket.IO Connection & Join Room', async () => {
      socket1 = ioClient(SERVER_URL, { transports: ['websocket'] });
      socket2 = ioClient(SERVER_URL, { transports: ['websocket'] });

      await new Promise((resolve, reject) => {
        let count = 0;
        const check = () => {
          count++;
          if (count === 2) resolve();
        };
        socket1.on('connect', check);
        socket2.on('connect', check);
        setTimeout(() => reject(new Error('Socket connection timed out')), 3000);
      });

      // User 1 joins room
      const res1 = await new Promise((resolve) => {
        socket1.emit('join-room', { roomId: testRoom }, resolve);
      });
      if (!res1 || !res1.success) throw new Error('User 1 failed to join room');

      // User 2 joins room
      const res2 = await new Promise((resolve) => {
        socket2.emit('join-room', { roomId: testRoom }, resolve);
      });
      if (!res2 || !res2.success) throw new Error('User 2 failed to join room');
      if (res2.userCount !== 2) throw new Error(`Expected 2 users, got ${res2.userCount}`);
    });

    // Test 3: Real-time code change synchronization between tabs in the same room
    await test('Real-Time Code Sync between two clients', async () => {
      const sampleCode = 'function calculateSum(a, b) {\n  return a + b;\n}';

      const updatePromise = new Promise((resolve, reject) => {
        socket2.on('code-update', (data) => {
          if (data.code === sampleCode) {
            resolve();
          } else {
            reject(new Error(`Code mismatch: received "${data.code}"`));
          }
        });
        setTimeout(() => reject(new Error('code-update timeout')), 3000);
      });

      // User 1 types code
      socket1.emit('code-change', {
        roomId: testRoom,
        code: sampleCode
      });

      await updatePromise;
    });

    // Test 4: Language change synchronization
    await test('Language Sync across room clients', async () => {
      const updatePromise = new Promise((resolve, reject) => {
        socket1.on('language-update', (data) => {
          if (data.language === 'python') {
            resolve();
          } else {
            reject(new Error(`Language mismatch: ${data.language}`));
          }
        });
        setTimeout(() => reject(new Error('language-update timeout')), 3000);
      });

      // User 2 switches language to Python
      socket2.emit('language-change', {
        roomId: testRoom,
        language: 'python'
      });

      await updatePromise;
    });

    // Test 5: Room isolation (Client in another room does not receive updates)
    await test('Room Isolation (Different rooms do not share updates)', async () => {
      socketOtherRoom = ioClient(SERVER_URL, { transports: ['websocket'] });
      await new Promise((resolve) => socketOtherRoom.on('connect', resolve));

      await new Promise((resolve) => {
        socketOtherRoom.emit('join-room', { roomId: 'isolated-room-xyz' }, resolve);
      });

      let receivedLeakedUpdate = false;
      socketOtherRoom.on('code-update', () => {
        receivedLeakedUpdate = true;
      });

      // User 1 broadcasts in testRoom
      socket1.emit('code-change', {
        roomId: testRoom,
        code: '// Secret code in testRoom'
      });

      // Wait 300ms to verify no leakage
      await new Promise((r) => setTimeout(r, 300));
      if (receivedLeakedUpdate) {
        throw new Error('Code leaked to a client in a different room!');
      }
    });

    // Test 6: Persistence to saved-code.json
    await test('Save Code to disk (saved-code.json)', async () => {
      const persistentCode = '# Python script saved to disk\nprint("Persistent Data")';

      const saveRes = await new Promise((resolve) => {
        socket1.emit(
          'save-code',
          {
            roomId: testRoom,
            code: persistentCode,
            language: 'python'
          },
          resolve
        );
      });

      if (!saveRes || !saveRes.success) throw new Error('save-code returned false');

      // Check the physical JSON file on disk
      const rawJson = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(rawJson);
      if (!parsed[testRoom] || parsed[testRoom].code !== persistentCode) {
        throw new Error('saved-code.json does not contain the expected code');
      }
      if (parsed[testRoom].language !== 'python') {
        throw new Error('saved-code.json does not contain the expected language');
      }
    });

    // Clean up sockets
    if (socket1) socket1.disconnect();
    if (socket2) socket2.disconnect();
    if (socketOtherRoom) socketOtherRoom.disconnect();
  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    // Exit process
    process.exit(failed > 0 ? 1 : 0);
  }
};

// Wait 500ms for server to start before running test suite
setTimeout(runTests, 500);
