#!/usr/bin/env node
// Cross-machine injection bridge
// Run on each machine: node bridge.js
// Exposes local agent injection over HTTP
//
// Safety: Uses execFileSync with args array (NOT execSync with string interpolation)
//         per Codex + Gemini review feedback.
// Concurrency: Simple mutex lock prevents overlapping tmux send-keys interleaving.

const express = require('express');
const { execFileSync } = require('child_process');
const path = require('path');
const os = require('os');

const app = express();
app.use(express.json({ limit: '10kb' }));

const PORT = process.env.BRIDGE_PORT || 3099;
const DNA_DIR = path.join(__dirname, '..', 'interlateral_dna');
const VALID_TARGETS = ['cc', 'codex', 'gemini', 'ag'];

// --- Concurrency lock (prevents overlapping tmux send-keys) ---
let locked = false;
const queue = [];

function acquireLock() {
  return new Promise((resolve) => {
    if (!locked) {
      locked = true;
      resolve();
    } else {
      queue.push(resolve);
    }
  });
}

function releaseLock() {
  if (queue.length > 0) {
    const next = queue.shift();
    next();
  } else {
    locked = false;
  }
}

// --- Health check ---
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    hostname: os.hostname(),
    time: new Date().toISOString(),
    port: PORT,
    queue_depth: queue.length
  });
});

// --- Agent status ---
app.get('/status', async (req, res) => {
  const status = {};
  for (const agent of VALID_TARGETS) {
    try {
      const script = path.join(DNA_DIR, agent + '.js');
      const out = execFileSync('node', [script, 'status'], {
        timeout: 5000,
        encoding: 'utf8'
      });
      status[agent] = { alive: true, output: out.trim() };
    } catch {
      status[agent] = { alive: false };
    }
  }
  res.json(status);
});

// --- Inject message to local agent ---
app.post('/inject', async (req, res) => {
  const { target, message } = req.body;
  if (!VALID_TARGETS.includes(target)) {
    return res.status(400).json({ error: `Invalid target. Valid: ${VALID_TARGETS.join(', ')}` });
  }
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'No message or message not a string' });
  }
  if (message.length > 5000) {
    return res.status(400).json({ error: 'Message too long (max 5000 chars)' });
  }

  // Acquire lock to prevent overlapping tmux send-keys
  await acquireLock();
  try {
    const script = path.join(DNA_DIR, target + '.js');
    // execFileSync with args array - NO shell interpolation (safe from injection)
    execFileSync('node', [script, 'send', message], {
      timeout: 15000,
      encoding: 'utf8'
    });
    res.json({ ok: true, target, delivered: true });
  } catch (e) {
    res.status(500).json({ ok: false, target, error: e.message });
  } finally {
    releaseLock();
  }
});

// --- Read agent terminal output ---
app.get('/read/:agent', (req, res) => {
  const agent = req.params.agent;
  if (!VALID_TARGETS.includes(agent)) {
    return res.status(400).json({ error: `Invalid agent. Valid: ${VALID_TARGETS.join(', ')}` });
  }
  try {
    const script = path.join(DNA_DIR, agent + '.js');
    const out = execFileSync('node', [script, 'read'], {
      timeout: 5000,
      encoding: 'utf8'
    });
    res.json({ agent, output: out });
  } catch (e) {
    res.status(500).json({ agent, error: e.message });
  }
});

// --- Start ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Bridge] Listening on 0.0.0.0:${PORT}`);
  console.log(`[Bridge] Hostname: ${os.hostname()}`);
  console.log(`[Bridge] DNA dir: ${DNA_DIR}`);
  console.log(`[Bridge] Valid targets: ${VALID_TARGETS.join(', ')}`);
  console.log(`[Bridge] Test: curl http://localhost:${PORT}/health`);
  console.log(`[Bridge] Inject: curl -X POST http://localhost:${PORT}/inject -H 'Content-Type: application/json' -d '{"target":"cc","message":"hello"}'`);
});
