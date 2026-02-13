#!/bin/bash
# bootstrap-full-cc-cx.sh - System bootstrap (CC + Codex ONLY)
#
# Idempotent: safe to run multiple times. Checks before acting.
#
# This script ensures core system components are running:
# 0. Session boundary marker in interlateral_dna/comms.md
# 1. Comms Monitor Dashboard (backend 3001, frontend 5173)
# 2. tmux session 'interlateral-claude' for CC direct injection
# 3. tmux session 'interlateral-codex' for Codex direct injection (optional)
# 4. Final verification
#
# Called automatically by wake-up-cc-cx.sh.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

###############################################################################
# TMUX SOCKET CONFIGURATION
#
# Use explicit socket at /tmp/interlateral-tmux.sock to ensure Codex can access
# tmux without permission prompts. The system default socket at /private/tmp/
# is outside Codex's writable roots even with --yolo flag (due to managed config).
#
# All scripts and JS files must use this same socket to prevent split-brain.
###############################################################################

source "$SCRIPT_DIR/tmux-config.sh"
unset TMUX

echo "=== Interlateral System Bootstrap (CC + Codex Only) ==="
echo "Repo: $REPO_ROOT"
echo ""

BOOTSTRAP_OK=true

###############################################################################
# 0. SESSION BOUNDARY MARKER (prevents stale context contamination)
###############################################################################
COMMS_FILE="$REPO_ROOT/interlateral_dna/comms.md"
SESSION_TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M:%S UTC')

if [ -f "$COMMS_FILE" ]; then
    echo "[0/4] Adding session boundary marker to comms.md..."
    echo "" >> "$COMMS_FILE"
    echo "---" >> "$COMMS_FILE"
    echo "" >> "$COMMS_FILE"
    echo "# === NEW SESSION: $SESSION_TIMESTAMP ===" >> "$COMMS_FILE"
    echo "# ALL AGENTS: Messages above this line are ARCHIVE for historical reference." >> "$COMMS_FILE"
    echo "# Do NOT continue tasks from previous sessions as if they are still active." >> "$COMMS_FILE"
    echo "# This is a fresh session - wait for new instructions below this marker." >> "$COMMS_FILE"
    echo "" >> "$COMMS_FILE"
    echo "---" >> "$COMMS_FILE"
    echo "" >> "$COMMS_FILE"
    echo "  Session marker added"
fi

###############################################################################
# 1. COMMS MONITOR DASHBOARD
###############################################################################
echo "[1/4] Checking dashboard..."

DASHBOARD_DIR="$REPO_ROOT/interlateral_comms_monitor"

if curl -s http://localhost:3001/api/streams/status > /dev/null 2>&1; then
    echo "  Dashboard already running"
else
    if [ -f "$DASHBOARD_DIR/scripts/start.sh" ]; then
        echo "  Starting dashboard..."
        (cd "$DASHBOARD_DIR/scripts" && ./start.sh > /dev/null 2>&1 &)

        DASH_READY=false
        for i in $(seq 1 15); do
            if curl -s http://localhost:3001/api/streams/status > /dev/null 2>&1; then
                echo "  Dashboard ready after ${i}s"
                DASH_READY=true
                break
            fi
            sleep 1
        done

        if [ "$DASH_READY" = false ]; then
            echo "  WARNING: Dashboard not responding after 15s"
            BOOTSTRAP_OK=false
        fi
    else
        echo "  WARNING: Dashboard scripts not found at $DASHBOARD_DIR/scripts/start.sh"
        echo "  Run: cd interlateral_comms_monitor && npm install --prefix server && npm install --prefix ui"
        BOOTSTRAP_OK=false
    fi
fi

###############################################################################
# 2. TMUX SESSION FOR CC INJECTION
###############################################################################
echo "[2/4] Checking CC tmux session..."

SESSION_NAME="${CC_TMUX_SESSION:-interlateral-claude}"
TELEMETRY_LOG="$REPO_ROOT/interlateral_dna/cc_telemetry.log"

if run_tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "  Killing stale tmux session '$SESSION_NAME'..."
    run_tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
fi

echo "  Creating fresh tmux session '$SESSION_NAME'..."
run_tmux new-session -d -s "$SESSION_NAME" -c "$REPO_ROOT"

