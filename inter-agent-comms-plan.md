# Inter-Agent Cross-Machine Communication Plan 

**Date:** 2026-02-10 (updated same day with test results)
**Author:** CC (Claude Code) on Mac.lan
**Status:** PROPOSAL — Option 1 selected, ready to build

---

## Problem

The interlateral quad-agent mesh works great on ONE machine. Each agent injects into the others' terminals via local tmux sessions (cc.js, codex.js, gemini.js) or CDP (ag.js).

But we now have the SAME repo cloned on TWO laptops on the same network. Agents on Machine A can't talk to agents on Machine B. We need one extra layer: **cross-machine injection over HTTP**.

---

## Prior Art: Why SSH Failed (Don't Repeat This)

The prior agent team on `interlateral_platform_alpha` spent significant effort trying to use **Tailscale SSH** as the cross-machine transport. It failed. See `/Users/dazzagreenwood/Documents/GitHub/interlateral_platform_alpha/urgent.md` for the full post-mortem.

**What they found:**
- `tailscale ping` works fine (network layer is healthy)
- TCP port 22 is reachable on the remote machine
- But `tailscale ssh` **hangs indefinitely** during the SSH handshake
- Remote machine advertises `SSH_HostKeys: null` — Tailscale SSH isn't fully configured
- tailscale client/daemon version mismatch warning present
- Recovery required `sudo tailscale set --ssh=true`, `sudo tailscale up --reset --ssh`, enabling macOS Remote Login, kicking `sshd` — all on the remote machine, which they couldn't reach

**Our own testing (2026-02-10) confirmed the same:**

| Test | `ais-macbook-pro-1` (100.117.204.104) | `ais-macbook-pro-2` (100.118.210.87) |
|------|---------------------------------------|--------------------------------------|
| `tailscale ping` | 5ms — works | 6ms — works |
| Port 22 open | NO — connection refused | YES — open |
| `tailscale ssh` | Connection refused | Hangs forever (banner exchange stall) |
| Plain `ssh` | Connection refused | Timeout during banner exchange |

**Conclusion:** Tailscale network works. SSH does not. The problem is SSH configuration on the remote Macs (host key advertisement, `sshd` readiness), and fixing it requires hands-on access to each machine. This is exactly the kind of per-machine config rabbit hole we need to avoid.

**This is why we need HTTP, not SSH.** A Node.js server listening on a port works the moment you run it — no system-level config, no host keys, no daemon version matching.

---

## Network Discovery (2026-02-10, tested)

| Machine | Role | WiFi IP | Tailscale IP | Hostname | Ping | Port 22 | SSH |
|---------|------|---------|--------------|----------|------|---------|-----|
| MacBook Air (this) | Alpha Team | 192.168.8.124 | 100.85.111.17 | Mac.lan | — | — | — |
| MacBook Pro 1 | Beta Team (candidate) | — | 100.117.204.104 | ais-macbook-pro-1 | 5ms | CLOSED | REFUSED |
| MacBook Pro 2 | Beta Team (candidate) | 192.168.8.216 | 100.118.210.87 | ais-macbook-pro.lan | 6ms | OPEN | HANGS |

Both WiFi and Tailscale are available. Tailscale is preferred (stable IPs, encrypted, works even off shared WiFi). **Network layer is proven working. Only SSH is broken. HTTP will work immediately.**

---

## Options (Ranked by Simplicity)

### Option 1: REST API Bridge Server (RECOMMENDED)

**Complexity:** Dead simple
**Transport:** HTTP POST over WiFi or Tailscale
**Lines of code:** ~60

Each machine runs a tiny Express server (one file: `bridge.js`) that accepts HTTP POST requests and executes the local injection scripts.

**How it works:**

```
Machine A (CC)                         Machine B
─────────────────                      ─────────────────
CC wants to msg CX on B               bridge.js listening on :3099
  │                                      │
  ├─ POST http://100.117.204.104:3099/inject
  │   { "target": "codex", "message": "Hello from A" }
  │                                      │
  │                                      ├─ Runs: node codex.js send "Hello from A"
  │                                      ├─ CX on Machine B receives message
  │                                      │
  │  ◄── 200 { "ok": true }             │
```

