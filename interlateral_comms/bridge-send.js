#!/usr/bin/env node
// CLI helper to send messages to a remote bridge
// Usage: node bridge-send.js --host <IP> --target <agent> --msg "message"
// Optional: --port <port> (default 3099)

const http = require('http');

const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

const host = getArg('--host');
const target = getArg('--target');
const msg = getArg('--msg');
const port = getArg('--port') || '3099';

if (!host || !target || !msg) {
  console.error('Usage: node bridge-send.js --host <IP> --target <agent> --msg "message" [--port <port>]');
  console.error('  --host    Remote machine IP or hostname');
  console.error('  --target  Agent: cc, codex, gemini, ag');
  console.error('  --msg     Message to send');
  console.error('  --port    Bridge port (default: 3099)');
  process.exit(1);
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
