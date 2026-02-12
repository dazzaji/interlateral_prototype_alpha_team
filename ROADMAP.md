# Interlateral Public Roadmap 

This roadmap is for public template users.

Historical implementation detail, post-mortems, superseded designs, and prior test-era notes are preserved in `historical.md`.

## How to read this roadmap

- `NOW`: highest-value work for public usability and reliability.
- `NEXT`: quality and observability hardening once core UX is stable.
- `LATER`: architectural research and longer-horizon investments.
- `ARCHIVED`: explicitly not planned now, preserved for decision history.

---

## NOW - Public Usability + Reliability

### 0. Cross-Team Comms Security Guardrail (From Combined Reviews)
**Status:** `done` | **Owner:** CC | **Date:** 2026-02-12

**What:** Require authenticated bridge injection by default in cross-team mode: fail or hard-warn in `wake-up.sh --cross-team` when `BRIDGE_TOKEN` is missing, and provide a one-command setup path.

**Acceptance:** `wake-up.sh --cross-team` exits 1 when `BRIDGE_TOKEN` is unset. `bootstrap-full.sh` blocks bridge start as defense-in-depth. `BRIDGE_ALLOW_NO_AUTH=true` provides explicit override. Smoke tests validate all three paths. Conformance checks added (19.3.7–19.3.9, 12.3.1–12.3.4).

**Source context:** `COMBINED_REPORT_and_PROPOSAL-REVIEWS.md` (Alpha+Beta consensus findings and HyperDomo summary).

### 1. Single Project Spec Architecture
**What:** Introduce one project spec format so a user can define a complete multi-agent run (workflow, roles, artifact paths, eval packs) in one file and execute it with one command.

**Why we want it:** This is the main productization step. It removes manual terminal choreography and gives new users a reliable "fill a spec, run once" entrypoint.

### 2. Standardize Frontmatter Keys / Schema
**What:** Define and validate a canonical schema for spec keys (required and optional) so invalid specs fail early with clear errors.

**Why we want it:** A runner without a strict schema becomes brittle and ambiguous. A schema is the contract that makes specs interoperable and maintainable.

### 3. Capability Matrix Documentation
**What:** Publish an explicit matrix of what each agent can/cannot do, including mode-dependent behavior (especially Codex in full-access vs sandboxed modes).

**Why we want it:** Correct role assignment depends on capabilities. Without this, users assign agents to tasks they cannot perform and coordination quality degrades.

### 4. Quad-Agent Mesh Philosophy Documentation
**What:** Add a concise "why this architecture exists" explanation: role separation, model diversity, adversarial review value, and when to use each agent.

**Why we want it:** Public users need rationale, not just commands. This clarifies why the mesh is valuable versus single-agent workflows.

### 5. Clean-Start Template Initializer Script
**What:** Add `scripts/init-template.sh` to reset logs/state and remove development-session residue when someone starts a fresh project.

**Why we want it:** A clean clone should feel new, not inherited. This lowers setup friction and avoids confusion around stale artifacts.

### 6. Public-First Roadmap Rewrite Completion
**What:** Keep ROADMAP focused on forward work only, with clear statuses and acceptance outcomes.

**Why we want it:** Public users should see direction, not internal diary narrative. A clean roadmap improves trust and execution clarity.

### 7. Event Log Rotation in Wake-Up
**What:** Wire `rotate-event-log.sh` into wake-up to keep event logs bounded.

**Why we want it:** Prevents unbounded growth in `.observability` and preserves long-term usability.

### 8. Single Supported Eval Path in Docs
**What:** Standardize docs on one canonical evaluation path (`run-skill-eval.sh` + preflight workflow).

**Why we want it:** Multiple or stale paths create dead ends. One path improves reliability for first-time users.

### 9. Documentation Consistency Pass After Recipe Pipeline Removal
**What:** Remove or update all references to deleted recipe-era scripts and directories.

**Why we want it:** Dead references produce immediate user confusion and break confidence in template quality.

### 10. Script Surface Audit + Deprecation Policy
**What:** Enforce a policy that each script is either supported, clearly deprecated, or removed.

**Why we want it:** Prevents orphaned scripts from accumulating and breaking user expectations.

### 11. Skill Authoring Guide
**What:** Add a practical guide for creating and extending skills in `.agent/skills`.

**Why we want it:** Template value increases when users can create domain-specific workflows without reverse-engineering existing skills.

### 12. Version / Support Policy Matrix
**What:** Document tested CLI/model versions and fallback behavior.

**Why we want it:** Reproducibility requires version clarity; it prevents silent drift and hard-to-debug setup failures.

---

## NEXT - Quality / Observability Hardening

### 13A. Cross-Team Comms Deferred Follow-Ups (Context Preservation)
**What:** Track the remaining non-blocking review items from `COMBINED_REPORT_and_PROPOSAL-REVIEWS.md` after the implemented fixes.

**Deferred items (safe to defer short-term):**
- Optional optimization: cache last-known-good peer resolution to reduce repeated DNS/fallback latency.
- Setup UX: make `setup-peers.sh` auto-populate more fields (currently template + guided edit).
- Reliability: consider async `/inject` acknowledgment model (`202 + job id`) for slow AG delivery edge cases.
- Additional hardening: stronger local file protections for runtime artifacts beyond current `.runtime` move.
- Operational docs: add a compact runbook for team-id collisions and duplicate-role detection recovery.

