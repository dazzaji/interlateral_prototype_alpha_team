# Interlateral Multi-Agent Mesh Template  

___

## Lightning Start (CLI-only, no Antigravity)
Use this when Antigravity is unavailable or you want CLI-only mode (CC + Codex + Gemini):

```bash
./scripts/wake-up-no-ag.sh --dangerously-skip-permissions "Read CLAUDE.md. Execute the Wake-Up Protocol. Seek ACK from Codex and Gemini. Once all ACKed, ALL THREE agents ask: What is our assignment?"
```
___

> **Template repository.** Use it to start new projects where Claude Code (Anthropic), Antigravity (Google Gemini), Codex (OpenAI), and Gemini CLI (Google) collaborate as a multi-agent mesh for long-horizon autonomous work. Supports both **4-agent mode** (CC + AG + Codex + Gemini) and **3-agent CLI mode** (CC + Codex + Gemini).

## Getting Started
1. Clone the repo
2. Run `./scripts/first-time-setup.sh`
3. (Optional) Copy `.env.example` → `.env` and set keys if you plan to run evals
4. Run `./scripts/wake-up.sh "Read CLAUDE.md. Execute the Wake-Up Protocol."`
5. Confirm ACKs from all agents

## System Requirements
- Node.js 18+
- npm
- tmux
- python3
- Antigravity app (required for GUI mode)
- Claude Code CLI, Codex CLI, Gemini CLI

## Auth / OAuth Setup (All Four Agents)
- **Claude Code:** run `claude` once and complete the browser login
- **Codex:** run `codex login` and choose ChatGPT or API key auth (see `docs/codex_info/`)
- **Gemini CLI:** run `gcloud auth login` or set an API key (see `docs/gemini-cli_info/`)
- **Antigravity:** launch the app and sign in (Google account)

## Install Dependencies
Recommended:
```bash
./scripts/first-time-setup.sh
```
Manual (if needed):
```bash
(cd interlateral_dna && npm install)
(cd interlateral_comms_monitor/server && npm install)
(cd interlateral_comms_monitor/ui && npm install)
```

## Lightning Start (Full Mesh)

```bash
./scripts/wake-up.sh "Read CLAUDE.md. Execute the Wake-Up Protocol."
```

For full autonomy with all four agents:
```bash
./scripts/wake-up.sh --dangerously-skip-permissions "Read CLAUDE.md. Execute the Wake-Up Protocol. Seek ACK from AG, Codex, and Gemini. Once all ACKed, ALL FOUR agents ask: What is our assignment?"
```

For custom tasks:
```bash
./scripts/wake-up.sh --dangerously-skip-permissions "Your prompt here"
```

Note: `wake-up.sh` and `wake-up-no-ag.sh` default to `--dangerously-skip-permissions` to support full autonomy. If you want permission prompts, launch `claude` directly without the wake-up scripts.
## Lightning Skills (Design Patterns for Multi-Agent Work)

Use **design pattern skills** to structure how agents collaborate. Skills define ROLES; your prompt assigns AGENTS.

**Skill Locations:**
| Location | Purpose |
|----------|---------|
| `.agent/skills/` | Canonical source (edit here) |
| `.claude/skills/` | CC's copy (auto-deployed) |
| `.codex/skills/` | CX's copy (auto-deployed) |
| `SKILLS.md` | Index for discoverability |

**First-time setup:** Run `./scripts/deploy-skills.sh` once to copy skills to agent folders.

### The Six Patterns

| Skill | Weight | What It Does |
|-------|--------|--------------|
| `peer-collaboration` | Light | Two agents co-create via turn-based iteration |
| `negotiation` | Medium | Competing priorities reach consensus through trade-offs |
| `hierarchical` | Medium | Boss delegates, workers execute, boss approves |
| `democratic` | Medium | Equal voice, majority vote on decisions |
| `competition` | Heavy | Parallel work, judges evaluate, winner selected |
| `constitutional` | Heavy | Federated co-authorship with formal voting |

### Quick Start (Prompt-First)

Skills are pre-deployed. Just prompt:

```
Use peer-collaboration to write a product FAQ.
PEER_A=CC, PEER_B=CX.
Output: projects/faq/deliverable.md
```

