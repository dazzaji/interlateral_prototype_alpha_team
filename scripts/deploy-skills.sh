#!/bin/bash

# scripts/deploy-skills.sh
# Deploys skills from the canonical .agent/skills/ to tool-specific directories.
# Uses scripts/validate-skills.sh as a pre-flight check.

CANONICAL_DIR=".agent/skills"
TARGET_DIRS=(".claude/skills" ".codex/skills")
# NOTE: AG (Antigravity) is NOT included because:
# - AG has full filesystem access (no sandbox)
# - AG reads from .agent/skills/ directly (the canonical source)
# - No deployment copy needed for AG

echo "🚀 Starting Skill Deployment..."

# 1. Run Validation
echo "running scripts/validate-skills.sh..."
if ! ./scripts/validate-skills.sh; then
  echo "🛑 Deployment aborted: Validation failed."
  exit 1
fi

echo "✅ Validation passed. Syncing skills..."

# 2. Deploy to each target
for target in "${TARGET_DIRS[@]}"; do
  echo "---------------------------------------------------"
  echo "📂 Target: $target/"
  
  # Create target dir if missing
  if [ ! -d "$target" ]; then
    echo "   Creating directory $target..."
    mkdir -p "$target"
  fi
  
  # Sync each skill
  # We iterate over the source directories to avoid copying README/Docs files that aren't skill folders
  for skill_path in "$CANONICAL_DIR"/*/; do
    [ -d "$skill_path" ] || continue
    skill_name=$(basename "$skill_path")
    
    # Construct source and destination paths
    src="$skill_path"
    dest="$target/$skill_name"
    
    echo "   Syncing $skill_name -> $dest"
    
    # Remove existing destination to ensure clean state (idempotency via overwrite)
    rm -rf "$dest"
    
    # Copy new version
    cp -R "$src" "$dest"
  done
done

echo "---------------------------------------------------"
echo "✨ Deployment Complete! Skills are now live in:"
printf "   - %s\n" "${TARGET_DIRS[@]}"
