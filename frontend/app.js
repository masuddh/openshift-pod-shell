// Auto-detect API URL based on environment
const isLocal = window.location.hostname === 'localhost';
const API_URL = isLocal 
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.host}/pod-shell/api`;
const WS_URL = isLocal
  ? 'ws://localhost:3001'
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/pod-shell/api`;

let term = null;
let socket = null;
let sessionId = localStorage.getItem('sessionId');
let currentNamespace = '';
let currentPod = '';
let currentContainer = '';
let podsData = [];

// Check authentication
if (!sessionId) {
  window.location.href = 'login.html';
}

// Initialize terminal
function initTerminal() {
  const { Terminal } = window;
  const { FitAddon } = window.FitAddon || { FitAddon: null };

  term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4'
    }
  });

  const fitAddon = FitAddon ? new FitAddon() : null;
  if (fitAddon) {
    term.loadAddon(fitAddon);
  }

  term.open(document.getElementById('terminal'));
  
  if (fitAddon) {
    fitAddon.fit();
    window.addEventListener('resize', () => fitAddon.fit());
  }

  term.writeln('Welcome to OpenShift Pod Terminal');
  term.writeln('Select a namespace and pod to connect.');
  term.writeln('');
}

// Update status
function setStatus(message, type = 'info') {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status status-${type}`;
}

// Load namespaces
async function loadNamespaces() {
  try {
    const response = await fetch(`${API_URL}/api/namespaces`, {
      headers: { 'X-Session-Id': sessionId }
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('sessionId');
        window.location.href = 'login.html';
        return;
      }
      throw new Error('Failed to load namespaces');
    }

    const namespaces = await response.json();
    const select = document.getElementById('namespace');
    
    select.innerHTML = '<option value="">-- Select Namespace --</option>';
    namespaces.forEach(ns => {
      const option = document.createElement('option');
      option.value = ns;
      option.textContent = ns;
      select.appendChild(option);
    });

    setStatus('Namespaces loaded', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

// Load pods
async function loadPods(namespace) {
  try {
    const response = await fetch(`${API_URL}/api/namespaces/${namespace}/pods`, {
      headers: { 'X-Session-Id': sessionId }
    });

    if (!response.ok) {
      throw new Error('Failed to load pods');
    }

    podsData = await response.json();
    const podSelect = document.getElementById('pod');
    
    podSelect.innerHTML = '<option value="">-- Select Pod --</option>';
    podsData.forEach(pod => {
      const option = document.createElement('option');
      option.value = pod.name;
      option.textContent = pod.name;
      podSelect.appendChild(option);
    });

    podSelect.disabled = false;
    document.getElementById('container').disabled = true;
    document.getElementById('container').innerHTML = '<option value="">-- Select Container --</option>';
    document.getElementById('connectBtn').disabled = true;
    
    setStatus(`Found ${podsData.length} running pod(s)`, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

// Load containers
function loadContainers(podName) {
  const pod = podsData.find(p => p.name === podName);
  if (!pod) return;

  const containerSelect = document.getElementById('container');
  containerSelect.innerHTML = '<option value="">-- Select Container --</option>';
  
  pod.containers.forEach(container => {
    const option = document.createElement('option');
    option.value = container;
    option.textContent = container;
    containerSelect.appendChild(option);
  });

  containerSelect.disabled = false;
  
  // Auto-select if only one container
  if (pod.containers.length === 1) {
    containerSelect.value = pod.containers[0];
    document.getElementById('connectBtn').disabled = false;
  }
}

// Connect to pod
function connectToPod() {
  if (socket) {
    socket.close();
  }

  term.clear();
  term.writeln('Connecting to pod...');
  setStatus('Connecting...', 'info');

  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    socket.send(JSON.stringify({
      type: 'init',
      sessionId,
      namespace: currentNamespace,
      pod: currentPod,
      container: currentContainer
    }));
  };

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);

    switch (message.type) {
      case 'ready':
        term.clear();
        setStatus(`Connected (${message.shell})`, 'success');
        document.getElementById('connectBtn').disabled = true;
        document.getElementById('disconnectBtn').disabled = false;
        
        // Send input to pod
        term.onData((data) => {
          socket.send(JSON.stringify({ type: 'input', data }));
        });

        // Send resize events
        term.onResize(({ cols, rows }) => {
          socket.send(JSON.stringify({ type: 'resize', cols, rows }));
        });
        break;

      case 'output':
        term.write(message.data);
        break;

      case 'error':
        term.writeln(`\r\n\x1b[31mError: ${message.message}\x1b[0m`);
        setStatus('Error: ' + message.message, 'error');
        break;

      case 'closed':
        term.writeln('\r\n\x1b[33mConnection closed\x1b[0m');
        setStatus('Disconnected', 'warning');
        document.getElementById('connectBtn').disabled = false;
        document.getElementById('disconnectBtn').disabled = true;
        break;
    }
  };

  socket.onerror = (error) => {
    term.writeln('\r\n\x1b[31mWebSocket error\x1b[0m');
    setStatus('Connection error', 'error');
  };

  socket.onclose = () => {
    setStatus('Disconnected', 'warning');
    document.getElementById('connectBtn').disabled = false;
    document.getElementById('disconnectBtn').disabled = true;
  };
}

// Disconnect
function disconnect() {
  if (socket) {
    socket.close();
    socket = null;
  }
  term.clear();
  term.writeln('Disconnected from pod');
  setStatus('Disconnected', 'info');
  document.getElementById('connectBtn').disabled = false;
  document.getElementById('disconnectBtn').disabled = true;
}

// Event listeners
document.getElementById('namespace').addEventListener('change', (e) => {
  currentNamespace = e.target.value;
  if (currentNamespace) {
    loadPods(currentNamespace);
  }
  document.getElementById('pod').disabled = !currentNamespace;
  document.getElementById('pod').value = '';
  document.getElementById('container').disabled = true;
  document.getElementById('container').value = '';
  document.getElementById('connectBtn').disabled = true;
});

document.getElementById('pod').addEventListener('change', (e) => {
  currentPod = e.target.value;
  if (currentPod) {
    loadContainers(currentPod);
  }
  document.getElementById('container').value = '';
  document.getElementById('connectBtn').disabled = true;
});

document.getElementById('container').addEventListener('change', (e) => {
  currentContainer = e.target.value;
  document.getElementById('connectBtn').disabled = !currentContainer;
});

document.getElementById('connectBtn').addEventListener('click', connectToPod);
document.getElementById('disconnectBtn').addEventListener('click', disconnect);

document.getElementById('logoutBtn').addEventListener('click', () => {
  if (socket) socket.close();
  localStorage.removeItem('sessionId');
  localStorage.removeItem('openshiftUrl');
  window.location.href = 'login.html';
});

// Initialize
initTerminal();
loadNamespaces();
