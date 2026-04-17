# WebSocket Real-Time Updates Setup

This document explains how to set up and run the WebSocket server for real-time patient data updates.

## Overview

The system now uses WebSocket for real-time updates instead of polling. This provides:
- **Instant updates**: Changes appear immediately without waiting for polling intervals
- **Reduced server load**: No constant polling requests
- **Better UX**: Smooth, natural-feeling updates
- **Fallback support**: Automatically falls back to polling if WebSocket is unavailable

## Architecture

```
Frontend (React)
    ↓
WebSocket Client (frontend/src/services/websocket.js)
    ↓
WebSocket Server (Node.js - api/websocket-server.js)
    ↓
Database (MySQL)
```

## Installation

### 1. Install Node.js Dependencies

```bash
npm install
```

This installs:
- `ws`: WebSocket library
- `mysql2`: MySQL client for database access

### 2. Start the WebSocket Server

```bash
npm run ws-server
```

Or directly:

```bash
node api/websocket-server.js
```

The server will start on port 8080 (configurable via `WS_PORT` environment variable).

### 3. Configure Environment Variables (Optional)

```bash
export WS_PORT=8080
export DB_HOST=localhost
export DB_USER=root
export DB_PASS=password
export DB_NAME=hospital_clearance
```

## How It Works

### Frontend Connection

1. When the app loads, `App.jsx` initializes the WebSocket connection
2. The connection is established to `ws://[host]:8080`
3. Each dashboard component subscribes to patient updates for its role and date

### Real-Time Updates

1. When a patient record is updated (e.g., cleared, discharged), the backend can trigger a broadcast
2. The WebSocket server sends the updated patient list to all subscribed clients
3. The frontend receives the update and re-renders immediately

### Fallback Mechanism

If WebSocket is unavailable:
- The `useWebSocketPatients` hook detects the connection failure
- It automatically falls back to polling every 30 seconds
- Users still get updates, just with a slight delay

## Message Types

### Client → Server

```json
{
  "type": "subscribe_patients",
  "role": "Nurse",
  "date": "2024-04-14"
}
```

```json
{
  "type": "unsubscribe_patients"
}
```

```json
{
  "type": "ping"
}
```

### Server → Client

```json
{
  "type": "connected",
  "message": "Connected to WebSocket server",
  "clientId": 1
}
```

```json
{
  "type": "patients_updated",
  "role": "Nurse",
  "date": "2024-04-14",
  "patients": [...],
  "timestamp": 1713052800000
}
```

```json
{
  "type": "pong"
}
```

## Triggering Updates from Backend

To broadcast patient updates from PHP:

```php
// In your PHP code after updating a patient
$role = 'Nurse';
$date = '2024-04-14';
$patients = getPatients($role, $date); // Your function

// Send to WebSocket server
$ch = curl_init('http://localhost:8080/broadcast');
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
  'role' => $role,
  'date' => $date,
  'patients' => $patients
]));
curl_exec($ch);
curl_close($ch);
```

## Troubleshooting

### WebSocket Connection Fails

1. Check if the server is running: `npm run ws-server`
2. Verify port 8080 is not in use: `lsof -i :8080`
3. Check firewall settings
4. Verify the frontend URL matches the server host

### Updates Not Appearing

1. Check browser console for errors
2. Verify the client is subscribed: Look for "Subscribed to patient updates" message
3. Check WebSocket server logs for broadcast messages
4. Ensure the role and date match between subscription and broadcast

### High Memory Usage

1. Check for clients that aren't disconnecting properly
2. Monitor the number of active subscriptions
3. Restart the server if needed

## Performance Considerations

- **Concurrent Connections**: The server can handle hundreds of concurrent connections
- **Message Size**: Patient data is sent as JSON, keep payloads reasonable
- **Broadcast Frequency**: Limit broadcasts to avoid overwhelming clients
- **Memory**: Each client connection uses minimal memory (~1KB)

## Security Notes

- WebSocket connections are not encrypted by default
- For production, use WSS (WebSocket Secure) with SSL/TLS
- Implement authentication to verify client identity
- Validate all incoming messages
- Rate-limit broadcasts to prevent abuse

## Production Deployment

For production:

1. Use WSS (WebSocket Secure):
   ```bash
   export WS_PROTOCOL=wss
   export WS_PORT=443
   ```

2. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start api/websocket-server.js --name "ws-server"
   pm2 save
   ```

3. Use a reverse proxy (nginx) to handle WSS:
   ```nginx
   server {
     listen 443 ssl;
     server_name your-domain.com;
     
     location /ws {
       proxy_pass http://localhost:8080;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
     }
   }
   ```

## Monitoring

Monitor the WebSocket server with:

```bash
# Watch active connections
watch -n 1 'lsof -i :8080 | wc -l'

# Monitor memory usage
ps aux | grep websocket-server

# Check logs
tail -f websocket-server.log
```

## Disabling WebSocket (Fallback to Polling)

If you need to disable WebSocket temporarily:

1. Stop the WebSocket server: `Ctrl+C`
2. The frontend will automatically fall back to polling
3. Updates will still work, just with 30-second delays

## Future Enhancements

- [ ] Add authentication/authorization
- [ ] Implement message compression
- [ ] Add database change detection (triggers)
- [ ] Implement client-side caching
- [ ] Add metrics/monitoring dashboard
- [ ] Support for multiple WebSocket servers (clustering)
