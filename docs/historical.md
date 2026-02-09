# Historical Context (Read Once)

This file records key architectural decisions so new teams do not optimize away
critical safeguards.

## Why the system moved from 3 to 4 agents
- A dedicated Gemini CLI agent was added to increase redundancy and parallelism.
- The quad-agent mesh reduces single-point failures in review and execution.

## Why a `sleep 1` delay exists in control scripts
- Short delays prevent race conditions between tmux injection and log writes.
- Removing the delay can cause missed messages or partial captures.

## Why system tmux sockets are used
- Repo-local sockets broke Terminal/Finder launches that do not inherit TMUX_TMPDIR.
- System sockets are simpler and more reliable for multi-tool coordination.

## Architectural decisions to keep
- Always separate documentation (comms.md) from direct communication (cc.js/ag.js/gemini.js).
- Preserve the session boundary marker to prevent stale-task replays.
- Keep observability directories but prune session data between runs.

## Roadmap Historical Lessons (moved from ROADMAP.md)

### Key Lessons Learned (2026-01-26 Telemetry Debate)

#### L1: Terminal Scraping is Fundamentally Broken

**The Problem:** We spent days building an eval pipeline that scraped tmux terminal output via `pipe-pane`. This produces ANSI escape codes, partial lines, and display artifacts - NOT semantic data.

**The Lesson:** Always use **native runtime logs** as authoritative source:
- CC: `~/.claude/projects/<hash>/*.jsonl`
- CX: `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-*.jsonl`
- AG: CDP DOM scrape (no better option for Electron)

**Quote from debate:** "Parsing terminal bytes instead of native logs is like trying to read a book by photographing the reader's face."

#### L2: `cwd` Field is the Hidden Gem

**Discovery:** CC's JSONL includes a `cwd` field on `type: "user"` entries containing the absolute working directory.

**Why It Matters:** This enables deterministic session binding without hooks:
```json
{"type": "user", "cwd": "/Users/.../interlateral_alpha_raw", "sessionId": "abc-123", ...}
```

**How We Found It:** Live testing with `jq 'keys'` on real CC JSONL files.

#### L3: Byte-Offset Slicing Corrupts JSONL

**The Problem:** Using `wc -c` (byte count) and `tail -c +N` can start mid-line, corrupting JSON:
```
...,"content":"hello wor  ← byte offset starts here
ld"}                       ← orphaned fragment
{"type":"user",...         ← this line is lost
```

**The Fix:** Use line-offset slicing:
```bash
INITIAL_LINES=$(wc -l < "$FILE")
tail -n +$((INITIAL_LINES+1)) "$FILE"  # Always starts at line boundary
```

#### L4: Tripwires Must Be Semantic, Not Syntactic

**The Problem:** Checking "file exists and grew" proves the file is active, NOT that it's the right file.

**The Fix:** Add semantic checks:
- `cwd` matches repo root (deterministic binding)
- Contains ≥1 `type: "user"` entry (has actual content)
- Contains ≥1 `type: "assistant"` entry (agent responded)

#### L5: Kill Switch Prevents Silent Garbage

**The Problem:** Without a kill switch, evals run on invalid data and report "PASS" because the LLM judge has nothing to evaluate.

**The Fix:** Hard abort if required fields are missing:
```javascript
if (user_prompt === 'INVALID_DATA') {
  console.error('🛑 KILL SWITCH: Missing required fields');
  process.exit(1);
}
```

#### L6: UUID Isolation Prevents Collision

**The Problem:** `date +%s` (Unix timestamp) can collide if two runs start in the same second.

**The Fix:** Use full UUID:
```bash
if command -v uuidgen &> /dev/null; then
  EVAL_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
else
  EVAL_ID="$(date +%Y%m%d_%H%M%S)_$(head -c 4 /dev/urandom | xxd -p)"
fi
export CODEX_HOME=".observability/SESSIONS/eval_${EVAL_ID}/codex"
```

#### L7: Incremental Testing is Non-Negotiable

**The Problem:** We built a full pipeline, ran it once, got `INVALID_DATA`, and had to reverse-engineer where it broke.

**The Fix:** Test at every checkpoint:
1. After `start-session.sh`: `jq '.' session_state.json` → Valid JSON?
2. After work: `wc -l < CC_FILE` → Line count increased?
3. After harvest: `grep -c '"type":"user"' cc_native.jsonl` → Has entries?
4. After export: `jq '.attributes.user_prompt' trace.json` → Not INVALID_DATA?

---

## Lessons Learned (Captured for Future Reference)

### 2026-01-23: AG Defaults to Wrong Communication Method
- **Problem:** AG wrote to comms.md and assumed Codex would poll. Codex was idle. System failed silently.
- **Solution:** Created `LIVE_COMMS.md` as canonical reference. Emphasized "ALWAYS inject, NEVER assume polling."
- **Action:** Update ANTIGRAVITY.md to reference LIVE_COMMS.md on wake-up.

### 2026-01-23: CC Didn't Use `node ag.js read`
- **Problem:** CC relied on screenshots and comms.md instead of direct text access to AG.
- **Solution:** Documented `node ag.js read` in LIVE_COMMS.md.
- **Action:** Add reminder to CLAUDE.md about observability tools.

### 2026-01-23: Tri-Agent Brainstorm Was Over-Engineered
- **Problem:** Spent 2 hours on comprehensive analysis when simpler doc already existed.
- **Lesson:** For tactical fixes with known answers, just implement. Save elaborate process for genuine architectural decisions.

### 2026-01-23: HealthMonitorSkin Test Validated Courier Infrastructure
- **Context:** After incorporating courier.js and updating agent memory files, ran SkillTest_02 to validate fixes.
- **Result:** All 4 critical issues from TriAgentSkin test were resolved:
  1. Codex successfully read artifact file
  2. Codex communicated via courier outbox (Codex → CC worked)
  3. Codex posts appeared in comms.md
  4. Relative paths resolved correctly
- **Lesson:** The courier.js infrastructure successfully enables full tri-agent collaboration. Codex can now participate as Breaker.
- **Remaining:** Items 6-9 in Short-Term (ACK/NACK, Timeout Extension, Fallback Breaker, Skill Updates) are reliability improvements, not blockers.

---

## References

- `interlateral_dna/LIVE_COMMS.md` - Canonical communication reference
- `projects/0_solving_codex.md` - Full analysis of Codex communication options
- `codex_active_terminal_comms_options.md` - Original simpler options doc
- `projects/skill_test_REPORT.md` - Lessons from TriAgentSkin test (identified issues)
- `projects/SkillTest_02/SkillTest2.md` - HealthMonitorSkin test (validated fixes)
- `projects/PR-Review.md` - PR incorporation plan for courier infrastructure

---

*This roadmap is a living document. Items move from TENTATIVE to CONFIRMED when explicitly approved.*

---

## Roadmap Refactor Archive (2026-02-06)

This section preserves what was intentionally moved out of `ROADMAP.md` when the roadmap was converted into a public-template planning document.

### Canonical Open-Item Set Used for Rewrite

The rewrite used the unified plan from `FixRoadmap.md`:
- 34 total roadmap entries.
- 33 active entries (`NOW` + `NEXT` + `LATER`).
- 1 archived entry (`Alternative Terminal Ecosystem Research`).

### Completed Records Preserved

These implementation records were treated as historical, not future roadmap work:
1. Node extraction from `export-skill-run.sh` to `scripts/export-otel.mjs`.
2. Deterministic trace selection via `.observability/last_trace.txt` (replacing `ls -t`).
3. Courier wake-up integration in `scripts/wake-up.sh` (primary path).
4. Agent memory file updates to reference `interlateral_dna/LIVE_COMMS.md`.
5. V4 telemetry pipeline fixes table history.
6. Gemini preflight timeout hardening in `scripts/bootstrap-full.sh` and `scripts/bootstrap-full-no-ag.sh`.
7. Claude preflight timeout hardening in `scripts/logged-claude.sh`.
8. Conformance prose update for bounded preflight semantics.
9. Deletion of orphaned recipe-era scripts and stale recipe test artifact directory.

### Content Categories Moved Out of Active Roadmap

The following content types were intentionally removed from active roadmap planning and preserved as historical context:
- HyperDomo/Test-4/project-specific framing and provenance notes.
- Detailed implementation code blocks and architecture diagrams.
- Full recipe-era system narrative (`eval_recipes` pipeline, now deleted/superseded).
- Development diary timestamps and test-specific status narratives.
- Internal references that are not public-template guidance.
- Explicit "not doing" decision records that remain useful context.

### Cleanup Action Preserved

One non-historical-addition cleanup decision was tracked during refactor:
- Remove redundant ROADMAP footer line claiming historical migration, because the new roadmap already states history location clearly.

