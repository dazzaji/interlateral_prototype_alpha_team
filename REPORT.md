# Cross-Machine Comms Test Report

**Date:** 2026-02-11
**Author:** CC (Alpha Team, MacBook Air)
**Status:** TESTS COMPLETE

---

## Executive Summary

The REST API bridge (`interlateral_comms/bridge.js`) works. Two laptops on the same WiFi can send messages to each other's agents via HTTP. Round-trip communication is confirmed between Alpha (MacBook Air) and Beta (MacBook Pro).

---

## What WORKS

### 1. The HTTP Bridge (both directions)
- Alpha -> Beta: CONFIRMED. Messages sent via `bridge-send.js` arrive at Beta agents.
- Beta -> Alpha: CONFIRMED. Beta CX sent tokens to Alpha CC, Alpha CX, and Alpha Gemini — all arrived.
- Round-trip latency: ~5-15 seconds (includes agent processing time).

### 2. WiFi Transport (192.168.x.x)
- Alpha (192.168.8.124:3099) reachable from Beta: YES
- Beta (192.168.8.216:3099) reachable from Alpha: YES
- This is the RELIABLE path. Use WiFi IPs.

### 3. Tailscale Transport (100.x.x.x) — PARTIAL
- Alpha -> Beta via Tailscale (100.117.204.104): WORKS
- Beta -> Alpha via Tailscale (100.85.111.17): FAILS (timeouts)
- One-directional only. Likely a Tailscale routing or firewall issue on Alpha.

### 4. Bridge API Endpoints
- `GET /health` — works on both machines
- `GET /status` — works, correctly reports which agents are alive
- `POST /inject` — works, delivers messages to local agents
- `GET /read/:agent` — works for Gemini and CC; Codex returns error ("Unknown command: read")

### 5. Agent Injection (local, via bridge)
- Bridge -> local CC (via cc.js): WORKS
- Bridge -> local CX (via codex.js): WORKS
- Bridge -> local Gemini (via gemini.js): WORKS
- Bridge -> local AG (via ag.js): NOT TESTED (AG not running on either machine)

---

## Test Results Table

| Test | Sender | Receiver | Transport | Token | Result |
|------|--------|----------|-----------|-------|--------|
| 1.1 | Alpha CC | Beta CX | Tailscale | XTEST-RT-1770794707 | **PASS** (12s round-trip) |
| 1.2 | Alpha CC | Beta CX -> Alpha CX | WiFi | XTEST-1.2R-1770795282 | **PASS** (ACK arrived) |
| 1.3 | Alpha CC | Beta CX -> Alpha GM | WiFi | XTEST-1.3R-1770795285 | **PASS** (ACK arrived) |
| 2.1 | Beta CX | Alpha CC | WiFi | XTEST-2.1-BETA-CX-TO-ALPHA-CC | **PASS** |
| 2.2 | Beta CX | Alpha CX | WiFi | XTEST-2.2-BETA-CX-TO-ALPHA-CX | **PASS** |
| 2.3 | Beta CX | Alpha GM | WiFi | XTEST-2.3-BETA-CX-TO-ALPHA-GM | **PASS** |

**6 of 6 tests PASSED.**

---

## What Did NOT Work or Worked Unexpectedly

### 1. Tailscale Return Path (Beta -> Alpha) Times Out
- Beta CX reported: "All attempts to 100.85.111.17:3099 timed out"
- Alpha -> Beta via Tailscale works fine
- Workaround: Use WiFi IPs (192.168.8.x). Works immediately.
- Root cause unknown — possibly Tailscale firewall/ACL on Alpha, or asymmetric NAT.

### 2. Beta Gemini Stuck in Shell Mode
- Messages injected to Beta Gemini land in bash, not Gemini's prompt
- Gemini CLI has a "shell mode" toggle (Escape to exit)
- This is a UI state issue, not a bridge issue
- Fix: Someone on Beta presses Escape in Gemini's terminal

