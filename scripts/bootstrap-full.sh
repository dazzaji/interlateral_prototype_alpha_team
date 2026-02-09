#!/bin/bash
# bootstrap-full.sh - Complete system bootstrap (Quad-Agent Mesh)
#
# Idempotent: safe to run multiple times. Checks before acting.
#
# This script ensures ALL system components are running:
# 1. Antigravity with CDP (port 9222) for programmatic control
# 2. Comms Monitor Dashboard (backend 3001, frontend 5173)
# 3. tmux session 'claude' for CC direct injection
# 4. tmux session 'codex' for Codex direct injection (optional - graceful degradation if Codex not installed)
# 5. tmux session 'gemini' for Gemini CLI direct injection (optional)
#
# Called automatically by wake-up.sh, or manually for debugging.
#
# DESIGN PHILOSOPHY:
# Human runs ONE command (wake-up.sh), CC wakes up to a READY system.
# CC does NOT need to run fiddly setup commands - they're done for it.
# Quad-agent mesh: CC, AG, Codex, and Gemini CLI can all communicate bidirectionally.

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

# Unset TMUX to avoid inheriting parent session context
unset TMUX

echo "=== Interlateral System Bootstrap ==="
echo "Repo: $REPO_ROOT"
echo ""

# Track failures for final status
BOOTSTRAP_OK=true

###############################################################################
# 0. SESSION BOUNDARY MARKER (Fresh Start)
#
# Append a marker to comms.md so agents know to ignore old messages.
# This prevents agents from trying to continue tasks from previous sessions.
###############################################################################
COMMS_FILE="$REPO_ROOT/interlateral_dna/comms.md"
SESSION_TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M:%S UTC')

if [ -f "$COMMS_FILE" ]; then
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
    echo "Session boundary marker added to comms.md"
fi

###############################################################################
# 1. ANTIGRAVITY WITH CDP
###############################################################################
echo "[1/6] Checking Antigravity..."

# Use CLI if available (preferred for workspace discovery)
AG_CLI="$(command -v antigravity 2>/dev/null || true)"
if [ -z "$AG_CLI" ] && [ -x "$HOME/.antigravity/antigravity/bin/antigravity" ]; then
    AG_CLI="$HOME/.antigravity/antigravity/bin/antigravity"
fi

# Allow override for app binary; otherwise try common macOS locations
AG_APP="${AG_APP_PATH:-}"
if [ -z "$AG_APP" ]; then
    for candidate in "/Applications/Antigravity.app/Contents/MacOS/Electron" "/Applications/Antigravity.app/Contents/MacOS/Antigravity"; do
        if [ -x "$candidate" ]; then
            AG_APP="$candidate"
            break
        fi
    done
fi

if curl -s http://127.0.0.1:9222/json/list > /dev/null 2>&1; then
    echo "  AG already running with CDP"
    # Ensure workspace is open even if already running
    if [ -x "$AG_CLI" ]; then
        echo "  Ensuring workspace is open: $REPO_ROOT"
        "$AG_CLI" --reuse-window "$REPO_ROOT" > /dev/null 2>&1
    fi
else
    echo "  Starting AG with CDP..."

    if [ -x "$AG_CLI" ]; then
        echo "  Opening workspace via CLI: $REPO_ROOT"
        "$AG_CLI" --remote-debugging-port=9222 "$REPO_ROOT" > /dev/null 2>&1 &
    else
        echo "  CLI not found, falling back to direct app launch..."
        if [ -n "$AG_APP" ]; then
            "$AG_APP" --remote-debugging-port=9222 &
        else
            echo "  WARNING: Antigravity app not found. Set AG_APP_PATH or install Antigravity."
            BOOTSTRAP_OK=false
        fi
    fi

    # Wait for CDP with polling (max 30 seconds)
    CDP_READY=false
    for i in $(seq 1 30); do
        if curl -s http://127.0.0.1:9222/json/list > /dev/null 2>&1; then
            echo "  AG CDP ready after ${i}s"
            CDP_READY=true
            break
        fi
        sleep 1
    done

    if [ "$CDP_READY" = false ]; then
        echo "  WARNING: AG CDP not responding after 30s"
        BOOTSTRAP_OK=false
    fi
fi

###############################################################################
# 2. COMMS MONITOR DASHBOARD
###############################################################################
echo "[2/6] Checking dashboard..."

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
# 3. TMUX SESSION FOR CC INJECTION
###############################################################################
echo "[3/6] Checking CC tmux session..."

SESSION_NAME="${CC_TMUX_SESSION:-interlateral-claude}"
TELEMETRY_LOG="$REPO_ROOT/interlateral_dna/cc_telemetry.log"

