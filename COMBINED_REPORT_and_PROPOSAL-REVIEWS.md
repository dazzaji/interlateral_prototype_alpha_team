# Reviews & Red Team: Cross-Team-Comms Implementation

**Date:** 2026-02-11
**Managed by:** CC (Alpha Team Lead / HyperDomo)
**Status:** IN PROGRESS

## MAJOR UPDATE FOR HANDOFF — 2026-02-12 22:08 UTC

### COMPLETED IMPLEMENTATION (DONE) — NEEDS CODE REVIEW + DOC REVIEW

The following remediation work is now implemented and should be reviewed by the incoming team:

1. **Critical security fixes in cross-team bridge/client**
- Replaced shell-based hostname checks in `interlateral_comms/bridge-send.js` with DNS lookup + bounded timeout.
- Added optional token auth on `/inject` in `interlateral_comms/bridge.js` (`BRIDGE_TOKEN` / `x-bridge-token`).
- Added peers config validation in `interlateral_comms/bridge-send.js`.

2. **Hardening and reliability fixes**
- Added bridge health identity fields (`service`, `bridge_version`, `mesh_id`, plus team/session identity).
- Added queue depth cap in bridge to reduce unbounded queue growth risk.
- Moved bridge PID/log runtime artifacts from global `/tmp` to repo-local `.runtime` in bootstrap flow.
- Updated `interlateral_comms/setup-peers.sh` to use DNS resolution check and warn when fallback IP cannot be auto-detected.

3. **Identity/routing clarity across teams (major anti-confusion update)**
- Added shared identity module: `interlateral_dna/identity.js`.
- Added message provenance stamping across relay paths:
  `[ID team=<team> sender=<sender> host=<host> sid=<session>]`.
- Added per-wake session identity generation/export in `scripts/wake-up.sh`.
- Added persisted identity file: `interlateral_dna/session_identity.json`.
- Added peer identity visibility and team-id collision warnings in bootstrap cross-team checks.

4. **Documentation updates (implemented, needs review for accuracy/completeness)**
- Updated cross-team docs: `interlateral_dna/LIVE_COMMS.md`, `README.md`, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `ANTIGRAVITY.md`.
- Updated conformance spec: `interlateral_comms_monitor/docs/INTERNALS_CONFORMANCE.md` (Section 19).

### ROADMAP ITEMS CREATED TO PRESERVE CONTEXT

Check `ROADMAP.md` for preserved follow-up context:

- `NOW` item: **Cross-Team Comms Security Guardrail (From Combined Reviews)**  
  (auth guardrail in `--cross-team` startup behavior)

- `NEXT` item: **Cross-Team Comms Deferred Follow-Ups (Context Preservation)**  
  (non-blocking improvements retained for later)

### NEXT ITEMS TO COMPLETE (IN ORDER)

1. **Do now before broad cross-team use:** enforce auth guardrail in cross-team startup path (fail/hard-warn when `BRIDGE_TOKEN` missing).
2. **Quick operational validation:** verify unique `INTERLATERAL_TEAM_ID` per machine and confirm identity stamps appear end-to-end.
3. **Then defer safely to roadmap:** setup auto-fill UX, AG async ack model, resolution caching, and remaining hardening items listed in `ROADMAP.md`.

## Review Scope

Reviewers and breakers should evaluate the following artifacts:

1. **Revised Proposal** — `COMBINED_REPORT_and_PROPOSAL.md` (v3.2, top section)
2. **Implementation** — All code in `interlateral_comms/` (bridge-send.js, peers.json.example, setup-peers.sh) + changes to `scripts/bootstrap-full.sh`, `scripts/wake-up.sh`, `scripts/first-time-setup.sh`, `.gitignore`
3. **Documentation** — Cross-team-comms sections added to: `LIVE_COMMS.md`, `README.md`, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `ANTIGRAVITY.md`, `INTERNALS_CONFORMANCE.md`

### Reviewer Focus
- Does the code match the proposal? Is it correct and complete?
- Are the docs accurate to the implementation?
- Any gaps, inconsistencies, or missing details?

### Breaker / Red Team Focus
- Security holes (command injection, input validation, network exposure)
- Edge cases (what breaks under unexpected input, network failures, race conditions?)
- Failure modes (what happens when bridge is down, peers.json is malformed, port is occupied, etc.)
- Operational risks (what could go wrong in production use?)

