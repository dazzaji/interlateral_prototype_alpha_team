#!/bin/bash
# wake-up.sh - Canonical entrypoint for CC with observability
#
# This is the ONLY command a human should need to run.
# Everything else is handled automatically.
#
# Usage:
#   ./scripts/wake-up.sh "Your prompt here"
#   ./scripts/wake-up.sh --dangerously-skip-permissions "Your prompt"
#   WAKEUP_PROMPT_FILE=/tmp/prompt.txt ./scripts/wake-up.sh --dangerously-skip-permissions
#
# Note: If the flag is omitted, this script defaults to --dangerously-skip-permissions.
#
# DESIGN PHILOSOPHY:
# Human runs ONE command, system does EVERYTHING:
# 1. Bootstrap AG with CDP, dashboard, tmux (bootstrap-full.sh)
# 2. Set up observability (casts, logs)
# 3. Start CC with recording
#
# When CC wakes up, the ENTIRE system is already running.
# CC does NOT need to run setup commands - they're done for it.
#
# PROMPT HANDLING:
# If WAKEUP_PROMPT_FILE env var is set, read prompt from that file.
# This completely avoids shell quoting issues for complex prompts.
#
# BC-01: This replaces the alias-based approach that failed on fresh clones.

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
echo "  INTERLATERAL WAKE-UP"
echo "============================================"
echo ""

# STEP 1: Bootstrap the entire system BEFORE CC wakes
# This ensures AG, dashboard, and tmux are ready
echo "Step 1: System bootstrap..."
if [ -x "$REPO_ROOT/scripts/bootstrap-full.sh" ]; then
    # Run bootstrap, but don't fail wake-up if it has issues
    "$REPO_ROOT/scripts/bootstrap-full.sh" || {
        echo ""
        echo "WARNING: Bootstrap had issues but continuing with CC startup."
        echo "Some features may not work until fixed."
        echo ""
    }
else
    echo "WARNING: bootstrap-full.sh not found. Skipping system bootstrap."
fi

# Fix C: Auto-open Comms Monitor in Chrome (if dashboard is running)
# This saves the human from having to manually open the browser
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "  Opening Comms Monitor in Chrome..."
    open -a "Google Chrome" http://localhost:5173 2>/dev/null || true
fi

echo ""

# STEP 1b: Start courier for Codex outbound messages
echo "Step 1b: Starting courier for Codex outbound..."
if [ -f "$REPO_ROOT/interlateral_dna/courier.js" ]; then
    # Kill any existing courier process FOR THIS REPO ONLY (scoped by path)
    pkill -f "node.*$REPO_ROOT/interlateral_dna/courier.js" 2>/dev/null || true
    # Start courier in background with logging
    cd "$REPO_ROOT/interlateral_dna" && node courier.js > /tmp/courier.log 2>&1 &
    echo "  Courier started (PID: $!, log: /tmp/courier.log)"
else
    echo "  WARNING: courier.js not found. Codex outbound messages will not be delivered."
fi

# STEP 1c: Start AG Watcher for persistent telemetry
echo "Step 1c: Starting AG Watcher for telemetry..."
if [ -f "$REPO_ROOT/interlateral_dna/ag.js" ]; then
    # Kill any existing ag.js watch process FOR THIS REPO ONLY
    pkill -f "node.*$REPO_ROOT/interlateral_dna/ag.js watch" 2>/dev/null || true
    
    # NEW: Gate watcher start on AG/CDP readiness to avoid noise
    if curl -s --max-time 2 http://127.0.0.1:9222/json/list > /dev/null 2>&1; then
        # Start watcher in background (polls every 5s by default)
        cd "$REPO_ROOT/interlateral_dna" && node ag.js watch > /tmp/ag_watcher.log 2>&1 &
        echo "  AG Watcher started (PID: $!, log: /tmp/ag_watcher.log)"
    else
        echo "  WARNING: AG CDP port 9222 not reachable. Watcher not started."
        echo "  (Ensure Antigravity is running with remote debugging enabled)"
    fi
    cd "$REPO_ROOT"
else
    echo "  WARNING: ag.js not found. AG telemetry will not be captured."
