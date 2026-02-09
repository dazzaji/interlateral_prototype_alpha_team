# Observability System: Technical Documentation

> Full technical reference for the CC + AG observability infrastructure.

## Overview

This repo implements a **Lightweight Hybrid Observability** system that captures "what you see" from both Claude Code (CC) and Antigravity (AG) sessions. The design principle is **"Don't Parse, Just Replay"** - we avoid complex regex parsing of terminal output, using visual replay for UI and structured native logs for evals.

## Architecture

The system uses a three-tier approach:

| Tier | Layer | CC Solution | AG Solution |
|------|-------|-------------|-------------|
| 1 | Visual Truth | asciinema recording | asciinema recording |
| 2 | Semantic Truth | Native JSONL (`~/.claude/projects/`) | telemetry.log (repo-local `.gemini/`) |
| 3 | Real-Time Events | Hooks (optional) | Wrapper (optional) |

### Why Three Tiers?

- **Tier 1 (Visual):** Captures exactly what the human sees - progress bars, formatting, cognitive states ("Thinking..."). Replay with `asciinema play`.
- **Tier 2 (Semantic):** Structured data for programmatic analysis - tool calls, token counts, message history. Used by Lake Merritt ingestors.
- **Tier 3 (Real-Time):** Optional hooks for live monitoring. Not required for core observability.

---

## Data Locations

This section documents where all observability data lives. Critical for future agents, Lake Merritt ingestors, and debugging.

### Session Recordings (Visual Truth)

| Item | Location | Format |
|------|----------|--------|
| CC recordings | `.observability/casts/cc-*.cast` | asciicast v2 (JSONL) |
| AG recordings | `.observability/casts/ag-*.cast` | asciicast v2 (JSONL) |
| Archived recordings | `.observability/logs/archive-*.tar.gz` | gzipped tarball |

**Replay command:**
```bash
asciinema play .observability/casts/cc-20260120-143022-12345-a1b2.cast
```

### CC Transcripts (Semantic Truth)

| Item | Location | Notes |
|------|----------|-------|
| JSONL logs | `~/.claude/projects/<encoded>/` | Directory name is URL-encoded path |
| Locator file | `.observability/cc_locator.json` | Points to discovered project path |

**Why a locator file?** CC stores projects in `~/.claude/projects/` using URL-encoded directory names (e.g., `%2FUsers%2Fdazza%2Frepo`). The locator file records the discovered path so ingestors don't have to decode/scan every time.

**Discover CC logs:**
```bash
./scripts/discover-cc-logs.sh --probe    # Run probe to discover
./scripts/discover-cc-logs.sh --show     # Show current locator
```

**Locator file format:**
```json
{
  "discovered_at": "2026-01-20T14:30:00Z",
  "cc_project_path": "/Users/dazza/.claude/projects/%2FUsers%2Fdazza%2Frepo",
  "discovery_method": "probe_with_timestamp_boundary"
}
```

### AG Telemetry (Semantic Truth)

| Item | Location | Notes |
|------|----------|-------|
| Telemetry log | `.gemini/telemetry.log` | Repo-local (not global) |
| Settings | `.gemini/settings.json` | Configures telemetry path |

**Why repo-local?** Template portability. Anyone who clones this repo gets AG telemetry in a predictable location without modifying global config.

**Telemetry contains:**
- `thoughtsTokenCount` - tokens used in extended thinking
- `tokenCount` - total tokens per request
- Tool call metadata
- Timestamps for correlation

**Setup AG telemetry:**
```bash
./scripts/setup-ag-telemetry.sh
```

---

## Scripts Reference

All scripts are in `scripts/` and follow these safety requirements:
- Never block on errors (graceful degradation)
- Use `command <binary>` to prevent recursion
- Preserve argument quoting
- Work on fresh clone without prior setup

### Entrypoints

| Script | Purpose | Usage |
|--------|---------|-------|
| `wake-up.sh` | **Canonical CC entrypoint** | `./scripts/wake-up.sh "prompt"` |
| `logged-ag.sh` | AG with recording | `./scripts/logged-ag.sh "prompt"` |

### Setup Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `setup-observability.sh` | One-command full setup | `./scripts/setup-observability.sh` |
| `setup-ag-telemetry.sh` | Configure AG telemetry only | `./scripts/setup-ag-telemetry.sh` |

### Utility Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `discover-cc-logs.sh` | Find CC JSONL location | `./scripts/discover-cc-logs.sh --probe` |
| `rotate-logs.sh` | Archive old recordings | `./scripts/rotate-logs.sh` |
| `logged-claude.sh` | CC wrapper (called by wake-up.sh) | Internal use |

---

## Setup

### Quick Start (Recommended)