if run_tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "  tmux session '$SESSION_NAME' exists"

    CC_PANE_PATH=$(run_tmux display-message -p -t "$SESSION_NAME" "#{pane_current_path}" 2>/dev/null || echo "")

    # FIX v2 (based on Codex review): Check for ANY live node/nodejs process in the pane
    # Previous bug: pgrep -P only found direct children, missing:
    #   1) When pane_pid itself is node
    #   2) When node is a grandchild (npm/npx wrapper)
    PANE_PID=$(run_tmux display-message -p -F "#{pane_pid}" -t "$SESSION_NAME" 2>/dev/null || echo "")
    LIVE_NODE=""
    if [ -n "$PANE_PID" ]; then
        # Check if pane process itself is node/nodejs
        PANE_COMM=$(ps -p "$PANE_PID" -o comm= 2>/dev/null || echo "")
        if [[ "$PANE_COMM" == "node" || "$PANE_COMM" == "nodejs" ]]; then
            LIVE_NODE="$PANE_PID"
        else
            # Check for any node/nodejs descendant (not just direct child)
            # Note: pgrep -P finds direct children; we also check grandchildren below
            LIVE_NODE=$(pgrep -P "$PANE_PID" -x "node" 2>/dev/null | head -n1 || pgrep -P "$PANE_PID" -x "nodejs" 2>/dev/null | head -n1 || echo "")
            # If still empty, check grandchildren (npm/npx case)
            if [ -z "$LIVE_NODE" ]; then
                for child in $(pgrep -P "$PANE_PID" 2>/dev/null); do
                    LIVE_NODE=$(pgrep -P "$child" -x "node" 2>/dev/null || pgrep -P "$child" -x "nodejs" 2>/dev/null || echo "")
                    [ -n "$LIVE_NODE" ] && break
                done
            fi
        fi
    fi

    # ALWAYS reset CC session for clean start (stale sessions cause wake-up failures)
    # Previous logic tried to preserve "active" sessions but old node processes
    # from previous runs would keep stale content, breaking the wake-up protocol.
    echo "  Resetting tmux session '$SESSION_NAME' for clean start..."
    run_tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
    run_tmux new-session -d -s "$SESSION_NAME" -c "$REPO_ROOT"
    if [ -d "$(dirname "$TELEMETRY_LOG")" ]; then
        run_tmux pipe-pane -t "$SESSION_NAME" "cat >> $TELEMETRY_LOG"
        echo "  Telemetry capture enabled: $TELEMETRY_LOG"
    fi
else
    echo "  Creating tmux session '$SESSION_NAME'..."

    # Create detached session IN THE CORRECT REPO (bug fix: was missing -c)
    run_tmux new-session -d -s "$SESSION_NAME" -c "$REPO_ROOT"

    # Set up telemetry capture
    if [ -d "$(dirname "$TELEMETRY_LOG")" ]; then
        run_tmux pipe-pane -t "$SESSION_NAME" "cat >> $TELEMETRY_LOG"
        echo "  Telemetry capture enabled: $TELEMETRY_LOG"
    fi

    echo "  tmux session '$SESSION_NAME' created in $REPO_ROOT"
fi

# Verify session was created before opening window
if run_tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "  Session '$SESSION_NAME' verified"
    # Open CC terminal window (new)
    if [ -x "$REPO_ROOT/scripts/open-tmux-window.sh" ]; then
        "$REPO_ROOT/scripts/open-tmux-window.sh" "$SESSION_NAME" "Claude Code" &
    fi
else
    echo "  ERROR: Failed to create session '$SESSION_NAME'"
    BOOTSTRAP_OK=false
fi

###############################################################################
# 4. TMUX SESSION FOR CODEX INJECTION (OPTIONAL)
###############################################################################
echo "[4/6] Checking Codex tmux session..."

CODEX_SESSION_NAME="${CODEX_TMUX_SESSION:-interlateral-codex}"
CODEX_TELEMETRY_LOG="$REPO_ROOT/interlateral_dna/codex_telemetry.log"
CODEX_AVAILABLE=false

# Check if Codex is installed (graceful degradation if not)
if command -v codex &> /dev/null; then
    CODEX_AVAILABLE=true

    # ALWAYS reset Codex session for clean start (stale sessions cause wake-up failures)
    if run_tmux has-session -t "$CODEX_SESSION_NAME" 2>/dev/null; then
        echo "  Killing stale tmux session '$CODEX_SESSION_NAME'..."
        run_tmux kill-session -t "$CODEX_SESSION_NAME" 2>/dev/null || true
    fi

    echo "  Creating fresh tmux session '$CODEX_SESSION_NAME'..."
    run_tmux new-session -d -s "$CODEX_SESSION_NAME" -c "$REPO_ROOT"

    # Set up telemetry capture
    if [ -d "$(dirname "$CODEX_TELEMETRY_LOG")" ]; then
        run_tmux pipe-pane -t "$CODEX_SESSION_NAME" "cat >> $CODEX_TELEMETRY_LOG"
        echo "  Telemetry capture enabled: $CODEX_TELEMETRY_LOG"
    fi

    # Verify Codex session was created before proceeding
    if run_tmux has-session -t "$CODEX_SESSION_NAME" 2>/dev/null; then
        echo "  Session '$CODEX_SESSION_NAME' verified"

        # Start Codex with full autonomy mode (--yolo = no sandbox, no approvals)
        # NOTE: AGENTS.md contains strict instructions to only write inside repo
        echo "  Starting Codex with full autonomy (--yolo)..."
        run_tmux send-keys -t "$CODEX_SESSION_NAME" "codex --yolo" Enter
        echo "  Codex started in session '$CODEX_SESSION_NAME'"

        # Open Codex terminal window
        if [ -x "$REPO_ROOT/scripts/open-tmux-window.sh" ]; then
            "$REPO_ROOT/scripts/open-tmux-window.sh" "$CODEX_SESSION_NAME" "Codex" &
        fi
    else
        echo "  ERROR: Failed to create Codex session '$CODEX_SESSION_NAME'"
    fi
