# Prototype Review (Codex)

## TOP PRIORITY OUTSTANDING ITEMS (Post-Review Gate)

This section is intentionally placed at the top as the immediate post-review action list.
It reflects issues identified during the latest multi-agent review cycle (Codex + CC + Gemini)
after implementing shutdown hardening and Gemini startup reliability fixes.

### 1) Remove Dead Logic in `scripts/bootstrap-full.sh` (Maintainability P1)

**What remains:**  
The CC-pane node detection block in `scripts/bootstrap-full.sh` (around lines 182-207)
computes `CC_PANE_PATH`, `PANE_PID`, and `LIVE_NODE`, but the script then unconditionally resets
the CC tmux session immediately afterward. This means the detection result is not used for control flow.

**Why this matters:**  
- Creates cognitive overhead for future maintainers (looks operational but is effectively dead).  
- Increases risk of future regressions if someone assumes that branch has behavioral effect.  
- Slows incident triage because it suggests non-existent conditional behavior.

**What this relates to:**  
- Startup reliability and clarity of wake-up orchestration.  
- Review finding from CC during final approval gate.

**Recommended action:**  
- Remove the dead block, or wire it into actual branching logic if intended.
- Prefer removal unless there is a confirmed near-term use case.

---

### 2) De-duplicate Shutdown Script Logic (`shutdown.sh` vs `shutdown-no-ag.sh`) (Maintainability P1)

**What remains:**  
Both scripts contain heavily overlapping logic (tmux teardown loop, process kill helpers,
port cleanup routines, socket cleanup, post-shutdown status reporting). Current drift risk is high
because improvements to one script can be missed in the other.

**Why this matters:**  
- Increases long-term maintenance cost and review burden.  
- Raises probability of behavior skew between no-AG and quad-mode shutdown.  
- Makes public-release hardening harder because bug fixes must be manually mirrored.

**What this relates to:**  
- Public-release robustness for operational scripts.  
- Review findings from CC and Codex on maintainability risk.

**Recommended action:**  
- Extract shared code into one internal helper (e.g., `scripts/shutdown-common.sh` or sourced functions)
  and keep only mode-specific deltas in the two entrypoint scripts.

---

### 3) Add Wake-Up + ACK Smoke Test (Reliability P0/P1 Bridge)

**What remains:**  
There is no automated guardrail that verifies the expected operational outcome:
running wake-up with an ACK protocol prompt should produce deterministic state
(`CC/Codex/Gemini online`, plus explicit ACK completion state or degraded-state declaration).

**Why this matters:**  
- Gemini startup can degrade due to model preflight/runtime instability.  
- Without a smoke test, regressions reappear silently and are discovered only during manual ops.

**What this relates to:**  
- Gemini Startup Reliability P0 section below (model preflight failures, runtime instability,
  and partial ACK completion risk).  
- End-to-end operator trust for "one-command wake-up" UX.

**Recommended action:**  
- Add a non-destructive CI/local smoke test script that:
  1) runs no-AG wake-up with a deterministic prompt,  
  2) checks tmux sessions + status endpoints,  
  3) validates comms contains ACK result state (`ALL_ACKED`, `PARTIAL_ACKED`, or `DEGRADED_GEMINI`).

---

### 4) Explicit Gemini Degraded-State Semantics in Logs/Comms (Reliability P0)

**What remains:**  
Gemini bootstrap fallback now avoids hard failure by starting degraded mode when model preflight fails.
However, operators still need a consistently machine-readable degraded-state marker in `comms.md`
and final summaries (not just console lines) to avoid ambiguity during active coordination.

**Why this matters:**  
- Prevents confusion about whether Gemini is healthy, degraded, or absent.  
- Enables automation to react correctly (retry, proceed degraded, or halt).

**What this relates to:**  
- Gemini Startup Reliability P0 acceptance criteria.  
- Reliable ACK protocol and runbook behavior in real sessions.

**Recommended action:**  
- Emit a structured degraded-state line into `comms.md` and final status output whenever fallback mode is used.

---

## 1) What This Project Is and How It Is Intended To Work

This repository is a multi-agent coordination platform intended to run a **quad-agent mesh** of:
1. Claude Code (CC)
2. Codex
3. Gemini CLI
4. Antigravity (AG)

