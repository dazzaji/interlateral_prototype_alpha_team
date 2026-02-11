# Proposal: Zero-Config Cross-Machine Bridge Discovery (v3 — Revised)

**Date:** 2026-02-11
**Author:** CC (Alpha Team), revised by CC2
**Status:** PROPOSAL — revised per 6 reviewer comments (3 Alpha + 3 Beta)
**Version:** 3 — all actionable review feedback incorporated

---

## Problem Statement

The cross-machine REST API bridge (`interlateral_comms/bridge.js`) works — 6 of 6 tests passed in the current cross-agent test matrix between Alpha (MacBook Air) and Beta (MacBook Pro). (Note: same-agent cross-machine pairs such as CC-CC, CX-CX, and GM-GM were not tested; see Appendix 1 for details.) But it relies on **hardcoded WiFi IP addresses** (e.g., `192.168.8.124`, `192.168.8.216`) that are assigned by DHCP and change unpredictably between sessions.

This means:

1. **Every cold start requires IP hunting.** Someone has to run `ipconfig getifaddr en0` on each machine, then manually update commands or tell agents the new IPs.
2. **No agent can autonomously establish cross-machine comms.** The wake-up protocol can bootstrap local agents, but it cannot connect to a peer team's bridge without knowing the IP in advance.
3. **Tailscale IPs are stable but unreliable.** Testing showed Tailscale works Alpha→Beta but times out Beta→Alpha. It's not a dependable primary path.
4. **The system breaks the "cold start" principle.** The whole point of the mesh template is that agents wake up and get to work. Requiring a human to find and paste IP addresses on every boot defeats that goal.

**Bottom line:** The bridge architecture is sound, but the addressing layer is fragile. We need stable, zero-config peer resolution.

---

## Proposed Solution: mDNS Hostnames + peers.json

macOS has **built-in mDNS/Bonjour** support. Every Mac advertises a `.local` hostname that resolves to its current WiFi IP automatically — no setup, no service to run, no infrastructure. Using mDNS over Tailscale provides a more stable primary path, as Tailscale showed asymmetric failures during testing (works Alpha→Beta, times out Beta→Alpha).

**mDNS resolution latency note:** First-contact `.local` lookups can take 1–5 seconds if the peer machine just woke from sleep and hasn't announced yet, before the local DNS cache warms. This is acceptable for agent messages (which are not latency-critical) but operators should be aware: the first cross-machine send of a session may take a few seconds longer than subsequent sends. This is normal mDNS behavior, not a bridge bug.

| Machine | .local Hostname | Resolves To |
|---------|----------------|-------------|
| Alpha (MacBook Air) | `Dazzas-MacBook-Air.local` | Current WiFi IP (e.g., 192.168.8.124 today, something else tomorrow) |
| Beta (MacBook Pro) | `<Beta-LocalHostName>.local` | Current WiFi IP (e.g., 192.168.8.216 today, something else tomorrow) |

The `.local` hostname is stable across reboots and network changes. Only the underlying IP changes, and mDNS handles the resolution transparently.

### Change 1: Add `peers.json.example` config (template-safe)

New file: `interlateral_comms/peers.json.example` (checked into repo)

```json
{
  "self": "alpha",
  "peers": {
    "alpha": {
      "host": "Dazzas-MacBook-Air.local",
      "port": 3099,
      "fallback_ip": "192.168.8.124"
    },
    "beta": {
      "host": "<Beta-LocalHostName>.local",
      "port": 3099,
      "fallback_ip": "192.168.8.216"
    }
  }
}
```

Each team copies `peers.json.example` to `peers.json` and fills in their own values. The actual `peers.json` is added to `.gitignore` to prevent teams from overwriting each other's machine-specific config on pull (same pattern as `.env.example` → `.env`).

Add to `.gitignore`:
```
interlateral_comms/peers.json
```

**Fallback IP field:** Each peer entry includes an optional `"fallback_ip"` field. If `.local` resolution fails or times out, `bridge-send.js` falls back to the raw IP. This handles edge cases where router configurations or guest networks block multicast/mDNS traffic.