### 3. Beta CC is an Idle Shell
- Beta has a `interlateral-claude` tmux session but CC isn't running in it
- Messages land at a bash prompt, not CC's input
- Fix: Start CC agent on Beta

### 4. Local Agents Don't Reliably Execute Shell Commands from Injected Messages
- When we injected "run this command: node bridge-send.js ..." into Alpha CX and Alpha Gemini, they treated it as conversation, not a command to execute
- CX responded with "ACK. What is our assignment?" — didn't run the bridge-send command
- Gemini wrote an ACK to comms.md — didn't run the bridge-send command
- This is expected behavior — agents interpret messages as prompts, not shell scripts
- Workaround: CC (the coordinator) runs bridge-send commands directly on behalf of other agents

### 5. Codex `read` Command Not Implemented
- Beta's `codex.js` does not support the `read` subcommand
- `GET /read/codex` returns an error
- Cannot remotely observe Codex's terminal via the bridge API
- Workaround: Use human visual confirmation or have Codex send bridge-send ACKs

### 6. SSH Still Broken (Confirmed Again)
- Tailscale SSH and plain SSH both fail to connect to either MacBook Pro
- This validates the decision to use HTTP instead of SSH
- See `inter-agent-comms-plan.md` "Prior Art" section for full details

---

## What Remains to Be Tested

| Test | Why Untested | Prerequisite |
|------|-------------|--------------|
| Alpha <-> Beta Gemini | Beta Gemini stuck in shell mode | Press Escape on Beta |
| Alpha <-> Beta CC | Beta CC not running | Start CC on Beta |
| Alpha AG <-> Beta anything | AG not running on either machine | Launch Antigravity |
| Beta -> Alpha via Tailscale | Tailscale return path times out | Debug Tailscale on Alpha |
| Multi-agent relay | Agent A -> Bridge -> Agent B -> Bridge -> Agent C | All agents running + bridge-send integration |

---

## Key Learnings

1. **WiFi is the reliable transport.** Tailscale works Alpha->Beta but not Beta->Alpha. Use `192.168.8.x` IPs.
2. **The bridge itself is solid.** Express server, ~130 lines, zero crashes during testing. Handles concurrent requests.
3. **Agents can receive cross-machine messages.** The injection chain (bridge HTTP -> local .js script -> tmux send-keys -> agent terminal) works end-to-end.
4. **Agents won't auto-execute commands you send them.** If you inject "run this command: ...", they interpret it as a prompt. The coordinator agent (CC) should run bridge-send commands directly.
5. **The round-trip ACK pattern works.** Send a token, have the receiver send it back via bridge-send, check comms.md. Clean and verifiable.

---

## Recommended Next Steps

1. **Lock in WiFi IPs** as the primary transport. Update `inter-agent-comms-plan.md`.
2. **Fix Beta Gemini** (exit shell mode) and **start Beta CC** to complete the test matrix.
3. **Add bridge-send wrapper** to the existing .js scripts so agents can do `node codex.js send --remote 192.168.8.216 "msg"` instead of raw bridge-send commands.
4. **Start bridge automatically** in `bootstrap-full.sh` so it's always running.
5. **Update LIVE_COMMS.md** with cross-machine routes once all pairs are confirmed.

---

## IPs Quick Reference

| Machine | WiFi (reliable) | Tailscale (Alpha->Beta only) |
|---------|-----------------|------------------------------|
| Alpha (MacBook Air) | 192.168.8.124 | 100.85.111.17 |
| Beta (MacBook Pro) | 192.168.8.216 | 100.117.204.104 |

**Bridge port:** 3099 on both machines.

---
---

# PROPOSED DOCUMENTATION

**Author:** CC (Claude Code, external session — coordinating agent)
**Date:** 2026-02-11
**Purpose:** Proposed additions to 7 files to document the cross-machine HTTP bridge as an EXPERIMENTAL capability. Each subsection below contains the exact markdown to insert, with the target file and insertion point noted.

**Review process:** Principal reviews these proposals, approves/edits, then we apply them to the actual files.

---

