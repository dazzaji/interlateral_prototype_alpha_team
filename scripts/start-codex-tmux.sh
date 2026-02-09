#!/bin/bash
# start-codex-tmux.sh - Launch Codex in tmux with telemetry capture
# Tri-Agent Mesh: CC + AG + Codex
#
# IMPORTANT: Uses explicit safety flags to prevent interactive blocking:
#   --sandbox workspace-write    (can only write within workspace)
#   --ask-for-approval never     (autonomous operation, no prompts)
#
# This matches the autonomy pattern used by CC (--dangerously-skip-permissions)

set -e

# Configuration
SESSION_NAME="${CODEX_TMUX_SESSION:-interlateral-codex}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source shared tmux configuration
source "$SCRIPT_DIR/tmux-config.sh"
unset TMUX
DNA_DIR="$PROJECT_ROOT/interlateral_dna"
TELEMETRY_LOG="$DNA_DIR/codex_telemetry.log"

echo "==================================="
echo "Codex tmux Launcher"
echo "Tri-Agent Mesh: CC + AG + Codex"
echo "==================================="
echo ""
echo "Session name: $SESSION_NAME"
echo "Telemetry log: $TELEMETRY_LOG"
echo ""

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "ERROR: tmux is not installed. Please install it:"
    echo "  macOS: brew install tmux"
    echo "  Linux: sudo apt install tmux"
    exit 1
fi

# Check if codex command exists
if ! command -v codex &> /dev/null; then
    echo "ERROR: 'codex' command not found."
    echo ""
    echo "Install Codex CLI:"
    echo "  Option A: brew install --cask codex"
    echo "  Option B: npm i -g @openai/codex"
    echo ""
    echo "Then authenticate:"
    echo "  codex login"
    exit 1
fi

# Check authentication
"$SCRIPT_DIR/check-codex-auth.sh"
if [ $? -ne 0 ]; then
    echo "Authentication check failed. Please log in."
    exit 1
fi

# Check if session already exists
if run_tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Session '$SESSION_NAME' already exists!"
    echo ""
    echo "Options:"
    echo "  1. Attach to it:  tmux -S \"$TMUX_SOCKET\" attach -t $SESSION_NAME"
    echo "  2. Kill it first: tmux -S \"$TMUX_SOCKET\" kill-session -t $SESSION_NAME"
    echo ""
    read -p "Attach to existing session? [Y/n] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        run_tmux attach -t "$SESSION_NAME"
        exit 0
    else
        echo "Exiting. Kill the session first if you want to start fresh."
        exit 1
    fi
fi

# Create new tmux session with Codex
echo "Creating tmux session '$SESSION_NAME'..."

# Start session in detached mode, then set up pipe-pane for telemetry
run_tmux new-session -d -s "$SESSION_NAME" -c "$PROJECT_ROOT"

# Set up telemetry capture via pipe-pane
# This captures ALL terminal output to the log file
echo "Setting up telemetry capture to: $TELEMETRY_LOG"
run_tmux pipe-pane -t "$SESSION_NAME" "cat >> '$TELEMETRY_LOG'"

# Add timestamp header to telemetry log
echo "" >> "$TELEMETRY_LOG"
echo "========================================" >> "$TELEMETRY_LOG"
echo "[CODEX SESSION START] $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> "$TELEMETRY_LOG"
echo "Session: $SESSION_NAME" >> "$TELEMETRY_LOG"
echo "Binary: $(which codex)" >> "$TELEMETRY_LOG"
echo "Version: $(codex --version)" >> "$TELEMETRY_LOG"
echo "========================================" >> "$TELEMETRY_LOG"
echo "" >> "$TELEMETRY_LOG"

# Send the codex command with full permissions for bidirectional agent comms
# --yolo: No sandbox, no approvals (equivalent to Claude's --dangerously-skip-permissions)
run_tmux send-keys -t "$SESSION_NAME" "cd '$PROJECT_ROOT' && codex --yolo" Enter

echo ""
echo "SUCCESS! Codex is starting in tmux session '$SESSION_NAME'"
echo ""
echo "==================================="
echo "How to use:"
echo "==================================="
echo ""
echo "1. ATTACH to the session:"
echo "   tmux -S \"$TMUX_SOCKET\" attach -t $SESSION_NAME"
echo ""
echo "2. DETACH from session (keep it running):"
echo "   Press: Ctrl+B then D"
echo ""
echo "3. INJECT messages from CC or AG:"
echo "   node interlateral_dna/codex.js send 'Your message'"
echo ""
echo "4. INJECT from Comms Monitor UI:"
echo "   - Select 'Codex' as target"
echo "   - Check http://localhost:5173"
echo ""
echo "5. VIEW telemetry log:"
echo "   tail -f $TELEMETRY_LOG"
echo ""
echo "6. KILL session when done:"
echo "   tmux -S \"$TMUX_SOCKET\" kill-session -t $SESSION_NAME"
echo ""
echo "==================================="
echo "Safety flags in use:"
echo "  --yolo (alias for --dangerously-bypass-approvals-and-sandbox)"
echo "  No sandbox restrictions, no approval prompts"
echo "==================================="
echo ""

# Attach to the session
run_tmux attach -t "$SESSION_NAME"