if run_tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "  Session '$SESSION_NAME' verified"
    if [ -d "$(dirname "$TELEMETRY_LOG")" ]; then
        run_tmux pipe-pane -t "$SESSION_NAME" "cat >> $TELEMETRY_LOG"
        echo "  Telemetry capture enabled: $TELEMETRY_LOG"
    fi
    if [ -x "$REPO_ROOT/scripts/open-tmux-window.sh" ]; then
        "$REPO_ROOT/scripts/open-tmux-window.sh" "$SESSION_NAME" "Claude Code" &
    fi
else
    echo "  ERROR: Failed to create session '$SESSION_NAME'"
    BOOTSTRAP_OK=false
fi

###############################################################################
# 3. TMUX SESSION FOR CODEX INJECTION (REQUIRED)
###############################################################################
echo "[3/4] Checking Codex tmux session..."

CODEX_SESSION_NAME="${CODEX_TMUX_SESSION:-interlateral-codex}"
CODEX_TELEMETRY_LOG="$REPO_ROOT/interlateral_dna/codex_telemetry.log"
CODEX_AVAILABLE=false

if command -v codex &> /dev/null; then
    CODEX_AVAILABLE=true

    if run_tmux has-session -t "$CODEX_SESSION_NAME" 2>/dev/null; then
        echo "  Killing stale tmux session '$CODEX_SESSION_NAME'..."
        run_tmux kill-session -t "$CODEX_SESSION_NAME" 2>/dev/null || true
    fi

    echo "  Creating fresh tmux session '$CODEX_SESSION_NAME'..."
    run_tmux new-session -d -s "$CODEX_SESSION_NAME" -c "$REPO_ROOT"

    if run_tmux has-session -t "$CODEX_SESSION_NAME" 2>/dev/null; then
        echo "  Session '$CODEX_SESSION_NAME' verified"
        if [ -d "$(dirname "$CODEX_TELEMETRY_LOG")" ]; then
            run_tmux pipe-pane -t "$CODEX_SESSION_NAME" "cat >> $CODEX_TELEMETRY_LOG"
            echo "  Telemetry capture enabled: $CODEX_TELEMETRY_LOG"
        fi
        echo "  Starting Codex with full autonomy (--yolo)..."
        run_tmux send-keys -t "$CODEX_SESSION_NAME" "codex --yolo" Enter
        echo "  Codex started in session '$CODEX_SESSION_NAME'"

        if [ -x "$REPO_ROOT/scripts/open-tmux-window.sh" ]; then
            "$REPO_ROOT/scripts/open-tmux-window.sh" "$CODEX_SESSION_NAME" "Codex" &
        fi
    else
        echo "  ERROR: Failed to create Codex session '$CODEX_SESSION_NAME'"
        BOOTSTRAP_OK=false
    fi
else
    echo "  ERROR: Codex not installed. This CC+Codex duo bootstrap requires Codex."
    echo "  Install: npm install -g @openai/codex"
    BOOTSTRAP_OK=false
fi

###############################################################################
# 4. FINAL VERIFICATION
###############################################################################
echo "[4/4] Final verification..."
echo ""
echo "=========================================="

if curl -s http://localhost:3001/api/streams/status > /dev/null 2>&1; then
    echo "  Backend:    READY (port 3001)"
else
    echo "  Backend:    NOT RESPONDING"
    BOOTSTRAP_OK=false
fi

if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "  Frontend:   READY (port 5173)"
else
    echo "  Frontend:   Starting... (may take a moment)"
fi

if run_tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "  CC tmux:    READY (session: $SESSION_NAME)"
else
    echo "  CC tmux:    NOT FOUND"
    BOOTSTRAP_OK=false
fi

if [ "$CODEX_AVAILABLE" = true ]; then
    if run_tmux has-session -t "$CODEX_SESSION_NAME" 2>/dev/null; then
        echo "  Codex tmux: READY (session: $CODEX_SESSION_NAME)"
    else
        echo "  Codex tmux: NOT FOUND"
        BOOTSTRAP_OK=false
    fi
else
    echo "  Codex tmux: FAILED (Codex not installed)"
    BOOTSTRAP_OK=false
fi

echo "=========================================="

if [ "$BOOTSTRAP_OK" = true ]; then
    echo ""
    echo "Agent System bootstrap COMPLETE"
    echo ""
    echo "Dashboard UI: http://localhost:5173"
    echo ""
    echo "Agents can now be controlled via:"
    echo "  CC:     tmux session '$SESSION_NAME' or dashboard"
    echo "  Codex:  tmux session '$CODEX_SESSION_NAME' or dashboard"
    echo ""
    exit 0
else
    echo ""
    echo "WARNING: Some components failed to start."
    echo "Check the warnings above and troubleshoot."
    echo ""
    exit 1
fi