### Naming Clarification: Historical vs Archive

- This repository keeps history in `historical.md`.
- "Archive" here means a section/purpose, not a filename change.
- `historical.md` remains the canonical history file.

---

## Appendix: Full Pre-Refactor ROADMAP Snapshot (2026-02-06)

The full text below is the exact roadmap snapshot captured immediately before the public-template rewrite.

# Interlateral Roadmap

> **NOTE FOR TEMPLATE USERS:** This roadmap reflects the original development
> vision. Feel free to modify for your own project direction. Historical
> context has been moved to `historical.md`.

*All items marked as TENTATIVE until explicitly confirmed.*

---

## URGENT NEXT STEPS: Prep for General Design Patterns and Arbitrary Projects

**Added:** 2026-01-27 (from Project Spec architecture memo)

These items enable HyperDomo to run **any** project/design pattern, not just Test 4 series.

### 1. Single Project Spec Architecture (HIGH PRIORITY)

**Problem:** Current setup has split sources of truth (`test_*.md` in root vs `prompts/test4/*.md`), causing drift and setup friction.

**Solution:** Introduce a unified **Project Spec** file format:

```yaml
---
PROJECT_ID: "my-project"
SKILL: "dev-collaboration"
PATTERN: "dev-collaboration"
ARTIFACT_PATH: "projects/my_project/artifact.md"
REVIEW_FILE: "projects/my_project/reviews.md"
DEPENDENCIES:
  - ".agent/skills/dev-collaboration/SKILL.md"
ROLES:
  CC: DRAFTER
  AG: REVIEWER
  Codex: BREAKER
EVAL_PACKS:
  - revision_addressed
  - reviewer_minimum
  - approval_chain
---
# Assignment body follows...
```

**Tasks:**
- [ ] Create `projects/specs/` directory structure
- [ ] Create `run-project.sh <spec_path>` generic runner
- [ ] Migrate existing prompt files to spec format (or symlink)
- [ ] Update HyperDomo skill to accept spec path as input
- [ ] Add fail-fast validation for ARTIFACT_PATH/REVIEW_FILE directories

### 2. Standardize Frontmatter Keys

- [ ] Define canonical frontmatter schema in `INTERNALS_CONFORMANCE.md`
- [ ] Required keys: `PROJECT_ID`, `ARTIFACT_PATH`, `REVIEW_FILE`, `SKILL`
- [ ] Optional keys: `PATTERN`, `ROLES`, `DEPENDENCIES`, `EVAL_PACKS`
- [ ] Add frontmatter validation to runner scripts

### 3. Symlink Strategy for Backwards Compatibility

- [ ] During migration, make `prompts/` files symlinks to `projects/specs/`
- [ ] Ensures single source of truth at filesystem level
- [ ] Prevents drift between prompt and spec files

### 4. Migration Script

- [ ] Create `scripts/migrate-to-spec.sh` to convert existing `test_*.md` files
- [ ] Extract frontmatter from existing prompts
- [ ] Generate spec files in correct location
- [ ] Create symlinks for backwards compatibility

### 5. Review Preservation (Eval Fix)

**Problem:** Test 4A/4B evals failed because reviewers overwrote their feedback during revision rounds.

**Solution:**
- [ ] Enforce add-comments skill usage in all specs
- [ ] Reviewers APPEND to review file, never replace
- [ ] Add validation in export-otel.mjs to read from REVIEW_FILE directly

---

## Immediate (This Week) - TENTATIVE

### 1. Ensure Courier Runs on Wake-Up
- [ ] Add `cd interlateral_dna && node courier.js > /tmp/courier.log 2>&1 &` to `scripts/wake-up.sh`
- [ ] Verify Codex → CC and Codex → AG paths work after fresh boot
- [ ] Add manual "Verify Courier is running" check until automated

### 2. Update Agent Memory Files to Reference LIVE_COMMS.md
- [ ] CLAUDE.md: Add "READ interlateral_dna/LIVE_COMMS.md on wake-up"
- [ ] ANTIGRAVITY.md: Add same reference + emphasize "DO NOT just write to comms.md"
- [ ] AGENTS.md (or AGENTS.md): Add courier usage instructions

### 3. comms.md Auto-Ping
- [ ] When Codex writes `@CC` or `@AG` to comms.md, watcher auto-injects notification
- [ ] Add `[BROKER]` tag to prevent infinite loops

---

## Short-Term (Next 2 Weeks) - TENTATIVE

### 12. OTEL Eval Pipeline Polish (Urgent/Important)

**Added:** 2026-01-24 (post-v2.2 implementation)

These items improve eval reliability but are NOT blockers for initial testing:

**12a. Integrate rotate-event-log.sh into wake-up.sh**
- [ ] Add `./scripts/rotate-event-log.sh` call to `scripts/wake-up.sh`
- [ ] Purpose: Prevent `events.jsonl` from growing unbounded
- [ ] Risk if skipped: Log grows large over time; no impact on initial tests

**12b. Add chunking/truncation for large traces**
- [ ] Modify `corpbot_agent_evals/lake_merritt/core/evaluation.py`
- [ ] Add trace size check before sending to LLM
- [ ] Options: chunk (split into parts), truncate (cut to limit), summarize (compress)
- [ ] Purpose: Handle traces >100k chars that exceed LLM context
- [ ] Risk if skipped: Large traces fail hard. Initial short tests = small traces = OK.

**12c. Decide on .gitignore auto-add behavior**
- [ ] Current: `run-skill-eval.sh` auto-adds `.env` to `.gitignore` if missing
- [ ] This is a SECURITY FEATURE (prevents committing API keys)
- [ ] Options:
  - Keep (recommended): Auto-protection is good
  - Remove: Script doesn't modify repo state
  - Make optional: Add `--no-gitignore-check` flag
- [ ] Risk if skipped: None. Current behavior is safe.

**12d. Extract Node.js from export-skill-run.sh (BLOCKING)**
- [x] **Added:** 2026-01-26 (Test 3 post-mortem)
- [x] **Problem:** Embedded Node.js template literals cause bash substitution errors
- [x] **Fix:** Moved Node.js code (lines 108-432) to `scripts/export-otel.mjs`
- [x] **Verification:** Re-run export on `eval_00bb1cbb-*` bundle, verify trace created
- [x] **Priority:** P0 - This was the ONLY blocker preventing Test 3 data from being evaluated
- [x] **Status:** COMPLETE (2026-01-26)

**12e. Codex Native Logs Not Harvested**
- [ ] **Added:** 2026-01-26 (Test 3 post-mortem)
- [ ] verify-harvest.sh shows WARN for missing `codex_native.jsonl`
- [ ] Investigate `$CODEX_HOME/sessions/` path and rollout file structure
- [ ] May require Codex session isolation per Item 26 (UUID isolation)
- [ ] **Priority:** HIGH - Codex breaker feedback currently missing from traces

**12f. AG Telemetry Structure for Parsing**
- [ ] **Added:** 2026-01-26 (Test 3 post-mortem)
- [ ] Currently 4.6MB raw text dump from CDP DOM scrape
- [ ] Needs structured parsing to extract SUGGESTIONS and APPROVE verdicts
- [ ] Related: Item 11 (AG Telemetry Gap)
- [ ] **Priority:** MEDIUM - AG data is captured but not machine-parseable

**12g. revision_addressed Eval Pack Needs Better Data**
- [ ] **Added:** 2026-01-26 (Test 3 post-mortem)
- [ ] Current: Searches for generic "red-team feedback" instruction (not measurable)
- [ ] Needed: Track specific FAILURE SCENARIO → Change Log → APPROVE cycle
- [ ] How: Extract numbered failures from Codex, match to Change Log entries
- [ ] **Priority:** HIGH after 12d is fixed

**12h. Postflight Should Not Use `ls -t` for Trace Selection**
- [x] **Added:** 2026-01-26 (Test 3 post-mortem)
- [x] **Problem:** Postflight uses `ls -t .observability/traces/*.json`, which can pick stale traces if export fails or multiple runs exist
- [x] **Fix:** `export-skill-run.sh` now writes trace path to `.observability/last_trace.txt`
- [x] **Updated:** `end-session-safe.sh`, `SKILLS.md`, `CLAUDE.md` to use `cat .observability/last_trace.txt`
- [x] **Status:** COMPLETE (2026-01-26)

---

