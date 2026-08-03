# OpenShift Pod Terminal

A lightweight web application for accessing OpenShift pod terminals directly from your browser.

## Features

- 🔐 **Secure Authentication**: Login using your OpenShift username and password
- 🎯 **RBAC Compliant**: Uses your authenticated user's permissions only
- 🖥️ **Interactive Terminal**: Full-featured terminal with xterm.js
- 📦 **Minimal Dependencies**: Lightweight implementation with essential libraries only
- 🔄 **Shell Fallback**: Attempts `/bin/bash`, falls back to `/bin/sh`
- 🌐 **WebSocket Streaming**: Real-time stdin/stdout/stderr streaming
- 🛡️ **No Credential Storage**: Backend never stores your credentials

## Architecture

```
openshift-shell/
├── backend/          # Node.js + Express + WebSocket
│   ├── server.js     # Main server with API endpoints and WebSocket handling
│   └── package.json  # Backend dependencies
├── frontend/         # HTML + JavaScript + xterm.js
│   ├── login.html    # Login page
│   ├── index.html    # Terminal interface
│   ├── app.js        # Frontend logic
│   └── style.css     # Styling
└── README.md         # This file
```

## Prerequisites

- **Option 1 (Docker)**: Docker and Docker Compose
- **Option 2 (Manual)**: Node.js 14+ and npm
- Access to an OpenShift cluster
- Valid OpenShift user credentials

## Installation

### Option 1: Using Docker (Recommended)

The easiest way to run the application is using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/yourusername/openshift-shell.git
cd openshift-shell

# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

**Access the application:**
- Frontend: http://localhost:8080/login.html
- Backend API: http://localhost:3000

**Building individual images:**
```bash
# Backend
docker build -t openshift-terminal-backend ./backend

# Frontend
docker build -t openshift-terminal-frontend ./frontend
```

**Running without Docker Compose:**
```bash
# Run backend
docker run -d -p 3000:3000 --name backend openshift-terminal-backend

# Run frontend
docker run -d -p 8080:80 --name frontend openshift-terminal-frontend
```

### Option 2: Manual Installation

#### 1. Clone the repository

```bash
cd openshift-shell
```

#### 2. Install backend dependencies

```bash
cd backend
npm install
```

#### 3. Start the backend server

```bash
npm start
```

The server will start on `http://localhost:3000`.

#### 4. Serve the frontend

Open a new terminal and serve the frontend files. You can use any static file server:

**Option A: Using Python**
```bash
cd frontend
python -m http.server 8080
```

**Option B: Using Node.js http-server**
```bash
npm install -g http-server
cd frontend
http-server -p 8080
```

**Option C: Using VS Code Live Server**
- Open the `frontend` folder in VS Code
- Right-click `login.html` and select "Open with Live Server"

#### 5. Access the application

Open your browser and navigate to:
- `http://localhost:8080/login.html` (or the URL shown by your chosen server)

## Usage

### 1. Login

1. Enter your OpenShift cluster API URL (e.g., `https://api.cluster.example.com:6443`)
2. Enter your OpenShift username
3. Enter your OpenShift password
4. Click **Login**

### 2. Access a Pod Terminal

1. **Select Namespace**: Choose from the dropdown (limited to namespaces you have access to)
2. **Select Pod**: Choose a running pod from the selected namespace
3. **Select Container**: If the pod has multiple containers, select one
4. Click **Connect**

### 3. Using the Terminal

- Type commands as you would in a normal terminal
- Use standard terminal shortcuts (Ctrl+C, Ctrl+D, etc.)
- Click **Disconnect** to close the connection
- Click **Logout** to end your session

## Configuration

### Backend Port

To change the backend port, set the `PORT` environment variable:

```bash
PORT=5000 npm start
```

### API and WebSocket URLs

If you deploy to a different host/port, update the URLs in the frontend files:

**frontend/login.html** (line 37):
```javascript
const API_URL = 'http://localhost:3000';
```

**frontend/app.js** (lines 1-2):
```javascript
const API_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';
```

## Security Considerations

### Development vs. Production

This application is designed for **internal use** or **development environments**. For production:

1. **Enable HTTPS**: Use a reverse proxy (nginx, Apache) with SSL certificates
2. **Remove SSL Verification Bypass**: Update `server.js` to properly validate certificates:
   ```javascript
   const httpsAgent = new https.Agent({ rejectUnauthorized: true });
   ```
3. **Add Session Management**: Use Redis or a proper session store instead of in-memory storage
4. **Rate Limiting**: Implement rate limiting to prevent brute-force attacks
5. **CORS**: Configure CORS properly for your domain
6. **Token Expiry**: Implement proper token refresh mechanisms

### Current Security Features

✅ Credentials are **never stored**  
✅ Uses user's own RBAC permissions  
✅ Session tokens expire after 8 hours  
✅ WebSocket connections are authenticated  
✅ Only running pods are shown  

## Troubleshooting

### "Authentication failed"

- Verify your OpenShift URL is correct (include `https://` and port)
- Check your username and password
- Ensure your user has API access to the cluster

### "Session expired"

- Sessions expire after 8 hours or when the backend restarts
- Simply log in again

### "Failed to connect to pod"

- Ensure the pod is in "Running" state
- Verify you have `exec` permissions in the namespace
- Check if the pod has `/bin/bash` or `/bin/sh` available

### "Failed to load namespaces"

- Ensure you have permissions to list namespaces
- Check if your token is still valid

### Certificate Errors

For development with self-signed certificates, the backend disables SSL verification. For production, use proper certificates and enable verification.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | Authenticate with OpenShift |
| GET | `/api/namespaces` | List accessible namespaces |
| GET | `/api/namespaces/:namespace/pods` | List running pods in namespace |
| WS | `/` | WebSocket connection for terminal |

## WebSocket Protocol

### Client to Server

```json
// Initialize connection
{ "type": "init", "sessionId": "...", "namespace": "...", "pod": "...", "container": "..." }

// Send input
{ "type": "input", "data": "ls -la\n" }

// Resize terminal
{ "type": "resize", "cols": 80, "rows": 24 }
```

### Server to Client

```json
// Ready to use
{ "type": "ready", "shell": "/bin/bash" }

// Output from pod
{ "type": "output", "data": "..." }

// Error occurred
{ "type": "error", "message": "..." }

// Connection closed
{ "type": "closed" }
```

## Dependencies

### Backend

- **express**: Web framework
- **ws**: WebSocket implementation
- **axios**: HTTP client for OpenShift API
- **cors**: CORS middleware

### Frontend

- **xterm.js**: Terminal emulator (CDN)
- **xterm-addon-fit**: Terminal resize addon (CDN)

## License

This project is provided as-is for educational and internal use.

## Contributing

Feel free to submit issues or pull requests for improvements.

## Acknowledgments

- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [OpenShift](https://www.openshift.com/) - Container platform
- [Kubernetes](https://kubernetes.io/) - Container orchestration