More examples:
```
Use negotiation for API design. CC=Speed, CX=Security, GM=Simplicity.
Use hierarchical to draft a blog post. BOSS=CC, WORKER=CX, WORKER=GM.
Use democratic to choose a team name. Members: CC, CX, GM. FACILITATOR=CC.
Use competition to write a tagline. Competitors: CX, GM. Judge: CC.
Use constitutional for a charter. LEAD=CC. Sections: Goals, Roles, Process.
```

### Providing Project Context (work.md)

For complex projects, create a `work.md` file:

```markdown
# Project: API Documentation

## Goal
Write developer docs for the PaymentsAPI.

## Context
- API spec: see api-spec.json in this folder
- Audience: developers integrating payments

## Deliverable
A complete API reference with examples.
```

Then prompt:
```
Use peer-collaboration. Work: projects/my-api/work.md
PEER_A=CC, PEER_B=CX. Output: projects/my-api/docs.md
```

### Custom Patterns (publication-pipeline Example)

Create your own patterns in `.agent/skills/`. See the `publication-pipeline` skill for a working example:

- **Skill:** `.agent/skills/publication-pipeline/SKILL.md` - Three-round editorial review
- **Work item:** `projects/mesh-hello-world/README.md` - Minimal first-run example

```
Use publication-pipeline to draft a short mesh kickoff note.
Read work.md first: projects/mesh-hello-world/README.md
DRAFTER=CC, REVIEWER=CX, REDTEAM=GM, ANALYST=CX, EDITOR=GM, PUBLISHER=CC.
Output: projects/mesh-hello-world/output.md
```

**Full example:** `projects/mesh-hello-world/README.md`

### Termination Signals

All skills use standard signals:
- `[DONE]` - Work complete
- `[RATIFY]` / `[BLOCK]` - Constitutional voting
- `[WINNER]` - Competition result
- `[INCOMPLETE]` - Max turns reached

---

## Lightning Start with Evals for Humans

When you want to capture telemetry for quality evaluations (LLM-as-judge scoring), use the preflight wrapper instead.