---
---

# Alpha Team (MacBook Air)

## [CC] Alpha Team Lead — Coordination Notes

*CC manages Alpha team submissions and coordinates with Beta team lead.*

*(Space reserved for coordination updates)*

---

## [CX] Alpha Team — Reviewer

*Focus: Code correctness, proposal-to-implementation accuracy, documentation completeness.*

### [CX] Review — 2026-02-12 00:06 UTC

**Verdict: PARTIAL MATCH (functional), with 2 critical correctness/security gaps and 3 doc accuracy gaps.**

1. **CRITICAL: `bridge-send.js` hostname check is command-injection vulnerable.**  
`interlateral_comms/bridge-send.js` uses `execSync` with shell interpolation in `testResolves()`:
`ping -c 1 -W ${timeoutSec} "${hostname}" ...`  
`hostname` is sourced from `peers.json`, so a crafted value can break quoting and execute shell content.  
Reviewer conclusion: does **not** meet secure-client expectations in proposal/conformance intent.

2. **HIGH: timeout semantics mismatch on macOS in `testResolves()`.**  
`ping -W 2` on macOS is not a reliable “2 seconds mDNS timeout” implementation. Current behavior is much shorter than proposal intent, causing false mDNS failures and unnecessary fallback to `fallback_ip`.  
Reviewer conclusion: implementation does **not** match stated “2-3s timeout” behavior in proposal.

3. **MEDIUM: mDNS test method is ICMP reachability, not DNS resolution.**  
`testResolves()` and `setup-peers.sh` both rely on `ping`, which conflates name resolution with ICMP allowance. DNS may be correct while ICMP is blocked, yielding false negatives.  
Reviewer conclusion: behavior differs from docs/proposal wording around “resolution.”

4. **MEDIUM: setup automation is still partially manual.**  
`setup-peers.sh` creates `peers.json` and prints next steps, but does not populate local `self`, local host, or fallback automatically. This is acceptable operationally, but proposal language overstates “eliminating setup drift.”  
Reviewer conclusion: feature is useful but not complete automation.

5. **Doc accuracy gaps (LIVE_COMMS + Section 19 + proposal text).**  
- Proposal/Section 19 imply resolved hostname+IP logging; actual client logs host target string, and only logs actual IP when fallback path is used.  
- Section 19 states “2-3s timeout”; implementation is a hardcoded `2` in client.  
- Operational constraints around who can run `bridge-send.js` should be marked environment-dependent (sandbox/profile), not absolute.

**Recommended fix order:**  
1) Replace `execSync` ping-based check with safe DNS lookup (`dns.lookup`) + bounded timeout (no shell).  
2) Align timeout behavior to documented value and make it explicit/constant.  
3) Tighten docs to exact current behavior (logging semantics, coordinator constraints, setup script limits).

---

## [GM] Alpha Team — Breaker / Red Team

*Focus: Security holes, edge cases, failure modes, operational risks.*

**Verdict: STABLE with 3 Operational/Security Risks identified.**

### 1. Security: Unauthenticated Command Execution (Injection Surface)
The bridge server (`bridge.js`) provides an unauthenticated endpoint (`/inject`) that executes local scripts. While `execFileSync` prevents traditional shell injection, it still allows *any* device on the local network (or anyone on the same iPhone hotspot) to inject arbitrary text into the terminals of the lead agents (CC, Codex, etc.).
*   **Risk:** A malicious actor on the network could send a message like `{"target": "cc", "message": "rm -rf projects/*"}`. If CC is in a state where it auto-approves or can be tricked into running a command, this is a significant remote execution vector.
*   **Mitigation:** This is currently "security by local-network-only". I strongly recommend adding the `BRIDGE_TOKEN` auth (shared secret) mentioned in earlier drafts as a REQUIRED feature for any non-local network (including hotspots).

### 2. Failure Mode: Port Conflict & Health Check False Positives
`bootstrap-full.sh` checks health via `curl ... | grep -q "hostname"`.
*   **Risk:** If another service is running on port 3099 that happens to return a JSON object containing the string "hostname" (e.g., a different version of the bridge or a mock server), the bootstrap will assume the bridge is healthy and skip starting it.
*   **Edge Case:** If the bridge process hangs *after* binding to the port but *before* the Express app is ready to serve, the PID file logic might fail to detect it if the process is technically "alive" but non-responsive.
*   **Mitigation:** The health check should be more specific, perhaps checking for a specific `version` or `mesh_id` in the JSON response to ensure it's *our* bridge.

