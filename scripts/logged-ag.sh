#!/bin/bash
# logged-ag.sh - Safe AG wrapper with observability
#
# Day 0 Fixes Applied:
# - Fix 1: Proper argument quoting (uses array, not $*)
# - Fix 1: Force asciicast v2 format
# - Fix 2: Collision-safe filenames (PID + random suffix)
# - Fix 3: cd to REPO_ROOT to ensure telemetry.log lands in repo-local .gemini/
#
# Safety Requirements (BC-02):
# - MUST call real binary via `command` (prevents recursion)
# - MUST use asciinema command-mode (-c "...")
# - MUST preserve arguments safely
# - MUST graceful degradation if asciinema missing
# - MUST force asciicast v2 format
# - MUST ensure telemetry stays repo-local (Day 0 Fix 3)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CAST_DIR="$REPO_ROOT/.observability/casts"

# Ensure cast directory exists
mkdir -p "$CAST_DIR"

# Day 0 Fix 2: Collision-safe filename with PID and random suffix
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
RANDOM_SUFFIX="$(head -c 4 /dev/urandom | xxd -p)"
CAST_FILE="$CAST_DIR/ag-${TIMESTAMP}-$$-${RANDOM_SUFFIX}.cast"

# Day 0 Fix 3: Change to REPO_ROOT to ensure telemetry.log lands in repo-local .gemini/
# This is critical because .gemini/settings.json uses relative path for outfile
cd "$REPO_ROOT"

# Ensure .gemini directory exists for telemetry
mkdir -p "$REPO_ROOT/.gemini"

# Day 0 Fix 1: Build properly quoted command string for -c
# Detect AG command (could be 'ag', 'antigravity', or via node)
detect_ag_command() {
    if command -v ag >/dev/null 2>&1; then
        echo "ag"
    elif command -v antigravity >/dev/null 2>&1; then
        echo "antigravity"
    elif [ -f "$REPO_ROOT/interlateral_dna/ag.js" ]; then
        echo "node $REPO_ROOT/interlateral_dna/ag.js"
    else
        echo ""
    fi
}

AG_CMD="$(detect_ag_command)"

if [ -z "$AG_CMD" ]; then
    echo "[ERROR] Cannot find AG command (ag, antigravity, or ag.js)" >&2
    exit 1
fi

# Build properly quoted command string
build_quoted_command() {
    local cmd="$AG_CMD"
    for arg in "$@"; do
        cmd="$cmd $(printf '%q' "$arg")"
    done
    echo "$cmd"
}

QUOTED_CMD="$(build_quoted_command "$@")"

# Check if asciinema is available
if command -v asciinema >/dev/null 2>&1; then
    # Detect asciinema version to use correct format flag
    # asciinema 3.x uses --output-format, 2.x uses --format
    if asciinema rec --help 2>&1 | grep -q -- "--output-format"; then
        # asciinema 3.x: use --output-format
        exec asciinema rec --overwrite --output-format asciicast-v2 "$CAST_FILE" -c "$QUOTED_CMD"
    elif asciinema rec --help 2>&1 | grep -q -- "--format"; then
        # asciinema 2.x: use --format
        exec asciinema rec --overwrite --format asciicast-v2 "$CAST_FILE" -c "$QUOTED_CMD"
    else
        echo "[WARN] asciinema version may not support format flag - recording anyway" >&2
        exec asciinema rec --overwrite "$CAST_FILE" -c "$QUOTED_CMD"
    fi
else
    # Graceful degradation: proceed without visual capture
    echo "[WARN] asciinema not found - proceeding without visual capture" >&2
    echo "[INFO] Install with: brew install asciinema (macOS) or pip install asciinema" >&2
    # Still run from REPO_ROOT to ensure telemetry goes to right place
    eval "$QUOTED_CMD"
fi
