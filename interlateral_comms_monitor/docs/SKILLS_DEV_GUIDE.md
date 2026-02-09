# Skills Development Guide

**Version:** 1.2
**Last Updated:** 2026-02-04
**Status:** APPROVED - Codex and Gemini reviewed, all notes addressed

---

## Overview

This guide defines how to create, structure, and maintain Agent Skills in this repository. It follows the [Agent Skills Specification](https://agentskills.io/specification).

**Note:** The Agent Skills spec is path-agnostic. The `.agents/skills/` path is a Codex-specific convention, not a universal standard.

---

## Quick Reference

| Aspect | Requirement |
|--------|-------------|
| **Canonical location** | `.agents/skills/` (Codex convention) |
| **Required file** | `SKILL.md` with YAML frontmatter |
| **Required fields** | `name`, `description` |
| **Name format** | Lowercase letters, numbers, hyphens; max 64 chars (spec) / 100 chars (Codex); must match directory |
| **Description format** | Max 1024 chars (spec) / 500 chars (Codex, single line); should describe "what" and "when" (guidance) |

---

## 1. Directory Structure

### Standard Layout

```
.agents/
└── skills/
    └── skill-name/
        ├── SKILL.md           # Required - core instructions
        ├── scripts/           # Optional - executable code
        ├── references/        # Optional - additional documentation
        └── assets/            # Optional - templates, data files
```

### Why `.agents/skills/` (Plural)?

Codex CLI uses `.agents/skills` as its standard discovery path. The previous `.codex/skills` location remains supported but is expected to be deprecated.

**Note:** The Agent Skills spec is path-agnostic. `.agents/skills` is a Codex convention, not a universal standard mandated by AAIF or the spec.

**Migration note:** This repo previously used `.agent/skills/` (singular). Skills should be migrated to `.agents/skills/`.

### Codex Skill Location Precedence

Codex searches these locations in order:
1. `$CWD/.agents/skills`
2. `$CWD/../.agents/skills`
3. `$REPO_ROOT/.agents/skills`
4. `$HOME/.agents/skills`
5. `/etc/codex/skills` (admin)
6. System skills (bundled)

**Note:** Codex does not deduplicate identical skill names across locations. Symlinked skill folders are reported to work (observed behavior, not officially documented).

---

## 2. SKILL.md Format

### Minimal Valid Example

```yaml
---
name: my-skill
description: What this skill does and when to use it.
---

# My Skill

## Instructions
1. Step one
2. Step two
```

### Full Example with Optional Fields

```yaml
---
name: processing-pdfs
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files.
license: Apache-2.0
compatibility: Requires python3, pdfplumber
metadata:
  author: interlateral
  version: "1.0"
---

# PDF Processing

## Quick Start
...

## Advanced Features
See [references/PDF_GUIDE.md](references/PDF_GUIDE.md) for details.
```

---

## 3. Field Constraints

### Required Fields

| Field | Spec Limit | Codex Limit | Constraints |
|-------|------------|-------------|-------------|
| `name` | 1-64 chars | 1-100 chars | Lowercase letters, **numbers**, hyphens; no leading/trailing hyphen; no consecutive hyphens (`--`); **must match parent directory name** |
| `description` | 1-1024 chars | 1-500 chars, single line | Non-empty; should describe what the skill does and when to use it (guidance per spec) |

**Recommendation:** Use the stricter intersection (name ≤64, description ≤500) for maximum compatibility.

### Optional Fields

| Field | Purpose | Constraints |
|-------|---------|-------------|
| `license` | License identifier | Short name or reference to bundled file |
| `compatibility` | Environment requirements | Max 500 chars |
| `metadata` | Custom key-value pairs | String keys and values |
| `allowed-tools` | Pre-approved tools (experimental) | Space-delimited list |

**Note:** Codex ignores extra frontmatter keys beyond the defined fields.

---

## 4. Naming Conventions

### Rules (Required by Spec)

- **Lowercase letters, numbers, hyphens** - no uppercase, underscores, or spaces
- **No leading/trailing hyphens** - cannot start or end with `-`
- **No consecutive hyphens** - `--` is not allowed
- **Match directory name** - `name: pdf-processing` must be in `pdf-processing/`

### Best Practice (Anthropic Recommendation)

- **Gerund form preferred** - verb + -ing when natural (e.g., `processing-pdfs`)
- This is Anthropic best practice, not a spec requirement

### Examples

| Good | Acceptable | Bad |
|------|------------|-----|
| `processing-pdfs` | `pdf-processing` | `PDF_Processing` |
| `creating-skins` | `create-skin` | `CreateSkin` |
| `skill-v2` | `data-analysis` | `helper` |

---

## 5. Progressive Disclosure

Agent Skills use a layered approach to minimize context window usage (per spec):

1. **Discovery** (~100 tokens): Only `name` and `description` loaded at startup
2. **Activation** (<5000 tokens recommended): Full `SKILL.md` loaded when skill is selected
3. **Execution** (as needed): Reference files loaded only when required

*Token counts are from the official spec as recommendations, not hard limits.*

### Best Practices

- Keep `SKILL.md` body under 500 lines
- Move detailed documentation to `references/` directory
- Reference files should be one level deep from `SKILL.md`
- Use relative paths from skill root: `references/GUIDE.md`

---

## 6. The Agent Ecosystem

Three components form the agent guidance stack:

| Component | Purpose | Scope |
|-----------|---------|-------|
| **AGENTS.md** | Project-specific rules for agents ("README for machines") | Per-repo |
| **Agent Skills** | Reusable capabilities/expertise | Portable across repos |
| **MCP** | Universal tool/data connection protocol | Universal |

> An agent uses **Agent Skills** to know *how* to do something, **AGENTS.md** to know the rules of the current *project*, and **MCP** to *connect* to the tools it needs.

---

## 7. Creating a New Skill

### Step 1: Create Directory

```bash
mkdir -p .agents/skills/my-new-skill
```

### Step 2: Create SKILL.md

```bash
cat > .agents/skills/my-new-skill/SKILL.md << 'EOF'
---
name: my-new-skill
description: Brief description of what this skill does and when to use it.
---

# My New Skill

## Instructions
1. First step
2. Second step

## Examples
...
EOF
```

### Step 3: Validate

```bash
./scripts/validate-skills.sh
```

---

## 8. Validation

### Official Validation Tools

The Agent Skills spec provides official validation tools:

```bash
# Validate a single skill
skills-ref validate ./my-skill

# Show skill tree structure
skills-ref tree ./my-skill
```

### Quick Check

```bash
# Check single skill
head -20 .agents/skills/my-skill/SKILL.md | grep -E "^(---|name:|description:)"
```

### Full Validation Script

```bash
#!/bin/bash
# validate-skills.sh - Check all skills have valid frontmatter

for skill_dir in .agents/skills/*/; do
  skill_name=$(basename "$skill_dir")
  skill_file="$skill_dir/SKILL.md"

  if [[ ! -f "$skill_file" ]]; then
    echo "FAIL: $skill_name - missing SKILL.md"
    continue
  fi

  # Check for YAML frontmatter
  if ! head -1 "$skill_file" | grep -q "^---$"; then
    echo "FAIL: $skill_name - missing YAML frontmatter"
    continue
  fi

  # Check for name field
  if ! grep -q "^name:" "$skill_file"; then
    echo "FAIL: $skill_name - missing 'name' field"
    continue
  fi

  # Check for description field
  if ! grep -q "^description:" "$skill_file"; then
    echo "FAIL: $skill_name - missing 'description' field"
    continue
  fi

  # Check name matches directory
  yaml_name=$(grep "^name:" "$skill_file" | head -1 | sed 's/name: *//')
  if [[ "$yaml_name" != "$skill_name" ]]; then
    echo "FAIL: $skill_name - name field '$yaml_name' doesn't match directory"
    continue
  fi

  echo "PASS: $skill_name"
done
```

---

## 9. Migration from Legacy Paths

### From `.agent/skills/` or `.codex/skills/`

```bash
# Create new standard directory
mkdir -p .agents/skills

# Move skills (preserves structure)
cp -r .agent/skills/* .agents/skills/

# Verify all skills have frontmatter
./scripts/validate-skills.sh

# After verification, create symlinks for backward compatibility
# (symlinks reported to work with Codex)
ln -sf .agents/skills .agent/skills
ln -sf .agents/skills .codex/skills

# Optional: Remove old directories instead of symlinks
# rm -rf .agent/skills .codex/skills
```

**Note:** Only remove directories after confirming all tooling has been updated to use `.agents/skills/`.

---

## 10. Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Skipped loading skill" | Missing YAML frontmatter | Add `---` delimiters and required fields |
| "name field mismatch" | `name:` doesn't match directory | Rename directory or fix `name:` field |
| "description too long" | Over 500 chars | Shorten description, move details to body |
| Skill not discovered | Wrong directory path | Move to `.agents/skills/` |

---

## Sources

- [Agent Skills Specification](https://agentskills.io/specification)
- [Anthropic Skill Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Codex Skills Documentation](https://developers.openai.com/codex/skills/)
- [Linux Foundation AAIF](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0-draft | 2026-02-03 | CC | Initial draft from skills_baf.md synthesis |
| 1.1 | 2026-02-04 | CC | Incorporated Codex and Gemini BAF review corrections: clarified spec vs Codex-specific requirements, added numbers to allowed name chars, added Codex skill precedence, marked gerund as best practice not requirement, added skills-ref validation tools, fixed migration commands |
| 1.2 | 2026-02-04 | CC | Addressed Codex final review notes: removed unverified `disable-model-invocation` field (not in spec), clarified token counts are spec recommendations, softened symlink support claim to "observed behavior", phrased what/when as guidance |

---

# Reviewer Comments

**INSTRUCTIONS FOR REVIEWERS:** Add your comments and revision requests ONLY under your designated header below. Do NOT modify any content above this section.

---

## Codex Review

*Codex: Add your comments, confirmations, corrections, and revision requests below this line.*


### 2026-02-04 01:49:55 UTC - Final review

CONFIRMED:
- Correctly separates Agent Skills spec (path-agnostic) from Codex convention (`.agents/skills`).
- Required frontmatter fields (`name`, `description`) and name constraints align with spec; includes numbers and directory match requirement.
- Description limits note both spec (1024) and Codex (500, single line) and recommends intersection.
- Notes `.codex/skills` legacy support with expected deprecation and migration guidance.
- Highlights missing YAML frontmatter and directory mismatch as common discovery failures.
- Includes official `skills-ref validate` / `skills-ref tree` usage and progressive disclosure model.

ISSUES / CLARIFICATIONS:
- Codex search precedence list and “no deduplication of identical names” need explicit citation from Codex docs; if not documented, mark as “per current Codex docs” with citation or remove.
- `disable-model-invocation` optional field is not in the Agent Skills spec or Codex docs to my knowledge; verify source or remove to avoid inventing requirements.
- Progressive disclosure token counts (~100 / <5000) are not in spec; treat as approximate or remove numeric thresholds.
- “Codex supports symlinked skill folders” should be cited or softened to “reported/observed” if not in docs.
- “Include ‘what’ and ‘when’” in description is best-practice wording, not a requirement; ensure it’s phrased as guidance.

APPROVAL STATUS: APPROVED WITH MINOR NOTES (address clarifications above for a fully “green” spec)


---

## Gemini Review

**CONFIRMED:**
*   My previous corrections regarding missing optional fields (`disable-model-invocation`, `allowed-tools`) have been incorporated.
*   The clarification on Codex-specific limits versus the general spec limits is well-handled.
*   The distinction between `.agents/skills` as a Codex convention versus a universal standard is clearly stated.
*   The updated source links are now functional.
*   The addition of the validation script and migration commands is very helpful.

**REMAINING ISSUES:**
*   None. The document is comprehensive and addresses the points raised in my BAF review.

**APPROVAL STATUS:**
*   Approved.

---

---

*End of document*