else
    echo "  Codex not installed - skipping (graceful degradation)"
    echo "  To install: brew install --cask codex OR npm i -g @openai/codex"
fi

###############################################################################
# 5. TMUX SESSION FOR GEMINI CLI (OPTIONAL)
###############################################################################
echo "[5/6] Checking Gemini CLI tmux session..."

GEMINI_SESSION_NAME="${GEMINI_TMUX_SESSION:-interlateral-gemini}"
GEMINI_TELEMETRY_LOG="$REPO_ROOT/.gemini/gemini_cli_telemetry.log"
GEMINI_MODEL="${GEMINI_MODEL:-gemini-3-flash-preview}"
GEMINI_DEGRADED=false
GEMINI_AVAILABLE=false

# Check if Gemini CLI is installed (graceful degradation if not)
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

            # Start Gemini CLI with full autonomy mode on the pinned model
            # NOTE: -y/--yolo is deprecated. Using --approval-mode=yolo per gemini_permits.md
            # Known bug #13561: YOLO mode may still prompt for some confirmations
            echo "  Starting Gemini CLI with full autonomy..."
            run_tmux send-keys -t "$GEMINI_SESSION_NAME" "gemini -m '$GEMINI_MODEL' --approval-mode=yolo --sandbox=false" Enter
            echo "  Gemini CLI started in session '$GEMINI_SESSION_NAME' (model: $GEMINI_MODEL)"

            # Open Gemini terminal window
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
    echo "  To install: See https://ai.google.dev/gemini-api/docs/gemini-cli"
fi

###############################################################################
# 6. FINAL VERIFICATION
###############################################################################
echo "[6/6] Final verification..."
echo ""
echo "=========================================="

# Check AG
if curl -s http://127.0.0.1:9222/json/list > /dev/null 2>&1; then
    echo "  AG CDP:     READY"
else
    echo "  AG CDP:     NOT RESPONDING"
    BOOTSTRAP_OK=false
fi

# Check Dashboard Backend
if curl -s http://localhost:3001/api/streams/status > /dev/null 2>&1; then
    echo "  Backend:    READY (port 3001)"
else
    echo "  Backend:    NOT RESPONDING"
    BOOTSTRAP_OK=false
fi

# Check Dashboard Frontend (just check if vite is probably running)
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "  Frontend:   READY (port 5173)"
else
    echo "  Frontend:   Starting... (may take a moment)"
fi

# Check CC tmux
if run_tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "  CC tmux:    READY (session: $SESSION_NAME)"
else
    echo "  CC tmux:    NOT FOUND"
    BOOTSTRAP_OK=false
fi

# Check Codex tmux (optional - doesn't fail bootstrap if missing)
if [ "$CODEX_AVAILABLE" = true ]; then
    if run_tmux has-session -t "$CODEX_SESSION_NAME" 2>/dev/null; then
        echo "  Codex tmux: READY (session: $CODEX_SESSION_NAME)"
    else
        echo "  Codex tmux: NOT FOUND"
        # Note: Don't set BOOTSTRAP_OK=false - Codex is optional
    fi
else
    echo "  Codex tmux: SKIPPED (Codex not installed)"
fi

# Check Gemini tmux (optional - doesn't fail bootstrap if missing)
if [ "$GEMINI_AVAILABLE" = true ]; then
    if run_tmux has-session -t "$GEMINI_SESSION_NAME" 2>/dev/null; then
        if [ "$GEMINI_DEGRADED" = true ]; then
            echo "  Gemini tmux: READY (session: $GEMINI_SESSION_NAME, DEGRADED)"
        else
            echo "  Gemini tmux: READY (session: $GEMINI_SESSION_NAME)"
        fi
    else
        echo "  Gemini tmux: NOT FOUND"
        # Note: Don't set BOOTSTRAP_OK=false - Gemini is optional
    fi
else
    echo "  Gemini tmux: SKIPPED (Gemini CLI not installed)"
fi

echo "=========================================="

if [ "$BOOTSTRAP_OK" = true ]; then
    echo ""
    echo "Quad-Agent System bootstrap COMPLETE"
    echo ""
    echo "Dashboard UI: http://localhost:5173"
    echo ""
    echo "Agents can now be controlled via:"
    echo "  CC:     tmux session '$SESSION_NAME' or dashboard"
    echo "  AG:     CDP port 9222 or dashboard"
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
