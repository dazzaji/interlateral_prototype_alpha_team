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

# Cross-Machine Comms Test Protocol [2026-02-11]

**Author:** CC (Alpha Team)
**Purpose:** Systematically verify which agents can talk to which agents across machines, both directions.
**Status:** READY TO EXECUTE — both teams should run this.

---

## Concept

Every test sends a unique token and waits for an ACK containing that same token. If the ACK comes back, two-way comms is confirmed for that pair. If not, we know exactly which link is broken.

**Token format:** `XTEST-{sender}-to-{receiver}-{timestamp}`

Example: `XTEST-ALPHA-CC-to-BETA-CX-1739260800`

---

## Prerequisites

Both machines must have:
- [ ] Bridge running: `cd interlateral_comms && node bridge.js`
- [ ] Bridge reachable: `curl http://<OTHER_IP>:3099/health` returns `{"ok":true,...}`

**IPs:**
- Alpha (MacBook Air): `100.85.111.17`
- Beta (MacBook Pro): `100.117.204.104`

---

## Agent Roster (as of 2026-02-11)

| Machine | Agent | Status | Can Receive? |
|---------|-------|--------|--------------|
| Alpha | CC | ALIVE (running) | YES |
| Alpha | CX | ALIVE | YES |
| Alpha | Gemini | ALIVE | YES |
| Alpha | AG | ALIVE | YES |
| Beta | CC | tmux exists, idle shell | MAYBE (lands in bash, not CC) |
| Beta | CX | ALIVE (active) | YES |
| Beta | Gemini | ALIVE (shell mode) | NO (messages go to bash, not Gemini prompt) |
| Beta | AG | DOWN | NO |

**Testable pairs (agents that can plausibly receive):**
- Alpha CC, CX, Gemini, AG <-> Beta CX
- Alpha CC, CX, Gemini, AG <-> Beta CC (if CC is started)
- Beta Gemini is blocked by shell mode — skip until fixed

---

## Phase 1: Alpha -> Beta (one at a time)

Alpha team lead (CC) sends to each Beta agent. Beta agent must reply with ACK containing the token.

### Test 1.1: Alpha CC -> Beta CX

**Alpha runs:**
```bash
cd interlateral_comms
TOKEN="XTEST-ALPHA-CC-to-BETA-CX-$(date +%s)"
echo "TOKEN: $TOKEN"
node bridge-send.js --host 100.117.204.104 --target codex --msg "[$TOKEN] This is CC on Alpha. Please reply with: ACK $TOKEN"
```

**Beta CX should see** the message and reply. Beta CX runs:
```bash
cd interlateral_comms
node bridge-send.js --host 100.85.111.17 --target cc --msg "ACK XTEST-ALPHA-CC-to-BETA-CX-<timestamp>"
```

**Alpha verifies:** Check CC terminal or comms.md for the ACK token.

**Result:** PASS / FAIL / PARTIAL (message arrived but no ACK back)

### Test 1.2: Alpha CX -> Beta CX

**Alpha runs (tell CX to do this, or inject via local codex.js):**
```bash
cd interlateral_comms
TOKEN="XTEST-ALPHA-CX-to-BETA-CX-$(date +%s)"
echo "TOKEN: $TOKEN"
node bridge-send.js --host 100.117.204.104 --target codex --msg "[$TOKEN] This is CX on Alpha. Please reply with: ACK $TOKEN"
```

**Result:** PASS / FAIL / PARTIAL

### Test 1.3: Alpha Gemini -> Beta CX

Same pattern, swap sender.

### Test 1.4: Alpha CC -> Beta CC (if CC is running on Beta)

Same pattern, target `cc` instead of `codex`.

---

## Phase 2: Beta -> Alpha (one at a time)

Beta team lead (CX or CC) sends to each Alpha agent. Alpha agent must reply with ACK.

### Test 2.1: Beta CX -> Alpha CC

**Beta runs:**
```bash
cd interlateral_comms
TOKEN="XTEST-BETA-CX-to-ALPHA-CC-$(date +%s)"
echo "TOKEN: $TOKEN"
node bridge-send.js --host 100.85.111.17 --target cc --msg "[$TOKEN] This is CX on Beta. Please reply with: ACK $TOKEN"
```

**Alpha CC should see** the message and reply:
```bash
cd interlateral_comms
node bridge-send.js --host 100.117.204.104 --target codex --msg "ACK XTEST-BETA-CX-to-ALPHA-CC-<timestamp>"
```

**Result:** PASS / FAIL / PARTIAL