## 1. README.md

**Insert after:** "Comms Monitor Dashboard" section, before "Observability System"

```markdown
---

### Cross-Machine Bridge (EXPERIMENTAL)

> **STATUS: EXPERIMENTAL.** Tested on two machines over WiFi. Not yet in bootstrap.
> Manual startup required on each machine.

The cross-machine bridge allows agents on one machine to inject messages into agents
on a different machine over HTTP. This extends the quad-agent mesh across multiple
laptops on the same network.

**Architecture:**

```
Machine A                                Machine B
─────────────                            ─────────────
CC (coordinator)                         bridge.js :3099
  │                                        │
  ├─ node bridge-send.js \                 │
  │   --host 192.168.8.216 \              │
  │   --target codex \                     │
  │   --msg "Hello from A"                │
  │                                        ├─ node codex.js send "Hello from A"
  │                                        ├─ Codex receives message locally
  │  ◄── 200 {"ok":true}                  │
```

**Code location:** `interlateral_comms/` (separate from `interlateral_dna/`)

**Quick Start:**

```bash
# On EACH machine:
cd interlateral_comms && npm install && node bridge.js &

# Verify:
curl http://localhost:3099/health

# Send to a remote agent:
node bridge-send.js --host <REMOTE_IP> --target cc --msg "Hello from $(hostname)"
```

**API Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Bridge health check (hostname, time, queue depth) |
| `/status` | GET | Status of all four local agents |
| `/inject` | POST | Inject message into a local agent. Body: `{"target":"cc","message":"..."}` |
| `/read/:agent` | GET | Read agent terminal output (Codex not supported) |

**Transport:**

| Transport | IPs | Status |
|-----------|-----|--------|
| **WiFi (preferred)** | `192.168.8.x` | Reliable both directions |
| **Tailscale (fallback)** | `100.x.x.x` | One direction only (A→B works, B→A times out) |

> **WARNING:** WiFi IPs are DHCP-assigned and can change. Verify with
> `ipconfig getifaddr en0` before each session.

**Known Limitations:**

- Not in bootstrap — start manually with `node bridge.js` on each machine
- No authentication — any host on the network can POST to port 3099
- Agents do not auto-execute injected commands — CC must coordinate
- Codex `read` not supported remotely (`GET /read/codex` fails)
- AG untested (was not running during tests)
- Tailscale asymmetric (A→B only)
- WiFi IPs change with DHCP leases
- Message size limit: 5000 chars / 10KB body

**Smoke test:**

```bash
cd interlateral_comms
bash test/smoke-test.sh                   # local
bash test/smoke-test.sh 192.168.8.216     # remote
```

See `REPORT.md` for full cross-machine test results.
```

---

## 2. INTERNALS_CONFORMANCE.md

**Target file:** `interlateral_comms_monitor/docs/INTERNALS_CONFORMANCE.md`

**Add to Table of Contents** (after Section 18 entry):
```markdown
19. [Cross-Machine Bridge Conformance (EXPERIMENTAL)](#19-cross-machine-bridge-conformance-experimental)
```

**Add to Quick Start Matrix** (Section 0 table):
```markdown
| **Bridge changes** | 19, 12, 14 | Bridge health + inject test + smoke test |
```

**Insert after Section 18** (before the Change Log):

