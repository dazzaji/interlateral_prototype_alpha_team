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

# Use anchor-search in projects dir (Strict Version 3 - JSONL + Repo Match)
CC_PROJECT_DIR=$(ls -td ~/.claude/projects/*/ 2>/dev/null | head -1)
REPO_PATH=$(realpath "$(pwd)")

if [[ -n "$CC_PROJECT_DIR" ]]; then
  echo "  Searching for anchor $SESSION_ID in $CC_PROJECT_DIR..."
  # Find the JSONL file containing the session anchor
  MATCHING_LOG=$(grep -l "$SESSION_ID" "$CC_PROJECT_DIR"/*.jsonl 2>/dev/null | head -1 || true)
  
  if [[ -n "$MATCHING_LOG" ]]; then
    # REPO MATCH CHECK (Version 4 - Deterministic cwd prefix check)
    echo "  Verifying Repo Match via 'cwd' prefix check (Fix 10)..."
    # Extract cwd from log and check if it starts with our canonical REPO_PATH
    LOG_CWD=$(jq -r 'select(.cwd != null) | .cwd' "$MATCHING_LOG" 2>/dev/null | head -1 | xargs realpath 2>/dev/null || true)
    
    if [[ -n "$LOG_CWD" && "$LOG_CWD" == "$REPO_PATH"* ]]; then
        echo "  ✅ Deterministic Repo Match Confirmed: $LOG_CWD starts with $REPO_PATH"
        cp "$MATCHING_LOG" "$BUNDLE_DIR/cc_native.jsonl"
    else
        echo "  ❌ REPO MISMATCH: 'cwd' ($LOG_CWD) is not within $REPO_PATH. Skipping."
    fi
  else
    echo "  WARNING: No CC log found containing anchor $SESSION_ID"
    # Fallback removed - must be deterministic for Test 3
  fi
fi

# 2. Harvest Codex (CX) Native Logs
echo "Searching for Codex logs..."
# Check isolated CODEX_HOME first (Version 2)
ISOLATED_HOME=".observability/SESSIONS/${SESSION_ID}/codex"
ISOLATED_CX_LOG=$(find "$ISOLATED_HOME" -name "rollout-*.jsonl" 2>/dev/null | head -1 || true)

if [[ -n "$ISOLATED_CX_LOG" && -f "$ISOLATED_CX_LOG" ]]; then
  echo "  Found ISOLATED Codex Log: $(basename "$ISOLATED_CX_LOG")"
  cp "$ISOLATED_CX_LOG" "$BUNDLE_DIR/codex_native.jsonl"
  
  # Also capture history.jsonl (Reviewer 01 fix)
  if [[ -f "$ISOLATED_HOME/history.jsonl" ]]; then
      echo "  Found ISOLATED Codex History: history.jsonl"
      cp "$ISOLATED_HOME/history.jsonl" "$BUNDLE_DIR/codex_history.jsonl"
  fi
else
  # Fallback to global ~/.codex/sessions
  CX_SESSION_DIR=$(find ~/.codex/sessions -type d -name "$(date +%d)" 2>/dev/null | grep "$(date +%Y/%m)" | head -1 || true)
  if [[ -n "$CX_SESSION_DIR" ]]; then
    MATCHING_CX_LOG=$(grep -l "$SESSION_ID" "$CX_SESSION_DIR"/*.jsonl 2>/dev/null | head -1 || true)
    if [[ -n "$MATCHING_CX_LOG" ]]; then
      echo "  Found GLOBAL Codex Log: $(basename "$MATCHING_CX_LOG")"
      cp "$MATCHING_CX_LOG" "$BUNDLE_DIR/codex_native.jsonl"
    fi
  fi
fi

# 3. Harvest Antigravity (AG) Logs
echo "Searching for AG logs..."
if [[ -f ".gemini/ag_telemetry.log" ]]; then
    echo "  Found AG Log: ag_telemetry.log"
    cp ".gemini/ag_telemetry.log" "$BUNDLE_DIR/ag_native.log"
fi

# 4. Harvest Ground Truth (Reviewer 01 fix)
echo "Capturing Ground Truth..."
git diff > "$BUNDLE_DIR/ground_truth_diff.patch" || true
git status > "$BUNDLE_DIR/ground_truth_status.txt" || true
git log -n 5 > "$BUNDLE_DIR/ground_truth_git_log.txt" || true

# 5. Harvest Heartbeat/User Prompt
if [[ -f ".observability/SESSIONS/${SESSION_ID}.anchor" ]]; then
     echo "  Found Anchor Metadata"
     cp ".observability/SESSIONS/${SESSION_ID}.anchor" "$BUNDLE_DIR/session.anchor"
fi

echo "=== Harvest Complete ==="
echo "Bundle location: $BUNDLE_DIR"
echo ""
echo "Next step: Run export script pointing to this bundle."
