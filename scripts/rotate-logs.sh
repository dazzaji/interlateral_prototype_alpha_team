#!/bin/bash
# rotate-logs.sh - Log rotation for observability data
#
# BC-08: Rotation must be implemented before it can be tested
#
# Behavior:
# - Rotate .observability/casts/ when > 50 files OR > 500MB
# - Archive old casts to .observability/logs/archive-YYYYMMDD.tar.gz
# - Delete archives older than 30 days
# - MUST: Never block wake-up (fail silently on errors)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CAST_DIR="$REPO_ROOT/.observability/casts"
ARCHIVE_DIR="$REPO_ROOT/.observability/logs"

# Configuration
MAX_FILES=50
MAX_SIZE_MB=500
ARCHIVE_RETENTION_DAYS=30

# Ensure directories exist
mkdir -p "$CAST_DIR" "$ARCHIVE_DIR"

# Count current cast files
file_count=$(find "$CAST_DIR" -name "*.cast" -type f 2>/dev/null | wc -l | tr -d ' ')

# Calculate total size in MB
if [ "$file_count" -gt 0 ]; then
    total_size_kb=$(du -sk "$CAST_DIR" 2>/dev/null | cut -f1)
    total_size_mb=$((total_size_kb / 1024))
else
    total_size_mb=0
fi

# Check if rotation is needed
needs_rotation=false
if [ "$file_count" -gt "$MAX_FILES" ]; then
    needs_rotation=true
    echo "[rotate-logs] File count ($file_count) exceeds limit ($MAX_FILES)"
fi

if [ "$total_size_mb" -gt "$MAX_SIZE_MB" ]; then
    needs_rotation=true
    echo "[rotate-logs] Size (${total_size_mb}MB) exceeds limit (${MAX_SIZE_MB}MB)"
fi

# Perform rotation if needed
if [ "$needs_rotation" = true ]; then
    archive_name="archive-$(date +%Y%m%d-%H%M%S).tar.gz"
    archive_path="$ARCHIVE_DIR/$archive_name"

    echo "[rotate-logs] Creating archive: $archive_name"

    # Archive oldest files (keep newest MAX_FILES/2)
    keep_count=$((MAX_FILES / 2))

    # Get list of files to archive (oldest first, skip newest keep_count)
    # Note: Using ls -t for portability (macOS/Linux compatible)
    total_files=$(find "$CAST_DIR" -name "*.cast" -type f 2>/dev/null | wc -l | tr -d ' ')
    archive_count=$((total_files - keep_count))

    if [ "$archive_count" -gt 0 ]; then
        # Get oldest files (ls -t sorts newest first, tail gets oldest)
        # Using -1 flag for one file per line
        files_to_archive=$(ls -1t "$CAST_DIR"/*.cast 2>/dev/null | tail -n "$archive_count")

        if [ -n "$files_to_archive" ]; then
            # Create archive
            echo "$files_to_archive" | tar -czf "$archive_path" -T - 2>/dev/null || true

            # Remove archived files
            echo "$files_to_archive" | xargs rm -f 2>/dev/null || true

            echo "[rotate-logs] Archived $archive_count files"
        fi
    fi
fi

# Clean up old archives
if [ -d "$ARCHIVE_DIR" ]; then
    old_archives=$(find "$ARCHIVE_DIR" -name "archive-*.tar.gz" -type f -mtime +$ARCHIVE_RETENTION_DAYS 2>/dev/null)
    if [ -n "$old_archives" ]; then
        echo "$old_archives" | xargs rm -f 2>/dev/null || true
        echo "[rotate-logs] Cleaned up archives older than $ARCHIVE_RETENTION_DAYS days"
    fi
fi

echo "[rotate-logs] Complete. Current: $file_count files, ${total_size_mb}MB"
