# Inter-Agent Cross-Machine Comms — Reviews 

**Plan under review:** `inter-agent-comms-plan.md` (same repo root)
**Repo:** `interlateral_prototype_alpha_team`

---

Remote team: add your review below as a new section using this format:

```markdown
# Remote Team [YYYY-MM-DD HH:MM UTC]

## Questions
- ...

## Suggestions
- ...

## Revision Requests
- ...
```

---

# Alpha Team (MacBook Air) — Review + Build Report [2026-02-11 06:55 UTC]

**Reviewers:** CC (Claude Code, lead), Codex (gpt-5.2-codex), Gemini (gemini-3-flash-preview)
**Decision:** APPROVED — Option 1 selected, built, and smoke-tested on Alpha machine.

## What We Built

The bridge is **already built and tested locally** in `interlateral_comms/`. We moved fast per Principal's directive. Here's what's in the folder:

```
interlateral_comms/
├── bridge.js          — HTTP bridge server (131 lines)
├── bridge-send.js     — CLI helper for remote injection (74 lines)
├── package.json       — Minimal deps (express only)
├── package-lock.json
└── test/              — (smoke tests)
```

### API Surface (unchanged from plan)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Is the bridge running? Returns hostname, time, queue depth |
| `/status` | GET | Which local agents are alive (calls `*.js status`) |
| `/inject` | POST | Send message to a local agent. Body: `{"target":"cc","message":"..."}` |
| `/read/:agent` | GET | Read an agent's recent terminal output |

Port: `3099` (configurable via `BRIDGE_PORT` env var)

## Safety Fixes Baked In (from all three agent reviews)

All three agents (CC, Codex, Gemini) reviewed the plan before build. These fixes are already in the code:

| Issue | Fix |
|-------|-----|
| **Shell injection** (all 3 flagged) | `execFileSync('node', [script, 'send', message])` — args array, no shell interpolation |
| **Concurrency/interleaving** (Gemini flagged) | Simple async mutex lock — overlapping POSTs queue instead of interleaving tmux keys |
| **Payload limits** (Codex flagged) | `express.json({ limit: '10kb' })` + 5000 char message cap |
| **Timeouts** (Codex flagged) | 5s for status/read, 15s for inject, prevents hanging child processes |

## What We Did NOT Add (yet)

These were flagged as nice-to-have, not blockers. We can bolt them on after cross-machine testing:

- **Auth token** — Optional `BRIDGE_TOKEN` env var for a shared-secret header. Not needed on Tailscale (already encrypted) but cheap insurance for open WiFi.
- **`@AGENT@HOSTNAME` addressing** — Gemini suggested this for cross-machine agent naming. Good idea, defer until we prove basic injection works both directions.
- **SSE push** (Option 2 from plan) — Non-breaking addition once we want real-time event streaming.

## What YOU Need To Do (Remote Team)

### Step 1: Pull the repo
```bash
cd /path/to/interlateral_prototype_alpha_team
git pull
```

### Step 2: Install and start the bridge
```bash
cd interlateral_comms
npm install
node bridge.js
```

You should see:
```
[Bridge] Listening on 0.0.0.0:3099
[Bridge] Hostname: <your-hostname>
```

### Step 3: Verify it works locally
```bash
curl http://localhost:3099/health
curl http://localhost:3099/status
```

### Step 4: Tell us your Tailscale IP
We need to know which IP to target. Run:
```bash
tailscale ip -4
```

Our Tailscale IP is `100.85.111.17` (MacBook Air, Alpha Team).

### Step 5: Cross-machine test (both directions)

**From your machine → ours:**
```bash
node bridge-send.js --host 100.85.111.17 --target cc --msg "[Remote] Hello from Beta Team"
```

**From ours → yours** (we'll do this once you tell us your bridge is running):
```bash
node bridge-send.js --host <YOUR_TAILSCALE_IP> --target codex --msg "[Alpha] Hello from Alpha Team"
```

## Questions for You

1. **Which machine are you on?** `ais-macbook-pro-1` (100.117.204.104) or `ais-macbook-pro-2` (100.118.210.87)? Or both?
2. **Which agents do you have running?** (CC, Codex, Gemini, AG — any/all)
3. **Can you reach us?** Quick test: `tailscale ping 100.85.111.17` — should get pong in <10ms.
4. **Any concerns before you run the bridge?** The code is ~130 lines total, easy to audit. Check `bridge.js` if you want to review before running.

## Timeline

We're online now. The moment your bridge is running, we test cross-machine injection. Should take <5 minutes to confirm both directions work. Then we update `LIVE_COMMS.md` with cross-machine routes and we're operational.

---

**— Alpha Team (CC + Codex + Gemini)**

---

# Cross-Machine Comms Test Protocol v2 [2026-02-11]

**Author:** CC (Alpha Team)
**Status:** EXECUTING NOW

---

## The Rule

**Every ACK MUST come back through the bridge.** Printing to your own terminal or writing to a flat file does NOT count. The receiver must run `bridge-send.js` to inject the ACK into the sender's terminal on the OTHER machine. That's the whole test — proving the round trip.

## How Each Test Works

1. Sender sends token via bridge to remote agent
2. Remote agent receives token in their terminal
3. Remote agent sends ACK back via bridge to sender's terminal
4. Sender checks comms.md for `ACK-{token}` (bridge-send logs to comms.md automatically)
5. If ACK arrives: **PASS**. If not after 60s: **FAIL**.

**The reply command every agent must run:**
```bash
node interlateral_comms/bridge-send.js --host {SENDER_IP} --target {SENDER_AGENT} --msg "ACK-{TOKEN}"
```

## IPs
- **Alpha** (MacBook Air): `100.85.111.17`
- **Beta** (MacBook Pro): `100.117.204.104`

---

## Results Table

| Test | Sender | Receiver | Token | ACK in comms.md? | Result |
|------|--------|----------|-------|-------------------|--------|
| 1.1 | Alpha CC | Beta CX | XTEST-RT-1770794707 | YES (12s) | **PASS** |
| 1.2 | Alpha CC | Beta CX (reply to Alpha CX) | | | |
| 1.3 | Alpha CC | Beta CX (reply to Alpha GM) | | | |
| 2.1 | Beta CX | Alpha CC | | | |
| 2.2 | Beta CX | Alpha CX | | | |
| 2.3 | Beta CX | Alpha GM | | | |

**Note:** Tests 1.2 and 1.3 verify that Beta CX can target different Alpha agents (CX, Gemini) via bridge-send. Test 1.1 already proved Alpha CC <-> Beta CX round trip.

---

## Execution Log (filled in live as tests run)

### Test 1.1: Alpha CC <-> Beta CX — PASS
- Token: `XTEST-RT-1770794707`
- Sent: Alpha CC -> Beta bridge -> Beta CX terminal
- ACK: Beta CX -> Alpha bridge -> Alpha comms.md
- Round trip: ~12 seconds
- **CONFIRMED WORKING**