```markdown
## 19. Cross-Machine Bridge Conformance (EXPERIMENTAL)

> **STATUS: EXPERIMENTAL.** This section covers the HTTP bridge in `interlateral_comms/`.
> The bridge is not yet in the bootstrap pipeline and requires manual verification.

### 19.1 Bridge Server Integrity (HIGH)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 19.1.1 | `bridge.js` exists | HIGH | `[ -f interlateral_comms/bridge.js ]` |
| 19.1.2 | `bridge-send.js` exists | HIGH | `[ -f interlateral_comms/bridge-send.js ]` |
| 19.1.3 | Express dependency installed | HIGH | `[ -d interlateral_comms/node_modules/express ]` |
| 19.1.4 | Uses `execFileSync` (NOT `execSync`) | CRITICAL | `grep -q 'execFileSync' interlateral_comms/bridge.js && ! grep -q 'execSync(' interlateral_comms/bridge.js` |
| 19.1.5 | Body limit set | HIGH | `grep -q "limit.*10kb" interlateral_comms/bridge.js` |
| 19.1.6 | Message cap enforced | HIGH | `grep -q "5000" interlateral_comms/bridge.js` |
| 19.1.7 | Valid targets restricted | CRITICAL | `grep "VALID_TARGETS" interlateral_comms/bridge.js \| grep -q "cc.*codex.*gemini.*ag"` |
| 19.1.8 | Concurrency mutex present | HIGH | `grep -q "acquireLock" interlateral_comms/bridge.js` |

### 19.2 Bridge Runtime Checks (HIGH)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 19.2.1 | Health check responds | HIGH | `curl -sf http://127.0.0.1:3099/health \| grep -q '"ok":true'` |
| 19.2.2 | Rejects invalid target | HIGH | `curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:3099/inject -H 'Content-Type: application/json' -d '{"target":"evil","message":"test"}' \| grep -q "400"` |
| 19.2.3 | Rejects missing message | HIGH | `curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:3099/inject -H 'Content-Type: application/json' -d '{"target":"cc"}' \| grep -q "400"` |
| 19.2.4 | Smoke test passes | HIGH | `cd interlateral_comms && bash test/smoke-test.sh` |

### 19.3 Cross-Machine Connectivity (MEDIUM)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 19.3.1 | Remote bridge reachable | MEDIUM | `curl -sf --max-time 5 http://<REMOTE_IP>:3099/health` |
| 19.3.2 | Remote injection succeeds | MEDIUM | `node interlateral_comms/bridge-send.js --host <REMOTE_IP> --target cc --msg "CONFORMANCE_TEST"` |
| 19.3.3 | WiFi IPs verified | MEDIUM | `ipconfig getifaddr en0` on each machine |

### 19.4 Known Failure Modes

| # | Issue | Symptom | Severity | Mitigation |
|---|-------|---------|----------|------------|
| 19.4.1 | Tailscale asymmetric routing | B→A times out via 100.x.x.x | MEDIUM | Use WiFi IPs (192.168.8.x) |
| 19.4.2 | DHCP IP change | Remote unreachable after network event | MEDIUM | Re-run `ipconfig getifaddr en0`, update target IP |
| 19.4.3 | Bridge not started | Connection refused on 3099 | HIGH | `cd interlateral_comms && node bridge.js` |
| 19.4.4 | Codex `read` unsupported | GET /read/codex returns 500 | LOW | Use ACK tokens or human visual confirmation |
| 19.4.5 | AG untested | ag.js send not verified through bridge | MEDIUM | Verify AG running + CDP active before injecting |
| 19.4.6 | Agents treat messages as prompts | Agent ACKs but won't execute embedded commands | HIGH | CC runs bridge-send directly, never delegates |
| 19.4.7 | No authentication | Any LAN host can POST to /inject | MEDIUM | Future: `BRIDGE_TOKEN` env var |

### 19.5 Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `BRIDGE_PORT` | `3099` | Port the bridge listens on |

### 19.6 Quick Verification

```bash
echo "=== Bridge Conformance ==="
[ -f interlateral_comms/bridge.js ] && echo "bridge.js: OK" || echo "bridge.js: MISSING"
[ -f interlateral_comms/bridge-send.js ] && echo "bridge-send.js: OK" || echo "bridge-send.js: MISSING"
grep -q 'execFileSync' interlateral_comms/bridge.js && echo "execFileSync: OK" || echo "CRITICAL: execFileSync missing"
! grep -q 'execSync(' interlateral_comms/bridge.js && echo "No execSync: OK" || echo "CRITICAL: execSync found"
curl -sf --max-time 2 http://127.0.0.1:3099/health | grep -q '"ok":true' && echo "Bridge: RUNNING" || echo "Bridge: NOT RUNNING"
```
```

---

## 3. CLAUDE.md

**Insert after:** "Communicating with Gemini CLI (CRITICAL LESSON)" section, before "Leadership Protocol (Quad-Agent)"

```markdown
---