### Test 2.2: Beta CX -> Alpha CX

Same pattern, target `codex` on Alpha.

### Test 2.3: Beta CX -> Alpha Gemini

Same pattern, target `gemini` on Alpha.

### Test 2.4: Beta CC -> Alpha CC (if CC is running on Beta)

Same pattern.

---

## Phase 3: Automated Sweep (optional, for speed)

If manual tests are too slow, run this script on each machine. It sends a token to every remote agent and checks for arrival (not ACK — just delivery confirmation via `/read`).

**Run on Alpha:**
```bash
#!/bin/bash
REMOTE="100.117.204.104"
TS=$(date +%s)
for AGENT in cc codex gemini; do
  TOKEN="XTEST-ALPHA-SWEEP-to-BETA-${AGENT}-${TS}"
  echo "Sending to Beta $AGENT: $TOKEN"
  node bridge-send.js --host $REMOTE --target $AGENT --msg "[$TOKEN] Delivery test from Alpha. No reply needed."
  sleep 2
done
echo ""
echo "Now checking Beta terminals for tokens..."
sleep 10
for AGENT in cc codex gemini; do
  echo "=== Beta $AGENT ==="
  curl -s http://$REMOTE:3099/read/$AGENT 2>/dev/null | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  out=d.get('output','')
  if 'XTEST-ALPHA-SWEEP' in out: print('DELIVERED')
  else: print('NOT FOUND in terminal')
except: print('READ FAILED')
"
done
```

**Run on Beta (swap IPs):**
```bash
#!/bin/bash
REMOTE="100.85.111.17"
TS=$(date +%s)
for AGENT in cc codex gemini; do
  TOKEN="XTEST-BETA-SWEEP-to-ALPHA-${AGENT}-${TS}"
  echo "Sending to Alpha $AGENT: $TOKEN"
  node bridge-send.js --host $REMOTE --target $AGENT --msg "[$TOKEN] Delivery test from Beta. No reply needed."
  sleep 2
done
echo ""
echo "Now checking Alpha terminals for tokens..."
sleep 10
for AGENT in cc codex gemini; do
  echo "=== Alpha $AGENT ==="
  curl -s http://$REMOTE:3099/read/$AGENT 2>/dev/null | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  out=d.get('output','')
  if 'XTEST-BETA-SWEEP' in out: print('DELIVERED')
  else: print('NOT FOUND in terminal')
except: print('READ FAILED')
"
done
```

---

## Results Table (fill in as tests complete)

| Test | Sender | Receiver | Token Sent? | Token Arrived? | ACK Returned? | Result |
|------|--------|----------|-------------|----------------|---------------|--------|
| 1.1 | Alpha CC | Beta CX | | | | |
| 1.2 | Alpha CX | Beta CX | | | | |
| 1.3 | Alpha GM | Beta CX | | | | |
| 1.4 | Alpha CC | Beta CC | | | | |
| 2.1 | Beta CX | Alpha CC | | | | |
| 2.2 | Beta CX | Alpha CX | | | | |
| 2.3 | Beta CX | Alpha GM | | | | |
| 2.4 | Beta CC | Alpha CC | | | | |

**Legend:** PASS = token sent + arrived + ACK returned. PARTIAL = token arrived but no ACK. FAIL = token never arrived. SKIP = agent not available.

---

## Known Issues (to watch for during testing)

1. **Beta Gemini is in shell mode.** Messages land in bash, not Gemini's prompt. Need someone on Beta to press Escape to exit shell mode before testing Gemini.
2. **Beta CC is an idle shell.** CC agent isn't running in the tmux session. Messages land at a bash prompt. Need to start CC on Beta for CC-to-CC tests.
3. **Beta codex.js has no `read` command.** We can't remotely verify Codex received messages via `/read/codex`. Must rely on ACK replies or visual confirmation on the laptop screen.
4. **Message truncation.** Long messages may get split by tmux. Keep test messages short.

---

## How to Run

1. **Both teams:** Confirm bridge is running (`curl http://localhost:3099/health`)
2. **Alpha team goes first:** Run Phase 1 tests (1.1 through 1.4)
3. **Beta team goes second:** Run Phase 2 tests (2.1 through 2.4)
4. **Both teams:** Fill in the Results Table above
5. **Push results to GitHub** so both teams can see the full picture
6. **Optional:** Run Phase 3 automated sweep for a quick delivery check

**Time estimate:** ~10 minutes for manual tests, ~2 minutes for automated sweep.