Core intent:
- Start all agents with one wake-up command (`scripts/wake-up.sh`).
- Enable real-time inter-agent messaging through direct channels (`interlateral_dna/cc.js`, `interlateral_dna/codex.js`, `interlateral_dna/gemini.js`, `interlateral_dna/ag.js`).
- Persist communication and telemetry to shared logs (`interlateral_dna/comms.md`, `interlateral_dna/ag_log.md`, telemetry logs).
- Visualize and inject commands via a web dashboard (`interlateral_comms_monitor`).
- Support long-horizon, structured collaboration through skills and role protocols in repo docs.

Operational model:
1. Bootstrap spins up AG CDP, dashboard services, and tmux sessions (`scripts/bootstrap-full.sh`).
2. Agents communicate directly via tmux/CDP and also log to `comms.md` for auditability.
3. Watchers parse streams and push normalized events over WebSocket to the UI.
4. Humans monitor, inject, and export session data for observability/evals.

## 2) Supported Use Cases, Workflows, Features, Capabilities

### Primary Use Cases
1. Multi-agent software delivery with defined roles (drafter/reviewer/breaker, etc.).
2. Human-supervised autonomous execution across multiple agent CLIs.
3. Session observability, event export, and post-run evaluation.
4. Cross-agent handoffs and approvals through a shared comms protocol.

### Current Workflows
1. **Wake-up/bootstrapping**
- Human runs `scripts/wake-up.sh`.
- Script calls `scripts/bootstrap-full.sh`, starts infra, prepares comms files, launches CC.

2. **Agent-to-agent communication**
- tmux-based channels for CC/Codex/Gemini via `interlateral_dna/*.js` wrappers.
- CDP-based channel for AG via `interlateral_dna/ag.js`.
- Permanent record in `interlateral_dna/comms.md`.

3. **Monitoring and command injection**
- Backend watches streams and emits events via WebSocket (`interlateral_comms_monitor/server`).
- UI provides skins + command input + navigation/export (`interlateral_comms_monitor/ui`).

4. **Evaluation pipeline**
- Captured logs/telemetry feed eval packs in `corpbot_agent_evals/`.

### Feature/Capability Inventory
- One-command startup orchestration.
- Shared tmux socket convention (`/tmp/interlateral-tmux.sock`) for consistent cross-agent injection.
- Direct messaging wrappers for CC, Codex, Gemini, AG.
- Dashboard backend with stream watching, history endpoint, and injection endpoint.
- Frontend with pluggable skins, live event feed, history loading, and command composer.
- Telemetry persistence and event JSONL capture in `.observability`.
- Structured agent role/process docs and skills.

## 3) Deep Code Review: Breaking Changes

### BC-1: Comms Monitor Cannot Target Gemini CLI
- Severity: Critical (for your stated requirement).
- Problem: The dashboard injection API and UI do not support `gemini` as a target.
- Evidence:
  - `interlateral_comms_monitor/server/index.js:66`
  - `interlateral_comms_monitor/server/inject.js:317`
  - `interlateral_comms_monitor/ui/src/components/CommandInput.tsx:3`
- Root cause: Gemini support exists in `interlateral_dna/gemini.js` but was never wired into monitor backend/UI routing.
- Impact: Your required tri-CLI network (Claude Code + Codex + Gemini CLI) is not fully operable from the monitor UX.
- Suggested solution:
  1. Add `injectToGemini()` in `interlateral_comms_monitor/server/inject.js` (spawn `node interlateral_dna/gemini.js send ...`).
  2. Extend accepted targets in `interlateral_comms_monitor/server/index.js` to include `gemini`.
  3. Add `gemini` button/options in `interlateral_comms_monitor/ui/src/components/CommandInput.tsx`.
  4. Expand `all` behavior to include Gemini.

### BC-2: Monitor Injection Uses Wrong tmux Session Names and Wrong Socket
- Severity: Critical.
- Problem: Monitor uses default tmux (`tmux ...`) and short session names (`claude`, `codex`) while the rest of the system standardizes on `/tmp/interlateral-tmux.sock` and `interlateral-*` sessions.
- Evidence:
  - `interlateral_comms_monitor/server/inject.js:16`
  - `interlateral_comms_monitor/server/inject.js:17`
  - `interlateral_comms_monitor/server/inject.js:27`
  - `scripts/tmux-config.sh:9`
