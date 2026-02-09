#!/usr/bin/env bash
# preflight-wakeup.sh - Single command to start dashboard, session, and wake up agents
# Part of the Interlateral Tri-Agent Mesh
#
# Usage:
#   ./scripts/preflight-wakeup.sh <session-name> [wake-up.sh args...]
#   ./scripts/preflight-wakeup.sh <session-name> --dangerously-skip-permissions --prompt-file <file>
#
# Examples:
#   ./scripts/preflight-wakeup.sh test3-minimal-skin --dangerously-skip-permissions
#   ./scripts/preflight-wakeup.sh my-feature --dangerously-skip-permissions "Your prompt here"
#   ./scripts/preflight-wakeup.sh my-feature --dangerously-skip-permissions --prompt-file /tmp/prompt.txt
#
# The --prompt-file option reads the prompt from a file, completely avoiding shell quoting issues.

set -euo pipefail

# First arg is the session name for start-session.sh.
SESSION_NAME="${1:-}"
shift || true  # consumes session name; $@ now contains ONLY extra wake-up.sh args

# Guard: Reject flag-like session names (user likely forgot session name)
if [[ -z "$SESSION_NAME" ]] || [[ "$SESSION_NAME" == -* ]]; then
  echo "ERROR: First argument must be a session name (not a flag)."
  echo ""
  echo "Usage: $0 <session-name> [wake-up.sh args...]"
  echo ""
  echo "Examples:"
  echo "  $0 test3-minimal-skin --dangerously-skip-permissions"
  echo "  $0 my-feature --dangerously-skip-permissions \"Your prompt\""
  echo ""
  echo "The session name is required for telemetry capture."
  exit 1
fi

# Ensure we run from repo root (helps if invoked from elsewhere)
if git rev-parse --show-toplevel >/dev/null 2>&1; then
  cd "$(git rev-parse --show-toplevel)"
fi

mkdir -p .observability

# 1) Start dashboard/events emitter (if not already running)
DASH_DIR="${DASH_DIR:-interlateral_comms_monitor/scripts}"
DASH_START="${DASH_START:-./start.sh}"
DASH_PORT="${DASH_PORT:-3001}"

# Check if dashboard is running by testing the backend port
if curl -s --max-time 2 "http://localhost:${DASH_PORT}/api/streams/status" >/dev/null 2>&1; then
  echo "[preflight] Dashboard already running on port ${DASH_PORT}."
else
  echo "[preflight] Starting dashboard/events emitter..."
  (
    cd "$DASH_DIR"
    nohup "$DASH_START" > ../../.observability/dashboard.out 2>&1 &
  )

  # Wait and verify dashboard actually started
  echo "[preflight] Waiting for dashboard to start..."
  RETRIES=10
  while [[ $RETRIES -gt 0 ]]; do
    sleep 1
    if curl -s --max-time 2 "http://localhost:${DASH_PORT}/api/streams/status" >/dev/null 2>&1; then
      echo "[preflight] Dashboard started successfully on port ${DASH_PORT}."
      break
    fi
    RETRIES=$((RETRIES - 1))
  done

  if [[ $RETRIES -eq 0 ]]; then
    echo "[preflight] WARNING: Dashboard may not have started. Check .observability/dashboard.out"
    echo "[preflight] Continuing anyway - events.jsonl may not be populated."
  fi
fi

# 2) Wake up CC
# Generate a unique session anchor with full UUID for collision-free isolation (Version 3)
if command -v uuidgen &> /dev/null; then
  EVAL_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
else
  EVAL_ID="$(date +%Y%m%d_%H%M%S)_$(head -c 4 /dev/urandom | xxd -p)"
fi
EVAL_SESSION_ID="eval_${EVAL_ID}"
mkdir -p ".observability/SESSIONS"

# 3) Start deterministic session capture
echo "[preflight] Starting session capture: $SESSION_NAME ($EVAL_SESSION_ID)"
./scripts/start-session.sh "$SESSION_NAME" "$EVAL_SESSION_ID"

# Establish Full UUID isolation for CODEX_HOME
export CODEX_HOME="$(pwd)/.observability/SESSIONS/${EVAL_SESSION_ID}/codex"
mkdir -p "$CODEX_HOME"

ANCHOR_FILE=".observability/SESSIONS/${EVAL_SESSION_ID}.anchor"
touch "$ANCHOR_FILE"

ANCHOR_CMD="ls \"$(pwd)/$ANCHOR_FILE\""
echo "[preflight] Session Anchor: $EVAL_SESSION_ID"
echo "[preflight] Codex Isolation: $CODEX_HOME"

# Parse wake-up args (preserve flags, allow prompt-file)
PROMPT_FILE=""
WAKEUP_ARGS=()
PROMPT_PARTS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt-file)
      PROMPT_FILE="${2:-}"
      shift 2 || true
      ;;
    --dangerously-skip-permissions)
      WAKEUP_ARGS+=("$1")
      shift
      ;;
    --ask-for-approval)
      WAKEUP_ARGS+=("$1" "${2:-}")
      shift 2 || true
      ;;
    --*)
      WAKEUP_ARGS+=("$1")
      shift
      ;;
    *)
      PROMPT_PARTS+=("$1")
      shift
      ;;
  esac
done

PROMPT=""
if [[ -n "$PROMPT_FILE" ]]; then
  if [[ ! -f "$PROMPT_FILE" ]]; then
    echo "ERROR: Prompt file not found: $PROMPT_FILE"
    exit 1
  fi
  PROMPT="$(cat "$PROMPT_FILE")"
elif [[ ${#PROMPT_PARTS[@]} -gt 0 ]]; then
  PROMPT="${PROMPT_PARTS[*]}"
fi

if [[ -n "$PROMPT" ]]; then
  MODIFIED_PROMPT="${PROMPT}. ALSO RUN THIS ANCHOR COMMAND FIRST: ${ANCHOR_CMD}"
  MODIFIED_PROMPT_FILE=$(mktemp)
  echo "$MODIFIED_PROMPT" > "$MODIFIED_PROMPT_FILE"

  echo "[preflight] Running wake-up with anchored prompt..."
  WAKEUP_PROMPT_FILE="$MODIFIED_PROMPT_FILE" ./scripts/wake-up.sh "${WAKEUP_ARGS[@]}"
else
  echo "[preflight] Running wake-up (no args) with anchor command..."
  ./scripts/wake-up.sh "${WAKEUP_ARGS[@]}" "ls \"$(pwd)/$ANCHOR_FILE\""
fi

echo "[preflight] Done. Now paste the assignment prompt after all three agents ask."
