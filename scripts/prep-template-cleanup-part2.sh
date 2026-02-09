#!/bin/bash

# scripts/prep-template-cleanup-part2.sh
# Purpose: Final polish based on post-cleanup inspection.
# Removes:
# 1. Dashboard build dependencies (node_modules)
# 2. Observability recordings (.cast)
# 3. User-confirmed project directories
# 4. System junk (.DS_Store)
# 5. Final ledger reset

set -e

echo "🧹 Starting Template Cleanup (Part 2)..."

# 1. Remove Dashboard Dependencies (Nested)
echo "📦 Removing Dashboard node_modules..."
rm -rf interlateral_comms_monitor/ui/node_modules
rm -rf interlateral_comms_monitor/server/node_modules
echo "   Done."

# 2. Remove Recordings
echo "📹 Removing .cast recordings..."
rm -f .observability/casts/*.cast
echo "   Done."

# 3. Remove Project Directories (User Confirmed)
echo "📁 Removing specific project folders..."
rm -rf projects/Interlateral_Post
rm -rf projects/Sandbox
rm -rf projects/Skills_Post
# NOTE: projects/ should be empty (reserved for downstream users)
# System skills are in .agent/skills/ (canonical)
echo "   Done."

# 4. Remove .DS_Store (Recursive)
echo "🧹 Removing .DS_Store files..."
find . -name ".DS_Store" -type f -delete
echo "   Done."

# 5. Final Ledger Reset (Consensus)
echo "📒 Finalizing comms.md header..."
echo "# Interlateral Communications Ledger" > interlateral_dna/comms.md
echo "" >> interlateral_dna/comms.md
echo "[System] Template initialized. Ledger reset on $(date)." >> interlateral_dna/comms.md
echo "   Reset complete."

# 6. Final Validation
echo "🔍 Verifying..."
if [[ -d ".agent/skills" ]]; then
    echo "✅ .agent/skills preserved (canonical skills location)."
else
    echo "❌ CRITICAL: .agent/skills missing!"
    exit 1
fi

echo "✨ Part 2 Cleanup Complete."
