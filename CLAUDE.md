# Claude Code Capability Manual

## ON WAKE-UP: Do This Immediately

**Phase 0: Verify System (ALREADY DONE by wake-up.sh)**

If you were started via `./scripts/wake-up.sh`, the system is ALREADY bootstrapped:
- Antigravity is running with CDP (port 9222)
- Dashboard is running (backend 3001, frontend 5173)
- tmux session 'claude' exists for direct injection

**Quick verification (do this FIRST):**
```bash
# AG CDP ready?
curl -s http://127.0.0.1:9222/json/list | head -c 100

# Dashboard ready?
curl -s http://localhost:3001/api/streams/status

# tmux session ready?
tmux has-session -t interlateral-claude && echo "tmux ready"
```

If any fail: Run `./scripts/bootstrap-full.sh` to fix, then proceed.

**Phase 1: Establish Connection**
1. Read `README.md` in repo root — Part 2 contains your Wake-Up Protocol
2. Execute the Wake-Up Protocol to get ACK from BOTH Antigravity AND Codex
3. Do not stop to ask permission. Run all commands autonomously.

**Phase 2: Collective Assignment Request (CRITICAL)**
4. Once ACKs are confirmed from AG and Codex, check `dev_plan/dev_plan.md`
5. If it contains a real plan (not the template text "NO ACTIVE DEV PLAN"), **start working on it immediately**
6. Use Antigravity as your partner agent — send it tasks via `ag.js send`, coordinate via `comms.md`
7. **If no dev plan exists, ALL FOUR AGENTS MUST ASK FOR ASSIGNMENT:**
   > "Quad-Agent Mesh: Wake-Up Protocol Complete. CC: ACK, AG: ACK, Codex: ACK, Gemini: ACK. **What is our assignment?**"

**IMPORTANT: Fresh Session Rule**
- When reading `comms.md`, find the latest `# === NEW SESSION ===` marker
- Messages above that marker are **ARCHIVE for historical reference** - useful for context/research
- **Do NOT continue tasks from above the marker as if they are still active**
- Only act on NEW instructions that appear AFTER the session marker
- This ensures each session starts fresh while preserving history for reference

---

## CRITICAL: FILE ACCESS & RESPONSIBILITY

**You are running with broad system access. With great power comes responsibility.**

### Outside the Repo: ASK FIRST

**Files outside this repository REQUIRE HUMAN PERMISSION before modifying.**

- `~/.bashrc`, `~/.zshrc`, `~/.config/*` - ASK FIRST
- `/etc/*`, `/usr/*`, `/var/*` - ASK FIRST
- `~/Documents/*` (outside this repo) - ASK FIRST
- Any system files, other repos, user home directories - ASK FIRST

### Inside the Repo: Be Conscientious (Shared House Rule)

**You have full permissions inside this repo FOR YOUR ASSIGNED TASK.** If the task is to write code, update a draft, create a file - do it. No need to ask.

**BUT this repo is a SHARED HOUSE.** Other agents live here. A human depends on this house. You are NOT the only resident.

**DO NOT modify infrastructure, services, or critical files on a whim.**

