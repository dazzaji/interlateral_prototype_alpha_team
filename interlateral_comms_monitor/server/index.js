import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { startWatcher, getInitialContent, getStreamStatus, getWatchedFiles } from './watcher.js';
import { addEvent, getRecentEvents, normalizeEvent } from './streams.js';
import { inject, getCCInjectionStatus, getCodexInjectionStatus, getInjectionStatus } from './inject.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get recent events (REST fallback)
app.get('/api/events', (req, res) => {
  const count = parseInt(req.query.count) || 100;
  res.json(getRecentEvents(count));
});

// Get stream status (which streams are active)
app.get('/api/streams/status', (req, res) => {
  res.json({
    status: getStreamStatus(),
    files: getWatchedFiles(),
  });
});

// Get history (older events with pagination)
app.get('/api/events/history', (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const limit = parseInt(req.query.limit) || 50;
  const events = getRecentEvents(1000); // Get more events for history
  const slice = events.slice(Math.max(0, events.length - offset - limit), events.length - offset);
  res.json({
    events: slice,
    hasMore: events.length > offset + limit,
    total: events.length,
  });
});

// Get CC injection status (tmux, applescript, comms.md availability)
app.get('/api/inject/status', (req, res) => {
  res.json(getCCInjectionStatus());
});

// Inject command to CC, AG, or both
app.post('/api/inject', async (req, res) => {
  const { message, target = 'cc', direct = false } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  if (!['cc', 'ag', 'codex', 'both', 'all'].includes(target.toLowerCase())) {
    return res.status(400).json({ success: false, error: 'Target must be cc, ag, codex, both, or all' });
  }

  console.log(`[Inject] Received injection request: target=${target}, direct=${direct}, message="${message.slice(0, 50)}..."`);

  try {
    const result = await inject(message, target, direct);
    res.json(result);
  } catch (error) {
    console.error('[Inject] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Broadcast to all connected clients
function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// WebSocket connection handling
wss.on('connection', async (ws) => {
  console.log('[WS] Client connected');

  // Send initial content to new client
  try {
    const initialEvents = await getInitialContent();
    ws.send(JSON.stringify({
      type: 'initial',
      events: initialEvents,
    }));
  } catch (error) {
    console.error('[WS] Error sending initial content:', error);
  }

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('[WS] Error:', error);
  });
});

// Start file watcher (async)
async function initializeWatcher() {
  try {
    await startWatcher((event) => {
      const normalized = normalizeEvent(event);
      addEvent(normalized);

      // Broadcast new event to all clients
      broadcast({
        type: 'event',
        event: normalized,
      });
    });
    console.log('[Server] File watcher initialized successfully');
  } catch (error) {
    console.error('[Server] Failed to initialize file watcher:', error);
  }
}

const PORT = process.env.PORT || 3001;

server.listen(PORT, async () => {
  console.log(`[Server] Comms Monitor backend running on http://localhost:${PORT}`);
  console.log(`[WS] WebSocket server ready on ws://localhost:${PORT}`);

  // Initialize watcher after server starts
  await initializeWatcher();
});

export { app, server, wss, broadcast };
