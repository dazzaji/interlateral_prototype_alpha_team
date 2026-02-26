#!/usr/bin/env node
/**
 * strict-relay-runner.js
 *
 * Enforced dialogue runner with:
 * - ACK SLA (default 15s)
 * - automatic resend (default 2 retries)
 * - STALL escalation on failure
 * - structured reply requirements (no placeholder "...")
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

function getArg(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

const host = getArg('--host', '127.0.0.1');
const port = parseInt(getArg('--port', '3099'), 10);
const target = getArg('--target', 'codex');
const token = getArg('--token', process.env.BRIDGE_TOKEN || '');
const commsPath = getArg(
  '--comms',
  path.join(__dirname, '..', 'interlateral_dna', 'comms.md')
);
const sender = getArg('--sender', process.env.INTERLATERAL_SENDER || 'CX_StationChief');
const team = getArg('--team', process.env.INTERLATERAL_TEAM_ID || 'codex-desktop-thread-a');
const sid = getArg('--sid', `strict_${Date.now()}`);
const ackTimeoutSec = parseInt(getArg('--ack-timeout-sec', '15'), 10);
const retries = parseInt(getArg('--retries', '2'), 10);
const pollMs = parseInt(getArg('--poll-ms', '1000'), 10);
const agent = getArg('--agent', 'CX_StationAgent_01');
const dryRun = hasFlag('--dry-run');

const roundsArg = getArg('--rounds');
const mode = getArg('--mode', roundsArg ? 'rounds' : 'heartbeat');

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readComms() {
  try {
    return fs.readFileSync(commsPath, 'utf8');
  } catch {
    return '';
  }
}

function stamp(msg) {
  if (msg.startsWith('[ID ')) return msg;
  return `[ID team=${team} sender=${sender} host=${os.hostname()} sid=${sid}] ${msg}`;
}

function postInject(message) {
  if (dryRun) {
    console.log(`[dry-run] would send: ${message}`);
    return Promise.resolve();
  }

  const body = JSON.stringify({ target, message: stamp(message) });
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  };
  if (token) headers['x-bridge-token'] = token;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: host,
        port,
        path: '/inject',
        method: 'POST',
        headers,
        timeout: 15000,
      },
      (res) => {
        let out = '';
        res.on('data', (d) => {
          out += d;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`inject failed: status=${res.statusCode} body=${out}`));
            return;
          }
          resolve();
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('inject timeout'));
    });
    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

function hasMatchSince(regex, baselineLength) {
  const text = readComms();
  if (text.length <= baselineLength) return false;
  const delta = text.slice(baselineLength);
  return regex.test(delta);
}

async function waitFor(regex, baselineLength, timeoutSec) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    if (hasMatchSince(regex, baselineLength)) return true;
    await sleep(pollMs);
  }
  return false;
}

async function sendWithAck(message, ackRegex, label) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const baselineLength = readComms().length;
    const retryNote = attempt === 0 ? '' : ` [RESEND ${attempt}/${retries}]`;
    await postInject(`${message}${retryNote}`);
    console.log(`${nowIso()} SENT ${label}${retryNote}`);

    const ok = await waitFor(ackRegex, baselineLength, ackTimeoutSec);
    if (ok) {
      console.log(`${nowIso()} ACKED ${label}`);
      return true;
    }
  }
  return false;
}

async function escalate(label, detail) {
  const msg = `[STALL][${label}] ${detail} at ${nowIso()}`;
  await postInject(msg);
  console.error(msg);
}

function structuredReplyRegex(roundNum) {
  return new RegExp(`\\[${agent}\\]\\[ROUND_${roundNum}_REPLY\\](?!\\s*\\.\\.\\.)`, 'i');
}

async function runHeartbeat() {
  const msgId = `hb_${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}_strict`;
  const ackRegex = new RegExp(`\\[${agent}\\]\\[ACK\\]\\[msg_id=${msgId}\\]`, 'i');
  const message = `[${sender}][HEARTBEAT][msg_id=${msgId}] strict runner ACK required <=${ackTimeoutSec}s`;
  const ok = await sendWithAck(message, ackRegex, `HEARTBEAT:${msgId}`);
  if (!ok) {
    await escalate('HEARTBEAT_TIMEOUT', `msg_id=${msgId}`);
    process.exit(2);
  }
  console.log(`HEARTBEAT_OK msg_id=${msgId}`);
}

async function runRounds() {
  const rounds = String(roundsArg || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  if (rounds.length === 0) {
    console.error('No rounds provided. Use --rounds "prompt1|prompt2|..."');
    process.exit(1);
  }

  for (let idx = 0; idx < rounds.length; idx += 1) {
    const roundNum = idx + 1;
    const prompt = rounds[idx];
    const msg = `[ID team=${team} sender=${sender} sid=${sid}] ROUND_${roundNum}: ${prompt} Reply as [${agent}][ROUND_${roundNum}_REPLY] with full content (no placeholders).`;
    const ok = await sendWithAck(msg, structuredReplyRegex(roundNum), `ROUND_${roundNum}`);
    if (!ok) {
      await escalate(`ROUND_${roundNum}_TIMEOUT`, `no structured reply within SLA`);
      process.exit(2);
    }
  }
}

async function main() {
  if (mode === 'heartbeat') {
    await runHeartbeat();
    return;
  }
  if (mode === 'rounds') {
    await runRounds();
    return;
  }
  console.error(`Invalid mode: ${mode}. Use --mode heartbeat|rounds`);
  process.exit(1);
}

main().catch(async (err) => {
  console.error(`strict runner failed: ${err.message}`);
  process.exit(1);
});
