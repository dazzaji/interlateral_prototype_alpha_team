#!/usr/bin/env bash
# setup-hooks.sh - Configures Claude Code hooks for deterministic telemetry
# Part of the Hook-Anchored Native Harvest (Option A+)

set -euo pipefail

# Ensure observability directory exists
mkdir -p .observability/hooks

# Define the hook command
# This appends the structured JSON event to a central log
# We include the project path to ensure we can filter if needed
PROJECT_ROOT="$(pwd)"
HOOK_CMD="cat >> \"$PROJECT_ROOT/.observability/hooks/cc_events.jsonl\""

if command -v claude &> /dev/null; then
    echo "=== Configuring Claude Code Hooks ==="
    
    # We use 'claude config set' for hooks
    # Note: These are often global, but we use the project-specific path for output
    claude config set hooks.UserPromptSubmit "$HOOK_CMD"
    claude config set hooks.SessionStart "$HOOK_CMD"
    claude config set hooks.SessionEnd "$HOOK_CMD"
    
    echo "  Hooks configured to log to: .observability/hooks/cc_events.jsonl"
else
    echo "WARNING: 'claude' CLI not found. Manual hook setup may be required."
fi
