#!/usr/bin/env node
// CLI helper to send messages to a remote bridge
//
// Usage:
//   node bridge-send.js --host <IP> --target <agent> --msg "message"
//   node bridge-send.js --peer <name> --target <agent> --msg "message"
//
// Options:
//   --host    Remote machine IP or hostname (manual override)
//   --peer    Peer name from peers.json (e.g., "alpha", "beta")
//   --target  Agent: cc, codex, gemini, ag
//   --msg     Message to send
//   --port    Bridge port (default: 3099)
//
// Precedence: --host overrides --peer when both are provided.
// Resolution order for --peer: try .local hostname (2-3s timeout), then fallback_ip.

const http = require('http');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

const hostArg = getArg('--host');
const peerArg = getArg('--peer');
const target = getArg('--target');
const msg = getArg('--msg');
const portArg = getArg('--port');

// Validate: need either --host or --peer, plus --target and --msg
if ((!hostArg && !peerArg) || !target || !msg) {
  console.error('Usage: node bridge-send.js --peer <name> --target <agent> --msg "message" [--port <port>]');
  console.error('       node bridge-send.js --host <IP> --target <agent> --msg "message" [--port <port>]');
  console.error('');
  console.error('  --peer    Peer name from peers.json (e.g., "beta")');
  console.error('  --host    Remote machine IP or hostname (overrides --peer)');
  console.error('  --target  Agent: cc, codex, gemini, ag');
  console.error('  --msg     Message to send');
  console.error('  --port    Bridge port (default: from peers.json or 3099)');
  process.exit(1);
}

/**
 * Resolve peer to host and port using peers.json.
 * Returns { host, port } or exits with error.
 */
function resolvePeer(peerName) {
  const peersPath = path.join(__dirname, 'peers.json');

  if (!fs.existsSync(peersPath)) {
    console.error(`ERROR: peers.json not found at ${peersPath}`);
    console.error('  Run: cd interlateral_comms && ./setup-peers.sh');
    console.error('  Or use --host <ip> instead of --peer.');
    process.exit(1);
  }

  let peers;
  try {
    peers = JSON.parse(fs.readFileSync(peersPath, 'utf8'));
  } catch (e) {
    console.error(`ERROR: Failed to parse peers.json: ${e.message}`);
    process.exit(1);
  }

  if (!peers.peers || !peers.peers[peerName]) {
    console.error(`ERROR: Unknown peer '${peerName}' — check peers.json`);
    console.error(`  Available peers: ${Object.keys(peers.peers || {}).join(', ')}`);
    process.exit(1);
  }

  const peer = peers.peers[peerName];
  return {
    host: peer.host,
    port: peer.port || 3099,
    fallback_ip: peer.fallback_ip || null
  };
}

/**
 * Test if a hostname resolves by attempting a DNS lookup via ping with timeout.
 * Returns true if resolvable, false otherwise.
 */
function testResolves(hostname, timeoutSec) {
  try {
    execSync(`ping -c 1 -W ${timeoutSec} "${hostname}" > /dev/null 2>&1`, { timeout: (timeoutSec + 1) * 1000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Send the message to the bridge at the given host:port.
 */
function sendMessage(host, port, resolvedFrom) {
  if (resolvedFrom) {
    console.log(`[bridge-send] Resolved ${resolvedFrom} → ${host}:${port}`);
  }

  const data = JSON.stringify({ target, message: msg });

  const req = http.request({
    hostname: host,
    port: parseInt(port, 10),
    path: '/inject',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    },
    timeout: 15000
  }, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (parsed.ok) {
          console.log(`Delivered to ${target} on ${host}:${port}`);
        } else {
          console.error(`Failed: ${parsed.error || body}`);
        }
      } catch {
        console.log(body);
      }
      process.exit(res.statusCode === 200 ? 0 : 1);
    });
  });

  req.on('error', (e) => {
    console.error(`Connection failed: ${e.message}`);
    console.error(`Is the bridge running on ${host}:${port}?`);
    process.exit(1);
  });

  req.on('timeout', () => {
    console.error(`Timeout connecting to ${host}:${port}`);
    req.destroy();
    process.exit(1);
  });

  req.write(data);
  req.end();
}

// --- Main logic ---

// Precedence: --host overrides --peer
if (hostArg) {
  const port = portArg || '3099';
  if (peerArg) {
    console.log(`[bridge-send] --host provided, ignoring --peer '${peerArg}'`);
  }
  sendMessage(hostArg, port, null);
} else {
  // --peer mode: resolve via peers.json
  const peer = resolvePeer(peerArg);
  const port = portArg || String(peer.port);

  // Try .local hostname first (2s timeout for mDNS resolution)
  console.log(`[bridge-send] Trying ${peer.host}...`);
  if (testResolves(peer.host, 2)) {
    sendMessage(peer.host, port, `${peerArg} → ${peer.host}`);
  } else if (peer.fallback_ip) {
    console.log(`[bridge-send] mDNS resolution failed for ${peer.host}, using fallback_ip: ${peer.fallback_ip}`);
    sendMessage(peer.fallback_ip, port, `${peerArg} → fallback ${peer.fallback_ip}`);
  } else {
    console.error(`ERROR: Cannot resolve ${peer.host} and no fallback_ip configured for peer '${peerArg}'.`);
    console.error('  Options:');
    console.error(`  1. Add "fallback_ip" to peers.json for peer '${peerArg}'`);
    console.error('  2. Use --host <ip> for direct connection');
    process.exit(1);
  }
}
