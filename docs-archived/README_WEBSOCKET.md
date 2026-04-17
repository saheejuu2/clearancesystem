# WebSocket Real-Time Updates

## Overview

The Hospital Clearance System now uses WebSocket for real-time patient data updates instead of polling.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start WebSocket server
npm run ws-server

# 3. Test connection
npm run test-ws

# 4. Start application
cd api && php -S localhost:8000  # Terminal 1
cd frontend && npm run dev        # Terminal 2
```

## Documentation

- **QUICKSTART.md** - Quick start guide
- **WEBSOCKET_SETUP.md** - Detailed setup
- **WEBSOCKET_IMPLEMENTATION.md** - Implementation details
- **DEPLOYMENT_CHECKLIST.md** - Deployment steps
- **IMPLEMENTATION_SUMMARY.txt** - Complete summary

## Key Features

✅ Instant real-time updates
✅ Automatic fallback to polling
✅ Smooth user experience
✅ Reduced server load
✅ Comprehensive documentation

## Troubleshooting

**WebSocket won't connect?**
- Check `npm run ws-server` is running
- Verify port 8080 is available
- Check browser console for errors

**Updates not appearing?**
- Verify WebSocket server is running
- Check browser console for subscription messages
- Check network tab for WebSocket messages

**Server crashes?**
- Restart with `npm run ws-server`
- Check server logs for errors
- Verify Node.js 14+ is installed

## Support

See QUICKSTART.md for more troubleshooting and support information.