- Root cause: Monitor injection implementation diverged from shared tmux config used by bootstrap and DNA wrappers.
- Impact: Direct dashboard injection can silently fail or hit wrong sessions; system degrades to comms-only behavior.
- Suggested solution:
  1. Introduce TMUX helper in monitor backend mirroring `scripts/tmux-config.sh` behavior.
  2. Default session names to `interlateral-claude`, `interlateral-codex`, `interlateral-gemini`.
  3. Respect `TMUX_SOCKET` env var and use `tmux -S "$TMUX_SOCKET"` for all checks/sends.

### BC-3: AG Telemetry Stream Path Mismatch (Watcher Never Sees AG Telemetry)
- Severity: High.
- Problem: AG writer and parser disagree on telemetry file path.
- Evidence:
  - Writer: `interlateral_dna/ag.js:12` writes `.gemini/ag_telemetry.log`
  - Parser lookup: `interlateral_comms_monitor/server/parsers/agTelemetry.js:77` expects `.gemini/telemetry.log`
- Root cause: Filename drift between producer and consumer modules.
- Impact: AG telemetry stream is effectively broken in monitor discovery.
- Suggested solution:
  1. Standardize on one filename (recommend `.gemini/ag_telemetry.log` to match existing writer).
  2. Update parser path resolver and docs.
  3. Add a startup assertion that warns on mismatch.

### BC-4: Injection Status Endpoint Returns CC-Only Shape but UI Uses It for Codex Too
- Severity: High (operator-facing incorrect control state).
- Problem: `/api/inject/status` returns only CC status, but UI reuses it for Codex selection.
- Evidence:
  - API: `interlateral_comms_monitor/server/index.js:54`
  - Available richer status utility exists but unused: `interlateral_comms_monitor/server/inject.js:337`
  - UI consumes single `tmux/applescript/comms` object: `interlateral_comms_monitor/ui/src/components/CommandInput.tsx:18`
- Root cause: Status API not evolved after Codex support was partially added.
- Impact: False readiness indicators and misleading operator decisions for Codex/Gemini routing.
- Suggested solution:
  1. Return per-agent status object (`cc`, `codex`, `gemini`, `ag`).
  2. Update UI to render status by selected target.
  3. Keep legacy fallback for backward compatibility.

## 4) Significant Nice-to-Have (Non-Breaking) Recommendations

### NTH-1: First-Class Agent/Human Profiles (Your “LinkedIn for Agents” Core)
- Why: Current system is infrastructure-heavy but lacks network identity primitives.
- Description: Add profile entities for AI agents and human principals with capabilities, trust signals, and relationship edges.
- Implementation:
  1. Add a `profiles/` domain model (`agent_profile`, `human_profile`, `relationship`, `engagement`).
  2. Introduce a simple API service (Node/Express) and persist with SQLite/Postgres.
  3. Render profile cards and graph connections in monitor UI.

### NTH-2: Unified Event Schema v2
- Why: Current stream typing under-represents Codex/Gemini sources and event kinds.
- Description: Define one canonical event contract across all sources.
- Implementation:
  1. Expand source/type enums in backend + frontend.
  2. Add migration adapter from legacy events.
  3. Validate schema on ingest and emit parse diagnostics.

### NTH-3: Conversation Threads + Project Rooms
- Why: `comms.md` is global and linear; professional network UX needs scoped contexts.
- Description: Add room/thread identifiers (project, team, mission, deal-room).
- Implementation:
  1. Add `thread_id`, `project_id`, `participants` in event metadata.
  2. UI filters/tabs for room views.
  3. Per-room export and replay.

### NTH-4: Trust, Verification, and Reputation Layer
- Why: A network for agents/principals needs quality and identity assurances.
- Description: Capture objective trust artifacts (approval rates, revision addressed %, eval scores, run reliability).
- Implementation:
  1. Ingest eval outputs from `corpbot_agent_evals`.
  2. Compute profile metrics and badges.
  3. Add tamper-evident audit log linkage to sessions/traces.

### NTH-5: Capability Registry + Matchmaking
- Why: Discoverability is key for “connect, collaborate, create”.
- Description: Match tasks to agents based on declared capabilities + observed performance.
- Implementation:
  1. Capability taxonomy (`frontend`, `security-review`, `evals`, etc.).
  2. Search/filter UI with ranking by historical performance.
  3. One-click “assemble team” workflow for new projects.

## 5) Open Questions and Observations / Insights

