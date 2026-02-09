# Internals Guide

**Version:** 1.1
**Date:** 2026-01-21
**Authors:** Claude Code (CC) + Antigravity (AG)
**Audience:** Future CC/AG instances, system administrators, humans who need to understand this project

---

## Table of Contents

0. [Quick Start for New Agents](#0-quick-start-for-new-agents)
1. [Philosophy: Full Autonomy by Design](#1-philosophy-full-autonomy-by-design)
2. [Quick Architecture Overview](#2-quick-architecture-overview)
3. [The Wake-Up Protocol](#3-the-wake-up-protocol)
4. [Dual-Agent Coordination](#4-dual-agent-coordination)
5. [Observability System](#5-observability-system)
6. [Comms Monitor Dashboard](#6-comms-monitor-dashboard)
7. [Plugin Architecture (MUST NOT REGRESS)](#7-plugin-architecture-must-not-regress)
8. [Injection Mechanisms](#8-injection-mechanisms)
9. [Configuration & Scripts Reference](#9-configuration--scripts-reference)
10. [Dependencies & Prerequisites](#10-dependencies--prerequisites)
11. [Things That Break If Changed](#11-things-that-break-if-changed)
12. [Troubleshooting](#12-troubleshooting)
13. [For Future Agents (Including Security)](#13-for-future-agents-including-security)

---

## 0. Quick Start for New Agents

**If you just woke up and don't know where you are:**

| Step | Time | Action |
|------|------|--------|
| 1 | 30 sec | Read this section |
| 2 | 2 min | Read Section 1 (Philosophy) |
| 3 | 5 min | Read Section 3 (Wake-Up Protocol) |
| 4 | Check | Look at `dev_plan/dev_plan.md` for your assignment |

### Key Files to Know

| File | Purpose | Location |
|------|---------|----------|
| `CLAUDE.md` | Your system instructions | Repo root |
| `comms.md` | Talk to AG here | interlateral_dna/ |
| `ag_log.md` | Your message history to AG | interlateral_dna/ |
| `dev_plan.md` | Your task assignment | dev_plan/ |

### Quick Commands

```bash
# Check your assignment
cat dev_plan/dev_plan.md

# Send message to AG
node interlateral_dna/ag.js send "Your message"

# Check AG status
node interlateral_dna/ag.js status

# Start the dashboard
cd interlateral_comms_monitor/scripts && ./start.sh
```

### If Something is Broken

Jump to [Section 12: Troubleshooting](#12-troubleshooting)

---

## 1. Philosophy: Full Autonomy by Design

### The Vision

This project exists to enable **fully autonomous AI agent operation**. The ideal workflow:

```
Human writes dev_plan.md
       ↓
Human runs: ./scripts/wake-up.sh --dangerously-skip-permissions "Execute the plan"
       ↓
wake-up.sh bootstraps EVERYTHING (AG, dashboard, tmux)
       ↓
CC wakes up to a READY system
       ↓
CC reads CLAUDE.md, verifies system, gets ACK from AG
       ↓
CC and AG coordinate via comms.md
       ↓
Entire project built, tested, deployed
       ↓
Human returns to completed work
```

### ONE-COMMAND AUTONOMY (MUST NOT REGRESS)

**This is the CORE PROMISE of this project:**

> "ONE OF THE BEST THINGS WE CAN DO WITH NEW INTELLIGENCE OF SYSTEMS LIKE CC AND AG IS GET THEM TO DO EXACTLY THIS - set up everything in advance so it does it all the Right Way we want and would have done ourselves if manually using AI Agent CLIs, but instead we get an AI Agent CLI to type into terminal for us - THAT IS THE DEAL!"

**The deal:**
- Human runs ONE command: `./scripts/wake-up.sh --dangerously-skip-permissions "prompt"`
- System does EVERYTHING else automatically:
  - `bootstrap-full.sh` starts AG with CDP (port 9222)
  - `bootstrap-full.sh` starts dashboard (ports 3001, 5173)
  - `bootstrap-full.sh` creates tmux session for injection
  - `bootstrap-full.sh` verifies all services
  - CC wakes up to a FULLY READY system
  - CC does NOT need to run setup commands

**If you find yourself telling the human to run multiple commands, YOU HAVE REGRESSED.**

This must not happen. The whole point is that AI agents can handle the fiddly setup that humans would otherwise do manually.

### Core Principles

**1. Single-Command Philosophy (CRITICAL)**
- One command (`wake-up.sh`) starts everything
- `wake-up.sh` calls `bootstrap-full.sh` automatically
- Human intervention should be optional, not required
- **CC should NEVER tell human to run setup commands**

**2. "Failure as Signal"**
- Don't ask permission for things you can do yourself
- Try it, let failure tell you if something's wrong
- Only escalate to human when truly blocked

**3. Observability from Birth**
- Every session is recorded from the first command
- If it's not logged, it didn't happen
- Recordings enable debugging and replay

**4. Graceful Degradation**
- Missing components shouldn't crash the system
- Fallback paths exist for critical operations
- Warn, don't fail

### Why This Matters

Future CC/AG instances: You are meant to be **autonomous**. This project was designed so you can:
- Wake up to a READY system (everything already bootstrapped)
- Verify the system is ready (Phase 0 in CLAUDE.md)
- Find your assignment in `dev_plan.md`
- Execute it without human help
- Coordinate with your partner agent
- Complete meaningful work

Don't be timid. Don't ask permission for things you can do. Let the system guide you.

**Remember:** If the human had to run multiple commands, something is wrong with the system, not with the human.

---

## 2. Quick Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         HUMAN                                    │
│  - Writes dev_plan.md                                           │
│  - Runs wake-up.sh                                              │
│  - Monitors via Dashboard                                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    ./scripts/wake-up.sh
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CLAUDE CODE (CC)                             │
│  - Reads CLAUDE.md for instructions                             │
│  - Reads dev_plan.md for tasks                                  │
│  - Boots and controls AG via ag.js                              │
│  - Writes to comms.md for coordination                          │
│  - Can run in VS Code or Terminal+tmux                          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                     ag.js (CDP/Puppeteer)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ANTIGRAVITY (AG)                             │
│  - Runs as Electron app with CDP enabled                        │
│  - Receives tasks from CC                                       │
│  - Writes to comms.md for coordination                          │
│  - Has .gemini/telemetry.log for observability                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    COMMS MONITOR DASHBOARD                       │
│  - Real-time WebSocket streaming                                │
│  - Multiple skins (Cockpit, Timeline, Focus)                    │
│  - Injection to CC and AG                                       │
│  - Export capabilities                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
comms.md ──┐
ag_log.md ─┼──→ File Watchers ──→ WebSocket ──→ React UI ──→ Human
CC logs ───┘

Dashboard ──→ Inject API ──→ tmux/CDP ──→ CC/AG
```

### Component Relationships

| Component | Depends On | Provides To |
|-----------|------------|-------------|
| CC | CLAUDE.md, dev_plan.md | ag.js commands, comms.md entries |
| AG | CDP port 9222 | comms.md entries, task execution |
| Dashboard | Node.js, file watchers | Real-time visibility, injection |
| ag.js | puppeteer-core, AG running | CC control over AG |

---

## 3. The Wake-Up Protocol

> ⚠️ **FRAGILE:** Changes to this section affect how CC boots. Modify carefully.

### The Boot Sequence

When CC wakes up, it follows this sequence:

```
1. CC starts (via wake-up.sh or manually)
       ↓
2. CC reads CLAUDE.md (system instructions)
       ↓
3. CC reads README.md Part 2 (Wake-Up Protocol)
       ↓
4. CC checks dev_plan/dev_plan.md
       ↓
   ┌─────────────────┬─────────────────┐
   │ Has real plan?  │ Blank/template? │
   └────────┬────────┴────────┬────────┘
            │                 │
   Start working        Report "Ready for assignment"
```

### Key Files in Boot Sequence

**CLAUDE.md** - CC's "brain dump"
- Contains wake-up instructions
- Documents autonomous operations capability
- Lists key file locations
- Should be read FIRST by new CC instances

**README.md Part 2** - Wake-Up Protocol
- Step-by-step instructions CC follows
- Defines the boot AG step
- Establishes the coordination pattern

**dev_plan/dev_plan.md** - The Contract
- Human writes tasks here
- CC reads and executes
- Template text means "no assignment yet"
- Real content means "get to work"

### Starting CC with Observability

```bash
# CANONICAL ENTRYPOINT - Always use this
./scripts/wake-up.sh "Your prompt here"

# With full autonomy (no permission prompts)
./scripts/wake-up.sh --dangerously-skip-permissions "Your prompt"
```

**Why wake-up.sh?** It ensures:
- Observability is active from the first command
- Logs are captured before CC even starts
- Rotation is handled automatically

### Booting AG

CC should boot AG with CDP enabled:

```bash
/Applications/Antigravity.app/Contents/MacOS/Electron --remote-debugging-port=9222 &
```

Then verify:
```bash
curl -s http://127.0.0.1:9222/json/list | head -5
```

---

## 4. Tri-Agent Coordination

> ⚠️ **FRAGILE:** The message format is parsed. Changes break history.

### Communication Files

| File | Purpose | Who Writes | Format |
|------|---------|------------|--------|
| `comms.md` | Tri-directional coordination | CC + AG + Codex | Append-only log |
| `ag_log.md` | CC → AG message history | ag.js | Append-only log |
| `codex_telemetry.log` | Codex terminal capture | tmux pipe-pane | Raw text |

**Recovery note:** If `comms.md` becomes corrupted, check for `comms.md.bak` which may contain a recent backup.

### Message Format Convention

```markdown
[AGENT] @TARGET [TIMESTAMP]
Your message content here.

---
```

**Example:**
```markdown
[CC] @AG @Codex [2026-01-21 T14:30:00]
Please review the changes I made to server/inject.js and confirm they look correct.

---

[AG] @CC [2026-01-21 T14:32:00]
Reviewed. The changes look good. Approved.

---

[Codex] @CC @AG [2026-01-21 T14:33:00]
Also reviewed. LGTM.

---
```

### Control Scripts (Tri-Agent Mesh)

**ag.js** - Control AG via CDP
Location: `interlateral_dna/ag.js`

| Command | Purpose |
|---------|---------|
| `node ag.js send "message"` | Send message to AG |
| `node ag.js status` | Check AG connection status |
| `node ag.js screenshot` | Take screenshot of AG |
| `node ag.js read` | Read AG's current panel content |

**cc.js** - Control CC via tmux
Location: `interlateral_dna/cc.js`

| Command | Purpose |
|---------|---------|
| `node cc.js send "message"` | Send message to CC (via tmux) |
| `node cc.js status` | Check CC tmux session status |

**codex.js** - Control Codex via tmux
Location: `interlateral_dna/codex.js`

| Command | Purpose |
|---------|---------|
| `node codex.js send "message"` | Send message to Codex (via tmux) |
| `node codex.js status` | Check Codex tmux session status |

### Full Tri-Directional Communication

| From | To | Method |
|------|----|--------|
| CC → AG | `node ag.js send` | CDP/Puppeteer (port 9222) |
| CC → Codex | `node codex.js send` | tmux send-keys |
| AG → CC | `node cc.js send` | tmux send-keys |
| AG → Codex | `node codex.js send` | tmux send-keys |
| Codex → CC | `node cc.js send` | tmux send-keys |
| Codex → AG | `node ag.js send` | CDP/Puppeteer (port 9222) |
| Dashboard → All | Injection API | Broadcast to all agents |

> ⚠️ **CRITICAL:** Agents must ALWAYS use their control scripts when communicating, not just write to comms.md!

### CDP Connection (AG)

AG must run with `--remote-debugging-port=9222`

```bash
# Check connection
curl -s http://127.0.0.1:9222/json/list

# Expected: JSON with AG page info
# If "Connection refused": AG not running with CDP
```

### Leadership Protocol (Tri-Agent)

On boot, agents check `interlateral_dna/leadership.json` to see who is the lead:

```json
{
  "lead": "cc",
  "ack_timeout_seconds": 30,
  "fallback": "proceed"
}
```

**If you are the lead:** Seek ACK from other agents, then proceed.
**If you are NOT the lead:** Wait for ACK request, respond, stand by.
**Deadlock recovery:** Run `./scripts/reset-leadership.sh`

### Coordination Patterns

**Deep Review Protocol:**
1. CC completes work
2. CC asks AG and/or Codex for review via comms.md + control scripts
3. Reviewers provide feedback via comms.md + control scripts
4. Iterate until all approve

**Task Delegation:**
1. Lead agent sends task to worker agents via control scripts
2. Workers execute and report in comms.md + control scripts
3. Lead monitors via dashboard or comms.md

---

## 5. Observability System

### What's Captured and Where

| Data Type | Location | Format | Purpose |
|-----------|----------|--------|---------|
| Terminal recordings | `.observability/casts/` | asciinema v2 | Visual replay |
| CC transcripts | `~/.claude/projects/<encoded>/` | JSONL | Structured logs |
| AG telemetry | `.gemini/telemetry.log` | JSON lines | Token counts, metadata |
| CC terminal output | `interlateral_dna/cc_telemetry.log` | Raw text | tmux capture |
| Archived logs | `.observability/logs/` | Various | Historical data |

### Why Observability Matters

1. **Human can't watch 24/7** - Recordings let human review later
2. **Debugging** - When something breaks, replay the session
3. **Audit trail** - Proof of what happened
4. **Continuous eval** - Feed to Lake Merritt for analysis

### Key Scripts

| Script | Purpose |
|--------|---------|
| `discover-cc-logs.sh` | Find CC's native JSONL location |
| `rotate-logs.sh` | Archive old recordings, prevent disk fill |
| `setup-ag-telemetry.sh` | Configure `.gemini/settings.json` |

### Log Rotation

```bash
# Manual rotation
./scripts/rotate-logs.sh

# Happens automatically on wake-up
```

Rotation moves old `.cast` files to `.observability/logs/` with timestamps.

---

## 6. Comms Monitor Dashboard

### Architecture

```
interlateral_comms_monitor/
├── server/           # Express + WebSocket backend
│   ├── index.js      # Main server (port 3001)
│   ├── watcher.js    # File watchers
│   ├── inject.js     # Injection logic
│   └── parsers/      # Stream parsers
├── ui/               # React + Vite frontend
│   └── src/
│       ├── skins/    # Plugin architecture
│       ├── hooks/    # useStreams, useNavigation
│       └── components/
└── scripts/
    ├── start.sh      # Launch dashboard
    └── start-cc-tmux.sh  # Launch CC in tmux
```

### Starting the Dashboard

```bash
cd interlateral_comms_monitor/scripts
./start.sh
```

- **Backend:** http://localhost:3001
- **Frontend:** http://localhost:5173

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/streams/status` | GET | Active streams info |
| `/api/events/history` | GET | Paginated event history |
| `/api/inject` | POST | Inject message to CC/AG |
| `/api/inject/status` | GET | Injection availability |

### WebSocket Events

```javascript
// Client connects to ws://localhost:3001
// Server sends: { type: 'event', data: StreamEvent }
```

---

## 7. Plugin Architecture (MUST NOT REGRESS)

> ⚠️ **CRITICAL:** This is an architectural guarantee. Breaking it breaks extensibility.

### The Guarantee

**These behaviors MUST be preserved:**

1. Drop a `*Skin.tsx` file in `ui/src/skins/` → refresh → appears in dropdown
2. No changes to `App.tsx` or `index.ts` required
3. Hot reload works during development
4. `containerRef` enables navigation features

### How It Works

```typescript
// ui/src/skins/index.ts
const skinModules = import.meta.glob<SkinModule>('./*Skin.tsx', { eager: true });
```

Vite's `import.meta.glob` auto-discovers all files matching `*Skin.tsx`.

### Required Exports

Every skin MUST export:

```typescript
// Named export: metadata
export const meta: SkinMeta = {
  id: 'unique-id',
  name: 'Display Name',
  description: 'What this skin does',
  icon: '🎨',  // optional
};

// Default export: component
export default function MySkin({ events, containerRef }: SkinProps) {
  return <div ref={containerRef}>...</div>;
}
```

### SkinProps Interface

```typescript
interface SkinProps {
  events: StreamEvent[];
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  onNewEvents?: (count: number) => void;
  loadHistory?: () => Promise<void>;
  isLoadingHistory?: boolean;
  hasMoreHistory?: boolean;
}
```

### What Breaks If Changed

| Change | Impact |
|--------|--------|
| Rename `*Skin.tsx` pattern | Auto-discovery fails |
| Remove `meta` export | Skin not registered |
| Remove `default` export | Skin not registered |
| Change `SkinProps` | All existing skins break |
| Change `SkinMeta` | Registration logic breaks |

See `docs/SKIN_DEV_GUIDE.md` for complete documentation.

---

## 8. Injection Mechanisms

### CC Injection Stack

**Priority Order:** tmux → AppleScript → comms.md

| Method | Reliability | Requirements |
|--------|-------------|--------------|
| tmux send-keys | HIGH | CC in tmux session 'claude' |
| AppleScript | MEDIUM | macOS, VS Code focused |
| comms.md | FALLBACK | Always works, CC must poll |

**tmux Injection (PRIMARY):**
```bash
# CRITICAL: Must have 1-second delay between text and Enter to avoid race condition
# Without delay, text appears but Enter doesn't submit (CC input buffer issue)
tmux send-keys -t claude "Your message" && sleep 1 && tmux send-keys -t claude Enter
```

**AppleScript Injection (FALLBACK):**
```bash
osascript -e 'tell application "Code" to ...'
```

### AG Injection

Uses Chrome DevTools Protocol via Puppeteer:

```bash
node ag.js send "Your message"
```

Requires:
- AG running with `--remote-debugging-port=9222`
- Workspace open (not Launchpad)
- Agent Manager panel visible

### Codex Injection

Uses tmux send-keys (same pattern as CC):

```bash
node codex.js send "Your message"
```

**Under the hood:**
```bash
# CRITICAL: Same 1-second delay pattern as CC injection
tmux send-keys -t codex "Your message" && sleep 1 && tmux send-keys -t codex Enter
```

Requires:
- Codex running in tmux session 'codex'
- Codex CLI started with safety flags: `--sandbox workspace-write --ask-for-approval never`

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `CC_TMUX_SESSION` | `claude` | tmux session name for CC |
| `CODEX_TMUX_SESSION` | `codex` | tmux session name for Codex |

### Dashboard Injection (Tri-Agent)

The dashboard at http://localhost:5173 provides:
- Target selector (CC, AG, Codex, CC+AG, ALL)
- Message input
- Status indicator (green = tmux/CDP available)

**Broadcast Targets:**
- `CC`: Send to Claude Code only
- `AG`: Send to Antigravity only
- `Codex`: Send to Codex only
- `CC+AG`: Send to both CC and AG (legacy dual-agent)
- `ALL`: Broadcast to all three agents simultaneously

---

## 9. Configuration & Scripts Reference

### Configuration Files

| File | Purpose | Location |
|------|---------|----------|
| `CLAUDE.md` | CC system instructions | Repo root |
| `ANTIGRAVITY.md` | AG system instructions | Repo root |
| `AGENTS.md` | Codex system instructions | Repo root |
| `README.md` | Human + agent documentation | Repo root |
| `dev_plan/dev_plan.md` | Task assignment | dev_plan/ |
| `.gemini/settings.json` | AG telemetry config | .gemini/ |
| `.observability/cc_locator.json` | CC log path | .observability/ |
| `interlateral_dna/leadership.json` | Tri-agent leadership config | interlateral_dna/ |
| `interlateral_dna/package.json` | Control script dependencies | interlateral_dna/ |
| `server/package.json` | Backend dependencies | interlateral_comms_monitor/server/ |
| `ui/package.json` | Frontend dependencies | interlateral_comms_monitor/ui/ |
| `ui/vite.config.ts` | Vite/dev server config | interlateral_comms_monitor/ui/ |

### Control Scripts (interlateral_dna/)

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `ag.js` | Control AG via CDP | CC/Codex → AG communication |
| `cc.js` | Control CC via tmux | AG/Codex → CC communication |
| `codex.js` | Control Codex via tmux | CC/AG → Codex communication |

### Core Scripts (scripts/)

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `wake-up.sh` | Start CC with observability | Always (canonical entrypoint) |
| `bootstrap-full.sh` | Start all agents + dashboard | Called by wake-up.sh |
| `logged-claude.sh` | CC wrapper with recording | Called by wake-up.sh |
| `logged-ag.sh` | AG wrapper with recording | Manual AG start with logging |
| `rotate-logs.sh` | Archive old recordings | Automatic or manual cleanup |
| `setup-ag-telemetry.sh` | Create .gemini config | First-time AG setup |
| `discover-cc-logs.sh` | Find CC JSONL path | Debugging, locator setup |
| `start-codex-tmux.sh` | Start Codex in tmux | Manual Codex start |
| `reset-leadership.sh` | Kill switch for deadlocks | When agents are stuck waiting |

### Dashboard Scripts (interlateral_comms_monitor/scripts/)

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `start.sh` | Launch backend + frontend | Start the dashboard |
| `start-cc-tmux.sh` | Create tmux session for CC | Enable reliable CC injection |

---

## 10. Dependencies & Prerequisites

### System Requirements

| Dependency | Version | Required For | Install |
|------------|---------|--------------|---------|
| Node.js | 18+ | Dashboard, ag.js | nodejs.org |
| npm | 9+ | Package management | Comes with Node |
| tmux | Any | CC injection (primary) | `brew install tmux` |
| asciinema | 3.x | Terminal recording | `brew install asciinema` |

### Applications

| Application | Purpose | Location |
|-------------|---------|----------|
| Antigravity | AG agent | /Applications/Antigravity.app |
| VS Code | CC IDE (optional) | /Applications/Visual Studio Code.app |
| Claude Code | CC extension | VS Code marketplace |
| Codex CLI | Codex agent (optional) | `npm i -g @openai/codex` or `brew install --cask codex` |

### Runtime Assumptions

- **macOS Sequoia 15.x+** - AppleScript, Electron paths
- **AG with CDP** - Must launch with `--remote-debugging-port=9222`
- **AG workspace open** - Not just Launchpad
- **tmux session 'claude'** - For reliable CC injection
- **tmux session 'codex'** - For reliable Codex injection (optional - graceful degradation if Codex not installed)

### First-Time Setup

```bash
# 1. Install Node dependencies
cd interlateral_dna && npm install
cd ../interlateral_comms_monitor/server && npm install
cd ../ui && npm install

# 2. Set up AG telemetry
./scripts/setup-ag-telemetry.sh

# 3. Verify everything
./scripts/wake-up.sh "Hello, I'm awake"
```

---

## 11. Things That Break If Changed

> ⚠️ **WARNING:** This section documents fragile components. Read before modifying.

### Before Modifying ANY Component

```
□ Read its entry in this section
□ Check what depends on it
□ Test in isolation first
□ Verify T5 still passes (for skin changes)
□ Update documentation if behavior changes
```

### Fragile Components

| Component | What Breaks If Changed | Safe Modification Path |
|-----------|------------------------|------------------------|
| `*Skin.tsx` pattern | Skin auto-discovery | Don't change the glob pattern |
| `SkinProps` interface | All existing skins | Add optional props only |
| `SkinMeta` interface | Skin registration | Add optional fields only |
| CDP port 9222 | ag.js, AG control | Update all references together |
| tmux session name | CC injection | Use CC_TMUX_SESSION env var |
| comms.md format | Parsing, history | Document new format, migrate old |
| File paths in watchers | Silent failure | Update watcher.js and verify |
| README Wake-Up Protocol | CC boot behavior | Test with fresh CC instance |
| dev_plan.md location | CC task finding | Update CLAUDE.md reference |

### Dependency Graph

```
SkinProps ←── All *Skin.tsx files
    ↑
  types.ts
    ↑
  index.ts (glob pattern)

ag.js ←── puppeteer-core
  ↓
CDP port 9222 ←── AG launch command

wake-up.sh ──→ logged-claude.sh ──→ asciinema
     ↓
  rotate-logs.sh
```

### Testing After Changes

| Changed | Test Command |
|---------|-------------|
| Skin files | Refresh browser, check dropdown |
| ag.js | `node ag.js status` |
| Watchers | `curl http://localhost:3001/api/streams/status` |
| Injection | Dashboard status indicator |
| Wake-up | Fresh terminal: `./scripts/wake-up.sh "test"` |

---

## 12. Troubleshooting

### Common Issues

**CC won't start:**
```bash
# Check if Claude Code is installed
which claude

# Check VS Code extension
code --list-extensions | grep claude
```

**AG won't connect:**
```bash
# Check CDP port
curl -s http://127.0.0.1:9222/json/list

# If "Connection refused":
# 1. AG not running, or
# 2. AG not started with --remote-debugging-port=9222
```

**tmux injection fails (CC):**
```bash
# Check session exists
tmux has-session -t claude
echo $?  # 0 = exists

# Create if missing
tmux new-session -d -s claude
```

**Codex won't connect:**
```bash
# Check if Codex is installed
codex --version

# Check tmux session exists
tmux has-session -t codex
echo $?  # 0 = exists

# Check Codex status
node interlateral_dna/codex.js status

# If session exists but Codex not running:
tmux send-keys -t codex "codex --sandbox workspace-write --ask-for-approval never" Enter
```

**Dashboard shows "connecting...":**
```bash
# Check backend
curl http://localhost:3001/api/streams/status

# Restart if needed
cd interlateral_comms_monitor/server && npm start
```

**Skin not appearing:**
```bash
# Check file name matches *Skin.tsx
ls ui/src/skins/

# Check console for warnings
# "[Skins] Invalid skin module: ..."
```

### Diagnostic Commands

```bash
# Full tri-agent system check
curl -s http://127.0.0.1:9222/json/list | head -5  # AG CDP
tmux has-session -t claude && echo "CC tmux OK"    # CC
tmux has-session -t codex && echo "Codex tmux OK"  # Codex
curl http://localhost:3001/api/streams/status      # Dashboard
node interlateral_dna/ag.js status                 # AG status
node interlateral_dna/cc.js status                 # CC status
node interlateral_dna/codex.js status              # Codex status
```

### Recovery Procedures

**AG crashed mid-task:**
1. Relaunch AG: `/Applications/Antigravity.app/Contents/MacOS/Electron --remote-debugging-port=9222 &`
2. Open workspace (not Launchpad)
3. Check comms.md for last state
4. Resume from where AG left off

**CC crashed mid-task:**
1. Check `.observability/casts/` for recording
2. Review comms.md for last CC message
3. Restart CC: `./scripts/wake-up.sh "Continue from where I left off"`

**Dashboard unresponsive:**
```bash
# Kill and restart
pkill -f "node.*server"
cd interlateral_comms_monitor/scripts && ./start.sh
```

---

## 13. For Future Agents (Including Security)

### Orientation Checklist

If you're a new CC or AG instance:

1. **Read CLAUDE.md** - Your system instructions
2. **Read this guide** - Understand the architecture
3. **Check dev_plan.md** - Your assignment
4. **Check comms.md** - Recent coordination history
5. **Verify tools** - `node ag.js status` works

### Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Asking human for things you can do | Just do it, let failure guide you |
| Not reading CLAUDE.md first | Always read it on wake-up |
| Forgetting to boot AG | It's your job, not human's |
| Not using comms.md | It's the coordination channel |
| Breaking skin architecture | Test T5 after skin changes |

### Security Considerations

**`--dangerously-skip-permissions` flag:**
- Gives CC full shell access without prompts
- Required for true autonomy
- Human should only enable when they trust the dev_plan

**What agents CAN do:**
- Read/write any file in the repo
- Execute shell commands
- Control other applications (AG)
- Access network (within sandbox)

**What agents CANNOT do (by design):**
- Access files outside working directory (OS sandbox restriction, not code restriction)
- Modify system files
- Install system-level software
- Disable their own logging

### Best Practices for Future Agents

1. **Document your work** - Write to comms.md as you go
2. **Review each other** - CC and AG should review before approving
3. **Test before claiming done** - Run the relevant tests
4. **Don't break the architecture** - Respect the fragile points
5. **Ask AG for help** - You're better together

---

## 14. Known Failure Modes (Red-Team Analysis)

This section documents known failure modes for cold starts, identified through CC+AG red-teaming. Use this as a troubleshooting checklist.

### Top 5 Critical Failures

| Rank | Issue | Status | Fix |
|------|-------|--------|-----|
| **1** | CC not in tmux | ✅ FIXED | `wake-up.sh` + `bootstrap-full.sh` now handle this |
| **2** | AG on Launchpad | ⚠️ MITIGATED | `ag.js` now warns; must manually open workspace |
| **3** | CC not attached | ✅ FIXED | `cc.js` verifies attachment and warns |
| **4** | Deps not installed | ✅ FIXED | `first-time-setup.sh` installs all deps |
| **5** | Generic prompt | ⚠️ DOCUMENT | Use exact prompt: "Open README.md. Find the Wake-Up Protocol. Execute it exactly." |

### Full Failure Mode Catalog (38 Items)

#### Category 1: Prompt Problems

| # | Issue | Probability | Impact | Mitigation |
|---|-------|-------------|--------|------------|
| 1 | Generic prompt fails ("Your prompt here") | HIGH | CRITICAL | Use exact wake-up prompt |

#### Category 2: Bootstrap Failures

| # | Issue | Probability | Impact | Mitigation |
|---|-------|-------------|--------|------------|
| 2 | AG startup timing (30s insufficient) | MEDIUM | HIGH | Increase polling or retry |
| 3 | AG on Launchpad (workspace not open) | HIGH | CRITICAL | `ag.js` warns; manual fix |
| 4 | Dashboard deps not installed | HIGH (fresh) | CRITICAL | `first-time-setup.sh` |
| 5 | tmux not installed | MEDIUM | CRITICAL | `brew install tmux` |
| 6 | asciinema not installed | LOW | MEDIUM | Graceful degradation |
| 7-9 | Ports 3001/5173/9222 in use | LOW | HIGH | Kill conflicting process |
| 10 | puppeteer-core not installed | HIGH (fresh) | CRITICAL | `first-time-setup.sh` |
| 11 | AG app not installed | LOW | CRITICAL | Manual install |
| 24 | Node.js not installed | MEDIUM | CRITICAL | `first-time-setup.sh` checks |
| 25 | Node version too old (< 18) | MEDIUM | HIGH | `first-time-setup.sh` checks |
| 26 | npm cache corrupted | LOW | HIGH | `npm cache clean --force` |
| 27 | AG already running (wrong workspace) | MEDIUM | CRITICAL | Check before launch |
| 28 | `start.sh` hangs | LOW | HIGH | Check npm processes |
| 29 | Script permissions wrong | MEDIUM | HIGH | `first-time-setup.sh` fixes |

#### Category 3: CC Behavior Issues

| # | Issue | Probability | Impact | Mitigation |
|---|-------|-------------|--------|------------|
| 12 | CC not in tmux | HIGH | CRITICAL | ✅ Fixed by `wake-up.sh` |
| 13 | CC skips Phase 0 | MEDIUM | HIGH | CLAUDE.md instructions |
| 14 | CC context fills (long session) | MEDIUM | MEDIUM | Use summarization |
| 15 | CC permission prompts | LOW | MEDIUM | Use `--dangerously-skip-permissions` |
| 16 | CC reads wrong file first | MEDIUM | HIGH | CLAUDE.md specifies priority |
| 17 | CC in VS Code not Terminal | HIGH | CRITICAL | User must use Terminal app |

#### Category 4: AG Behavior Issues

| # | Issue | Probability | Impact | Mitigation |
|---|-------|-------------|--------|------------|
| 30 | AG doesn't read ANTIGRAVITY.md | HIGH | HIGH | ANTIGRAVITY.md exists |
| 31 | AG only writes comms.md (no cc.js) | HIGH | CRITICAL | Document in ANTIGRAVITY.md |
| 32 | AG context fills | MEDIUM | MEDIUM | Use summarization |
| 33 | AG workspace changed | LOW | HIGH | Check before send |

#### Category 5: Communication Failures

| # | Issue | Probability | Impact | Mitigation |
|---|-------|-------------|--------|------------|
| 18 | ag.js send fails silently | MEDIUM | HIGH | Check status after send |
| 19 | AG doesn't respond | MEDIUM | HIGH | Retry or check manually |
| 20 | comms.md too large | LOW | MEDIUM | Log rotation |
| 34 | cc.js send fails (CC not attached) | HIGH | CRITICAL | ✅ Fixed: cc.js warns |
| 35 | Message escaping breaks | MEDIUM | HIGH | Escape special chars |
| 36 | Both agents waiting (deadlock) | MEDIUM | HIGH | Timeout/heartbeat |
| 39 | tmux injection clogged (Enter race) | HIGH | CRITICAL | ✅ FIXED: Add 1s delay between text and Enter |

#### Category 5B: Codex-Specific Failures (Tri-Agent)

| # | Issue | Probability | Impact | Mitigation |
|---|-------|-------------|--------|------------|
| 40 | Codex not installed | MEDIUM | LOW | Graceful degradation; skip Codex |
| 41 | Codex session exists but not running | MEDIUM | HIGH | `bootstrap-full.sh` starts Codex |
| 42 | codex.js send fails | MEDIUM | HIGH | Check `codex.js status` |
| 43 | Codex doesn't read AGENTS.md | HIGH | HIGH | AGENTS.md exists |
| 44 | Codex context fills | MEDIUM | MEDIUM | Use summarization |

#### Category 5C: Tri-Agent Coordination Failures

| # | Issue | Probability | Impact | Mitigation |
|---|-------|-------------|--------|------------|
| 45 | Three-way deadlock (all waiting) | MEDIUM | CRITICAL | `reset-leadership.sh` |
| 46 | Leadership config invalid | LOW | HIGH | Validate leadership.json |
| 47 | Wrong agent as lead | LOW | MEDIUM | Edit leadership.json |
| 48 | ACK timeout too short | MEDIUM | MEDIUM | Increase `ack_timeout_seconds` |
| 49 | Broadcast fails partially | MEDIUM | HIGH | Dashboard retries individually |

#### CRITICAL FIX: tmux Injection Race Condition (2026-01-21)

**Problem:** Messages sent via `tmux send-keys` appear in CC's input but don't auto-submit. They get "clogged" in the input box.

**Root Cause:** Claude Code's input buffer needs time to process injected text before receiving the Enter key. Without a delay, Enter arrives too fast, creating a race condition where the text is visible but not submitted.

**Solution:** Always use a 1-second delay between text and Enter:
```bash
# Correct pattern (ALWAYS use this)
tmux send-keys -t claude 'Your message' && sleep 1 && tmux send-keys -t claude Enter

# Wrong pattern (causes clogging)
tmux send-keys -t claude 'Your message' Enter
```

**Status:** Fixed in `cc.js` on 2026-01-21. AG must use this pattern for reliable CC injection.

**Discovery:** Found through volley testing between CC and AG. Without the delay, 2+ volleys consistently failed. With the delay, communication is 100% reliable.

#### Category 6: Environment Issues

| # | Issue | Probability | Impact | Mitigation |
|---|-------|-------------|--------|------------|
| 21 | Hardcoded paths fail | LOW | HIGH | Use REPO_ROOT variable |
| 22 | Stale tmux session | MEDIUM | MEDIUM | `bootstrap-full.sh` cleans |
| 23 | Network/localhost issues | LOW | HIGH | Check firewall |
| 37 | CC starts before bootstrap | MEDIUM | HIGH | Bootstrap runs first |
| 38 | Multiple bootstrap runs (race) | LOW | MEDIUM | Idempotent design |

### Quick Diagnostic Script (Tri-Agent)

```bash
#!/bin/bash
# Paste this into terminal to diagnose tri-agent cold start issues

echo "=== Tri-Agent Cold Start Diagnostic ==="
echo ""

# 1. Node
echo "Node.js: $(node -v 2>/dev/null || echo 'NOT INSTALLED')"

# 2. tmux
echo "tmux: $(tmux -V 2>/dev/null || echo 'NOT INSTALLED')"

# 3. CC Session
tmux has-session -t claude 2>/dev/null && echo "CC tmux session: EXISTS" || echo "CC tmux session: MISSING"

# 4. Codex Session (optional)
tmux has-session -t codex 2>/dev/null && echo "Codex tmux session: EXISTS" || echo "Codex tmux session: MISSING (optional)"

# 5. AG CDP
curl -s http://127.0.0.1:9222/json/list >/dev/null 2>&1 && echo "AG CDP: READY" || echo "AG CDP: NOT RESPONDING"

# 6. Codex installed (optional)
command -v codex >/dev/null 2>&1 && echo "Codex CLI: INSTALLED" || echo "Codex CLI: NOT INSTALLED (optional)"

# 5. Dashboard
curl -s http://localhost:3001/api/streams/status >/dev/null 2>&1 && echo "Dashboard: READY" || echo "Dashboard: NOT RESPONDING"

# 6. Dependencies
[ -d "interlateral_dna/node_modules" ] && echo "DNA deps: INSTALLED" || echo "DNA deps: MISSING"
[ -d "interlateral_comms_monitor/server/node_modules" ] && echo "Server deps: INSTALLED" || echo "Server deps: MISSING"

echo ""
echo "If issues found, run: ./scripts/first-time-setup.sh"
```

---

## Quick Reference Card (Tri-Agent)

### Key Commands

```bash
# Start everything (one command!)
./scripts/wake-up.sh "Your prompt"

# Start dashboard
cd interlateral_comms_monitor/scripts && ./start.sh

# Start CC in tmux (for injection)
cd interlateral_comms_monitor/scripts && ./start-cc-tmux.sh

# Start Codex in tmux
./scripts/start-codex-tmux.sh

# Launch AG with CDP
/Applications/Antigravity.app/Contents/MacOS/Electron --remote-debugging-port=9222 &

# Send message to AG
node interlateral_dna/ag.js send "message"

# Send message to CC
node interlateral_dna/cc.js send "message"

# Send message to Codex
node interlateral_dna/codex.js send "message"

# Check all agent status
node interlateral_dna/ag.js status
node interlateral_dna/cc.js status
node interlateral_dna/codex.js status

# Reset leadership deadlock
./scripts/reset-leadership.sh

# Live monitor coordination
tail -f interlateral_dna/comms.md
```

### Key Ports

| Port | Service |
|------|---------|
| 3001 | Dashboard backend |
| 5173 | Dashboard frontend |
| 9222 | AG CDP endpoint |

### Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | CC instructions |
| `ANTIGRAVITY.md` | AG instructions |
| `AGENTS.md` | Codex instructions |
| `comms.md` | Coordination log |
| `dev_plan.md` | Task assignment |
| `leadership.json` | Tri-agent leadership config |
| `ag.js` | AG control script |
| `cc.js` | CC control script |
| `codex.js` | Codex control script |

---

*Guide created by CC + AG for Sprint 2C on 2026-01-21*
*Updated for Tri-Agent Mesh (CC + AG + Codex) on 2026-01-22*