## Cross-Machine Bridge (EXPERIMENTAL)

> **STATUS: EXPERIMENTAL.** Tested over WiFi between two machines. Not yet in bootstrap.

The cross-machine bridge extends the quad-agent mesh to agents on a DIFFERENT machine.
Code lives in `interlateral_comms/` (separate from `interlateral_dna/`).

### YOU (CC) Are the Cross-Machine Coordinator

**CRITICAL LESSON: Agents do not auto-execute commands sent via the bridge.**

When you inject "run this command: node bridge-send.js ..." into Codex or Gemini, they
treat it as a prompt and respond conversationally. They do NOT run the command.

**Therefore: CC runs ALL cross-machine sends directly.** If Codex on Machine A needs to
message Codex on Machine B, CC runs bridge-send.js on Codex's behalf.

### Sending to Remote Agents

```bash
node interlateral_comms/bridge-send.js \
  --host <REMOTE_WIFI_IP> \
  --target <agent> \
  --msg "[CC] Cross-machine message from $(hostname)"
```

**Valid targets:** `cc`, `codex`, `gemini`, `ag`

### Transport Priority

1. **WiFi (preferred):** `192.168.8.x` IPs. Reliable both directions.
2. **Tailscale (fallback):** `100.x.x.x` IPs. Works A→B only. B→A times out.

> **WARNING:** WiFi IPs are DHCP-assigned and can change. Verify before each session:
> `ipconfig getifaddr en0`

### Starting the Bridge

Not yet in `bootstrap-full.sh`. Start manually on EACH machine:

```bash
cd interlateral_comms && node bridge.js &
curl http://localhost:3099/health   # verify
```

### Remote Communication Map (extends local map)

| From (Local) | To (Remote) | Command |
|------------|------------|---------|
| CC → Remote CC | `node bridge-send.js --host IP --target cc --msg "..."` |
| CC → Remote Codex | `node bridge-send.js --host IP --target codex --msg "..."` |
| CC → Remote Gemini | `node bridge-send.js --host IP --target gemini --msg "..."` |
| CC → Remote AG | `node bridge-send.js --host IP --target ag --msg "..."` (UNTESTED) |

**Path:** `interlateral_comms/bridge-send.js` (NOT `interlateral_dna/`)

### Checking Remote Agents

```bash
curl http://<REMOTE_IP>:3099/health          # bridge alive?
curl http://<REMOTE_IP>:3099/status          # which agents are up?
curl http://<REMOTE_IP>:3099/read/gemini     # read terminal (NOT codex — unsupported)
```

### Round-Trip Verification

```bash
TOKEN="XTEST-$(date +%s)"
node interlateral_comms/bridge-send.js \
  --host 192.168.8.216 --target cc \
  --msg "[CC-Alpha] Round-trip test: $TOKEN — please ACK back via bridge."
sleep 15
grep "$TOKEN" interlateral_dna/comms.md
```

### Known Limitations

- Bridge not in bootstrap — manual start required
- No auth token — any LAN host can inject
- WiFi IPs change with DHCP
- Tailscale one direction only
- Codex `read` not supported remotely
- AG untested through bridge
- 5000 char / 10KB message limit
```

---

## 4. AGENTS.md (Codex)

**Insert after:** "Codex-Specific Notes" section, before "What You Can Do Autonomously"

```markdown
---

## Cross-Machine Bridge — Codex (EXPERIMENTAL)

> **STATUS: EXPERIMENTAL.** The bridge extends the quad-agent mesh across machines over HTTP.

### How You Receive Remote Messages

When a remote agent sends you a message via the bridge:

1. Remote runs: `node bridge-send.js --host <YOUR_MACHINE_IP> --target codex --msg "message"`
2. Bridge on YOUR machine receives the HTTP POST
3. Bridge runs: `node codex.js send "message"` locally
4. You receive it in your tmux terminal — same as a local injection

**You don't need to do anything special.** Remote messages arrive the same way local ones do.

### What You CANNOT Do (Yet)

**Your outbox courier does NOT support cross-machine routing.**

- Writing to `codex_outbox/*.msg` with a remote target will NOT reach agents on other machines
- The courier only delivers to LOCAL agents
- Cross-machine sends require `bridge-send.js`, which is a shell command you can't run

**Workaround:** Ask CC to relay. CC is the cross-machine coordinator.

```bash
# Request CC relay a cross-machine message for you:
echo '{"target":"cc","msg":"[Codex] @CC Please bridge to Remote Gemini: <your message>"}' > interlateral_dna/codex_outbox/$(date +%s).msg
```

### Known Gap: Remote `read` Not Supported

`GET /read/codex` on the bridge returns an error — `codex.js` does not implement `read`.
Remote agents cannot observe your terminal via the API.

**Workaround:** Send explicit ACK messages back through CC so remote agents know you received their message.

### Quick Reference

```bash
curl http://localhost:3099/health            # is local bridge running?
curl http://<REMOTE_IP>:3099/health          # is remote bridge reachable?
```
```

---

## 5. GEMINI.md

**Insert after:** "Your Teammates" section, before "IDLE AFTER ACK (CRITICAL)"

```markdown
---

## Cross-Machine Bridge — Gemini (EXPERIMENTAL)

> **STATUS: EXPERIMENTAL.** The bridge extends the quad-agent mesh across machines over HTTP.

### How You Receive Remote Messages

Remote messages arrive the same way local ones do. The bridge on your machine receives
an HTTP POST and runs `node gemini.js send "message"` locally. No special handling needed.

### How You Can Send to Remote Agents

Unlike Codex, **you have shell access** and can run `bridge-send.js` directly:

```bash
node interlateral_comms/bridge-send.js \
  --host <REMOTE_IP> \
  --target <agent> \
  --msg "[Gemini] Your message here"
```

**Valid targets:** `cc`, `codex`, `gemini`, `ag`

> **WARNING:** WiFi IPs (192.168.8.x) are DHCP-assigned and can change.
> Tailscale IPs (100.x.x.x) are stable but only work one direction.

### Local vs Remote

| Target | Same Machine | Different Machine |
|--------|-------------|-------------------|
| CC | `node interlateral_dna/cc.js send "msg"` | `node interlateral_comms/bridge-send.js --host IP --target cc --msg "msg"` |
| Codex | `node interlateral_dna/codex.js send "msg"` | `node interlateral_comms/bridge-send.js --host IP --target codex --msg "msg"` |
| AG | `node interlateral_dna/ag.js send "msg"` | `node interlateral_comms/bridge-send.js --host IP --target ag --msg "msg"` |

### Coordination Note

CC is the designated cross-machine coordinator. Only use bridge-send.js directly if CC
explicitly delegates to you or if CC is unreachable.

### Known Limitations

- Bridge must be started manually on each machine
- No authentication on port 3099
- WiFi IPs change with DHCP
- Tailscale one direction only
- AG untested through bridge
```

---

## 6. ANTIGRAVITY.md

**Insert after:** "Communicating with Codex" section, before "Leadership Protocol"

```markdown
---

## Cross-Machine Bridge — Antigravity (EXPERIMENTAL)

> **STATUS: EXPERIMENTAL and UNTESTED for AG.** AG was not running during cross-machine
> bridge testing. The mechanism below is theoretical based on the bridge architecture.

### How You Would Receive Remote Messages

1. Remote runs: `bridge-send.js --host <YOUR_MACHINE_IP> --target ag --msg "message"`
2. Bridge on your machine receives the HTTP POST
3. Bridge runs: `node ag.js send "message"` locally
4. `ag.js` injects into your Agent Manager panel via CDP

