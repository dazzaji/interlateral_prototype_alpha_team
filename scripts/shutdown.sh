#!/usr/bin/env bash
# shutdown.sh - Stop quad-agent sessions and local support services
#
# Usage:
#   ./scripts/shutdown.sh
#   ./scripts/shutdown.sh --force-port-kill

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

if ! command -v tmux >/dev/null 2>&1; then
  echo "Error: tmux is required but was not found in PATH."
  exit 1
fi

FORCE_PORT_KILL=false
if [[ "${1:-}" == "--force-port-kill" ]]; then
  FORCE_PORT_KILL=true
fi

if [[ -f "$SCRIPT_DIR/tmux-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/tmux-config.sh"
else
  TMUX_SOCKET="${TMUX_SOCKET:-/tmp/interlateral-tmux.sock}"
fi

if ! declare -F run_tmux >/dev/null 2>&1; then
  run_tmux() {
    tmux -S "$TMUX_SOCKET" "$@"
  }
fi

stop_processes_by_pattern() {
  local label="$1"
  local pattern="$2"
  local grace_seconds="${3:-2}"
  local pids
  local waited=0

  pids="$(pgrep -f "$pattern" 2>/dev/null || true)"
  if [[ -z "${pids:-}" ]]; then
    echo "  no $label processes found"
    return 0
  fi

  kill $pids 2>/dev/null || true

  while (( waited < grace_seconds * 10 )); do
    if ! pgrep -f "$pattern" >/dev/null 2>&1; then
      echo "  stopped $label processes: $pids"
      return 0
    fi
    sleep 0.1
    ((waited += 1))
  done

  pids="$(pgrep -f "$pattern" 2>/dev/null || true)"
  if [[ -n "${pids:-}" ]]; then
    kill -9 $pids 2>/dev/null || true
    echo "  force-stopped $label processes: $pids"
  fi
}

stop_processes_on_ports() {
  local label="$1"
  local scope_pattern="$2"
  shift 2
  local ports=("$@")
  local pids
  local matched_pids=()
  local skipped=0
  local pid
  local cmd

  if ! command -v lsof >/dev/null 2>&1; then
    echo "  lsof not found; skipped $label"
    return 0
  fi

  pids="$(lsof -ti "${ports[@]/#/tcp:}" 2>/dev/null | sort -u || true)"
  if [[ -z "${pids:-}" ]]; then
    echo "  no $label pids found"
    return 0
  fi

  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    if [[ "$FORCE_PORT_KILL" == true ]]; then
      matched_pids+=("$pid")
      continue
    fi
    cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    if echo "$cmd" | grep -Eq "$scope_pattern"; then
      matched_pids+=("$pid")
    else
      skipped=$((skipped + 1))
    fi
  done <<< "$pids"

  if [[ "${#matched_pids[@]}" -gt 0 ]]; then
    kill "${matched_pids[@]}" 2>/dev/null || true
    echo "  stopped $label pids: ${matched_pids[*]}"
  else
    echo "  no scoped $label pids matched"
  fi

  if [[ "$skipped" -gt 0 ]]; then
    echo "  skipped $skipped non-scoped pid(s); rerun with --force-port-kill to kill by port only"
  fi
}

echo "============================================"
echo "  INTERLATERAL SHUTDOWN (Quad Mode)"
echo "============================================"
echo ""

SESSIONS=(
  "${CC_TMUX_SESSION:-interlateral-claude}"
  "${CODEX_TMUX_SESSION:-interlateral-codex}"
  "${GEMINI_TMUX_SESSION:-interlateral-gemini}"
)

echo "Stopping tmux sessions..."
for session in "${SESSIONS[@]}"; do
  if run_tmux has-session -t "$session" 2>/dev/null; then
    run_tmux kill-session -t "$session"
    echo "  stopped: $session"
  else
    echo "  not running: $session"
  fi
done

echo ""
echo "Stopping courier and AG watcher..."
stop_processes_by_pattern "courier" "node.*$REPO_ROOT/interlateral_dna/courier.js"
stop_processes_by_pattern "AG watcher" "node.*$REPO_ROOT/interlateral_dna/ag.js watch"

echo ""
echo "Stopping dashboard services on ports 3001 and 5173..."
stop_processes_on_ports "dashboard services" "$REPO_ROOT|interlateral_comms_monitor" 3001 5173

echo ""
echo "Stopping Antigravity CDP endpoint on port 9222..."
stop_processes_on_ports "AG/CDP endpoint" "Antigravity|antigravity" 9222

echo ""
echo "Cleaning tmux socket if no sessions remain..."
if run_tmux ls >/dev/null 2>&1; then
  echo "  socket kept: active tmux sessions still exist"
  run_tmux ls | sed 's/^/    /' || true
else
  rm -f "$TMUX_SOCKET"
  echo "  socket removed: $TMUX_SOCKET"
fi

echo ""
echo "Post-shutdown status:"
for session in "${SESSIONS[@]}"; do
  if run_tmux has-session -t "$session" 2>/dev/null; then
    echo "  WARN session alive: $session"
  else
    echo "  OK session down: $session"
  fi
done
echo "Shutdown complete."
