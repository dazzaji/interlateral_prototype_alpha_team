# INTERNALS_CONFORMANCE.md Update Supplement 

**Date:** 2026-01-28
**Author:** Claude Code (CC)
**Purpose:** Document gaps between current INTERNALS_CONFORMANCE.md (v1.2) and recent system evolution

**Current Version:** 1.2 (2026-01-24)
**Recommended Version:** 2.0 (significant system evolution)

---

## Critical Gaps (HIGH PRIORITY)

### 1. Skills System Conformance (NEW SECTION NEEDED)

The skills system has matured significantly but has NO conformance coverage.

**What's Missing:**

- Skills canonical location (`.agent/skills/`)
  - Impact: Agents might create skills in wrong location

- Skills deployment pattern (`.claude/skills/`, `.codex/skills/`)
  - Impact: Sync drift between canonical and deployed

- `deploy-skills.sh` validation
  - Impact: Broken skill deployment

- `SKILLS.md` as authoritative index
  - Impact: Skills not discoverable

- Skill file format (frontmatter + sections)
  - Impact: Malformed skills break invocation

**Proposed Section 16: Skills System Conformance**

---

### 2. Eval Pipeline Conformance (MAJOR EXPANSION of Section 15)

Section 15 covers basic evals but misses the full production pipeline.

**Gaps and What's New:**

- Session lifecycle scripts
  - `start-session.sh`
  - `end-session-safe.sh`
  - `harvest-session.sh`

- Native log harvesting
  - CC JSONL from `~/.claude/projects/<hash>/*.jsonl`
  - Codex from `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-*.jsonl`

- `cwd` field binding
  - Deterministic session-to-repo matching

- `last_trace.txt` pattern
  - Replaces unreliable `ls -t`

- Export pipeline
  - `export-skill-run.sh`
  - `export-otel.mjs`

- Kill switch
  - Abort on `INVALID_DATA`

**Key lessons from ROADMAP's "Evals Evolution" section (L1-L7) need inclusion.**

---

### 3. Project Specs Architecture (NEW SECTION NEEDED)

ROADMAP defines a unified Project Spec format that isn't in conformance.

**Example format:**

```yaml
PROJECT_ID: "my-project"
SKILL: "dev-collaboration"
ARTIFACT_PATH: "..."
REVIEW_FILE: "..."
```

**What Needs Coverage:**

- `projects/specs/` directory structure
- Required frontmatter keys
- `run-project.sh` runner validation
- Symlink strategy for backwards compat

---

### 4. HyperDomo Manager Agent (NEW SECTION NEEDED)

HyperDomo is a new manager agent pattern with specific conformance needs.

**What Needs Coverage:**

- `start-hyperdomo.sh` entrypoint
- State persistence (`hyperdomo_state.json`)
- Security guardrails (allowlisted commands)
- Project skill interface (hot-swappable)
- Run token isolation

---

## Medium Priority Updates

### 5. Quick Start Matrix (Section 0) - EXPAND

New change types need minimum checks.

**New Change Types to Add:**

- **Skills changes**
  - Required Sections: New Section 16 (Skills) + 14 (conformance script)

- **Project specs**
  - Required Sections: New Section 17 (Project Specs)

- **Eval pipeline**
  - Required Sections: 15 (expanded) + native log validation

- **HyperDomo**
  - Required Sections: New Section 18 (HyperDomo)

---

### 6. Scripts Registry (Section 14) - MAJOR UPDATE

The conformance script doesn't cover many new scripts.

**Scripts NOT in conformance check:**

- `preflight-wakeup.sh` - eval-ready session start
- `end-session-safe.sh` - safe termination
- `export-skill-run.sh` - OTEL export
- `run-skill-eval.sh` - eval execution
- `harvest-session.sh` - native log harvest
- `start-session.sh` - session lifecycle
- `verify-harvest.sh` - harvest validation
- `run-project.sh` - project runner
- `start-hyperdomo.sh` - manager agent
- `deploy-skills.sh` - skill sync
- `validate-skills.sh` - skill validation
- `tri-agent-status.sh` - mesh health
- `quick-status.sh` - fast status check

---

### 7. Observability Updates (Section 5) - EXPAND

Native log paths have changed.

**CC Logs:**
- Old Understanding: Terminal scrape
- New Reality: `~/.claude/projects/<hash>/*.jsonl`

**Codex Logs:**
- Old Understanding: Terminal scrape
- New Reality: `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-*.jsonl`

**Session Binding:**
- Old Understanding: File discovery
- New Reality: `cwd` field matching

---

### 8. Multi-Instance Support (Section 8) - ADD

README documents multi-instance patterns not in conformance.

**Example usage:**

```bash
CC_TMUX_SESSION=claude2 node cc.js send "message"
CODEX_TMUX_SESSION=codex2 node codex.js send "message"
```

---

## Low Priority / Cleanup

### 9. Repo Root Path Fix

Line 64 has wrong repo name:

```
Repo Root: /Users/.../interlateral_prototype_alphasa_ui_codex
```

Should be dynamic or corrected.

---

### 10. AG Telemetry Updates (Section 5)

ROADMAP Item 11 documents the AG telemetry gap and `ag.js watch` solution.

**Conformance should reference:**

- `.gemini/ag_telemetry.log` as canonical path
- `node ag.js watch` for continuous capture
- Polling interval documentation (5s default, 2s for evals)

---

## Summary: Recommended Changes

### CRITICAL Priority

- New Section 16: Add Skills System Conformance
- Section 15: Major expansion for eval pipeline

### HIGH Priority

- New Section 17: Add Project Specs Conformance
- New Section 18: Add HyperDomo Conformance
- Section 0: Expand Quick Start Matrix
- Section 14: Update conformance script for new scripts

### MEDIUM Priority

- Section 5: Update observability for native logs
- Section 8: Add multi-instance support

### LOW Priority

- Section 2.3: Fix repo root path
- Section 5: Add AG telemetry gap details

---

## Estimated Effort

This is a significant update - probably **version 2.0** rather than 1.3, given the structural additions:

- 3 new sections
- Major expansion of 2 existing sections

---

*Supplement created by Claude Code (CC) on 2026-01-28*
*For the Interlateral Tri-Agent Mesh*
