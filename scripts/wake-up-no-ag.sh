#!/bin/bash
# wake-up-no-ag.sh - Canonical entrypoint for CC with observability (NO AGENT ANTIGRAVITY)
#
# Usage:
#   ./scripts/wake-up-no-ag.sh "Your prompt here"
#   ./scripts/wake-up-no-ag.sh --dangerously-skip-permissions "Your prompt"
#
# Note: If the flag is omitted, this script defaults to --dangerously-skip-permissions.
#
# DESIGN PHILOSOPHY:
# Human runs ONE command, system does EVERYTHING:
# 1. Bootstrap dashboard and tmux sessions (bootstrap-full-no-ag.sh)
# 2. Set up observability (casts, logs)
# 3. Start CC with recording

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Source shared tmux configuration
source "$SCRIPT_DIR/tmux-config.sh"

# Default to full permissions unless explicitly provided
HAS_DANGEROUS=0
for arg in "$@"; do
    if [[ "$arg" == "--dangerously-skip-permissions" ]]; then
        HAS_DANGEROUS=1
        break
    fi
done
if [[ "$HAS_DANGEROUS" -eq 0 ]]; then
    set -- --dangerously-skip-permissions "$@"
    echo "[wake-up] Defaulting to --dangerously-skip-permissions"
fi

# Handle prompt from file if WAKEUP_PROMPT_FILE is set
if [[ -n "${WAKEUP_PROMPT_FILE:-}" ]] && [[ -f "$WAKEUP_PROMPT_FILE" ]]; then
    # Read prompt from file, prepend to args
    FILE_PROMPT=$(cat "$WAKEUP_PROMPT_FILE")
    # Find where to insert the prompt (after flags like --dangerously-skip-permissions)
    NEW_ARGS=()
    for arg in "$@"; do
        NEW_ARGS+=("$arg")
    done
    NEW_ARGS+=("$FILE_PROMPT")
    set -- "${NEW_ARGS[@]}"
    echo "[wake-up] Prompt loaded from file: $WAKEUP_PROMPT_FILE"
fi

echo "============================================"
echo "  INTERLATERAL WAKE-UP (No AG)"
echo "============================================"
echo ""

# STEP 1: Bootstrap the system (NO AG) BEFORE CC wakes
echo "Step 1: System bootstrap (No AG)..."
if [ -x "$REPO_ROOT/scripts/bootstrap-full-no-ag.sh" ]; then
    "$REPO_ROOT/scripts/bootstrap-full-no-ag.sh" || {
        echo ""
        echo "WARNING: Bootstrap had issues but continuing with CC startup."
        echo "Some features may not work until fixed."
        echo ""
    }
else
    echo "WARNING: bootstrap-full-no-ag.sh not found. Skipping system bootstrap."
fi

# Auto-open Comms Monitor in Chrome (if dashboard is running)
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "  Opening Comms Monitor in Chrome..."
    open -a "Google Chrome" http://localhost:5173 2>/dev/null || true
fi

echo ""

# STEP 1b: Start courier for Codex outbound messages
echo "Step 1b: Starting courier for Codex outbound..."
if [ -f "$REPO_ROOT/interlateral_dna/courier.js" ]; then
    pkill -f "node.*$REPO_ROOT/interlateral_dna/courier.js" 2>/dev/null || true
    cd "$REPO_ROOT/interlateral_dna" && node courier.js > /tmp/courier.log 2>&1 &
    echo "  Courier started (PID: $!, log: /tmp/courier.log)"
else
    echo "  WARNING: courier.js not found. Codex outbound messages will not be delivered."
fi
cd "$REPO_ROOT"

echo ""

# STEP 2: Ensure observability directories exist
echo "Step 2: Observability setup..."
mkdir -p "$REPO_ROOT/.observability/casts" "$REPO_ROOT/.observability/logs"
echo "  Directories ready"

# Create fresh coordination files (empty for clean context)
echo "# Coordination Log - Session $(date -u '+%Y-%m-%d %H:%M:%S UTC')" > "$REPO_ROOT/interlateral_dna/comms.md"
echo "# AG Message Log - Session $(date -u '+%Y-%m-%d %H:%M:%S UTC')" > "$REPO_ROOT/interlateral_dna/ag_log.md"
echo "  Coordination files created (fresh/empty)"

if [ -x "$REPO_ROOT/scripts/rotate-logs.sh" ]; then
    "$REPO_ROOT/scripts/rotate-logs.sh" 2>/dev/null || true
    echo "  Log rotation complete"
fi

echo ""

# STEP 3: Start CC with observability wrapper
echo "Step 3: Starting Claude Code..."
echo "============================================"
echo ""

SESSION_NAME="${CC_TMUX_SESSION:-interlateral-claude}"

if [ -z "${TMUX:-}" ]; then
    echo "  Not in a tmux session. Launching CC inside tmux session '$SESSION_NAME'..."
    
    if ! run_tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        run_tmux new-session -d -s "$SESSION_NAME" -c "$REPO_ROOT"
    fi

    run_tmux set-option -t "$SESSION_NAME" history-limit 100000 2>/dev/null || true
    echo "  tmux scrollback buffer set to 100000 lines"

    CMD_TO_RUN="$REPO_ROOT/scripts/logged-claude.sh $(printf '%q ' "$@")"
    
    run_tmux send-keys -t "$SESSION_NAME" C-c "cd $(printf '%q' "$REPO_ROOT") && $CMD_TO_RUN" Enter
    
    echo "  CC command sent to session '$SESSION_NAME'."
    
    sleep 2

    echo ""
    echo "  [INFO] Independent terminal windows should be open for agents."
    echo "  [INFO] If you do not see a 'Claude Code' window, the system will attach here in 5 seconds."
    echo ""
    echo "  Press Ctrl+C to stay detached, or Enter to attach immediately."

    read -t 5 -r || true

    if run_tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        if [ -z "${TMUX:-}" ]; then
             echo "  [FALLBACK] Attaching to session '$SESSION_NAME'..."
             exec tmux -S "$TMUX_SOCKET" attach-session -t "$SESSION_NAME"
        fi
    fi
else
    CURRENT_SESSION=$(run_tmux display-message -p '#S' 2>/dev/null || tmux display-message -p '#S' 2>/dev/null || echo "")
    if [ "$CURRENT_SESSION" = "$SESSION_NAME" ]; then
        echo "  Already inside tmux session '$SESSION_NAME'. Proceeding..."
        exec "$REPO_ROOT/scripts/logged-claude.sh" "$@"
    else
        echo "  In a DIFFERENT tmux session ($CURRENT_SESSION). Redirecting to '$SESSION_NAME'..."
        CMD_TO_RUN="$REPO_ROOT/scripts/logged-claude.sh $(printf '%q ' "$@")"
        run_tmux send-keys -t "$SESSION_NAME" C-c "cd $(printf '%q' "$REPO_ROOT") && $CMD_TO_RUN" Enter
        exec tmux -S "$TMUX_SOCKET" switch-client -t "$SESSION_NAME"
    fi
fi
