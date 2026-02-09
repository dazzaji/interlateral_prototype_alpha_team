#!/usr/bin/env node
/**
 * Courier - Sidecar process that enables Codex to communicate with CC/AG
 *
 * Codex writes JSON messages to codex_outbox/*.msg files
 * Courier watches the directory and delivers to the target agent
 *
 * Usage: node courier.js
 * Test:  echo '{"target":"cc","msg":"TEST from Codex"}' > codex_outbox/test.msg
 */

const fs = require('fs');
const path = require('path');
const { execSync, execFile } = require('child_process');

// tmux socket path - use explicit socket to ensure Codex can access without permission prompts
const TMUX_SOCKET = process.env.TMUX_SOCKET || '/tmp/interlateral-tmux.sock';
const TMUX = `tmux -S ${TMUX_SOCKET}`;

// CC session name - must match tmux-config.sh and cc.js
const CC_TMUX_SESSION = process.env.CC_TMUX_SESSION || 'interlateral-claude';

const OUTBOX_DIR = path.join(__dirname, 'codex_outbox');

// Ensure outbox directory exists
if (!fs.existsSync(OUTBOX_DIR)) {
  fs.mkdirSync(OUTBOX_DIR);
  console.log('[COURIER] Created outbox directory:', OUTBOX_DIR);
}

// Process a message file
function processMessage(filename) {
  if (!filename || !filename.endsWith('.msg')) return;

  const filepath = path.join(OUTBOX_DIR, filename);

  // Small delay to ensure file is fully written
  setTimeout(() => {
    try {
      if (!fs.existsSync(filepath)) return; // Already processed

      const content = fs.readFileSync(filepath, 'utf-8');
      const req = JSON.parse(content);

      if (!req.target || !req.msg) {
        console.error('[COURIER] Invalid message format:', content);
        fs.unlinkSync(filepath);
        return;
      }

      const timestamp = new Date().toISOString();
      console.log(`[COURIER] ${timestamp} Delivering to ${req.target}: ${req.msg.slice(0, 60)}...`);

      if (req.target === 'cc') {
        // Use load-buffer for safe injection (handles special chars)
        const escaped = req.msg.replace(/'/g, "'\\''");
        execSync(`echo '${escaped}' | ${TMUX} load-buffer -`);
        execSync(`${TMUX} paste-buffer -t ${CC_TMUX_SESSION}`);
        execSync(`sleep 1`); // CONFORMANCE 8.1: 1-second delay for tmux injection
        execSync(`${TMUX} send-keys -t ${CC_TMUX_SESSION} Enter`);
        console.log('[COURIER] Delivered to CC');
        // Delete after successful sync delivery
        fs.unlinkSync(filepath);
      } else if (req.target === 'ag') {
        // Use execFile to avoid shell injection (passes args directly, no shell)
        execFile('node', [path.join(__dirname, 'ag.js'), 'send', req.msg], (err) => {
          if (err) {
            console.error('[COURIER] AG delivery error:', err.message);
            // Keep file for retry/debugging on failure
          } else {
            console.log('[COURIER] Delivered to AG');
            // Delete only after successful delivery
            try { fs.unlinkSync(filepath); } catch {}
          }
        });
      } else {
        console.error('[COURIER] Unknown target:', req.target);
        // Delete invalid target messages
        fs.unlinkSync(filepath);
      }

    } catch (e) {
      console.error('[COURIER] Error processing', filename, ':', e.message);
      // Try to clean up bad file
      try { fs.unlinkSync(filepath); } catch {}
    }
  }, 50); // 50ms delay for file write completion
}

// Watch for new messages
console.log('[COURIER] Watching', OUTBOX_DIR);
console.log('[COURIER] Test with: echo \'{"target":"cc","msg":"Hello from Codex"}\' > codex_outbox/test.msg');

fs.watch(OUTBOX_DIR, (eventType, filename) => {
  if (eventType === 'rename' || eventType === 'change') {
    processMessage(filename);
  }
});

// Process any existing messages on startup
fs.readdirSync(OUTBOX_DIR).forEach(processMessage);

// Keep process running
process.on('SIGINT', () => {
  console.log('\n[COURIER] Shutting down');
  process.exit(0);
});
