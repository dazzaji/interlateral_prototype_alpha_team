#!/usr/bin/env bash
# harvest-session.sh - Discover and bundle native agent logs using a Session Anchor ID
# Part of the Native Harvest Architecture (Option A)
#
# Usage:
#   ./scripts/harvest-session.sh <SESSION_ANCHOR_ID>

set -euo pipefail

SESSION_ID="${1:-}"

if [[ -z "$SESSION_ID" ]]; then
  echo "ERROR: SESSION_ANCHOR_ID required."
  echo "Usage: $0 <SESSION_ANCHOR_ID>"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Output bundle directory
BUNDLE_DIR=".observability/runs/${SESSION_ID}"
mkdir -p "$BUNDLE_DIR"

echo "=== Harvesting Native Logs for Session: $SESSION_ID ==="

# 1. Harvest Claude Code (CC) Native Logs
echo "Searching for CC logs..."
CC_PROJECT_DIR=$(ls -td ~/.claude/projects/*/ 2>/dev/null | head -1)
if [[ -n "$CC_PROJECT_DIR" ]]; then
  # Find the JSONL file containing the session anchor
  # We search for the anchor ID string which was included in the wake-up prompt
  MATCHING_LOG=$(grep -l "$SESSION_ID" "$CC_PROJECT_DIR"/*.jsonl 2>/dev/null | head -1 || true)
  if [[ -n "$MATCHING_LOG" ]]; then
    echo "  Found CC Log: $(basename "$MATCHING_LOG")"
    cp "$MATCHING_LOG" "$BUNDLE_DIR/cc_native.jsonl"
  else
    echo "  WARNING: No CC log found containing anchor $SESSION_ID"
    # Fallback to most recent if anchor not found (less reliable)
    LATEST_LOG=$(ls -t "$CC_PROJECT_DIR"/*.jsonl 2>/dev/null | head -1 || true)
    if [[ -n "$LATEST_LOG" ]]; then
        echo "  Fallback to latest CC Log: $(basename "$LATEST_LOG")"
        cp "$LATEST_LOG" "$BUNDLE_DIR/cc_native.jsonl"
    fi
  fi
fi

# 2. Harvest Codex (CX) Native Logs
echo "Searching for Codex logs..."
# Codex rollout logs live in YYYY/MM/DD paths
CX_SESSION_DIR=$(find ~/.codex/sessions -type d -name "$(date +%d)" 2>/dev/null | grep "$(date +%Y/%m)" | head -1 || true)
if [[ -n "$CX_SESSION_DIR" ]]; then
  MATCHING_CX_LOG=$(grep -l "$SESSION_ID" "$CX_SESSION_DIR"/*.jsonl 2>/dev/null | head -1 || true)
  if [[ -n "$MATCHING_CX_LOG" ]]; then
    echo "  Found Codex Log: $(basename "$MATCHING_CX_LOG")"
    cp "$MATCHING_CX_LOG" "$BUNDLE_DIR/codex_native.jsonl"
  else
    echo "  WARNING: No Codex log found containing anchor $SESSION_ID"
    # Fallback to history.jsonl
    if [[ -f ~/.codex/history.jsonl ]]; then
        echo "  Copying history.jsonl as backup..."
        cp ~/.codex/history.jsonl "$BUNDLE_DIR/codex_history.jsonl"
    fi
  fi
fi

# 3. Harvest Antigravity (AG) Logs
echo "Searching for AG logs..."
if [[ -f ".gemini/ag_telemetry.log" ]]; then
    echo "  Found AG Log: ag_telemetry.log"
    cp ".gemini/ag_telemetry.log" "$BUNDLE_DIR/ag_native.log"
fi

# 4. Harvest Heartbeat/User Prompt
if [[ -f ".observability/SESSIONS/${SESSION_ID}.anchor" ]]; then
     echo "  Found Anchor Metadata"
     cp ".observability/SESSIONS/${SESSION_ID}.anchor" "$BUNDLE_DIR/session.anchor"
fi

echo "=== Harvest Complete ==="
echo "Bundle location: $BUNDLE_DIR"
echo ""
echo "Next step: Run export script pointing to this bundle."