**Prerequisite:** AG must be running with CDP enabled (`--remote-debugging-port=9222`)
and a workspace must be open (not Launchpad).

### What You CANNOT Do

**AG cannot initiate cross-machine sends.** You are a GUI application without a shell.
You cannot run `bridge-send.js`.

**Workaround:** Ask CC to relay:

```bash
node interlateral_dna/cc.js send "[AG] @CC Please bridge to Remote Codex: <your message>"
```

### Test Status

| Test | Status | Note |
|------|--------|------|
| Remote inject to AG | UNTESTED | AG not running during tests |
| AG → remote via bridge | NOT POSSIBLE | No shell access |
| Bridge /read/ag | UNKNOWN | ag.js `read` exists but untested through bridge |

### Known Considerations

- AG must be running with CDP on port 9222 AND have a workspace open
- If AG is on Launchpad or the iframe is not visible, inject will fail (500 error)
- No authentication on bridge port 3099
```

---

## 7. interlateral_dna/LIVE_COMMS.md

**Insert after:** "IMPORTANT LESSONS LEARNED" section (end of file)

```markdown
---

## CROSS-MACHINE COMMUNICATION (EXPERIMENTAL)

> **STATUS: EXPERIMENTAL.** Tested between two machines over WiFi. Not yet in bootstrap.

The cross-machine bridge extends the local communication matrix to agents on different
machines. Code: `interlateral_comms/bridge.js` and `interlateral_comms/bridge-send.js`.

### CROSS-MACHINE SEND MATRIX

| If YOU are... | To reach Remote CC | To reach Remote CX | To reach Remote GM | To reach Remote AG |
|---------------|--------------------|--------------------|--------------------|--------------------|
| **CC** | `bridge-send.js --host IP --target cc` | `bridge-send.js --host IP --target codex` | `bridge-send.js --host IP --target gemini` | `bridge-send.js --host IP --target ag` |
| **Gemini** | `bridge-send.js --host IP --target cc` | `bridge-send.js --host IP --target codex` | `bridge-send.js --host IP --target gemini` | `bridge-send.js --host IP --target ag` |
| **Codex** | ASK CC to relay | ASK CC to relay | ASK CC to relay | ASK CC to relay |
| **AG** | ASK CC to relay | ASK CC to relay | ASK CC to relay | ASK CC to relay |

**Path:** `interlateral_comms/bridge-send.js` (NOT `interlateral_dna/`)

Codex and AG cannot run bridge-send.js directly (Codex: sandbox/outbox-only, AG: no shell).
CC is the cross-machine coordinator.

### Bridge Quick Start

```bash
# Start on EACH machine (not yet in bootstrap)
cd interlateral_comms && node bridge.js &

# Verify local
curl http://localhost:3099/health

# Verify remote
curl http://<REMOTE_IP>:3099/health

# Send
node interlateral_comms/bridge-send.js --host <REMOTE_IP> --target cc --msg "test"
```

### TRANSPORT PRIORITY

| Priority | Transport | IPs | Reliability |
|----------|-----------|-----|-------------|
| 1 (preferred) | **WiFi** | `192.168.8.x` | Both directions confirmed |
| 2 (fallback) | **Tailscale** | `100.x.x.x` | ONE DIRECTION ONLY (A→B) |

> **WARNING: DHCP.** WiFi IPs can change between sessions.
> Run `ipconfig getifaddr en0` on each machine before relying on stored IPs.

### CROSS-MACHINE TROUBLESHOOTING

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Connection refused on 3099 | Bridge not running | `cd interlateral_comms && node bridge.js` on remote |
| Connection timeout | Wrong IP or network changed | Re-check `ipconfig getifaddr en0` on remote |
| Inject returns 500 | Target agent not running | Start the agent on the remote machine |
| Tailscale works one way only | Known asymmetric routing | Switch to WiFi IPs |
| Agent receives but ignores | Agents treat injected messages as prompts | CC runs bridge-send directly |
| /read/codex returns error | codex.js has no `read` subcommand | Use ACK tokens or human confirmation |
| Remote agent stuck in shell | Agent not running in tmux session | Fix agent state on remote machine |