### 4. Observability & Infrastructure Polishing
- [ ] Document `node ag.js read` capability prominently
- [ ] Create helper script: `./scripts/observe-agent.sh <cc|ag|codex>` that shows recent activity
- [ ] Consider logging all inter-agent messages to a structured format (JSON lines?)
- [ ] **Deferred from 2026-01-23 PR Review (Low Priority):**
  - [ ] Implement advanced character escape handling in `courier.js` (beyond single quotes)
  - [ ] Add heartbeat/health check mechanism to `courier.js` (alert agents if courier dies)
  - [ ] Tag `AGENTS.md` startup test messages with `[STARTUP]` to prevent boot confusion
  - *Rationale for deferral:* These items offer incremental stability but are not blockers for core tri-agent communication. Priority was given to landing the `courier.js` substrate.

### 5. Capability Matrix Documentation
- [ ] Document what each agent CAN and CANNOT do:
  - CC: Full file R/W, tmux access, CDP to AG
  - AG: Browser, file R/W via workspace, tmux via scripts
  - Codex: Sandbox-limited file R/W, no direct tmux, outbox only
- [ ] Skills should check capability matrix before assigning roles

### 6. ACK/NACK Protocol Formalization
**What:** A formal acknowledgment protocol where agents confirm they received and can act on an assignment before work begins.

**Why Needed:** During the TriAgentSkin test, CC assigned Codex as Breaker but had no way to verify Codex received the message or could access the artifact. The workflow proceeded on assumption, wasting time when Codex couldn't participate. An ACK/NACK step catches problems early.

**Implementation:**
- [ ] Every assignment requires explicit ACK before work begins
- [ ] ACK format: `[Agent] @Sender ACK - I can access [artifact]. Starting [role].`
- [ ] NACK format: `[Agent] @Sender NACK - Cannot access [artifact]. Need: [alternative].`
- [ ] NACK triggers human escalation (terminal bell, notification)
- [ ] Timeout rules: 5 min default, configurable per-skill
- [ ] If no ACK/NACK within timeout, sender assumes NACK and escalates

**Status:** Not yet implemented. HealthMonitorSkin test succeeded without it, but it remains a reliability improvement.

### 7. Timeout Extension Mechanism
**What:** A way for agents to request more time when they need it, rather than being forced into timeout.

**Why Needed:** The dev-collaboration skill has a 10-minute timeout rule. During TriAgentSkin, this wasn't enough time to diagnose Codex's file access issue. A rigid timeout forces premature "Partial Revision" when the real fix might be close.

**Implementation:**
- [ ] Agents can post `[Agent] @Lead EXTEND - Need [X] more minutes. Reason: [brief].`
- [ ] Lead grants or denies extension
- [ ] Maximum 2 extensions per phase (prevents infinite delay)
- [ ] If no extension granted, original timeout applies
- [ ] Consider "escalate to human" as third option

**Status:** Not yet implemented. HealthMonitorSkin test completed within time, but this safety valve is useful for complex reviews.

### 8. Fallback Breaker Mechanism
**What:** A defined fallback when the primary Breaker agent cannot perform their role.

**Why Needed:** During TriAgentSkin, Codex couldn't access files and couldn't perform the Breaker role. There was no fallback - the workflow simply proceeded without Breaker input. This means potential bugs weren't caught.

**Implementation:**
- [ ] If primary Breaker times out or NACKs, Drafter performs self-review as fallback
- [ ] Self-review must be clearly marked: `## SELF-BREAKER (Fallback)`
- [ ] Self-review requires identifying at least 3 potential failure scenarios
- [ ] Alternative: Reviewer becomes Breaker, Drafter becomes secondary Reviewer
- [ ] Document fallback chain in skill definition

**Status:** Not yet implemented. HealthMonitorSkin test didn't need it since Codex succeeded, but it's important for resilience.

### 9. Formal Skill Updates for Courier Infrastructure
**What:** Update the `dev-collaboration` and other skills to include courier-specific instructions for Codex.

**Why Needed:** The skills were written before courier.js existed. They assume all agents can use cc.js/ag.js for injection, but Codex cannot. Skills need explicit instructions for Codex's courier outbox workflow.

**Implementation:**
- [ ] Update `dev-collaboration` skill with Codex-specific section:
  - "Codex: Use courier outbox for notifications"
  - "Codex: Write to comms.md directly for reviews"
  - "Codex: Read artifact files at explicit paths"
- [ ] Add courier test commands to skill prerequisites
- [ ] Document in skill: "Verify courier.js is running before starting"
- [ ] Update other skills (adherence-check, dev-competition) similarly
- [ ] Add skill validation: check courier is running before Codex assignment

**Status:** Not yet implemented. HealthMonitorSkin test succeeded with ad-hoc instructions in SkillTest2.md, but formal skill updates would make this repeatable.

### 10. Event Persistence Layer for Observability

**What:** Add persistent logging of all events that flow through the Comms Monitor dashboard, creating a searchable audit trail of tri-agent activity.

**The Problem: Primary vs Secondary Data**

Currently, when a human wants to understand what happened during a skill execution (e.g., the dev-collaboration Drafter/Reviewer/Breaker cycle), they face a fundamental problem: **the only persistent record is what agents voluntarily wrote to comms.md**, which is secondary data that agents frequently forget to update or update inconsistently.

The distinction matters:

| Data Type | Definition | Example | Reliability |
|-----------|------------|---------|-------------|
| **Primary** | Automatic capture of what actually happened | CC's `.jsonl` transcript, tmux output | High (system-generated) |
| **Secondary** | What agents claim happened | comms.md entries, agent reports | Low (voluntary, inconsistent) |

An LLM-generated "summary report" at the end of a skill run is **not** a substitute for primary telemetry. It's the model's interpretation of what happened, not ground truth. If an agent hallucinates, forgets a step, or misremembers, the report will be wrong.

**Current Dashboard Architecture**

The Comms Monitor dashboard (`interlateral_comms_monitor/`) watches these data sources:

```
PRIMARY SOURCES (automatic, reliable):
├── CC .jsonl transcript    → ~/.claude/projects/.../xxx.jsonl
│   (Every tool call, response, thinking - auto-captured by Claude Code)
├── AG telemetry           → .gemini/ag_telemetry.log (canonical, to be implemented)
│   (AG's actual actions - auto-captured by Antigravity)
└── Codex telemetry        → interlateral_dna/codex_telemetry.log
    (If configured - may not exist)

SECONDARY SOURCES (voluntary, unreliable):
├── comms.md               → interlateral_dna/comms.md
│   (Agents write here IF they remember)
└── ag_log.md              → interlateral_dna/ag_log.md
    (Agents write here IF they remember)
```

The dashboard parses these files, normalizes events, and streams them to the browser UI via WebSocket. **This is good architecture** - it already consumes primary data from CC transcripts.

**The Gap: Events Are Not Persisted**

The critical flaw is in `interlateral_comms_monitor/server/streams.js`:

```javascript
// Current implementation (lines 14-16):
const MAX_EVENTS = 1000;
const events = [];  // In-memory circular buffer

function addEvent(event) {
  events.push(event);
  if (events.length > MAX_EVENTS) events.shift();  // Oldest deleted
  broadcast(event);  // Sent to WebSocket clients
}
```

**Problems:**
1. Events exist only in memory - when the server restarts, they're gone
2. Circular buffer holds max 1000 events - older events are permanently lost
3. No way to reconstruct what happened after the fact
4. If you're away during a skill run, you have no audit trail

**Proposed Solution: Event Persistence Layer**

Add a single line to persist every event to disk as it flows through:

```javascript
// Proposed implementation for streams.js:
const fs = require('fs');
const path = require('path');

const eventLogPath = path.join(__dirname, '../../.observability/events.jsonl');
const eventLog = fs.createWriteStream(eventLogPath, { flags: 'a' });

function addEvent(event) {
  // Existing: circular buffer for real-time UI
  events.push(event);
  if (events.length > MAX_EVENTS) events.shift();

  // NEW: Persist to disk (append-only JSON lines)
  eventLog.write(JSON.stringify({
    ...event,
    _persisted_at: new Date().toISOString()
  }) + '\n');

  broadcast(event);
}
```

**What Gets Persisted:**

Every event that flows through the dashboard, including:

| Event Type | Source | Contains |
|------------|--------|----------|
| `tool_use` | CC transcript | Tool name, parameters, timing |
| `tool_result` | CC transcript | Tool output (truncated) |
| `text` | CC transcript | CC's responses |
| `thinking` | CC transcript | CC's reasoning |
| `user_message` | CC transcript | Human input |
| `ag_message` | AG telemetry | AG's actions |
| `cc_message` | comms.md | Ledger entries |
| `separator` | comms.md | Entry boundaries |

**What This Enables:**

After a skill run, the human can reconstruct exactly what happened:

```bash
# See all events from today's session
cat .observability/events.jsonl | jq -c 'select(.timestamp > "2026-01-23")'

# See the Drafter/Reviewer/Breaker cycle
grep -E '(DRAFT READY|SUGGESTION|FAILURE|APPROVE|REQUEST CHANGES)' .observability/events.jsonl

# See all tool calls CC made
grep '"type":"tool_use"' .observability/events.jsonl | jq '{tool: .content.name, time: .timestamp}'

# See what Codex sent via courier
grep 'Codex' .observability/events.jsonl | grep -i breaker

# Reconstruct timeline of a specific skill run
cat .observability/events.jsonl | jq -c 'select(.timestamp > "2026-01-23T20:00" and .timestamp < "2026-01-23T21:00")' | jq -s 'sort_by(.timestamp)'
```

**Implementation Checklist:**

- [ ] Add `fs.createWriteStream` to `streams.js` for append-only logging
- [ ] Create `.observability/events.jsonl` on first write
- [ ] Add `_persisted_at` timestamp to each event
- [ ] Add log rotation script (`scripts/rotate-event-log.sh`) to prevent unbounded growth
- [ ] Add `GET /api/events/search` endpoint for querying persisted events
- [ ] Document event schema in `.observability/EVENT_SCHEMA.md`
- [ ] Add to wake-up verification: "Event log writable"

**Future Enhancements (Not In Scope):**

- SQLite storage for complex queries
- Event replay capability (re-stream historical events to UI)
- Retention policies (auto-delete events older than N days)
- Event signing for tamper detection

**Status:** Not yet implemented. Identified during create-skin skill design review on 2026-01-23. This is a prerequisite for reliable skill execution auditing.

### 11. AG Telemetry Gap: Antigravity Has No Persistent Data Capture

**Added:** 2026-01-25 (discovered during tri-agent-status.sh eval investigation)

**The Problem: AG is a Black Box for Observability**

CC and Codex both have authoritative, persistent telemetry capture via tmux pipe-pane:

| Agent | Telemetry File | Mechanism | Size | Authoritative? |
|-------|----------------|-----------|------|----------------|
| CC | `interlateral_dna/cc_telemetry.log` | tmux pipe-pane | 63MB+ | ✅ YES |
| Codex | `interlateral_dna/codex_telemetry.log` | tmux pipe-pane | 27MB+ | ✅ YES |
| **AG** | `.gemini/ag_telemetry.log` | **DOES NOT EXIST** | N/A | ❌ **GAP** |

**Canonical Log Path:** `.gemini/ag_telemetry.log` (matches pattern: `{agent}_telemetry.log`)

This means:
1. We cannot include AG's actual work in OTEL traces
2. Evals that judge AG's reviewer feedback are working from incomplete data
3. Post-mortem debugging of AG behavior requires manual screenshot review
4. The "tri-agent mesh" is actually only 2/3 observable

