#!/bin/bash
# first-time-setup.sh - Setup for fresh clone
#
# Run this ONCE after cloning the repo to install all dependencies.
# After this, use wake-up.sh for normal operation.
#
# What this does:
# 1. Verifies Node.js 18+ is installed
# 2. Installs npm dependencies for all components
# 3. Makes scripts executable
# 4. Verifies everything is ready
#
# Failure Mode Reference: Addresses #4, #10, #24, #25, #26, #29

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo "  INTERLATERAL FIRST-TIME SETUP"
echo "============================================"
echo ""
echo "Repo: $REPO_ROOT"
echo ""

SETUP_OK=true

###############################################################################
# 1. CHECK NODE.JS
###############################################################################
echo "[1/5] Checking Node.js..."

if ! command -v node &> /dev/null; then
    echo "  ERROR: Node.js is not installed!"
    echo "  Install it from: https://nodejs.org/ (v18+ required)"
    echo ""
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "  ERROR: Node.js v18+ required, found v$NODE_VERSION"
    echo "  Upgrade from: https://nodejs.org/"
    echo ""
    exit 1
fi

echo "  Node.js v$(node -v | sed 's/v//') OK"

###############################################################################
# 2. CHECK NPM
###############################################################################
echo "[2/5] Checking prerequisites..."

if ! command -v npm &> /dev/null; then
    echo "  ERROR: npm is not installed!"
    exit 1
fi

echo "  npm v$(npm -v) OK"

if ! command -v tmux &> /dev/null; then
    echo "  ERROR: tmux is not installed!"
    echo "  Install tmux and re-run this script."
    exit 1
fi
echo "  tmux OK"

if ! command -v python3 &> /dev/null; then
    echo "  ERROR: python3 is not installed!"
    echo "  Install Python 3 and re-run this script."
    exit 1
fi
echo "  python3 v$(python3 -V | awk '{print $2}') OK"

if [ ! -f "$REPO_ROOT/.env" ]; then
    echo "  NOTE: .env not found."
    echo "  Copy .env.example to .env and set required keys (e.g., OPENAI_API_KEY) if you plan to run evals."
fi

###############################################################################
# 3. INSTALL DEPENDENCIES
###############################################################################
echo "[3/5] Installing dependencies..."

# 3a. interlateral_dna (ag.js, cc.js tools)
echo "  Installing interlateral_dna deps..."
if [ -f "$REPO_ROOT/interlateral_dna/package.json" ]; then
    (cd "$REPO_ROOT/interlateral_dna" && npm install --silent) || {
        echo "    WARNING: interlateral_dna npm install failed"
        SETUP_OK=false
    }
    echo "    Done"
else
    echo "    SKIP: No package.json found"
fi

# 3b. Dashboard server
echo "  Installing dashboard server deps..."
if [ -f "$REPO_ROOT/interlateral_comms_monitor/server/package.json" ]; then
    (cd "$REPO_ROOT/interlateral_comms_monitor/server" && npm install --silent) || {
        echo "    WARNING: dashboard server npm install failed"
        SETUP_OK=false
    }
    echo "    Done"
else
    echo "    SKIP: No server package.json found"
fi

# 3c. Dashboard UI
echo "  Installing dashboard UI deps..."
if [ -f "$REPO_ROOT/interlateral_comms_monitor/ui/package.json" ]; then
    (cd "$REPO_ROOT/interlateral_comms_monitor/ui" && npm install --silent) || {
        echo "    WARNING: dashboard UI npm install failed"
        SETUP_OK=false
    }
    echo "    Done"
else
    echo "    SKIP: No UI package.json found"
fi

# 3d. Cross-machine bridge (interlateral_comms)
echo "  Installing cross-machine bridge deps..."
if [ -f "$REPO_ROOT/interlateral_comms/package.json" ]; then
    (cd "$REPO_ROOT/interlateral_comms" && npm install --silent) || {
        echo "    WARNING: interlateral_comms npm install failed"
        SETUP_OK=false
    }
    echo "    Done"
else
    echo "    SKIP: No interlateral_comms package.json found"
fi

# 3e. Peer config (peers.json from template)
if [ -f "$REPO_ROOT/interlateral_comms/peers.json.example" ] && [ ! -f "$REPO_ROOT/interlateral_comms/peers.json" ]; then
    echo "  Creating peers.json from template..."
    cp "$REPO_ROOT/interlateral_comms/peers.json.example" "$REPO_ROOT/interlateral_comms/peers.json"
    echo "    Created. Edit interlateral_comms/peers.json with your team's hostnames."
    echo "    Or run: cd interlateral_comms && ./setup-peers.sh"
