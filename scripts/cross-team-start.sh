#!/usr/bin/env bash
# cross-team-start.sh - Deterministic cross-team cold-start that "just works".
#
# Goal:
# - Eliminate stale bridge/token mismatch (401s) by forcing a clean shutdown.
# - Bring up the full stack with --cross-team.
# - Verify peer reachability and send a startup check message.
#
# Usage (run on BOTH machines, with the SAME token):
#   BRIDGE_TOKEN='shared-secret' ./scripts/cross-team-start.sh
#   BRIDGE_TOKEN='shared-secret' ./scripts/cross-team-start.sh "Kickoff prompt..."
#
# Requirements:
# - interlateral_comms/peers.json must exist and have correct self + peer hosts.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
PEERS_JSON="$REPO_ROOT/interlateral_comms/peers.json"

PROMPT="${1:-Cross-team startup}"

if [[ -z "${BRIDGE_TOKEN:-}" ]]; then
  echo "ERROR: BRIDGE_TOKEN is required."
  echo "Set it on BOTH machines to the exact same value:"
  echo "  export BRIDGE_TOKEN='your-shared-secret'"
  exit 1
fi

if [[ ! -f "$PEERS_JSON" ]]; then
  echo "ERROR: peers.json not found: $PEERS_JSON"
  echo "Run: cd interlateral_comms && ./setup-peers.sh"
  exit 1
fi

# Determine team id from peers.json self (preferred), fallback to env/default.
SELF_NAME="$(node -e "try{const p=require('$PEERS_JSON');process.stdout.write(String(p.self||''));}catch(e){}" 2>/dev/null || true)"
if [[ -z "$SELF_NAME" ]]; then
  SELF_NAME="${INTERLATERAL_TEAM_ID:-${TEAM_ID:-}}"
fi
if [[ -z "$SELF_NAME" ]]; then
  echo "ERROR: Could not determine self/team id."
  echo "Fix peers.json 'self' or set INTERLATERAL_TEAM_ID explicitly."
  exit 1
fi

export INTERLATERAL_TEAM_ID="$SELF_NAME"

echo "============================================"
echo "  CROSS-TEAM COLD START (Deterministic)"
echo "============================================"
echo "Repo:      $REPO_ROOT"
echo "Self/team: $INTERLATERAL_TEAM_ID"
echo -n "Token fp:  "
if command -v shasum >/dev/null 2>&1; then
  # Print a short fingerprint so both machines can confirm they set the same token,
  # without pasting secrets into chat.
  printf "%s" "$BRIDGE_TOKEN" | shasum -a 256 | awk '{print substr($1,1,12)}'
else
  echo "(shasum not found)"
fi
echo ""

echo "[1/4] Clean shutdown (kills stale tmux + bridge + ports)..."
"$REPO_ROOT/scripts/shutdown.sh" >/dev/null 2>&1 || true
pkill -f "node.*interlateral_comms/bridge.js" 2>/dev/null || true
tmux -S /tmp/interlateral-tmux.sock kill-server 2>/dev/null || true

echo "[2/5] Wake up with cross-team enabled..."
cd "$REPO_ROOT"
./scripts/wake-up.sh --cross-team --no-attach "$PROMPT"

echo ""
echo "[3/5] Verify local bridge health..."
LOCAL_HEALTH="$(curl -s --connect-timeout 3 http://localhost:3099/health || true)"
if [[ -z "$LOCAL_HEALTH" ]]; then
  echo "ERROR: Local bridge not responding on http://localhost:3099/health"
  exit 1
fi
echo "$LOCAL_HEALTH" | node -e "
  const fs=require('fs');
  const h=JSON.parse(fs.readFileSync(0,'utf8'));
  console.log('  ok=' + h.ok + ' team_id=' + h.team_id + ' host=' + h.hostname + ' sid=' + h.session_id);
"

echo ""
echo "[4/5] Verify peer reachability + send startup check..."

# Extract peers excluding self; expect 1 for alpha<->beta, but handle multiple.
PEER_LINES="$(node -e "
  try {
    const p=require('$PEERS_JSON');
    const self=String(p.self||'');
    for (const k of Object.keys(p.peers||{})) {
      if (k === self) continue;
      const peer=p.peers[k]||{};
      console.log([k, peer.host||'', String(peer.port||3099), peer.fallback_ip||''].join('|'));
    }
  } catch (e) {}
" 2>/dev/null || true)"

if [[ -z "$PEER_LINES" ]]; then
  echo "WARNING: No peers found in peers.json (excluding self). Skipping peer checks."
  exit 0
fi

PEER_OK=0
while IFS='|' read -r PEER_NAME PEER_HOST PEER_PORT PEER_FALLBACK; do
  [[ -z "$PEER_NAME" ]] && continue
  echo "  Peer '$PEER_NAME'..."

  # Prefer direct host (often IP or .local); fallback to fallback_ip when provided.
  PEER_HEALTH="$(curl -s --connect-timeout 4 "http://${PEER_HOST}:${PEER_PORT}/health" 2>/dev/null || true)"
  if [[ -z "$PEER_HEALTH" ]] && [[ -n "${PEER_FALLBACK:-}" ]]; then
    PEER_HEALTH="$(curl -s --connect-timeout 4 "http://${PEER_FALLBACK}:${PEER_PORT}/health" 2>/dev/null || true)"
    [[ -n "$PEER_HEALTH" ]] && echo "    used fallback_ip: $PEER_FALLBACK"
  fi

  if [[ -z "$PEER_HEALTH" ]]; then
    echo "    NOT reachable on :${PEER_PORT} (check WiFi IPs, firewall, peers.json)"
    continue
  fi

  echo "$PEER_HEALTH" | node -e "
    const fs=require('fs');
    const h=JSON.parse(fs.readFileSync(0,'utf8'));
    console.log('    reachable team_id=' + (h.team_id||'?') + ' host=' + (h.hostname||'?') + ' sid=' + (h.session_id||'?'));
  "

  # Send an explicit-token startup check to peer codex.
  node "$REPO_ROOT/interlateral_comms/bridge-send.js" \
    --peer "$PEER_NAME" \
    --token "$BRIDGE_TOKEN" \
    --target codex \
    --sender "startup-${INTERLATERAL_TEAM_ID}" \
    --msg "[startup-check] ${INTERLATERAL_TEAM_ID}->${PEER_NAME} ok?"

  PEER_OK=1
done <<< "$PEER_LINES"

if [[ "$PEER_OK" -eq 0 ]]; then
  echo "WARNING: No peers were reachable. Local stack is up, but cross-team comms are not."
  exit 2
fi

echo ""
echo "Cross-team comms bootstrap complete."

echo ""
echo "[5/5] Attaching to tmux session..."

SESSION_NAME="${CC_TMUX_SESSION:-interlateral-claude}"
TMUX_SOCKET="${TMUX_SOCKET:-/tmp/interlateral-tmux.sock}"

if command -v tmux >/dev/null 2>&1; then
  if tmux -S "$TMUX_SOCKET" has-session -t "$SESSION_NAME" 2>/dev/null; then
    exec tmux -S "$TMUX_SOCKET" attach-session -t "$SESSION_NAME"
  else
    echo "WARNING: tmux session '$SESSION_NAME' not found on socket $TMUX_SOCKET"
  fi
else
  echo "WARNING: tmux not found; cannot attach"
fi
