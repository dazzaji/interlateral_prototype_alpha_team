#!/bin/bash
# bootstrap-full-no-ag.sh - System bootstrap without Antigravity (AG)
#
# Idempotent: safe to run multiple times. Checks before acting.
#
# This script ensures core system components are running:
# 1. Comms Monitor Dashboard (backend 3001, frontend 5173)
# 2. tmux session 'interlateral-claude' for CC direct injection
# 3. tmux session 'interlateral-codex' for Codex direct injection (optional)
# 4. tmux session 'interlateral-gemini' for Gemini CLI direct injection (optional)
#
# Called automatically by wake-up-no-ag.sh.

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

# Source shared tmux configuration
source "$SCRIPT_DIR/tmux-config.sh"

# Break inheritance from parent tmux session
unset TMUX

echo "=== Interlateral System Bootstrap (No AG) ==="
echo "Repo: $REPO_ROOT"
echo ""

# Track failures for final status
BOOTSTRAP_OK=true

###############################################################################
# 0. SESSION BOUNDARY MARKER (prevents stale context contamination)
###############################################################################
COMMS_FILE="$REPO_ROOT/interlateral_dna/comms.md"
SESSION_TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M:%S UTC')

if [ -f "$COMMS_FILE" ]; then
    echo "[0/5] Adding session boundary marker to comms.md..."
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
echo "[1/5] Checking dashboard..."

DASHBOARD_DIR="$REPO_ROOT/interlateral_comms_monitor"

if curl -s http://localhost:3001/api/streams/status > /dev/null 2>&1; then
    echo "  Dashboard already running"
else
    if [ -f "$DASHBOARD_DIR/scripts/start.sh" ]; then
        echo "  Starting dashboard..."

        # Start in background, redirect output to avoid blocking
        (cd "$DASHBOARD_DIR/scripts" && ./start.sh > /dev/null 2>&1 &)

        # Wait for backend with polling (max 15 seconds)
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
echo "[2/5] Checking CC tmux session..."

SESSION_NAME="${CC_TMUX_SESSION:-interlateral-claude}"
TELEMETRY_LOG="$REPO_ROOT/interlateral_dna/cc_telemetry.log"

# ALWAYS reset CC session for clean start (stale sessions cause wake-up failures)
if run_tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "  Killing stale tmux session '$SESSION_NAME'..."
    run_tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
fi

echo "  Creating fresh tmux session '$SESSION_NAME'..."
run_tmux new-session -d -s "$SESSION_NAME" -c "$REPO_ROOT"

# Verify session was created before opening window
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
# 3. TMUX SESSION FOR CODEX INJECTION (OPTIONAL)
###############################################################################
echo "[3/5] Checking Codex tmux session..."

CODEX_SESSION_NAME="${CODEX_TMUX_SESSION:-interlateral-codex}"
CODEX_TELEMETRY_LOG="$REPO_ROOT/interlateral_dna/codex_telemetry.log"
CODEX_AVAILABLE=false

if command -v codex &> /dev/null; then
    CODEX_AVAILABLE=true

    # ALWAYS reset Codex session for clean start (stale sessions cause wake-up failures)
    if run_tmux has-session -t "$CODEX_SESSION_NAME" 2>/dev/null; then
        echo "  Killing stale tmux session '$CODEX_SESSION_NAME'..."
        run_tmux kill-session -t "$CODEX_SESSION_NAME" 2>/dev/null || true
    fi

    echo "  Creating fresh tmux session '$CODEX_SESSION_NAME'..."
    run_tmux new-session -d -s "$CODEX_SESSION_NAME" -c "$REPO_ROOT"

    # Verify Codex session was created before proceeding
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
    fi
else
    echo "  Codex not installed - skipping (graceful degradation)"
fi

###############################################################################
# 4. TMUX SESSION FOR GEMINI CLI (OPTIONAL)
###############################################################################
echo "[4/5] Checking Gemini CLI tmux session..."

GEMINI_SESSION_NAME="${GEMINI_TMUX_SESSION:-interlateral-gemini}"
GEMINI_TELEMETRY_LOG="$REPO_ROOT/.gemini/gemini_cli_telemetry.log"
GEMINI_MODEL="${GEMINI_MODEL:-gemini-3-flash-preview}"
GEMINI_DEGRADED=false
GEMINI_AVAILABLE=false

