# Observability System Walkthrough

**Status:** v3.1 (Merged to Upstream)
**Date:** 2026-01-20

## 1. Additions to Upstream Template

We have added a **Lightweight Hybrid Observability System** that captures the "human view" of agent interactions. This includes:

*   **Canonical Entrypoint ([scripts/wake-up.sh](file:///path/to/repo/scripts/wake-up.sh)):** A single script to start the session with observability guaranteed.
*   **Safety Wrappers (`scripts/logged-*.sh`):** Scripts that wrap `claude` and `antigravity` commands to capture terminal output via `asciinema` (v2 format) without recursion loops.
*   **Native Log Discovery:** A locator pattern (`.observability/cc_locator.json`) to find Claude Code’s typically hidden JSONL entry logs.
*   **Repo-Local Telemetry:** A configuration (`.gemini/settings.json`) that forces Antigravity to write logs to the repository instead of system-wide paths.
*   **Rotation System ([scripts/rotate-logs.sh](file:///path/to/repo/scripts/rotate-logs.sh)):** Automatic management of recording files to prevent disk bloat.

## 2. How It Is Different

| Feature | Standard Upstream | With Observability System |
| :--- | :--- | :--- |
| **Start Command** | `claude ...` | `./scripts/wake-up.sh ...` |
| **Terminal View** | Lost after session closes | Saved as `.cast` file (replayable) |
| **CC Logs** | Hidden in `~/.claude/` | Discovered & linked in `.observability/` |
| **AG Logs** | System-wide location | Repo-local `.gemini/telemetry.log` |
| **Reliability** | Depends on user aliases | Guaranteed by script entrypoint |

## 3. How It Works & Usage

**The Logic:** "Don't Parse, Just Replay."
Instead of trying to parse complex terminal text in real-time, we record the raw terminal stream (`asciicast`) for visual truth and collect structured logs for semantic truth.

**How to Use:**
Simply use the [wake-up.sh](file:///path/to/repo/scripts/wake-up.sh) script instead of running `claude` directly.

```bash
./scripts/wake-up.sh " Your prompt here "
```

This script automatically:
1.  Sets up the `.observability` directory.
2.  Rotates old logs if needed.
3.  Launches Claude Code wrapped in `asciinema` recording.

## 4. Key Use Cases & Workflows

### A. The "Black Box" Review
*   **Use Case:** An agent fails a complex task overnight.
*   **Workflow:**
    1.  Open `.observability/casts/`
    2.  Play the latest recording: `asciinema play .observability/casts/cc-LATEST.cast`
    3.  Watch exactly what the agent saw and typed, including "thinking" states and transient errors.

### B. Eval Set Generation
*   **Use Case:** Creating a dataset of "correct" tool usages.
*   **Workflow:**
    1.  Run a session via [wake-up.sh](file:///path/to/repo/scripts/wake-up.sh).
    2.  Ingest the discovered `cc_jsonl` logs (using `lake_merritt/ingestors/cc_jsonl_ingester.py`).
    3.  Extract structured tool inputs/outputs for your eval set.

## 5. Where to Look Manually

After a session, check these paths in your repository:

1.  **Terminal Validated:** `.observability/casts/*.cast`
    *   *What:* The visual recording.
    *   *View:* `asciinema play <file>`
2.  **Structuring Thinking:** `.gemini/telemetry.log`
    *   *What:* Antigravity's internal events, specifically `thoughtsTokenCount`.
    *   *View:* `cat .gemini/telemetry.log`
3.  **Chat Transcript:** `~/.claude/projects/<encoded>/...`
    *   *Find it:* Read `.observability/cc_locator.json `
    *   *Important:* Run [./scripts/discover-cc-logs.sh](file:///path/to/repo/scripts/discover-cc-logs.sh) to generate this locator file if it's missing.
    *   *View:* `cat $(jq -r .cc_project_path .observability/cc_locator.json)/*.jsonl`

## 6. Managing Log Rotation (Archiving)

By default, [rotate-logs.sh](file:///path/to/repo/scripts/rotate-logs.sh) runs on every wake-up. It keeps the last **50 sessions** or **500MB** of data. Old sessions are archived to `.observability/logs/archive-*.tar.gz`.

**To Disable Deletion (For Archival/Legal Hold):**
You must manually comment out the rotation line in [scripts/wake-up.sh](file:///path/to/repo/scripts/wake-up.sh):

```bash
# "$REPO_ROOT/scripts/rotate-logs.sh" 2>/dev/null || true
```

Alternatively, you can edit [scripts/rotate-logs.sh](file:///path/to/repo/scripts/rotate-logs.sh) to increase the retention thresholds (`MAX_FILES` or `MAX_SIZE_MB`).

## 7. Real-Time UI Monitoring

To see what the agents see in real-time:

*   **Claude Code:** Watch the terminal window where you ran [wake-up.sh](file:///path/to/repo/scripts/wake-up.sh). The wrapper is transparent, so you see standard output live.
*   **Antigravity:**
    1.  Open the Antigravity app.
    2.  Open the **Agent Manager** panel (right sidebar).
    3.  You will see messages appear as Claude Code injects them and Antigravity responds.
*   **Coordination:** `tail -f interlateral_dna/comms.md` to see the live chat between Claude Code and Antigravity.

## 8. Other Key Features

*   **Cross-Platform:** Works on macOS and Linux (and Windows via WSL).
*   **Graceful Degradation:** If `asciinema` is missing, the system warns you but **proceeds anyway**. It captures what it can (logs) without blocking the run.
*   **Strict Mode:** All scripts run with `set -euo pipefail`, ensuring that if a setup step fails (like permission errors), the script stops immediately to prevent undefined states.

## 9. Quick Command Reference

| Action | Command |
| :--- | :--- |
| **Wake Up (Start)** | `./scripts/wake-up.sh "Start task..."` |
| **Watch Replay** | `asciinema play .observability/casts/LATEST.cast` |
| **Watch Live Log** | `tail -f interlateral_dna/comms.md` |
| **Find CC Logs** | [./scripts/discover-cc-logs.sh](file:///path/to/repo/scripts/discover-cc-logs.sh) |
| **View AG Telemetry** | `cat .gemini/telemetry.log` |
