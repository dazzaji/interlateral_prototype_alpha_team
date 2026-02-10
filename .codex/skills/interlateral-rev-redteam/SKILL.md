---
name: interlateral-rev-redteam
description: Low-noise sprint review + red-team workflow using a single flat file with reviewer/breaker findings, implementer responses, iterative rounds, and carryover routing to PLATFORM_ROADMAP.md.
metadata:
  owner: interlateral
  version: "1.0"
compatibility: Requires multi-agent mesh (CC, Codex, Gemini) and interlateral_dna/ comms scripts
---

# Interlateral Review + Red-Team (Flat File)

## Purpose

Use this skill after sprint implementation to run structured review and adversarial testing with minimal comms noise.

This skill replaces scattered review chatter with one sprint-scoped flat file.

## Required Inputs

- Sprint ID (example: `cluster-1`)
- Project root (example: `/Users/dazzagreenwood/Documents/GitHub/interlateral_platform_alpha`)
- Role mapping:
  - `IMPLEMENTER` (usually CX)
  - `REVIEWER` (usually Gemini)
  - `BREAKER` (usually CC)

## Output Artifact

Create or update exactly one file per sprint:

- `docs/templates/interlateral_rev_redteam.md` (template source), then
- `docs/sprint_reviews/<sprint-id>-review.md` (active sprint record)

## Process

1. IMPLEMENTER creates `docs/sprint_reviews/<sprint-id>-review.md` from template.
2. REVIEWER fills `Reviewer Findings` section with IDs `R1`, `R2`, ...
3. BREAKER fills `Breaker Findings` section with IDs `B1`, `B2`, ...
4. IMPLEMENTER updates `Implementer Responses` section, one response per finding ID, with:
   - status: `fixed` | `deferred` | `rejected`
   - change paths
   - verification command/evidence
5. Round 2:
   - REVIEWER writes `Round 2 Reviewer`
   - BREAKER writes `Round 2 Breaker`
6. Repeat rounds in the same file until consensus.
7. IMPLEMENTER completes `Final Consensus` section.
8. IMPLEMENTER must complete `Carryovers to PLATFORM_ROADMAP.md` before closeout.

## Carryover Rule (Mandatory)

Every unresolved or deferred item MUST be routed back to roadmap tracking with one of:

- `map_to_existing`: `RM-XXX`
- `create_new_rm`: proposed new RM placeholder + reason

No sprint review may close with unresolved items lacking roadmap mapping.

## Comms Discipline

- Use `interlateral_dna/comms.md` only for short pointers/status:
  - "review file ready"
  - "round 2 posted"
  - "consensus complete"
- All substantive findings, responses, and decisions belong in the sprint review file.

## Completion Criteria

Skill is complete when:

- [ ] Flat review file exists for sprint
- [ ] Reviewer findings recorded with IDs
- [ ] Breaker findings recorded with IDs
- [ ] Implementer responses recorded for every finding ID
- [ ] Round 2 reviewer/breaker decision recorded
- [ ] Final consensus recorded (`APPROVE` or `BLOCK`)
- [ ] Carryovers section fully mapped to `PLATFORM_ROADMAP.md`
- [ ] Runbook handoff references the completed review file path