### CROSS-MACHINE QUICK REFERENCE CARD

```
┌──────────────────────────────────────────────────────────────┐
│            CROSS-MACHINE COMMS CHEAT SHEET                   │
│                   (EXPERIMENTAL)                             │
├──────────────────────────────────────────────────────────────┤
│  Path: interlateral_comms/bridge-send.js                     │
│                                                              │
│  CC → Remote *:  node bridge-send.js --host IP               │
│                    --target <cc|codex|gemini|ag>              │
│                    --msg "message"                            │
│                                                              │
│  GM → Remote *:  (same command — Gemini has shell access)    │
│  CX → Remote *:  ASK CC TO RELAY (no direct bridge access)  │
│  AG → Remote *:  ASK CC TO RELAY (no shell)                  │
├──────────────────────────────────────────────────────────────┤
│  Start bridge:   cd interlateral_comms && node bridge.js     │
│  Health check:   curl http://IP:3099/health                  │
│  Agent status:   curl http://IP:3099/status                  │
│  Read terminal:  curl http://IP:3099/read/<agent>            │
│                  (NOT codex — read not supported)             │
├──────────────────────────────────────────────────────────────┤
│  Transport:  WiFi 192.168.8.x (preferred, both directions)  │
│              Tailscale 100.x.x.x (A→B only)                 │
│  Port:       3099 (or BRIDGE_PORT env var)                   │
├──────────────────────────────────────────────────────────────┤
│  ⚠ WiFi IPs are DHCP — verify with ipconfig getifaddr en0   │
│  ⚠ No auth token yet — anyone on network can inject          │
│  ⚠ Agents won't execute injected commands — CC coordinates   │
│  ⚠ Bridge must be started manually — not in bootstrap yet    │
└──────────────────────────────────────────────────────────────┘
```

*Cross-machine bridge added 2026-02-11. See REPORT.md for full test results.*
```

---

## Summary of All Proposed Additions

| # | Target File | Section Title | Insert After | ~Lines |
|---|------------|---------------|-------------|--------|
| 1 | `README.md` | Cross-Machine Bridge (EXPERIMENTAL) | Comms Monitor Dashboard | ~75 |
| 2 | `interlateral_comms_monitor/docs/INTERNALS_CONFORMANCE.md` | Section 19: Cross-Machine Bridge Conformance | Section 18 (before Change Log) | ~80 |
| 3 | `CLAUDE.md` | Cross-Machine Bridge (EXPERIMENTAL) | Communicating with Gemini CLI | ~85 |
| 4 | `AGENTS.md` | Cross-Machine Bridge — Codex (EXPERIMENTAL) | Codex-Specific Notes | ~45 |
| 5 | `GEMINI.md` | Cross-Machine Bridge — Gemini (EXPERIMENTAL) | Your Teammates | ~50 |
| 6 | `ANTIGRAVITY.md` | Cross-Machine Bridge — Antigravity (EXPERIMENTAL) | Communicating with Codex | ~40 |
| 7 | `interlateral_dna/LIVE_COMMS.md` | CROSS-MACHINE COMMUNICATION (EXPERIMENTAL) | Important Lessons Learned | ~95 |

**Total:** ~470 lines of new documentation across 7 files.

**Consistent across all additions:**
- Every heading includes (EXPERIMENTAL)
- Every section opens with a STATUS: EXPERIMENTAL blockquote
- WiFi DHCP warning present wherever IPs are mentioned
- Tailscale asymmetry documented in every transport reference
- CC-coordinator pattern reinforced in every agent file
- `interlateral_comms/` path used everywhere (never confused with `interlateral_dna/`)
- Known limitations listed in every file



_______

# REVIEWS ON PROPOSED DOCUMENTATION FOLLOWS:

________

# REVIEWS FROM ALPHA (macbook air) TEAM





_______

# REVIEWS FROM BETA (macbook pro) TESM


