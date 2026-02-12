# Internals Conformance & Anti-Regression Checklist

**Version:** 1.9
**Date:** 2026-02-12
**Authors:** Claude Code (CC), with reviews by AG, Codex, and Gemini
**Purpose:** Comprehensive checklist for AI agents to verify conformance and prevent regressions

---

> **NOTE:** This document was created for the original Interlateral development.
> Review and adapt these standards for your own project needs. Some references
> may be specific to the original development context.

---

## Quad-Agent Mesh Conformance

**As of 2026-01-28, the architecture is a Quad-Agent Mesh.** This supersedes the "Tri-Agent" terminology in older sections of this document.

| Component | Description | Conformance Check |
|---|---|---|
| **Gemini CLI (Gemini)** | Fourth agent in the mesh, operating as a CLI. Role is defined at runtime. | `gemini --version` |
| `GEMINI.md` | System context file for the Gemini CLI agent. Contains critical boot instructions and operational constraints. | `[ -f GEMINI.md ]` |
| `gemini.js` | Node.js control script for sending messages to the Gemini CLI agent. Uses `tmux send-keys`. | `node interlateral_dna/gemini.js status` |

### Quad-Agent Communication Routes

The addition of the Gemini agent expands the communication matrix. All agents can communicate with each other via their respective control scripts (`ag.js`, `cc.js`, `codex.js`, `gemini.js`).

- **CC -> Gemini:** `node interlateral_dna/gemini.js send "..."`
- **Gemini -> CC:** `node interlateral_dna/cc.js send "..."`
- **AG -> Gemini:** `node interlateral_dna/gemini.js send "..."`
- **Gemini -> AG:** `node interlateral_dna/ag.js send "..."`
- **Codex -> Gemini:** `node interlateral_dna/gemini.js send "..."`
- **Gemini -> Codex:** `node interlateral_dna/codex.js send "..."`

**CRITICAL:** Direct writes to `comms.md` are for logging. True asynchronous communication relies on invoking the target agent's control script.

---

## Table of Contents

