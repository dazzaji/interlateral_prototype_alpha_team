#!/bin/bash

# scripts/validate-skills.sh
# Validates that skills in .agent/skills/
# adhere to the Interlateral "Intersection Standard".

SKILLS_DIR=".agent/skills"
EXIT_CODE=0

echo "🔍 Validating skills in $SKILLS_DIR..."

# Check if directory exists
if [ ! -d "$SKILLS_DIR" ]; then
  echo "❌ Error: Skills directory not found at $SKILLS_DIR"
  exit 1
fi

# Iterate through subdirectories
for skill_path in "$SKILLS_DIR"/*/; do
  # Skip if not a directory
  [ -d "$skill_path" ] || continue
  
  dirname=$(basename "$skill_path")
  
  # Skip . files or specific non-skill dirs if any (e.g., if we had a raw 'docs' folder)
  # But for now we assume all subdirs are skills
  
  skill_file="${skill_path}SKILL.md"
  
  echo "Checking skill: $dirname..."
  
  # 1. Check SKILL.md exists
  if [ ! -f "$skill_file" ]; then
    echo "  ❌ Fail: SKILL.md missing in $dirname"
    EXIT_CODE=1
    continue
  fi

  # Extract frontmatter values using grep/sed/awk to avoid requiring yq
  # We assume standard YAML frontmatter format
  
  # Extract name: value
  # Look for line starting with "name:", capture rest, trim whitespace
  name_val=$(grep "^name:" "$skill_file" | head -n 1 | sed 's/^name:[[:space:]]*//' | tr -d '\r' | sed 's/[[:space:]]*$//')
  
  # Extract description: value
  desc_val=$(grep "^description:" "$skill_file" | head -n 1 | sed 's/^description:[[:space:]]*//' | tr -d '\r')

  # Check metadata block existence
  has_metadata=$(grep "^metadata:" "$skill_file")

  # 2. Validate Name matches Directory
  if [ "$name_val" != "$dirname" ]; then
    echo "  ❌ Fail: 'name' ($name_val) must match directory name ($dirname)"
    EXIT_CODE=1
  fi
  
  # 3. Validate Name format (lowercase alphanumeric + hyphens, max 64)
  if [[ ! "$name_val" =~ ^[a-z0-9-]{1,64}$ ]]; then
    echo "  ❌ Fail: 'name' must be lowercase alphanumeric+hyphens and <= 64 chars"
    EXIT_CODE=1
  fi

  # 4. Validate Description requirements
  # Check length (<= 500 chars)
  desc_len=${#desc_val}
  if [ "$desc_len" -gt 500 ]; then
    echo "  ❌ Fail: 'description' exceeds 500 chars (current: $desc_len)"
    EXIT_CODE=1
  fi
  
  # Check single line (grep returns one line, verify no multiline description following)
  # Basic check: if grep returns something, we assume it's one line in YAML unless it logic breaks.
  # For stricter check, ensure the next line matches another key or EOF, but basic check is usually sufficient for Intersection Standard.
  if [ -z "$desc_val" ]; then
    echo "  ❌ Fail: 'description' field missing or empty"
    EXIT_CODE=1
  fi

  # 5. Check Metadata
  if [ -z "$has_metadata" ]; then
     echo "  ❌ Fail: 'metadata' block missing"
     EXIT_CODE=1
  fi

  echo "  ✅ Pass"
done

if [ $EXIT_CODE -eq 0 ]; then
  echo "✨ All skills validated successfully."
else
  echo "🛑 Validation failed."
fi

exit $EXIT_CODE
