const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const axios = require('axios');
const https = require('https');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// CORS configuration
const corsOptions = {
  origin: '*', // Allow all origins (restrict in production)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Session-Id', 'Authorization'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight
app.use(express.json());

// Disable SSL verification (for self-signed certs in dev)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Store active connections (in production, use Redis or similar)
const activeTokens = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Login endpoint - supports both token and username/password
app.post('/api/login', async (req, res) => {
  const { username, password, token, openshiftUrl } = req.body;

  if (!openshiftUrl) {
    return res.status(400).json({ error: 'Missing openshiftUrl' });
  }

  // Check if we have either token or username/password
  if (!token && (!username || !password)) {
    return res.status(400).json({ error: 'Provide either token or username/password' });
  }

  let authToken = token;

  // If token provided, use it directly
  if (token) {
    console.log(`Using provided token (length: ${token.length})`);
  } else {
    // Try OAuth authentication with username/password
    try {
      const authUrl = `${openshiftUrl}/oauth/authorize?client_id=openshift-challenging-client&response_type=token`;
      
      console.log(`Attempting OAuth login to: ${authUrl}`);
      
      const response = await axios.get(authUrl, {
        auth: { username, password },
        httpsAgent,
        maxRedirects: 0,
        validateStatus: (status) => status === 302 || status === 401 || status === 403
      });

      console.log(`OAuth response status: ${response.status}`);

      // Check if we got a redirect (successful auth)
      if (response.status !== 302) {
        console.error(`OAuth failed with status ${response.status}. Try using token instead.`);
        return res.status(401).json({ 
          error: 'OAuth authentication not supported by this cluster',
          suggestion: 'Use token authentication instead. Get token with: oc whoami -t'
        });
      }

      // Extract token from redirect URL
      const location = response.headers.location;
      if (!location) {
        console.error('No location header in OAuth response');
        return res.status(401).json({ error: 'Authentication failed - no redirect' });
      }

      const tokenMatch = location.match(/access_token=([^&]+)/);
      
      if (!tokenMatch) {
        console.error('No access token found in redirect URL');
        return res.status(401).json({ error: 'Authentication failed - no token in response' });
      }

      authToken = tokenMatch[1];
      console.log(`Token obtained via OAuth, length: ${authToken.length}`);
    } catch (error) {
      console.error('OAuth error:', error.message);
      return res.status(401).json({ 
        error: 'OAuth authentication failed',
        suggestion: 'Use token authentication instead. Get token with: oc whoami -t',
        details: error.message 
      });
    }
  }
  
  // Verify token works
  try {
    const verifyResponse = await axios.get(`${openshiftUrl}/api/v1/namespaces`, {
      headers: { Authorization: `Bearer ${authToken}` },
      httpsAgent
    });
    console.log(`Token verification successful, found ${verifyResponse.data.items.length} namespaces`);
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return res.status(401).json({ 
      error: 'Invalid token or insufficient permissions',
      details: err.response?.data?.message || err.message
    });
  }

  // Store token temporarily (expires with session)
  const sessionId = Math.random().toString(36).substring(7);
  activeTokens.set(sessionId, { token: authToken, openshiftUrl, timestamp: Date.now() });

  // Clean up old tokens (older than 8 hours)
  const eightHoursAgo = Date.now() - (8 * 60 * 60 * 1000);
  for (const [id, data] of activeTokens.entries()) {
    if (data.timestamp < eightHoursAgo) {
      activeTokens.delete(id);
    }
  }

  console.log(`Login successful, sessionId: ${sessionId}`);
  res.json({ sessionId, openshiftUrl });
});
      details: error.message 
    });
  }
});

// Get namespaces
app.get('/api/namespaces', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  const session = activeTokens.get(sessionId);

  if (!session) {
    return res.status(401).json({ error: 'Session expired' });
  }

  try {
    const response = await axios.get(`${session.openshiftUrl}/api/v1/namespaces`, {
      headers: { Authorization: `Bearer ${session.token}` },
      httpsAgent
    });

    const namespaces = response.data.items.map(ns => ns.metadata.name);
    res.json(namespaces);
  } catch (error) {
    console.error('Namespaces error:', error.message);
    res.status(500).json({ error: 'Failed to fetch namespaces' });
  }
});