fi

echo ""

# STEP 2: Ensure observability directories exist
echo "Step 2: Observability setup..."
mkdir -p "$REPO_ROOT/.observability/casts" "$REPO_ROOT/.observability/logs"
echo "  Directories ready"

# Create fresh coordination files (empty for clean context)
echo "# Coordination Log - Session $(date -u '+%Y-%m-%d %H:%M:%S UTC')" > "$REPO_ROOT/interlateral_dna/comms.md"
echo "# AG Message Log - Session $(date -u '+%Y-%m-%d %H:%M:%S UTC')" > "$REPO_ROOT/interlateral_dna/ag_log.md"
echo "  Coordination files created (fresh/empty)"

# Best-effort rotation (should NEVER block wake-up)
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

# NEW: Determine if we are already inside the target tmux session
# This prevents recursion if wake-up.sh is called from inside the session
if [ -z "${TMUX:-}" ]; then
    echo "  Not in a tmux session. Launching CC inside tmux session '$SESSION_NAME'..."
    
    # Ensure the session is ready (via bootstrap or manual creation)
    if ! run_tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        run_tmux new-session -d -s "$SESSION_NAME" -c "$REPO_ROOT"
    fi

    # Fix B: Increase tmux scrollback buffer for better history
    # ~/.tmux.conf sets 100000 globally, but ensure it's set on this session too
    run_tmux set-option -t "$SESSION_NAME" history-limit 100000 2>/dev/null || true
    echo "  tmux scrollback buffer set to 100000 lines"

    # Build the command to run inside tmux
    # We use logged-claude.sh to preserve recording
    CMD_TO_RUN="$REPO_ROOT/scripts/logged-claude.sh $(printf '%q ' "$@")"
    
    # Clear any text already in the pane (safety) and send the command
    run_tmux send-keys -t "$SESSION_NAME" C-c "cd $(printf '%q' "$REPO_ROOT") && $CMD_TO_RUN" Enter
    
    echo "  CC command sent to session '$SESSION_NAME'."
    
    # v1.1: Intelligent fallback logic
    echo "  Checking for visible agent terminals..."

    # Check if we successfully opened a window for CC (simple heuristic or relying on user)
    # Since we can't easily query Terminal.app state from here without more Applescript,
    # we will wait a moment and then rely on the fallback if the user is still here.

    sleep 2

    echo ""
    echo "  [INFO] Independent terminal windows should be open for agents."
    echo "  [INFO] If you do not see a 'Claude Code' window, the system will attach here in 5 seconds."
    echo ""
    echo "  Press Ctrl+C to stay detached, or Enter to attach immediately."

    # Wait with timeout for fallback attach
    read -t 5 -r || true

    # Fallback: Attach if user hasn't backgrounded us
    if run_tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        # logical check: if we are not inside tmux, attach
        if [ -z "${TMUX:-}" ]; then
             echo "  [FALLBACK] Attaching to session '$SESSION_NAME'..."
             exec tmux -S "$TMUX_SOCKET" attach-session -t "$SESSION_NAME"
        fi
    fi
else
    # We are already in a tmux session. Check if it's the right one.
    CURRENT_SESSION=$(run_tmux display-message -p '#S' 2>/dev/null || tmux display-message -p '#S' 2>/dev/null || echo "")
    if [ "$CURRENT_SESSION" = "$SESSION_NAME" ]; then
        echo "  Already inside tmux session '$SESSION_NAME'. Proceeding..."
        exec "$REPO_ROOT/scripts/logged-claude.sh" "$@"
    else
        echo "  In a DIFFERENT tmux session ($CURRENT_SESSION). Redirecting to '$SESSION_NAME'..."
        # Same logic: send command to correct session and switch
        CMD_TO_RUN="$REPO_ROOT/scripts/logged-claude.sh $(printf '%q ' "$@")"
        run_tmux send-keys -t "$SESSION_NAME" C-c "cd $(printf '%q' "$REPO_ROOT") && $CMD_TO_RUN" Enter
        exec tmux -S "$TMUX_SOCKET" switch-client -t "$SESSION_NAME"
    fi
fi
