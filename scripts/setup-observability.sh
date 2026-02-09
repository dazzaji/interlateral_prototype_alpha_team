#!/bin/bash
# setup-observability.sh - One-command observability setup
#
# This script sets up the complete observability stack for CC + AG.
# Run this once after cloning the repo.
#
# Usage:
#   ./scripts/setup-observability.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "============================================"
echo "  Observability Setup for CC + AG"
echo "============================================"
echo ""

# 1. Create directory structure
echo "[1/5] Creating directory structure..."
mkdir -p "$REPO_ROOT/.observability/casts"
mkdir -p "$REPO_ROOT/.observability/logs"
mkdir -p "$REPO_ROOT/.gemini"
echo "  ✓ Created .observability/casts/"
echo "  ✓ Created .observability/logs/"
echo "  ✓ Created .gemini/"

# 2. Setup AG telemetry
echo ""
echo "[2/5] Configuring AG telemetry..."
"$REPO_ROOT/scripts/setup-ag-telemetry.sh"

# 3. Check for asciinema
echo ""
echo "[3/5] Checking for asciinema..."
if command -v asciinema >/dev/null 2>&1; then
    version=$(asciinema --version 2>/dev/null || echo "unknown")
    echo "  ✓ asciinema found: $version"
else
    echo "  ⚠ asciinema not found - visual capture will be disabled"
    echo ""
    echo "  To install asciinema:"
    echo "    macOS:  brew install asciinema"
    echo "    Linux:  pip install asciinema"
    echo "    Other:  https://asciinema.org/docs/installation"
    echo ""
    read -p "  Continue without asciinema? [Y/n] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo "  Setup cancelled. Install asciinema and re-run."
        exit 1
    fi
fi

# 4. Verify scripts are executable
echo ""
echo "[4/5] Verifying scripts..."
for script in wake-up.sh logged-claude.sh logged-ag.sh rotate-logs.sh; do
    if [ -x "$REPO_ROOT/scripts/$script" ]; then
        echo "  ✓ $script is executable"
    else
        chmod +x "$REPO_ROOT/scripts/$script"
        echo "  ✓ $script made executable"
    fi
done

# 5. Test wrapper (dry run)
echo ""
echo "[5/5] Testing wrapper scripts..."
if "$REPO_ROOT/scripts/logged-claude.sh" --version >/dev/null 2>&1; then
    echo "  ✓ logged-claude.sh works (claude found)"
else
    echo "  ⚠ logged-claude.sh: claude command not found in PATH"
    echo "    (This is OK if Claude Code isn't installed yet)"
fi

echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "To start Claude Code with observability:"
echo "  ./scripts/wake-up.sh \"Your prompt here\""
echo ""
echo "To start Antigravity with observability:"
echo "  ./scripts/logged-ag.sh \"Your prompt here\""
echo ""
echo "Data locations:"
echo "  Visual recordings: .observability/casts/*.cast"
echo "  AG telemetry:      .gemini/telemetry.log"
echo "  CC transcripts:    ~/.claude/projects/ (discovered via locator)"
echo ""