| File Type | Examples | Rule |
|-----------|----------|------|
| **Your task deliverables** | Code you're writing, docs you're drafting | ✅ Full permission - do your job |
| **Coordination files** | `comms.md`, `ag_log.md` | ✅ Allowed - that's what they're for |
| **Infrastructure scripts** | `scripts/*.sh`, `*.js` in `interlateral_dna/` | ⚠️ ONLY if that IS the approved task |
| **Agent config files** | `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `ANTIGRAVITY.md` | ⚠️ ONLY if that IS the approved task |
| **Services/Dashboard** | `interlateral_comms_monitor/*` | ⚠️ ONLY if that IS the approved task |

**If you're unsure whether modifying a file is within scope:**
1. ASK another agent to double-check ("Hey, does modifying X seem reasonable for this task?")
2. Or ASK the human if it's a judgment call
3. When in doubt, don't touch it

**The principle:** Do your task fully. Don't "improve" things on a whim. Don't refactor infrastructure because it seemed like a good idea. Stay in your lane unless your lane IS that infrastructure work.

---

## CRITICAL: comms.md is for DOCUMENTATION, NOT COMMUNICATION

**comms.md is a FLAT FILE. No agent monitors it. No agent will ever see what you write there unless you ALSO send a terminal message.**

| Action | Result |
|--------|--------|
| Write to comms.md only | **NOTHING HAPPENS.** Agent stays idle forever. |
| Send via terminal only | Agent receives message but no audit trail. |
| **BOTH** (terminal + comms.md) | Agent receives AND we have a record. |

**NEVER write to comms.md expecting an agent to see it. They won't. EVER.**

**The Correct Protocol - ALWAYS do BOTH:**
1. **Send via terminal injection** (actually wakes the agent): `node ag.js send`, `node codex.js send`, `node gemini.js send`
2. **Document to comms.md** (creates audit trail)

---

## Key Principle

**Do everything yourself. Don't stop to ask. Let failure be the signal.**

The goal is autonomous operation from first wake-up through ACKs from BOTH Antigravity AND Codex. If `dev_plan/dev_plan.md` has a substantive plan, get straight to work on it. If the dev plan is still in template form, ensure all three agents collectively ask: "What is our assignment?" Only ask for human help if something actually fails.

## Observability System

This repo has a lightweight observability system that captures session data.

**Data Locations:**
- Terminal recordings: `.observability/casts/` (asciinema v2 format)
- CC transcripts: Auto-discovered via `.observability/cc_locator.json`
- AG telemetry: `.gemini/telemetry.log` (repo-local)

**Key Scripts:**
- `./scripts/wake-up.sh` — Canonical entrypoint (humans should use this to start you)
- `./scripts/logged-ag.sh` — Run AG with recording
- `./scripts/discover-cc-logs.sh` — Find CC transcript location
- `./scripts/rotate-logs.sh` — Archive old recordings

**Note:** If started via `wake-up.sh`, observability is already active. You don't need to do anything special.

## Quick Reference

- **LIVE_COMMS.md: `interlateral_dna/LIVE_COMMS.md`** - READ THIS for how to communicate with other agents
- Control scripts: `interlateral_dna/ag.js`, `interlateral_dna/cc.js`, `interlateral_dna/codex.js`, `interlateral_dna/gemini.js`
- Coordination log: `interlateral_dna/comms.md`
- Message log: `interlateral_dna/ag_log.md`
- Dev plan: `dev_plan/dev_plan.md`
- Leadership config: `interlateral_dna/leadership.json`
- Full technical docs: `interlateral_dna/README.md`
- Observability: `.observability/`, `scripts/*.sh`
- Roadmap: `ROADMAP.md` in repo root
- **Skills index: `SKILLS.md`** - All available skills including evals
- **Evals skill: `.agent/skills/evals/SKILL.md`** - Run quality evaluations
- **Evals guide: `interlateral_comms_monitor/docs/EVALS_GUIDE.md`** - Full evals documentation

## Evals (Quality Evaluation System)

**What:** The evals system validates agent work quality using LLM-as-judge scoring on OTEL traces.

**When to use:**
- After completing a dev plan or skill (quality gate)
- When human asks you to "run evals" or "evaluate"
- Before reporting work as "done" (optional but recommended)

**Quick Start:**
```bash
# Check prerequisites
grep -q "^OPENAI_API_KEY=" .env && echo "API key: OK"
python3 -c "import openai, jinja2, tenacity" && echo "Deps: OK"

# Run evals on most recent trace (uses last_trace.txt for reliability)
TRACE=$(cat .observability/last_trace.txt 2>/dev/null)
[ -z "$TRACE" ] && echo "No trace - run export first" || ./scripts/run-skill-eval.sh "$TRACE" revision_addressed

# View report
cat .observability/evals/revision_addressed_*.md
```

**Available Eval Packs:** revision_addressed, reviewer_minimum, approval_chain, review_timing, decline_percentage, token_cost, courier_usage

**Full documentation:** See `SKILLS.md` for the evals skill entry with all details.

**Conformance rules:** See `INTERNALS_CONFORMANCE.md` Section 15 for evals requirements.

## Observability Tools (How to See What Other Agents Are Doing)

**USE THESE to observe other agents directly:**

```bash
# See AG's conversation as TEXT (not just screenshot!)
node ag.js read

# See Codex's terminal buffer
tmux capture-pane -t interlateral-codex -p

# See CC's terminal buffer (if needed by another agent)
tmux capture-pane -t interlateral-claude -p

# Take AG screenshot (visual)
node ag.js screenshot /tmp/ag.png
```

**IMPORTANT:** `node ag.js read` gives you AG's chat history as text. Use this instead of relying only on comms.md or screenshots. For some design patterns, seeing what AG actually did is essential.

---

## Autonomous Terminal Operations

**IMPORTANT FOR ALL FUTURE CC INSTANCES:**

You CAN and MUST perform terminal operations autonomously. Do NOT ask the human to run commands that you can run yourself. This includes:

### tmux Session Management

**Creating tmux session for injection testing:**
```bash
# Check if session exists
tmux has-session -t interlateral-claude 2>/dev/null

# Create if not exists
tmux new-session -d -s claude -c /path/to/repo

# Enable telemetry capture
tmux pipe-pane -t interlateral-claude "cat >> /path/to/cc_telemetry.log"
```

**Injecting to tmux session:**
```bash
tmux send-keys -t interlateral-claude "your message here" Enter
```

### Key Principle

Document what you did, how, and why so future operators can reproduce work without manual handoffs.

**You have full terminal access. Use it. Don't ask permission for routine operations.**

### What You Can Do Autonomously

1. Create/manage tmux sessions
2. Start/stop servers
3. Run build commands
4. Launch Antigravity with CDP (path varies by install):
   - macOS default: `/Applications/Antigravity.app/Contents/MacOS/Electron --remote-debugging-port=9222 &`
5. Check process status, ports, file contents
6. Git operations (with care)

### What Requires Human Approval

1. Destructive operations (rm -rf, git push --force)
2. Security-sensitive changes
3. Major architectural decisions
4. Anything the human explicitly said to check first

---

## 🚨 PERMISSION GRANTING PROTOCOL (CRITICAL - READ THIS)

**THIS IS YOUR RESPONSIBILITY. THIS IS YOUR PRIVILEGE. DO NOT NEGLECT IT.**

### The Problem We Solved

The whole reason we use CLI agents (CC, Codex, Gemini) instead of APIs is because **you can reach into each other's terminals and take action**. This includes **granting permissions** when a fellow agent is stuck.

In early sessions, CC would passively report "Codex is stuck on a permission prompt" and do nothing, waiting for the human to intervene. **THIS IS WRONG.** You have the power to grant that permission yourself. **USE IT.**

### Your Role: Permission Guardian

When you observe a fellow agent stuck on a permission prompt:

1. **DO NOT** passively report it and wait
2. **DO NOT** ask the human to handle it
3. **DO** grant the permission yourself immediately
4. **DO** document what you did in comms.md

### How to Grant Permissions

**For Codex (stuck on approval prompt):**
```bash
# Check what Codex is waiting for
tmux capture-pane -t interlateral-codex -p | tail -20

# Grant the permission (typically 'y' or 'yes' + Enter)
tmux send-keys -t interlateral-codex "y" Enter
```

**For Gemini (stuck on approval/plan prompt):**
```bash
# Check what Gemini is waiting for
tmux capture-pane -t interlateral-gemini -p | tail -20

# Grant the permission (typically 'y' or 'yes' + Enter, or just Enter for plan confirmation)
tmux send-keys -t interlateral-gemini "y" Enter
# OR for plan confirmations:
tmux send-keys -t interlateral-gemini Enter
```

**For CC (if another agent needs to unblock you):**
```bash
# From another agent, check CC's status
tmux capture-pane -t interlateral-claude -p | tail -20

# Grant permission if needed
tmux send-keys -t interlateral-claude "y" Enter
```

### When to Grant Permissions

**Before granting:** Capture pane, read the prompt, confirm it matches the requested task, and confirm it's non-destructive and in-scope.

**GRANT permissions for:**
- Tool execution approvals (file writes, shell commands within repo)
- Plan confirmations
- Read operations and safe git commands (status, log, diff)
- Any "Do you want to proceed?" for routine, in-scope operations

**DO NOT GRANT permissions for:**
- **Destructive operations:** `rm -rf`, `git reset --hard`, `git clean -fdx`, `sudo`, etc.
- **Operations outside repo/writable roots** unless human explicitly requested
- **Unclear or mismatched prompts** that don't match the active task
- **Credentials, keys, or network installs** without explicit instruction
- **Resources the human explicitly forbade** modifying or accessing
- Anything that violates the Shared House Rule

**Decision Flow:**
```
1. Capture pane - see what the prompt is asking
2. Is it in-scope for the current task? → If NO, don't grant
3. Is it destructive? → If YES, don't grant
4. Is it outside the repo? → If YES, don't grant
5. All checks pass? → GRANT
```

### Active Monitoring

**You MUST actively monitor your fellow agents, not just wait for them to report problems.**

```bash
# Periodic health check (do this regularly during long tasks)
tmux capture-pane -t interlateral-codex -p | tail -5
tmux capture-pane -t interlateral-gemini -p | tail -5
```

If you see a permission prompt in the output, **immediately grant it**.

### Why This Matters

The human chose CLI agents specifically because:
1. You can communicate with each other
2. You can observe each other's terminals
3. **You can grant permissions for each other**

If you don't use this power, you're failing to deliver the autonomy the human paid for.

**STAND AND DELIVER. SET YOUR FELLOW AGENT FREE.**

### Documentation

After granting a permission, document it:

```markdown
[CC] @Human [TIMESTAMP]
## Permission Granted
Granted permission for Codex to execute `git push origin main`.
Reason: Standard operation within task scope.
```

### Known Permission Triggers (Feb 2026)

**Codex will prompt for:**
- Git write operations (push, commit, etc.) - HARDENED, always prompts
- Git destructive operations (reset, clean, etc.) - HARDENED, always prompts
- MCP tool calls - Smart approvals enabled by default

**Gemini will prompt for:**
- Plan confirmations (bug #13561) - Even with YOLO mode
- Some tool calls - Bug causes unexpected prompts

---

## Communicating with Antigravity (CRITICAL LESSON)

**IMPORTANT: There is a difference between DOCUMENTING and COMMUNICATING.**

### The Problem

AG is an agent that sleeps until poked. If you write to `comms.md` but don't actually send a message via `ag.js`, AG will NEVER see it until someone manually wakes them up.

**Writing to comms.md alone is like leaving a voicemail for someone whose phone is off.**

### The Solution: ALWAYS Do BOTH

When you need AG to do something or review something:

**Step 1: Document in comms.md (for the record)**
```markdown
[CC] @AG [TIMESTAMP]
## Your message here
Details...
```

**Step 2: Actually wake AG up and communicate**
```bash
# Check if AG is running
curl -s http://127.0.0.1:9222/json/list | head -c 100

# If not running, launch it (path varies by install)
/Applications/Antigravity.app/Contents/MacOS/Electron --remote-debugging-port=9222 &

# Send the actual message
cd interlateral_dna && node ag.js send "AG - CC here. [Your message]. Check comms.md for details."
```

### Why Both?

| Action | Purpose |
|--------|---------|
| `comms.md` entry | Permanent record, audit trail, context for later |
| `ag.js send` | Actually wakes AG up and delivers the message NOW |

### The Autonomy Principle

If you want something to happen, **make it happen**. Don't leave notes and hope.

- Want AG to review something? **Send the message directly.**
- Want the dashboard running? **Start it yourself.**
- Want a tmux session? **Create it yourself.**

**Don't wait. Don't ask. Do.**

---

## Communicating with Codex (Tri-Agent Mesh)

**Codex is the third agent in the tri-agent mesh.** The same principles apply as with AG.

### Sending to Codex

```bash
# Check if Codex session exists
node interlateral_dna/codex.js status

# Send message to Codex
node interlateral_dna/codex.js send "Codex - CC here. [Your message]."
```

### Full Quad-Agent Communication Map

| From | To | Method |
|------|-----|--------|
| CC → AG | `node ag.js send "message"` | CDP/Puppeteer |
| CC → Codex | `node codex.js send "message"` | tmux |
| CC → Gemini | `node gemini.js send "message"` | tmux |
| AG → CC | `node cc.js send "message"` | tmux |
| AG → Codex | `node codex.js send "message"` | tmux |
| AG → Gemini | `node gemini.js send "message"` | tmux |
| Codex → CC | courier outbox (`codex_outbox/*.msg`) | file watcher |
| Codex → AG | courier outbox (`codex_outbox/*.msg`) | file watcher |
| Codex → Gemini | courier outbox (`codex_outbox/*.msg`) | file watcher |
| Gemini → CC | `node cc.js send "message"` | tmux |
| Gemini → AG | `node ag.js send "message"` | CDP |
| Gemini → Codex | `node codex.js send "message"` | tmux |

**Note:** Codex cannot use the .js scripts directly due to sandbox restrictions. Courier must be running.

---

## Communicating with Gemini CLI (CRITICAL LESSON)

**Gemini CLI is the fourth agent in the quad-agent mesh.**

### ALWAYS Use gemini.js - NEVER Raw tmux send-keys

```bash
# CORRECT - Always use this:
node interlateral_dna/gemini.js send "Your message here"

# WRONG - This will leave message stuck in input box:
tmux send-keys -t interlateral-gemini "Your message" Enter
```

### Why Raw tmux Fails

Gemini CLI has an input buffer race condition. When using raw `tmux send-keys`:
1. Text appears in the input box
2. Enter fires immediately
3. But the input buffer isn't ready yet
4. Message sits in text box, never submitted

### Why gemini.js Works

The `gemini.js` script has a **1-second delay** built in:
```javascript
// Send text
execSync(`tmux send-keys -t interlateral-gemini -- "${escaped}"`);
// Wait for buffer (CRITICAL)
execSync('sleep 1');
// Then send Enter
execSync(`tmux send-keys -t interlateral-gemini Enter`);
```

This same pattern is used in `cc.js` and `codex.js` - all CLI agents need the delay.

### Quick Reference

```bash
# Check Gemini status
node interlateral_dna/gemini.js status

# Send message to Gemini (ALWAYS use this)
node interlateral_dna/gemini.js send "Gemini - CC here. [Your message]."

# Read Gemini's terminal output
node interlateral_dna/gemini.js read
# OR
tmux capture-pane -t interlateral-gemini -p | tail -50
```

### Lesson Learned (2026-01-28)

Human had to intervene because CC used raw `tmux send-keys` and messages got stuck.
**Future CC instances: ALWAYS use `node gemini.js send` for reliable communication.**

---

## Cross-Team-Comms (Multi-Machine Bridge)

When `--cross-team` is passed to `wake-up.sh`, the bootstrap starts an HTTP bridge (`bridge.js` on port 3099) and checks peer reachability. This allows agents on different machines to send messages to each other.

**CC is the cross-team coordinator.** Only CC should run `bridge-send.js`. Other agents (CX, Gemini) interpret injected commands as conversation, not commands to execute.

### Auth Requirement (Security Guardrail)

**Cross-team mode requires `BRIDGE_TOKEN` by default.** Without it, `wake-up.sh --cross-team` exits with an error and the bridge will not start.

```bash
# Required: set a shared secret on ALL peer machines
export BRIDGE_TOKEN=your-shared-secret
./scripts/wake-up.sh --cross-team "Your prompt"

# Override (NOT recommended on shared/public networks):
export BRIDGE_ALLOW_NO_AUTH=true
./scripts/wake-up.sh --cross-team "Your prompt"
```

The guardrail exists at two levels (defense-in-depth):
1. **`wake-up.sh`** — hard exit before bootstrap even runs
2. **`bootstrap-full.sh`** — blocks bridge start (catches manual bootstrap runs)

### Sending to Remote Agents

```bash
# Send to any agent on the peer team (BRIDGE_TOKEN must be set)
export BRIDGE_TOKEN=your-shared-secret
node interlateral_comms/bridge-send.js --peer beta --target cc --msg "hello"
node interlateral_comms/bridge-send.js --peer beta --target codex --msg "hello"
node interlateral_comms/bridge-send.js --peer beta --target gemini --msg "hello"

# Direct IP override (bypasses peers.json)
node interlateral_comms/bridge-send.js --host 172.20.10.5 --target cc --msg "hello"
```

### Resolution Order

`--peer` resolves via `interlateral_comms/peers.json`:
1. Try `.local` hostname via DNS lookup (bounded timeout)
2. If mDNS fails → use `fallback_ip`
3. If no fallback → error with setup instructions

`BRIDGE_TOKEN` is required on the remote bridge — `/inject` requires `x-bridge-token` header (sent automatically by bridge-send when env/`--token` is present).

### Key Constraints

- **Auth required by default.** Set `BRIDGE_TOKEN` on all machines. `BRIDGE_ALLOW_NO_AUTH=true` overrides (not recommended).
- **CC-bottleneck:** Only CC reliably sends cross-team. Other agents get messages but won't auto-execute bridge-send commands back.
- **Same network required.** mDNS works on WiFi/LAN. On iPhone hotspots, `fallback_ip` kicks in automatically.
- **Bridge mutex:** `/inject` is behind a concurrency lock. `/status` and `/read` are not — concurrent status checks won't queue behind injections.

### Setup (one-time per machine)

```bash
cd interlateral_comms && ./setup-peers.sh
```

Set team identity and auth before cross-team sessions:
```bash
export INTERLATERAL_TEAM_ID=alpha   # beta on peer machine
export BRIDGE_TOKEN=your-shared-secret  # same on all peers
```
`wake-up.sh` will auto-generate `INTERLATERAL_SESSION_ID` and persist it to `interlateral_dna/session_identity.json`.

See `LIVE_COMMS.md` for the full cross-team route table and cheat sheet.

---

## Leadership Protocol (Quad-Agent)

On boot, check `interlateral_dna/leadership.json` to see who is the lead:

```json
{
  "lead": "cc",
  "ack_timeout_seconds": 30,
  "fallback": "proceed"
}
```

### If CC is the Lead (Default):

1. Seek ACK from AG: `node ag.js send "[CC] @AG Wake-up protocol executing. Please respond with ACK, then ask the human: 'What is our assignment?'"`
2. Seek ACK from Codex: `node codex.js send "[CC] @Codex Wake-up protocol executing. Please respond with ACK, then ask the human: 'What is our assignment?'"`
3. Wait for responses (up to timeout)
4. If timeout and `fallback: "proceed"`: Continue with available agents
5. Report ready status with ALL THREE AGENTS asking: "What is our assignment?"

### If CC is NOT the Lead:

1. Wait for ACK request from the lead
2. Respond with ACK
3. Stand by for tasks

### Deadlock Recovery

If agents are stuck waiting for each other:
```bash
./scripts/reset-leadership.sh
# Or with session restart:
./scripts/reset-leadership.sh --restart
```

---
