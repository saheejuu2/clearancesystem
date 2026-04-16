# WebSocket Real-Time Updates - Quick Start Guide

## What Changed?

The system now uses **WebSocket** for real-time patient data updates instead of polling. This means:
- ✅ Updates appear **instantly** without page refresh
- ✅ **No more glitching** from constant polling
- ✅ **Reduced server load** - no constant HTTP requests
- ✅ **Automatic fallback** to polling if WebSocket unavailable

## Prerequisites

- Node.js 14+ installed
- npm installed
- WebSocket server running on port 8080

## Installation & Setup

### Step 1: Install Dependencies

```bash
npm install
```

This installs the WebSocket library (`ws`) needed for the server.

### Step 2: Start the WebSocket Server

In a **new terminal window**, run:

```bash
npm run ws-server
```

You should see:
```
WebSocket server listening on port 8080
Waiting for connections...
```

**Keep this terminal open** - the server must run continuously.

### Step 3: Start Your Application

In another terminal, start your PHP development server and frontend as usual:

```bash
# Terminal 1: PHP API server
cd api
php -S localhost:8000

# Terminal 2: Frontend dev server
cd frontend
npm run dev
```

### Step 4: Verify Connection

1. Open your browser to the frontend URL
2. Open **Developer Console** (F12)
3. Look for messages like:
   - `WebSocket connected`
   - `Subscribed to patient updates for Nurse on 2024-04-14`

If you see these, WebSocket is working! ✅

## How It Works

### Real-Time Flow

```
User Action (e.g., "Clear Patient")
    ↓
API Endpoint (update_clearance.php)
    ↓
Database Updated
    ↓
WebSocket Broadcast Triggered
    ↓
All Connected Clients Receive Update
    ↓
Dashboard Updates Instantly
```

### Automatic Fallback

If WebSocket is unavailable:
- Frontend automatically detects the failure
- Falls back to polling every 30 seconds
- Users still get updates, just with a delay
- No manual intervention needed

## Troubleshooting

### WebSocket Server Won't Start

**Error**: `Port 8080 already in use`

Solution: Kill the process using port 8080:
```bash
# Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :8080
kill -9 <PID>
```

### Updates Not Appearing

1. **Check WebSocket server is running**
   ```bash
   npm run ws-server
   ```

2. **Check browser console for errors** (F12)

3. **Verify connection in console**
   - Should see "WebSocket connected"
   - Should see "Subscribed to patient updates"

4. **Check firewall** - port 8080 must be accessible

### High Memory Usage

If the server uses too much memory:
1. Restart the WebSocket server: `npm run ws-server`
2. Check for clients that aren't disconnecting properly
3. Monitor active connections in the server logs

## Environment Variables (Optional)

Customize the WebSocket server:

```bash
# Change port (default: 8080)
export WS_PORT=9000
npm run ws-server

# Or on Windows:
set WS_PORT=9000
npm run ws-server
```

## Production Deployment

For production environments:

1. **Use WSS (Secure WebSocket)**
   - Requires SSL certificate
   - Use reverse proxy (nginx) to handle WSS

2. **Use Process Manager**
   ```bash
   npm install -g pm2
   pm2 start api/websocket-server.js --name "ws-server"
   pm2 save
   ```

3. **Monitor the Server**
   ```bash
   pm2 logs ws-server
   pm2 monit
   ```

See `WEBSOCKET_SETUP.md` for detailed production setup.

## Key Features

### Instant Updates
- Patient admissions appear immediately
- Clearances update in real-time
- Discharges reflect instantly

### Smart Subscriptions
- Each client subscribes to their role and date
- Only receives relevant updates
- Reduces bandwidth usage

### Graceful Degradation
- If WebSocket fails, polling takes over
- Users don't experience downtime
- Automatic reconnection attempts

### Keep-Alive
- Server sends ping every 30 seconds
- Detects and removes inactive connections
- Prevents zombie connections

## Testing

### Manual Test

1. Open two browser windows
2. Log in as different users (e.g., Nurse and Billing)
3. In Nurse window: Admit a patient
4. In Billing window: Patient appears instantly ✅

### Console Debugging

In browser console:
```javascript
// Check WebSocket connection
websocketService.isConnected()  // true/false

// View last update time
websocketService.lastUpdate

// Check subscriptions
websocketService.listeners
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "WebSocket connection failed" | Check if `npm run ws-server` is running |
| Updates delayed by 30 seconds | WebSocket failed, using polling fallback |
| Server crashes after a while | Restart with `npm run ws-server` |
| Port 8080 in use | Change port with `WS_PORT=9000 npm run ws-server` |
| High CPU usage | Restart server, check for infinite loops |

## Next Steps

- Read `WEBSOCKET_SETUP.md` for advanced configuration
- Check `frontend/src/services/websocket.js` for client implementation
- Review `api/websocket-server.js` for server implementation
- See `api/websocket_helper.php` for backend integration

## Support

For issues or questions:
1. Check browser console (F12) for errors
2. Check WebSocket server terminal for logs
3. Verify port 8080 is accessible
4. Ensure Node.js is installed: `node --version`

---

**Happy real-time updating!** 🚀
