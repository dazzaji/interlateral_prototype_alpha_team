#!/bin/bash
# setup-ag-telemetry.sh - Configure AG telemetry to repo-local path
#
# BC-04: AG telemetry must be repo-local (.gemini/) not global (~/.gemini/)
#
# This ensures telemetry data stays with the repo for template portability.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "[setup-ag-telemetry] Configuring repo-local AG telemetry..."

# Create .gemini directory in repo
mkdir -p "$REPO_ROOT/.gemini"

# Write settings.json with repo-local telemetry path
cat > "$REPO_ROOT/.gemini/settings.json" << 'EOF'
{
  "telemetry": {
    "enabled": true,
    "outfile": ".gemini/telemetry.log",
    "logPrompts": true
  }
}
EOF

echo "[setup-ag-telemetry] Created $REPO_ROOT/.gemini/settings.json"
echo "[setup-ag-telemetry] Telemetry will be written to: $REPO_ROOT/.gemini/telemetry.log"
echo "[setup-ag-telemetry] IMPORTANT: Run AG from repo root or use logged-ag.sh wrapper"
