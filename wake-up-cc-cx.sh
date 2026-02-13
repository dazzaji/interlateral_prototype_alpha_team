#!/bin/bash
# wake-up-cc-cx.sh - Two-agent wake-up: CC + Codex ONLY (no AG, no Gemini)
#
# Usage:
#   ./wake-up-cc-cx.sh "Your prompt here"
#   ./wake-up-cc-cx.sh --dangerously-skip-permissions "Your prompt"
#
# Note: If the flag is omitted, this script defaults to --dangerously-skip-permissions.
#
# DESIGN: Human runs ONE command, gets CC and Codex in detached tmux sessions
# with Terminal.app windows, both reaching ACK and asking for assignment.
# Bootstrap is inlined (no separate bootstrap script needed).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"

# Source shared tmux configuration
source "$REPO_ROOT/scripts/tmux-config.sh"

# Break inheritance from parent tmux session
unset TMUX

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
    FILE_PROMPT=$(cat "$WAKEUP_PROMPT_FILE")
    NEW_ARGS=()
    for arg in "$@"; do
        NEW_ARGS+=("$arg")
    done
    NEW_ARGS+=("$FILE_PROMPT")
    set -- "${NEW_ARGS[@]}"
    echo "[wake-up] Prompt loaded from file: $WAKEUP_PROMPT_FILE"
fi

echo "============================================"
echo "  INTERLATERAL WAKE-UP (CC + Codex Only)"
echo "============================================"
echo ""

# Track failures for final status
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
    echo "# AGENTS: CC + Codex duo session. No AG, no Gemini." >> "$COMMS_FILE"
    echo "# Messages above this line are ARCHIVE for historical reference." >> "$COMMS_FILE"
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
        BOOTSTRAP_OK=false
    fi
fi

# Auto-open Comms Monitor in Chrome (if dashboard is running)
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "  Opening Comms Monitor in Chrome..."
    open -a "Google Chrome" http://localhost:5173 2>/dev/null || true
fi

echo ""

###############################################################################
# 2. TMUX SESSION FOR CC
###############################################################################
echo "[2/4] Setting up CC tmux session..."

SESSION_NAME="${CC_TMUX_SESSION:-interlateral-claude}"
TELEMETRY_LOG="$REPO_ROOT/interlateral_dna/cc_telemetry.log"

# ALWAYS reset CC session for clean start
if run_tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "  Killing stale tmux session '$SESSION_NAME'..."
    run_tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
fi

echo "  Creating fresh tmux session '$SESSION_NAME'..."
run_tmux new-session -d -s "$SESSION_NAME" -c "$REPO_ROOT"

if run_tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "  Session '$SESSION_NAME' verified"
    run_tmux set-option -t "$SESSION_NAME" history-limit 100000 2>/dev/null || true
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

echo ""

###############################################################################
# 3. TMUX SESSION FOR CODEX
###############################################################################
echo "[3/4] Setting up Codex tmux session..."

CODEX_SESSION_NAME="${CODEX_TMUX_SESSION:-interlateral-codex}"
CODEX_TELEMETRY_LOG="$REPO_ROOT/interlateral_dna/codex_telemetry.log"
CODEX_AVAILABLE=false

if command -v codex &> /dev/null; then
    CODEX_AVAILABLE=true

    # ALWAYS reset Codex session for clean start
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
    echo "  ERROR: Codex not installed. This script requires both CC and Codex."
    echo "  Install: npm install -g @openai/codex"
    BOOTSTRAP_OK=false
fi

echo ""

###############################################################################
# 3b. COURIER FOR CODEX OUTBOUND
###############################################################################
echo "  Starting courier for Codex outbound..."
if [ -f "$REPO_ROOT/interlateral_dna/courier.js" ]; then
    pkill -f "node.*$REPO_ROOT/interlateral_dna/courier.js" 2>/dev/null || true
    cd "$REPO_ROOT/interlateral_dna" && node courier.js > /tmp/courier.log 2>&1 &
    echo "  Courier started (PID: $!, log: /tmp/courier.log)"
else
    echo "  WARNING: courier.js not found. Codex outbound messages will not be delivered."
fi
cd "$REPO_ROOT"

echo ""

###############################################################################
# 3c. OBSERVABILITY SETUP
###############################################################################
echo "  Observability setup..."
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
fi

echo "  AG:         SKIPPED (duo mode)"
echo "  Gemini:     SKIPPED (duo mode)"

echo "=========================================="

if [ "$BOOTSTRAP_OK" = true ]; then
    echo ""
    echo "Duo-Agent bootstrap COMPLETE (CC + Codex)"
    echo ""
    echo "Dashboard UI: http://localhost:5173"
    echo ""
    echo "Agents:"
    echo "  CC:     tmux session '$SESSION_NAME'"
    echo "  Codex:  tmux session '$CODEX_SESSION_NAME'"
    echo ""
else
    echo ""
    echo "WARNING: Some components failed to start."
    echo "Check the warnings above and troubleshoot."
    echo ""
fi

###############################################################################
# 5. INJECT CC INTO ITS TMUX SESSION
###############################################################################
echo "Step 5: Starting Claude Code..."
echo "============================================"
echo ""

if [ -z "${TMUX:-}" ]; then
    echo "  Launching CC inside tmux session '$SESSION_NAME'..."

    CMD_TO_RUN="$REPO_ROOT/scripts/logged-claude.sh $(printf '%q ' "$@")"

    run_tmux send-keys -t "$SESSION_NAME" C-c "cd $(printf '%q' "$REPO_ROOT") && $CMD_TO_RUN" Enter

    echo "  CC command sent to session '$SESSION_NAME'."

    sleep 2

    echo ""
    echo "  [INFO] Terminal windows should be open for CC and Codex."
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