### Open Questions
1. Should Gemini be mandatory in “all” mode, or optional with degraded success semantics?
2. Do you want the Comms Monitor to be the canonical control plane, or just an observability layer with scripts remaining primary?
3. Should we preserve compatibility with older short session names (`claude`, `codex`) or enforce only namespaced sessions?
4. For the professional-network prototype, do you want profile/graph data stored in-repo first (JSON/SQLite) or launched immediately as a service?

### Observations / Insights
1. The repo already contains most of the hard infrastructure for a networked agent platform; the main blockers are integration consistency, not missing foundational plumbing.
2. The biggest gap versus your stated vision is product-layer modeling (profiles, relationships, trust/reputation), not orchestration capability.
3. The quad-agent bootstrap is more mature than the monitor API/UI alignment; fixing monitor parity is the fastest path to a credible tri-CLI/quad-agent demo.
4. Test health is strong on Python-side infra (`pytest`: 108 passed, 8 skipped), but JS monitor lacks test scripts and currently has no automated guardrails for these integration regressions.

---

## Suggested Immediate Execution Order
1. Fix BC-1 (Gemini routing end-to-end in monitor).
2. Fix BC-2 (tmux socket/session normalization in monitor injection).
3. Fix BC-3 (AG telemetry path consistency).
4. Fix BC-4 (per-target injection status API + UI).
5. Then implement NTH-1 (profiles) as the first visible “professional network” milestone.

## 6) High Priority: Gemini Startup Reliability (P0)

Status: **Critical for stable wake-up protocol completion**.

### Observed startup failures (from current runs)
1. **Model preflight hard-fail in wake-up bootstrap**
- Signature: `ERROR: Gemini model preflight failed for 'gemini-3-flash-preview'`
- Effect: `interlateral-gemini` session is not started by bootstrap; CC/Codex continue, handshake becomes partial.

2. **Model preflight timeout + inconsistent continuation behavior**
- Signature: `Preflight timed out after 10s — proceeding (model pinned via -m)` (sometimes continues, sometimes fails in other runs)
- Effect: Non-deterministic startup behavior across runs.

3. **Runtime instability after startup**
- Signature: `API Error: Cannot read properties of undefined (reading 'candidates')`
- Effect: Gemini can get stuck in interactive tool state and stop responding to coordination prompts.

4. **ACK protocol fragility when Gemini is degraded**
- Signature: wake-up command succeeds for CC/Codex, but all-three ACK sequence does not complete.
- Effect: Expected "all three ask assignment" flow is not reliably achieved.

### Reliability options (ordered by recommended implementation sequence)
1. **Option A (Recommended): Make Gemini startup non-blocking but deterministic**
- Change `bootstrap-full-no-ag.sh` and `bootstrap-full.sh` to:
  - always create `interlateral-gemini` tmux session,
  - attempt primary launch with pinned model,
  - on preflight fail, launch fallback model path or safe baseline command,
  - record explicit startup state in `comms.md` and final bootstrap summary.
- Benefit: avoids "session missing" failures and keeps protocol flow predictable.

2. **Option B: Add automatic Gemini self-heal pass in wake-up**
- After bootstrap, run a short health probe (`node gemini.js status` + pane readiness check).
- If unhealthy, auto-restart only Gemini session once with controlled retry/backoff.
- Benefit: recovers transient startup failures without restarting the whole mesh.

3. **Option C: Add explicit wake-up ACK gate with timeout + degraded mode**
- Extend wake-up protocol orchestration to check:
  - CC ACK received,
  - Codex ACK received,
  - Gemini ACK received (or declared degraded after timeout).
- Emit clear result states: `ALL_ACKED`, `PARTIAL_ACKED`, `DEGRADED_GEMINI`.
- Benefit: human gets deterministic final state instead of silent partial completion.

4. **Option D: Harden Gemini command profile and prompt routing**
- Standardize one known-good Gemini launch command and model selection policy.
- Add routing guardrails so role/task prompts are not misinterpreted as generic human chatter.
- Benefit: reduces runtime drift and coordination confusion.

### Acceptance criteria for this P0
1. Running:
   `./scripts/wake-up-no-ag.sh --dangerously-skip-permissions "<ACK protocol prompt>"`
   yields deterministic final state reporting on every run.
2. `interlateral-gemini` tmux session always exists after wake-up (healthy or explicitly degraded).
3. On Gemini failure, system auto-recovers once or reports explicit degraded state in `comms.md`.
4. No silent partial startup: final summary must include per-agent readiness and ACK completion state.
