#!/bin/bash
# Rotate events.jsonl when it exceeds 10MB
# Uses copy+truncate to avoid breaking open write streams
# Part of Phase A: OTEL Eval Pipeline

LOG_FILE=".observability/events.jsonl"
LOGS_DIR=".observability/logs"
MAX_SIZE=$((10 * 1024 * 1024))  # 10MB

# Get repo root (script is in scripts/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

# Ensure logs directory exists
mkdir -p "$LOGS_DIR"

if [ -f "$LOG_FILE" ]; then
  SIZE=$(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE")
  if [ "$SIZE" -gt "$MAX_SIZE" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    ARCHIVE="${LOGS_DIR}/events_${TIMESTAMP}.jsonl"

    # Copy then truncate (stream keeps writing to same inode)
    cp "$LOG_FILE" "$ARCHIVE"
    : > "$LOG_FILE"  # Truncate in place

    echo "Rotated: copied to $ARCHIVE, truncated $LOG_FILE"

    # Compress old archives over 1 hour old
    find "$LOGS_DIR" -name "events_*.jsonl" -mmin +60 -exec gzip {} \; 2>/dev/null
  else
    echo "Log size: $SIZE bytes (under threshold)"
  fi
else
  echo "Log file not found: $LOG_FILE"
fi
