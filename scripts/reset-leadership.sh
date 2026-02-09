#!/bin/bash
# reset-leadership.sh - Kill switch for deadlocked ACK handshakes
#
# Use this when agents are stuck waiting for ACKs from each other.
# This script:
# 1. Clears any pending messages in comms.md related to ACK
# 2. Resets leadership state
# 3. Optionally restarts agent sessions
#
# USAGE:
#   ./scripts/reset-leadership.sh           # Just reset state
#   ./scripts/reset-leadership.sh --restart # Reset state AND restart sessions

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DNA_DIR="$REPO_ROOT/interlateral_dna"
COMMS_PATH="$DNA_DIR/comms.md"

# Source shared tmux configuration
source "$SCRIPT_DIR/tmux-config.sh"
unset TMUX

echo "==================================="
echo "  Leadership Reset (Kill Switch)"
echo "==================================="
echo ""

# Parse arguments
RESTART_SESSIONS=false
if [[ "${1:-}" == "--restart" ]]; then
    RESTART_SESSIONS=true
fi

# Step 1: Add reset marker to comms.md
echo "Step 1: Adding reset marker to comms.md..."
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S")
cat >> "$COMMS_PATH" << EOF

[SYSTEM] Leadership Reset [$TIMESTAMP]
All ACK handshakes have been cleared. Agents should re-initialize.
---

EOF
echo "  Reset marker added"

# Step 2: Report leadership configuration
echo ""
echo "Step 2: Current leadership configuration..."
if [ -f "$DNA_DIR/leadership.json" ]; then
    LEAD=$(grep -o '"lead": *"[^"]*"' "$DNA_DIR/leadership.json" | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
    echo "  Current lead: $LEAD"
    echo "  Config file: $DNA_DIR/leadership.json"
else
    echo "  WARNING: leadership.json not found"
fi

# Step 3: Optionally restart sessions
if [ "$RESTART_SESSIONS" = true ]; then
    echo ""
    echo "Step 3: Restarting agent sessions..."

    # Kill and restart CC session
    CC_SESSION="${CC_TMUX_SESSION:-interlateral-claude}"
    if run_tmux has-session -t "$CC_SESSION" 2>/dev/null; then
        echo "  Killing CC session '$CC_SESSION'..."
        run_tmux kill-session -t "$CC_SESSION"
    fi

    # Kill and restart Codex session
    CODEX_SESSION="${CODEX_TMUX_SESSION:-interlateral-codex}"
    if run_tmux has-session -t "$CODEX_SESSION" 2>/dev/null; then
        echo "  Killing Codex session '$CODEX_SESSION'..."
        run_tmux kill-session -t "$CODEX_SESSION"
    fi

    echo "  Sessions cleared. Run bootstrap-full.sh to recreate."
else
    echo ""
    echo "Step 3: Skipping session restart (use --restart to force)"
fi

echo ""
echo "==================================="
echo "  Reset Complete"
echo "==================================="
echo ""
echo "Next steps:"
echo "  1. If agents are still stuck: ./scripts/reset-leadership.sh --restart"
echo "  2. To change leadership: edit $DNA_DIR/leadership.json"
echo "  3. To restart system: ./scripts/bootstrap-full.sh"
echo ""