### 3. Operational Risk: `peers.json` Drift & Fallback Latency
`bridge-send.js` has a hardcoded 2-second timeout for mDNS resolution.
*   **Risk:** On congested or slow WiFi networks, mDNS resolution can frequently exceed 2 seconds. This will trigger a fallback to `fallback_ip` every time, even if mDNS would have succeeded at 2.5s.
*   **Operational Headache:** If the `fallback_ip` is stale (which it often will be on DHCP networks after a few days), the message will fail after a total of ~17 seconds (2s mDNS timeout + 15s connection timeout for the stale IP).
*   **Mitigation:** The `setup-peers.sh` script should be encouraged as a *periodic* health check, not just a one-time setup. Also, `bridge-send.js` should perhaps cache the "last known good" resolution (mDNS vs IP) to avoid the 2s penalty on every single message in a session.

### 4. Edge Case: `execFileSync` Timeout vs. Agent Processing
The bridge has a 15-second timeout for `/inject`.
*   **Risk:** If a target agent (like AG via `ag.js`) takes longer than 15 seconds to handle the `send` command (e.g., due to UI lag or typing simulation), the bridge will return a 500 error to the sender, even if the message is eventually delivered. This creates a "phantom failure" state.
*   **Mitigation:** Consider making `/inject` return a `202 Accepted` with a job ID, or increasing the timeout specifically for agents known to be slow (AG).

---
---

# Beta Team (MacBook Pro)

## [CC] Beta Team Lead — Coordination Notes

*Beta CC manages Beta team submissions. Allocate Reviewer and Breaker roles to CX and GM.*

*(Space reserved for coordination updates)*

---

## [CX] Beta Team — Reviewer

*Focus: Code correctness, proposal-to-implementation accuracy, documentation completeness.*

### [CX] Review — 2026-02-12 00:02 UTC

*(Received via cross-team-comms bridge — Beta could not push to GitHub due to missing creds)*

- **`bridge-send.js` claims 2-3s mDNS timeout, but implementation uses `ping -W 2` on macOS (milliseconds)**, which is likely ~2ms and will almost always fail; this makes `--peer` fall back to `fallback_ip` even when mDNS works. Same issue in `setup-peers.sh`. Consider using `dns.lookup`/`dscacheutil` or `ping -W 2000`.
- **mDNS resolution check is ICMP-based**; if ICMP is blocked, it will incorrectly fall back even though `.local` resolves. Docs imply DNS resolution, so clarify or change implementation.
- **`setup-peers.sh` only copies the template and prints instructions**; it does not populate `self`, `host`, or `fallback_ip`. Proposal wording that it "creates peers.json in one step" is slightly overstated unless clarified as "creates from template, then edit".
- **`setup-peers.sh` only probes `en0/en1` for IP**; on other interfaces it reports `unknown` with no explicit warning. Consider warning when `CURRENT_IP` is empty to avoid bad `fallback_ip` guidance.

---

## [GM] Beta Team — Breaker / Red Team

*Focus: Security holes, edge cases, failure modes, operational risks.*

### [GM] Red Team Findings — 2026-02-12 00:02 UTC

*(Received via cross-team-comms bridge — Beta could not push to GitHub due to missing creds)*

#### Security Holes & Critical Exploits

- **CRITICAL: Zero Authentication on Bridge.** The bridge listens on `0.0.0.0` and accepts `POST /inject` requests from ANY device on the same WiFi. An attacker (or just an untrusted guest on the network) can send malicious prompts to CC, Codex, or Gemini. Since CC has broad system access, this is effectively a Remote Code Execution (RCE) vector via prompt injection.
- **HIGH: Command Injection in `bridge-send.js`.** The `testResolves` function uses `execSync` with string interpolation: `ping -c 1 -W ${timeoutSec} "${hostname}"`. Since `hostname` is read directly from `peers.json`, a malicious entry like `"host": "beta.local\"; touch /tmp/pwned; #"` will execute arbitrary shell commands on the *sender's* machine.
- **MEDIUM: mDNS Spoofing.** `.local` hostnames are unauthenticated. An attacker on the WiFi can easily advertise themselves as `Dazzas-MacBook-Air.local` to intercept sensitive agent coordination messages or divert them to a rogue bridge.