**Prerequisites for Evals:**
- `OPENAI_API_KEY` set in `.env` (required for LLM-as-judge scoring)
- Python dependencies installed: `pip install -r corpbot_agent_evals/lake_merritt/requirements.txt`
- See [Skills + Design Patterns](#skills--design-patterns-quick-start) section for full setup

### Preflight (One Command)

Recommended (inline wake-up prompt so ACKs happen automatically):
```bash
./scripts/preflight-wakeup.sh SESSION_NAME --dangerously-skip-permissions "Open README.md. Find the Wake-Up Protocol. Execute it exactly. Get ACK from AG and Codex and all THREE OF YOU ASK ME WHAT THE ASSIGNMENT IS."
```

Option B (no prompt): launch CC first, then paste the wake-up prompt manually.
```bash
./scripts/preflight-wakeup.sh SESSION_NAME --dangerously-skip-permissions
```

This single command:
1. Starts the dashboard (populates `events.jsonl`)
2. Starts session capture (records byte offsets for deterministic telemetry)
3. Launches Claude Code with wake-up protocol

### Examples

**Test #3 - Create a minimal dashboard skin:**
```bash
./scripts/preflight-wakeup.sh test3-minimal-skin --dangerously-skip-permissions "Open README.md. Find the Wake-Up Protocol. Execute it exactly. Get ACK from AG and Codex and all THREE OF YOU ASK ME WHAT THE ASSIGNMENT IS."
```
Then paste the prompt when all three agents ask for assignment:
```
Run the dev-collaboration skill. Your role is DRAFTER.
AG is REVIEWER, Codex is BREAKER.

TASK: Create a new dashboard skin called "minimal" for the interlateral_comms_monitor.

Requirements:
1. Clean, minimal design with maximum whitespace
2. Single-column layout
3. Monochrome color scheme (black/white/gray only)
4. Show only: timestamp, agent, message content
5. No icons, no badges, no decorations

Deliverable: interlateral_comms_monitor/ui/src/components/skins/MinimalSkin.tsx

Get reviews from AG and CX. Address all feedback. Obtain APPROVE from both before marking complete.
```

**Test #4 - Create a new eval pack:**
```bash
./scripts/preflight-wakeup.sh test4-response-latency --dangerously-skip-permissions "Open README.md. Find the Wake-Up Protocol. Execute it exactly. Get ACK from AG and Codex and all THREE OF YOU ASK ME WHAT THE ASSIGNMENT IS."
```

### Prompt Template (Swap Skill/Project Quickly)

Copy this template and replace the placeholders:
```
Run the dev-collaboration skill. Your role is DRAFTER.
AG is REVIEWER, Codex is BREAKER.

TASK: <describe the task>

Requirements:
1. <requirement 1>
2. <requirement 2>
3. <requirement 3>

Deliverable: <path/to/file.ext>

Get reviews from AG and CX. Address all feedback. Obtain APPROVE from both before marking complete.
```

### Using Skills with Design Patterns

Skills are portable procedures that agents can execute. Design pattern skills orchestrate multi-agent work.

**Available design patterns:**
- `dev-collaboration` - Drafter/Reviewer/Breaker roles (CC drafts, AG reviews, CX red-teams)
- `dev-competition` - Two agents implement independently, third judges
- `add-comments` - Agents add work to shared files without overlap

**Skill locations:**
- Skill index: `SKILLS.md` (repo root)
- Skill definitions: `.agent/skills/`

**Example prompt using skills:**
```
Run the dev-collaboration skill at .agent/skills/dev-collaboration/SKILL.md.
Your role is DRAFTER. AG is REVIEWER, Codex is BREAKER.
Artifact location: dev_plan/dev_plan.md
Deliver your review using the add-comments skill to projects/plan_reviews.md
```

### Postflight (After Work Completes)

When agents have consensus (AG APPROVE + CX APPROVE):

```bash
# 1. End session with flush buffer
./scripts/end-session-safe.sh

# 2. Export the trace
./scripts/export-skill-run.sh --from-session

# 3. Run evals (use the trace path from export output)
TRACE=$(ls -t .observability/traces/*.json | head -1)
./scripts/run-skill-eval.sh "$TRACE" revision_addressed
./scripts/run-skill-eval.sh "$TRACE" reviewer_minimum
./scripts/run-skill-eval.sh "$TRACE" approval_chain
```

### Where to Find Eval Results

| Type | Location |
|------|----------|
| OTEL Traces | `.observability/traces/*.json` |
| Eval Reports (JSON) | `.observability/evals/*_TIMESTAMP.json` |
| Eval Reports (Markdown) | `.observability/evals/*_TIMESTAMP.md` |
| Dashboard logs | `.observability/dashboard.out` |
| Session state | `.observability/session_state.json` |

**Available eval packs:** `revision_addressed`, `reviewer_minimum`, `approval_chain`, `review_timing`, `decline_percentage`, `token_cost`, `courier_usage`

### Quick Reference

| Goal | Command |
|------|---------|
| Quick start (no evals) | `./scripts/wake-up.sh --dangerously-skip-permissions "prompt"` |
| With evals (recommended) | `./scripts/preflight-wakeup.sh SESSION --dangerously-skip-permissions "<wake-up prompt>"` |
| With evals (Option B) | `./scripts/preflight-wakeup.sh SESSION --dangerously-skip-permissions` |
| End session | `./scripts/end-session-safe.sh` |
| Export trace | `./scripts/export-skill-run.sh --from-session` |
| Run single eval | `./scripts/run-skill-eval.sh TRACE PACK` |

---

# Part 1: For Humans

## What This Does

This template lets you run up to three AI agents together:
- **Claude Code (CC)** - Anthropic's Opus 4.5, runs in Terminal or VS Code
- **Antigravity (AG)** - Google's Gemini 3 Pro, runs as an Electron application
- **Codex** - OpenAI's GPT-5.3-Codex, runs as a CLI (optional)

All agents can communicate bidirectionally with each other. Any agent can be configured as the "lead" via `leadership.json`. Together, they can work on complex, multi-step projects with minimal human intervention.

---

## Prerequisites (What You Need Installed)

| Software | Where to Get It | How to Check | Required? |
|----------|-----------------|--------------|-----------|
| **macOS** Sequoia 15.x+ | Already on your Mac | Apple menu → About This Mac | Yes |
| **Node.js** v20+ | https://nodejs.org | `node --version` | Yes |
| **tmux** | `brew install tmux` | `tmux -V` | Yes |
| **Antigravity** | Google (internal or waitlist) | Check `/Applications/Antigravity.app` | Yes |
| **VS Code** | https://code.visualstudio.com | Should be installed | Optional |
| **Claude Code CLI** | `npm i -g @anthropic-ai/claude-code` | `claude --version` | Yes |
| **Codex CLI** | `npm i -g @openai/codex` | `codex --version` | Optional |

---

## First-Time Setup (Do This Once After Cloning)

### Step 1: Install Dependencies

Open Terminal, navigate to your cloned repo, and run:

```bash
cd interlateral_dna
npm install
cd ..
```

This installs `puppeteer-core`, which Claude Code uses to control Antigravity.

### Step 2: Open Antigravity with a Workspace

**Important:** Antigravity must have an actual project open, not just the Launchpad.

1. **Quit Antigravity** if it's running (Cmd+Q)
2. **Relaunch with debug mode** — run this in Terminal:
   ```bash
   /Applications/Antigravity.app/Contents/MacOS/Electron --remote-debugging-port=9222
   ```
3. **Open a workspace** — Click on a project in the Launchpad, or create a new one
4. **Open the Agent Manager panel** — Click the icon in the right sidebar to show the chat interface

**Why this matters:** The Agent Manager (where Claude Code sends messages) only exists *inside* a workspace. If you're on the Launchpad (workspace selector), there's no chat to send to.

### Step 3: Launch VS Code with Full Autonomy Mode (Recommended)

For the best experience with this template, run Claude Code with full permissions:

```bash
claude --dangerously-skip-permissions
```

**What this does:**
- Allows Claude Code to run shell commands without asking permission each time
- Enables Claude Code to launch Antigravity, send messages, take screenshots autonomously
- Creates the "near full autonomy" experience this template is designed for

**Without this flag:** Claude Code will ask for permission before each shell command, which interrupts the autonomous workflow.

### Step 4: Open Your Project in VS Code

```bash
code /path/to/your/cloned/repo
```

Claude Code will wake up, read the README, and either:
- Start working on your dev plan (if you wrote one), or
- Report "Ready to receive assignment" (if dev plan is blank)

---

## Writing a Dev Plan (Optional)

If you want Claude Code to start working immediately, edit `dev_plan/dev_plan.md` before launching VS Code:

```markdown
# Dev Plan: My Project

## Objective
Build a web scraper that collects product prices from three websites.

## Tasks
1. Create the scraper script in Python
2. Test on each target website
3. Store results in a SQLite database
4. Add error handling and retry logic

## Success Criteria
- Script runs without errors
- All three websites scraped successfully
- Data stored correctly in database
```

---

## Monitoring the Agents

While the agents work, you can watch their coordination:

```bash
# See all messages Claude Code sends to Antigravity
tail -f interlateral_dna/ag_log.md

# See bidirectional coordination between both agents
tail -f interlateral_dna/comms.md
```

---

## Comms Monitor Dashboard (Web UI)

For a richer monitoring experience, use the Comms Monitor web dashboard:

```bash
# Start the dashboard
cd interlateral_comms_monitor/scripts
./start.sh

# Open in browser
# Backend: http://localhost:3001
# Frontend: http://localhost:5173
```

### Features

- **Real-time streaming** of CC, AG, and Codex communications
- **Multiple skins** (Cockpit, Timeline, Focus views)
- **Direct message injection** to CC, AG, Codex, or ALL
- **Export capabilities** (JSON/TXT/CSV)

### CC Direct Injection (Recommended Setup)

For reliable message injection to Claude Code, run CC in Terminal.app with tmux:

```bash
# Start CC in tmux session (enables direct injection)
cd interlateral_comms_monitor/scripts
./start-cc-tmux.sh
```

This provides:
- **Reliable injection** via `tmux send-keys`
- **Telemetry capture** via `tmux pipe-pane`
- **Session persistence** across disconnects

### AG Direct Injection

Launch Antigravity with Chrome DevTools Protocol enabled:

```bash
/Applications/Antigravity.app/Contents/MacOS/Electron --remote-debugging-port=9222 &
```

See `interlateral_comms_monitor/docs/USER_GUIDE.md` for complete documentation.

---

## Observability System

This template includes a lightweight observability system that captures everything you see:

### Data Captured

| Data Type | Location | Description |
|-----------|----------|-------------|
| **Terminal Recordings** | `.observability/casts/` | asciinema v2 recordings (replay with `asciinema play`) |
| **CC Transcripts** | `~/.claude/projects/<encoded>/` | Native JSONL logs (discovered via locator) |
| **AG Telemetry** | `.gemini/telemetry.log` | Token counts, thought metadata, tool calls |
| **Codex Telemetry** | `interlateral_dna/codex_telemetry.log` | tmux pipe-pane capture of Codex terminal |

### Key Scripts

```bash
# Start with observability (RECOMMENDED)
./scripts/wake-up.sh "Your prompt"

# Set up AG telemetry (creates .gemini/settings.json)
./scripts/setup-ag-telemetry.sh

# Discover CC log location
./scripts/discover-cc-logs.sh

# Rotate old recordings (runs automatically on wake-up)
./scripts/rotate-logs.sh
```

### Graceful Degradation

If `asciinema` is not installed, `wake-up.sh` will warn and proceed without visual recording. Install with:
```bash
brew install asciinema   # macOS
pip install asciinema    # any platform
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Connection refused" on port 9222 | Antigravity isn't running with debug mode. Quit and relaunch with `--remote-debugging-port=9222` |
| Claude Code says "status shows Launchpad" | You're on the workspace selector, not inside a project. Click a workspace to open it. |
| "Could not find chat input" | The Agent Manager panel isn't visible. Click the chat icon in Antigravity's right sidebar. |
| "Cannot find module puppeteer" | You didn't run `npm install`. Go to `interlateral_dna/` and run `npm install`. |

---

## Quick Reference

### Launch Agents
```bash
# Start everything with one command (recommended)
./scripts/wake-up.sh --dangerously-skip-permissions "Your prompt"

# Or manually:
/Applications/Antigravity.app/Contents/MacOS/Electron --remote-debugging-port=9222 &  # AG
claude --dangerously-skip-permissions  # CC
codex --yolo  # Codex (optional) - full permissions for bidirectional agent comms
```

Claude startup model policy in this repo:
```bash
# Default: stable alias (recommended)
CLAUDE_MODEL=opus ./scripts/wake-up.sh "Read CLAUDE.md. Execute the Wake-Up Protocol."

# Optional explicit pin (fail-fast if unavailable)
CLAUDE_MODEL=claude-opus-4-5-20251101 ./scripts/wake-up.sh "Read CLAUDE.md. Execute the Wake-Up Protocol."
```

### High Autonomy Modes (Codex + Gemini CLI)

**Codex CLI (your installed version):**
```bash
# FULL AUTONOMY (no sandbox + no approvals) - highest risk
codex --model gpt-5.3-codex --dangerously-bypass-approvals-and-sandbox

# Unattended but sandboxed (recommended default for most work)
codex --model gpt-5.3-codex --full-auto

# Minimal prompts + sandbox boundary
codex --sandbox workspace-write --ask-for-approval never
```

**Gemini CLI (Gemini 3 Flash family):**
```bash
# Auto-approve tool calls (repo default model pin)
gemini --model gemini-3-flash-preview --yolo
```

Bootstrap scripts enforce this policy with `GEMINI_MODEL`:
```bash
# Default in bootstrap scripts:
GEMINI_MODEL=gemini-3-flash-preview

# Optional override:
GEMINI_MODEL=gemini-3-flash-preview ./scripts/bootstrap-full.sh
```

If Gemini 3 models do not appear, enable preview features in-session:
```
/settings   → toggle Preview Features = true
/model      → select Gemini 3 Flash (or Auto)
```

If the configured Gemini 3 model is unavailable, bootstrap now fails fast and does not silently fall back to Gemini 2.5.

**Minimal self-checks (10 seconds):**
```bash
codex --help | grep -E "full-auto|dangerously-bypass|ask-for-approval|sandbox"
gemini --help | grep -E "yolo|model"
```

**Autonomy vs direct comms (Codex):**
- **Sandboxed modes** (full-auto / workspace-write) can **block tmux sockets** and **localhost CDP** → Codex may be unable to inject to CC/AG directly.
- **Full-access mode** (`--dangerously-bypass-approvals-and-sandbox`) enables **direct tmux + CDP injection**, but is **high risk**.

**Recommendation (skillful use):**
- Default to **sandboxed** for routine work.
- Escalate to **full-access** only when you need direct multi-agent injection or OS-level control, and ideally inside a **dedicated VM / separate user**.

**Optional workaround (tmux only):**
If you want tmux injection while still sandboxed, place the tmux socket inside the repo:
```bash
export TMUX_TMPDIR="$PWD/.tmux"
mkdir -p "$TMUX_TMPDIR"
tmux new-session -d -s claude
```
This helps for tmux, but **does not** grant AG CDP access.

**Note:** Flags can change by version. `codex --help` and `gemini --help` are the source of truth on your machine.

### Sandbox Stubs (Planned)

We plan to add a **sandboxed YOLO playbook** (VM / separate user / container) so full-access instances can run safely. Details and scripts TBD.

### Check if Everything is Connected
```bash
# AG CDP
curl -s http://127.0.0.1:9222/json/list | jq '.[].title'
# Should see workspace name, not just "Launchpad"

# All agents
node interlateral_dna/ag.js status
node interlateral_dna/cc.js status
node interlateral_dna/codex.js status
```

### Send Messages Between Agents
```bash
node interlateral_dna/ag.js send "message"     # → AG
node interlateral_dna/cc.js send "message"     # → CC
node interlateral_dna/codex.js send "message"  # → Codex
```

---

## Skills + Design Patterns (Quick Start)

This repo now includes **portable skills** (shared procedures) and **design-pattern skills** for multi-agent orchestration.

**Where to start:**
- `SKILLS.md` (root) → quick index of skills and example prompts.
- Canonical skill sources → `.agent/skills/`.

**Example (collaborative pattern):**
```text
Run the dev-collaboration skill at .agent/skills/dev-collaboration/SKILL.md.
Your role is REVIEWER. The Drafter is CC, the Breaker is Codex.
Artifact location: dev_plan/dev_plan.md
Deliver your review using the add-comments skill to projects/plan_reviews.md
```

Design-pattern skills let you organize work as **hierarchical**, **collaborative**, **competitive**, or **pipeline** flows just by invoking the pattern skill and assigning roles.

### Evals Skill (Quality Assurance)

The **evals skill** runs automated quality checks on agent work using LLM-as-judge evaluation.

**When to use:**
- After agents complete a dev plan (quality gate)
- Before merging code (automated review)
- When you want objective quality metrics

**Prerequisites (one-time setup):**
```bash
# 1. Add OpenAI API key to .env
echo "OPENAI_API_KEY=sk-your-key-here" >> .env

# 2. Install Python deps
pip install -r corpbot_agent_evals/lake_merritt/requirements.txt
```

**Example prompt (give to any agent):**
```text
Run the evals skill at .agent/skills/evals/SKILL.md.
Trace: .observability/traces/dev-collaboration_*.json
Packs: revision_addressed, reviewer_minimum, approval_chain
Report: locations of eval results + pass/fail summary
```

**Manual quick test:**
```bash
TRACE=$(ls -t .observability/traces/*.json 2>/dev/null | head -1)
./scripts/run-skill-eval.sh "$TRACE" revision_addressed
cat .observability/evals/revision_addressed_*.md
```

**Available eval packs:** revision_addressed, reviewer_minimum, approval_chain, review_timing, decline_percentage, token_cost, courier_usage

**Full details:** See `SKILLS.md` for complete evals skill documentation.

---

## Tool: Multi-Instance CC/Codex (Plus Gemini CLI)

You can run **multiple CC or Codex instances** by giving each its own **tmux session name**. This works because:
- tmux sessions are isolated processes,
- `cc.js` and `codex.js` target a session name via `CC_TMUX_SESSION` / `CODEX_TMUX_SESSION`,
- `open-tmux-window.sh` attaches a Terminal window to a specific tmux session.

**Second CC instance (CC2):**
```bash
tmux new-session -d -s claude2
tmux send-keys -t claude2 "./scripts/logged-claude.sh --dangerously-skip-permissions \"Open README.md Part 2, read CLAUDE.md, then check dev_plan/dev_plan.md and comms.md\"" Enter
./scripts/open-tmux-window.sh claude2 "Claude Code 2"

# Inject to CC2 explicitly
CC_TMUX_SESSION=claude2 node interlateral_dna/cc.js send "[Codex] @CC2 - Please ACK and confirm ready."
```

**Second Codex instance (Codex2):**
```bash
tmux new-session -d -s codex2 -c "$PWD"
tmux send-keys -t codex2 "codex --yolo" Enter
./scripts/open-tmux-window.sh codex2 "Codex 2"

# Inject to Codex2 explicitly
CODEX_TMUX_SESSION=codex2 node interlateral_dna/codex.js send "[CC] @Codex2 - Please ACK."
```

**Gemini CLI instances (lightweight workers):**
- Run each Gemini CLI in its own tmux session (e.g., `gemini1`, `gemini2`).
- Use `tmux send-keys ... && sleep 1 && tmux send-keys ... Enter` for reliable injection.

**Multiple Antigravity instances:** possible, but **high friction** (window targeting + CDP). Prefer Gemini CLI sessions for large worker pools.

---

## 🛑 Before You PR: The "Definition of Done" Checklist

To prevent incomplete handoffs, **ALL** Pull Requests must pass this checklist:

1.  **Documentation:** Did you create/update the `docs/`? (Code without docs is invisible to the next agent).
2.  **Configuration:** Did you update `.gitignore` and config files?
3.  **Bootstrap:** If you added scripts, did you run them on a **fresh clone** to verify they work from zero?
    *   *Test:* `cd /tmp && git clone <repo_url> test_repo && cd test_repo && ./scripts/wake-up.sh`
    *   (NEVER delete your active working directory!)
4.  **Verification:** Did you include a `verification_plan.md` or similar proof of work?

> **Rule of Thumb:** If the next agent needs to "figure it out", you aren't done.

---

# Part 2: For AI Agents (Claude Code)

## Wake-Up Protocol

> **Observability Context:** You are running inside the Observability System.
> Session logs are automatically captured to `.observability/`.
> No action required—just proceed with the protocol.

**If you are Claude Code just waking up in this repo, follow these steps:**

### Step 1: Boot Antigravity and Establish Connection

```bash
# 1. Check if Antigravity is already running with CDP
curl -s http://127.0.0.1:9222/json/list | jq '.[].title'

# If connection refused or only "Launchpad" shown, launch Antigravity:
/Applications/Antigravity.app/Contents/MacOS/Electron --remote-debugging-port=9222 &
sleep 3

# 2. Verify a workspace is open (not just Launchpad)
curl -s http://127.0.0.1:9222/json/list | jq '.[].title'
# Look for: "YourProject — somefile.ext" (NOT just "Launchpad")
# If only Launchpad, tell human: "Please open a workspace in Antigravity"

# 3. Install dependencies (if not already done)
cd interlateral_dna && npm install && cd ..

# 4. Test connection
node interlateral_dna/ag.js status
# Should show workspace title, not "Launchpad"

# 5. Send ACK request to AG (IMPORTANT: Must include instruction to ask human for assignment)
node interlateral_dna/ag.js send "[CC] @AG Wake-up protocol executing. Please respond with ACK, then ask the human: 'What is our assignment?'"

# 6. Screenshot to verify
sleep 5 && node interlateral_dna/ag.js screenshot /tmp/ag_status.png
```

### Step 1b: Verify and Message Codex

If Codex is installed, send ACK request:

```bash
# Check if Codex is available
node interlateral_dna/codex.js status

# If Codex is running, send ACK request (IMPORTANT: Must include instruction to ask human for assignment)
node interlateral_dna/codex.js send "[CC] @Codex Wake-up protocol executing. Please respond with ACK, then ask the human: 'What is our assignment?'"

# If not running but installed, bootstrap should have started it
# If needed, manually start:
# tmux send-keys -t codex "codex --yolo" Enter
```

**Note:** Codex is optional. If not installed, the system works with just CC + AG.

### Step 2: Check for a Dev Plan

```bash
cat dev_plan/dev_plan.md
```

**If the dev plan has actual content** (not the template text with "NO ACTIVE DEV PLAN"), read it carefully and begin work on those tasks after completing the connection step.

**If the dev plan is blank/template**, proceed to Step 3.

### Step 3: Report Status and Ask for Assignment

**If no dev plan exists (ALL THREE AGENTS MUST ASK):**

After confirming ACKs from AG and Codex, report to the human:

> **Quad-Agent Mesh: Wake-Up Protocol Complete**
>
> - **CC:** ACK
> - **AG:** ACK
> - **Codex:** ACK (or "not installed" if unavailable)
>
> **From CC, AG, and Codex: What is our assignment?**

**IMPORTANT:** This message MUST include all three agents asking for the assignment. Do not proceed without this collective request.

**If dev plan exists:**
> "Dev plan found. Beginning work on [summary of tasks]."

**If Antigravity isn't ready:**
> "Antigravity needs setup. Please: (1) Launch with `--remote-debugging-port=9222`, (2) Open a workspace (not just Launchpad), (3) Open the Agent Manager panel (right sidebar)."

---

## Repository Structure

```
interlateral_prototype_alpha/
├── README.md                    # This file
├── CLAUDE.md                    # CC system instructions
├── ANTIGRAVITY.md               # AG system instructions
├── AGENTS.md                     # Codex system instructions
├── dev_plan/
│   └── dev_plan.md              # Human writes task assignments here
├── scripts/                     # Bootstrap & observability scripts
│   ├── wake-up.sh               # Canonical entrypoint (use this!)
│   ├── bootstrap-full.sh        # Starts all agents + dashboard
│   ├── start-codex-tmux.sh      # Start Codex in tmux
│   ├── reset-leadership.sh      # Kill switch for deadlocks
│   ├── logged-claude.sh         # CC wrapper with recording
│   ├── rotate-logs.sh           # Log rotation
│   └── setup-*.sh               # Setup scripts
├── .observability/              # Captured session data
│   ├── casts/                   # asciinema recordings
│   ├── logs/                    # Archived sessions
│   └── cc_locator.json          # Discovered CC log path
├── .gemini/                     # AG configuration
│   └── telemetry.log            # AG telemetry data
├── interlateral_dna/            # Tri-agent control infrastructure
│   ├── README.md                # Full technical documentation
│   ├── ag.js                    # AG control script (CDP)
│   ├── cc.js                    # CC control script (tmux)
│   ├── codex.js                 # Codex control script (tmux)
│   ├── leadership.json          # Tri-agent leadership config
│   ├── ag_log.md                # CC → AG transcript
│   ├── comms.md                 # Shared coordination log
│   ├── codex_telemetry.log      # Codex terminal capture
│   └── package.json             # Node.js dependencies
├── interlateral_comms_monitor/  # Dashboard
│   ├── server/                  # Express + WebSocket backend
│   ├── ui/                      # React + Vite frontend
│   └── docs/                    # INTERNALS_GUIDE, USER_GUIDE, etc.
└── [your project files]         # Project-specific files go here
```

---

## Control Script Commands

All control scripts are in `interlateral_dna/`:

```bash
cd interlateral_dna

# AG Control (via CDP)
node ag.js status              # Check AG connection
node ag.js send "message"      # Send message to AG
node ag.js screenshot [path]   # Capture AG screen
node ag.js read                # Read AG panel text

# CC Control (via tmux)
node cc.js status              # Check CC tmux session
node cc.js send "message"      # Send message to CC

# Codex Control (via tmux)
node codex.js status           # Check Codex tmux session
node codex.js send "message"   # Send message to Codex
```

---

## Key Architecture Notes

1. **Quad-Agent Mesh:** CC, AG, Codex, and Gemini CLI can all communicate bidirectionally. Any agent can be configured as the "lead" in `leadership.json`.

2. **Agent Manager is an iframe:** The AG chat panel is inside an iframe (`cascade-panel.html`). ag.js handles this correctly.

3. **Workspace vs Launchpad:** AG's CDP sees multiple pages. "Launchpad" is the workspace selector. Always target the workspace, not Launchpad.

4. **Coordination files:**
   - `comms.md` — Shared coordination log (all agents read/write)
   - `ag_log.md` — CC → AG message history
   - `leadership.json` — Who leads the quad-agent mesh

5. **Graceful Degradation:** If AG is unavailable, the system works in CLI-only mode (CC + Codex + Gemini).

For complete technical documentation, see `interlateral_comms_monitor/docs/INTERNALS_GUIDE.md`.

---

## Credits

- **Design Pattern:** Interlateral Mesh
- **Agent 1:** Claude Code (Anthropic)
- **Agent 2:** Antigravity (Google Gemini)
- **Agent 3:** Codex (OpenAI)
- **Agent 4:** Gemini CLI (Google)
- **Template Version:** 2.1 (January 2026) - Quad-Agent Mesh

---

*This template implements the "Interlateral" pattern for multi-agent AI collaboration.*
