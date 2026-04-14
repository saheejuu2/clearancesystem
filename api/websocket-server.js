/**
 * WebSocket server for real-time patient data updates
 * Run with: node api/websocket-server.js
 * 
 * This server:
 * - Accepts WebSocket connections from the frontend
 * - Manages subscriptions for patient data by role and date
 * - Broadcasts patient updates to subscribed clients
 * - Can be triggered by PHP backend to send updates
 */

const WebSocket = require('ws');
const http = require('http');
const url = require('url');

// Configuration
const WS_PORT = process.env.WS_PORT || 8080;

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // Handle broadcast endpoint
  if (parsedUrl.pathname === '/broadcast' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        broadcastPatientUpdate(data.role, data.date, data.patients);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Default response
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket Server Running\n');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Track clients and their subscriptions
const clients = new Map(); // clientId -> { ws, subscriptions: Set }
const subscriptions = new Map(); // "role:date" -> Set of clientIds

let clientCounter = 0;

/**
 * Handle new WebSocket connection
 */
wss.on('connection', (ws) => {
  const clientId = ++clientCounter;
  console.log(`[${new Date().toISOString()}] Client connected: ${clientId}`);

  clients.set(clientId, {
    ws,
    subscriptions: new Set(),
    isAlive: true
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to WebSocket server',
    clientId
  }));

  /**
   * Handle incoming messages
   */
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(clientId, message);
    } catch (e) {
      console.error(`[${clientId}] Failed to parse message:`, e.message);
    }
  });

  /**
   * Handle client disconnect
   */
  ws.on('close', () => {
    console.log(`[${new Date().toISOString()}] Client disconnected: ${clientId}`);
    const client = clients.get(clientId);
    if (client) {
      // Remove from all subscriptions
      client.subscriptions.forEach(subKey => {
        const sub = subscriptions.get(subKey);
        if (sub) {
          sub.delete(clientId);
          if (sub.size === 0) {
            subscriptions.delete(subKey);
          }
        }
      });
    }
    clients.delete(clientId);
  });

  /**
   * Handle errors
   */
  ws.on('error', (error) => {
    console.error(`[${clientId}] WebSocket error:`, error.message);
  });

  /**
   * Handle pong for keep-alive
   */
  ws.on('pong', () => {
    const client = clients.get(clientId);
    if (client) {
      client.isAlive = true;
    }
  });
});

/**
 * Handle incoming message from client
 */
function handleMessage(clientId, message) {
  const client = clients.get(clientId);
  if (!client) return;

  const { type, role, date } = message;

  switch (type) {
    case 'subscribe_patients':
      subscribeToPatients(clientId, role, date);
      break;

    case 'unsubscribe_patients':
      unsubscribeFromPatients(clientId);
      break;

    case 'ping':
      sendToClient(clientId, { type: 'pong' });
      break;

    default:
      console.log(`[${clientId}] Unknown message type: ${type}`);
  }
}

/**
 * Subscribe client to patient updates
 */
function subscribeToPatients(clientId, role, date) {
  const client = clients.get(clientId);
  if (!client) return;

  const subKey = `${role}:${date}`;

  // Remove from previous subscriptions
  client.subscriptions.forEach(oldKey => {
    const sub = subscriptions.get(oldKey);
    if (sub) {
      sub.delete(clientId);
      if (sub.size === 0) {
        subscriptions.delete(oldKey);
      }
    }
  });
  client.subscriptions.clear();

  // Add to new subscription
  if (!subscriptions.has(subKey)) {
    subscriptions.set(subKey, new Set());
  }
  subscriptions.get(subKey).add(clientId);
  client.subscriptions.add(subKey);

  console.log(`[${clientId}] Subscribed to ${subKey}`);
  sendToClient(clientId, {
    type: 'subscribed',
    message: `Subscribed to patient updates for ${role} on ${date}`
  });
}

/**
 * Unsubscribe client from patient updates
 */
function unsubscribeFromPatients(clientId) {
  const client = clients.get(clientId);
  if (!client) return;

  client.subscriptions.forEach(subKey => {
    const sub = subscriptions.get(subKey);
    if (sub) {
      sub.delete(clientId);
      if (sub.size === 0) {
        subscriptions.delete(subKey);
      }
    }
  });
  client.subscriptions.clear();

  console.log(`[${clientId}] Unsubscribed from patient updates`);
  sendToClient(clientId, {
    type: 'unsubscribed',
    message: 'Unsubscribed from patient updates'
  });
}

/**
 * Send message to specific client
 */
function sendToClient(clientId, message) {
  const client = clients.get(clientId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}

/**
 * Broadcast patient update to subscribed clients
 */
function broadcastPatientUpdate(role, date, patients) {
  const subKey = `${role}:${date}`;
  const clientIds = subscriptions.get(subKey);

  if (!clientIds || clientIds.size === 0) {
    return;
  }

  const message = JSON.stringify({
    type: 'patients_updated',
    role,
    date,
    patients,
    timestamp: Date.now()
  });

  clientIds.forEach(clientId => {
    sendToClient(clientId, JSON.parse(message));
  });

  console.log(`[${new Date().toISOString()}] Broadcast to ${clientIds.size} client(s) for ${subKey}`);
}

/**
 * Keep-alive ping
 */
setInterval(() => {
  clients.forEach((client, clientId) => {
    if (!client.isAlive) {
      console.log(`[${new Date().toISOString()}] Terminating inactive client: ${clientId}`);
      client.ws.terminate();
      return;
    }
    client.isAlive = false;
    client.ws.ping();
  });
}, 30000);

/**
 * Start server
 */
server.listen(WS_PORT, () => {
  console.log(`[${new Date().toISOString()}] WebSocket server listening on port ${WS_PORT}`);
  console.log('Waiting for connections...');
});

/**
 * Export for use in other modules
 */
module.exports = { broadcastPatientUpdate };
