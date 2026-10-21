/**
 * Automated Verification Script for CodeTogether Backend & Real-Time Socket.IO
 * Tests room creation, joining, error handling, bidirectional synchronization,
 * room isolation, clear/reset code, and disconnect cleanups.
 */

const { io } = require('socket.io-client');
const http = require('http');

const SERVER_URL = 'http://localhost:5000';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('--- Starting CodeTogether Real-Time Collaboration Tests ---\n');

  // 1. Test HTTP Health Endpoint
  console.log('[Test 1] Testing HTTP Health Endpoint...');
  await new Promise((resolve, reject) => {
    http.get(`${SERVER_URL}/api/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'online') {
            console.log('✓ Health check passed:', json);
            resolve();
          } else {
            reject(new Error('Unexpected health response'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });

  // 2. Connect Client 1
  console.log('\n[Test 2] Connecting Client 1...');
  const client1 = io(SERVER_URL, { transports: ['websocket'] });
  await new Promise((resolve) => client1.on('connect', resolve));
  console.log(`✓ Client 1 connected: ${client1.id}`);

  // 3. Client 1 Creates a Room
  console.log('\n[Test 3] Client 1 creating room...');
  let roomA_Id = null;
  await new Promise((resolve, reject) => {
    client1.emit('create-room', { username: 'Alice' }, (res) => {
      if (res && res.success && res.roomId) {
        roomA_Id = res.roomId;
        console.log(`✓ Room created successfully with ID: ${roomA_Id}`);
        console.log(`✓ Default starter code loaded (${res.code.length} chars)`);
        console.log(`✓ Initial participants:`, res.participants);
        resolve();
      } else {
        reject(new Error('Room creation failed'));
      }
    });
  });

  // 4. Connect Client 2
  console.log('\n[Test 4] Connecting Client 2...');
  const client2 = io(SERVER_URL, { transports: ['websocket'] });
  await new Promise((resolve) => client2.on('connect', resolve));
  console.log(`✓ Client 2 connected: ${client2.id}`);

  // 5. Test Invalid Room Join
  console.log('\n[Test 5] Client 2 attempting to join nonexistent room...');
  await new Promise((resolve, reject) => {
    client2.emit('join-room', { roomId: 'room-fake-nonexistent', username: 'Bob' }, (res) => {
      if (res && !res.success) {
        console.log(`✓ Handled non-existent room join correctly with error: "${res.message}"`);
        resolve();
      } else {
        reject(new Error('Expected invalid room error, but got success'));
      }
    });
  });

  // 6. Test Valid Room Join (Client 2 joins Room A)
  console.log(`\n[Test 6] Client 2 joining Room A (${roomA_Id})...`);
  let client1NotifiedOfBob = false;
  client1.on('participants-updated', (data) => {
    if (data.participants.some(p => p.username === 'Bob')) {
      client1NotifiedOfBob = true;
    }
  });

  await new Promise((resolve, reject) => {
    client2.emit('join-room', { roomId: roomA_Id, username: 'Bob' }, (res) => {
      if (res && res.success) {
        console.log(`✓ Client 2 joined Room A. Received initial code and participants:`, res.participants.map(p => p.username));
        resolve();
      } else {
        reject(new Error(`Join room failed: ${res?.message}`));
      }
    });
  });

  await wait(200);
  if (client1NotifiedOfBob) {
    console.log(`✓ Client 1 received real-time participant update about Bob joining!`);
  } else {
    throw new Error('Client 1 was not notified of Bob joining');
  }

  // 7. Test Real-Time Code Synchronization (Client 1 edits code)
  console.log('\n[Test 7] Testing Client 1 -> Client 2 code synchronization...');
  const sampleCodeEdit = 'console.log("Real-time test edit from Alice!");';
  let client2ReceivedCode = null;

  client2.on('code-updated', (data) => {
    client2ReceivedCode = data.code;
  });

  client1.emit('code-change', { roomId: roomA_Id, code: sampleCodeEdit });
  await wait(300);

  if (client2ReceivedCode === sampleCodeEdit) {
    console.log('✓ Client 2 successfully received real-time code update from Client 1!');
  } else {
    throw new Error(`Code sync failed. Expected "${sampleCodeEdit}", got "${client2ReceivedCode}"`);
  }

  // 8. Test Bidirectional Code Sync (Client 2 edits code)
  console.log('\n[Test 8] Testing Client 2 -> Client 1 bidirectional synchronization...');
  const sampleCodeEdit2 = 'console.log("Reply from Bob!");';
  let client1ReceivedCode = null;

  client1.on('code-updated', (data) => {
    client1ReceivedCode = data.code;
  });

  client2.emit('code-change', { roomId: roomA_Id, code: sampleCodeEdit2 });
  await wait(300);

  if (client1ReceivedCode === sampleCodeEdit2) {
    console.log('✓ Client 1 successfully received bidirectional code update from Client 2!');
  } else {
    throw new Error(`Bidirectional sync failed.`);
  }

  // 9. Test Room Isolation (Client 3 creates Room B)
  console.log('\n[Test 9] Testing Room Isolation (Client 3 in Room B)...');
  const client3 = io(SERVER_URL, { transports: ['websocket'] });
  await new Promise((resolve) => client3.on('connect', resolve));
  let roomB_Id = null;

  await new Promise((resolve) => {
    client3.emit('create-room', { username: 'Charlie' }, (res) => {
      roomB_Id = res.roomId;
      resolve();
    });
  });

  let roomA_ReceivedIsolatedEdit = false;
  const tempListener = (data) => {
    if (data.code && data.code.includes('Room B Secret')) {
      roomA_ReceivedIsolatedEdit = true;
    }
  };
  client1.on('code-updated', tempListener);

  client3.emit('code-change', { roomId: roomB_Id, code: '// Room B Secret Code' });
  await wait(300);

  if (!roomA_ReceivedIsolatedEdit) {
    console.log('✓ Room isolation verified! Edits in Room B did NOT leak into Room A.');
  } else {
    throw new Error('Isolation breach! Room A received edits from Room B.');
  }

  // 10. Test Clear Code
  console.log('\n[Test 10] Testing Clear Code synchronization across Room A...');
  let clearReceived = false;
  client2.on('code-updated', (data) => {
    if (data.code === '') clearReceived = true;
  });

  client1.emit('clear-code', { roomId: roomA_Id });
  await wait(300);

  if (clearReceived) {
    console.log('✓ Clear Code successfully synchronized empty string to Client 2!');
  } else {
    throw new Error('Clear Code failed to synchronize.');
  }

  // 11. Test Reset Code
  console.log('\n[Test 11] Testing Reset Code synchronization...');
  let resetReceived = false;
  client1.on('code-updated', (data) => {
    if (data.code && data.code.includes('JavaScript Starter Template')) resetReceived = true;
  });

  client2.emit('reset-code', { roomId: roomA_Id });
  await wait(300);

  if (resetReceived) {
    console.log('✓ Reset Code successfully restored starter template for all room members!');
  } else {
    throw new Error('Reset Code failed to synchronize.');
  }

  // 12. Test Disconnect and Participant Updates
  console.log('\n[Test 12] Testing Disconnect handling & participant updates...');
  let bobLeaveNotified = false;
  client1.on('participants-updated', (data) => {
    if (!data.participants.some(p => p.username === 'Bob')) {
      bobLeaveNotified = true;
    }
  });

  client2.disconnect();
  await wait(300);

  if (bobLeaveNotified) {
    console.log('✓ When Bob disconnected, Alice immediately received updated participants list!');
  } else {
    throw new Error('Disconnect notification failed.');
  }

  // Clean up
  client1.disconnect();
  client3.disconnect();

  console.log('\n======================================================');
  console.log(' ALL REAL-TIME COLLABORATION TESTS PASSED SUCCESSFULLY! ');
  console.log('======================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ Test failed with error:', err.message);
  process.exit(1);
});
