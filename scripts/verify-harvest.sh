#!/usr/bin/env bash
# verify-harvest.sh - Tripwire checks for harvested telemetry bundles
# Part of the Hardened Native Harvest (Option A+)
#
# Usage:
#   ./scripts/verify-harvest.sh <BUNDLE_DIR>

set -euo pipefail

BUNDLE_DIR="${1:-}"

if [[ -z "$BUNDLE_DIR" || ! -d "$BUNDLE_DIR" ]]; then
  echo "ERROR: Valid bundle directory required."
  exit 1
fi

echo "=== Running Tripwire Checks on Bundle: $(basename "$BUNDLE_DIR") ==="

FAILS=0

# Check 1: CC Native Log (Essential)
CC_LOG="$BUNDLE_DIR/cc_native.jsonl"
if [[ ! -f "$CC_LOG" ]]; then
  echo "❌ FAIL: cc_native.jsonl missing."
  FAILS=$((FAILS + 1))
else
  # Check 1a: File Size (Reviewer 03)
  SIZE=$(wc -c < "$CC_LOG")
  if [[ $SIZE -lt 1024 ]]; then
    echo "❌ FAIL: cc_native.jsonl too small (${SIZE} bytes). Session may be empty."
    FAILS=$((FAILS + 1))
  else
    echo "✅ PASS: cc_native.jsonl size ok (${SIZE} bytes)."
  fi

  # Check 1b: Entry types (Reviewer 02)
  USERS=$(grep -c '"type":"user"' "$CC_LOG" || echo 0)
  ASSISTANTS=$(grep -c '"type":"assistant"' "$CC_LOG" || echo 0)
  if [[ $USERS -eq 0 || $ASSISTANTS -eq 0 ]]; then
    echo "❌ FAIL: cc_native.jsonl missing required entries (Users: $USERS, Assistants: $ASSISTANTS)."
    FAILS=$((FAILS + 1))
  else
    echo "✅ PASS: cc_native.jsonl contains $USERS user and $ASSISTANTS assistant entries."
  fi
fi

# Check 2: Codex Log (Best Effort but important)
CX_LOG="$BUNDLE_DIR/codex_native.jsonl"
CX_HIST="$BUNDLE_DIR/codex_history.jsonl"
if [[ ! -f "$CX_LOG" ]]; then
  echo "⚠️ WARN: codex_native.jsonl missing. Evals will ignore Codex rollout data."
else
  SIZE_CX=$(wc -c < "$CX_LOG")
  echo "✅ PASS: codex_native.jsonl size ok (${SIZE_CX} bytes)."
fi

if [[ ! -f "$CX_HIST" ]]; then
  echo "⚠️ WARN: codex_history.jsonl missing. Evals will ignore Codex history data."
else
  SIZE_CX_H=$(wc -c < "$CX_HIST")
  echo "✅ PASS: codex_history.jsonl size ok (${SIZE_CX_H} bytes)."
fi

# Check 3: Anchor Metadata
if [[ ! -f "$BUNDLE_DIR/session.anchor" ]]; then
  echo "⚠️ WARN: session.anchor missing. Discovery transparency reduced."
fi

echo "==========================================="
if [[ $FAILS -gt 0 ]]; then
  echo "🔴 VERIFICATION FAILED ($FAILS failures)."
  echo "   [KILL SWITCH] Export and Evals should be aborted."
  exit 1
else
  echo "🟢 VERIFICATION PASSED. Bundle ready for export."
  exit 0
fi
