#!/bin/bash
# Export skill run to OTEL trace with authoritative telemetry sources
# Part of P0: Authoritative OTEL Generation v2.0
#
#   ./export-skill-run.sh --from-session                    # Use session_state.json
#   ./export-skill-run.sh --bundle <session_id>             # Native Harvest (Option A)
#   ./export-skill-run.sh <start_time> <end_time> [skill]   # Legacy time-based

set -e

# Get script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

# Defaults
SESSION_FILE=".observability/session_state.json"
OUTPUT_DIR=".observability/traces"
EVALS_DIR=".observability/evals"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Parse arguments
if [ "$1" = "--bundle" ]; then
  # Native Harvest (P0 Option A approach)
  export HARVEST_SESSION_ID="$2"
  BUNDLE_DIR=".observability/runs/$HARVEST_SESSION_ID"
  
  if [ ! -d "$BUNDLE_DIR" ]; then
    echo "ERROR: Bundle directory not found at $BUNDLE_DIR"
    echo "Run harvest script first: ./scripts/harvest-session.sh $HARVEST_SESSION_ID"
    exit 1
  fi
  
  SESSION_ID="$HARVEST_SESSION_ID"
  SKILL_NAME="dev-collaboration" # Default for Test 3
  START_TIME=$(date -u -v-24H +"%Y-%m-%dT%H:%M:%SZ") # Safer lookback for bundle extraction
  END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  # Offsets not used for native bundle (we use whole files)
  CC_OFFSET=0
  CX_OFFSET=0
  AG_OFFSET=0
  EVENTS_LINES=0
  
  export USE_NATIVE_BUNDLE=true
  echo "=== Exporting from Native Bundle ==="
  echo "Session ID: $SESSION_ID"

elif [ "$1" = "--from-session" ]; then
  # Session-based export (P0 v5 approach)
  if [ ! -f "$SESSION_FILE" ]; then
    echo "ERROR: No session file found at $SESSION_FILE"
    echo "Start a session first with: ./scripts/start-session.sh"
    exit 1
  fi

  SESSION_ID=$(jq -r '.session_id' "$SESSION_FILE")
  SKILL_NAME=$(jq -r '.skill_name' "$SESSION_FILE")
  START_TIME=$(jq -r '.start_time' "$SESSION_FILE")
  END_TIME=$(jq -r '.end_time // empty' "$SESSION_FILE")

  if [ -z "$END_TIME" ] || [ "$END_TIME" = "null" ]; then
    END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  fi

  # Read line offsets (Version 3)
  CC_OFFSET=$(jq -r '.line_offsets.cc_telemetry // 0' "$SESSION_FILE")
  CX_OFFSET=$(jq -r '.line_offsets.codex_telemetry // 0' "$SESSION_FILE")
  AG_OFFSET=$(jq -r '.line_offsets.ag_telemetry // 0' "$SESSION_FILE")
  EVENTS_LINES=$(jq -r '.line_offsets.events_jsonl_lines // 0' "$SESSION_FILE")

  echo "=== Exporting from Session ==="
  echo "Session ID: $SESSION_ID"
  echo "Time Range: $START_TIME to $END_TIME"
  echo "Line Offsets: CC=$CC_OFFSET, CX=$CX_OFFSET, AG=$AG_OFFSET"

else
  # Legacy time-based export
  START_TIME=$1
  END_TIME=$2
  SKILL_NAME=${3:-"unknown"}
  SESSION_ID="${SKILL_NAME}_${TIMESTAMP}"

  # Use full logs (no offset)
  CC_OFFSET=0
  CX_OFFSET=0
  AG_OFFSET=0
  EVENTS_LINES=0

  if [ -z "$START_TIME" ] || [ -z "$END_TIME" ]; then
    echo "Usage: $0 --from-session"
    echo "   or: $0 <start_time> <end_time> [skill_name]"
    exit 1
  fi
fi

OUTPUT_FILE="${OUTPUT_DIR}/${SKILL_NAME}_${TIMESTAMP}.json"
mkdir -p "$OUTPUT_DIR"

# Check for events file
EVENTS_FILE=".observability/events.jsonl"
if [ ! -f "$EVENTS_FILE" ]; then
  echo "WARNING: events.jsonl not found, creating empty file"
  touch "$EVENTS_FILE"
fi

# Export using standalone Node.js script (Fix 12d - avoids bash/Node.js template literal conflicts)
if [ "$USE_NATIVE_BUNDLE" = "true" ]; then
  # Native bundle mode
  node "$SCRIPT_DIR/export-otel.mjs" \
    --session-id "$SESSION_ID" \
    --skill-name "$SKILL_NAME" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --output "$OUTPUT_FILE" \
    --native-bundle "$HARVEST_SESSION_ID"
else
  # Line-offset mode
  node "$SCRIPT_DIR/export-otel.mjs" \
    --session-id "$SESSION_ID" \
    --skill-name "$SKILL_NAME" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --output "$OUTPUT_FILE" \
    --cc-offset "$CC_OFFSET" \
    --cx-offset "$CX_OFFSET" \
    --ag-offset "$AG_OFFSET" \
    --events-lines "$EVENTS_LINES"
fi

# Fix 12h: Write trace path to known location for reliable consumption
# This prevents stale trace selection via `ls -t` if export fails
LAST_TRACE_FILE=".observability/last_trace.txt"
echo "$OUTPUT_FILE" > "$LAST_TRACE_FILE"
echo "Trace path written to: $LAST_TRACE_FILE"

echo ""
echo "=== Export Complete ==="
echo "Output: $OUTPUT_FILE"
echo ""
echo "To run evals:"
echo "  ./scripts/run-skill-eval.sh $OUTPUT_FILE revision_addressed"
echo "  ./scripts/run-skill-eval.sh $OUTPUT_FILE reviewer_minimum"
echo "  ./scripts/run-skill-eval.sh $OUTPUT_FILE approval_chain"
