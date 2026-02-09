#!/bin/bash

# scripts/prep-template-cleanup.sh
# Purpose: Prepare this repo to be a Github Template by removing ephemeral/fat files.
# Safeguards: 
#   - Safety check for CWD
#   - Git tag snapshot
#   - Explicit paths (no broad rm -rf in dangerous zones)
#   - Check-before-delete logic

set -e # Exit on error

echo "🧹 Starting Template Preparation Cleanup..."

# 0. Safety Check
if [[ ! -f "interlateral_dna/ag.js" ]]; then
  echo "❌ Error: Not in the root of the interlateral repo. Aborting."
  exit 1
fi

echo "✅ Root directory confirmed."

# 1. Snapshot State (Git Tag)
echo "📸 Creating safety snapshot (git tag 'pre-template-cleanup')..."
# Non-interactive force update per Codex suggestion
git tag -f pre-template-cleanup
echo "   Tag 'pre-template-cleanup' created/updated."

# 2. Delete Safe Junk (Explicit Paths)
echo "🗑️  Deleting runtime artifacts..."

# Telemetry Logs (Explicit)
rm -f interlateral_dna/cc_telemetry.log
rm -f interlateral_dna/cc_telemetry_stuck_session.log
rm -f interlateral_dna/codex_telemetry.log
rm -f interlateral_dna/ag_log.md.bak
rm -f interlateral_dna/comms.md.bak

# Node Modules (Explicit)
# Using rm -rf only on this specific directory
if [ -d "interlateral_dna/node_modules" ]; then
    rm -rf interlateral_dna/node_modules
    echo "   Removed interlateral_dna/node_modules"
fi

# Root Lockfile (Explicit, do not touch interlateral_dna/)
if [ -f "package-lock.json" ]; then
    rm package-lock.json
    echo "   Removed root package-lock.json"
fi

# Archive (Accepted Risk)
if [ -d "docs/projects-and-devplan-archive" ]; then
    rm -rf docs/projects-and-devplan-archive
    echo "   Removed docs/projects-and-devplan-archive"
fi
if [ -d "docs/projects" ]; then
    rm -rf docs/projects
    echo "   Removed docs/projects"
fi

# 3. Truncate Path Dependencies
echo "✂️  Truncating path dependencies..."

# comms.md
echo "# Interlateral Communications Ledger" > interlateral_dna/comms.md
echo "" >> interlateral_dna/comms.md
echo "[System] Template initialized. Ledger reset on $(date)." >> interlateral_dna/comms.md
echo "   Truncated interlateral_dna/comms.md"

# ag_log.md
echo "# Antigravity Log" > interlateral_dna/ag_log.md
echo "   Truncated interlateral_dna/ag_log.md"

# 4. Final Validation
echo "🔍 Verifying critical files..."

FAILED=0

# DNA Lockfile
if [[ ! -f "interlateral_dna/package-lock.json" ]]; then
    echo "❌ CRITICAL ERROR: interlateral_dna/package-lock.json is MISSING!"
    FAILED=1
else
    echo "✅ interlateral_dna/package-lock.json preserved."
fi

# Injection Scripts
for script in ag.js cc.js codex.js; do
    if [[ ! -f "interlateral_dna/$script" ]]; then
        echo "❌ CRITICAL ERROR: interlateral_dna/$script is MISSING!"
        FAILED=1
    fi
done

if [[ $FAILED -eq 0 ]]; then
    echo "✨ Template Prep Complete! Repo is clean."
    echo "   (To undo: git reset --hard pre-template-cleanup)"
else
    echo "🛑 Warnings encountered during validation. Check above."
    exit 1
fi
