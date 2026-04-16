# WebSocket Deployment Checklist

## Pre-Deployment

### Environment Setup
- [ ] Node.js 14+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] PHP 7.4+ installed (`php --version`)
- [ ] MySQL running and accessible
- [ ] Port 8080 available for WebSocket server
- [ ] Port 8000 available for PHP server (or your chosen port)

### Dependencies
- [ ] Run `npm install` to install WebSocket library
- [ ] Verify `node_modules/ws` exists
- [ ] Check `package.json` has correct scripts

### Code Review
- [ ] All frontend files updated (4 dashboards + App.jsx)
- [ ] All backend files updated (3 API files)
- [ ] WebSocket helper functions added
- [ ] No syntax errors in modified files

## Pre-Launch Testing

### Local Testing
- [ ] Start WebSocket server: `npm run ws-server`
- [ ] Run test script: `npm run test-ws`
- [ ] All 4 tests pass ✅
- [ ] Start PHP server: `php -S localhost:8000`
- [ ] Start frontend: `npm run dev`
- [ ] Open browser to frontend URL

### Connection Verification
- [ ] Open Developer Console (F12)
- [ ] Look for "WebSocket connected" message
- [ ] Check for subscription messages
- [ ] No errors in console

### Functional Testing
- [ ] Open two browser windows (different users)
- [ ] Admit a patient in Nurse window
- [ ] Verify instant update in Billing window ✅
- [ ] Clear a patient in Cost Center window
- [ ] Verify instant update in Billing window ✅
- [ ] Discharge a patient
- [ ] Verify instant update in all windows ✅

### Fallback Testing
- [ ] Stop WebSocket server (Ctrl+C)
- [ ] Verify frontend still works
- [ ] Perform action (should use polling)
- [ ] Verify update appears within 30 seconds
- [ ] Restart WebSocket server
- [ ] Verify WebSocket reconnects automatically

## Deployment Steps

### Step 1: Backup
- [ ] Backup current database
- [ ] Backup current code
- [ ] Document current configuration

### Step 2: Deploy Code
- [ ] Deploy frontend code
- [ ] Deploy backend code
- [ ] Deploy WebSocket server code
- [ ] Verify all files in place

### Step 3: Install Dependencies
- [ ] Run `npm install` on server
- [ ] Verify `node_modules/ws` installed
- [ ] Check file permissions

### Step 4: Start Services
- [ ] Start WebSocket server: `npm run ws-server`
- [ ] Verify server started successfully
- [ ] Check for errors in logs
- [ ] Start PHP server (or Apache/Nginx)
- [ ] Verify PHP server running

### Step 5: Verify Deployment
- [ ] Access frontend URL
- [ ] Check browser console for WebSocket connection
- [ ] Verify no errors
- [ ] Test real-time updates
- [ ] Test fallback mechanism

## Post-Deployment

### Monitoring
- [ ] Monitor WebSocket server logs
- [ ] Check for connection errors
- [ ] Monitor server resource usage
- [ ] Check database performance
- [ ] Monitor network traffic

### User Testing
- [ ] Have users test real-time updates
- [ ] Collect feedback on performance
- [ ] Monitor for reported issues
- [ ] Check error logs for problems

### Performance Baseline
- [ ] Record update latency
- [ ] Record server CPU usage
- [ ] Record memory usage
- [ ] Record network bandwidth
- [ ] Compare with pre-migration metrics

## Troubleshooting

### If WebSocket Server Won't Start
- [ ] Check port 8080 is available: `lsof -i :8080`
- [ ] Kill process using port: `kill -9 <PID>`
- [ ] Check Node.js version: `node --version`
- [ ] Check for errors in `api/websocket-server.js`
- [ ] Verify `ws` module installed: `npm list ws`

### If Updates Not Appearing
- [ ] Verify WebSocket server is running
- [ ] Check browser console for errors
- [ ] Verify client is subscribed
- [ ] Check network tab for WebSocket messages
- [ ] Verify role and date match

### If Server Crashes
- [ ] Check error logs
- [ ] Restart WebSocket server
- [ ] Check for memory leaks
- [ ] Monitor with `ps aux | grep node`
- [ ] Consider using PM2 for process management

### If High Memory Usage
- [ ] Restart WebSocket server
- [ ] Check for zombie connections
- [ ] Monitor active connections
- [ ] Consider implementing connection limits

## Rollback Plan

### If Issues Occur
1. [ ] Stop WebSocket server
2. [ ] Frontend automatically falls back to polling
3. [ ] Users can continue working (with 30-second delay)
4. [ ] Investigate issue
5. [ ] Fix and redeploy

### Complete Rollback
1. [ ] Revert frontend code to previous version
2. [ ] Revert backend code to previous version
3. [ ] Restore database backup if needed
4. [ ] Restart services
5. [ ] Verify system working

## Production Setup (Optional)

### Process Management
- [ ] Install PM2: `npm install -g pm2`
- [ ] Create PM2 config for WebSocket server
- [ ] Set up auto-restart on crash
- [ ] Set up log rotation

### SSL/TLS (WSS)
- [ ] Obtain SSL certificate
- [ ] Configure reverse proxy (nginx)
- [ ] Set up WSS on port 443
- [ ] Update frontend to use WSS

### Monitoring
- [ ] Set up PM2 monitoring
- [ ] Set up error logging
- [ ] Set up performance monitoring
- [ ] Set up alerts for issues

### Backup & Recovery
- [ ] Set up automated backups
- [ ] Test backup restoration
- [ ] Document recovery procedures
- [ ] Set up disaster recovery plan

## Sign-Off

### Development Team
- [ ] Code review completed
- [ ] All tests passed
- [ ] Documentation complete
- [ ] Ready for deployment

### QA Team
- [ ] Functional testing passed
- [ ] Performance testing passed
- [ ] Fallback testing passed
- [ ] Ready for production

### Operations Team
- [ ] Infrastructure ready
- [ ] Monitoring configured
- [ ] Backup procedures ready
- [ ] Rollback plan documented

### Management
- [ ] Deployment approved
- [ ] Risk assessment completed
- [ ] Communication plan ready
- [ ] Go/No-Go decision: **GO** ✅

## Post-Deployment Monitoring (First 24 Hours)

- [ ] Monitor WebSocket server logs
- [ ] Monitor application performance
- [ ] Monitor user feedback
- [ ] Monitor error rates
- [ ] Monitor resource usage
- [ ] Check for any issues
- [ ] Document any problems
- [ ] Prepare fixes if needed

## Success Criteria

✅ WebSocket server running without errors
✅ All clients connecting successfully
✅ Real-time updates working instantly
✅ Fallback to polling working
✅ No increase in error rates
✅ No performance degradation
✅ Users reporting smooth experience
✅ Server resource usage acceptable

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Approved By**: _______________
**Status**: _______________

## Notes

```
_________________________________________________________________

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
```
