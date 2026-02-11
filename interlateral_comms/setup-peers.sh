#!/bin/bash
# setup-peers.sh - One-time peer setup for cross-machine bridge discovery
#
# Discovers local hostname, validates .local reachability, and creates
# peers.json from the template (peers.json.example).
#
# Usage: cd interlateral_comms && ./setup-peers.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Cross-Machine Bridge: Peer Setup ==="
echo ""

# Step 1: Discover local hostname
LOCAL_HOSTNAME=$(scutil --get LocalHostName 2>/dev/null || hostname -s 2>/dev/null || echo "")
if [ -z "$LOCAL_HOSTNAME" ]; then
    echo "ERROR: Could not determine local hostname."
    echo "  Try: scutil --get LocalHostName"
    exit 1
fi
echo "Detected local hostname: ${LOCAL_HOSTNAME}.local"

# Step 2: Validate .local reachability
echo ""
echo "Testing mDNS resolution..."
if ping -c 1 -W 2 "${LOCAL_HOSTNAME}.local" > /dev/null 2>&1; then
    RESOLVED_IP=$(ping -c 1 -W 2 "${LOCAL_HOSTNAME}.local" 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    echo "  mDNS: ${LOCAL_HOSTNAME}.local resolves to ${RESOLVED_IP:-unknown}"
else
    echo "  WARNING: ${LOCAL_HOSTNAME}.local did NOT resolve via mDNS."
    echo "  This is expected on iPhone hotspots and tethered connections."
    echo "  The fallback_ip field in peers.json will handle this."
fi

# Step 3: Get current WiFi/network IP
CURRENT_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "")
if [ -z "$CURRENT_IP" ]; then
    CURRENT_IP=$(ipconfig getifaddr en1 2>/dev/null || echo "unknown")
fi
echo "  Current IP: ${CURRENT_IP}"

# Step 4: Check template exists
if [ ! -f peers.json.example ]; then
    echo ""
    echo "ERROR: peers.json.example not found in $(pwd)"
    echo "  This file should be checked into the repo."
    exit 1
fi

# Step 5: Check for existing peers.json
if [ -f peers.json ]; then
    echo ""
    echo "peers.json already exists:"
    cat peers.json
    echo ""
    read -r -p "Overwrite? (y/N) " answer
    if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
        echo "Aborted. Existing peers.json preserved."
        exit 0
    fi
fi

# Step 6: Create peers.json from template
cp peers.json.example peers.json
echo ""
echo "Created peers.json from template."

# Step 7: Summary and next steps
echo ""
echo "=========================================="
echo "  SETUP SUMMARY"
echo "=========================================="
echo "  Local hostname:  ${LOCAL_HOSTNAME}.local"
echo "  Current IP:      ${CURRENT_IP}"
echo "  Config file:     $(pwd)/peers.json"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Edit peers.json and set 'self' to your team name (alpha or beta)"
echo "  2. Set your entry's 'host' to: ${LOCAL_HOSTNAME}.local"
echo "  3. Set your entry's 'fallback_ip' to: ${CURRENT_IP}"
echo "  4. Get your peer's hostname (they run: ./setup-peers.sh)"
echo "  5. Fill in your peer's 'host' and 'fallback_ip' in peers.json"
echo ""
echo "NOTE: peers.json is .gitignore'd — it won't be committed."
echo "      Each team maintains their own copy."
