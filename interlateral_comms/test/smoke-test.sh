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
SKIP=0

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$1"; }

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

skip() {
  yellow "SKIP: $1"
  SKIP=$((SKIP + 1))
}

echo "=== Bridge Smoke Test ==="
echo "Target: ${BASE}"
echo ""

# 1. Health
echo "--- /health ---"
BRIDGE_AVAILABLE=false
if HEALTH=$(curl -sf --max-time 3 "${BASE}/health" 2>&1); then
  BRIDGE_AVAILABLE=true
  check "health returns ok" '"ok":true' "$HEALTH"
else
  skip "bridge runtime checks (/health, /status, /inject) - target not reachable at ${BASE}"
fi

if [ "$BRIDGE_AVAILABLE" = true ]; then
  # 2. Status
  echo "--- /status ---"
  STATUS=$(curl -sf --max-time 3 "${BASE}/status" 2>&1 || echo "CONNECT_FAIL")
  check "status returns JSON" '{' "$STATUS"

  # 3. Inject (to CC - safest target since we're running in CC)
  echo "--- /inject (cc) ---"
  if [ -n "${BRIDGE_TOKEN:-}" ]; then
    INJECT=$(curl -sf --max-time 3 -X POST "${BASE}/inject" \
      -H 'Content-Type: application/json' \
      -H "x-bridge-token: ${BRIDGE_TOKEN}" \
      -d '{"target":"cc","message":"[BRIDGE-SMOKE-TEST] If you see this, the bridge works."}' 2>&1 || echo "INJECT_FAIL")
  else
    INJECT=$(curl -sf --max-time 3 -X POST "${BASE}/inject" \
      -H 'Content-Type: application/json' \
      -d '{"target":"cc","message":"[BRIDGE-SMOKE-TEST] If you see this, the bridge works."}' 2>&1 || echo "INJECT_FAIL")
  fi
  check "inject returns ok" '"ok":true' "$INJECT"

  # 4. Invalid target
  echo "--- /inject (invalid) ---"
  if [ -n "${BRIDGE_TOKEN:-}" ]; then
    INVALID=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" -X POST "${BASE}/inject" \
      -H 'Content-Type: application/json' \
      -H "x-bridge-token: ${BRIDGE_TOKEN}" \
      -d '{"target":"evil","message":"nope"}' 2>&1 || echo "000")
  else
    INVALID=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" -X POST "${BASE}/inject" \
      -H 'Content-Type: application/json' \
      -d '{"target":"evil","message":"nope"}' 2>&1 || echo "000")
  fi
  check "invalid target returns 400" "400" "$INVALID"

  # 5. Missing message
  echo "--- /inject (no message) ---"
  if [ -n "${BRIDGE_TOKEN:-}" ]; then
    NOMSG=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" -X POST "${BASE}/inject" \
      -H 'Content-Type: application/json' \
      -H "x-bridge-token: ${BRIDGE_TOKEN}" \
      -d '{"target":"cc"}' 2>&1 || echo "000")
  else
    NOMSG=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" -X POST "${BASE}/inject" \
      -H 'Content-Type: application/json' \
      -d '{"target":"cc"}' 2>&1 || echo "000")
  fi
  check "missing message returns 400" "400" "$NOMSG"

  # 6. Auth guardrail: unauthenticated inject rejected when BRIDGE_TOKEN is set
  echo "--- /inject (auth guardrail) ---"
  if [ -n "${BRIDGE_TOKEN:-}" ]; then
    NO_AUTH=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" -X POST "${BASE}/inject" \
      -H 'Content-Type: application/json' \
      -d '{"target":"cc","message":"no-token-test"}' 2>&1 || echo "000")
    check "unauthenticated inject returns 401 when BRIDGE_TOKEN set" "401" "$NO_AUTH"

    BAD_AUTH=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" -X POST "${BASE}/inject" \
      -H 'Content-Type: application/json' \
      -H 'x-bridge-token: wrong-token' \
      -d '{"target":"cc","message":"bad-token-test"}' 2>&1 || echo "000")
    check "wrong token inject returns 401" "401" "$BAD_AUTH"
  else
    skip "auth guardrail endpoint checks - BRIDGE_TOKEN not set for this smoke run"
  fi
fi

# 7. Bootstrap guardrail (offline check — no running bridge needed)
echo "--- bootstrap auth guardrail ---"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [ -f "$REPO_ROOT/scripts/bootstrap-full.sh" ]; then
  # Should fail closed when CROSS_TEAM=true and no BRIDGE_TOKEN.
  GUARD_OUT=$(cd "$REPO_ROOT" && CROSS_TEAM=true BRIDGE_TOKEN="" BRIDGE_ALLOW_NO_AUTH="" \
    bash ./scripts/bootstrap-full.sh 2>&1 || true)
  check "bootstrap blocks bridge without BRIDGE_TOKEN" "BRIDGE_TOKEN" "$GUARD_OUT"
else
  skip "bootstrap guardrail check - bootstrap-full.sh not found at expected path"
fi

# Summary
echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed, ${SKIP} skipped ==="
[ "$FAIL" -eq 0 ] && green "ALL TESTS PASSED" || red "SOME TESTS FAILED"
exit "$FAIL"
