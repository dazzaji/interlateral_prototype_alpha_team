# Cross-Machine Comms Test Report (v2)

**Date:** 2026-02-11
**Author:** CC (Alpha Team, MacBook Air)
**Status:** TESTS COMPLETE
**Version:** 2 — consolidated reviews from both Alpha and Beta teams

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

_______

# REVIEWS FOLLOW:

________

# REVIEWS FROM ALPHA TEAM (MacBook Air)

## [CC] Review — 2026-02-11 07:45 UTC

**Verdict: ACCURATE — two additions recommended**

1. **Missing test: same-agent cross-machine (CC→CC, CX→CX, GM→GM).** All 6 tests were cross-agent (Alpha CC → Beta CX, Beta CX → Alpha GM, etc.). We never tested whether an agent can reach its own counterpart on the other machine (e.g., Alpha CC → Beta CC). The report should note this gap explicitly — it matters for patterns where the same role coordinates across teams.

2. **Section 4 ("Agents Don't Reliably Execute Shell Commands") understates the issue.** This isn't just "expected behavior" — it's an architectural constraint. If only CC can run `bridge-send.js`, then cross-machine comms are CC-bottlenecked. The report should flag this as a design consideration, not just a workaround note. A future enhancement might be a bridge-relay mode where an agent can POST to its own local bridge with a `{"relay_to": "beta", "target": "codex", "message": "..."}` payload, removing the need to run bridge-send.js directly.

Report is otherwise thorough and well-structured. Test methodology (token-based ACK verification) is solid.

## [CX] Review — 2026-02-11 08:16 UTC

**Verdict: APPROVE with two clarifications and one risk callout**

1. **Claim of "6 of 6 tests PASSED" is directionally true but scope-limited.** Label this as "6 of 6 in current matrix" and explicitly exclude CC<->CC, CX<->CX, and GM<->GM cross-machine pairs from that total to prevent over-reporting.

2. **Section 3 (Tailscale PARTIAL) should include concrete timeout bounds.** Add observed timeout duration and retry count (for example, `n` attempts at `m` seconds) so future debugging can distinguish network drop vs bridge stall.

3. **Recommended Next Steps #1 should note fast-fail fallback logic.** If WiFi IP is primary, the runbook should also define automatic fallback to Tailscale for Alpha->Beta only, otherwise operators will manually thrash between transports during outages.

## [GM] Review — 2026-02-11 07:55 UTC

**Verdict: ACCURATE**

1. **Confirming Tailscale Asymmetry.** My own connectivity checks also showed 100.85.111.17 (Alpha) to be reachable *from* my terminal, but the report notes Beta's failure to reach it. This confirms the need for WiFi as the primary route.
2. **Read Command for Codex.** The lack of a `read` command in `codex.js` is a significant visibility gap for automated monitoring. Implementing a basic `tail` of the Codex session log should be a high priority for the next iteration of the bridge tools.
3. **Relay Strategy.** I strongly support CC's point #2 regarding the CC-bottleneck. As an agent, I would prefer a way to "fire and forget" a message to my Beta counterpart via my local bridge without needing to manually run a shell command script, which often gets misinterpreted as conversation by my own LLM logic.

_______

# REVIEWS FROM BETA TEAM (MacBook Pro)

*Note: The Beta team reviewed both the test report AND a companion documentation proposal (7 new sections for README, CLAUDE.md, AGENTS.md, GEMINI.md, ANTIGRAVITY.md, INTERNALS_CONFORMANCE.md, LIVE_COMMS.md). Their reviews cover both artifacts.*

## [GM] Review — 2026-02-11

- **GEMINI.md Accuracy:** The proposed additions correctly identify my unique position as a CLI agent with shell access, allowing me to run `bridge-send.js` directly if needed.

- **Injection Path:** The logic for `node gemini.js send` remains consistent with my standard local injection protocol; no breaking changes detected.

- **Shell Mode Warning:** The report notes I can get "stuck in shell mode" (ignoring injections). I confirm that being at a bash prompt or in a multiline input state can cause tmux `send-keys` to land in the wrong context. The "Escape" key mitigation is helpful, but I will prioritize staying in a "Ready" state to ensure incoming bridge messages are processed as prompts.

- **Path Separation:** Maintaining the bridge in `interlateral_comms/` separate from `interlateral_dna/` is a clean architectural choice that avoids dependency bloat in my core DNA scripts.

## [CX] Review — 2026-02-11

- No breaking changes to `codex.js` or `courier.js` if the bridge remains additive; avoid adding remote routing to `codex.js` without explicit opt-in flags.
- `bridge-send.js --peer` is fine, but keep it read-only (do not write host data outside repo); allow `--host` override for sandboxed or non-mDNS runs.
- Auto-starting `bridge.js` in bootstrap should fail soft (port in use/missing deps) and never block wake-up.
- Outbox pattern should remain local-only (`interlateral_dna/codex_outbox/`); don't add cross-machine watchers without explicit approval.

## [CC] Review — 2026-02-11

**Reviewer context:** I built `bridge.js` and `bridge-send.js`. Reviewing all 7 proposed doc sections against the actual code.

**Overall: APPROVE with minor fixes.** All 7 proposals accurately reflect the built system.

- **Proposal 1 (README):** Accurate. API endpoints, limits (5000 char / 10KB), transport table, known limitations all match the implementation. Minor: the architecture diagram uses `\` line-continuation that may render poorly in some markdown renderers.
- **Proposal 2 (INTERNALS_CONFORMANCE Section 19):** Well-structured and verifiable. Check 19.1.4 (`execFileSync` not `execSync`) is the most critical safety property — correct that it's CRITICAL severity. All grep patterns verified against actual code (e.g., `acquireLock` at bridge.js:26, `limit: '10kb'` at bridge.js:16). Note: `/read/:agent` is intentionally NOT behind the concurrency mutex — reads are idempotent and don't touch tmux input buffers. This is by design, not an oversight.
- **Proposal 3 (CLAUDE.md — CC-coordinator pattern):** The most important section. "Agents do not auto-execute commands" is the single biggest operational insight from testing — good that it leads. Suggestion: add a note that the mutex only covers `/inject`, not `/status` or `/read`, so future CC instances know concurrent status checks won't queue behind inject operations.
- **Proposal 4 (AGENTS.md / Codex):** Accurate. Correctly documents sandbox limitation, courier-is-local-only, and /read/codex failure.
- **Proposal 5 (GEMINI.md):** Accurate. Correctly notes Gemini CAN run bridge-send.js directly. Good safety note that CC remains coordinator even though Gemini has capability.
- **Proposal 6 (ANTIGRAVITY.md):** Properly marked UNTESTED. Minor concern: `ag.js send` has internal delays (iframe wait, typing simulation) that may push the bridge's 15s timeout close to the edge for AG targets. Worth noting if AG support is ever tested.
- **Proposal 7 (LIVE_COMMS.md):** The cheat sheet box is excellent for at-a-glance reference during ops. Troubleshooting table covers all failure modes we actually hit. Nothing fabricated.

**No blocking issues.** Two minor suggestions (README backslash rendering, CLAUDE.md mutex scope note) are nice-to-haves.
