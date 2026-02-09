#!/usr/bin/env bash
# quick-status.sh - Tri-agent status in one command
# Version: 1.1
# Author: CC (Claude Code) - Drafter
#
# ## Change Log (v1.1)
# - **Fixed:** Gate tmux checks with `command -v tmux` to prevent hard-fail (Thanks @Codex)
# - **Fixed:** Parse CDP json/list for workbench.html to avoid Launchpad false positives (Thanks @Codex)
# - **Hardened:** Added trace freshness check (modified <60 min) (Thanks @Codex, @AG)
# - **Hardened:** Added ANSI color coding for ONLINE/OFFLINE (Thanks @AG)
# - **Declined:** Courier health check - Not in original requirements; courier is optional (AG)

set -uo pipefail

# Source shared tmux configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/tmux-config.sh"

OFFLINE_COUNT=0

# ANSI colors
GREEN='\033[32m'
RED='\033[31m'
RESET='\033[0m'

# Check CC (tmux session)
CC_SESSION="${CC_TMUX_SESSION:-interlateral-claude}"
if command -v tmux >/dev/null 2>&1; then
    if run_tmux has-session -t "$CC_SESSION" 2>/dev/null; then
        echo -e "CC: ${GREEN}ONLINE${RESET} (tmux: $CC_SESSION)"
    else
        echo -e "CC: ${RED}OFFLINE${RESET} (tmux: $CC_SESSION)"
        ((OFFLINE_COUNT++)) || true
    fi
else
    echo -e "CC: ${RED}OFFLINE${RESET} (tmux: $CC_SESSION) [tmux not installed]"
    ((OFFLINE_COUNT++)) || true
fi

# Check AG (CDP on port 9222 with workspace open, not just Launchpad)
AG_STATUS="OFFLINE"
if curl -s --max-time 2 http://127.0.0.1:9222/json/list 2>/dev/null | grep -q "workbench.html"; then
    AG_STATUS="ONLINE"
fi
if [[ "$AG_STATUS" == "ONLINE" ]]; then
    echo -e "AG: ${GREEN}ONLINE${RESET} (CDP: 9222)"
else
    echo -e "AG: ${RED}OFFLINE${RESET} (CDP: 9222)"
    ((OFFLINE_COUNT++)) || true
fi

# Check CX (tmux session)
CX_SESSION="${CODEX_TMUX_SESSION:-interlateral-codex}"
if command -v tmux >/dev/null 2>&1; then
    if run_tmux has-session -t "$CX_SESSION" 2>/dev/null; then
        echo -e "CX: ${GREEN}ONLINE${RESET} (tmux: $CX_SESSION)"
    else
        echo -e "CX: ${RED}OFFLINE${RESET} (tmux: $CX_SESSION)"
        ((OFFLINE_COUNT++)) || true
    fi
else
    echo -e "CX: ${RED}OFFLINE${RESET} (tmux: $CX_SESSION) [tmux not installed]"
    ((OFFLINE_COUNT++)) || true
fi

# Check last trace with freshness validation (<60 min)
TRACE_FILE=".observability/last_trace.txt"
if [[ -f "$TRACE_FILE" ]] && [[ -s "$TRACE_FILE" ]]; then
    if find "$TRACE_FILE" -mmin -60 2>/dev/null | grep -q .; then
        LAST_TRACE=$(cat "$TRACE_FILE")
        echo "Last trace: $LAST_TRACE"
    else
        LAST_TRACE=$(cat "$TRACE_FILE")
        echo "Last trace: $LAST_TRACE (STALE: >60 min old)"
    fi
else
    echo "Last trace: N/A"
fi

# Exit with appropriate code
if [[ $OFFLINE_COUNT -gt 0 ]]; then
    exit 1
fi
exit 0
