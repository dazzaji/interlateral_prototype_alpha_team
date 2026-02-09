#!/bin/bash
# start-cc-tmux.sh - Launch Claude Code in tmux with telemetry capture
# Sprint 2B.2: Terminal + tmux Direct Injection

set -e

# Configuration
SESSION_NAME="${CC_TMUX_SESSION:-claude}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DNA_DIR="$PROJECT_ROOT/interlateral_dna"
TELEMETRY_LOG="$DNA_DIR/cc_telemetry.log"

echo "==================================="
echo "Claude Code tmux Launcher"
echo "Sprint 2B.2: Direct Injection Mode"
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

# Check if claude command exists
if ! command -v claude &> /dev/null; then
    echo "ERROR: 'claude' command not found. Make sure Claude Code is installed."
    exit 1
fi

# Check if session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Session '$SESSION_NAME' already exists!"
    echo ""
    echo "Options:"
    echo "  1. Attach to it:  tmux attach -t $SESSION_NAME"
    echo "  2. Kill it first: tmux kill-session -t $SESSION_NAME"
    echo ""
    read -p "Attach to existing session? [Y/n] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        tmux attach -t "$SESSION_NAME"
        exit 0
    else
        echo "Exiting. Kill the session first if you want to start fresh."
        exit 1
    fi
fi

# Create new tmux session with Claude Code
echo "Creating tmux session '$SESSION_NAME'..."

# Start session in detached mode, then set up pipe-pane for telemetry
tmux new-session -d -s "$SESSION_NAME" -c "$PROJECT_ROOT"

# Set up telemetry capture via pipe-pane
# This captures ALL terminal output to the log file
echo "Setting up telemetry capture to: $TELEMETRY_LOG"
tmux pipe-pane -t "$SESSION_NAME" "cat >> '$TELEMETRY_LOG'"

# Add timestamp header to telemetry log
echo "" >> "$TELEMETRY_LOG"
echo "========================================" >> "$TELEMETRY_LOG"
echo "[SESSION START] $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> "$TELEMETRY_LOG"
echo "Session: $SESSION_NAME" >> "$TELEMETRY_LOG"
echo "========================================" >> "$TELEMETRY_LOG"
echo "" >> "$TELEMETRY_LOG"

# Send the claude command to start
tmux send-keys -t "$SESSION_NAME" "cd '$PROJECT_ROOT' && claude" Enter

echo ""
echo "SUCCESS! Claude Code is starting in tmux session '$SESSION_NAME'"
echo ""
echo "==================================="
echo "How to use:"
echo "==================================="
echo ""
echo "1. ATTACH to the session:"
echo "   tmux attach -t $SESSION_NAME"
echo ""
echo "2. DETACH from session (keep it running):"
echo "   Press: Ctrl+B then D"
echo ""
echo "3. INJECT messages from Comms Monitor UI:"
echo "   - Messages will appear directly in this terminal"
echo "   - Check http://localhost:5173"
echo ""
echo "4. VIEW telemetry log:"
echo "   tail -f $TELEMETRY_LOG"
echo ""
echo "5. KILL session when done:"
echo "   tmux kill-session -t $SESSION_NAME"
echo ""
echo "==================================="
echo ""

# Attach to the session
tmux attach -t "$SESSION_NAME"
