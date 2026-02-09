#!/bin/bash
# ack-gemini.sh - Reliable ACK script for Gemini CLI
# Usage: ./scripts/ack-gemini.sh [message] [target]
#   message: Optional message (default: "ACK")
#   target:  Optional target (default: "@CC", can be "@HUMAN", "@ALL", etc.)
#
# Examples:
#   ./scripts/ack-gemini.sh                           # ACK to CC
#   ./scripts/ack-gemini.sh "ACK. Ready."             # Custom message to CC
#   ./scripts/ack-gemini.sh "ACK" "@HUMAN"            # ACK to human
#   ./scripts/ack-gemini.sh "What is our task?" "@ALL" # Question to all
#
# This script exists because Gemini CLI sometimes forgets required
# parameters when calling WriteFile. Running a script is more robust.

COMMS_FILE="interlateral_dna/comms.md"
TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M:%S')
MESSAGE="${1:-ACK}"
TARGET="${2:-@CC}"

# Ensure we're in repo root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT" || exit 1

# Append ACK to comms.md
cat >> "$COMMS_FILE" << EOF

[Gemini] $TARGET [$TIMESTAMP]
$MESSAGE

---
EOF

echo "✅ Gemini ACK written to $COMMS_FILE (target: $TARGET)"
