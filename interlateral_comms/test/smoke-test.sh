#!/usr/bin/env bash
# Smoke test for the cross-machine bridge
# Run: bash test/smoke-test.sh [host] [port]
# Default: localhost:3099

set -euo pipefail

HOST="${1:-localhost}"
PORT="${2:-3099}"
BASE="http://${HOST}:${PORT}"
PASS=0
FAIL=0

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }

check() {
  local name="$1" expected="$2" actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    green "PASS: $name"
    PASS=$((PASS + 1))
  else
    red "FAIL: $name (expected '$expected', got '$actual')"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Bridge Smoke Test ==="
echo "Target: ${BASE}"
echo ""

# 1. Health
echo "--- /health ---"
HEALTH=$(curl -sf "${BASE}/health" 2>&1 || echo "CONNECT_FAIL")
check "health returns ok" '"ok":true' "$HEALTH"

# 2. Status
echo "--- /status ---"
STATUS=$(curl -sf "${BASE}/status" 2>&1 || echo "CONNECT_FAIL")
check "status returns JSON" '{' "$STATUS"

# 3. Inject (to CC - safest target since we're running in CC)
echo "--- /inject (cc) ---"
INJECT=$(curl -sf -X POST "${BASE}/inject" \
  -H 'Content-Type: application/json' \
  -d '{"target":"cc","message":"[BRIDGE-SMOKE-TEST] If you see this, the bridge works."}' 2>&1 || echo "INJECT_FAIL")
check "inject returns ok" '"ok":true' "$INJECT"

# 4. Invalid target
echo "--- /inject (invalid) ---"
INVALID=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/inject" \
  -H 'Content-Type: application/json' \
  -d '{"target":"evil","message":"nope"}' 2>&1 || echo "000")
check "invalid target returns 400" "400" "$INVALID"

# 5. Missing message
echo "--- /inject (no message) ---"
NOMSG=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/inject" \
  -H 'Content-Type: application/json' \
  -d '{"target":"cc"}' 2>&1 || echo "000")
check "missing message returns 400" "400" "$NOMSG"

# Summary
echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed ==="
[ "$FAIL" -eq 0 ] && green "ALL TESTS PASSED" || red "SOME TESTS FAILED"
exit "$FAIL"