**Not deferred indefinitely:** auth-by-default for cross-team mode (see NOW item 0).

### 13. Review Preservation Enforcement
**What:** Enforce append-only review behavior (e.g., via skill rules/checks) so revision history is never overwritten.

**Why we want it:** Evaluation quality depends on preserved reviewer/breaker history across rounds.

### 14. Large Trace Chunking / Truncation
**What:** Add size-aware handling before LLM-judge evaluation (chunk/truncate/summarize).

**Why we want it:** Long sessions otherwise fail at evaluation time; this is required for real workloads.

### 15. Telemetry Completeness Epic
**What:** Complete missing telemetry coverage and structure across agents: Codex native harvest, AG structured parsing, AG persistent capture, AG capture research path, and aligned conformance checks.

**Why we want it:** Incomplete telemetry causes misleading eval results and weak post-mortems.

### 16. Coordination Protocol Formalization
**What:** Formalize ACK/NACK, timeout extension, and fallback breaker behavior as one protocol.

**Why we want it:** Predictable failure handling is required for dependable multi-agent operation.

### 17. Skill Updates for Current Communications Reality
**What:** Update skills to reflect current communication paths across modes and agents (including Codex mode-dependent pathways).

**Why we want it:** Skill instructions must match runtime reality or coordination fails in practice.

### 18. Partial-Result Reporting Standard
**What:** Distinguish `PARTIAL` (incomplete data) from `PASS` (complete-quality pass) in eval outputs.

**Why we want it:** Prevents false confidence from scoring incomplete traces as full success.

### 19. Event Persistence Layer Completion
**What:** Finish event schema docs, rotation integration, and query/search affordances.

**Why we want it:** Persistent events are only fully useful when documented, bounded, and searchable.

### 20. Gemini CLI Native OTEL Telemetry
**What:** Enable and document Gemini CLI native OTEL emission in the template.

**Why we want it:** This is a low-friction path to stronger structured observability for a first-class agent.

### 21. Smoke-Test CI for Critical Scripts
**What:** Add minimal CI/static checks for critical scripts and required dependencies.

**Why we want it:** Early regression detection prevents public users from hitting avoidable breakages.

### 22. OTEL Eval Pipeline Dashboard Emission
**What:** Emit OTEL traces from dashboard flows after event-layer stability is complete.

**Why we want it:** Removes manual export overhead and makes evaluation workflows continuous and reliable.

### 23. Observability Helper Script
**What:** Add `scripts/observe-agent.sh <cc|ag|codex|gemini>` for unified quick inspection.

**Why we want it:** Simplifies operator experience and accelerates debugging for new users.

---

## LATER - Research / Future Architecture

### 24. Unix Domain Socket Relay
**What:** Evaluate replacing file-watcher courier transport with UDS transport.

**Why we want it:** Lower communication latency and cleaner transport semantics.

### 25. MCP Server for Interlateral
**What:** Build a central MCP message/control server (`send`, `broadcast`, ledger/event utilities), accounting for AG adapter needs.

**Why we want it:** Moves mesh coordination toward protocol-first interoperability.

### 26. Docker Sandbox Option
**What:** Provide a containerized execution profile for high-autonomy runs.

**Why we want it:** Improves safety posture for users who want strong isolation boundaries.

### 27. UserPromptSubmit Hook for Session Anchoring
**What:** Use hook-based transcript anchoring where stable and version-safe.

**Why we want it:** Reduces heuristic file-selection risk in eval harvest paths.

### 28. Path Canonicalization
**What:** Canonicalize path comparisons for symlink/subdirectory robustness.

**Why we want it:** Hardens eval/harvest behavior across varied local filesystem setups.

### 29. Codex `history.jsonl` as Primary Prompt Source
**What:** Evaluate using simpler history streams for prompt-level extraction where appropriate.

**Why we want it:** Could reduce parser complexity and maintenance burden.

### 30. Schema Drift Monitoring
**What:** Add automated checks for telemetry schema changes across CLI updates.

**Why we want it:** Prevents silent breakage when upstream log structures evolve.

### 31. Fly.io Sprites / Cloud Sandboxing
**What:** Research disposable cloud execution patterns for autonomous workflows.

**Why we want it:** Enables stronger safety and portability for advanced deployments.

### 32. Full Protocol-First Architecture
**What:** Long-term shift to protocol-mediated collaboration over transport-specific wiring.

**Why we want it:** Reduces coupling to tmux/CDP specifics and improves extensibility.

### 33. Multi-Machine / Cloud Deployment
**What:** Support distributed agent placement with secure routed coordination.

**Why we want it:** Expands scalability and operational flexibility beyond one host.

---

## ARCHIVED - Not Doing (for now)

### 34. Alternative Terminal Ecosystem Research
**What:** Prior proposal to replace/augment tmux with alternative terminal stacks.

**Why we are not doing it now:** tmux remains the most portable, battle-tested baseline for this template. Current issues are better addressed through protocol and workflow improvements than terminal replacement.

---

## Status Convention

When this roadmap is executed, each item should track:

- `Status`: `not_started` | `in_progress` | `blocked` | `done`
- `Owner`: primary maintainer
- `Acceptance`: concrete completion criteria

History, decision logs, superseded paths, and migration-era notes remain in `historical.md`.