if command -v gemini &> /dev/null; then
    GEMINI_AVAILABLE=true

    # ALWAYS reset Gemini session for clean start (stale sessions cause wake-up failures)
    if run_tmux has-session -t "$GEMINI_SESSION_NAME" 2>/dev/null; then
        echo "  Killing stale tmux session '$GEMINI_SESSION_NAME'..."
        run_tmux kill-session -t "$GEMINI_SESSION_NAME" 2>/dev/null || true
    fi

    echo "  Creating fresh tmux session '$GEMINI_SESSION_NAME'..."
    run_tmux new-session -d -s "$GEMINI_SESSION_NAME" -c "$REPO_ROOT"
    mkdir -p "$(dirname "$GEMINI_TELEMETRY_LOG")"

    # Verify Gemini session was created before proceeding
    if run_tmux has-session -t "$GEMINI_SESSION_NAME" 2>/dev/null; then
        echo "  Session '$GEMINI_SESSION_NAME' verified"
        run_tmux pipe-pane -t "$GEMINI_SESSION_NAME" "cat >> $GEMINI_TELEMETRY_LOG"
        echo "  Telemetry capture enabled: $GEMINI_TELEMETRY_LOG"
        echo "  Gemini model target: $GEMINI_MODEL"

        # Smoke-test model availability with a timeout. The real session pins
        # with -m so silent downgrades are already blocked; this just catches
        # outright unavailability without stalling the whole bootstrap.
        GEMINI_PREFLIGHT_TIMEOUT=10
        GEMINI_PREFLIGHT_TMPFILE=$(mktemp /tmp/gemini_preflight.XXXXXX)
        echo "  Validating Gemini model availability (${GEMINI_PREFLIGHT_TIMEOUT}s timeout)..."
        set +e
        gemini -p "ok" -m "$GEMINI_MODEL" --output-format text --approval-mode=default \
            > "$GEMINI_PREFLIGHT_TMPFILE" 2>&1 &
        GEMINI_PREFLIGHT_PID=$!
        GEMINI_TIMED_OUT=false
        GEMINI_WAITED=0
        while kill -0 "$GEMINI_PREFLIGHT_PID" 2>/dev/null; do
            if [ "$GEMINI_WAITED" -ge "$GEMINI_PREFLIGHT_TIMEOUT" ]; then
                kill "$GEMINI_PREFLIGHT_PID" 2>/dev/null
                wait "$GEMINI_PREFLIGHT_PID" 2>/dev/null || true
                GEMINI_TIMED_OUT=true
                echo "  Preflight timed out after ${GEMINI_PREFLIGHT_TIMEOUT}s — proceeding (model pinned via -m)"
                break
            fi
            sleep 1
            GEMINI_WAITED=$((GEMINI_WAITED + 1))
        done
        if [ "$GEMINI_TIMED_OUT" = false ]; then
            wait "$GEMINI_PREFLIGHT_PID"
            GEMINI_PREFLIGHT_RC=$?
        else
            GEMINI_PREFLIGHT_RC=0
        fi
        GEMINI_PREFLIGHT_OUTPUT=$(cat "$GEMINI_PREFLIGHT_TMPFILE" 2>/dev/null)
        rm -f "$GEMINI_PREFLIGHT_TMPFILE"
        set -e

        if [ "$GEMINI_PREFLIGHT_RC" -ne 0 ]; then
            echo "  WARNING: Gemini model preflight failed for '$GEMINI_MODEL'."
            echo "  Starting Gemini in degraded fallback mode (un-pinned model)."
            echo "$GEMINI_PREFLIGHT_OUTPUT" | tail -n 5 | sed 's/^/    /'
            GEMINI_DEGRADED=true
            run_tmux send-keys -t "$GEMINI_SESSION_NAME" "gemini --approval-mode=yolo --sandbox=false" Enter
            echo "  Gemini CLI started in degraded mode (fallback model selection)"
            if [ -x "$REPO_ROOT/scripts/open-tmux-window.sh" ]; then
                "$REPO_ROOT/scripts/open-tmux-window.sh" "$GEMINI_SESSION_NAME" "Gemini CLI" &
            fi
        else
            echo "  Starting Gemini CLI with full autonomy..."
            run_tmux send-keys -t "$GEMINI_SESSION_NAME" "gemini -m '$GEMINI_MODEL' --approval-mode=yolo --sandbox=false" Enter
            echo "  Gemini CLI started in session '$GEMINI_SESSION_NAME' (model: $GEMINI_MODEL)"

            if [ -x "$REPO_ROOT/scripts/open-tmux-window.sh" ]; then
                "$REPO_ROOT/scripts/open-tmux-window.sh" "$GEMINI_SESSION_NAME" "Gemini CLI" &
            fi
        fi
    else
        echo "  ERROR: Failed to create Gemini session '$GEMINI_SESSION_NAME'"
        BOOTSTRAP_OK=false
    fi
else
    echo "  Gemini CLI not installed - skipping (graceful degradation)"
fi

###############################################################################
# 5. FINAL VERIFICATION
###############################################################################
echo "[5/5] Final verification..."
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
    fi
else
    echo "  Codex tmux: SKIPPED (Codex not installed)"
fi

if [ "$GEMINI_AVAILABLE" = true ]; then
    if run_tmux has-session -t "$GEMINI_SESSION_NAME" 2>/dev/null; then
        if [ "$GEMINI_DEGRADED" = true ]; then
            echo "  Gemini tmux: READY (session: $GEMINI_SESSION_NAME, DEGRADED)"
        else
            echo "  Gemini tmux: READY (session: $GEMINI_SESSION_NAME)"
        fi
    else
        echo "  Gemini tmux: NOT FOUND"
    fi
else
    echo "  Gemini tmux: SKIPPED (Gemini CLI not installed)"
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
    if [ "$CODEX_AVAILABLE" = true ]; then
        echo "  Codex:  tmux session '$CODEX_SESSION_NAME' or dashboard"
    else
        echo "  Codex:  Not installed (optional)"
    fi
    if [ "$GEMINI_AVAILABLE" = true ]; then
        echo "  Gemini: tmux session '$GEMINI_SESSION_NAME' or gemini.js"
    else
        echo "  Gemini: Not installed (optional)"
    fi
    echo ""
    exit 0
else
    echo ""
    echo "WARNING: Some components failed to start."
    echo "Check the warnings above and troubleshoot."
    echo ""
    exit 1
fi
