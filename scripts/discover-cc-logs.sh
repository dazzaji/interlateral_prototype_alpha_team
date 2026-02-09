#!/bin/bash
# discover-cc-logs.sh - Discover and record CC JSONL log location
#
# Day 0 Fix 4: Tighten CC locator discovery with timestamp boundary
#
# This script discovers the correct CC project directory by:
# 1. Recording a timestamp before a probe run
# 2. Looking for the project directory that gained new JSONL entries after the probe
# 3. Writing the discovered path to .observability/cc_locator.json
#
# Usage:
#   ./scripts/discover-cc-logs.sh              # Auto-discover
#   ./scripts/discover-cc-logs.sh --probe      # Do a probe run to help discovery
#   ./scripts/discover-cc-logs.sh --show       # Show current locator

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCATOR_FILE="$REPO_ROOT/.observability/cc_locator.json"
CC_PROJECTS_DIR="$HOME/.claude/projects"

# Ensure observability dir exists
mkdir -p "$REPO_ROOT/.observability"

show_locator() {
    if [ -f "$LOCATOR_FILE" ]; then
        echo "Current CC locator:"
        cat "$LOCATOR_FILE"
    else
        echo "No CC locator found at $LOCATOR_FILE"
        echo "Run: $0 --probe  to discover"
    fi
}

# Find most recently modified project directory
find_most_recent_project() {
    if [ ! -d "$CC_PROJECTS_DIR" ]; then
        echo ""
        return
    fi

    # Find directory with most recent JSONL modification
    find "$CC_PROJECTS_DIR" -name "*.jsonl" -type f -printf '%T@ %h\n' 2>/dev/null | \
        sort -rn | head -1 | cut -d' ' -f2- | xargs -I{} dirname {} 2>/dev/null || echo ""
}

# Day 0 Fix 4: Find project that changed after a specific timestamp
find_project_after_timestamp() {
    local boundary_time="$1"

    if [ ! -d "$CC_PROJECTS_DIR" ]; then
        echo ""
        return
    fi

    # Find JSONL files modified after the boundary timestamp
    # Return the project directory that contains them
    find "$CC_PROJECTS_DIR" -name "*.jsonl" -type f -newermt "$boundary_time" -printf '%h\n' 2>/dev/null | \
        sort -u | head -1
}

do_probe() {
    echo "[discover-cc-logs] Starting probe-based discovery..."
    echo ""

    # Record timestamp before probe
    boundary_time=$(date -u +"%Y-%m-%d %H:%M:%S")
    echo "[discover-cc-logs] Timestamp boundary: $boundary_time"

    # Do a minimal probe run
    echo "[discover-cc-logs] Running minimal CC probe (will exit quickly)..."
    echo ""

    # Run claude with a simple command that exits quickly
    if command -v claude >/dev/null 2>&1; then
        timeout 10 claude --version 2>/dev/null || true
        sleep 2  # Give time for JSONL to be written

        # Find project that changed after our timestamp
        discovered=$(find_project_after_timestamp "$boundary_time")

        if [ -n "$discovered" ]; then
            echo ""
            echo "[discover-cc-logs] Discovered CC project directory:"
            echo "  $discovered"

            # Write locator file
            cat > "$LOCATOR_FILE" << EOF
{
  "discovered_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "cc_project_path": "$discovered",
  "discovery_method": "probe_with_timestamp_boundary",
  "boundary_time": "$boundary_time"
}
EOF
            echo ""
            echo "[discover-cc-logs] Locator written to: $LOCATOR_FILE"
            return 0
        fi
    fi

    echo "[discover-cc-logs] Probe didn't find new JSONL. Falling back to most recent..."
    do_fallback
}

do_fallback() {
    echo "[discover-cc-logs] Using fallback: most recently modified project..."

    discovered=$(find_most_recent_project)

    if [ -n "$discovered" ]; then
        echo "[discover-cc-logs] Found: $discovered"

        # Write locator file with fallback method noted
        cat > "$LOCATOR_FILE" << EOF
{
  "discovered_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "cc_project_path": "$discovered",
  "discovery_method": "fallback_most_recent",
  "warning": "May not be the correct project - verify manually"
}
EOF
        echo "[discover-cc-logs] Locator written to: $LOCATOR_FILE"
        echo "[discover-cc-logs] WARNING: Fallback method used - please verify this is the correct project"
    else
        echo "[discover-cc-logs] ERROR: No CC projects found at $CC_PROJECTS_DIR"
        echo "[discover-cc-logs] Run Claude Code at least once to create project logs"
        exit 1
    fi
}

# Main
case "${1:-}" in
    --show)
        show_locator
        ;;
    --probe)
        do_probe
        ;;
    --fallback)
        do_fallback
        ;;
    "")
        # Auto mode: use probe if possible, fallback otherwise
        if [ -f "$LOCATOR_FILE" ]; then
            echo "[discover-cc-logs] Locator already exists:"
            cat "$LOCATOR_FILE"
            echo ""
            echo "To re-discover, delete $LOCATOR_FILE and run again"
        else
            do_probe
        fi
        ;;
    *)
        echo "Usage: $0 [--show|--probe|--fallback]"
        echo ""
        echo "Options:"
        echo "  --show      Show current locator file"
        echo "  --probe     Do a probe run to discover the correct project"
        echo "  --fallback  Use fallback (most recent project)"
        echo ""
        echo "Without arguments: auto-discover (probe if locator doesn't exist)"
        exit 1
        ;;
esac