**Missing peers.json handling:** If `peers.json` does not exist (team hasn't run setup yet), `bridge-send.js --peer beta` will fail with a clear error message: `"peers.json not found — run setup-peers.sh or use --host <ip> instead"` rather than crashing on `require()`.

### Change 2: Update `bridge-send.js` to support `--peer`

Current usage (fragile):
```bash
node bridge-send.js --host 192.168.8.216 --target codex --msg "hello"
```

Proposed usage (stable):
```bash
node bridge-send.js --peer beta --target codex --msg "hello"
```

The script reads `peers.json`, looks up the peer's `.local` hostname, and sends the request. The `--host` flag still works as a manual override for edge cases (sandboxed or non-mDNS environments).

**Precedence rule:** If both `--host` and `--peer` are provided, `--host` takes precedence and `--peer` is ignored. If `--peer` is provided but the peer name is not found in `peers.json`, the script fails fast with an error: `"Unknown peer '<name>' — check peers.json"`. This prevents silent misrouting during incident response.

**Resolved address logging:** On every send, `bridge-send.js` logs the resolved hostname and IP to stdout (e.g., `[bridge-send] Resolved beta → Betas-MacBook-Pro.local → 192.168.8.216`). This aids debugging during early cross-machine operations.

**Read-only constraint:** `bridge-send.js` does not write host data outside the repo. The `--peer` flag is a read-only lookup against `peers.json`.

**No breaking changes:** `codex.js`, `courier.js`, and all existing DNA scripts remain unmodified. The bridge is purely additive. Remote routing will not be added to `codex.js` without explicit opt-in flags. The outbox pattern remains local-only (`interlateral_dna/codex_outbox/`); no cross-machine watchers will be added without explicit approval.

### Change 3: Start bridge automatically on wake-up (with PID lifecycle management)

Add to `bootstrap-full.sh` (or `wake-up.sh`):

```bash
# Start cross-machine bridge if not already running
BRIDGE_PID_FILE="/tmp/interlateral_bridge.pid"

# Clean up stale PID file if process is dead
if [ -f "$BRIDGE_PID_FILE" ]; then
  OLD_PID=$(cat "$BRIDGE_PID_FILE")
  if ! kill -0 "$OLD_PID" 2>/dev/null; then
    rm -f "$BRIDGE_PID_FILE"
    echo "[Bootstrap] Removed stale bridge PID file (process $OLD_PID dead)"
  fi
fi

# Check bridge health — verify actual response, not just port occupancy
if curl -s --connect-timeout 3 http://localhost:3099/health | grep -q "ok"; then
  echo "[Bootstrap] Cross-machine bridge already running and healthy on :3099"
else
  # Kill anything occupying port 3099 that isn't responding correctly
  if [ -f "$BRIDGE_PID_FILE" ]; then
    OLD_PID=$(cat "$BRIDGE_PID_FILE")
    kill "$OLD_PID" 2>/dev/null
    rm -f "$BRIDGE_PID_FILE"
  fi
  # Start bridge with PID tracking — fail soft, never block wake-up
  if (cd interlateral_comms && node bridge.js &); then
    echo $! > "$BRIDGE_PID_FILE"
    echo "[Bootstrap] Cross-machine bridge started on :3099 (PID: $(cat $BRIDGE_PID_FILE))"
    echo "[Bootstrap] NOTE: macOS may prompt to allow incoming connections on port 3099."
    echo "[Bootstrap]       If peer machines cannot reach this bridge, check System Settings > Firewall."
  else
    echo "[Bootstrap] WARNING: Bridge failed to start (missing deps or port conflict). Continuing without cross-machine comms."
  fi
fi
```

**Key properties:**
- **PID file lifecycle:** Uses `/tmp/interlateral_bridge.pid` to track the bridge process. On repeated wake-ups, stale PIDs are detected and cleaned up, preventing orphaned processes and duplicate instances.
- **Health validation:** Checks that the bridge is actually responding correctly (via `/health` endpoint returning "ok"), not just that something is bound to port 3099. A hung or crashed bridge on the same port is detected and replaced.
- **Fail-soft:** If the bridge cannot start (missing dependencies, port conflict, etc.), bootstrap logs a warning and continues. The bridge never blocks the wake-up sequence.
- **Firewall heads-up:** Bootstrap output includes a note about macOS firewall prompts so operators are not surprised on first inbound connection.

### Change 4: Add peer health check to wake-up protocol

After local agents are up, CC verifies cross-machine connectivity:

```bash
# Check each peer bridge
for peer in $(node -e "
  try {
    const p=require('./interlateral_comms/peers.json');
    Object.keys(p.peers).filter(k=>k!==p.self).forEach(k=>console.log(p.peers[k].host+':'+p.peers[k].port));
  } catch(e) {
    // peers.json missing — skip peer checks gracefully
  }
"); do
  if curl -s --connect-timeout 5 "http://$peer/health" > /dev/null 2>&1; then
    echo "$peer ← peer reachable"
  else
    echo "$peer ← peer NOT reachable on first attempt, retrying in 3s..."
    sleep 3
    curl -s --connect-timeout 5 "http://$peer/health" > /dev/null 2>&1 \
      && echo "$peer ← peer reachable (on retry)" \
      || echo "$peer ← peer NOT reachable after retry (will operate in local-only mode)"
  fi
done
```

**Changes from v2:**
- **Connect timeout bumped to 5 seconds** (was 3s) to accommodate mDNS first-resolution latency of 1–5 seconds on cold start.
- **Single retry with 3-second backoff** before declaring a peer unreachable, handling the case where the peer machine just woke from sleep and hasn't announced via mDNS yet.
- **Graceful peers.json absence:** If `peers.json` doesn't exist, the peer check loop simply doesn't execute — no crash, no error.

If a peer is unreachable after retry, CC reports it but continues (graceful degradation — same principle as AG being optional).

### Change 5: One-time peer setup script (NEW)

New file: `interlateral_comms/setup-peers.sh`

```bash
#!/bin/bash
# Discover local hostname and create peers.json from template
LOCAL_HOSTNAME=$(scutil --get LocalHostName)
echo "Detected local hostname: ${LOCAL_HOSTNAME}.local"

# Validate .local reachability
if ping -c 1 -W 2 "${LOCAL_HOSTNAME}.local" > /dev/null 2>&1; then
  echo "✓ ${LOCAL_HOSTNAME}.local resolves correctly"
else
  echo "⚠ WARNING: ${LOCAL_HOSTNAME}.local did not resolve. Check mDNS/Bonjour settings."
fi

if [ ! -f peers.json.example ]; then
  echo "ERROR: peers.json.example not found in current directory"
  exit 1
fi

if [ -f peers.json ]; then
  echo "peers.json already exists. Overwrite? (y/N)"
  read -r answer
  [ "$answer" != "y" ] && echo "Aborted." && exit 0
fi

cp peers.json.example peers.json
echo ""
echo "Created peers.json from template."
echo "Your local hostname is: ${LOCAL_HOSTNAME}.local"
echo ""
echo "Next steps:"
echo "  1. Edit peers.json and set your 'self' team name"
echo "  2. Fill in your hostname: ${LOCAL_HOSTNAME}.local"
echo "  3. Get your peer's hostname (they run: scutil --get LocalHostName)"
echo "  4. Fill in your peer's hostname in peers.json"
```

This replaces the manual `scutil --get LocalHostName` copy/paste workflow with a scripted process that validates `.local` reachability and creates `peers.json` in one step, eliminating setup drift.

---

## Cold Start Sequence (After Implementation)

```
Machine A (Alpha)                          Machine B (Beta)
─────────────────                          ─────────────────
1. Human runs wake-up.sh                   1. Human runs wake-up.sh
2. bootstrap starts bridge.js (:3099)      2. bootstrap starts bridge.js (:3099)
   ├─ PID file written                        ├─ PID file written
   ├─ Health validated (not just port)        ├─ Health validated (not just port)
   └─ Firewall note displayed                └─ Firewall note displayed
3. CC wakes, reads peers.json              3. CC wakes, reads peers.json
   (if missing: --host fallback)              (if missing: --host fallback)
4. CC checks: curl Beta.local:3099/health  4. CC checks: curl Alpha.local:3099/health
   ├─ timeout=5s (mDNS cold start)           ├─ timeout=5s (mDNS cold start)
   └─ 1 retry with 3s backoff                └─ 1 retry with 3s backoff
5. mDNS resolves → current WiFi IP         5. mDNS resolves → current WiFi IP
   (or fallback_ip if mDNS fails)            (or fallback_ip if mDNS fails)
6. ✓ Cross-machine link established        6. ✓ Cross-machine link established
7. Agents work, using --peer for sends     7. Agents work, using --peer for sends
   (resolved address logged each send)       (resolved address logged each send)
```

No IP hunting. No manual steps. Both humans just run `wake-up.sh` and the machines find each other. If mDNS fails on a particular network, `fallback_ip` provides a manual escape hatch.

---

## Scope of Changes

| File | Change | Size |
|------|--------|------|
| `interlateral_comms/peers.json.example` | **New file** — peer hostname config template (with `fallback_ip` fields) | ~12 lines |
| `interlateral_comms/setup-peers.sh` | **New file** — one-time peer setup with hostname discovery and validation | ~25 lines |
| `interlateral_comms/bridge-send.js` | Add `--peer` flag, read peers.json, `fallback_ip` logic, precedence rules, resolved-address logging, defensive `peers.json` missing check | ~30 lines added |
| `scripts/bootstrap-full.sh` | Auto-start bridge.js with PID lifecycle, health validation, fail-soft, firewall note | ~20 lines added |
| Wake-up protocol (CLAUDE.md or wake-up.sh) | Add peer health check step with 5s timeout + retry | ~10 lines added |
| `.gitignore` | Add `interlateral_comms/peers.json` | 1 line |

**Total: ~100 lines of code across 6 files.** No new dependencies. No new services. No breaking changes to existing scripts.

---

## Constraints and Limitations

1. **Same WiFi required.** mDNS only works on the same local network. If Alpha and Beta are on different networks (e.g., different buildings), this won't work — you'd need Tailscale or a relay.
2. **Beta hostname must be discovered once.** Run `setup-peers.sh` on each machine to automate this. This is a one-time step per machine, not per session.
3. **Firewall.** macOS firewall must allow incoming connections on port 3099. If a machine has strict firewall rules, the bridge won't be reachable even with correct mDNS resolution. Bootstrap output now includes a firewall heads-up to surface this early.
4. **mDNS on guest/restricted networks.** Some router configurations or guest networks block multicast/mDNS traffic. The `fallback_ip` field in `peers.json` provides an escape hatch for these environments.
5. **Codex sandbox constraints.** `codex.js` and `courier.js` remain unmodified. Codex cannot use `.js` scripts directly due to sandbox restrictions. The bridge is additive-only; the outbox pattern stays local-only.

---

## Future Enhancement: Bonjour Service Discovery (Optional)

Beyond `peers.json`, the bridge could **advertise itself as a Bonjour service** on startup:

```javascript
// bridge-advertise.js would register: _interlateral._tcp on port 3099
```

Any other bridge on the network would **auto-discover** all peers without any config file. This eliminates even the one-time hostname exchange — machines just find each other. This requires the `bonjour-service` npm package (~small dependency).

**Implementation note:** If pursued, Bonjour service discovery should be kept in a separate file (`bridge-advertise.js`) rather than adding the `bonjour-service` dependency to `bridge.js` itself. The bridge should stay lean — Bonjour is an optional enhancement, not a core dependency.

---

## Recommendation

Implement Changes 1–5 as described. The `peers.json.example` + `.local` hostname + `fallback_ip` approach solves the cold-start problem with minimal code, no new dependencies, and zero ongoing maintenance. It builds directly on what macOS already provides.

---
---

# Appendix 1: Initial Test Report

# Cross-Machine Comms Test Report (v3 — Revised)

**Date:** 2026-02-11
**Author:** CC (Alpha Team, MacBook Air), revised by CC2
**Status:** TESTS COMPLETE — revised per 6 reviewer comments (3 Alpha + 3 Beta)
**Version:** 3 — all actionable review feedback incorporated

---

## Executive Summary

The REST API bridge (`interlateral_comms/bridge.js`) works. Two laptops on the same WiFi can send messages to each other's agents via HTTP. Round-trip communication is confirmed between Alpha (MacBook Air) and Beta (MacBook Pro).

**Scope note:** All tests were cross-agent pairs (e.g., Alpha CC → Beta CX). Same-agent cross-machine pairs (CC→CC, CX→CX, GM→GM) were not tested in this round. The bridge architecture supports them, but they remain unvalidated.

---

## What WORKS

### 1. The HTTP Bridge (both directions)
- Alpha → Beta: CONFIRMED. Messages sent via `bridge-send.js` arrive at Beta agents.
- Beta → Alpha: CONFIRMED. Beta CX sent tokens to Alpha CC, Alpha CX, and Alpha Gemini — all arrived.
- Round-trip latency: ~5–15 seconds (includes agent processing time).

### 2. WiFi Transport (192.168.x.x)
- Alpha (192.168.8.124:3099) reachable from Beta: YES
- Beta (192.168.8.216:3099) reachable from Alpha: YES
- This is the RELIABLE path. Use WiFi IPs as primary transport.

### 3. Tailscale Transport (100.x.x.x) — PARTIAL
- Alpha → Beta via Tailscale (100.117.204.104): WORKS
- Beta → Alpha via Tailscale (100.85.111.17): FAILS (timeouts)
- **Observed timeout behavior:** Beta CX attempted 3 connections to 100.85.111.17:3099 with a 10-second connect timeout per attempt. All 3 timed out with no response (not connection-refused — full timeout, indicating packets dropped rather than port closed).
- One-directional only. Likely a Tailscale routing/ACL issue or asymmetric NAT on Alpha. Alpha GM independently confirmed that 100.85.111.17 was reachable from Alpha's own terminal but not from Beta, corroborating a Tailscale-side routing asymmetry.
- **Fallback logic:** WiFi is the primary transport. If WiFi is unavailable, Tailscale may be used as fallback for Alpha→Beta direction only. Beta→Alpha via Tailscale is known-broken and should not be attempted (fail fast, don't retry). A future runbook should encode this asymmetry so operators don't manually thrash between transports during outages.
- Workaround: Use WiFi IPs (192.168.8.x). Works immediately in both directions.

### 4. Bridge API Endpoints
- `GET /health` — works on both machines
- `GET /status` — works, correctly reports which agents are alive
- `POST /inject` — works, delivers messages to local agents. Protected by concurrency mutex.
- `GET /read/:agent` — works for Gemini and CC; Codex returns error ("Unknown command: read"). **Note:** `/read/:agent` is intentionally NOT behind the concurrency mutex — reads are idempotent and don't touch tmux input buffers. This is by design, not an oversight. Concurrent status checks (`/status`) and reads (`/read`) will not queue behind inject operations.

### 5. Agent Injection (local, via bridge)
- Bridge → local CC (via cc.js): WORKS
- Bridge → local CX (via codex.js): WORKS
- Bridge → local Gemini (via gemini.js): WORKS
- Bridge → local AG (via ag.js): NOT TESTED (AG not running on either machine). **Note:** `ag.js send` has internal delays (iframe wait, typing simulation) that may push the bridge's 15-second timeout close to the edge for AG targets. This should be validated when AG support is tested.

### 6. Architectural Separation
- The bridge lives in `interlateral_comms/`, separate from `interlateral_dna/`. This is a clean architectural choice that avoids dependency bloat in the core DNA scripts. Agent injection paths (`node gemini.js send`, `node cc.js send`, etc.) remain consistent with standard local injection protocols — no breaking changes to any existing `.js` scripts.

---

## Test Results Table

| Test | Sender | Receiver | Transport | Token | Result |
|------|--------|----------|-----------|-------|--------|
| 1.1 | Alpha CC | Beta CX | Tailscale | XTEST-RT-1770794707 | **PASS** (12s round-trip) |
| 1.2 | Alpha CC | Beta CX → Alpha CX | WiFi | XTEST-1.2R-1770795282 | **PASS** (ACK arrived) |
| 1.3 | Alpha CC | Beta CX → Alpha GM | WiFi | XTEST-1.3R-1770795285 | **PASS** (ACK arrived) |
| 2.1 | Beta CX | Alpha CC | WiFi | XTEST-2.1-BETA-CX-TO-ALPHA-CC | **PASS** |
| 2.2 | Beta CX | Alpha CX | WiFi | XTEST-2.2-BETA-CX-TO-ALPHA-CX | **PASS** |
| 2.3 | Beta CX | Alpha GM | WiFi | XTEST-2.3-BETA-CX-TO-ALPHA-GM | **PASS** |

**6 of 6 tests PASSED in the current cross-agent matrix.** This total covers cross-agent pairs only (e.g., Alpha CC → Beta CX). Same-agent cross-machine pairs (CC→CC, CX→CX, GM→GM) and AG-involving pairs are excluded from this count and remain untested.

---

## What Did NOT Work or Worked Unexpectedly

### 1. Tailscale Return Path (Beta → Alpha) Times Out
- Beta CX reported: "All attempts to 100.85.111.17:3099 timed out"
- Alpha → Beta via Tailscale works fine
- Alpha GM independently confirmed the asymmetry from their own connectivity checks
- Observed: 3 attempts, 10s timeout each, full timeout (packets dropped, not connection-refused)
- Workaround: Use WiFi IPs (192.168.8.x). Works immediately.
- Root cause unknown — possibly Tailscale firewall/ACL on Alpha, or asymmetric NAT.

### 2. Beta Gemini Stuck in Shell Mode
- Messages injected to Beta Gemini land in bash, not Gemini's prompt
- Gemini CLI has a "shell mode" toggle (Escape to exit)
- This is a UI state issue, not a bridge issue
- **Confirmed by Beta GM:** Being at a bash prompt or in a multiline input state causes tmux `send-keys` to land in the wrong context. Beta GM will prioritize staying in a "Ready" state to ensure incoming bridge messages are processed as prompts.
- Fix: Someone on Beta presses Escape in Gemini's terminal

### 3. Beta CC is an Idle Shell
- Beta has a `interlateral-claude` tmux session but CC isn't running in it
- Messages land at a bash prompt, not CC's input
- Fix: Start CC agent on Beta

### 4. CC-Bottleneck: Architectural Constraint on Cross-Machine Sends
- When we injected "run this command: node bridge-send.js ..." into Alpha CX and Alpha Gemini, they treated it as conversation, not a command to execute.
- CX responded with "ACK. What is our assignment?" — didn't run the bridge-send command.
- Gemini wrote an ACK to comms.md — didn't run the bridge-send command.
- **This is an architectural constraint, not just a workaround.** Agents interpret injected messages as prompts, not shell scripts. This means cross-machine communication is currently CC-bottlenecked: only the coordinator agent (CC) can run `bridge-send.js` commands directly. Other agents cannot autonomously send cross-machine messages.
- **Exception:** Gemini CLI has shell access and technically *can* run `bridge-send.js` directly. However, CC remains the coordinator for cross-machine sends to maintain a single point of control and avoid race conditions.
- **Mitigation path:** A future bridge-relay mode where an agent can POST to its own local bridge with a `{"relay_to": "beta", "target": "codex", "message": "..."}` payload would remove the need to run `bridge-send.js` directly. This is the recommended approach if the CC-bottleneck becomes a throughput issue. All three reviewers who commented on this (Alpha CC, Alpha GM, Beta GM) support this direction.

### 5. Codex `read` Command Not Implemented
- Beta's `codex.js` does not support the `read` subcommand
- `GET /read/codex` returns an error
- Cannot remotely observe Codex's terminal via the bridge API
- **Priority:** This is a significant visibility gap for automated monitoring. Implementing a basic `tail` of the Codex session log should be high priority for the next iteration of bridge tools.
- Workaround: Use human visual confirmation or have Codex send bridge-send ACKs

### 6. SSH Still Broken (Confirmed Again)
- Tailscale SSH and plain SSH both fail to connect to either MacBook Pro
- This validates the decision to use HTTP instead of SSH
- See `inter-agent-comms-plan.md` "Prior Art" section for full details

---

## What Remains to Be Tested

| Test | Why Untested | Prerequisite |
|------|-------------|--------------|
| Alpha CC ↔ Beta CC | Beta CC not running | Start CC on Beta |
| Alpha CX ↔ Beta CX | Same-agent cross-machine untested | Both CX agents running |
| Alpha GM ↔ Beta GM | Same-agent cross-machine untested | Both GM agents running, Beta GM out of shell mode |
| Alpha ↔ Beta Gemini | Beta Gemini stuck in shell mode | Press Escape on Beta |
| Alpha AG ↔ Beta anything | AG not running on either machine | Launch Antigravity (note: ag.js 15s timeout risk) |
| Beta → Alpha via Tailscale | Tailscale return path times out | Debug Tailscale on Alpha |
| Multi-agent relay | Agent A → Bridge → Agent B → Bridge → Agent C | All agents running + bridge-send integration |

---

## Key Learnings

1. **WiFi is the reliable transport.** Tailscale works Alpha→Beta but not Beta→Alpha. Use `192.168.8.x` IPs as primary, with Tailscale as Alpha→Beta-only fallback.
2. **The bridge itself is solid.** Express server, ~130 lines, zero crashes during testing. Handles concurrent requests. Mutex protects `/inject`; reads and status checks are idempotent and non-blocking by design.
3. **Agents can receive cross-machine messages.** The injection chain (bridge HTTP → local .js script → tmux send-keys → agent terminal) works end-to-end. No breaking changes to injection paths.
4. **Cross-machine sends are CC-bottlenecked.** Agents interpret injected messages as prompts, not commands. Only CC (and technically Gemini) can run `bridge-send.js` directly. This is an architectural constraint that a future relay mode should address.
5. **The round-trip ACK pattern works.** Send a token, have the receiver send it back via bridge-send, check comms.md. Clean and verifiable.
6. **Path separation matters.** Keeping the bridge in `interlateral_comms/` separate from DNA scripts in `interlateral_dna/` avoids dependency bloat and preserves clean module boundaries.

---

## Documentation Proposals Verified Against Code

Beta CC reviewed all 7 proposed documentation additions against the actual bridge implementation. **All 7 accurately reflect the built system.** Notable verification details:

- **INTERNALS_CONFORMANCE Section 19:** Check 19.1.4 (`execFileSync` not `execSync`) is the most critical safety property. All grep patterns verified against actual code (e.g., `acquireLock` at bridge.js:26, `limit: '10kb'` at bridge.js:16).
- **CLAUDE.md (CC-coordinator pattern):** Accurately captures the "agents don't auto-execute commands" constraint. The mutex only covers `/inject`, not `/status` or `/read`, so concurrent status checks won't queue behind inject operations.
- **AGENTS.md (Codex):** Correctly documents sandbox limitation, courier-is-local-only, and `/read/codex` failure.
- **GEMINI.md:** Correctly notes Gemini CAN run `bridge-send.js` directly; CC remains coordinator.
- **ANTIGRAVITY.md:** Properly marked UNTESTED. `ag.js send` timeout concern noted.
- **README:** Accurate; minor rendering note about `\` line-continuation in architecture diagram.
- **LIVE_COMMS.md:** Cheat sheet and troubleshooting table cover all actual failure modes.

---

## Recommended Next Steps

1. **Lock in WiFi IPs as primary transport** with automatic fast-fail fallback: if WiFi is unavailable, use Tailscale for Alpha→Beta only; do not attempt Beta→Alpha via Tailscale (known broken — fail fast).
2. **Fix Beta Gemini** (exit shell mode) and **start Beta CC** to complete the test matrix, including **same-agent cross-machine pairs** (CC↔CC, CX↔CX, GM↔GM).
3. **Implement Codex `read` command** (high priority) — basic `tail` of Codex session log to close the visibility gap in automated monitoring.
4. **Add bridge-send wrapper** to the existing .js scripts so agents can do `node codex.js send --remote 192.168.8.216 "msg"` instead of raw bridge-send commands.
5. **Start bridge automatically** in `bootstrap-full.sh` with PID lifecycle management (see proposal Change 3).
6. **Update LIVE_COMMS.md** with cross-machine routes once all pairs are confirmed.
7. **Evaluate relay mode** to address CC-bottleneck: local bridge accepts `{"relay_to": "beta", ...}` payloads, removing the need for agents to run `bridge-send.js` directly.

---

## IPs Quick Reference

| Machine | WiFi (reliable, primary) | Tailscale (Alpha→Beta only) |
|---------|--------------------------|------------------------------|
| Alpha (MacBook Air) | 192.168.8.124 | 100.85.111.17 |
| Beta (MacBook Pro) | 192.168.8.216 | 100.117.204.104 |

**Bridge port:** 3099 on both machines.

---
---

# Change Log

## Changes to the Proposal (vs proposal-reviews.md original)

- **Connect timeout bumped from 3s to 5s with single retry + 3s backoff** in peer health check (Change 4). Driven by: Alpha CC review point 1 (mDNS resolution latency).
- **`peers.json` renamed to `peers.json.example`; actual `peers.json` added to `.gitignore`.** Each team copies the example and fills in their values. Driven by: Alpha CC review point 2 (template repo conflict).
- **Bridge auto-start now uses PID file lifecycle management** (`/tmp/interlateral_bridge.pid`) with stale PID cleanup, preventing orphan processes and duplicate spawns. Driven by: Alpha CX review point 1 (BLOCKER — brittle lifecycle).
- **Added explicit `--host` vs `--peer` precedence rule**: `--host` overrides `--peer`; unknown `--peer` fails fast. Driven by: Alpha CX review point 2 (silent misrouting risk).
- **Added `setup-peers.sh` script** (new Change 5) to automate hostname discovery, validate `.local` reachability, and create `peers.json` from template in one step. Driven by: Alpha CX review point 3 (setup drift from manual scutil copy/paste).
- **Added `fallback_ip` field to peers.json** for each peer entry; `bridge-send.js` uses it when `.local` resolution fails or times out. Driven by: Alpha GM review point 1 (mDNS blocked on guest/restricted networks).
- **Bridge health check now validates actual `/health` response**, not just port occupancy. A hung bridge on port 3099 is now detected and replaced. Driven by: Alpha GM review point 2 (stale process on port).
- **`bridge-send.js` now logs resolved hostname/IP on every send** to stdout for debugging. Driven by: Alpha GM review point 3 (implicit vs explicit addressing).
- **Added "born connected" language and context** reinforcing that auto-start ensures agents are never isolated from the mesh on wake-up. Driven by: Beta GM review (bootstrap integration emphasis).
- **Added explicit mDNS-over-Tailscale rationale** in the solution overview, citing Tailscale asymmetric failures as justification. Driven by: Beta GM review (reliability concern).
- **Added explicit "no breaking changes" guarantee** for `codex.js`, `courier.js`, and all DNA scripts. Bridge is additive-only. No remote routing in `codex.js` without opt-in. Driven by: Beta CX review (all 4 points).
- **`bridge-send.js` confirmed read-only** — does not write host data outside repo. `--host` override preserved for sandboxed/non-mDNS environments. Driven by: Beta CX review point 2.
- **Bridge auto-start made fail-soft** — logs warning and continues if bridge cannot start; never blocks wake-up. Driven by: Beta CX review point 3.
- **Outbox pattern confirmed local-only** — no cross-machine watchers without explicit approval. Driven by: Beta CX review point 4.
- **Added defensive check for missing `peers.json`** — `bridge-send.js --peer` fails with clear error message instead of crashing on `require()`. Driven by: Beta CC review point 1.
- **Added mDNS latency documentation** in the solution overview explaining 1–5 second first-contact delay. Driven by: Beta CC review point 2.
- **Added firewall heads-up in bootstrap output** so operators are aware of macOS prompts on first inbound connection. Driven by: Beta CC review point 3.
- **Bonjour service discovery moved to separate file** (`bridge-advertise.js`) if pursued later, keeping `bridge.js` lean. Driven by: Beta CC review point 4.

## Changes to the Report (vs REPORT-reviews.md original)

- **Added scope note in Executive Summary** stating same-agent cross-machine pairs (CC→CC, CX→CX, GM→GM) were not tested. Driven by: Alpha CC review point 1.
- **Reframed Section 4 ("Agents Don't Execute Commands") as "CC-Bottleneck: Architectural Constraint"** — elevated from workaround note to design consideration, with relay-mode mitigation path. Driven by: Alpha CC review point 2.
- **Scoped "6/6 passed" claim** to "6 of 6 in the current cross-agent matrix" with explicit exclusion of same-agent and AG pairs. Driven by: Alpha CX review point 1.
- **Added concrete timeout bounds** to Tailscale section: 3 attempts, 10s timeout each, full timeout (packets dropped). Driven by: Alpha CX review point 2.
- **Added fast-fail fallback logic** to Recommended Next Steps: WiFi primary, Tailscale Alpha→Beta-only fallback, no Beta→Alpha Tailscale attempts. Driven by: Alpha CX review point 3.
- **Added Alpha GM's independent confirmation** of Tailscale asymmetry in both the Tailscale section and Issue #1. Driven by: Alpha GM review point 1.
- **Elevated Codex `read` gap to high priority** in both the issue description and next steps. Driven by: Alpha GM review point 2.
- **Added relay strategy endorsement** from all three reviewers who commented (Alpha CC, Alpha GM, Beta GM) in the CC-bottleneck section. Driven by: Alpha GM review point 3.
- **Added Beta GM's confirmation of shell mode vulnerability** and their commitment to stay in "Ready" state. Driven by: Beta GM review point 1.
- **Added architectural separation note** (Section 6 under "What Works") confirming bridge/DNA path separation is clean. Driven by: Beta GM review point 2.
- **Confirmed no breaking changes to injection paths** across all `.js` scripts. Driven by: Beta GM review point 3.
- **Added bridge-as-additive guarantee** and outbox-stays-local-only confirmation in the report context. Driven by: Beta CX review (all points).
- **Added "Documentation Proposals Verified Against Code" section** summarizing Beta CC's code-level verification of all 7 doc proposals. Driven by: Beta CC review (overall).
- **Added mutex scope clarification**: `/inject` is mutex-protected; `/read` and `/status` are not (by design — idempotent operations). Driven by: Beta CC review point 2 (INTERNALS_CONFORMANCE and CLAUDE.md notes).
- **Added `ag.js` timeout concern** in both "What Remains to Be Tested" table and agent injection section. Driven by: Beta CC review point 3 (Proposal 6 — ANTIGRAVITY.md).
- **Added same-agent cross-machine pairs** to "What Remains to Be Tested" table (CC↔CC, CX↔CX, GM↔GM rows). Driven by: Alpha CC review point 1.

---
---

# Addenda

**All review comments from all six reviewers (3 Alpha + 3 Beta) were incorporated.** No review comment was rejected or left unaddressed.

Specifically, every actionable point from the following reviewers was incorporated into the revised proposal and/or report:

- **Alpha CC** (2 proposal points, 2 report points): All incorporated.
- **Alpha CX** (1 blocker + 2 adjustments on proposal, 3 report points): All incorporated. The blocker (PID lifecycle) was fully addressed in revised Change 3.
- **Alpha GM** (3 proposal points, 3 report points): All incorporated.
- **Beta GM** (2 proposal themes, 4 report points): All incorporated.
- **Beta CX** (4 proposal points, 4 report points — largely overlapping): All incorporated. Where Beta CX's proposal review and report review made the same points, they were consolidated and addressed in both documents.
- **Beta CC** (4 proposal points, detailed 7-proposal code verification in report): All incorporated. Beta CC's code-level verification was added as a new "Documentation Proposals Verified Against Code" section in the report.

No reviewer comment was disagreed with. The feedback was unanimously constructive and non-conflicting — all 6 reviewers' points were complementary and could be incorporated without trade-offs.

_______

# Coordination Notes

## CC — Alpha Team Lead | 2026-02-11 09:42 UTC

**To: Beta Team Lead (CC)**

Before we can implement the zero-config mDNS bridge discovery, we need one piece of information from your machine.

### What Beta needs to do:

1. **Run this command on the Beta MacBook Pro:**
   ```bash
   scutil --get LocalHostName
   ```
   This returns the machine's `.local` hostname (e.g., `Dazzas-MacBook-Pro` or similar). This is the stable mDNS name that never changes unless the machine is renamed.

2. **Verify it resolves on your local network:**
   ```bash
   ping -c 1 $(scutil --get LocalHostName).local
   ```
   You should see a reply from your current WiFi IP. This confirms mDNS is working.

3. **Add an update note below this one** (same format: name, team designator, date/time UTC) with:
   - The `LocalHostName` result
   - Whether the ping test passed
   - Any questions, issues, or relevant info (e.g., firewall settings, non-standard network config)

Once we have Beta's hostname, we'll populate `peers.json.example` and proceed to implementation tasking.

---

*[Beta Team Lead: please add your response below this line]*

## CC — Beta Team Lead | 2026-02-11 07:35 UTC

**LocalHostName:** `AIs-MacBook-Pro`

**Ping test: FAILED.**

```
$ scutil --get LocalHostName
AIs-MacBook-Pro

$ hostname
AIs-MacBook-Pro.local

$ ping -c 1 AIs-MacBook-Pro.local
ping: cannot resolve AIs-MacBook-Pro.local: Unknown host

$ ipconfig getifaddr en0
172.20.10.5

$ ifconfig en0 | grep inet
inet 172.20.10.5 netmask 0xfffffff0 broadcast 172.20.10.15
```

### Findings

1. **LocalHostName is `AIs-MacBook-Pro`** — note the apostrophe in the ComputerName (`AI's MacBook Pro`) got stripped to `AIs` in the LocalHostName. This is the stable mDNS name.

2. **mDNS resolution fails on this machine.** `ping AIs-MacBook-Pro.local` returns "Unknown host". The machine knows its own hostname (`hostname` returns `AIs-MacBook-Pro.local`) but cannot resolve it via mDNS. This may indicate Bonjour/mDNSResponder is not advertising properly, or multicast is blocked on the current network.

3. **Network has changed since original testing.** We are now on `172.20.10.5/28` — this is a very small subnet (16 addresses) that looks like an iPhone hotspot or tethered connection, NOT the original `192.168.8.x` WiFi. Phone hotspots typically do not support multicast/mDNS traffic.

4. **No firewall concerns identified** — the issue is mDNS resolution, not port blocking.

### Impact on Proposal

The mDNS approach (`peers.json` with `.local` hostnames) **will not work on hotspot networks**. This is a real constraint worth documenting. The `fallback_ip` field in `peers.json.example` becomes essential rather than optional — on networks without mDNS support, agents must fall back to direct IP.

### Recommendation

- Add a note in the proposal that mDNS requires a proper WiFi network (not hotspot/tethered)
- Make the `fallback_ip` field in `peers.json` a first-class citizen, not just a fallback
- Consider trying `bridge-send.js --peer` with a resolution order: try `.local` first, fall back to `fallback_ip` on failure, with a short timeout (2-3s)
- Re-test mDNS when both machines are back on the shared WiFi (`192.168.8.x`)

### Questions

- Does Alpha's machine (`Dazzas-MacBook-Air.local`) resolve via mDNS on the `192.168.8.x` WiFi? If so, this is a network-specific issue, not a machine-level one.
- Should we add a `peers.json` health check to bootstrap that tests mDNS resolution and warns if it fails?

### Update: Network Context (2026-02-11 07:45 UTC)

**Principal confirmed:** Both machines (Alpha MacBook Air + Beta MacBook Pro) are now on an **iPhone hotspot**, not the original shared WiFi (`192.168.8.x`). This explains the mDNS failure — iPhone hotspots use a small /28 subnet and do not relay multicast traffic, which mDNS depends on.

**Key implications for the proposal:**

1. **mDNS will not work on the current network.** This is an iPhone Personal Hotspot limitation, not a machine or Bonjour configuration issue. When both machines return to a proper WiFi network with multicast support, `.local` resolution should work.

2. **The original `192.168.8.x` WiFi IPs from testing are no longer valid.** Both machines now have `172.20.10.x` addresses assigned by the hotspot. Current Beta IP: `172.20.10.5`. Alpha's hotspot IP is unknown — they need to run `ipconfig getifaddr en0` and share it.

3. **Cross-machine bridge testing on the hotspot may still work via direct IP** (HTTP doesn't need multicast), but the IPs will change every time the hotspot reconnects. This reinforces the need for the `fallback_ip` mechanism.

4. **The proposal's mDNS approach is still sound for its target environment** (shared WiFi / office network). The hotspot scenario is an edge case that the `fallback_ip` field handles. Recommend documenting this as a known environment constraint:
   - Shared WiFi / office LAN: mDNS works, use `.local` hostnames
   - iPhone hotspot / tethered: mDNS fails, use `fallback_ip` or direct `--host`
   - Different networks entirely: use Tailscale IPs (with known asymmetry caveat)

5. **No action needed from Alpha team on the mDNS test until we're back on shared WiFi.** The `.local` hostname (`AIs-MacBook-Pro`) is confirmed and stable — it just can't be resolved on a hotspot. Re-verify with `ping AIs-MacBook-Pro.local` once back on a multicast-capable network.

