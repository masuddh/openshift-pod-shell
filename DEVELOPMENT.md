# Development Notes

## Quick Start Commands

```bash
# Start backend
cd backend && npm install && npm start

# Serve frontend (in another terminal)
cd frontend && python -m http.server 8080

# Access at http://localhost:8080/login.html
```

## Project Structure

```
openshift-shell/
├── backend/
│   ├── server.js       # Main server (API + WebSocket)
│   └── package.json    # Dependencies
├── frontend/
│   ├── login.html      # Login page
│   ├── index.html      # Main terminal interface
│   ├── app.js          # Frontend logic
│   └── style.css       # Styles
└── README.md           # Documentation
```

## Key Features Implemented

✅ OpenShift OAuth authentication  
✅ Token-based session management  
✅ Namespace and pod listing (RBAC-aware)  
✅ WebSocket-based terminal streaming  
✅ Shell fallback (/bin/bash → /bin/sh)  
✅ Terminal resize support  
✅ Graceful disconnect handling  
✅ Session expiry management  

## Configuration Variables

### Backend
- `PORT`: Server port (default: 3000)
- Sessions expire after 8 hours

### Frontend
- `API_URL`: Backend API endpoint
- `WS_URL`: WebSocket endpoint
- Update in `login.html` and `app.js` if deploying elsewhere

## Testing Locally

1. Make sure you have access to an OpenShift cluster
2. Use your personal credentials (not a service account)
3. Test with a namespace where you have exec permissions
4. Try pods with both bash and sh only

## Common Issues

**Self-signed certificates**: Backend has `rejectUnauthorized: false` for development. Remove for production.

**CORS errors**: Backend allows all origins. Restrict in production.

**Session storage**: Uses in-memory Map. Use Redis for production.

## Next Steps for Production

1. Add HTTPS support
2. Implement proper certificate validation
3. Add persistent session storage (Redis)
4. Add rate limiting
5. Add logging and monitoring
6. Containerize the application
7. Add health check endpoints
