#!/bin/bash
# End an OTEL session - records end time and marks complete
# Usage: ./scripts/end-session.sh
# Part of P0: Authoritative OTEL Generation

set -e

# Get script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

SESSION_FILE=".observability/session_state.json"

if [ ! -f "$SESSION_FILE" ]; then
  echo "ERROR: No active session found at $SESSION_FILE"
  echo "Start a session first with: ./scripts/start-session.sh"
  exit 1
fi

# Read current session
SESSION_ID=$(jq -r '.session_id' "$SESSION_FILE")
START_TIME=$(jq -r '.start_time' "$SESSION_FILE")
END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Update session file with end time
jq --arg end_time "$END_TIME" '.end_time = $end_time | .status = "completed"' "$SESSION_FILE" > "${SESSION_FILE}.tmp"
mv "${SESSION_FILE}.tmp" "$SESSION_FILE"

echo "=== OTEL Session Ended ==="
echo "Session ID: $SESSION_ID"
echo "Start Time: $START_TIME"
echo "End Time: $END_TIME"
echo "Status: completed"
echo ""
echo "To export the trace, run:"
echo "  ./scripts/export-skill-run.sh --from-session"
