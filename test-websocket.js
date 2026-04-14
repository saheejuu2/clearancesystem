#!/usr/bin/env node

/**
 * WebSocket Server Test Script
 * Tests the WebSocket server connection and basic functionality
 * 
 * Usage: node test-websocket.js
 */

const WebSocket = require('ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:8080';
const TEST_TIMEOUT = 5000;

console.log('🧪 WebSocket Server Test\n');
console.log(`Testing connection to: ${WS_URL}\n`);

let testsPassed = 0;
let testsFailed = 0;

/**
 * Test 1: Basic Connection
 */
function testBasicConnection() {
  return new Promise((resolve) => {
    console.log('Test 1: Basic Connection');
    
    const ws = new WebSocket(WS_URL);
    let connected = false;

    const timeout = setTimeout(() => {
      if (!connected) {
        console.log('  ❌ FAILED: Connection timeout\n');
        testsFailed++;
        ws.close();
        resolve();
      }
    }, TEST_TIMEOUT);

    ws.onopen = () => {
      connected = true;
      clearTimeout(timeout);
      console.log('  ✅ PASSED: Connected successfully\n');
      testsPassed++;
      ws.close();
      resolve();
    };

    ws.onerror = (error) => {
      clearTimeout(timeout);
      console.log(`  ❌ FAILED: ${error.message}\n`);
      testsFailed++;
      resolve();
    };
  });
}

/**
 * Test 2: Receive Welcome Message
 */
function testWelcomeMessage() {
  return new Promise((resolve) => {
    console.log('Test 2: Receive Welcome Message');
    
    const ws = new WebSocket(WS_URL);
    let receivedMessage = false;

    const timeout = setTimeout(() => {
      if (!receivedMessage) {
        console.log('  ❌ FAILED: No welcome message received\n');
        testsFailed++;
        ws.close();
        resolve();
      }
    }, TEST_TIMEOUT);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') {
          receivedMessage = true;
          clearTimeout(timeout);
          console.log(`  ✅ PASSED: Received welcome message (clientId: ${data.clientId})\n`);
          testsPassed++;
          ws.close();
          resolve();
        }
      } catch (e) {
        console.log(`  ❌ FAILED: Invalid message format\n`);
        testsFailed++;
        clearTimeout(timeout);
        ws.close();
        resolve();
      }
    };

    ws.onerror = (error) => {
      clearTimeout(timeout);
      console.log(`  ❌ FAILED: ${error.message}\n`);
      testsFailed++;
      resolve();
    };
  });
}

/**
 * Test 3: Subscribe to Patients
 */
function testSubscription() {
  return new Promise((resolve) => {
    console.log('Test 3: Subscribe to Patients');
    
    const ws = new WebSocket(WS_URL);
    let subscribed = false;

    const timeout = setTimeout(() => {
      if (!subscribed) {
        console.log('  ❌ FAILED: Subscription timeout\n');
        testsFailed++;
        ws.close();
        resolve();
      }
    }, TEST_TIMEOUT);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe_patients',
        role: 'Nurse',
        date: '2024-04-14'
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'subscribed') {
          subscribed = true;
          clearTimeout(timeout);
          console.log('  ✅ PASSED: Successfully subscribed to patient updates\n');
          testsPassed++;
          ws.close();
          resolve();
        }
      } catch (e) {
        console.log(`  ❌ FAILED: Invalid message format\n`);
        testsFailed++;
        clearTimeout(timeout);
        ws.close();
        resolve();
      }
    };

    ws.onerror = (error) => {
      clearTimeout(timeout);
      console.log(`  ❌ FAILED: ${error.message}\n`);
      testsFailed++;
      resolve();
    };
  });
}

/**
 * Test 4: Ping/Pong
 */
function testPingPong() {
  return new Promise((resolve) => {
    console.log('Test 4: Ping/Pong');
    
    const ws = new WebSocket(WS_URL);
    let receivedPong = false;

    const timeout = setTimeout(() => {
      if (!receivedPong) {
        console.log('  ❌ FAILED: No pong received\n');
        testsFailed++;
        ws.close();
        resolve();
      }
    }, TEST_TIMEOUT);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'ping' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') {
          receivedPong = true;
          clearTimeout(timeout);
          console.log('  ✅ PASSED: Received pong response\n');
          testsPassed++;
          ws.close();
          resolve();
        }
      } catch (e) {
        console.log(`  ❌ FAILED: Invalid message format\n`);
        testsFailed++;
        clearTimeout(timeout);
        ws.close();
        resolve();
      }
    };

    ws.onerror = (error) => {
      clearTimeout(timeout);
      console.log(`  ❌ FAILED: ${error.message}\n`);
      testsFailed++;
      resolve();
    };
  });
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    await testBasicConnection();
    await testWelcomeMessage();
    await testSubscription();
    await testPingPong();

    console.log('═'.repeat(50));
    console.log(`\n📊 Test Results\n`);
    console.log(`  ✅ Passed: ${testsPassed}`);
    console.log(`  ❌ Failed: ${testsFailed}`);
    console.log(`  📈 Total:  ${testsPassed + testsFailed}\n`);

    if (testsFailed === 0) {
      console.log('🎉 All tests passed! WebSocket server is working correctly.\n');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed. Check the WebSocket server.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test error:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests();