// Get pods in namespace
app.get('/api/namespaces/:namespace/pods', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  const session = activeTokens.get(sessionId);
  const { namespace } = req.params;

  if (!session) {
    return res.status(401).json({ error: 'Session expired' });
  }

  try {
    const response = await axios.get(
      `${session.openshiftUrl}/api/v1/namespaces/${namespace}/pods`,
      {
        headers: { Authorization: `Bearer ${session.token}` },
        httpsAgent
      }
    );

    const pods = response.data.items
      .filter(pod => pod.status.phase === 'Running')
      .map(pod => ({
        name: pod.metadata.name,
        containers: pod.spec.containers.map(c => c.name)
      }));

    res.json(pods);
  } catch (error) {
    console.error('Pods error:', error.message);
    res.status(500).json({ error: 'Failed to fetch pods' });
  }
});

// WebSocket terminal connection
wss.on('connection', (ws) => {
  let execWs = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'init') {
        const { sessionId, namespace, pod, container } = data;
        const session = activeTokens.get(sessionId);

        if (!session) {
          ws.send(JSON.stringify({ type: 'error', message: 'Session expired' }));
          ws.close();
          return;
        }

        // Try bash first, fallback to sh
        const shells = ['/bin/bash', '/bin/sh'];
        let connected = false;

        for (const shell of shells) {
          try {
            const execUrl = new URL(`${session.openshiftUrl}/api/v1/namespaces/${namespace}/pods/${pod}/exec`);
            execUrl.searchParams.append('container', container || '');
            execUrl.searchParams.append('command', shell);
            execUrl.searchParams.append('stdin', 'true');
            execUrl.searchParams.append('stdout', 'true');
            execUrl.searchParams.append('stderr', 'true');
            execUrl.searchParams.append('tty', 'true');

            const wsUrl = execUrl.toString().replace('https://', 'wss://');
            const WebSocketClient = require('ws');
            
            execWs = new WebSocketClient(wsUrl, {
              headers: {
                Authorization: `Bearer ${session.token}`
              },
              rejectUnauthorized: false
            });

            await new Promise((resolve, reject) => {
              execWs.on('open', () => {
                connected = true;
                ws.send(JSON.stringify({ type: 'ready', shell }));
                resolve();
              });

              execWs.on('error', reject);
              
              setTimeout(() => reject(new Error('Connection timeout')), 5000);
            });

            // Forward messages from pod to client
            execWs.on('message', (podData) => {
              // Kubernetes exec uses channel prefixing (first byte is channel number)
              // Channel 1: stdout, Channel 2: stderr, Channel 3: error
              if (podData.length > 0) {
                const channel = podData[0];
                const output = podData.slice(1).toString('utf-8');
                
                if (channel === 1 || channel === 2) {
                  ws.send(JSON.stringify({ type: 'output', data: output }));
                } else if (channel === 3) {
                  ws.send(JSON.stringify({ type: 'error', message: output }));
                }
              }
            });

            execWs.on('close', () => {
              ws.send(JSON.stringify({ type: 'closed' }));
              ws.close();
            });

            execWs.on('error', (err) => {
              ws.send(JSON.stringify({ type: 'error', message: err.message }));
            });

            break;
          } catch (err) {
            if (shell === shells[shells.length - 1]) {
              throw err;
            }
          }
        }

        if (!connected) {
          ws.send(JSON.stringify({ type: 'error', message: 'Failed to connect to pod' }));
          ws.close();
        }

      } else if (data.type === 'input' && execWs) {
        // Send input to pod (channel 0 is stdin)
        const buffer = Buffer.concat([Buffer.from([0]), Buffer.from(data.data)]);
        execWs.send(buffer);
      } else if (data.type === 'resize' && execWs) {
        // Handle terminal resize (channel 4)
        const resizeMsg = JSON.stringify({
          Width: data.cols,
          Height: data.rows
        });
        const buffer = Buffer.concat([Buffer.from([4]), Buffer.from(resizeMsg)]);
        execWs.send(buffer);
      }
    } catch (error) {
      console.error('WebSocket error:', error.message);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });

  ws.on('close', () => {
    if (execWs) {
      execWs.close();
    }
  });

  ws.on('error', (error) => {
    console.error('Client WebSocket error:', error.message);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`OpenShift Terminal Backend running on port ${PORT}`);
});