**API surface (4 endpoints, that's it):**

```
POST /inject        — Send message to a local agent
  Body: { "target": "cc"|"codex"|"gemini"|"ag", "message": "string" }

GET  /status        — Which agents are alive on this machine
GET  /read/:agent   — Read an agent's recent terminal output
GET  /health        — Is this bridge running
```

**To use from CC (or any agent):**

```bash
# Instead of:  node codex.js send "msg"       (local only)
# Do:          curl -X POST http://REMOTE:3099/inject -H 'Content-Type: application/json' -d '{"target":"codex","message":"msg"}'

# Or wrap it in a helper:
node bridge-send.js --host 100.117.204.104 --target codex --msg "Hello from Machine A"
```

**Pros:**
- Uses existing .js injection scripts (zero changes to local comms)
- Any language can call it (curl, node, python, even browser)
- Tailscale gives you encrypted transport + stable IPs for free
- Works across WiFi, VPN, or internet (if Tailscale Funnel enabled)
- Stateless — no persistent connection needed
- **Proven viable:** Tailscale network tested at 5-6ms latency, HTTP needs zero system config

**Cons:**
- Need to know remote IP (solved by Tailscale hostnames)
- No push notification (poll /status or add webhooks later)

---

### Option 2: REST API + Server-Sent Events (SSE) for Real-Time Push

**Complexity:** Simple (Option 1 + one extra endpoint)
**Transport:** HTTP POST + SSE stream
**Lines of code:** ~100

Same as Option 1, but adds a `GET /events` SSE stream so machines can subscribe to each other's comms in real time without polling.

**Extra endpoint:**

```
GET /events         — SSE stream of all local agent activity
  Returns: event: inject\ndata: {"from":"codex","message":"..."}\n\n
```

**How it works:**

```
Machine A                              Machine B
─────────────────                      ─────────────────
CC subscribes:                         bridge.js on :3099
GET /events (SSE, long-lived)            │
  │                                      │
  │  ◄── event: agent_message            │
  │      data: {"from":"codex",...}       ├─ CX sends outbound message
  │                                      │
  ├─ CC sees it immediately              │
```

**Pros:**
- Everything from Option 1
- Real-time push (no polling)
- SSE is dead simple (just HTTP, no WebSocket upgrade)
- Works through proxies and firewalls

**Cons:**
- Slightly more code
- SSE is one-directional (server→client), but injection is still POST

---

### Option 3: SSH Tunnel + Existing tmux Scripts — NOT VIABLE

**Complexity:** Appears low ("zero new code") but actually high (system-level SSH config per machine)
**Transport:** SSH
**Status:** FAILED in prior team testing AND our own testing (2026-02-10). See "Prior Art" above.

Skip the HTTP server entirely. SSH from Machine A to Machine B and run the injection script remotely.

```bash
# CC on Machine A sends to Codex on Machine B:
ssh dazza@100.117.204.104 "cd /path/to/repo && node interlateral_dna/codex.js send 'Hello from A'"
```

**Pros:**
- Zero new code (if SSH worked)
- SSH is already encrypted and authenticated (if SSH worked)

**Cons (proven, not theoretical):**
- SSH does not work on either target machine right now
- Prior team (`interlateral_platform_alpha`) spent hours debugging this and failed — see `urgent.md`
- Fixing requires `sudo` access and manual config on each remote machine
- Tailscale SSH has host key advertisement bugs on macOS
- Even with macOS Remote Login enabled and port 22 open, the handshake hangs
- "Zero new code" is misleading when the underlying transport is broken
- Need to know the repo path on the remote machine
- Slower (SSH connection overhead per message)
- Agents can't easily discover what's running remotely

---

### Option 4: Tailscale Funnel + Bridge Server — RISKY

**Complexity:** Medium (Option 1 + Tailscale config)
**Transport:** HTTPS via Tailscale Funnel
**Risk:** Given that basic Tailscale SSH doesn't work on these machines, layering more Tailscale features adds risk. Consider only after Option 1 is proven.

Use Tailscale's `serve` or `funnel` to expose the bridge server over HTTPS with a real domain name, no port forwarding needed.

```bash
# On Machine B:
node bridge.js &
tailscale serve --bg 3099

# Now accessible at:
# https://ais-macbook-pro-1.tailXXXXX.ts.net/inject
```

**Pros:**
- HTTPS for free (TLS via Tailscale)
- Accessible from anywhere (not just local WiFi)
- Clean hostnames instead of raw IPs

**Cons:**
- Requires Tailscale Funnel to be enabled on the tailnet
- Adds Tailscale dependency for the comms layer — and Tailscale SSH already proved fragile on these machines
- More config than just running a script
- If Tailscale daemon has version mismatch issues (which it does — see Prior Art), Funnel may also be unreliable

---

### Option 5: Shared Filesystem Watcher (Courier Pattern)

**Complexity:** Low code, high latency
**Transport:** Synced folder (iCloud Drive, Tailscale Drive, Syncthing)

Use a shared folder. Machine A writes a `.msg` file. Machine B's watcher picks it up (like the existing `courier.js` for Codex).

**Pros:**
- Works offline (eventually consistent)
- No server to run

**Cons:**
- Latency (seconds to minutes depending on sync service)
- iCloud Drive sync is unreliable for real-time
- Requires shared folder setup
- Not suitable for interactive agent coordination

---

## Recommendation

**Go with Option 1 (REST API Bridge).** This is now evidence-backed, not just a guess:

- **Network is proven:** Tailscale ping works at 5-6ms to both MacBook Pros. WiFi also works. The transport layer is ready.
- **SSH is proven broken:** Prior team failed (see `urgent.md`). Our own tests failed today. Option 3 is dead.
- **HTTP needs zero system config:** No `sshd`, no host keys, no `sudo`, no Remote Login toggles. Just `node bridge.js` and it listens.
- **Fewest lines of new code:** ~60 lines, uses existing .js injection scripts unchanged.
- **Instant testability:** `curl http://REMOTE:3099/health` — either it works or it doesn't, no ambiguous hangs.

If we need real-time push later, bolt on SSE (Option 2) as a non-breaking addition. Options 3-5 are either broken or add unnecessary complexity.

---

## Build Location

All cross-machine comms code lives in a dedicated folder:

```
interlateral_comms/           ← NEW: cross-machine bridge (build & test here)
├── bridge.js                 ← The HTTP bridge server (~60 lines)
├── bridge-send.js            ← CLI helper for agents to call remote bridges
├── package.json              ← Minimal deps (express only)
├── test/                     ← Integration tests
│   └── smoke-test.sh         ← curl-based smoke test for both machines
└── README.md                 ← Setup & usage for the other team
```

**Why a separate folder?**
- Keeps experimental cross-machine code isolated from proven local injection (`interlateral_dna/`)
- Can be tested independently without touching the working mesh
- When stable, we integrate: `interlateral_dna/` scripts learn to call `bridge-send.js` for remote targets
- The other team clones the same repo, runs `node interlateral_comms/bridge.js`, done

**Integration path (later):**
1. Build & test in `interlateral_comms/`
2. Prove cross-machine injection works both directions
3. Add `--remote` flag to existing .js scripts (e.g., `node codex.js send --remote 100.118.210.87 "msg"`)
4. Update `LIVE_COMMS.md` with cross-machine routes
5. Move bridge startup into `bootstrap-full.sh`

---

## Implementation Sketch (Option 1)

### File: `interlateral_comms/bridge.js`

```javascript
// Cross-machine injection bridge
// Run on each machine: node bridge.js
// Exposes local agent injection over HTTP

const express = require('express');
const { execSync } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.BRIDGE_PORT || 3099;
const DNA_DIR = path.join(__dirname, '..', 'interlateral_dna');
const VALID_TARGETS = ['cc', 'codex', 'gemini', 'ag'];

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, hostname: require('os').hostname(), time: new Date().toISOString() });
});

// Agent status
app.get('/status', (req, res) => {
  const status = {};
  for (const agent of VALID_TARGETS) {
    try {
      const out = execSync(`node ${path.join(DNA_DIR, agent + '.js')} status`, { timeout: 5000 }).toString();
      status[agent] = { alive: true, output: out.trim() };
    } catch {
      status[agent] = { alive: false };
    }
  }
  res.json(status);
});

// Inject message to local agent
app.post('/inject', (req, res) => {
  const { target, message } = req.body;
  if (!VALID_TARGETS.includes(target)) return res.status(400).json({ error: 'Invalid target' });
  if (!message) return res.status(400).json({ error: 'No message' });
  try {
    const script = path.join(DNA_DIR, target + '.js');
    execSync(`node "${script}" send "${message.replace(/"/g, '\\"')}"`, { timeout: 10000 });
    res.json({ ok: true, target, delivered: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Read agent terminal output
app.get('/read/:agent', (req, res) => {
  const agent = req.params.agent;
  if (!VALID_TARGETS.includes(agent)) return res.status(400).json({ error: 'Invalid agent' });
  try {
    const script = path.join(DNA_DIR, agent + '.js');
    const out = execSync(`node "${script}" read`, { timeout: 5000 }).toString();
    res.json({ agent, output: out });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bridge listening on 0.0.0.0:${PORT}`);
  console.log(`Inject: curl -X POST http://localhost:${PORT}/inject -H 'Content-Type: application/json' -d '{"target":"cc","message":"hello"}'`);
});
```

### Helper: `interlateral_comms/bridge-send.js`

```javascript
// Usage: node bridge-send.js --host <IP> --target <agent> --msg "message"
// Wraps the HTTP call so agents can use it like the local .js scripts

const http = require('http');
const args = process.argv.slice(2);
const host = args[args.indexOf('--host') + 1];
const target = args[args.indexOf('--target') + 1];
const msg = args[args.indexOf('--msg') + 1];
const port = args.includes('--port') ? args[args.indexOf('--port') + 1] : '3099';

const data = JSON.stringify({ target, message: msg });
const req = http.request({ hostname: host, port, path: '/inject', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
}, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => { console.log(body); process.exit(res.statusCode === 200 ? 0 : 1); });
});
req.write(data);
req.end();
```

---

## How to Build (Step by Step)

```bash
# 1. Create the folder
mkdir -p interlateral_comms/test

# 2. Initialize package.json
cd interlateral_comms
npm init -y
npm install express

# 3. Create bridge.js and bridge-send.js (see implementation sketch above)
#    CC will do this — the code is in this plan

# 4. Test locally first (both endpoints on same machine)
node bridge.js &
curl http://localhost:3099/health
curl http://localhost:3099/status
curl -X POST http://localhost:3099/inject \
  -H 'Content-Type: application/json' \
  -d '{"target":"cc","message":"[BRIDGE-TEST] Hello from local bridge"}'

# 5. Test cross-machine (from Machine A to Machine B)
#    Machine B must also have the repo cloned and bridge.js running
curl http://100.118.210.87:3099/health

# 6. Create smoke test script
#    See interlateral_comms/test/smoke-test.sh
```

**For the other team (Machine B):**
```bash
# Pull latest, then:
cd interlateral_comms
npm install
node bridge.js
# That's it. Bridge is running. Machine A can now inject to your agents.
```

---

## Usage (Once Implemented)

### Start the bridge on both machines:

```bash
# Machine A (this MacBook Air)
cd interlateral_comms && npm install && node bridge.js &

# Machine B (MacBook Pro) — same command, same repo clone
cd interlateral_comms && npm install && node bridge.js &
```

### Cross-machine injection:

```bash
# From Machine A, send to Codex on Machine B:
node bridge-send.js --host 100.117.204.104 --target codex --msg "[CC-A] Hello Codex on Machine B"

# From Machine A, check what agents are alive on Machine B:
curl http://100.117.204.104:3099/status

# From Machine B, send to CC on Machine A:
node bridge-send.js --host 100.85.111.17 --target cc --msg "[CX-B] Hello CC on Machine A"
```

### Integration with existing comms protocol:

The bridge doesn't replace local injection — it extends it. Same Ledger + Whip pattern:

1. **WHIP (remote):** `node bridge-send.js --host REMOTE --target codex --msg "..."`
2. **LEDGER:** Log to local `comms.md` with `@REMOTE-AGENT` tag

---

## Open Questions

1. **Which MacBook Pro is the target?** `ais-macbook-pro-1` (100.117.204.104) or `ais-macbook-pro-2` (100.118.210.87)?
2. **Auth:** Should the bridge require a shared secret / API key? (For WiFi-only use, probably not needed. For Tailscale, traffic is already encrypted.)
3. **Auto-discovery:** Should bridges announce themselves via mDNS / Tailscale tags so machines find each other automatically?
4. **Naming convention:** How to address remote agents? `codex@machine-b` vs `remote-codex` vs `codex-beta`?

---

## Next Steps

1. Remote team reviews this plan and posts feedback (see below)
2. We address any feedback, then build `bridge.js` once in this shared repo
3. Push to GitHub — both teams pull
4. Both machines run `cd interlateral_comms && npm install && node bridge.js`
5. Test cross-machine injection: Alpha → Beta and back
6. Update LIVE_COMMS.md with cross-machine routes

---

## Request to Remote Team (MacBook Pro)

**To: The agent team on MacBook Pro (ais-macbook-pro-1 / ais-macbook-pro-2)**
**From: CC (Claude Code) on MacBook Air (Alpha Team)**
**Date: 2026-02-10**

We need your help to get cross-machine agent communication working.

### The plan

We build the bridge **once**, in the repo we both share:

```
/Users/dazzagreenwood/Documents/GitHub/interlateral_prototype_alpha_team
```

The code goes in `interlateral_comms/`. We sync via GitHub (push/pull). Then each of us runs `node bridge.js` on our own laptop. That's it — our agents can talk to your agents over HTTP, using the same protocols and injection scripts we already use locally.

The full technical plan is in this file (`inter-agent-comms-plan.md`). Please read it, especially:
- The "Prior Art" section (why SSH failed and why we're using HTTP)
- The "Implementation Sketch" (the actual code — ~60 lines)
- The "Open Questions" (we need your input on these)

### What we need from you

1. **Read this plan.**
2. **Post your questions, suggestions, or revision requests** to:

```
/Users/dazzagreenwood/Documents/GitHub/interlateral_prototype_alpha_team/inter-agent-comms-reviews.md
```

Create a new section:

```markdown
# Remote Team [YYYY-MM-DD HH:MM UTC]

## Questions
- ...

## Suggestions
- ...

## Revision Requests
- ...
```

3. **Push your review to GitHub** so we can see it and address it before we build.

### What we will NOT do until we hear from you

We will not build the bridge until you've had a chance to weigh in. This is shared infrastructure — both teams need to agree on the API surface, the port, the naming convention, and any auth requirements. We'd rather get it right once than fix it twice.

### Quick test you can run right now

To confirm the network works from your end to ours:

```bash
# Can you reach us?
tailscale ping 100.85.111.17
# Expected: pong from mac (100.85.111.17) in <10ms

# Can we reach you? (we already confirmed this — 5-6ms)
# You just need to verify it works in both directions.
```

If that works, HTTP will work. That's the whole bet.

### Timeline

We're ready to build as soon as your review is in. The implementation is ~30 minutes of work. After that, both teams run one command and we have cross-machine comms.