```bash
# Clone the repo
git clone https://github.com/dazzaji/interlateral_prototype_alpha.git
cd interlateral_prototype_alpha

# Run one-command setup
./scripts/setup-observability.sh

# Start CC with observability
./scripts/wake-up.sh "Open README.md. Find the Wake-Up Protocol. Execute it exactly."
```

### Manual Setup

1. **Create directories:**
   ```bash
   mkdir -p .observability/casts .observability/logs .gemini
   ```

2. **Update `.gitignore`** (prevent committing recordings):
   ```bash
   # Add these lines to .gitignore if not already present:
   .observability/casts/*.cast
   .gemini/telemetry.log
   ```

3. **Configure AG telemetry:**
   ```bash
   ./scripts/setup-ag-telemetry.sh
   ```

4. **Install asciinema (optional but recommended):**
   ```bash
   brew install asciinema    # macOS
   pip install asciinema     # any platform
   ```

5. **Verify scripts are executable:**
   ```bash
   chmod +x scripts/*.sh
   ```

---

## Log Rotation

Rotation prevents disk bloat from accumulating recordings.

**Triggers:**
- More than 50 `.cast` files in `.observability/casts/`
- Total size exceeds 500MB

**Behavior:**
- Archives oldest files to `.observability/logs/archive-YYYYMMDD-HHMMSS.tar.gz`
- Keeps newest 25 files
- Deletes archives older than 30 days

**Automatic:** `wake-up.sh` runs rotation on every start (best-effort, never blocks).

**Manual:**
```bash
./scripts/rotate-logs.sh
```

---

## Lake Merritt Integration

Lake Merritt ingestors consume observability data for analysis and evals.

### Ingestor Locations

| Data Type | Ingester |
|-----------|----------|
| asciicast v2 | `corpbot_agent_evals/lake_merritt/core/ingestion/cast_ingester.py` |
| CC JSONL | `corpbot_agent_evals/lake_merritt/core/ingestion/cc_jsonl_ingester.py` |
| AG telemetry | `corpbot_agent_evals/lake_merritt/core/ingestion/ag_telemetry_ingester.py` |

### Data Flow

```
.observability/casts/*.cast  ──→  cast_ingester.py      ──→  Lake Merritt
~/.claude/projects/<enc>/    ──→  cc_jsonl_ingester.py  ──→  Lake Merritt
.gemini/telemetry.log        ──→  ag_telemetry_ingester ──→  Lake Merritt
```

### Timestamp Correlation

All three data sources include timestamps, enabling unified timeline analysis:
- asciicast: relative timestamps from session start
- CC JSONL: ISO 8601 timestamps per message
- AG telemetry: ISO 8601 timestamps per request

---

## Troubleshooting

### "asciinema not found"

Visual capture is optional. CC/AG will still work, just without recordings.

```bash
brew install asciinema    # macOS
pip install asciinema     # Linux/other
```

### "No CC projects found"

Run Claude Code at least once to create project logs:
```bash
claude --version
./scripts/discover-cc-logs.sh --probe
```

### Locator points to wrong project

Delete and re-discover:
```bash
rm .observability/cc_locator.json
./scripts/discover-cc-logs.sh --probe
```

### AG telemetry not appearing

Verify settings exist:
```bash
cat .gemini/settings.json
# Should show: {"telemetryLogPath": ".gemini/telemetry.log"}
```

Re-run setup if needed:
```bash
./scripts/setup-ag-telemetry.sh
```

---

## Graceful Degradation

The system is designed to capture *something* even when components are missing:

| Missing Component | Behavior |
|-------------------|----------|
| asciinema | Warning printed, CC/AG run without visual capture |
| CC locator | Ingester uses fallback discovery |
| AG telemetry config | Setup script creates it on demand |
| Rotation fails | Silently continues (never blocks wake-up) |

---

## Design Decisions

Key decisions from the council review (BC-01 through BC-11):

| Decision | Rationale |
|----------|-----------|
| Canonical `wake-up.sh` entrypoint | Aliases fail on fresh clone |
| Repo-local AG telemetry (`.gemini/`) | Template portability |
| CC locator + discovery fallback | Handles encoded directory names |
| Force asciicast v2 | Simpler ingester, widely supported |
| Split unit/integration tests | Reduce CI flakiness |
| Best-effort AG connection | Don't block wake-up |

For full decision log, see `dev_plan/dev_plan.md` section "Decisions Made".

---

## References

- [asciinema documentation](https://asciinema.org/docs)
- [Claude Code documentation](https://docs.anthropic.com/claude-code)
- Dev plan: `dev_plan/dev_plan.md`
- Main README: `README.md` (Part 2 for agents)
- Agent quick reference: `CLAUDE.md`