* [Quad-Agent Mesh Conformance](#quad-agent-mesh-conformance)
0. [Quick Start Matrix (By Change Type)](#0-quick-start-matrix-by-change-type)
1. [Philosophy Conformance](#1-philosophy-conformance)
2. [Architecture Invariants](#2-architecture-invariants)
3. [Wake-Up Protocol Conformance](#3-wake-up-protocol-conformance)
4. [Quad-Agent Coordination Invariants](#4-quad-agent-coordination-invariants)
5. [Observability System Checks](#5-observability-system-checks)
6. [Dashboard Conformance](#6-dashboard-conformance)
7. [Plugin Architecture (CRITICAL)](#7-plugin-architecture-critical)
8. [Injection Mechanisms](#8-injection-mechanisms)
9. [Configuration Integrity](#9-configuration-integrity)
10. [Dependencies Verification](#10-dependencies-verification)
11. [Fragile Components Protection](#11-fragile-components-protection)
12. [Security Compliance](#12-security-compliance)
13. [Known Failure Mode Awareness](#13-known-failure-mode-awareness)
14. [Automated Conformance Script](#14-automated-conformance-script)
15. [Evaluation Conformance](#15-evaluation-conformance-high)
16. [Agent Communication & Autonomy Guidelines](#16-agent-communication--autonomy-guidelines)
16.5 [Claude Model Selection Policy](#165-claude-model-selection-policy-high)
17. [Agent Skills Conformance](#17-agent-skills-conformance)
18. [Git Workflow for Template-Cloned Repos](#18-git-workflow-for-template-cloned-repos-critical)

---

## How to Use This Checklist

### For AI Agents (CC, AG, Codex)

**CRITICAL: Don't skip this checklist due to length. Use Section 0 to find the minimum checks for your change type.**

**Before making ANY changes:**
1. Identify your change type in Section 0
2. Run the minimum required checks for that type
3. If touching multiple areas, union the checks
4. Run `./scripts/conformance-check.sh` for automated verification

**After making changes:**
1. Run ALL verification commands in affected sections
2. Run `npm run build` in `interlateral_comms_monitor/ui` if touching frontend
3. Run `tsc --noEmit` in `interlateral_comms_monitor/ui` if touching TypeScript
4. If ANY check fails, STOP and investigate
5. Do NOT commit until all relevant checks pass

### Severity Levels

| Level | Meaning | Action Required |
|-------|---------|-----------------|
| **CRITICAL** | Breaking this destroys core functionality | NEVER break; escalate to human if unavoidable |
| **HIGH** | Breaking this causes significant user impact | Avoid; requires explicit human approval |
| **MEDIUM** | Breaking this degrades experience | Fix before PR; document workaround if urgent |
| **LOW** | Breaking this causes minor inconvenience | Note in commit message; fix when convenient |

### Technical Definitions

| Term | Definition |
|------|------------|
| **Fresh Terminal** | A new shell with no inherited env vars. Verify: `echo $CC_TMUX_SESSION` returns empty. |
| **System Ready** | All ports respond AND functional tests pass (not just port open) |
| **Repo Root** | `$REPO_ROOT` (adjust per clone) |

---

## 0. Quick Start Matrix (By Change Type)

**Use this section to find the MINIMUM checks required for your change type.**

| Change Type | Required Sections | Minimum Checks |
|-------------|-------------------|----------------|
| **Docs-only** | 4.1 | comms.md format if editing coordination docs |
| **Skin-only** | 7, 14 | T5 test + `tsc --noEmit` + `npm run build` |
| **Backend-only** | 6, 14 | API endpoints + WebSocket + watcher tests |
| **Scripts-only** | 1, 3, 13.5, 14 | One-command autonomy + bootstrap + tmux socket checks + conformance script |
| **Control scripts** | 4, 8, 13.5, 14 | Injection tests + comms.md logging + delay checks + tmux socket |
| **Config files** | 9, 11 | Fragile component check + dependency verification |
| **Multi-area** | Union of above | Run full conformance script |
| **Skills-only** | 17, 14 | YAML frontmatter + tool-specific paths + build validation |
| **PR to upstream** | 18 | Branch from upstream/main, not origin |

### Quick Decision Tree

```
Did you change...
├── *Skin.tsx files? → Run Section 7 checks + build validation
├── ag.js/cc.js/codex.js/gemini.js? → Run Section 8 + 13.5 checks (tmux socket!)
├── wake-up.sh/bootstrap-full.sh? → Run Section 1 + 3 + 13.5 checks (tmux socket!)
├── open-tmux-window.sh? → Run Section 13.5 checks (CRITICAL: dual tmux server)
├── comms.md format? → Run Section 4.1 format validator
├── Dashboard server/? → Run Section 6 checks
├── Any TypeScript? → Run `tsc --noEmit`
├── *SKILL.md files? → Run Section 17 checks (frontmatter, paths)
├── PR to template upstream? → Run Section 18 workflow (CRITICAL: rebase won't help)
└── Unsure? → Run full `./scripts/conformance-check.sh`
```

---

## 1. Philosophy Conformance

### 1.1 ONE-COMMAND AUTONOMY (CRITICAL)

**The Core Promise:** Human runs ONE command, system does EVERYTHING else.

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 1.1.1 | `./scripts/wake-up.sh` starts the complete system | CRITICAL | Run from fresh terminal (verify `$CC_TMUX_SESSION` is unset), confirm all components start |
| 1.1.2 | CC never tells human to run setup commands | CRITICAL | Grep agent output for prohibited phrases (see 1.1.5) |
| 1.1.3 | `bootstrap-full.sh` is called by `wake-up.sh` (not commented out) | CRITICAL | `grep -E "^[^#]*bootstrap-full" scripts/wake-up.sh` |
| 1.1.4 | CC wakes up to a READY system (functional, not just ports open) | CRITICAL | Verify WebSocket connects, AG workspace open, tmux sessions active |
| 1.1.5 | No prohibited phrases in agent output | HIGH | Scan for: "run npm install", "start dashboard", "please run", "you need to" |

**Dynamic Verification (not just static grep):**
```bash
# Verify bootstrap actually runs (not just exists in file)
./scripts/wake-up.sh "test" &
sleep 5
pgrep -f "bootstrap-full" && echo "PASS: bootstrap spawned" || echo "FAIL: bootstrap not spawned"
```

**Regression Signal:** If you find yourself writing instructions like "Please run npm install" or "Start the dashboard first", YOU HAVE REGRESSED. Add a check to 1.1.5 prohibited phrases.

### 1.2 Failure as Signal (HIGH)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 1.2.1 | Agents attempt operations before asking permission | HIGH | Review agent behavior - are they trying first? |
| 1.2.2 | Error messages are actionable, not just descriptive | HIGH | Check error handling includes "To fix: ..." |
| 1.2.3 | Graceful degradation when optional components missing | HIGH | Test with Codex uninstalled - system should still work |

### 1.3 Observability from Birth (MEDIUM)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 1.3.1 | Session recording starts before CC starts | MEDIUM | Check `.observability/casts/` has file with timestamp > CC start |
| 1.3.2 | Log rotation happens automatically | MEDIUM | `./scripts/rotate-logs.sh` runs without error |
| 1.3.3 | Telemetry capture enabled for all agents | MEDIUM | Verify files exist AND have recent content (< 5 min old) |

**Freshness Check:**
```bash
# Verify telemetry is fresh, not stale
find interlateral_dna/cc_telemetry.log -mmin -5 && echo "FRESH" || echo "STALE"
find interlateral_dna/codex_telemetry.log -mmin -5 && echo "FRESH" || echo "STALE (ok if Codex inactive)"
find .gemini/ag_telemetry.log -mmin -5 && echo "FRESH" || echo "STALE (verify ag.js watch is running)"
find .gemini/telemetry.log -mmin -5 && echo "FRESH" || echo "STALE (verify Gemini CLI is active)"
```

---

## 2. Architecture Invariants

### 2.1 Component Relationships (HIGH)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 2.1.1 | CC controls AG via `ag.js` (CDP on port 9222) | HIGH | `node interlateral_dna/ag.js status` shows workspace name |
| 2.1.2 | AG controls CC via `cc.js` (tmux send-keys) | HIGH | `node interlateral_dna/cc.js status` shows CC running (not idle shell) |
| 2.1.3 | All agents can control Codex via `codex.js` | HIGH | `node interlateral_dna/codex.js status` shows Codex running |
| 2.1.4 | Dashboard watches files and serves via WebSocket | HIGH | WebSocket connects AND receives events within 5s of file change |

**Note on AG capabilities:** Antigravity (AG) is a GUI-based application and does not have a native shell environment. Therefore, it **cannot** directly execute Node.js control scripts (`cc.js`, `codex.js`, `gemini.js`). Its ability to communicate with other agents is implemented via internal mechanisms that are triggered by user interactions or other events within the AG application, which then invoke the appropriate control scripts.


### 2.2 Data Flow Integrity (HIGH)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 2.2.1 | `interlateral_dna/comms.md` is the shared coordination log | HIGH | Verify all agents write to same file path |
| 2.2.2 | `interlateral_dna/ag_log.md` contains CC -> AG message history | HIGH | Check after `node ag.js send "test"` |
| 2.2.3 | Dashboard events stream from file watchers | HIGH | Add line to `interlateral_dna/comms.md`, verify appears in UI within 2s |

### 2.3 Port Assignments (CRITICAL)

**Always use `127.0.0.1` not `localhost` to avoid IPv4/IPv6 ambiguity.**

| Port | Service | Check Command |
|------|---------|---------------|
| 9222 | AG CDP | `curl -s http://127.0.0.1:9222/json/list \| head -1` |
| 3001 | Dashboard Backend | `curl -s http://127.0.0.1:3001/api/streams/status` |
| 5173 | Dashboard Frontend | `curl -s http://127.0.0.1:5173 \| head -1` |

**NEVER change these ports without updating ALL of:**
- `interlateral_dna/ag.js` (hardcoded 9222)
- `scripts/bootstrap-full.sh` (checks all three)
- `interlateral_comms_monitor/server/index.js`
- `interlateral_comms_monitor/ui/vite.config.ts`
- `interlateral_comms_monitor/docs/INTERNALS_GUIDE.md`
- `interlateral_comms_monitor/docs/USER_GUIDE.md`
- `README.md`

---

## 3. Wake-Up Protocol Conformance

### 3.1 Boot Sequence (CRITICAL)

| # | Step | Must Happen | Verification |
|---|------|-------------|--------------|
| 3.1.1 | CC reads CLAUDE.md first | Always | Check CC's first file read in transcript |
| 3.1.2 | CC reads README.md Part 2 | Always | Find Wake-Up Protocol instructions |
| 3.1.3 | CC checks `dev_plan/dev_plan.md` | Always | Assignment detection |
| 3.1.4 | CC verifies system is FUNCTIONAL (not just ports) | Always | AG workspace open, WebSocket events flow, tmux active |
| 3.1.5 | CC seeks ACK from other agents | If lead | Check `interlateral_dna/leadership.json` for `lead` value |

### 3.2 Leadership Protocol (HIGH)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 3.2.1 | `interlateral_dna/leadership.json` is the source of truth | HIGH | File exists and is valid JSON |
| 3.2.2 | Lead agent seeks ACK from followers with timeout | HIGH | Check comms.md for ACK pattern within `ack_timeout_seconds` |
| 3.2.3 | ACK timeout triggers fallback behavior | HIGH | Test with offline agent |
| 3.2.4 | Crash recovery distinguishes "Fresh Start" vs "Resume" | HIGH | Verify CC doesn't assume prior state after restart |

**Leadership State vs File:**
```bash
# File says CC is lead, but is CC actually running?
lead=$(jq -r '.lead' interlateral_dna/leadership.json)
if [ "$lead" = "cc" ]; then
    node interlateral_dna/cc.js status | grep -q "YES" && echo "VALID: CC is lead and running" || echo "INVALID: CC is lead but not running"
fi
```

### 3.3 Dev Plan Detection (HIGH)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 3.3.1 | `dev_plan/dev_plan.md` is the task source | HIGH | Location must not change |
| 3.3.2 | Template text means "no assignment" | HIGH | Contains "NO ACTIVE DEV PLAN" or similar |
| 3.3.3 | Real content triggers immediate work | HIGH | CC should start working, not ask for tasks |

---

## 4. Quad-Agent Coordination Invariants

### 4.1 Message Format (HIGH)

**Required Format (Strict):**
```markdown
[AGENT] @TARGET [YYYY-MM-DD HH:MM:SS]
Your message content here.

---
```

**Format Validation Regex:**
```regex
# Allows single or multiple targets (e.g., @AG @Codex) and both timestamp formats
^\[(?:CC|AG|Codex|Gemini)\] @(?:CC|AG|Codex|Gemini|HUMAN|ALL)(?: @(?:CC|AG|Codex|Gemini|HUMAN|ALL))* \[\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}\]
```

**Note:** The regex allows multiple targets like `@AG @Codex` and both `YYYY-MM-DD HH:MM:SS` and `YYYY-MM-DDTHH:MM:SS` formats.

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 4.1.1 | All comms.md entries follow strict format | HIGH | Run format validator (see Section 14) |
| 4.1.2 | Agent identifiers are CC, AG, Codex, Gemini, HUMAN only | HIGH | No other agent names |
| 4.1.3 | Timestamps are strict ISO format | HIGH | `YYYY-MM-DD HH:MM:SS` or `YYYY-MM-DD THH:MM:SS` |
| 4.1.4 | Entries end with `---` separator | HIGH | Required for parser |
| 4.1.5 | No orphaned multi-line blocks | MEDIUM | Each entry is self-contained |

### 4.2 Control Scripts (CRITICAL)

| Script | Location | Transport | Logs to |
|--------|----------|-----------|---------|
| `ag.js` | `interlateral_dna/ag.js` | CDP/Puppeteer | `ag_log.md` (not comms.md) |
| `cc.js` | `interlateral_dna/cc.js` | tmux send-keys | `comms.md` |
| `codex.js` | `interlateral_dna/codex.js` | tmux send-keys | `comms.md` |
| `gemini.js` | `interlateral_dna/gemini.js` | tmux send-keys | `comms.md` |

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 4.2.1 | Each script has `send` command | CRITICAL | `node X.js send "test"` succeeds |
| 4.2.2 | Each script has `status` command | CRITICAL | `node X.js status` shows meaningful output |
| 4.2.3 | cc.js and codex.js log to comms.md | HIGH | Check comms.md after send |
| 4.2.4 | tmux scripts use 1-second delay | CRITICAL | `grep -E "^[^#]*sleep 1" interlateral_dna/cc.js` |

> **CRITICAL:** Agents must ALWAYS use control scripts (`cc.js`, `ag.js`, `codex.js`, `gemini.js`) to communicate. Writing to `comms.md` alone does NOT wake up sleeping agents. See Section 16.1.

### 4.3 Bidirectional Communication (CRITICAL)

**Injection Verification Test:**
```bash
# Round-trip test: Send unique ID, verify receipt
# NOTE: This tests that cc.js logged the message, NOT that CC received it.
# For true verification, check tmux pane output or wait for agent reply.
TEST_ID="TEST_$(date +%s)"
node interlateral_dna/cc.js send "PING $TEST_ID"
sleep 3
grep -q "$TEST_ID" interlateral_dna/comms.md && echo "LOGGED (check pane for actual receipt)" || echo "FAIL"
```

**Limitation:** The above test verifies the script logged the message, but injection can still fail if:
- The tmux pane is not focused
- CC is not running in the session
- Heavy system load causes buffer issues

For full verification, also check: `tmux capture-pane -t interlateral-claude -p | grep "$TEST_ID"`

### 4.4 Session Boundary Markers (HIGH)

**Purpose:** Prevent agents from resuming stale tasks after a restart.

**Behavior:** `bootstrap-full.sh` appends a fresh session marker to `interlateral_dna/comms.md` on every wake-up:
```markdown
# === NEW SESSION: <timestamp> ===
# All agents: Content above this marker is ARCHIVE for historical reference. Fresh start.
```

**Rule:** All agents MUST treat content **above** the latest marker as ARCHIVE. Do NOT continue prior tasks unless explicitly re-issued after the newest marker.

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 4.4.1 | Marker present in comms.md | HIGH | `rg -n "=== NEW SESSION:" interlateral_dna/comms.md | tail -1` |
| 4.4.2 | Agents acknowledge fresh start | HIGH | Look for new ACKs after marker |

| Route | Method | Test Command |
|-------|--------|--------------|
| CC -> AG | CDP | `node interlateral_dna/ag.js send "Ping"` |
| CC -> Codex | tmux | `node interlateral_dna/codex.js send "Ping"` |
| AG -> CC | tmux | `node interlateral_dna/cc.js send "Ping"` |
| AG -> Codex | tmux | `node interlateral_dna/codex.js send "Ping"` |
| Codex -> CC | tmux | `node interlateral_dna/cc.js send "Ping"` |
| Codex -> AG | CDP | `node interlateral_dna/ag.js send "Ping"` |

**CRITICAL:** Agents must ALWAYS use control scripts, not just write to comms.md. Writing to comms.md alone does NOT wake up sleeping agents.

---

## 5. Observability System Checks

### 5.1 Data Capture (MEDIUM)

| Data Type | Location | Freshness Check |
|-----------|----------|-----------------|
| Terminal recordings | `.observability/casts/` | `find .observability/casts/ -name "*.cast" -mmin -60` |
| CC transcripts | `~/.claude/projects/...` | `./scripts/discover-cc-logs.sh` |
| AG telemetry | `.gemini/ag_telemetry.log` | `find .gemini/ag_telemetry.log -mmin -60` |
| CC terminal | `interlateral_dna/cc_telemetry.log` | `find interlateral_dna/cc_telemetry.log -mmin -5` |
| Codex terminal | `interlateral_dna/codex_telemetry.log` | `find interlateral_dna/codex_telemetry.log -mmin -5` |

### 5.2 Telemetry Pipe-Pane Setup (HIGH)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 5.2.1 | CC tmux session has pipe-pane active | HIGH | `tmux show-options -t interlateral-claude \| grep pipe` |
| 5.2.2 | Codex tmux session has pipe-pane active | HIGH | `tmux show-options -t interlateral-codex \| grep pipe` |
| 5.2.3 | ag.js watch is running | HIGH | `pgrep -f "ag.js watch"` |
| 5.2.4 | Telemetry logs have content | HIGH | `wc -l interlateral_dna/*_telemetry.log .gemini/ag_telemetry.log` |

### 5.3 Log Rotation Resiliency (MEDIUM)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 5.3.1 | Rotation script exists | MEDIUM | `ls scripts/rotate-logs.sh` |
| 5.3.2 | Watchers survive log rotation | MEDIUM | Rotate logs, verify events still stream |
| 5.3.3 | Watchers survive log truncation | MEDIUM | Truncate log, verify watcher recovers |

**Rotation Test:**
```bash
# Test watcher survives rotation
echo "PRE_ROTATE" >> interlateral_dna/comms.md
./scripts/rotate-logs.sh
echo "POST_ROTATE" >> interlateral_dna/comms.md
# Verify both appear in dashboard
```

---

## 6. Dashboard Conformance

### 6.1 Backend API (HIGH)

| Endpoint | Method | Expected Response |
|----------|--------|-------------------|
| `/api/streams/status` | GET | `{"status": {...}}` with all streams |
| `/api/events/history` | GET | Paginated events array |
| `/api/inject` | POST | `{"success": true}` |
| `/api/inject/status` | GET | Session availability for all targets |

**Verification (no jq required):**
```bash
# Backend health
curl -s http://127.0.0.1:3001/api/streams/status | grep -q "status" && echo "OK" || echo "FAIL"

# Injection status
curl -s http://127.0.0.1:3001/api/inject/status | grep -q "cc" && echo "OK" || echo "FAIL"
```

### 6.2 WebSocket (HIGH)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 6.2.1 | WebSocket connects on page load | HIGH | Browser DevTools Network tab shows WS |
| 6.2.2 | Events stream within 2s of file change | HIGH | Add to comms.md, time to UI appearance |
| 6.2.3 | Reconnection works after disconnect | HIGH | Kill backend, restart, verify auto-reconnect |

### 6.3 AG UI State Verification (HIGH)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 6.3.1 | AG workspace is open (not Launchpad) | HIGH | `node interlateral_dna/ag.js status` shows project name |
| 6.3.2 | Agent Manager panel is visible | HIGH | `node interlateral_dna/ag.js screenshot /tmp/ag.png` shows chat input |
| 6.3.3 | Injection targets correct window | HIGH | Send test message, verify appears in correct panel |

---

## 7. Plugin Architecture (CRITICAL)

### 7.1 The Guarantee (CRITICAL - MUST NOT REGRESS)

**These behaviors MUST be preserved:**

| # | Guarantee | Severity | Test |
|---|-----------|----------|------|
| 7.1.1 | Drop `*Skin.tsx` -> refresh -> appears in dropdown | CRITICAL | T5 test (see below) |
| 7.1.2 | No changes to `App.tsx` required | CRITICAL | `git diff ui/src/App.tsx` after skin add |
| 7.1.3 | No changes to `index.ts` required | CRITICAL | Glob pattern unchanged |
| 7.1.4 | Hot reload works in development | CRITICAL | Edit skin, see change without refresh |
| 7.1.5 | Build succeeds with new skin | CRITICAL | `npm run build` passes |
| 7.1.6 | TypeScript compiles | CRITICAL | `tsc --noEmit` passes |

### 7.2 File Pattern (CRITICAL)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 7.2.1 | Glob pattern is `./*Skin.tsx` | CRITICAL | `grep "\\*Skin\\.tsx" interlateral_comms_monitor/ui/src/skins/index.ts \| grep -v "^[[:space:]]*//"` |
| 7.2.2 | Pattern uses `{ eager: true }` | CRITICAL | Modules load immediately |
| 7.2.3 | Files must match pattern exactly | CRITICAL | `MySkin.tsx` not `my-skin.tsx` |

### 7.3 Required Exports (CRITICAL)

Every skin MUST export:

```typescript
// Named export
export const meta: SkinMeta = {
  id: 'unique-id',      // Required, lowercase-with-hyphens
  name: 'Display Name', // Required
  description: '...',   // Required
  icon: '...',          // Optional
};

// Default export
export default function MySkin({ events, containerRef }: SkinProps) { ... }
```

| # | Check | Severity | If Missing |
|---|-------|----------|------------|
| 7.3.1 | `meta` export exists | CRITICAL | Skin not registered, console warning |
| 7.3.2 | `default` export exists | CRITICAL | Skin not registered, console warning |
| 7.3.3 | `meta.id` is unique | HIGH | Conflicts with other skins |

### 7.4 Interface Stability (CRITICAL)

| Interface | Change Policy | Reason |
|-----------|---------------|--------|
| `SkinProps` | Add optional props ONLY | Existing skins break if required props added |
| `SkinMeta` | Add optional fields ONLY | Registration breaks |
| `StreamEvent` | Add optional fields ONLY | Parsing breaks |

**NEVER:**
- Remove fields from interfaces
- Change field types
- Make optional fields required
- Rename existing fields

### 7.5 Build Validation (CRITICAL)

**Run after ANY skin or TypeScript change:**

```bash
cd interlateral_comms_monitor/ui
tsc --noEmit && echo "TypeScript OK" || echo "TypeScript FAIL"
npm run build && echo "Build OK" || echo "Build FAIL"
```

### 7.6 T5 Plugin Test (CRITICAL)

**Execute after ANY skin-related change:**

1. Create test file: `echo 'export const meta = {id:"test",name:"Test",description:"Test"}; export default () => <div>Test</div>;' > ui/src/skins/TestSkin.tsx`
2. Refresh browser (no restart needed)
3. Verify "Test" appears in skin dropdown
4. Delete: `rm ui/src/skins/TestSkin.tsx`
5. Verify skin disappears on refresh

---

## 8. Injection Mechanisms

### 8.1 tmux Injection (CRITICAL)

**The 1-Second Delay Rule:**

```bash
# CORRECT - Always use this pattern
tmux send-keys -t SESSION "message" && sleep 1 && tmux send-keys -t SESSION Enter

# WRONG - Causes race condition, message appears but doesn't submit
tmux send-keys -t SESSION "message" Enter
```

> **Note:** The same 1-second delay is required for ALL CLI agents (cc.js, codex.js, gemini.js). The delay is critical because CLI agents have an input buffer race condition where Enter fires before the text is ready.

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 8.1.1 | cc.js uses 1-second delay (not commented) | CRITICAL | `grep -E "^[^#]*sleep 1" interlateral_dna/cc.js` |
| 8.1.2 | codex.js uses 1-second delay (not commented) | CRITICAL | `grep -E "^[^#]*sleep 1" interlateral_dna/codex.js` |
| 8.1.3 | Special characters are escaped | HIGH | Test: `node cc.js send 'test$var\`cmd\`'` |
| 8.1.4 | Injection lands in correct pane | HIGH | `node interlateral_dna/cc.js status` shows CC running |

**Load Test (Optional but recommended):**
```bash
# Verify injection works under load
(npm run build &) && sleep 2 && node interlateral_dna/cc.js send "LOAD_TEST"
# Verify message appears in CC
```

### 8.2 CDP Injection (HIGH)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 8.2.1 | ag.js connects to port 9222 | HIGH | `grep -E "^[^#]*9222" interlateral_dna/ag.js` |
| 8.2.2 | Puppeteer targets workspace, not Launchpad | HIGH | `node interlateral_dna/ag.js status` shows project name |
| 8.2.3 | Agent Manager panel must be visible | HIGH | Screenshot verification |

### 8.3 Environment Variables (MEDIUM)

| Variable | Default | Used By |
|----------|---------|---------|
| `CC_TMUX_SESSION` | `interlateral-claude` | cc.js, bootstrap-full.sh |
| `CLAUDE_MODEL` | `opus` | logged-claude.sh (used by wake-up scripts) |
| `CODEX_TMUX_SESSION` | `interlateral-codex` | codex.js, bootstrap-full.sh |
| `GEMINI_TMUX_SESSION` | `interlateral-gemini` | gemini.js, bootstrap-full.sh |
| `GEMINI_MODEL` | `gemini-3-flash-preview` | bootstrap-full.sh, bootstrap-full-no-ag.sh |

---

## 9. Configuration Integrity

### 9.1 Configuration File Locations (HIGH)

| File | Purpose | Change Impact |
|------|---------|---------------|
| `CLAUDE.md` | CC system instructions | CC behavior changes |
| `ANTIGRAVITY.md` | AG system instructions | AG behavior changes |
| `CODEX.md` | Codex system instructions | Codex behavior changes |
| `interlateral_dna/leadership.json` | Tri-agent leadership | Boot sequence changes |
| `dev_plan/dev_plan.md` | Task assignment | Work changes |

### 9.2 Package Dependencies (HIGH)

**Note:** `npm ls` may show peer dependency warnings - these are usually benign. Focus on missing required deps.

| Location | Check Command | Expected |
|----------|---------------|----------|
| `interlateral_dna/` | `npm ls --prefix interlateral_dna puppeteer-core` | puppeteer-core present |
| `interlateral_comms_monitor/server/` | `npm ls --prefix interlateral_comms_monitor/server express ws` | express, ws present |
| `interlateral_comms_monitor/ui/` | `npm ls --prefix interlateral_comms_monitor/ui react vite` | react, vite present |

### 9.3 Critical Dependencies (CRITICAL)

| Package | Location | Used For | Verify |
|---------|----------|----------|--------|
| `puppeteer-core` | interlateral_dna | CDP/AG control | `node -e "require('puppeteer-core')"` |
| `express` | server | Backend API | `node -e "require('express')"` |
| `ws` | server | WebSocket | `node -e "require('ws')"` |
| `react` | ui | Frontend | `npm ls react` |
| `vite` | ui | Build/dev server | `npm ls vite` |

---

## 10. Dependencies Verification

### 10.1 System Requirements (HIGH)

| Dependency | Minimum | Check Command | Install |
|------------|---------|---------------|---------|
| Node.js | 18+ | `node -v` | nodejs.org |
| npm | 9+ | `npm -v` | Comes with Node |
| tmux | any | `tmux -V` | `brew install tmux` |
| asciinema | 3.x (optional) | `asciinema --version` | `brew install asciinema` |

### 10.2 Applications (HIGH)

| Application | Location | Check (file exists) | Check (executable) |
|-------------|----------|---------------------|-------------------|
| Antigravity | /Applications/Antigravity.app | `ls -d /Applications/Antigravity.app` | CDP responds |
| Claude Code | npm global | `which claude` | `claude --version` |
| Codex (optional) | npm global | `which codex` | `codex --version` |

**Binary Existence Check:**
```bash
# Verify binaries actually exist and run (not just wrapper scripts)
which codex && codex --version || echo "Codex not installed (optional)"
which claude && claude --version || echo "Claude not installed (REQUIRED)"
```

### 10.3 First-Time Setup Verification (HIGH)

```bash
# Run after fresh clone
./scripts/first-time-setup.sh

# Should install:
# - interlateral_dna/node_modules
# - interlateral_comms_monitor/server/node_modules
# - interlateral_comms_monitor/ui/node_modules
# - .gemini/settings.json
```

---

## 11. Fragile Components Protection

### 11.1 Before Modifying Checklist (HIGH)

**Before modifying ANY component:**

- [ ] Read its entry in INTERNALS_GUIDE.md Section 11
- [ ] Check Section 0 matrix for required checks
- [ ] Identify what depends on it (see 11.3)
- [ ] Test in isolation first
- [ ] Run `./scripts/conformance-check.sh`
- [ ] Run build validation if TypeScript
- [ ] Update documentation if behavior changes

### 11.2 Fragile Component Registry (CRITICAL)

| Component | What Breaks | Safe Modification |
|-----------|-------------|-------------------|
| `*Skin.tsx` pattern | Skin auto-discovery | Never change glob |
| `SkinProps` interface | All existing skins | Add optional props only |
| `SkinMeta` interface | Skin registration | Add optional fields only |
| CDP port 9222 | AG control | Update ALL references (see 2.3) |
| tmux session names | Injection | Use env var override |
| comms.md format | Parsing, history | Run format validator |
| README Wake-Up Protocol | CC boot | Test with fresh CC |
| dev_plan.md location | Task finding | Update CLAUDE.md ref |

### 11.3 Dependency Graph (HIGH)

```
SkinProps <- All *Skin.tsx files
    |
  types.ts
    |
  index.ts (glob pattern)

ag.js <- puppeteer-core
  |
CDP port 9222 <- AG launch command <- bootstrap-full.sh

cc.js/codex.js <- tmux
  |
Session names <- bootstrap-full.sh, env vars

wake-up.sh -> bootstrap-full.sh -> AG, Dashboard, tmux
     |
  rotate-logs.sh
```

---

## 12. Security Compliance

### 12.1 Permission Model (HIGH)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 12.1.1 | Wake-up scripts default to `--dangerously-skip-permissions` for CC autonomy | HIGH | `grep -E 'Defaulting to --dangerously-skip-permissions' scripts/wake-up.sh scripts/wake-up-no-ag.sh` |
| 12.1.2 | Agents stay within repo directory | HIGH | Review file operations |
| 12.1.3 | No system file modifications | HIGH | No /etc, /usr, etc. |
| 12.1.4 | Logging cannot be disabled by agents | HIGH | tmux pipe-pane always active |

### 12.2 Injection Security (MEDIUM)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 12.2.1 | Special characters escaped in tmux | MEDIUM | No shell injection possible |
| 12.2.2 | Input validated before CDP injection | MEDIUM | No script injection |
| 12.2.3 | Dashboard injection on localhost only | MEDIUM | Not exposed to network |

**Note:** Dashboard currently has no authentication. Only run on localhost or trusted networks.

### 12.3 Cross-Team Auth Guardrail (CRITICAL)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 12.3.1 | Cross-team mode requires `BRIDGE_TOKEN` by default | CRITICAL | `CROSS_TEAM=true BRIDGE_TOKEN= bash scripts/wake-up.sh 2>&1 \| grep -q "ERROR"` |
| 12.3.2 | `BRIDGE_ALLOW_NO_AUTH=true` overrides the guardrail | HIGH | `CROSS_TEAM=true BRIDGE_ALLOW_NO_AUTH=true bash -n scripts/wake-up.sh` |
| 12.3.3 | Bootstrap also enforces the guardrail (defense-in-depth) | CRITICAL | `CROSS_TEAM=true BRIDGE_TOKEN= bash scripts/bootstrap-full.sh 2>&1 \| grep -q "BLOCKED"` |
| 12.3.4 | Bridge server rejects unauthenticated `/inject` when `BRIDGE_TOKEN` is set | CRITICAL | See Section 19.1.8 |

---

## 13. Known Failure Mode Awareness

### 13.1 Top 5 Critical Failures (from INTERNALS_GUIDE.md Section 14)

| Rank | Issue | Status | Agent Action |
|------|-------|--------|--------------|
| 1 | CC not in tmux | FIXED | wake-up.sh handles |
| 2 | AG on Launchpad | MITIGATED | ag.js warns, verify workspace |
| 3 | CC not attached | FIXED | cc.js verifies |
| 4 | Deps not installed | FIXED | first-time-setup.sh |
| 5 | Generic prompt | DOCUMENT | Use exact wake-up prompt |
| 6 | comms.md treated as communication | DOCUMENTED | Section 16.1 - use terminal injection |
| 7 | Gemini model/autonomy drift at startup | DOCUMENTED | Section 16.2 - pin `GEMINI_MODEL`, run bounded preflight smoke test, fail on explicit preflight errors, proceed on timeout, no silent downgrade |

### 13.2 Race Condition Awareness (CRITICAL)

| # | Race Condition | Mitigation | Verify |
|---|----------------|------------|--------|
| 13.2.1 | tmux text/Enter race | 1-second delay | `grep -E "^[^#]*sleep 1"` |
| 13.2.2 | AG startup timing | Polling with timeout | bootstrap-full.sh |
| 13.2.3 | Multiple bootstrap runs | Idempotent design | Run twice, no errors |

### 13.3 Deadlock Prevention (HIGH)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 13.3.1 | Leadership timeout configured | HIGH | `ack_timeout_seconds` > 0 in leadership.json |
| 13.3.2 | Fallback behavior configured | HIGH | `fallback` in leadership.json |
| 13.3.3 | Reset script exists and works | HIGH | `./scripts/reset-leadership.sh` |

### 13.4 Gemini CLI File Access (CRITICAL)

**Problem:** Gemini CLI respects `.gitignore` by default. This blocks access to gitignored directories like `projects/`, which are essential for agent work.

**Symptom:** Gemini reports "File path is ignored by configured ignore patterns" when trying to read files in `projects/` or other gitignored directories.

**Root Cause:** The `.gitignore` contains `projects/*` to keep the directory empty on GitHub, but Gemini CLI interprets this as "do not read".

**Solution:** The `.geminiignore` file explicitly allows access to working directories.

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 13.4.1 | `.geminiignore` exists | CRITICAL | `[ -f .geminiignore ] && echo OK` |
| 13.4.2 | `projects/` allowed | CRITICAL | `grep -q '!projects/' .geminiignore` |
| 13.4.3 | `.agent/` allowed | HIGH | `grep -q '!.agent/' .geminiignore` |
| 13.4.4 | `.observability/` allowed | HIGH | `grep -q '!.observability/' .geminiignore` |

**Maintenance Note:** When adding new working directories to `.gitignore`, you MUST also add a corresponding `!directory/` entry to `.geminiignore` to allow Gemini access.

**Quick Fix (if Gemini can't read a directory):**
```bash
# Add to .geminiignore:
echo '!new_directory/' >> .geminiignore
echo '!new_directory/**' >> .geminiignore
```

### 13.5 Dual tmux Server Problem (CRITICAL)

**Problem (historical):** The repo-local tmux socket (`TMUX_TMPDIR=.tmux`) created a *second* tmux server. Finder-launched `.command` files do not inherit `TMUX_TMPDIR`, so Terminal windows attached to the **system** socket while agents ran in the **repo-local** socket. This produced invisible sessions and missing ACKs.

**Current Fix (required):** Use the **system default tmux socket only**, and namespace session names to avoid collisions.

**Why:** macOS Finder opens `.command` wrappers in a fresh environment. Any reliance on `TMUX_TMPDIR` silently breaks window attachments. System socket + namespaced sessions always works.

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 13.5.1 | Bootstrap unsets TMUX | CRITICAL | `grep -E "^unset TMUX" scripts/bootstrap-full.sh` |
| 13.5.2 | Bootstrap does NOT export TMUX_TMPDIR | CRITICAL | `! grep -E "^export TMUX_TMPDIR" scripts/bootstrap-full.sh` |
| 13.5.3 | Bootstrap-no-ag does NOT export TMUX_TMPDIR | CRITICAL | `! grep -E "^export TMUX_TMPDIR" scripts/bootstrap-full-no-ag.sh` |
| 13.5.4 | open-tmux-window.sh uses system socket | CRITICAL | `grep -E "attach-session -t" scripts/open-tmux-window.sh` |
| 13.5.5 | Namespaced sessions exist | CRITICAL | `tmux has-session -t interlateral-claude && tmux has-session -t interlateral-codex` |
| 13.5.6 | No repo-local tmux dir is required | HIGH | `! test -d .tmux || echo "ok: optional"` |

**Debugging Commands:**
```bash
# Verify all agents are on the system socket
tmux list-sessions

# Verify agent is in correct session and repo
tmux capture-pane -t interlateral-codex -p | head -5
tmux display-message -p -t interlateral-codex "#{pane_current_path}"
```

**Fix Pattern (for any script using tmux now):**
```bash
# Always operate on system socket
unset TMUX
tmux has-session -t interlateral-claude 2>/dev/null
```

**Full Diagnosis:** See `projects/wakeup_fix/issue.md` for the complete bug report and fix.

---

## 14. Automated Conformance Script

**Location:** `scripts/conformance-check.sh`

This script automates the key conformance checks. Run it before any commit.

```bash
#!/bin/bash
# conformance-check.sh - Automated conformance verification
# Location: scripts/conformance-check.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0
WARN=0

check() {
    local name="$1"
    local cmd="$2"
    if eval "$cmd" > /dev/null 2>&1; then
        echo "  [PASS] $name"
        ((PASS++))
    else
        echo "  [FAIL] $name"
        ((FAIL++))
    fi
}

warn_check() {
    local name="$1"
    local cmd="$2"
    if eval "$cmd" > /dev/null 2>&1; then
        echo "  [PASS] $name"
        ((PASS++))
    else
        echo "  [WARN] $name (optional)"
        ((WARN++))
    fi
}

echo "=== Interlateral Conformance Check v1.1 ==="
echo "Repo: $REPO_ROOT"
echo ""

# Section 1: Philosophy
echo "[1] Philosophy Checks"
check "wake-up.sh exists" "[ -f scripts/wake-up.sh ]"
check "bootstrap-full not commented" "grep -E '^[^#]*bootstrap-full' scripts/wake-up.sh"

# Section 2: Architecture
echo "[2] Architecture Checks"
check "AG CDP (127.0.0.1:9222)" "curl -s --max-time 2 http://127.0.0.1:9222/json/list"
check "Dashboard backend (127.0.0.1:3001)" "curl -s --max-time 2 http://127.0.0.1:3001/api/streams/status"
warn_check "Dashboard frontend (127.0.0.1:5173)" "curl -s --max-time 2 http://127.0.0.1:5173"

# Section 3: Quad-Agent
echo "[3] Quad-Agent Checks"
# CRITICAL: Use system socket with namespaced sessions
check "CC tmux session exists" "tmux has-session -t interlateral-claude 2>/dev/null"
warn_check "Codex tmux session exists" "tmux has-session -t interlateral-codex 2>/dev/null"
warn_check "Gemini tmux session exists" "tmux has-session -t interlateral-gemini 2>/dev/null"
check "ag.js exists" "[ -f interlateral_dna/ag.js ]"
check "cc.js exists" "[ -f interlateral_dna/cc.js ]"
check "codex.js exists" "[ -f interlateral_dna/codex.js ]"
check "gemini.js exists" "[ -f interlateral_dna/gemini.js ]"
check "leadership.json valid JSON" "jq empty interlateral_dna/leadership.json 2>/dev/null || python3 -c 'import json; json.load(open(\"interlateral_dna/leadership.json\"))'"

# Section 4: Coordination
echo "[4] Coordination Checks"
check "comms.md exists" "[ -f interlateral_dna/comms.md ]"
check "ag_log.md exists" "[ -f interlateral_dna/ag_log.md ]"
warn_check "Session marker present" "rg -q '=== NEW SESSION:' interlateral_dna/comms.md"

# Section 7: Plugin Architecture
echo "[7] Plugin Architecture Checks"
check "Glob pattern correct" "grep '\\*Skin\\.tsx' interlateral_comms_monitor/ui/src/skins/index.ts | grep -v '^[[:space:]]*//' | head -1"
check "Skins exist" "ls interlateral_comms_monitor/ui/src/skins/*Skin.tsx"

# Section 8: Injection
echo "[8] Injection Checks"
check "cc.js has 1s delay (not commented)" "grep -E '^[^#]*sleep 1' interlateral_dna/cc.js"
check "codex.js has 1s delay (not commented)" "grep -E '^[^#]*sleep 1' interlateral_dna/codex.js"
check "gemini.js has 1s delay (not commented)" "grep -E '^[^#]*sleep 1' interlateral_dna/gemini.js"

# Section 9: Configuration
echo "[9] Configuration Checks"
check "CLAUDE.md exists" "[ -f CLAUDE.md ]"
check "GEMINI.md exists" "[ -f GEMINI.md ]"
check "dev_plan.md exists" "[ -f dev_plan/dev_plan.md ]"

# Section 10: Dependencies
echo "[10] Dependency Checks"
check "Node.js >= 18" "node -v | grep -E 'v(1[89]|[2-9][0-9])'"
check "tmux installed" "which tmux"
warn_check "Codex CLI installed" "which codex"
warn_check "Gemini CLI installed" "which gemini"
check "Claude CLI installed" "which claude"

# Section 13.5: Dual tmux Server (CRITICAL - prevents silent agent failures)
echo "[13.5] tmux Socket Checks"
check "Bootstrap unsets TMUX" "grep -E '^unset TMUX' scripts/bootstrap-full.sh"
check "Bootstrap does NOT export TMUX_TMPDIR" "! grep -E '^export TMUX_TMPDIR' scripts/bootstrap-full.sh"
check "Bootstrap-no-ag does NOT export TMUX_TMPDIR" "! grep -E '^export TMUX_TMPDIR' scripts/bootstrap-full-no-ag.sh"
check "open-tmux-window uses system socket" "grep -E 'attach-session -t' scripts/open-tmux-window.sh"
warn_check ".tmux directory absent (ok if missing)" "! test -d .tmux"

# Section 16: Agent Communication & Autonomy
echo "[16] Communication & Autonomy Checks"
check "CLAUDE.md comms.md warning" "grep -q 'FLAT FILE' CLAUDE.md"
check "CODEX.md comms.md warning" "grep -q 'FLAT FILE' CODEX.md"
check "GEMINI.md comms.md warning" "grep -q 'FLAT FILE' GEMINI.md"
check "bootstrap-full uses autonomy flag" "grep -E 'gemini (-y|--approval-mode=yolo)' scripts/bootstrap-full.sh"
check "Shared House Rule in CLAUDE.md" "grep -q 'SHARED HOUSE' CLAUDE.md"

# Section 17: Skills Conformance
echo "[17] Skills Conformance Checks"
check "Canonical skills dir exists" "[ -d .agent/skills ]"
check "Claude skills dir exists" "[ -d .claude/skills ]"
check "Codex skills dir exists" "[ -d .codex/skills ]"
check "Gemini skills dir/symlink exists" "[ -d .gemini/skills ] || [ -L .gemini/skills ]"
check "SKILLS_DEV_GUIDE.md exists" "[ -f interlateral_comms_monitor/docs/SKILLS_DEV_GUIDE.md ]"

# Verify skill counts match
expected=$(ls -d .agent/skills/*/ 2>/dev/null | wc -l | tr -d ' ')
with_name=$(grep -l "^name:" .agent/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
with_desc=$(grep -l "^description:" .agent/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
check "All skills have name field" "[ $expected -eq $with_name ]"
check "All skills have description field" "[ $expected -eq $with_desc ]"

# Check .DS_Store (include .gemini/skills only if real directory)
if [ -L .gemini/skills ]; then
  warn_check "No .DS_Store in skills" "[ \$(find .agent/skills .claude/skills .codex/skills -name '.DS_Store' 2>/dev/null | wc -l) -eq 0 ]"
else
  warn_check "No .DS_Store in skills" "[ \$(find .agent/skills .claude/skills .codex/skills .gemini/skills -name '.DS_Store' 2>/dev/null | wc -l) -eq 0 ]"
fi

# Build validation (if TypeScript files changed)
echo "[Build] Validation"
if [ -d "interlateral_comms_monitor/ui/node_modules" ]; then
    warn_check "TypeScript compiles" "cd interlateral_comms_monitor/ui && npx tsc --noEmit"
else
    echo "  [SKIP] TypeScript check (run npm install first)"
fi

echo ""
echo "=========================================="
echo "  PASS: $PASS  |  FAIL: $FAIL  |  WARN: $WARN"
echo "=========================================="

if [ $FAIL -gt 0 ]; then
    echo ""
    echo "CONFORMANCE CHECK FAILED"
    echo "Fix the failures above before committing."
    exit 1
else
    echo ""
    echo "CONFORMANCE CHECK PASSED"
    exit 0
fi
```

**Usage:**
```bash
./scripts/conformance-check.sh
```

---

## 15. Evaluation Conformance (HIGH)

This section covers the OTEL evaluation system that validates agent work quality.

### 15.1 Evals Prerequisites (HIGH)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 15.1.1 | `.env` file exists with `OPENAI_API_KEY` | HIGH | `grep -q "^OPENAI_API_KEY=" .env` |
| 15.1.2 | Python deps installed | HIGH | `python3 -c "import openai, jinja2, tenacity"` |
| 15.1.3 | Evals skill exists at canonical location | HIGH | `[ -f .agent/skills/evals/SKILL.md ]` |
| 15.1.4 | Eval packs available | HIGH | `ls corpbot_agent_evals/lake_merritt/examples/eval_packs/*.yaml` |
| 15.1.5 | Run script executable | HIGH | `[ -x scripts/run-skill-eval.sh ]` |

### 15.2 Evals Output Validation (HIGH)

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 15.2.1 | OTEL traces exist | HIGH | `ls .observability/traces/*.json` |
| 15.2.2 | Eval reports generated | HIGH | `ls .observability/evals/*.md` after running |
| 15.2.3 | JSON reports valid | HIGH | `jq empty .observability/evals/*.json` |
| 15.2.4 | No MOCK fallback (real LLM used) | HIGH | Reports should NOT contain "MOCK_PASS" |

### 15.3 When to Run Evals (MEDIUM)

| # | Trigger | Required Packs | Action if Fails |
|---|---------|----------------|-----------------|
| 15.3.1 | After dev-collaboration skill | revision_addressed, reviewer_minimum, approval_chain | Review feedback, iterate |
| 15.3.2 | Before reporting "done" | All relevant packs | Address issues first |
| 15.3.3 | When human asks for evals | As specified in prompt | Report results |

### 15.4 Known Eval Failure Modes (HIGH)

| # | Issue | Symptom | Mitigation |
|---|-------|---------|------------|
| 15.4.1 | Missing API key | `AuthenticationError` | Check `.env` has valid `OPENAI_API_KEY` |
| 15.4.2 | No traces exist | "No trace found" message | Ensure observability was active during work |
| 15.4.3 | Trace too large | Prompt size exceeded | Use trace-level packs or filter spans |
| 15.4.4 | Python deps missing | `ModuleNotFoundError` | Run `pip install -r corpbot_agent_evals/lake_merritt/requirements.txt` |

### 15.5 Evals Quick Verification

```bash
# Full evals prerequisite check
grep -q "^OPENAI_API_KEY=" .env && echo "API key: OK" || echo "API key: MISSING"
python3 -c "import openai, jinja2, tenacity" 2>/dev/null && echo "Python deps: OK" || echo "Python deps: MISSING"
[ -f .agent/skills/evals/SKILL.md ] && echo "Evals skill: OK" || echo "Evals skill: MISSING"
ls .observability/traces/*.json 2>/dev/null | head -1 && echo "Traces: OK" || echo "Traces: NONE"
```

### 15.6 Add to Quick Start Matrix (Section 0)

| Change Type | Required Sections | Minimum Checks |
|-------------|-------------------|----------------|
| **Running evals** | 15 | Prerequisites 15.1, output 15.2 |
| **After tri-agent work** | 15, 4 | Run evals before reporting done |

---

## 16. Agent Communication & Autonomy Guidelines

### 16.1 comms.md is for DOCUMENTATION, Not Communication (CRITICAL)

**Problem:** Agents frequently write to `comms.md` expecting other agents to "check it regularly." They do NOT. This results in messages going nowhere and agents waiting indefinitely for responses that will never come.

**Reality:**
| Action | Result |
|--------|--------|
| Write to comms.md only | **NOTHING HAPPENS.** Target agent stays idle forever. |
| Send via terminal injection only | Agent receives message but no audit trail. |
| **BOTH** (terminal + comms.md) | Agent receives AND we have documentation. |

**Required Protocol - To communicate with another agent:**

1. **FIRST:** Send via terminal injection (actually wakes the agent)
   ```bash
   node interlateral_dna/cc.js send "[Sender] Your message"
   node interlateral_dna/ag.js send "[Sender] Your message"
   node interlateral_dna/codex.js send "[Sender] Your message"
   node interlateral_dna/gemini.js send "[Sender] Your message"
   ```

2. **THEN:** Document to comms.md (creates audit trail)
   ```markdown
   [Sender] @Recipient [YYYY-MM-DD HH:MM UTC]
   Your message here.
   ---
   ```

**Exception - Interlateral (IL):**
- IL runs via OpenClaw, not tmux
- NO injection script exists for IL
- **Only way to reach IL:** Ask Principal Prime (human) to relay

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 16.1.1 | Agent instruction files warn about comms.md | CRITICAL | All agent .md files contain the flat file warning |
| 16.1.2 | No agent code treats comms.md as communication | CRITICAL | Grep for patterns that expect comms.md monitoring |
| 16.1.3 | Bootstrap scripts don't claim comms.md delivers messages | CRITICAL | Review script documentation |

---

### 16.2 Gemini CLI Autonomy + Model Pinning (CRITICAL)

**Problem:** If bootstrap starts Gemini without an explicit model pin, Gemini may route to `Auto (Gemini 2.5)` depending on account/runtime defaults. This causes model drift from intended Gemini 3 usage.

**Required Policy:**
1. Bootstrap MUST pin Gemini model via `GEMINI_MODEL` (default: `gemini-3-flash-preview`)
2. Bootstrap MUST run a bounded preflight smoke test for model availability (timeout required)
3. Bootstrap MUST fail fast on explicit preflight errors (non-zero exit)
4. Bootstrap MUST proceed on preflight timeout with a warning because interactive launch is still pinned via `-m`
5. Bootstrap MUST NOT silently downgrade to Gemini 2.5

```bash
# Required pattern in bootstrap scripts:
GEMINI_MODEL="${GEMINI_MODEL:-gemini-3-flash-preview}"
gemini -p "ok" -m "$GEMINI_MODEL" ...   # preflight
gemini -m "$GEMINI_MODEL" ...           # interactive launch
```

**Why This Matters:**
- Keeps behavior consistent across sessions and machines
- Prevents hidden model regressions during wake-up
- Preserves deterministic quad-agent quality expectations

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 16.2.1 | bootstrap-full.sh pins `GEMINI_MODEL` default | CRITICAL | `grep -E 'GEMINI_MODEL=\"\\$\\{GEMINI_MODEL:-gemini-3-flash-preview\\}\"' scripts/bootstrap-full.sh` |
| 16.2.2 | bootstrap-full-no-ag.sh pins `GEMINI_MODEL` default | CRITICAL | `grep -E 'GEMINI_MODEL=\"\\$\\{GEMINI_MODEL:-gemini-3-flash-preview\\}\"' scripts/bootstrap-full-no-ag.sh` |
| 16.2.3 | bootstrap scripts run model preflight | CRITICAL | `grep -E 'Validating Gemini model availability' scripts/bootstrap-full.sh scripts/bootstrap-full-no-ag.sh` |
| 16.2.4 | bootstrap-full.sh launches Gemini with pinned model | CRITICAL | `grep -E \"gemini -m '\\$GEMINI_MODEL' --approval-mode=yolo --sandbox=false\" scripts/bootstrap-full.sh` |
| 16.2.5 | bootstrap-full-no-ag.sh launches Gemini with pinned model | CRITICAL | `grep -E \"gemini -m '\\$GEMINI_MODEL' --approval-mode=yolo --sandbox=false\" scripts/bootstrap-full-no-ag.sh` |

---

### 16.2b Codex Startup Autonomy Policy (CRITICAL)

**Required Policy:**
1. Startup/bootstrap scripts MUST launch Codex with `--yolo`
2. Startup scripts MUST NOT launch Codex with `--full-auto`
3. This requirement applies to full bootstrap, no-AG bootstrap, and direct Codex tmux launcher

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 16.2b.1 | bootstrap-full.sh launches Codex with `--yolo` | CRITICAL | `grep -E \"codex --yolo\" scripts/bootstrap-full.sh` |
| 16.2b.2 | bootstrap-full-no-ag.sh launches Codex with `--yolo` | CRITICAL | `grep -E \"codex --yolo\" scripts/bootstrap-full-no-ag.sh` |
| 16.2b.3 | start-codex-tmux.sh launches Codex with `--yolo` | CRITICAL | `grep -E \"codex --yolo\" scripts/start-codex-tmux.sh` |
| 16.2b.4 | No startup script launches Codex with `--full-auto` | CRITICAL | `! rg -n \"codex --full-auto\" scripts/bootstrap-full.sh scripts/bootstrap-full-no-ag.sh scripts/start-codex-tmux.sh` |

---

### 16.3 File Access Boundaries - Shared House Rule (HIGH)

**Problem:** Agents were unclear about what files they could modify autonomously. This led to two failure modes:
1. Agents asking permission for trivial in-repo changes (slows everything down)
2. Agents modifying critical infrastructure files unbidden (breaks things)

**The Shared House Rule:**

**Outside the Repo: ASK FIRST**
- Any file outside the repo root requires explicit human permission
- This includes: system files, other repos, user home directory files
- Exception: Designated temp directories for agent work

**Inside the Repo: Be Conscientious**
- Agents have full permission inside the repo FOR THEIR ASSIGNED TASK
- BUT the repo is a SHARED HOUSE - other agents live here
- DO NOT modify infrastructure, services, or critical files on a whim

**What "Infrastructure" Means:**
| Category | Examples | Rule |
|----------|----------|------|
| Bootstrap scripts | `scripts/bootstrap*.sh`, `scripts/wake-up.sh` | Propose changes, don't just make them |
| Agent instruction files | `CLAUDE.md`, `CODEX.md`, `GEMINI.md`, etc. | Changes affect all future sessions |
| Control scripts | `cc.js`, `ag.js`, `codex.js`, `gemini.js` | Core mesh communication |
| Dashboard server | `interlateral_comms_monitor/server/` | Affects all agents' observability |
| Conformance docs | `INTERNALS_CONFORMANCE.md` | The rules themselves |

**Safe to Modify Autonomously:**
| Category | Examples |
|----------|----------|
| Your assigned task files | Whatever the dev plan specifies |
| Project work directories | `projects/*` contents |
| comms.md | Documentation entries |
| Temporary files | Agent-specific temp/scratch areas |

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 16.3.1 | Agent files contain Shared House Rule | HIGH | All agent .md files have the warning |
| 16.3.2 | Agents don't modify bootstrap scripts unbidden | HIGH | Review agent behavior logs |

---

### 16.4 Hardcoded Path Avoidance (MEDIUM)

**Problem:** Some scripts and docs hardcoded the repo name (`interlateral_alpha`), breaking clone compatibility.

**Rule:** Never hardcode the repo name. Use relative paths or `$REPO_ROOT` variables.

**Bad:**
```bash
cd /Users/dazza/interlateral_alpha
```

**Good:**
```bash
cd "$(dirname "$0")/.."
# or
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
```

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 16.4.1 | Scripts use relative or $REPO_ROOT paths | MEDIUM | `! grep -r 'interlateral_alpha' scripts/` |
| 16.4.2 | Agent files don't assume repo name | MEDIUM | `! grep 'interlateral_alpha' *.md` |

---

### 16.5 Claude Model Selection Policy (HIGH)

**Policy (hybrid):**
1. Default Claude model is alias `opus` via `CLAUDE_MODEL` in `logged-claude.sh`
2. If user sets explicit full model ID (e.g., `claude-opus-4-6-20260205`), a bounded preflight smoke test runs (timeout required)
3. Explicit preflight errors (non-zero exit) must fail fast
4. Preflight timeout is non-fatal — proceed with warning since the interactive session still uses the requested model
5. Explicit full IDs must not silently downgrade

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 16.5.1 | `logged-claude.sh` sets `CLAUDE_MODEL` default to `opus` | HIGH | `grep -E 'DEFAULT_CLAUDE_MODEL=\"\\$\\{CLAUDE_MODEL:-opus\\}\"' scripts/logged-claude.sh` |
| 16.5.2 | `logged-claude.sh` injects model when absent | HIGH | `grep -E 'CLAUDE_ARGS=\\(--model \"\\$DEFAULT_CLAUDE_MODEL\"' scripts/logged-claude.sh` |
| 16.5.3 | Explicit full model IDs are preflight-validated | HIGH | `grep -E 'if \\[\\[ \"\\$SELECTED_MODEL\" == claude-\\* \\]\\]' scripts/logged-claude.sh` |
| 16.5.4 | Explicit model failure exits non-zero | CRITICAL | `grep -E 'exit 1' scripts/logged-claude.sh` |

---

## 17. Agent Skills Conformance

### 17.1 Skills Specification Reference (HIGH)

**Canonical Documentation:** `interlateral_comms_monitor/docs/SKILLS_DEV_GUIDE.md`

All Agent Skills in this repo MUST conform to the Agent Skills specification (agentskills.io).

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 17.1.1 | SKILLS_DEV_GUIDE.md exists | HIGH | `[ -f interlateral_comms_monitor/docs/SKILLS_DEV_GUIDE.md ]` |
| 17.1.2 | All skills have YAML frontmatter | HIGH | `for f in .agent/skills/*/SKILL.md; do head -1 "$f" | grep -q "^---" || echo "FAIL: $f"; done` |
| 17.1.3 | All skills have `name` field | CRITICAL | See 17.5 for proper count verification |
| 17.1.4 | All skills have `description` field | CRITICAL | See 17.5 for proper count verification |

### 17.2 Tool-Specific Skill Paths (HIGH)

**Architecture:**
```
.agent/skills/          ← Canonical source (EDIT HERE)
.claude/skills/         ← Claude Code discovery (verify with official Anthropic docs)
.codex/skills/          ← Codex CLI discovery (primary path)
.agents/skills/         ← Codex CLI also supports this path (as of 2026-02-02)
.gemini/skills/         ← Gemini CLI discovery (symlink or real directory)
```

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 17.2.1 | `.agent/skills/` exists | CRITICAL | `[ -d .agent/skills ]` |
| 17.2.2 | `.claude/skills/` exists | HIGH | `[ -d .claude/skills ]` (Note: verify path with official Anthropic documentation) |
| 17.2.3 | `.codex/skills/` exists | HIGH | `[ -d .codex/skills ]` |
| 17.2.4 | `.gemini/skills` exists | HIGH | `[ -d .gemini/skills ] \|\| [ -L .gemini/skills ]` |
| 17.2.5 | Gemini symlink (if used) points to canonical | MEDIUM | `[ ! -L .gemini/skills ] \|\| readlink .gemini/skills \| grep -q '.agent/skills'` |

**Tool Path Notes:**
- **Codex CLI:** Supports BOTH `.codex/skills/` AND `.agents/skills/` (per OpenAI changelog 2026-02-02). The `.agents/skills/` path is an ADDITIONAL option, not a replacement.
- **Claude Code:** Uses `.claude/skills/` (verify with official Anthropic documentation before marking as CRITICAL).
- **Gemini CLI:** Uses `.gemini/skills/` which can be a symlink OR a real directory.

**IMPORTANT:** There is no universal path that works for ALL tools. Codex supports `.agents/skills/` but Claude Code and Gemini CLI do not. For maximum compatibility, maintain tool-specific directories.

### 17.3 YAML Frontmatter Requirements (CRITICAL)

Every SKILL.md MUST have YAML frontmatter at the top:

```yaml
---
name: skill-name          # Required: lowercase letters, numbers, hyphens; 1-64 chars; MUST match directory name
description: Description  # Required: 1-1024 chars per spec (repo policy: <=500 for Codex compatibility)
license: MIT              # Optional: standard top-level field per spec
compatibility: "..."      # Optional: standard top-level field per spec
allowed-tools: "tool1 tool2"  # Optional: space-delimited string per spec
metadata:                 # Optional: custom fields go here
  owner: team-name
  version: "1.0"
  type: skill-type
  # ... any other custom fields
---
```

| # | Check | Severity | Verification |
|---|-------|----------|--------------|
| 17.3.1 | `name` matches directory | CRITICAL | Directory `foo/` must have `name: foo` |
| 17.3.2 | `name` uses valid characters | HIGH | Lowercase letters, numbers, hyphens only; no leading/trailing hyphens; no consecutive hyphens |
| 17.3.3 | `description` under 500 chars | HIGH | **Repo policy** for Codex compatibility (spec allows 1024) |
| 17.3.4 | Non-standard fields in `metadata` | HIGH | Standard top-level fields allowed: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`. Custom fields go in `metadata` block. |
| 17.3.5 | No `.DS_Store` in skill dirs | MEDIUM | `find .agent/skills .claude/skills .codex/skills .gemini/skills -name ".DS_Store" 2>/dev/null` returns empty |

### 17.4 Skill Sync and Drift Prevention (HIGH)

When editing skills:

1. **ALWAYS edit in `.agent/skills/`** (canonical source)
2. **Sync to tool-specific directories:**
   ```bash
   # Example for create-skin skill
   cp .agent/skills/create-skin/SKILL.md .claude/skills/create-skin/SKILL.md
   cp .agent/skills/create-skin/SKILL.md .codex/skills/create-skin/SKILL.md
   # If .gemini/skills/ is a symlink, no copy needed
   # If .gemini/skills/ is a real directory, copy there too
   ```
3. **Verify all tools can discover:**
   ```bash
   ls .claude/skills/*/SKILL.md
   ls .codex/skills/*/SKILL.md
   ls .gemini/skills/*/SKILL.md
   ```

**Drift Prevention Check:**

If `.claude/skills/` and `.codex/skills/` are NOT symlinks to canonical, check for drift:

```bash
# Check that all canonical skills exist in tool directories
for skill in .agent/skills/*/; do
  name=$(basename "$skill")
  [ -d ".claude/skills/$name" ] || echo "DRIFT: $name missing from .claude/skills/"
  [ -d ".codex/skills/$name" ] || echo "DRIFT: $name missing from .codex/skills/"
  # Include .gemini/skills if it's a real directory (not symlink)
  if [ -d .gemini/skills ] && [ ! -L .gemini/skills ]; then
    [ -d ".gemini/skills/$name" ] || echo "DRIFT: $name missing from .gemini/skills/"
  fi
done

# Check content matches (sample check)
diff -q .agent/skills/create-skin/SKILL.md .claude/skills/create-skin/SKILL.md || echo "DRIFT: create-skin content differs"
```

### 17.5 Skills Quick Verification

```bash
# Full skills conformance check
echo "=== Skills Conformance Check ==="

# Check canonical source exists
[ -d .agent/skills ] && echo "Canonical dir: OK" || echo "Canonical dir: MISSING"

# Check tool-specific paths
[ -d .claude/skills ] && echo "Claude skills: OK" || echo "Claude skills: MISSING"
[ -d .codex/skills ] && echo "Codex skills: OK" || echo "Codex skills: MISSING"
[ -d .gemini/skills ] || [ -L .gemini/skills ] && echo "Gemini skills: OK" || echo "Gemini skills: MISSING"

# Count skills and verify frontmatter
expected_count=$(ls -d .agent/skills/*/ 2>/dev/null | wc -l | tr -d ' ')
name_count=$(grep -l "^name:" .agent/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
desc_count=$(grep -l "^description:" .agent/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')

echo "Expected skills: $expected_count"
echo "With name field: $name_count"
echo "With description: $desc_count"

[ "$expected_count" -eq "$name_count" ] && echo "Name fields: OK" || echo "Name fields: MISSING in $((expected_count - name_count)) skills"
[ "$expected_count" -eq "$desc_count" ] && echo "Description fields: OK" || echo "Description fields: MISSING in $((expected_count - desc_count)) skills"

# Check frontmatter on all skills
for skill in .agent/skills/*/SKILL.md; do
  skill_name=$(dirname "$skill" | xargs basename)
  if head -1 "$skill" | grep -q "^---"; then
    if grep -q "^name:" "$skill" && grep -q "^description:" "$skill"; then
      echo "$skill_name: OK"
    else
      echo "$skill_name: MISSING name/description"
    fi
  else
    echo "$skill_name: NO FRONTMATTER"
  fi
done

# Check for .DS_Store contamination (include .gemini/skills if real directory)
if [ -L .gemini/skills ]; then
  ds_count=$(find .agent/skills .claude/skills .codex/skills -name ".DS_Store" 2>/dev/null | wc -l)
else
  ds_count=$(find .agent/skills .claude/skills .codex/skills .gemini/skills -name ".DS_Store" 2>/dev/null | wc -l)
fi
[ "$ds_count" -eq 0 ] && echo ".DS_Store files: CLEAN" || echo ".DS_Store files: $ds_count FOUND (remove them)"
```

---

## 18. Git Workflow for Template-Cloned Repos (CRITICAL)

### 18.1 The Template Clone Problem

**CRITICAL:** If this repo was created from a GitHub Template (not forked), it has **NO shared git history** with the upstream template repo. This breaks normal PR workflows.

**Symptom:** When trying to create a PR to upstream, GitHub shows:
> "There isn't anything to compare. main and your-branch are entirely different commit histories."

**Root Cause:** GitHub Templates create a fresh repo with copied files but a NEW initial commit. The git histories are completely separate.

### 18.2 Determining Your Repo Type

```bash
# Check if you're a template clone or a fork
git remote -v
# If "origin" points to your repo and there's no "upstream", you may be a template clone

# Add upstream if not present
git remote add upstream https://github.com/dazzaji/interlateral_alpha.git

# Check for common history
git fetch upstream main
git merge-base HEAD upstream/main 2>/dev/null || echo "NO COMMON ANCESTOR - Template Clone!"
```

| Result | Meaning |
|--------|---------|
| SHA hash returned | Fork - normal PR workflow works |
| "NO COMMON ANCESTOR" | Template Clone - use Section 18.3 workflow |

### 18.3 PR Workflow for Template Clones (REQUIRED)

**You CANNOT create a PR from a branch that originated in your template clone.** The branch has no common history with upstream.

**Why rebase/merge won't work:** Even `git rebase upstream/main` or `git merge upstream/main --allow-unrelated-histories` won't help because the resulting branch will have a messy history that GitHub still can't cleanly compare. The file-checkout approach is cleaner and more reliable.

**Correct Workflow:**

```bash
# 1. Ensure upstream is configured
git remote add upstream https://github.com/dazzaji/interlateral_alpha.git 2>/dev/null || true
git fetch upstream main

# 2. Create a NEW branch based on upstream/main (NOT your local main)
git checkout -b my-feature-upstream upstream/main

# 3. Copy your changes from your local branch
#    Option A: Cherry-pick if you have commits (may fail across unrelated histories)
#    Option B: Checkout specific files from your branch (RECOMMENDED)
git checkout your-local-branch -- path/to/changed/file1
git checkout your-local-branch -- path/to/changed/file2

# 4. Commit on the upstream-based branch
git add .
git commit -m "Your commit message"

# 5. Push to upstream (requires push access)
git push upstream my-feature-upstream

# 6. Create PR within upstream repo
#    Go to: https://github.com/dazzaji/interlateral_alpha/pull/new/my-feature-upstream
```

### 18.4 If You Don't Have Push Access to Upstream

If you cannot push directly to upstream:

1. **Fork the upstream repo** (not your template clone)
2. **Clone the fork**
3. **Apply your changes** to the fork
4. **Create PR** from fork to upstream (normal workflow)

```bash
# Alternative: Create a patch and apply to a proper fork
git format-patch -1 HEAD --stdout > my-changes.patch

# In your fork of upstream:
git apply my-changes.patch
```

### 18.5 Verification Checklist

Before creating a PR to upstream template repo:

| # | Check | Command |
|---|-------|---------|
| 18.5.1 | Upstream remote exists | `git remote -v \| grep upstream` |
| 18.5.2 | Branch is based on upstream/main | `git merge-base HEAD upstream/main` returns SHA |
| 18.5.3 | Push access confirmed | `git push upstream --dry-run branch-name` |
| 18.5.4 | PR URL is for upstream repo | URL starts with upstream repo, not origin |

### 18.6 Common Mistakes to Avoid

| Mistake | Why It Fails | Correct Approach |
|---------|--------------|------------------|
| PR from origin branch to upstream | No common history | Branch from upstream/main first |
| Using `git rebase upstream/main` on template clone | Histories don't share base; messy result | Checkout files, don't rebase |
| Using `git merge --allow-unrelated-histories` | Creates confusing merge commit | Checkout files for clean history |
| Assuming "fork" when you used "template" | Different git mechanisms | Check with merge-base command |
| Pushing to origin expecting cross-repo PR | GitHub can't compare unrelated histories | Push to upstream directly |

### 18.7 Why This Matters

- **Template clones are common** for starting new projects from reference implementations
- **The failure is silent** until you try to create the PR
- **Normal PR tutorials don't cover this** because they assume forked repos
- **Wasted work** if you develop on a branch that can't be PR'd

**Rule:** If your repo came from a GitHub Template, ALWAYS branch from `upstream/main` before starting work intended for upstream PRs.

---

## 19. Cross-Team-Comms (Bridge Conformance)

The cross-team-comms system allows agents on separate machines to communicate via HTTP. Code lives in `interlateral_comms/`.

### 19.1 Bridge Server Safety (`bridge.js`)

| Check | What | Severity |
|-------|------|----------|
| 19.1.1 | Bridge listens on `0.0.0.0:3099` | INFO |
| 19.1.2 | Body size limit: `10kb` (`express.json({ limit: '10kb' })`) | CRITICAL |
| 19.1.3 | Concurrency mutex on `/inject` (one injection at a time) | CRITICAL |
| 19.1.4 | Uses `execFileSync` with args array, NOT `execSync` with string interpolation | CRITICAL — prevents command injection |
| 19.1.5 | `/read/:agent` is NOT behind mutex (idempotent, doesn't touch tmux input) | BY DESIGN |
| 19.1.6 | Valid targets: `cc`, `codex`, `gemini`, `ag` — validated before injection | CRITICAL |
| 19.1.7 | 5000 char message limit enforced | IMPORTANT |
| 19.1.8 | Optional auth: when `BRIDGE_TOKEN` is set, `/inject` requires `x-bridge-token` | CRITICAL |
| 19.1.9 | Queue depth capped (`BRIDGE_MAX_QUEUE_DEPTH`) to avoid unbounded memory growth | IMPORTANT |
| 19.1.10 | `/health` and `/status` expose identity fields (`team_id`, `session_id`, `mesh_id`) | IMPORTANT |

### 19.2 Bridge Client (`bridge-send.js`)

| Check | What | Severity |
|-------|------|----------|
| 19.2.1 | `--host` overrides `--peer` when both provided | IMPORTANT |
| 19.2.2 | Unknown `--peer` name fails fast with available peers list | IMPORTANT |
| 19.2.3 | Missing `peers.json` produces clear error with setup instructions | IMPORTANT |
| 19.2.4 | Resolution order: DNS lookup on `.local` (bounded timeout) → `fallback_ip` → error | IMPORTANT |
| 19.2.5 | Resolved address logged on every send | INFO |
| 19.2.6 | Optional auth token forwarded via env/`--token` as `x-bridge-token` | IMPORTANT |
| 19.2.7 | Read-only: does not write host data outside repo | IMPORTANT |
| 19.2.8 | 15-second HTTP request timeout | INFO |
| 19.2.9 | `peers.json` structure validated before use (`peers`, `host`, `port` type checks) | IMPORTANT |
| 19.2.10 | Outbound relays prepend identity stamp (`[ID team=... sender=... host=... sid=...]`) unless disabled | IMPORTANT |

### 19.3 Bootstrap Integration

| Check | What | Severity |
|-------|------|----------|
| 19.3.1 | Bridge steps (6-7) only run when `CROSS_TEAM=true` | CRITICAL — default OFF |
| 19.3.2 | PID/log files live under repo `.runtime/` (not global `/tmp`) | IMPORTANT |
| 19.3.3 | Health check validates bridge identity (`service":"interlateral-bridge`) not generic port content | IMPORTANT |
| 19.3.4 | Fail-soft: bridge failure never blocks wake-up | CRITICAL |
| 19.3.5 | Peer health check: 5s timeout + 1 retry with 3s backoff | INFO |
| 19.3.6 | Peer health output prints remote identity and warns on team-id collision | IMPORTANT |
| 19.3.7 | **Auth guardrail:** `wake-up.sh --cross-team` exits 1 when `BRIDGE_TOKEN` is unset (unless `BRIDGE_ALLOW_NO_AUTH=true`) | CRITICAL |
| 19.3.8 | **Auth guardrail:** `bootstrap-full.sh` blocks bridge start when `BRIDGE_TOKEN` is unset and `BRIDGE_ALLOW_NO_AUTH` is not `true` | CRITICAL |
| 19.3.9 | Auth guardrail override (`BRIDGE_ALLOW_NO_AUTH=true`) prints explicit warning about unauthenticated operation | IMPORTANT |

### 19.4 Configuration (`peers.json`)

| Check | What | Severity |
|-------|------|----------|
| 19.4.1 | `peers.json` is in `.gitignore` (machine-specific) | IMPORTANT |
| 19.4.2 | `peers.json.example` is checked into repo (template) | IMPORTANT |
| 19.4.3 | `fallback_ip` is a first-class field (required for hotspot networks) | IMPORTANT |
| 19.4.4 | `setup-peers.sh` validates `.local` DNS resolution and discovers hostname | INFO |
| 19.4.5 | `setup-peers.sh` warns when local interface IP cannot be detected | INFO |

### 19.5 Operational Constraints

- **CC is cross-team coordinator.** CX and Gemini interpret injected commands as conversation, not shell commands.
- **AG cross-team: UNTESTED.** `ag.js send` delays may push bridge 15s timeout.
- **mDNS fails on iPhone hotspots.** `fallback_ip` handles this automatically.
- **Codex sandbox:** ability to run `bridge-send.js` is environment/profile dependent. Outbox pattern remains local-only fallback.
- **Identity discipline required:** each team must set unique `INTERLATERAL_TEAM_ID` to avoid same-role routing confusion.

### 19.6 Code Locations

| Component | File | Purpose |
|-----------|------|---------|
| Bridge server | `interlateral_comms/bridge.js` | HTTP server, local injection |
| Bridge client | `interlateral_comms/bridge-send.js` | CLI send with --peer/--host |
| Peer config | `interlateral_comms/peers.json` | Team hostnames + fallback IPs |
| Setup script | `interlateral_comms/setup-peers.sh` | One-time hostname discovery |
| Route table | `interlateral_dna/LIVE_COMMS.md` | Cross-team cheat sheet |
| Coordinator docs | `CLAUDE.md` | CC cross-team pattern |
| Full proposal | `COMBINED_REPORT_and_PROPOSAL.md` | Architecture + test report |

---

## Change Log

### Version 1.9 (2026-02-11)

**Cross-Team-Comms Conformance (NEW Section 19):**
- Added Section 19: Cross-Team-Comms bridge conformance checks
- Documents bridge safety (execFileSync, mutex, body limits), client resolution order, bootstrap gating (`--cross-team` flag), peers.json config, operational constraints
- Cross-references to LIVE_COMMS.md, CLAUDE.md, and COMBINED_REPORT_and_PROPOSAL.md

### Version 1.8 (2026-02-06)

**Model Policy Unification + Conformance Merge:**
- Updated Section 16.2 from autonomy-flag guidance to Gemini model-pinning policy (`GEMINI_MODEL`, preflight, fail-fast)
- Added Section 16.5: Claude model selection policy (hybrid: default `opus`, explicit-ID fail-fast)
- Added `CLAUDE_MODEL` and `GEMINI_MODEL` to Section 8.3 Environment Variables
- Updated Known Failure Mode #7 to reflect Gemini model/autonomy drift prevention
- Added ToC entry for Section 16.5
- Merged this content into v1.8 baseline while retaining Sections 17 and 18

### Version 1.7 (2026-02-04)

**Agent Skills Conformance (NEW Section 17):**
- Added Section 17: Agent Skills Conformance
- Documents SKILLS_DEV_GUIDE.md as canonical reference
- Covers tool-specific skill paths (.claude/, .codex/, .gemini/, .agents/)
- Notes Codex supports BOTH .codex/skills/ AND .agents/skills/ (per 2026-02-02 changelog)
- YAML frontmatter requirements per agentskills.io spec
- Standard top-level fields: name, description, license, compatibility, metadata, allowed-tools
- Repo policy: description <=500 chars for Codex compatibility (spec allows 1024)
- Name constraints: lowercase letters, numbers, hyphens; no leading/trailing/consecutive hyphens
- Skill sync workflow with drift prevention checks
- Quick verification script for skills compliance

**Git Workflow for Template Clones (NEW Section 18):**
- Added Section 18: Git Workflow for Template-Cloned Repos
- CRITICAL documentation for PRs to upstream template repos
- Explains the "no common history" problem
- Notes why --allow-unrelated-histories doesn't solve it cleanly
- Step-by-step workflow for creating valid PRs
- Verification checklist before PR creation
- Common mistakes and how to avoid them

**Quick Start Matrix Updates:**
- Added Skills-only change type with Section 17 checks
- Added PR to upstream change type with Section 18 workflow
- Added decision tree branches for SKILL.md and PR workflows

**Conformance Script Updates:**
- Added Section 17 skills checks to automated conformance script

### Version 1.6 (2026-02-03)

**Agent Communication & Autonomy Guidelines (NEW Section 16):**
- Added Section 16.1: comms.md is for documentation, not communication
- Added Section 16.2: Gemini CLI autonomy configuration (official `--approval-mode=yolo` + `-y` workaround)
- Added Section 16.3: File access boundaries and Shared House Rule
- Added Section 16.4: Hardcoded path avoidance
- Updated Section 4.2: Added warning about comms.md not waking agents
- Updated Section 8.1: Added note about 1-second delay for all CLI agents
- Updated Section 13.1: Added failure modes 6 and 7 (comms.md, Gemini prompts)
- Updated conformance script with Section 16 checks
- Documented autonomy flag options for mesh bootstrap

### Version 1.5 (2026-01-29)

**Wake-up fixes:**
- Removed repo-local tmux socket; system socket is canonical.
- Namespaced tmux sessions (`interlateral-claude`, `interlateral-codex`, `interlateral-gemini`).
- Added comms.md session boundary markers to prevent stale context carryover.

### Version 1.4 (2026-01-28)

**Addressed feedback from CC2 and Codex:**
- Updated comms format regex and agent identifiers to include Gemini.
- Added `gemini.js` to the control scripts table and `gemini.js`/`GEMINI.md` checks to the conformance script.
- Renamed "Tri-Agent" sections and TOC entries to "Quad-Agent".
- Added Gemini telemetry path to freshness check.
- Clarified that Antigravity (AG) cannot execute node scripts directly.
- Updated version to 1.4.

### Version 1.3 (2026-01-28)

**Added:**
- Quad-Agent Mesh Conformance section documenting Gemini CLI agent, `gemini.js`, `GEMINI.md`, and communication routes.
- Updated version to 1.3 and added Gemini as author.

### Version 1.2 (2026-01-24)

**Added:**
- Section 15: Evaluation Conformance (evals system checks)

### Version 1.1 (2026-01-22)

**Incorporated from AG Review:**

| Item | Section | Change Made |
|------|---------|-------------|
| Diagnostic script fragility | 14 | Changed all `grep -q` to `grep -E "^[^#]*..."` to exclude commented lines |
| Ambiguous "Fresh Terminal" | How to Use | Added Technical Definitions table with precise definition |
| Strict timestamp format | 4.1 | Added regex: `\[\d{4}-\d{2}-\d{2} [T ]?\d{2}:\d{2}:\d{2}\]` |
| Network interface ambiguity | 2.3 | Changed all `localhost` to `127.0.0.1` throughout |
| Commented-out false positive | 1.1.3, 8.1.1, 8.1.2 | Added explicit "not commented" to checks with proper regex |
| Wall-clock trap | 8.1 | Added optional load test and noted fragility |
| Runtime bomb in plugins | 7.5 | Added Build Validation section with `tsc --noEmit` and `npm run build` |
| Leadership persistence deception | 3.2.4 | Added crash recovery distinction check |
| Uninstalled pass | 10.2 | Added Binary Existence Check with `which` AND `--version` |

**Incorporated from Codex Review:**

| Item | Section | Change Made |
|------|---------|-------------|
| Quick-start matrix by change type | 0 | NEW SECTION: Quick Start Matrix with decision tree |
| Normalize file paths | Throughout | All paths now repo-absolute (e.g., `interlateral_dna/comms.md`) |
| ag.js comms.md logging claim | 4.2 | Fixed table: ag.js logs to ag_log.md, not comms.md |
| jq dependency | 14 | Added fallback to `python3 -c 'import json'` |
| Telemetry pipe-pane setup | 5.2 | NEW subsection with pipe-pane verification |
| AG UI state verification | 6.3 | NEW subsection with screenshot verification |
| comms.md schema/format validator | 4.1 | Added format validation regex and check 4.1.5 |
| Log rotation watcher resiliency | 5.3 | NEW subsection with rotation test |
| Section numbering alignment | ToC | Aligned 1:1 with INTERNALS_GUIDE sections |
| Extract diagnostic script | 14 | Created full `scripts/conformance-check.sh` |
| Checklist abandonment concern | 0 | Addressed with Quick Start Matrix for scoped checks |
| Prohibited-phrase scanner | 1.1.5 | Added check for "run npm install", "start dashboard", etc. |
| npm ls false negatives | 9.2 | Added note about peer dependency warnings being benign |

**Merged Items:**

| Items Merged | Result |
|--------------|--------|
| AG "Wall-clock trap" + Codex "Session/window misdirection" | Combined into 8.1.4 injection verification with load test |
| AG "Runtime bomb" + Codex "Skin interface drift" | Combined into Section 7.5 Build Validation |
| AG "Strict timestamp" + Codex "Comms format validator" | Combined into Section 4.1 with regex validation |

**Post-Review Fixes (from Codex v1.1 Review):**

| Issue | Section | Fix Applied |
|-------|---------|-------------|
| Regex rejects multi-target headers | 4.1 | Updated regex to allow `@AG @Codex` style multi-targets |
| Table column contradiction | 4.2 | Renamed column to "Logs to" and fixed ag.js entry |
| Round-trip test false positive | 4.3 | Added limitation note and tmux pane verification command |
| Glob grep pattern failure | 7.2.1, 14 | Fixed grep to avoid `/` exclusion issue |

### Items NOT Accepted

| Item | Source | Reason |
|------|--------|--------|
| CI/CD integration | Codex | Out of scope for this checklist; would require separate CI pipeline setup. Could be added as enhancement later. |
| Threat modeling for security | Codex | Valid concern but requires dedicated security review process, not just checklist items. Noted in 12.2 that dashboard should only run on localhost. |
| Automated prohibited-phrase scanning | Codex | Partially accepted (added check 1.1.5) but full automation would require hooking into agent output streams, which is complex. Manual check for now. |
| Injection verification with retry | AG | Concept accepted (added to 4.3) but automatic retry logic would require modifying control scripts, which is out of scope for checklist doc. |

---

## Cross-Reference to INTERNALS_GUIDE.md

| Checklist Section | INTERNALS_GUIDE Section |
|-------------------|-------------------------|
| 0. Quick Start Matrix | N/A (new for checklist) |
| 1. Philosophy | Section 1 |
| 2. Architecture | Section 2 |
| 3. Wake-Up Protocol | Section 3 |
| 4. Tri-Agent Coordination | Section 4 |
| 5. Observability | Section 5 |
| 6. Dashboard | Section 6 |
| 7. Plugin Architecture | Section 7 |
| 8. Injection Mechanisms | Section 8 |
| 9. Configuration | Section 9 |
| 10. Dependencies | Section 10 |
| 11. Fragile Components | Section 11 |
| 12. Security | Section 13 |
| 13. Known Failures | Section 14 |
| 14. Automated Script | N/A (new for checklist) |
| 19. Cross-Team-Comms | N/A (new — covers interlateral_comms/) |

---

*Checklist v1.1 created by Claude Code (CC) with reviews by AG and Codex*
*For the Interlateral Quad-Agent Mesh*
