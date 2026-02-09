#!/bin/bash
# logged-claude.sh - Safe CC wrapper with observability
#
# Day 0 Fixes Applied:
# - Fix 1: Proper argument quoting (uses array, not $*)
# - Fix 1: Force asciicast v2 format
# - Fix 2: Collision-safe filenames (PID + random suffix)
#
# Safety Requirements (BC-02):
# - MUST call real binary via `command claude` (prevents recursion)
# - MUST use asciinema command-mode (-c "...")
# - MUST preserve arguments safely
# - MUST graceful degradation if asciinema missing
# - MUST force asciicast v2 format

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CAST_DIR="$REPO_ROOT/.observability/casts"
DEFAULT_CLAUDE_MODEL="${CLAUDE_MODEL:-opus}"

# Ensure cast directory exists
mkdir -p "$CAST_DIR"

# Day 0 Fix 2: Collision-safe filename with PID and random suffix
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
RANDOM_SUFFIX="$(head -c 4 /dev/urandom | xxd -p)"
CAST_FILE="$CAST_DIR/cc-${TIMESTAMP}-$$-${RANDOM_SUFFIX}.cast"

# Detect whether caller already provided a model argument.
has_model_arg() {
    for arg in "$@"; do
        if [[ "$arg" == "--model" || "$arg" == "-m" || "$arg" == --model=* || "$arg" == -m=* ]]; then
            return 0
        fi
    done
    return 1
}

# Extract model value from args if provided.
extract_model_arg() {
    local prev=""
    for arg in "$@"; do
        if [[ "$prev" == "--model" || "$prev" == "-m" ]]; then
            echo "$arg"
            return 0
        fi
        if [[ "$arg" == --model=* ]]; then
            echo "${arg#--model=}"
            return 0
        fi
        if [[ "$arg" == -m=* ]]; then
            echo "${arg#-m=}"
            return 0
        fi
        prev="$arg"
    done
    return 1
}

CLAUDE_ARGS=("$@")
SELECTED_MODEL="$DEFAULT_CLAUDE_MODEL"

if has_model_arg "$@"; then
    SELECTED_MODEL="$(extract_model_arg "$@" || echo "$DEFAULT_CLAUDE_MODEL")"
else
    CLAUDE_ARGS=(--model "$DEFAULT_CLAUDE_MODEL" "${CLAUDE_ARGS[@]}")
fi

# Hybrid policy:
# - Aliases (e.g., "opus") are trusted defaults and skip preflight.
# - Explicit full model IDs (e.g., claude-opus-4-6-20260205) are smoke-tested
#   with a timeout. Explicit errors fail fast; timeouts proceed with warning
#   since the interactive session still uses the requested model.
if [[ "$SELECTED_MODEL" == claude-* ]]; then
    CLAUDE_PREFLIGHT_TIMEOUT=15
    CLAUDE_PREFLIGHT_TMPFILE=$(mktemp /tmp/claude_preflight.XXXXXX)
    set +e
    command claude --model "$SELECTED_MODEL" -p "ok" > "$CLAUDE_PREFLIGHT_TMPFILE" 2>&1 &
    CLAUDE_PREFLIGHT_PID=$!
    CLAUDE_TIMED_OUT=false
    CLAUDE_WAITED=0
    while kill -0 "$CLAUDE_PREFLIGHT_PID" 2>/dev/null; do
        if [ "$CLAUDE_WAITED" -ge "$CLAUDE_PREFLIGHT_TIMEOUT" ]; then
            kill "$CLAUDE_PREFLIGHT_PID" 2>/dev/null
            wait "$CLAUDE_PREFLIGHT_PID" 2>/dev/null || true
            CLAUDE_TIMED_OUT=true
            echo "[WARN] Claude preflight timed out after ${CLAUDE_PREFLIGHT_TIMEOUT}s — proceeding with requested model" >&2
            break
        fi
        sleep 1
        CLAUDE_WAITED=$((CLAUDE_WAITED + 1))
    done
    if [ "$CLAUDE_TIMED_OUT" = false ]; then
        wait "$CLAUDE_PREFLIGHT_PID"
        PREFLIGHT_RC=$?
    else
        PREFLIGHT_RC=0
    fi
    PREFLIGHT_OUTPUT=$(cat "$CLAUDE_PREFLIGHT_TMPFILE" 2>/dev/null)
    rm -f "$CLAUDE_PREFLIGHT_TMPFILE"
    set -e
    if [ "$PREFLIGHT_RC" -ne 0 ]; then
        echo "[ERROR] Selected explicit Claude model is unavailable: $SELECTED_MODEL" >&2
        echo "[ERROR] Refusing to start Claude with a silent fallback." >&2
        echo "$PREFLIGHT_OUTPUT" | tail -n 5 | sed 's/^/[ERROR]   /' >&2
        exit 1
    fi
fi

# Day 0 Fix 1: Build properly quoted command string for -c
# Using printf %q to safely quote each argument
build_quoted_command() {
    local cmd="command claude"
    for arg in "$@"; do
        cmd="$cmd $(printf '%q' "$arg")"
    done
    echo "$cmd"
}

QUOTED_CMD="$(build_quoted_command "${CLAUDE_ARGS[@]}")"

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
        # Older asciinema without format flag - still record but warn
        echo "[WARN] asciinema version may not support format flag - recording anyway" >&2
        exec asciinema rec --overwrite "$CAST_FILE" -c "$QUOTED_CMD"
    fi
else
    # Graceful degradation: proceed without visual capture
    echo "[WARN] asciinema not found - proceeding without visual capture" >&2
    echo "[INFO] Install with: brew install asciinema (macOS) or pip install asciinema" >&2
    exec command claude "${CLAUDE_ARGS[@]}"
fi