elif [ -f "$REPO_ROOT/interlateral_comms/peers.json" ]; then
    echo "  peers.json already exists — skipping"
fi

###############################################################################
# 4. MAKE SCRIPTS EXECUTABLE
###############################################################################
echo "[4/5] Setting script permissions..."

chmod +x "$REPO_ROOT/scripts/"*.sh 2>/dev/null || true
chmod +x "$REPO_ROOT/interlateral_comms_monitor/scripts/"*.sh 2>/dev/null || true

echo "  Scripts are executable"

# Setup tmux config for proper copy/paste (macOS clipboard integration)
if [ -f "$REPO_ROOT/.tmux.conf" ]; then
    if [ ! -f "$HOME/.tmux.conf" ]; then
        echo "  Installing tmux config for clipboard support..."
        cp "$REPO_ROOT/.tmux.conf" "$HOME/.tmux.conf"
        echo "  Created ~/.tmux.conf"
    else
        # Check if our config is already sourced
        if ! grep -q "interlateral" "$HOME/.tmux.conf" 2>/dev/null; then
            echo "  Adding interlateral tmux config to existing ~/.tmux.conf..."
            echo "" >> "$HOME/.tmux.conf"
            echo "# Interlateral additions" >> "$HOME/.tmux.conf"
            cat "$REPO_ROOT/.tmux.conf" >> "$HOME/.tmux.conf"
            echo "  Updated ~/.tmux.conf"
        else
            echo "  tmux config already configured"
        fi
    fi
fi

###############################################################################
# 5. VERIFY SETUP
###############################################################################
echo "[5/5] Verifying setup..."
echo ""

VERIFY_OK=true

# Check interlateral_dna
if [ -d "$REPO_ROOT/interlateral_dna/node_modules" ]; then
    echo "  interlateral_dna:    OK"
else
    echo "  interlateral_dna:    MISSING node_modules"
    VERIFY_OK=false
fi

# Check dashboard server
if [ -d "$REPO_ROOT/interlateral_comms_monitor/server/node_modules" ]; then
    echo "  dashboard/server:    OK"
else
    echo "  dashboard/server:    MISSING node_modules"
    VERIFY_OK=false
fi

# Check dashboard UI
if [ -d "$REPO_ROOT/interlateral_comms_monitor/ui/node_modules" ]; then
    echo "  dashboard/ui:        OK"
else
    echo "  dashboard/ui:        MISSING node_modules"
    VERIFY_OK=false
fi

# Check interlateral_comms
if [ -d "$REPO_ROOT/interlateral_comms/node_modules" ]; then
    echo "  interlateral_comms:  OK"
else
    echo "  interlateral_comms:  MISSING node_modules"
    VERIFY_OK=false
fi

# Check peers.json
if [ -f "$REPO_ROOT/interlateral_comms/peers.json" ]; then
    echo "  peers.json:          OK"
else
    echo "  peers.json:          NOT FOUND (run setup-peers.sh)"
fi

# Check critical scripts exist
if [ -x "$REPO_ROOT/scripts/wake-up.sh" ]; then
    echo "  wake-up.sh:          OK"
else
    echo "  wake-up.sh:          NOT EXECUTABLE"
    VERIFY_OK=false
fi

if [ -x "$REPO_ROOT/scripts/bootstrap-full.sh" ]; then
    echo "  bootstrap-full.sh:   OK"
else
    echo "  bootstrap-full.sh:   NOT EXECUTABLE"
    VERIFY_OK=false
fi

echo ""
echo "============================================"

if [ "$SETUP_OK" = true ] && [ "$VERIFY_OK" = true ]; then
    echo "  FIRST-TIME SETUP COMPLETE"
    echo ""
    echo "  Next steps:"
    echo "    1. Open Antigravity app manually OR run wake-up.sh"
    echo "    2. Run: ./scripts/wake-up.sh"
    echo ""
    echo "  The wake-up.sh script will start everything else."
    echo "============================================"
    exit 0
else
    echo "  SETUP HAD ISSUES"
    echo ""
    echo "  Some components may not work correctly."
    echo "  Check the warnings above and fix manually."
    echo "============================================"
    exit 1
fi
