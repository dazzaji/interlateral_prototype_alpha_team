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
//   --token   Bridge token (or use BRIDGE_TOKEN env)
//   --sender  Sender id label for identity stamp
//   --no-stamp Disable identity stamp prefix
//
// Precedence: --host overrides --peer when both are provided.
// Resolution order for --peer: try .local hostname (2-3s timeout), then fallback_ip.

const http = require('http');
const path = require('path');
const fs = require('fs');
const dns = require('dns').promises;
const os = require('os');

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
const tokenArg = getArg('--token');
const senderArg = getArg('--sender');
const noStamp = args.includes('--no-stamp');
const bridgeToken = tokenArg || process.env.BRIDGE_TOKEN || '';
const DNS_TIMEOUT_MS = parseInt(process.env.BRIDGE_DNS_TIMEOUT_MS || '2500', 10);
const TEAM_ID = process.env.INTERLATERAL_TEAM_ID || process.env.TEAM_ID || 'alpha';
const SESSION_ID = process.env.INTERLATERAL_SESSION_ID || process.env.OTEL_SESSION_ID || `session_${Date.now()}`;
const SENDER_ID = senderArg || process.env.INTERLATERAL_SENDER || 'relay';

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
  console.error('  --token   Optional auth token (or BRIDGE_TOKEN env)');
  console.error('  --sender  Optional sender label for identity stamp');
  console.error('  --no-stamp Disable identity stamp prefix');
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

  if (!peers || typeof peers !== 'object' || !peers.peers || typeof peers.peers !== 'object') {
    console.error('ERROR: peers.json is malformed (missing object key: peers)');
    process.exit(1);
  }

  if (!peers.peers[peerName]) {
    console.error(`ERROR: Unknown peer '${peerName}' — check peers.json`);
    console.error(`  Available peers: ${Object.keys(peers.peers || {}).join(', ')}`);
    process.exit(1);
  }

  const peer = peers.peers[peerName];
  if (!peer || typeof peer !== 'object') {
    console.error(`ERROR: Peer '${peerName}' config is malformed (expected object)`);
    process.exit(1);
  }
  if (!peer.host || typeof peer.host !== 'string') {
    console.error(`ERROR: Peer '${peerName}' is missing valid string field 'host'`);
    process.exit(1);
  }
  if (peer.port !== undefined && !(Number.isInteger(peer.port) || /^\d+$/.test(String(peer.port)))) {
    console.error(`ERROR: Peer '${peerName}' has invalid 'port' (must be integer)`);
    process.exit(1);
  }
  if (peer.fallback_ip !== undefined && peer.fallback_ip !== null && typeof peer.fallback_ip !== 'string') {
    console.error(`ERROR: Peer '${peerName}' has invalid 'fallback_ip' (must be string)`);
    process.exit(1);
  }

  return {
    host: peer.host,
    port: peer.port || 3099,
    fallback_ip: peer.fallback_ip || null
  };
}

/**
 * Resolve a hostname to IP via DNS with timeout.
 * Returns resolved IP string, or null on timeout/failure.
 */
async function resolveHostname(hostname, timeoutMs) {
  try {
    const lookup = dns.lookup(hostname, { family: 0, all: false });
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('dns lookup timeout')), timeoutMs);
    });
    const result = await Promise.race([lookup, timeout]);
    return result && result.address ? result.address : null;
  } catch {
    return null;
  }
}

function sendWithOptionalToken(host, port, resolvedFrom) {
  const identityStamp = `[ID team=${TEAM_ID} sender=${SENDER_ID} host=${os.hostname()} sid=${SESSION_ID}]`;
  const stampedMessage = noStamp || msg.startsWith('[ID ') ? msg : `${identityStamp} ${msg}`;
  const data = JSON.stringify({ target, message: stampedMessage });
  if (resolvedFrom) {
    console.log(`[bridge-send] Resolved ${resolvedFrom} → ${host}:${port}`);
    console.log(`[bridge-send] Sender identity: team=${TEAM_ID} sender=${SENDER_ID} sid=${SESSION_ID}`);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  };
  if (bridgeToken) {
    headers['x-bridge-token'] = bridgeToken;
  }

  const req = http.request({
    hostname: host,
    port: parseInt(port, 10),
    path: '/inject',
    method: 'POST',
    headers,
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

async function main() {
  // --- Main logic ---

  // Precedence: --host overrides --peer
  if (hostArg) {
    const port = portArg || '3099';
    if (peerArg) {
      console.log(`[bridge-send] --host provided, ignoring --peer '${peerArg}'`);
    }
    sendWithOptionalToken(hostArg, port, null);
    return;
  }

  // --peer mode: resolve via peers.json
  const peer = resolvePeer(peerArg);
  const port = portArg || String(peer.port);

  // Try .local hostname first using DNS lookup with bounded timeout
  console.log(`[bridge-send] Trying ${peer.host}...`);
  const resolvedIp = await resolveHostname(peer.host, DNS_TIMEOUT_MS);
  if (resolvedIp) {
    sendWithOptionalToken(resolvedIp, port, `${peerArg} → ${peer.host} (${resolvedIp})`);
  } else if (peer.fallback_ip) {
    console.log(`[bridge-send] mDNS resolution failed for ${peer.host}, using fallback_ip: ${peer.fallback_ip}`);
    sendWithOptionalToken(peer.fallback_ip, port, `${peerArg} → fallback ${peer.fallback_ip}`);
  } else {
    console.error(`ERROR: Cannot resolve ${peer.host} and no fallback_ip configured for peer '${peerArg}'.`);
    console.error('  Options:');
    console.error(`  1. Add "fallback_ip" to peers.json for peer '${peerArg}'`);
    console.error('  2. Use --host <ip> for direct connection');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`ERROR: ${e.message}`);
  process.exit(1);
});
