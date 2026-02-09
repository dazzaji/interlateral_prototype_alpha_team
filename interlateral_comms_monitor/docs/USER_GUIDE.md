# Interlateral Comms Monitor - User Guide

**Version:** 1.0
**Date:** 2026-01-21
**Authors:** Claude Code (CC) + Antigravity (AG)

---

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Running the Application](#running-the-application)
4. [Terminal + tmux Setup for CC](#terminal--tmux-setup-for-cc)
5. [Using the Dashboard](#using-the-dashboard)
6. [Command Injection](#command-injection)
7. [Available Skins](#available-skins)
8. [Export Features](#export-features)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Interlateral Comms Monitor is a real-time dashboard for monitoring and interacting with Claude Code (CC) and Antigravity (AG) agents. It provides:

- Live streaming of agent communications
- Multiple view styles (skins) with plugin architecture
- Direct injection of messages to CC, AG, or both
- Export capabilities (JSON/TXT/CSV)

---

## Installation

### Prerequisites

- Node.js 18+
- npm 9+
- macOS (for full injection features)
- tmux (optional but recommended for CC injection)

### Quick Start

```bash
# From repo root
cd interlateral_comms_monitor
npm install --prefix server
npm install --prefix ui

# Run the app
./scripts/start.sh
```

**Backend:** http://localhost:3001
**Frontend:** http://localhost:5173

---

## Running the Application

### Standard Launch (from scripts folder)

```bash
cd interlateral_comms_monitor/scripts
./start.sh
```

### Manual Launch

```bash
# Terminal 1: Backend
cd interlateral_comms_monitor/server
npm start

# Terminal 2: Frontend
cd interlateral_comms_monitor/ui
npm run dev
```

---

## Terminal + tmux Setup for CC

For reliable direct injection to Claude Code, run CC in Terminal.app with tmux. This provides:

- **Reliable injection** via `tmux send-keys`
- **Telemetry capture** via `tmux pipe-pane`
- **Session persistence** across terminal disconnects

### Why tmux > VS Code Terminal?

| Feature | Terminal + tmux | VS Code Terminal |
|---------|-----------------|------------------|
| Direct Injection | `tmux send-keys` - RELIABLE | AppleScript - UNRELIABLE |
| Telemetry Capture | `tmux pipe-pane` - EASY | Requires extensions |
| Session Persistence | Survives disconnect | Lost on close |
| Claude Code Features | ALL work | ALL work |

### Setup Instructions

#### Step 1: Install tmux (if needed)

```bash
brew install tmux
```

#### Step 2: Start CC in tmux Session

**Option A: Use the start script (recommended)**

```bash
cd interlateral_comms_monitor/scripts
./start-cc-tmux.sh
```

**Option B: Manual setup**

```bash
# Create tmux session named 'claude'
tmux new-session -d -s claude

# Start telemetry capture (replace with your actual absolute path)
tmux pipe-pane -t claude "cat >> /Users/yourname/path/to/interlateral_dna/cc_telemetry.log"

# Attach to session
tmux attach -t claude

# Start Claude Code
claude
```

**Note:** Replace `/Users/yourname/path/to/` with the actual absolute path to your repo.

#### Step 3: Verify Session

```bash
# Check session exists
tmux has-session -t claude && echo "Session active"

# List sessions
tmux list-sessions
```

### tmux Injection Mechanism

Once CC runs in tmux session 'claude', the dashboard can inject messages directly:

```bash
# How injection works (internal)
tmux send-keys -t claude "Your message here" Enter
```

The dashboard automatically detects tmux availability and uses it as the PRIMARY injection method.

### tmux Telemetry Capture

The `pipe-pane` feature captures all CC terminal output:

```bash
# Enable capture
tmux pipe-pane -t claude "cat >> cc_telemetry.log"

# Disable capture
tmux pipe-pane -t claude ""
```

Captured data includes:
- CC prompts and responses
- Tool invocations
- Error messages
- Full session transcript

### VS Code Fallback

If tmux is unavailable, the dashboard falls back to other methods.

**Priority Order:** tmux → AppleScript → comms.md

1. **tmux send-keys** (PRIMARY) - most reliable, requires tmux session
2. **AppleScript injection** (macOS only) - sends keystrokes to VS Code
3. **comms.md logging** - always available as backup

Check injection status in the dashboard UI - a green indicator means tmux is active.

### Custom Session Names

By default, the system looks for a tmux session named `claude`. To use a different name:

```bash
# Set custom session name
export CC_TMUX_SESSION=my-claude-session

# Create session with custom name
tmux new-session -d -s my-claude-session
```

---

## Using the Dashboard

### Opening the Dashboard

Navigate to http://localhost:5173 in your browser.

### Main Interface

- **Top Bar:** Skin selector + Export buttons
- **Main Area:** Event stream display (varies by skin)
- **Bottom Bar:** Navigation controls + Command input

### Navigation Controls

- **Live/Paused Indicator:** Shows if auto-scroll is active
- **Jump to Now:** Returns to bottom and resumes auto-scroll
- **New Events Badge:** Shows count of events received while paused

### Scroll Behavior

- **Auto-scroll:** Enabled by default, keeps you at latest events
- **Scroll-lock:** Automatically pauses when you scroll up
- **Resume:** Click "Jump to Now" or scroll to bottom

---

## Command Injection

### Target Selection

- **CC:** Inject to Claude Code only
- **AG:** Inject to Antigravity only
- **BOTH:** Inject to both agents simultaneously

### Injection Methods

The dashboard uses these methods in order of preference:

**For CC:**
1. tmux send-keys (PRIMARY - if session exists)
2. AppleScript to VS Code (FALLBACK - macOS)
3. comms.md file write (ALWAYS - backup)

**For AG:**
1. CDP via Puppeteer (requires AG running with `--remote-debugging-port=9222`)

### How to Use

1. Type your message in the input box
2. Select target (CC, AG, or BOTH)
3. Press Enter or click Send

### Status Indicator

The green/gray circle next to the input shows tmux availability:
- **Green:** tmux session 'claude' is active - direct injection enabled
- **Gray:** tmux not available - using fallback methods

---

## Available Skins

### Cockpit Skin

Split-screen view with resizable panes:
- Left: CC events
- Right: AG events
- Bottom: Communications (collapsible)

Features:
- Draggable dividers
- Collapsible comms panel
- Independent scroll per pane

### Timeline Skin

Chronological interleaved view of all events:
- Events from all sources merged by timestamp
- Color-coded by source (CC/AG/Comms)
- Expandable event details

### Focus Skin

Tabbed interface:
- Tab per source (CC, AG, Comms)
- Unread badges show new event counts
- Clean, focused single-source view

### Adding Custom Skins

See SKIN_DEV_GUIDE.md for creating custom skins. New `.tsx` files in `ui/src/skins/` are automatically discovered.

---

## Export Features

### Available Formats

- **JSON:** Machine-readable, includes all metadata
- **TXT:** Human-readable, formatted text
- **CSV:** Spreadsheet-compatible

### How to Export

1. Click the format button (JSON/TXT/CSV) in the top bar
2. File downloads with date-stamped filename
3. Example: `events-2026-01-21-143022.json`

### Single-Stream Export

Use the dropdown to export only specific sources (CC, AG, or Comms).

---

## Troubleshooting

### tmux Issues

**Problem:** tmux session not detected

```bash
# Check if session exists
tmux has-session -t claude
echo $?  # 0 = exists, 1 = not found

# List all sessions
tmux list-sessions

# Create session if missing
tmux new-session -d -s claude
```

**Problem:** "duplicate session: claude" error

```bash
# Session already exists - kill and recreate
tmux kill-session -t claude
tmux new-session -d -s claude

# Or just attach to existing session
tmux attach -t claude
```

**Problem:** Injection not working

```bash
# Test manual injection
tmux send-keys -t claude "echo test" Enter

# Check if claude session is attached
tmux list-sessions  # Look for "(attached)"
```

**Problem:** pipe-pane not capturing

```bash
# Re-enable capture
tmux pipe-pane -t claude "cat >> /path/to/cc_telemetry.log"

# Verify file is being written
tail -f /path/to/cc_telemetry.log
```

### Dashboard Issues

**Problem:** Dashboard shows "connecting..."

- Check backend is running: http://localhost:3001/api/streams/status
- Restart backend: `cd server && npm start`

**Problem:** No events appearing

- Check file watchers: `ls -la interlateral_dna/comms.md`
- Add test content: `echo "test" >> interlateral_dna/comms.md`
- Check WebSocket: Browser DevTools → Network → WS

**Problem:** Injection always falls back to comms.md

For CC:
- Verify tmux session exists: `tmux has-session -t claude`
- Start CC in tmux: `./scripts/start-cc-tmux.sh`

For AG:
- Verify AG running with CDP: Must launch with `--remote-debugging-port=9222`
- Check CDP port: `curl http://localhost:9222/json`

### AG Connection Issues

**Problem:** AG injection fails

```bash
# Check AG is running with CDP
curl http://localhost:9222/json

# Launch AG with CDP enabled
/Applications/Antigravity.app/Contents/MacOS/Electron --remote-debugging-port=9222 &
```

### General Issues

**Problem:** CORS errors in browser

- Ensure backend is running on port 3001
- Check vite.config.ts has correct proxy settings

**Problem:** High CPU usage

- File watcher may be polling too frequently
- Check for recursive watch loops

---

## Quick Command Reference

| Action | Command |
|--------|---------|
| Start app | `./scripts/start.sh` |
| Start CC in tmux | `./scripts/start-cc-tmux.sh` |
| Check tmux session | `tmux has-session -t claude` |
| Manual tmux injection | `tmux send-keys -t claude "msg" Enter` |
| Start AG with CDP | `/Applications/Antigravity.app/Contents/MacOS/Electron --remote-debugging-port=9222 &` |
| Check backend | `curl http://localhost:3001/api/streams/status` |
| Check AG CDP | `curl http://localhost:9222/json` |
| View CC telemetry | `tail -f interlateral_dna/cc_telemetry.log` |

---

*Documentation created by CC + AG for Sprint 2C on 2026-01-21*
