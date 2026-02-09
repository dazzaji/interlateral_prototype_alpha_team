#!/bin/bash
# Shared tmux configuration for Interlateral scripts
# All scripts should source this file to ensure consistent tmux socket usage
#
# Purpose: Prevent split-brain tmux servers by using a single socket path
# that is within Codex's writable roots (/tmp is allowed, /private/tmp is not)

# Socket path - can be overridden via environment variable
export TMUX_SOCKET="${TMUX_SOCKET:-/tmp/interlateral-tmux.sock}"

# Helper function to run tmux with the correct socket
# Usage: run_tmux has-session -t mysession
run_tmux() {
    tmux -S "$TMUX_SOCKET" "$@"
}

# Export for child processes
export -f run_tmux 2>/dev/null || true
