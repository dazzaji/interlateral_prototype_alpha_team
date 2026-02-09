#!/bin/bash
# tri-agent-status.sh - Report health status of all three agents in the tri-agent mesh
# Version: 1.1
# Created by: CC (Claude Code) as part of dev-collaboration skill
#
# Usage: ./scripts/tri-agent-status.sh
# Exit codes: 0 = all agents reachable, 1 = one or more agents missing
#
# Checks:
#   - CC: tmux session (default: 'interlateral-claude', override with CC_TMUX_SESSION)
#   - AG: CDP port 9222 (Antigravity with Chrome DevTools Protocol)
#   - Codex: tmux session (default: 'interlateral-codex', override with CODEX_TMUX_SESSION)
#   - Courier: file watcher process for Codex outbox (optional)
#
# ## Change Log (v1.1)
# - **Fixed:** Path normalization - script now works from any directory (Thanks @AG)
# - **Fixed:** Robust CDP parsing - uses jq if available, better grep fallback (Thanks @AG, @Codex)
# - **Fixed:** Increased curl timeout to 5s with retry for transient failures (Thanks @Codex)
# - **Hardened:** Support CC_TMUX_SESSION and CODEX_TMUX_SESSION env vars (Thanks @Codex)
# - **Hardened:** Better courier detection with multiple process name patterns (Thanks @Codex)
# - **Declined:** Session interactive check - too complex, varies by implementation (AG #2)
# - **Declined:** Granular exit codes - overengineering, keep 0/1 simple (AG #4)
# - **Declined:** False-positive tmux detection - same as session interactive check (Codex #1)

set -euo pipefail

# --- Determine script directory and repo root (AG #3 - critical for portability) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source shared tmux configuration
source "$SCRIPT_DIR/tmux-config.sh"

# --- Configurable session names (Codex #4) ---
CC_SESSION="${CC_TMUX_SESSION:-interlateral-claude}"
CODEX_SESSION="${CODEX_TMUX_SESSION:-interlateral-codex}"

# Colors and symbols
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color
CHECK="✓"
CROSS="✗"
WARN="⚠"

# Track overall status
ALL_OK=0

echo "=== Tri-Agent Mesh Status ==="
echo ""

# --- Check CC (tmux session) ---
if run_tmux has-session -t "$CC_SESSION" 2>/dev/null; then
    echo -e "${GREEN}${CHECK}${NC} CC (Claude Code): tmux session '${CC_SESSION}' is active"
else
    echo -e "${RED}${CROSS}${NC} CC (Claude Code): tmux session '${CC_SESSION}' NOT FOUND"
    echo "   Fix: Run ./scripts/wake-up.sh or: tmux -S \"$TMUX_SOCKET\" new-session -d -s ${CC_SESSION}"
    ALL_OK=1
fi

# --- Check AG (CDP port 9222) ---
# Codex #2: Increased timeout and added retry for transient failures
check_ag_cdp() {
    local attempt=1
    local max_attempts=2

    while [ $attempt -le $max_attempts ]; do
        if curl -s --connect-timeout 5 http://127.0.0.1:9222/json/list > /tmp/ag_cdp_response.json 2>/dev/null; then
            return 0
        fi
        attempt=$((attempt + 1))
        [ $attempt -le $max_attempts ] && sleep 1
    done
    return 1
}

if check_ag_cdp; then
    # AG #1 + Codex #3: Robust title parsing
    # Prefer jq if available, fallback to careful grep
    if command -v jq &> /dev/null; then
        # Use jq for accurate JSON parsing
        WORKSPACE_TITLES=$(jq -r '.[].title // empty' /tmp/ag_cdp_response.json 2>/dev/null | grep -v "^Launchpad$" | grep -v "^$" || true)
    else
        # Fallback: more specific grep pattern (note space after colon per AG suggestion)
        WORKSPACE_TITLES=$(grep -oE '"title":\s*"[^"]+"' /tmp/ag_cdp_response.json | grep -v "Launchpad" || true)
    fi

    if [ -n "$WORKSPACE_TITLES" ]; then
        echo -e "${GREEN}${CHECK}${NC} AG (Antigravity): CDP port 9222 responding, workspace open"
    else
        echo -e "${RED}${CROSS}${NC} AG (Antigravity): CDP responding but only Launchpad visible"
        echo "   Fix: Open a workspace in Antigravity (click a project)"
        ALL_OK=1
    fi
    rm -f /tmp/ag_cdp_response.json
else
    echo -e "${RED}${CROSS}${NC} AG (Antigravity): CDP port 9222 NOT responding"
    echo "   Fix: /Applications/Antigravity.app/Contents/MacOS/Electron --remote-debugging-port=9222 &"
    ALL_OK=1
fi

# --- Check Codex (tmux session) ---
if run_tmux has-session -t "$CODEX_SESSION" 2>/dev/null; then
    echo -e "${GREEN}${CHECK}${NC} Codex (OpenAI): tmux session '${CODEX_SESSION}' is active"
else
    echo -e "${RED}${CROSS}${NC} Codex (OpenAI): tmux session '${CODEX_SESSION}' NOT FOUND"
    echo "   Fix: Run ./scripts/start-codex-tmux.sh or: tmux -S \"$TMUX_SOCKET\" new-session -d -s ${CODEX_SESSION}"
    ALL_OK=1
fi

# --- Check Courier (file watcher for Codex outbox) ---
# Codex #5: Better process detection with multiple patterns
# AG #3: Use REPO_ROOT for path
OUTBOX_DIR="${REPO_ROOT}/interlateral_dna/codex_outbox"

# Check for various courier process patterns
if pgrep -f "codex_outbox" > /dev/null 2>&1 \
   || pgrep -f "courier" > /dev/null 2>&1 \
   || pgrep -f "fswatch.*codex" > /dev/null 2>&1 \
   || pgrep -f "inotifywait.*codex" > /dev/null 2>&1; then
    echo -e "${GREEN}${CHECK}${NC} Courier: file watcher process running"
else
    # Courier is optional - check if outbox directory exists
    if [ -d "$OUTBOX_DIR" ]; then
        echo -e "${YELLOW}${WARN}${NC} Courier: file watcher NOT running (outbox exists at $OUTBOX_DIR)"
        echo "   Note: Courier is optional. Direct tmux injection works without it."
        # Don't fail on courier - it's optional
    else
        echo -e "${GREEN}${CHECK}${NC} Courier: not configured (using direct tmux injection)"
    fi
fi

echo ""

# --- Summary ---
if [ $ALL_OK -eq 0 ]; then
    echo "=== All agents operational. Tri-agent mesh ready. ==="
    exit 0
else
    echo "=== WARNING: One or more agents need attention. ==="
    exit 1
fi