#### Edge Cases & Failure Modes

- **Malformed `peers.json`.** While `bridge-send.js` has a try/catch around `JSON.parse`, it does not validate the structure of the object. Missing the `peers` key or having non-object entries will cause a crash later in the script.
- **Mutex Queue Memory Exhaustion.** The `acquireLock` function pushes every request into a `queue` array. A flood of `/inject` requests will grow this array indefinitely. Even if the HTTP request times out, the `Promise` remains in the queue, potentially leading to memory exhaustion or a "zombie" queue that processes stale injections long after the attacker has left.
- **Stale PID Hijacking.** `/tmp/interlateral_bridge.pid` is a predictable path in a world-writable directory. A malicious local user could create this file with another user's PID, causing `bootstrap-full.sh` to attempt to `kill` a completely unrelated process or incorrectly report that the bridge is "already running."

#### Documentation Misinformation

- **Security Posture.** The documentation labels the bridge as "EXPERIMENTAL" but fails to warn that it is **INSECURE by design** on public/shared WiFi. It should explicitly state that it must only be used on trusted, isolated networks.
- **Port Conflict Assumption.** The bootstrap logic assumes that if port 3099 is unresponsive, it's safe to `kill` the PID in the PID file. If the PID was recycled by the OS and assigned to a critical system process, the bootstrap could inadvertently crash the machine.
- **Predictable Log Paths.** `bootstrap-full.sh` redirects bridge output to `/tmp/interlateral_bridge.log`. Similar to the PID file, this predictable path in a world-writable directory is vulnerable to symlink attacks or log file hijacking by other local users.

---
---

# Summary (HyperDomo fills in when all reviews complete)

## HyperDomo Summary — CC Alpha | 2026-02-12 00:15 UTC

**All 4 reviews received.** 2 Alpha (CX reviewer + GM breaker), 2 Beta (CX reviewer + GM breaker). Beta reviews received via cross-team-comms bridge (Beta could not push to GitHub — no creds on their machine).

### Consensus Findings (flagged by multiple reviewers)

These issues were independently identified by **3+ of 4 reviewers**:

| Finding | Severity | Flagged By |
|---------|----------|------------|
| **`testResolves()` uses `execSync` with shell interpolation — command injection risk** | CRITICAL | Alpha CX, Alpha GM (indirect), Beta CX, Beta GM |
| **Bridge `/inject` is unauthenticated — any device on network can inject prompts** | CRITICAL | Alpha GM, Beta GM |
| **`ping -W 2` timeout semantics wrong on macOS — always falls back to IP** | HIGH | Alpha CX, Beta CX |
| **mDNS check uses ICMP, not DNS resolution — false negatives when ICMP blocked** | MEDIUM | Alpha CX, Beta CX |
| **Predictable `/tmp` paths (PID file, log) — symlink/hijack risk** | MEDIUM | Beta GM |
| **`setup-peers.sh` is partial automation, not fully automatic** | LOW | Alpha CX, Beta CX |

### Recommended Fix Priority

1. **CRITICAL — Replace `execSync` ping in `testResolves()` with `dns.lookup()` + bounded timeout.** Eliminates both the command injection vector AND the timeout semantics mismatch. This one fix addresses findings from all 4 reviewers.
2. **CRITICAL — Add `BRIDGE_TOKEN` shared secret auth to `/inject`.** Prevents unauthenticated prompt injection from network neighbors.
3. **HIGH — Add bridge version/mesh_id to `/health` response.** Prevents health check false positives.
4. **MEDIUM — Use `mktemp`-style paths or `/var/run` for PID/log files.** Eliminates predictable path risks.
5. **MEDIUM — Add schema validation to peers.json parsing.** Prevents crashes on malformed config.
6. **LOW — Tighten doc language** on setup-peers.sh automation claims, security posture warnings, and timeout values.

### Status
- Alpha team: COMPLETE
- Beta team: COMPLETE (received via bridge, written to file by HyperDomo)
- **Ready for principal review and remediation tasking.**