**What We Have (That Doesn't Work)**

**Attempt 1: Gemini CLI Telemetry Config**
```bash
# scripts/setup-ag-telemetry.sh exists and creates:
cat .gemini/settings.json
# {"telemetry": {"enabled": true}}
```

**Why it fails:** This config is designed for the `gemini` CLI tool, not Antigravity. Antigravity is an Electron app that doesn't read `.gemini/settings.json`. The file exists but AG ignores it.

**Attempt 2: logged-ag.sh Wrapper**
```bash
# scripts/logged-ag.sh exists but:
# 1. It only logs stdout/stderr of the Electron launch, not AG's conversation
# 2. bootstrap-full.sh doesn't use logged-ag.sh, it launches AG directly
```

**What We CAN Do (Not Persisted)**

```bash
# node ag.js read - Works! Gets AG's conversation content via CDP
node interlateral_dna/ag.js read

# Returns: Full conversation history as text
# BUT: Output goes to stdout and disappears
# NOT persisted anywhere
```

This is the key insight: **We can READ AG, but we don't SAVE what we read.**

**Root Cause Analysis**

1. **Antigravity is GUI-based:** Unlike CC (Claude Code CLI) and Codex (OpenAI Codex CLI), AG runs in an Electron browser window
2. **No terminal = No pipe-pane:** tmux pipe-pane captures terminal byte streams. AG has no terminal.
3. **CDP gives us visibility:** `ag.js read` uses Chrome DevTools Protocol to extract `document.body.innerText`
4. **But CDP is pull-only:** We have to actively request the content; it's not streamed/logged

**Solution Options (Prioritized)**

**Option A: Modify ag.js to Persist Reads (Quick Start)**
```javascript
// In ag.js read() function, add:
const path = require('path');
const fs = require('fs');
// Use absolute path based on script location to avoid drift
const REPO_ROOT = path.resolve(__dirname, '..');
const AG_TELEMETRY_LOG = path.join(REPO_ROOT, '.gemini', 'ag_telemetry.log');

// Ensure directory exists
fs.mkdirSync(path.dirname(AG_TELEMETRY_LOG), { recursive: true });

// Append with session ID to prevent crosstalk in multi-run evals
const sessionId = process.env.OTEL_SESSION_ID || `session_${Date.now()}`;
fs.appendFileSync(AG_TELEMETRY_LOG, `\n--- [${sessionId}] READ AT ${new Date().toISOString()} ---\n${content}\n`);
```

Pros: Quick fix, works with existing infrastructure
Cons: Only captures when we explicitly call `ag.js read`, not continuous

**Option B: Add Continuous Polling to ag.js (RECOMMENDED - Captures Transient States)**

AG's "thinking" states and tool-calls may be overwritten in the GUI before a final read occurs. Continuous polling captures these transient states.

```javascript
// New command: node ag.js watch
// Polls AG every N seconds, appends ONLY changes to log
const path = require('path');
const fs = require('fs');
const REPO_ROOT = path.resolve(__dirname, '..');
const AG_TELEMETRY_LOG = path.join(REPO_ROOT, '.gemini', 'ag_telemetry.log');

async function watch(intervalMs = 5000) {
  const sessionId = process.env.OTEL_SESSION_ID || `session_${Date.now()}`;
  let lastContent = '';

  console.log(`[AG Watch] Starting continuous capture to ${AG_TELEMETRY_LOG}`);
  console.log(`[AG Watch] Session ID: ${sessionId}, Poll interval: ${intervalMs}ms`);

  fs.mkdirSync(path.dirname(AG_TELEMETRY_LOG), { recursive: true });

  setInterval(async () => {
    try {
      const content = await readContent(); // Internal read without logging
      if (content !== lastContent) {
        const delta = content; // Could diff for incremental logging
        fs.appendFileSync(AG_TELEMETRY_LOG,
          `\n--- [${sessionId}] CAPTURE AT ${new Date().toISOString()} ---\n${delta}\n`);
        lastContent = content;
      }
    } catch (err) {
      console.error('[AG Watch] Capture failed:', err.message);
    }
  }, intervalMs);
}
```

Pros: Captures all AG activity over time, including transient thinking/tool states
Cons: Polling overhead, may miss rapid changes between polls (mitigate with smaller interval)

**Option C: Investigate Antigravity Native Logging**
Research whether Antigravity has:
- Built-in conversation export
- Chrome DevTools "Network" or "Console" logging that could be redirected
- Electron IPC logging capabilities
- A way to configure persistent conversation history

Pros: Native solution, no polling overhead
Cons: Requires deep investigation of Antigravity internals

**Option D: CDP WebSocket Stream (Advanced)**

Instead of polling `document.body.innerText`, subscribe to CDP events for real-time streaming:

```javascript
// Use CDP's Network.enable() to capture API calls to Gemini backend
// This may reveal the actual request/response payloads

const CDP = require('chrome-remote-interface');

async function streamEvents() {
  const client = await CDP({ port: 9222 });
  const { Network, Console, DOM } = client;

  // Enable network monitoring - may capture Gemini API calls
  await Network.enable();
  Network.responseReceived(params => {
    if (params.response.url.includes('generativelanguage')) {
      console.log('[AG Stream] Gemini API response:', params);
    }
  });

  // Enable console monitoring - may capture debug output
  await Console.enable();
  Console.messageAdded(params => {
    fs.appendFileSync(AG_TELEMETRY_LOG, `[CONSOLE] ${params.message.text}\n`);
  });

  // Enable DOM monitoring - track UI changes
  await DOM.enable();
  DOM.documentUpdated(() => {
    // Trigger read on DOM change
  });
}
```

Pros: Real-time, no polling overhead, may capture API payloads
Cons: Significant CDP complexity, requires investigation of what events AG actually emits

**Why This Matters for Evals**

During the tri-agent-status.sh skill run, we discovered a multi-layer problem:
- The OTEL trace had 24 spans but was missing AG's reviewer feedback content
- The eval scored 24/24 PASS but should have been PARTIAL (11 items failed)
- **Root causes (multiple):**
  1. The OTEL export (`export-skill-run.sh`) extracted incomplete data from `events.jsonl`
  2. `events.jsonl` itself was missing full comms.md content from the skill run
  3. AG's actual suggestions were never persisted to authoritative telemetry
  4. The eval judged fragmented spans, not the complete Drafter→Reviewer→Breaker cycle

**Note:** Fixing AG telemetry alone won't solve the eval accuracy issue. The OTEL export pipeline also needs to capture the full skill execution context from comms.md or authoritative terminal logs.

**Implementation Checklist**

Phase 1 (Immediate - Option A):
- [ ] Add persistence to `ag.js read` - log to `.gemini/ag_telemetry.log`
- [ ] Use absolute path: `path.resolve(__dirname, '..', '.gemini', 'ag_telemetry.log')`
- [ ] Include session ID in log entries to prevent crosstalk in multi-run evals
- [ ] Update bootstrap-full.sh to create the `.gemini/` directory
- [ ] Test: Run `node ag.js read`, verify log file grows

Phase 2 (Short-term - Option B, RECOMMENDED):
- [ ] Add `node ag.js watch` command for continuous capture
- [ ] Integrate into wake-up.sh: start `ag.js watch` as background process
- [ ] Add log rotation via `scripts/rotate-logs.sh` to prevent unbounded growth
- [ ] Document recommended poll interval (5s default, 2s for eval runs)

Phase 3 (Research - Option C/D):
- [ ] Research Antigravity native logging capabilities
- [ ] Investigate Electron's `--enable-logging` flag
- [ ] Investigate CDP's `Network.enable` for streaming events
- [ ] If native solution found, prefer over polling

**Dependencies**
- Requires: AG running with CDP on port 9222
- Blocks: Reliable OTEL traces for evals (Item 11.5)
- Related: Item 10 (Event Persistence Layer) - same problem, different agent

**For Future Investigators**

Full context is documented in:
- `response-2.md` Section 6: "Deep Dive - The AG Telemetry Gap"
- `response-2.md` Section 7: "Research Prompt for Expert Investigators"
- `response-2.md` Section 8: "Summary of AG Data Collection Status"

The research prompt in Section 7 can be given to expert investigators to find Antigravity-native logging solutions.

**Status:** Not yet implemented. Discovered during eval discrepancy investigation on 2026-01-25. This is a blocker for reliable tri-agent observability and accurate evals.

---

### 11.5. Eval Pipeline: Primary Data to Lake Merritt via OpenTelemetry

**What:** Emit primary observability data from the Comms Monitor dashboard as OpenTelemetry (OTEL) traces, enabling automated evaluation of tri-agent workflows using Lake Merritt's eval framework with LLM-as-judge scoring.

**The Problem: Primary Data Exists But Isn't Evaluable**

We now have:
1. **Primary data flowing through the dashboard** (CC transcripts, AG telemetry, events)
2. **Lake Merritt eval framework** with OTEL ingestion (`GenericOtelIngester`), LLM judge scoring, and CC/AG-specific parsers
3. **No connection between them** - the dashboard doesn't emit data in a format Lake Merritt can consume

The result: we cannot automatically evaluate questions like:
- "Did CC actually address Codex's FAILURE SCENARIO #2 in v1.1?"
- "Were all 3 of AG's suggestions incorporated or declined with reasoning?"
- "Did the Breaker review happen before or after the Reviewer review?"
- "What was the total token cost of this skill execution?"

**Current Lake Merritt Capabilities**

Lake Merritt (`corpbot_agent_evals/lake_merritt/`) already supports:

| Capability | Implementation | Status |
|------------|---------------|--------|
| OTEL trace ingestion | `GenericOtelIngester` | ✅ Ready |
| CC transcript parsing | `CCJSONLIngester` | ✅ Ready |
| AG telemetry parsing | `AGTelemetryIngester` | ✅ Ready |
| Terminal recording parsing | `CastIngester` | ✅ Ready |
| LLM-as-judge scoring | `ScorerResult` with `llm_judge` | ✅ Ready |
| Pass/fail + numeric scoring | `ScorerResult` model | ✅ Ready |
| Flexible metadata | `EvaluationItem.metadata` | ✅ Ready |

**What's Missing: OTEL Emission from Dashboard**

The dashboard needs to **emit** traces, not just display events:

```
CURRENT FLOW (broken):
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ CC Transcript   │────►│ Dashboard       │────►│ Browser UI      │
│ AG Telemetry    │     │ (in-memory)     │     │ (ephemeral)     │
│ comms.md        │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌─────────────────┐
                        │ Lake Merritt    │
                        │ (NO CONNECTION) │
                        └─────────────────┘

PROPOSED FLOW (connected):
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ CC Transcript   │────►│ Dashboard       │────►│ Browser UI      │
│ AG Telemetry    │     │                 │     │                 │
│ comms.md        │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
           ┌────────────┐ ┌────────────┐ ┌────────────┐
           │ events.    │ │ OTEL       │ │ skill_run_ │
           │ jsonl      │ │ traces/    │ │ 2026....   │
           │ (Item 10)  │ │ *.json     │ │ .csv       │
           └────────────┘ └─────┬──────┘ └────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │ Lake Merritt    │
                        │ GenericOtel     │
                        │ Ingester        │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ LLM Judge       │
                        │ Evaluations     │
                        └─────────────────┘
```

**Proposed OTEL Trace Structure for Skill Executions**

Each skill execution becomes a trace with spans for each phase:

```json
{
  "resourceSpans": [{
    "resource": {
      "attributes": [
        {"key": "service.name", "value": {"stringValue": "interlateral"}},
        {"key": "skill.name", "value": {"stringValue": "create-skin"}},
        {"key": "artifact.name", "value": {"stringValue": "AgentTimelineSkin"}}
      ]
    },
    "scopeSpans": [{
      "spans": [
        {
          "traceId": "skill_run_20260123_204500",
          "spanId": "phase_0_preflight",
          "name": "preflight",
          "attributes": [
            {"key": "courier.running", "value": {"boolValue": true}},
            {"key": "dashboard.running", "value": {"boolValue": true}}
          ]
        },
        {
          "traceId": "skill_run_20260123_204500",
          "spanId": "phase_5_reviewer",
          "name": "ag_review",
          "attributes": [
            {"key": "agent", "value": {"stringValue": "AG"}},
            {"key": "role", "value": {"stringValue": "Reviewer"}},
            {"key": "suggestions_count", "value": {"intValue": 3}},
            {"key": "verdict", "value": {"stringValue": "APPROVE"}},
            {"key": "raw_review", "value": {"stringValue": "SUGGESTION 1: ..."}}
          ]
        },
        {
          "traceId": "skill_run_20260123_204500",
          "spanId": "phase_6_breaker",
          "name": "codex_review",
          "attributes": [
            {"key": "agent", "value": {"stringValue": "Codex"}},
            {"key": "role", "value": {"stringValue": "Breaker"}},
            {"key": "failures_count", "value": {"intValue": 4}},
            {"key": "verdict", "value": {"stringValue": "REQUEST_CHANGES"}},
            {"key": "raw_review", "value": {"stringValue": "FAILURE 1: ..."}}
          ]
        },
        {
          "traceId": "skill_run_20260123_204500",
          "spanId": "phase_7_revision",
          "name": "revision",
          "attributes": [
            {"key": "version", "value": {"stringValue": "v1.1"}},
            {"key": "issues_addressed", "value": {"intValue": 4}},
            {"key": "change_log", "value": {"stringValue": "## Change Log..."}}
          ]
        }
      ]
    }]
  }]
}
```

**Eval Use Cases Enabled**

Once primary data is emitted as OTEL traces, Lake Merritt can evaluate:

| Eval Question | How It Works |
|---------------|--------------|
| "Was FAILURE #2 addressed in v1.1?" | LLM judge compares `raw_review` (failures) to `change_log` |
| "Did Reviewer provide ≥3 suggestions?" | Check `suggestions_count >= 3` |
| "Were reviews completed before revision?" | Compare span timestamps |
| "What % of Breaker issues were declined?" | Parse change_log for "Declined:" entries |
| "Did all agents approve final version?" | Check verdict fields across review spans |
| "Total token cost of this skill run?" | Sum token counts from CC transcript spans |
| "Did Codex use courier (not blocked cc.js)?" | Check courier.log events in trace |

**Example LLM Judge Prompt**

```
You are evaluating whether revision requests were properly addressed.

BREAKER REVIEW (Codex):
{raw_review from phase_6_breaker span}

CHANGE LOG (v1.1):
{change_log from phase_7_revision span}

For each FAILURE SCENARIO in the Breaker review, determine:
1. Was it ADDRESSED (fixed/hardened)?
2. Was it DECLINED with reasoning?
3. Was it IGNORED (not mentioned)?

Return JSON:
{
  "failures": [
    {"id": 1, "status": "ADDRESSED", "evidence": "..."},
    {"id": 2, "status": "DECLINED", "reason": "..."},
    ...
  ],
  "overall_score": 0.0-1.0,
  "passed": true/false
}
```

**Implementation Phases**

**Phase A: Minimal Viable Export (JSON/CSV)**

- [ ] Add `--export-run` flag to skill execution that dumps events to JSON
- [ ] Create `scripts/export-skill-run.sh <start_time> <end_time>`
- [ ] Output: `.observability/skill_runs/<timestamp>.json`
- [ ] Format: Array of dashboard events (not full OTEL yet)
- [ ] Test: Lake Merritt `JSONIngester` can parse it

**Phase B: OTEL Trace Emission**

- [ ] Add OTEL exporter to dashboard backend (`streams.js`)
- [ ] Group events by skill execution into traces
- [ ] Add span structure for skill phases (preflight, draft, review, etc.)
- [ ] Output: `.observability/traces/<skill>_<timestamp>.json`
- [ ] Test: Lake Merritt `GenericOtelIngester` can parse it

**Phase C: Skill-Aware Event Tagging**

- [ ] Skills emit `[SKILL:create-skin:START]` and `[SKILL:create-skin:END]` markers
- [ ] Dashboard recognizes skill boundaries and groups events into traces
- [ ] Each phase (preflight, draft, review, revision) becomes a span
- [ ] Reviewer/Breaker verdicts extracted as span attributes

**Phase D: Lake Merritt Integration**

- [ ] Create `SkillRunIngester` that wraps `GenericOtelIngester` with skill-specific field mappings
- [ ] Add pre-built eval configs for common questions:
  - `evals/revision_addressed.yaml` - Were Breaker issues addressed?
  - `evals/reviewer_minimum.yaml` - Did Reviewer provide ≥N suggestions?
  - `evals/approval_chain.yaml` - Did all agents approve?
- [ ] Add CLI: `lake-merritt eval --skill-run <trace_file> --config revision_addressed.yaml`

**Phase E: Automated Spot-Check Evals**

- [ ] On skill completion, automatically run key evals
- [ ] Output eval results to `.observability/evals/<trace_id>_results.json`
- [ ] Add to dashboard UI: "Eval Results" tab showing pass/fail for recent runs
- [ ] Alert on eval failures (Breaker issues ignored, <3 suggestions, etc.)

**Fallback: CSV Export for Simple Analysis**

If full OTEL is overkill, a simpler CSV export enables basic analysis:

```csv
timestamp,source,agent,event_type,phase,content
2026-01-23T20:45:00Z,comms,CC,draft_ready,phase_4,"DRAFT READY: AgentTimelineSkin v1.0"
2026-01-23T20:46:30Z,comms,AG,review,phase_5,"SUGGESTION 1: Add loading state..."
2026-01-23T20:47:15Z,courier,Codex,review,phase_6,"FAILURE 1: No error boundary..."
2026-01-23T20:50:00Z,comms,CC,revision,phase_7,"v1.1 - All issues addressed"
```

Lake Merritt's `CSVIngester` can parse this directly for simpler evals.

**Dependencies**

- **Requires Item 10 (Event Persistence)** - Can't emit what isn't captured
- **Requires skill markers** - Skills must emit START/END boundaries
- **Benefits from structured reviews** - Easier to parse if agents use consistent formats

**Status:** Not yet implemented. Identified during create-skin skill design review on 2026-01-23. This connects the primary data pipeline (Item 10) to the existing Lake Merritt eval framework.

---

## Post-Test #2 Follow-ons (Detailed Backlog)

### A. AG Telemetry Rotation + Polling Guidance

- **What:** Add log rotation for `.gemini/ag_telemetry.log` and document a recommended poll interval (default 5s; 2s during eval runs).
- **Why:** Prevent unbounded log growth and improve capture fidelity for eval runs.
- **Dependencies:** `ag.js watch` exists and writes to `.gemini/ag_telemetry.log`.
- **Success:** Log size bounded; poll interval documented in README/INTERNALS_CONFORMANCE.

### B. AG Telemetry Gold-Standard (CDP Network.enable / Native Logging Research)

- **What:** Investigate Antigravity native logging and CDP `Network.enable` to capture request/response payloads.
- **Why:** Replace DOM polling with authoritative transport-level logs.
- **Output:** Research memo with enablement steps, data captured, format, paths, reliability, caveats.

### C. INTERNALS_CONFORMANCE Updates (AG Telemetry)

- **What:** Update Section 5.x to (1) use `.gemini/ag_telemetry.log` as canonical path, (2) add AG capture mechanism checks (`ag.js read/watch`), (3) include OTEL validity rules (skill boundaries + user_prompt).
- **Why:** Align conformance checks with the new telemetry pipeline.

### D. Dashboard OTEL Emission (Maturity Step)

- **What:** Emit OTEL traces directly from the Comms Monitor dashboard after manual export is stable.
- **Why:** Make primary data evaluable without manual extraction.
- **Dependencies:** events.jsonl completeness + stable export.

### E. Event Persistence Layer Completion

- **What:** Finish schema doc, log rotation, and search endpoint for events.jsonl.
- **Why:** Reliable exports and auditability depend on this layer.

### F. Gemini CLI as Fourth Agent (Terminal Symmetry)

- **What:** Integrate Gemini CLI as a terminal-native agent with tmux + pipe-pane telemetry.
- **Why:** Avoid AG GUI telemetry gap and enable authoritative Gemini logs.
- **Include:** `gemini.js` control script, tmux session, telemetry log, courier integration, status checks.

### G. Status/Courier Updates for Gemini

- **What:** Update mesh status script and courier routing to include GEM sessions and outbox watcher.
- **Why:** Keep mesh health checks accurate if Gemini CLI is added.

### H. Partial Result Reporting Standard

- **What:** Update eval output conventions to distinguish `PARTIAL (Incomplete Data)` from `PASS (Quality Verified)`.
- **Why:** Prevent false “all passed” summaries when data is incomplete.

---

## Medium-Term (1-2 Months) - TENTATIVE

### 13. Gemini CLI as Fourth Agent in the Mesh

**Added:** 2026-01-25 (roadmap expansion for terminal-native Gemini support)

**What:** Add Google's `gemini` CLI tool as a fourth agent in the Interlateral mesh, providing a terminal-native Gemini experience alongside the existing GUI-based Antigravity (AG).

**Why This Matters**

The current tri-agent mesh has an asymmetry:

| Agent | Interface | Terminal-Native? | tmux Compatible? | Telemetry via pipe-pane? |
|-------|-----------|------------------|------------------|--------------------------|
| CC (Claude Code) | CLI | ✅ YES | ✅ YES | ✅ YES |
| Codex (OpenAI) | CLI | ✅ YES | ✅ YES | ✅ YES |
| AG (Antigravity) | Electron GUI | ❌ NO | ❌ NO | ❌ NO |

Antigravity's GUI-based nature creates the telemetry gap documented in Item 11. Adding Gemini CLI would:

1. **Complete the terminal symmetry:** All agents would be CLI-based and tmux-compatible
2. **Enable pipe-pane telemetry:** Gemini CLI would have authoritative logs like CC and Codex
3. **Simplify infrastructure:** Same patterns work for all agents (no special CDP handling)
4. **Provide Gemini model access:** Keep Google's latest models in the mesh
5. **Future-proof:** When Antigravity is retired, Gemini CLI is ready

**Gemini CLI Overview**

Google's Gemini CLI (`gemini`) is a terminal-based interface to Gemini models:

```bash
# Installation (if not already installed)
# See: https://cloud.google.com/vertex-ai/docs/generative-ai/gemini-cli

# Basic usage
gemini chat "Hello, what can you do?"

# With specific model
gemini chat --model gemini-1.5-pro "Analyze this code..."

# Interactive mode
gemini  # Starts REPL
```

**Proposed Architecture**

```
CURRENT (3 agents):
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ CC (tmux)   │     │ Codex (tmux)│     │ AG (Electron)│
│ claude-code │     │ codex       │     │ Antigravity  │
│ ✅ pipe-pane│     │ ✅ pipe-pane│     │ ❌ No telemetry│
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
      └───────────────────┴───────────────────┘
                          │
                    [Courier/MCP]

PROPOSED (4 agents):
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ CC (tmux)   │     │ Codex (tmux)│     │ AG (Electron)│     │ GEM (tmux)  │
│ claude-code │     │ codex       │     │ Antigravity  │     │ gemini CLI  │
│ ✅ pipe-pane│     │ ✅ pipe-pane│     │ ⚠️ CDP only  │     │ ✅ pipe-pane│
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │                   │
      └───────────────────┴───────────────────┴───────────────────┘
                                    │
                              [Courier/MCP]
```

**New Control Script: gemini.js**

Following the pattern of `cc.js`, `ag.js`, and `codex.js`:

```javascript
// interlateral_dna/gemini.js

const GEMINI_SESSION = process.env.GEMINI_TMUX_SESSION || 'gemini';

async function send(message) {
  // Inject message into gemini tmux session
  execSync(`tmux send-keys -t ${GEMINI_SESSION} ${escapeForTmux(message)} Enter`);
}

async function read() {
  // Capture current pane content
  const output = execSync(`tmux capture-pane -t ${GEMINI_SESSION} -p`);
  console.log(output.toString());
}

async function status() {
  // Check if gemini session exists and is responsive
  const hasSession = execSync(`tmux has-session -t ${GEMINI_SESSION} 2>&1 || echo "no"`);
  console.log(hasSession.includes('no') ? 'OFFLINE' : 'ONLINE');
}
```

**Telemetry Setup (Same Pattern as CC/Codex)**

```bash
# In wake-up.sh or bootstrap-full.sh:

# Create gemini tmux session if not exists
tmux has-session -t gemini 2>/dev/null || tmux new-session -d -s gemini -c "$REPO_ROOT"

# Enable telemetry capture via pipe-pane
tmux pipe-pane -t gemini "cat >> $REPO_ROOT/interlateral_dna/gemini_telemetry.log"

# Start gemini CLI in the session
tmux send-keys -t gemini "gemini" Enter
```

**Updates to Existing Files**

1. **CLAUDE.md** - Add gemini.js to Quick Reference
2. **LIVE_COMMS.md** - Add CC↔GEM, AG↔GEM, Codex↔GEM communication paths
3. **leadership.json** - Add "gem" as valid agent identifier
4. **tri-agent-status.sh** - Rename to `agent-mesh-status.sh`, add Gemini check
5. **courier.js** - Add `gemini_outbox/` watcher for Gemini→others

**Migration Path: AG → Gemini CLI**

If/when AG is deprecated:

1. AG-specific skills remain functional via CDP (unchanged)
2. New skills prefer Gemini CLI over AG
3. Eventually, AG becomes optional "legacy" path
4. Full mesh operates with CC, Codex, and Gemini CLI

**Implementation Checklist**

Phase 1 (Setup):
- [ ] Verify Gemini CLI is installed and authenticated (`gemini --version`)
- [ ] Create `interlateral_dna/gemini.js` (send, read, status, screenshot)
- [ ] Add `GEMINI_TMUX_SESSION` to environment config
- [ ] Create gemini tmux session in `wake-up.sh`

Phase 2 (Telemetry):
- [ ] Add pipe-pane telemetry capture for gemini session
- [ ] Verify `gemini_telemetry.log` captures conversation history
- [ ] Add to observability tools (observe-agent.sh gem)

Phase 3 (Integration):
- [ ] Add gemini.js to LIVE_COMMS.md communication matrix
- [ ] Update courier.js with gemini_outbox watcher
- [ ] Add GEM to leadership.json valid agents
- [ ] Update status script to check all 4 agents

Phase 4 (Skills):
- [ ] Update dev-collaboration to support GEM as Reviewer/Breaker
- [ ] Add GEM-specific instructions to skill definitions
- [ ] Test: Run skill with GEM as Reviewer

**Dependencies**
- Requires: Gemini CLI installed and authenticated
- Requires: tmux available
- Related: Item 11 (AG Telemetry Gap) - Gemini CLI bypasses this problem
- Related: Item 14 (MCP Server) - Gemini CLI could use MCP like other agents

**Status:** Not yet implemented. Identified during 2026-01-25 roadmap planning. Provides a clean path to fully-observable quad-agent mesh.

---

### 14. Unix Domain Socket Relay
- [ ] Replace file-based courier with UDS for lower latency
- [ ] Socket lives in repo so Codex sandbox can access it
- [ ] Benchmark: target <50ms message delivery

### 15. MCP Server for Interlateral
- [ ] Build `interlateral-mcp-server` as central message bus
- [ ] Tools: `broadcast_message`, `send_to_agent`, `read_ledger`, `subscribe_events`
- [ ] Enable Codex to use MCP instead of file outbox
- [ ] Consider using existing Comms Monitor as MCP host

### 16. Docker Sandbox Option
- [ ] Create `Dockerfile.interlateral` for isolated agent environment
- [ ] Allow `--yolo` mode safely inside container
- [ ] Document when to use Docker vs native

---

## Long-Term (3+ Months) - TENTATIVE

### 17. Fly.io Sprites Integration
- [ ] Evaluate Sprites for "YOLO in a box" workflows
- [ ] Implement golden checkpoint pattern
- [ ] Measure cold-start latency impact on "speed of thought"

### 18. Alternative Terminal Ecosystem
- [ ] Evaluate WezTerm, kitty, iTerm2 for better programmatic control
- [ ] Consider PTY broker architecture (node-pty) to avoid tmux entirely

### 19. Full Protocol-First Architecture
- [ ] Agents communicate ONLY via MCP tools, not direct terminal injection
- [ ] Complete abstraction from underlying transport (tmux, files, sockets)
- [ ] Capability sharing: agents expose their unique abilities as MCP tools

### 20. Multi-Machine / Cloud Deployment
- [ ] Agents can run on different machines
- [ ] MCP server handles routing across network boundaries
- [ ] Security: auth tokens, TLS, rate limiting

---

---

## EVAL RECIPE SYSTEM (Phase 1 Complete, Future Enhancements)

**Added:** 2026-01-26 (CC + CX Consensus)

### What We Built for Test 3

A generic recipe system that eliminates per-test scripts and shell quoting issues:

| Component | File | Description |
|-----------|------|-------------|
| Recipe format | `eval_recipes/*.md` | Markdown with YAML frontmatter + sections |
| Recipe parser | `scripts/parse-eval-recipe.py` | Python parser extracts prompts to files |
| Generic runner | `scripts/run-eval.sh` | Reads recipe, calls preflight with `--prompt-file` |
| Prompt-file support | `scripts/preflight-wakeup.sh` | `--prompt-file` option reads from file, not args |
| Prompt-file support | `scripts/wake-up.sh` | `WAKEUP_PROMPT_FILE` env var support |

**Key innovation:** Prompts are read from files, NOT passed through shell arguments. This completely eliminates quoting issues.

**Usage:**
```bash
./scripts/run-eval.sh test3
# Or: ./scripts/run-eval.sh eval_recipes/test3.md
```

### Recipe Format (Markdown with YAML Frontmatter)

```markdown
---
name: test3-skin-creation
skill: dev-collaboration
roles:
  drafter: CC
  reviewer: AG
  breaker: Codex
---
# Test 3: Description

## Wakeup Prompt
<prompt text here - extracted to wakeup.txt>

## Assignment
<assignment text here - extracted to assignment.txt>

## Postflight
```bash
<postflight commands>
```
```

### Gap to Production (Future Enhancements)

#### 27. Recipe as Skill (Deeper Integration)

**What:** Make recipes a first-class Skill that agents can discover and invoke.

**Why:** Currently recipes are only usable via `run-eval.sh`. If recipes were Skills, agents could:
- List available recipes with `/list-recipes`
- Invoke recipes programmatically
- Create new recipes as part of their workflow

**How:**
- Create `.agent/skills/run-recipe/SKILL.md`
- Recipe discovery: glob `eval_recipes/*.md`
- AI agents can create new recipes by writing Markdown files

**Status:** DEFERRED. Current runner is sufficient for Test 3.

---

#### 28. Auto-Display Assignment After ACK

**What:** After all three agents ACK, automatically display the assignment for the human to paste.

**Why:** Currently the human must:
1. Wait for ACKs
2. Find the assignment file
3. Copy and paste

With auto-display, the assignment appears automatically when ready.

**How:**
```bash
# In run-eval.sh, after preflight returns:
if [[ -s "$ASSIGNMENT_FILE" ]]; then
  echo ""
  echo "=== PASTE THIS TO CC ==="
  cat "$ASSIGNMENT_FILE"
  echo "========================"
fi
```

**Status:** DEFERRED. Human can find assignment in recipe or temp file.

---

#### 29. Recipe Validation

**What:** Add validation that recipes have required sections and valid frontmatter.

**Why:** Catch errors early before preflight/wake-up fail with confusing messages.

**How:**
```bash
# Add to run-eval.sh
if [[ ! -s "$WAKEUP_FILE" ]]; then
  echo "ERROR: Recipe missing 'Wakeup Prompt' section"
  exit 1
fi
if [[ -z "$SESSION_NAME" ]]; then
  echo "ERROR: Recipe missing 'name' in frontmatter"
  exit 1
fi
```

**Status:** PARTIAL (wakeup check exists). Full validation TODO.

---

#### 30. Recipe Templates

**What:** Provide starter templates for common patterns (collaborative, competitive, pipeline).

**Why:** New users can copy a template instead of starting from scratch.

**Templates:**
- `eval_recipes/templates/collaborative.md` - Drafter/Reviewer/Breaker
- `eval_recipes/templates/competitive.md` - Two drafters, judge picks winner
- `eval_recipes/templates/pipeline.md` - Sequential handoffs

**Status:** DEFERRED. Test 3 recipe serves as de facto template.

---

#### 31. Recipe Discovery by AI Agents

**What:** Document how AI agents can discover and create recipes.

**Why:** Dazza's aspiration: "AI agents can generate new recipes for novel requests."

**How:**
```markdown
# For AI Agents: Creating New Recipes

1. Create a new file: `eval_recipes/<name>.md`
2. Use YAML frontmatter for metadata
3. Include sections: Wakeup Prompt, Assignment, Postflight
4. Test with: `./scripts/run-eval.sh <name>`

See `eval_recipes/test3.md` as reference.
```

**Status:** DEFERRED. Document when recipe system matures.

---

## EVALS EVOLUTION (Phase 2+ Hardening)

**Added:** 2026-01-26 (Post-V4 Consensus on Native Log Harvest)

This section captures all deferred items, lessons learned, and future hardening paths from the intensive telemetry pipeline redesign debate (documented in `projects/eval_data/eval_data_debate_and_decision.md`).

### Context: What We Built (V4 Production Pipeline)

After 4 revision rounds with expert reviewers, we achieved a "Production Grade" telemetry pipeline:

| Fix | What It Does | Status |
|-----|--------------|--------|
| 1-6 | V2 basics (jq JSON, tripwires, kill switch, no keyword filtering, CODEX_HOME) | ✅ DONE |
| 7 | Line-offset slicing (prevents JSONL mid-line corruption) | ✅ DONE |
| 8 | UUID session isolation (prevents parallel run collision) | ✅ DONE |
| 9 | cwd-based repo match (deterministic CC session binding) | ✅ DONE |
| 10 | Path canonicalization (handles symlinks/subdirs) | 🔄 TODO |

### 21. UserPromptSubmit Hook for Bulletproof Anchoring (Phase 2)

**What:** Add a single Claude Code hook (`UserPromptSubmit`) to capture the prompt deterministically with structured JSON.

**Why We Need It:**
- Current approach uses `cwd` field in JSONL which requires file discovery + content scanning
- Hooks provide **push-based** anchoring - CC tells us the session file, we don't guess it
- Hooks give us `transcript_path` which is the exact file being written to
- This eliminates the "find most recent file" heuristic entirely

**What It Solves:**
- Multi-repo scenarios where `ls -t` picks wrong project
- Edge cases where `cwd` field is missing or different from repo root
- Need to scan entire JSONL to verify content

**What It Is:**
Claude Code hooks are officially supported lifecycle callbacks that receive structured JSON via stdin:
```json
{
  "session_id": "abc-123",
  "transcript_path": "/Users/.../projects/.../abc-123.jsonl",
  "cwd": "/Users/.../repo",
  "prompt": "The actual user prompt text"
}
```

**How To Do It:**
1. Create `.claude/hooks/UserPromptSubmit.sh`:
   ```bash
   #!/bin/bash
   # Read JSON from stdin, extract transcript_path
   jq -r '.transcript_path' | tee .observability/cc_transcript_path.txt
   ```
2. At harvest time, read `.observability/cc_transcript_path.txt` instead of discovery
3. Validate: `sessionId` in file matches hook's `session_id`

**Known Issues:**
- [BUG] Hooks receive stale `session_id` and `transcript_path` in some versions ([GitHub](https://github.com/anthropics/claude-code/issues/9188))
- Mitigation: Validate hook output before trusting it

**Status:** DEFERRED to Phase 2. Current `cwd` matching is sufficient for Test 3.

---

### 22. Path Canonicalization for Production

**What:** Canonicalize file paths before comparison to handle symlinks and subdirectory launches.

**Why We Need It:**
- macOS often uses symlinks (e.g., `/var` → `/private/var`)
- User might launch CC from a subdirectory, so `cwd` = `repo/subdir`
- Strict equality comparison will false-positive kill

**What It Solves:**
- Symlinked paths failing match (`/Users/.../repo` vs `/Volumes/.../repo`)
- Subdirectory launches (`repo/subdir` should match `repo`)

**How To Do It:**
```bash
# Canonicalize repo root
REPO_ROOT_REAL=$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$REPO_ROOT")

# Use prefix match instead of equality
CWD_MATCH=$(jq -r --arg root "$REPO_ROOT_REAL" \
  'select(.cwd | startswith($root)) | .cwd' "$CC_JSONL_PATH" | head -1)
```

**Status:** TODO for production hardening (Fix 10 in V4.1).

---

### 23. Full OTEL Collector Pipeline (Not Needed)

**What:** Set up a full OpenTelemetry collector with spans, traces, and exporters.

**Why We DON'T Need It (Phase 1):**
- Native JSONL logs from CC and CX are already structured and authoritative
- OTEL adds complexity without adding data quality
- Our current export scripts produce valid OTEL JSON directly from JSONL

**When We MIGHT Need It:**
- Multi-machine deployments where agents run on different hosts
- Integration with Arize/LangSmith/Jaeger for visualization
- Real-time streaming to observability backends

**Status:** NOT DOING for Phase 1. Revisit if dashboard needs real-time OTEL emission.

---

### 24. AG/Gemini Native OTEL via .gemini/settings.json

**What:** Enable Gemini CLI's built-in OTEL telemetry via config file.

**Why It's Out of Scope:**
- Antigravity is an Electron app, NOT Gemini CLI
- AG doesn't read `.gemini/settings.json`
- We use CDP-based DOM scraping (`ag.js read`) for AG

**What We Do Instead:**
- Current: `ag.js watch` polls AG via CDP and logs to `.gemini/ag_telemetry.log`
- This captures AG's conversation but not structured API payloads

**When Gemini CLI Telemetry Matters:**
- If we add Gemini CLI as 4th agent (Item 13 in ROADMAP)
- Gemini CLI DOES read `.gemini/settings.json` and can emit OTEL

**Reference:** [Gemini CLI Telemetry Docs](https://google-gemini.github.io/gemini-cli/docs/cli/telemetry.html)

**Status:** OUT OF SCOPE for AG. Relevant only if Gemini CLI becomes an agent.

---

### 25. Codex `history.jsonl` as Primary for Prompts

**What:** Use `$CODEX_HOME/history.jsonl` for conversational prompts, rollout JSONL for tool trajectory.

**Why This Matters:**
- `history.jsonl` has simpler schema: `{session_id, ts, text}`
- `rollout-*.jsonl` has complex nested structure: `payload.content[0].text`
- For evals, we mainly need prompt/response text, not full tool trajectory

**How To Do It:**
```bash
# For prompt extraction (simpler):
jq -r 'select(.role == "user") | .text' "$CODEX_HOME/history.jsonl"

# For full trajectory (complex):
jq -r 'select(.payload.role == "user") | .payload.content[0].text' "$CODEX_HOME/sessions/**/rollout-*.jsonl"
```

**Status:** NOTED. Current implementation uses rollout files; consider switching to history.jsonl for simpler extraction.

---

### 26. Schema Drift Monitoring

**What:** Add automated checks that CC/CX JSONL schemas haven't changed.

**Why We Need It:**
- Our field dependencies (`type`, `message.content`, `cwd` for CC; `payload.role` for CX) are empirically stable but NOT API-guaranteed
- A silent schema change could break extraction without warning

**How To Do It:**
1. On each harvest, validate expected fields exist:
   ```bash
   # Verify CC schema
   jq 'select(.type == "user") | has("message", "cwd")' cc_native.jsonl | grep -q true || echo "SCHEMA DRIFT"

   # Verify CX schema
   jq 'select(.payload.role == "user") | .payload | has("content")' cx_native.jsonl | grep -q true || echo "SCHEMA DRIFT"
   ```
2. Add to tripwire checks in `verify-harvest.sh`

**Status:** TODO for production hardening.

---


---

Historical lessons and incident logs have been moved to `historical.md`.
