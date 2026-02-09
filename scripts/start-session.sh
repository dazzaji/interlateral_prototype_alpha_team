#!/bin/bash
# Start a new OTEL session - records byte offsets for telemetry logs
# Usage: ./scripts/start-session.sh [skill_name]
# Part of P0: Authoritative OTEL Generation

set -e

SKILL_NAME=${1:-"dev-collaboration"}
EVAL_SESSION_ID=${2:-""}
SESSION_ID="${SKILL_NAME}_$(date +%Y%m%d_%H%M%S)"
START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Get script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

# Telemetry log paths
CC_LOG="interlateral_dna/cc_telemetry.log"
CX_LOG="interlateral_dna/codex_telemetry.log"
AG_LOG=".gemini/ag_telemetry.log"
EVENTS_LOG=".observability/events.jsonl"

# Record line offsets (0 if file doesn't exist)
CC_OFFSET=$(wc -l < "$CC_LOG" 2>/dev/null | tr -d ' ' || echo 0)
CX_OFFSET=$(wc -l < "$CX_LOG" 2>/dev/null | tr -d ' ' || echo 0)
AG_OFFSET=$(wc -l < "$AG_LOG" 2>/dev/null | tr -d ' ' || echo 0)

# Record events.jsonl line count for later filtering
EVENTS_LINES=$(wc -l < "$EVENTS_LOG" 2>/dev/null | tr -d ' ' || echo 0)

# Discovery for Native logs (Option A Consensus)
CC_PROJECT_DIR=$(ls -td ~/.claude/projects/*/ 2>/dev/null | head -1 || echo "")
CC_JSONL_PATH=$(ls -t "$CC_PROJECT_DIR"/*.jsonl 2>/dev/null | head -1 || echo "")
CX_ROLLOUT_PATH=$(find ~/.codex/sessions -type f -name "*.jsonl" 2>/dev/null | xargs ls -t 2>/dev/null | head -1 || echo "")

# Create session state directory
mkdir -p .observability

# Write session state file using jq for robustness (Reviewer 01 fix)
# Note: Offsets are now LINE COUNTS (Version 3)
jq -n \
  --arg sid "$SESSION_ID" \
  --arg esid "$EVAL_SESSION_ID" \
  --arg skill "$SKILL_NAME" \
  --arg start "$START_TIME" \
  --arg cc_log "$CC_JSONL_PATH" \
  --arg cx_log "$CX_ROLLOUT_PATH" \
  --argjson cc_off $CC_OFFSET \
  --argjson cx_off $CX_OFFSET \
  --argjson ag_off $AG_OFFSET \
  --argjson ev_lines $EVENTS_LINES \
  '{
    session_id: $sid,
    eval_session_id: $esid,
    skill_name: $skill,
    start_time: $start,
    end_time: null,
    status: "running",
    cc_jsonl_path: $cc_log,
    cx_rollout_path: $cx_log,
    line_offsets: {
      cc_telemetry: $cc_off,
      codex_telemetry: $cx_off,
      ag_telemetry: $ag_off,
      events_jsonl_lines: $ev_lines
    }
  }' > .observability/session_state.json

echo "=== OTEL Session Started ==="
echo "Session ID: $SESSION_ID"
echo "Skill: $SKILL_NAME"
echo "Start Time: $START_TIME"
echo ""
echo "Byte Offsets Recorded:"
echo "  CC telemetry: $CC_OFFSET bytes"
echo "  CX telemetry: $CX_OFFSET bytes"
echo "  AG telemetry: $AG_OFFSET bytes"
echo "  Events lines: $EVENTS_LINES"
echo ""
echo "Session state: .observability/session_state.json"
echo ""
echo "Run your skill now. When done, run:"
echo "  ./scripts/end-session.sh"
echo "  ./scripts/export-skill-run.sh --from-session"
