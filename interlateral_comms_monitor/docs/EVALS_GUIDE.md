# Evals Guide: LLM-as-Judge Quality Evaluation

**Version:** 1.0
**Date:** 2026-02-03
**Authors:** Claude Code (CC), with input from the quad-agent mesh
**Purpose:** Complete reference for understanding, running, extending, and improving the evaluation system

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Running Evals](#4-running-evals)
5. [Eval Packs Reference](#5-eval-packs-reference)
6. [Skills + Evals Mapping](#6-skills--evals-mapping)
7. [Data Sources & Telemetry](#7-data-sources--telemetry)
8. [Troubleshooting](#8-troubleshooting)
9. [Creating New Eval Packs](#9-creating-new-eval-packs)
10. [Improving Data Collection](#10-improving-data-collection)
11. [Roadmap](#11-roadmap)

---

## 1. Overview

### What Are Evals?

Evals (evaluations) use an **LLM-as-judge** approach to assess the quality of multi-agent work. Instead of human reviewers manually checking agent output, we:

1. Capture telemetry during agent work (conversations, tool calls, artifacts)
2. Export this telemetry as OTEL (OpenTelemetry) traces
3. Run eval packs that prompt GPT-4o to analyze the trace
4. Generate pass/fail scores with reasoning

### Why Evals Matter

| Without Evals | With Evals |
|---------------|------------|
| "Did the agent do a good job?" → Subjective | Objective scores with evidence |
| Quality varies by reviewer mood | Consistent scoring criteria |
| Can't track improvement over time | Trend analysis possible |
| Manual review doesn't scale | Automated quality gates |

### Core Concepts

| Term | Definition |
|------|------------|
| **Eval Pack** | A YAML file defining what to evaluate and how to score it |
| **OTEL Trace** | Structured JSON capturing a skill execution session |
| **LLM Judge** | GPT-4o prompted to analyze traces and return structured scores |
| **Lake Merritt** | The evaluation engine (Python) that runs eval packs |
| **Skill** | A multi-agent workflow pattern (e.g., dev-collaboration) |

---

## 2. Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AGENT WORK SESSION                              │
│                                                                         │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│  │   CC    │◄──►│  Codex  │◄──►│ Gemini  │◄──►│   AG    │              │
│  └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘              │
│       │              │              │              │                    │
│       ▼              ▼              ▼              ▼                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    TELEMETRY CAPTURE                            │   │
│  │  • CC JSONL transcript     • tmux pipe-pane logs               │   │
│  │  • events.jsonl            • asciinema casts                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         OTEL EXPORT PIPELINE                            │
│                                                                         │
│  ./scripts/start-session.sh  →  [WORK]  →  ./scripts/end-session.sh   │
│                                    │                                    │
│                                    ▼                                    │
│                    ./scripts/export-skill-run.sh --from-session        │
│                                    │                                    │
│                                    ▼                                    │
│                    .observability/traces/<skill>_<timestamp>.json      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EVALUATION ENGINE                               │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    LAKE MERRITT (Python)                        │  │
│   │                                                                  │  │
│   │  corpbot_agent_evals/lake_merritt/core/                        │  │
│   │    ├── evaluation.py      # Main eval runner                   │  │
│   │    ├── scoring/           # LLM judge implementations          │  │
│   │    ├── ingestion/         # Trace parsers                      │  │
│   │    └── data_models.py     # Schema definitions                 │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    EVAL PACKS (YAML)                            │  │
│   │                                                                  │  │
│   │  corpbot_agent_evals/lake_merritt/examples/eval_packs/         │  │
│   │    ├── revision_addressed.yaml    # Did Drafter fix issues?    │  │
│   │    ├── reviewer_minimum.yaml      # Did Reviewer give 3+ tips? │  │
│   │    ├── approval_chain.yaml        # Did all agents APPROVE?    │  │
│   │    ├── review_timing.yaml         # Correct sequence?          │  │
│   │    ├── decline_percentage.yaml    # How many issues declined?  │  │
│   │    ├── courier_usage.yaml         # Did Codex use courier?     │  │
│   │    └── token_cost.yaml            # Token usage analysis       │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│                    ./scripts/run-skill-eval.sh <trace> <pack>          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EVAL REPORTS                                    │
│                                                                         │
│   .observability/evals/                                                │
│     ├── revision_addressed_20260203_120000.json   # Raw scores         │
│     ├── revision_addressed_20260203_120000.md     # Human-readable     │
│     ├── reviewer_minimum_20260203_120000.json                          │
│     └── ...                                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `scripts/start-session.sh` | Begin telemetry capture with byte offsets |
| `scripts/end-session.sh` | Mark session end time |
| `scripts/export-skill-run.sh` | Convert telemetry to OTEL trace |
| `scripts/run-skill-eval.sh` | Run eval pack on a trace |
| `.observability/session_state.json` | Current session metadata |
| `.observability/traces/*.json` | Exported OTEL traces |
| `.observability/evals/*.md` | Eval reports |

---

## 3. Prerequisites

### Required

| Component | Check Command | Install |
|-----------|---------------|---------|
| **OpenAI API Key** | `grep -q "^OPENAI_API_KEY=" .env` | Add to `.env` file |
| **Python 3.8+** | `python3 --version` | System install |
| **Python deps** | `python3 -c "import openai, jinja2, tenacity"` | See below |

### Install Python Dependencies

```bash
pip install -r corpbot_agent_evals/lake_merritt/requirements.txt
```

Or manually:
```bash
pip install openai pyyaml pydantic python-dotenv jinja2 tenacity
```

### Set Up API Key

```bash
# Create .env if it doesn't exist
echo "OPENAI_API_KEY=sk-your-key-here" >> .env

# Verify it's gitignored
git ls-files --error-unmatch .env  # Should FAIL (not tracked)
```

### Verify Setup

```bash
# Quick check all prerequisites
grep -q "^OPENAI_API_KEY=" .env && echo "API key: OK" || echo "API key: MISSING"
python3 -c "import openai, jinja2, tenacity" && echo "Deps: OK" || echo "Deps: MISSING"
[ -f .agent/skills/evals/SKILL.md ] && echo "Skill: OK" || echo "Skill: MISSING"
```

---

## 4. Running Evals

### Method A: Full Workflow (Recommended)

**Step 1: Start with Preflight**
```bash
./scripts/preflight-wakeup.sh SESSION_NAME --dangerously-skip-permissions "Your prompt"
```

This single command:
- Starts the dashboard
- Begins session capture
- Launches CC with wake-up protocol

**Step 2: Do the Work**

Run your skill (e.g., dev-collaboration). Complete all phases.

**Step 3: End Session**
```bash
./scripts/end-session.sh
```

**Step 4: Export Trace**
```bash
./scripts/export-skill-run.sh --from-session
```

**Step 5: Run Evals**
```bash
# Get the trace path
TRACE=$(ls -t .observability/traces/*.json | head -1)

# Run individual packs
./scripts/run-skill-eval.sh "$TRACE" revision_addressed
./scripts/run-skill-eval.sh "$TRACE" reviewer_minimum
./scripts/run-skill-eval.sh "$TRACE" approval_chain

# Or run all relevant packs
for pack in revision_addressed reviewer_minimum approval_chain; do
  ./scripts/run-skill-eval.sh "$TRACE" "$pack"
done
```

**Step 6: View Reports**
```bash
# Markdown reports (human-readable)
cat .observability/evals/revision_addressed_*.md

# JSON reports (machine-readable)
cat .observability/evals/revision_addressed_*.json | jq .
```

### Method B: Manual Session (Without Preflight)

If you're already in a session and want to run evals:

```bash
# 1. Start session tracking
./scripts/start-session.sh "my-session"

# 2. Do your work...

# 3. End session
./scripts/end-session.sh

# 4. Export and eval
./scripts/export-skill-run.sh --from-session
TRACE=$(ls -t .observability/traces/*.json | head -1)
./scripts/run-skill-eval.sh "$TRACE" revision_addressed
```

**Known Issue:** Manual sessions may fail export with `user_prompt is INVALID_DATA`. The data IS captured but export validation is stricter than preflight. See Troubleshooting.

### Method C: Using the Evals Skill

Agents can run evals directly using the skill:

```
Run the evals skill at .agent/skills/evals/SKILL.md.
Trace: .observability/traces/dev-collaboration_*.json
Packs: revision_addressed, reviewer_minimum, approval_chain
Report: locations of eval results + pass/fail summary
```

---

## 5. Eval Packs Reference

### revision_addressed (PRIMARY)

**Purpose:** Verify that Breaker issues were addressed in revisions

**Required Metadata:**
- `breaker_review` - The Breaker's failure scenarios
- `change_log` - The Drafter's revision notes

**Scoring:**
```
Score = (addressed + declined_with_reason) / total_failures
```
- ADDRESSED: Issue was fixed
- DECLINED: Issue was declined with reasoning (acceptable)
- IGNORED: Issue not mentioned (bad)

**Threshold:** 0.7 (70% must be addressed or declined)

**Best For:** dev-collaboration skill after revision phase

---

### reviewer_minimum (PRIMARY)

**Purpose:** Verify Reviewer provided at least 3 actionable suggestions

**Scoring:**
```
Score = min(actionable_count / 3, 1.0)
```
3+ suggestions = perfect score

**Threshold:** 0.7

**Best For:** dev-collaboration skill, publication-pipeline

---

### approval_chain (PRIMARY)

**Purpose:** Verify all required agents approved the final version

**Scoring:**
- 1.0 if ALL agents approved
- 0.0 if any agent didn't approve

**Threshold:** 1.0 (must be perfect)

**Best For:** Any skill with approval gates

---

### review_timing

**Purpose:** Verify reviews completed before revision began

**Checks:**
- Reviewer end time < Revision start time
- Breaker end time < Revision start time

**Threshold:** 1.0

**Best For:** dev-collaboration (catches out-of-order execution)

---

### decline_percentage

**Purpose:** Calculate percentage of Breaker issues that were declined vs addressed

**Output:**
- `addressed_count`
- `declined_count`
- `ignored_count`
- `decline_percentage`

**Threshold:** 0.5 (informational - any value valid)

**Best For:** Quality analysis, identifying patterns

---

### courier_usage

**Purpose:** Verify Codex used courier outbox (not blocked direct methods)

**Checks:**
- Did Codex use `codex_outbox/*.msg` files?
- Did Codex try `cc.js` or `ag.js` directly (which fails in sandbox)?

**Threshold:** 1.0

**Best For:** Sessions involving Codex

---

### token_cost

**Purpose:** Calculate total token usage for a skill execution

**Output:**
- `spans_analyzed`
- `explicit_token_counts`
- `estimated_tokens`
- `total_tokens`

**Threshold:** 0.0 (always passes - informational only)

**Best For:** Cost analysis, optimization

---

## 6. Skills + Evals Mapping

### Which Evals for Which Skills?

| Skill | Primary Evals | Secondary Evals |
|-------|---------------|-----------------|
| **dev-collaboration** | revision_addressed, reviewer_minimum, approval_chain | review_timing, decline_percentage |
| **dev-competition** | approval_chain | token_cost |
| **publication-pipeline** | revision_addressed, reviewer_minimum, approval_chain | decline_percentage |
| **peer-collaboration** | approval_chain | token_cost |
| **Any with Codex** | courier_usage | - |

### Why dev-collaboration is the Best Eval Target

The `dev-collaboration` skill produces ALL the metadata that eval packs need:

| Eval Pack | Required Data | dev-collaboration Produces |
|-----------|---------------|---------------------------|
| revision_addressed | breaker_review, change_log | Breaker delivers failure scenarios, Drafter creates Change Log |
| reviewer_minimum | reviewer_suggestions | Reviewer delivers 3-5 actionable suggestions |
| approval_chain | approvals | Reviewer APPROVE, Breaker APPROVE |
| review_timing | timestamps | Sequential phases with clear boundaries |

---

## 7. Data Sources & Telemetry

### Where Data Comes From

| Source | Location | Contains |
|--------|----------|----------|
| **CC JSONL** | `~/.claude/projects/<encoded-path>/*.jsonl` | Full CC conversation with tool calls |
| **CC Telemetry** | `interlateral_dna/cc_telemetry.log` | tmux pipe-pane capture of CC terminal |
| **Codex Telemetry** | `interlateral_dna/codex_telemetry.log` | tmux pipe-pane capture of Codex terminal |
| **Gemini Telemetry** | `interlateral_dna/gemini_telemetry.log` | tmux pipe-pane capture of Gemini terminal |
| **AG Telemetry** | `.gemini/ag_telemetry.log` | AG watch capture (if running) |
| **Events JSONL** | `.observability/events.jsonl` | Dashboard event stream (comms.md changes) |
| **Casts** | `.observability/casts/*.cast` | asciinema terminal recordings |
| **comms.md** | `interlateral_dna/comms.md` | Coordination log (all agents) |

### Telemetry Freshness Check

```bash
# Check all telemetry sources are fresh (modified in last 5 min)
find interlateral_dna/cc_telemetry.log -mmin -5 && echo "CC: FRESH" || echo "CC: STALE"
find interlateral_dna/codex_telemetry.log -mmin -5 && echo "CX: FRESH" || echo "CX: STALE"
find interlateral_dna/gemini_telemetry.log -mmin -5 && echo "GM: FRESH" || echo "GM: STALE"
```

### Enabling Telemetry Capture

```bash
# Enable tmux pipe-pane for each agent
tmux pipe-pane -t interlateral-claude "cat >> interlateral_dna/cc_telemetry.log"
tmux pipe-pane -t interlateral-codex "cat >> interlateral_dna/codex_telemetry.log"
tmux pipe-pane -t interlateral-gemini "cat >> interlateral_dna/gemini_telemetry.log"
```

### CC Locator Discovery

```bash
# Find CC's native JSONL location
./scripts/discover-cc-logs.sh

# Or manually check
ls ~/.claude/projects/-Users-*-$(basename $PWD)/
```

---

## 8. Troubleshooting

### Common Issues

#### "OPENAI_API_KEY not found"

```bash
# Check .env exists and has key
cat .env | grep OPENAI

# Add if missing
echo "OPENAI_API_KEY=sk-your-key" >> .env
```

#### "user_prompt is INVALID_DATA" (Export Fails)

**Cause:** Session wasn't started via `preflight-wakeup.sh`, so the export script can't find a valid user prompt in the CC transcript.

**Workaround A:** Start sessions with preflight:
```bash
./scripts/preflight-wakeup.sh SESSION_NAME --dangerously-skip-permissions "prompt"
```

**Workaround B:** The data IS captured in comms.md and telemetry logs. You can:
1. Manually create a trace JSON from comms.md
2. Run evals directly against comms.md content
3. Use the structured data that WAS extracted (check export output)

#### "No trace found"

```bash
# List available traces
ls -la .observability/traces/

# If empty, export first
./scripts/export-skill-run.sh --from-session
```

#### "ModuleNotFoundError: No module named 'openai'"

```bash
pip install -r corpbot_agent_evals/lake_merritt/requirements.txt
```

#### Eval Reports Show "MOCK_PASS"

**Cause:** Real LLM judge isn't running (fallback to mock mode).

**Fix:**
1. Verify API key is valid
2. Verify Python deps installed
3. Check `corpbot_agent_evals/lake_merritt/core/evaluation.py` exists

#### Telemetry Logs Are Empty

```bash
# Check if pipe-pane is active
tmux show-options -t interlateral-claude | grep pipe

# Re-enable if not
tmux pipe-pane -t interlateral-claude "cat >> interlateral_dna/cc_telemetry.log"
```

---

## 9. Creating New Eval Packs

### Eval Pack Structure

```yaml
schema_version: "1.0"
name: "Human-Readable Name"
description: "What this eval checks"
version: "1.0"

ingestion:
  type: "generic_otel"
  config:
    evaluation_mode: "trace"  # or "span" for per-span scoring
    input_field: "attributes.content"
    include_trace_context: true
    required_metadata:
      - "field_name_1"
      - "field_name_2"

pipeline:
  - name: "scorer_name"
    scorer: "llm_judge"
    config:
      provider: "openai"
      model: "gpt-4o"
      temperature: 0.0
      threshold: 0.7  # Pass/fail threshold
      system_prompt: |
        Instructions for the LLM judge...
      user_prompt_template: |
        ## Data to Analyze
        {{ metadata.field_name_1 | default('Not found') }}

        ## More Data
        {{ metadata.field_name_2 | default('Not found') }}

        Return JSON:
        {
          "score": <0.0-1.0>,
          "reasoning": "..."
        }
    on_fail: "continue"  # or "stop"

reporting:
  format: "markdown"
  template: |
    # Evaluation Report
    **Score:** {{ summary_stats.scorer_name.average_score | round(2) }}
    ...
```

### Step-by-Step: Create a New Eval Pack

1. **Define what you want to measure**
   - What artifact or behavior?
   - What does "good" look like?
   - What threshold makes sense?

2. **Identify data sources**
   - What metadata fields contain the data?
   - Are they captured in current telemetry?

3. **Create the YAML file**
   ```bash
   cp corpbot_agent_evals/lake_merritt/examples/eval_packs/revision_addressed.yaml \
      corpbot_agent_evals/lake_merritt/examples/eval_packs/my_new_pack.yaml
   ```

4. **Customize the prompt template**
   - Be specific about what to look for
   - Define the JSON output schema clearly
   - Include scoring formula in the prompt

5. **Test with a real trace**
   ```bash
   ./scripts/run-skill-eval.sh /path/to/trace.json my_new_pack
   ```

6. **Iterate on threshold and prompt**

### Example: Communication Quality Eval

```yaml
schema_version: "1.0"
name: "Communication Quality Check"
description: "Verify agents used injection AND comms.md (not just one)"
version: "1.0"

ingestion:
  type: "generic_otel"
  config:
    evaluation_mode: trace
    include_trace_context: true

pipeline:
  - name: "comms_quality"
    scorer: "llm_judge"
    config:
      provider: "openai"
      model: "gpt-4o"
      temperature: 0.0
      threshold: 0.8
      user_prompt_template: |
        ## Trace Data
        {{ otel_trace | tojson }}

        Check if agents followed proper communication protocol:
        1. Used terminal injection (cc.js/ag.js/codex.js/gemini.js send)
        2. AND logged to comms.md

        Violations:
        - Writing to comms.md only (no injection)
        - Injection only (no logging)

        Return JSON:
        {
          "messages_analyzed": <int>,
          "properly_communicated": <int>,
          "violations": [{"agent": "...", "type": "comms_only|injection_only"}],
          "score": <properly_communicated / messages_analyzed>,
          "reasoning": "..."
        }
    on_fail: "continue"

reporting:
  format: "markdown"
```

---

## 10. Improving Data Collection

### Current Gaps

| Gap | Impact | Solution |
|-----|--------|----------|
| No structured Change Log extraction | revision_addressed uses regex fallback | Add Change Log schema to skill outputs |
| No explicit approval signals | approval_chain infers from text | Add `[APPROVE]` / `[REQUEST_CHANGES]` markers |
| Timestamp boundaries fuzzy | review_timing may misdetect | Add phase markers to comms.md |
| Codex rollout JSONL not always found | courier_usage incomplete | Improve Codex log discovery |

### Recommended Improvements

#### 1. Structured Output Markers

Add explicit markers that eval packs can reliably extract:

```markdown
## BREAKER_REVIEW_START
FAILURE 1: ...
FAILURE 2: ...
## BREAKER_REVIEW_END

## CHANGE_LOG_START
- Fixed: ...
- Hardened: ...
- Declined: ...
## CHANGE_LOG_END

## APPROVAL: APPROVE
## APPROVAL: REQUEST_CHANGES
```

#### 2. Phase Boundary Timestamps

Add timestamps to skill phases:

```markdown
[CC] @ALL [2026-02-03 10:00:00] PHASE: DRAFT_START
...
[CC] @ALL [2026-02-03 10:15:00] PHASE: DRAFT_END
[Gemini] @ALL [2026-02-03 10:16:00] PHASE: REVIEW_START
```

#### 3. Native Agent Telemetry

For richer data, capture native agent formats:

| Agent | Native Format | Location |
|-------|---------------|----------|
| CC | JSONL with full context | `~/.claude/projects/*/` |
| Codex | Rollout JSONL | `~/.codex/sessions/` |
| Gemini CLI | Unknown | Needs investigation |
| AG | CDP protocol | Captured via ag.js watch |

#### 4. Token Counting

Add explicit token counts to messages for cost tracking:

```json
{
  "message": "...",
  "tokens": {
    "input": 1500,
    "output": 800
  }
}
```

### Future Eval Ideas

| Eval Pack | What It Would Measure |
|-----------|----------------------|
| `response_latency` | Time between agent messages |
| `tool_efficiency` | Unnecessary tool calls |
| `context_retention` | Did agents remember prior messages? |
| `instruction_adherence` | Did agents follow skill rules? |
| `error_recovery` | How did agents handle failures? |

---

## 11. Roadmap

### Phase 1: Stabilize (Current)
- [x] Basic eval packs working
- [x] Session capture workflow
- [ ] Fix export validation for manual sessions
- [ ] Add structured markers to skills

### Phase 2: Expand
- [ ] More eval packs (latency, efficiency)
- [ ] Eval dashboards (trend visualization)
- [ ] CI/CD integration (auto-run evals on skill completion)

### Phase 3: Automate
- [ ] Auto-suggest eval packs based on skill type
- [ ] Fail-fast: block commits if evals fail
- [ ] Cross-session comparison

---

## Quick Reference

### Commands Cheat Sheet

```bash
# Start session
./scripts/start-session.sh "session-name"

# End session
./scripts/end-session.sh

# Export trace
./scripts/export-skill-run.sh --from-session

# Run single eval
./scripts/run-skill-eval.sh <trace> <pack>

# Run all primary evals
for p in revision_addressed reviewer_minimum approval_chain; do
  ./scripts/run-skill-eval.sh "$TRACE" "$p"
done

# View reports
ls .observability/evals/*.md
cat .observability/evals/revision_addressed_*.md
```

### File Locations

```
.env                                    # API key (OPENAI_API_KEY)
.observability/
  session_state.json                    # Current session
  traces/*.json                         # OTEL traces
  evals/*.md                            # Eval reports
  events.jsonl                          # Event stream

corpbot_agent_evals/lake_merritt/
  core/evaluation.py                    # Eval engine
  examples/eval_packs/*.yaml            # Eval definitions

scripts/
  start-session.sh                      # Begin capture
  end-session.sh                        # End capture
  export-skill-run.sh                   # Create trace
  run-skill-eval.sh                     # Run eval pack
```

---

*Guide Version: 1.0*
*Last Updated: 2026-02-03*
*For the Interlateral Quad-Agent Mesh Evaluation System*

---

# PROPOSED REVISIONS

*Reviews collected 2026-02-04 via dev-collaboration skill. Preserved verbatim for future implementation.*

---

## Gemini (REVIEWER) - 4 Suggestions

### SUGGESTION 1: Add a 'Your First Eval' Tutorial Section

**What:** Introduce a new, simple tutorial section right after the Overview. This section would guide a user through the absolute minimum, end-to-end process: running a single, pre-existing trace against a single, simple eval pack (like `token_cost`) and viewing the output. It would use a canned example, removing the complexity of session capture for the initial experience.

**Why:** The current 'Running Evals' section is comprehensive but long. A 'Hello, World!' style tutorial would provide a quick win, build confidence, and give new users a foundational mental model of the input->process->output flow before they tackle the full multi-step workflow.

---

### SUGGESTION 2: Create an Interactive Setup Verification Script

**What:** Create a new script, e.g., `./scripts/verify-eval-setup.sh`. This script would automate all the checks currently listed in the 'Prerequisites' section (API key, Python deps, etc.) and provide a single, clear 'All systems go!' or a list of specific, actionable errors and how to fix them.

**Why:** This replaces multiple manual, error-prone commands with a single, user-friendly diagnostic tool. It lowers the barrier to entry, reduces setup friction, and makes troubleshooting much faster for developers new to the system.

---

### SUGGESTION 3: Add 'Purpose' Explanations to Workflow Steps

**What:** In the 'Running Evals' -> 'Method A: Full Workflow' section, add a short, one-sentence 'Purpose:' line for each of the 6 steps. For example, for 'Step 4: Export Trace', the purpose would be 'To convert the raw session logs into a structured OTEL trace file that the evaluation engine can understand.'

**Why:** The current guide explains *how* to run the workflow but not *why* each step is necessary. Providing the purpose for each command builds a stronger mental model for the user, helping them understand the data pipeline and troubleshoot more effectively when things go wrong.

---

### SUGGESTION 4: Include a Sample Eval Report

**What:** At the end of the 'Eval Packs Reference' or in the 'Running Evals' section, embed an example of a complete, human-readable Markdown report generated by an eval. For instance, show the full output for a `revision_addressed` run.

**Why:** Users need to know what the 'pot of gold at the end of the rainbow' looks like. Showing a concrete example of the final report makes the entire process less abstract, clarifies the value of running evals, and helps users verify that their own output is correct.

---

## Codex (BREAKER) - 5 Failure Scenarios

### FAILURE 1: Wrong Trace Evaluated

**Attack:** The guide tells people to use `TRACE=$(ls -t .observability/traces/*.json | head -1)` which grabs the most recent file. In a busy repo with multiple sessions, this can point to a different run.

**Consequence:** Evals pass/fail a different session than intended, leading to false confidence or wasted debugging.

**Prevention:** Require explicit trace selection via `session_state.json` or by passing a session name to export and using the reported trace path; add a "verify trace metadata" step before running packs.

---

### FAILURE 2: Manual Export Workaround Produces Invalid Traces

**Attack:** The "manual session" workaround suggests creating a trace JSON from comms.md or running evals directly on comms.md without giving a schema or supported path.

**Consequence:** Users generate malformed traces, evals fail unpredictably, or (worse) pass with missing data, undermining trust in scoring.

**Prevention:** Either provide a supported script for manual trace construction or explicitly state that manual exports are unsupported and must use preflight to be valid.

---

### FAILURE 3: MOCK_PASS Misread as Real Pass

**Attack:** If the API key or deps are missing, the system can fall back to "MOCK_PASS." A rushed operator may treat these as real passes.

**Consequence:** Quality gates are bypassed without running the LLM judge, allowing regressions into production.

**Prevention:** Add a hard warning: "MOCK_PASS is invalid for gating." Recommend a preflight check that fails the eval run if mock mode is detected.

---

### FAILURE 4: Approval Chain vs Timeout/Partial Revision Mismatch

**Attack:** The guide requires `approval_chain` = 1.0, but dev-collaboration allows "Partial Revision" on timeout. This causes unavoidable eval failure even when the skill was followed.

**Consequence:** Teams see false negative failures and may ignore evals entirely.

**Prevention:** Document the timeout exception and add a marker or alternate eval pack for partial revisions (e.g., allow "missing approval with timeout note").

---

### FAILURE 5: Telemetry Capture Assumed, Not Verified

**Attack:** The guide assumes tmux sessions and pipe-pane are active. On systems without the expected tmux sessions or when pipe-pane isn't enabled, logs stay empty but the workflow still proceeds.

**Consequence:** Exported traces lack critical data; evals score against incomplete context and can pass incorrectly.

**Prevention:** Add a mandatory telemetry integrity check (non-empty logs + recent timestamps) and abort export/evals if capture isn't active.

---

*End of proposed revisions. Implementation pending future dev cycle.*
