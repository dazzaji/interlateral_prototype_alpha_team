# Interlateral DNA: Technical Documentation

> **Location:** `interlateral_dna/` - This directory contains the CC ↔ AG control infrastructure.
>
> **For wake-up instructions:** See the main `../README.md` in the repo root.
>
> **This file:** Complete technical reference for the control scripts.

---

# Claude Code Controls Antigravity: Complete Setup Guide

## Quick Start for Claude Code (Cold Start)

> **For future Claude Code instances:** Follow these steps to get working with Antigravity from a cold start. You can run all commands yourself — don't ask the human.

```bash
# 1. Launch Antigravity with CDP (you can do this)
/Applications/Antigravity.app/Contents/MacOS/Electron --remote-debugging-port=9222 &
sleep 3

# 2. Verify CDP is available and workspace is open
curl -s http://127.0.0.1:9222/json/list | jq '.[] | {title: .title, url: .url}'
# Look for URL containing "workbench.html" (NOT "jetski"). Title may be "YourProject" or "YourProject — file.ext"

# 3. Navigate to the control scripts directory
cd /path/to/claude_code_controls_antigravity  # Adjust path for your repo

# 4. Install dependencies if needed
npm install

# 5. Test connection
node ag.js status
# Should show: "status": "connected" with workspace title (NOT "Launchpad")

# 6. Send ACK request
node ag.js send "[CC] @AG Connection test. Please respond ACK."

# 7. Wait and screenshot to see response
sleep 10 && node ag.js screenshot /tmp/ag_response.png
```

**If `status` shows "Launchpad":** A workspace hasn't opened yet. The human needs to click a workspace in Antigravity, or wait for auto-restore.

**If `send` returns "Could not find chat input":** The Agent Manager panel isn't visible. Ask human to open it (right sidebar).

**Workspace Independence:** This setup works with ANY Antigravity workspace. The repo context doesn't matter — the control scripts just need to be accessible from your working directory.

---

## Overview

This document describes how to enable **Claude Code** (Anthropic's CLI agent running in VS Code or terminal) to **send commands to Google Antigravity** (Google's agentic IDE based on VS Code). This creates a multi-agent system where Claude Code can:

- **Send messages/commands** to Antigravity programmatically (full capability)
- **Monitor responses** via screenshots and DOM text extraction (partial - see Limitations)
- **Coordinate tasks** through shared files (comms.md)
- **Enable human oversight** through logging (ag_log.md)

### Important Limitation

This is currently **Input Injection + Screenshot Monitoring**, not full bidirectional control. Claude Code can:
- ✅ Send any message to Antigravity's chat
- ✅ Take screenshots to see AG's response
- ✅ Read the Agent Manager panel text
- ⚠️ Cannot programmatically extract AG's latest response as structured data (requires manual `log-response` or screenshot inspection)

For true feedback-loop control, the human operator monitors `comms.md` where both agents write, and can use `ag_log.md` to see CC's commands.

**Date Established:** January 18, 2026
**Agents:** Claude Code (Opus 4.5) + Antigravity (Gemini 3 Pro)
**Platform:** macOS (Darwin)

---

## Critical Architecture Note (v1.2)

> ⚠️ **READ THIS FIRST** — Previous documentation was incorrect about CDP page structure.

**The Agent Manager panel is NOT a standalone CDP page.** It is rendered as an **iframe** (`cascade-panel.html`) embedded inside the workspace page.

### CDP Target Structure (Actual)

| CDP Page Title | URL Pattern | What It Is |
|----------------|-------------|------------|
| `Launchpad` | `workbench-jetski-agent.html` | Workspace selector (NOT what you want) |
| `ProjectName` or `ProjectName — file.ext` | `workbench.html` | Workspace with **embedded** Agent Manager iframe |
| `TextEditorWorker` | blob URL | Background worker (ignore) |

### What This Means for ag.js (v1.2.1+)

1. **Page targeting:** Find workspace page by URL containing `workbench.html` but NOT containing `jetski`
   - ⚠️ **Do NOT rely on title format** — title may be just `ProjectName` if no file is open
2. **DOM access:** Must navigate INTO the iframe (`cascade-panel.html`) to find chat input
3. **Old documentation was wrong:** There is no standalone "Manager" CDP target

### Quick Verification

```bash
# List CDP targets with URLs (important - check URL, not just title)
curl -s http://127.0.0.1:9222/json/list | jq '.[] | {title: .title, url: .url}'

# You should see something like:
# {"title": "Launchpad", "url": "...workbench-jetski-agent.html"}  <-- NOT this
# {"title": "YourProject", "url": "...workbench.html"}             <-- THIS is the target
```

---

## Prerequisites

### Software Requirements

| Component | Version | Purpose |
|-----------|---------|---------|
| macOS | Sequoia (15.x)+ | Host operating system |
| Node.js | v20.0.0+ (LTS or newer) | Runtime for control scripts |
| Antigravity | 1.104.0+ | Target IDE to control |
| VS Code | Latest | Host for Claude Code extension |
| puppeteer-core | 22.x+ | CDP automation library |

### Verification Commands

```bash
# Check Node.js
node --version  # Should be v20+ (LTS)

# Check Antigravity installation
ls /Applications/Antigravity.app

# Check if Antigravity is running
ps aux | grep -i antigravity | grep -v grep
```

---

## Cold Start Setup (Step-by-Step)

> **For Claude Code:** You can execute these steps yourself. Don't ask the human to run commands you can run.

### Step 1: Launch Antigravity with Remote Debugging

**Critical:** Antigravity must be launched with Chrome DevTools Protocol (CDP) enabled.

```bash
# Quit Antigravity if running (Cmd+Q)

# Launch with remote debugging port (run in background)
/Applications/Antigravity.app/Contents/MacOS/Electron --remote-debugging-port=9222 &

# Wait for startup
sleep 3
```

**Expected Output:**
```
DevTools listening on ws://127.0.0.1:9222/devtools/browser/...
```

**Note:** The executable is named `Electron`, not `Antigravity`. This is because Antigravity is built on Electron.

**Important:** After Antigravity launches:
1. A workspace should auto-restore (or human selects one from Launchpad)
2. Ensure the **Agent Manager** panel is visible (the right sidebar with chat)
3. The Agent Manager is an **iframe inside the workspace page**, not a separate CDP target

> ⚠️ **Security Warning:** The `--remote-debugging-port` flag exposes powerful control over the application. Keep it bound to localhost (127.0.0.1) only. Never expose port 9222 to the network or internet. Do not port-forward this connection.

### Step 2: Verify CDP Connection

```bash
# Check available targets (look at URLs, not just titles)
curl -s http://127.0.0.1:9222/json/list | jq '.[] | {title: .title, url: .url}'
```

**Expected:** You should see entries like:
```json
{"title": "Launchpad", "url": "...workbench-jetski-agent.html"}
{"title": "YourProjectName", "url": "...workbench.html"}
```

**Important:** Look for a URL containing `workbench.html` (but NOT `jetski`). That's the workspace page containing the Agent Manager iframe. The title may be just "YourProjectName" or "YourProjectName — file.ext" depending on whether a file is open — the URL is what matters. If you only see "Launchpad" (with `jetski` in its URL), the workspace hasn't opened yet.

### Step 3: Install Dependencies

> **Note:** If you copied the `claude_code_controls_antigravity` folder (Step 5), run these commands **inside that folder** where `package.json` already exists. Skip `npm init -y` in that case.

```bash
# If starting fresh (no package.json):
npm init -y          # -y accepts all defaults (no prompts)
npm install puppeteer-core
```

### Step 4: Grant Accessibility Permissions (macOS) [OPTIONAL]

> **Note:** This step is only required if you want to use the osascript fallback methods. The primary CDP approach does NOT require accessibility permissions.

For osascript fallback methods (optional):

1. **System Settings → Privacy & Security → Accessibility**
2. **Add VS Code (or Terminal)**
3. **Toggle ON**

### Step 5: Deploy Control Scripts

**Option A: Copy the entire directory** (recommended):
```bash
cp -r projects/claude_code_controls_antigravity /path/to/your/project/
cd /path/to/your/project/claude_code_controls_antigravity
npm install
```

**Option B: Minimal setup** (if starting fresh):

The only **required** files are:
- `ag.js` - Main control script (self-contained, no local dependencies)
- `ag_log.md` - Communication log (create empty or use template from Addenda)
- `package.json` - Dependencies

Other `ag_*.js` files in the directory are standalone utilities, not required by `ag.js`.

```bash
# Minimal setup:
mkdir my-ag-controller && cd my-ag-controller
# Copy ag.js, package.json from Addenda section below
npm install
touch ag_log.md
```

### Step 6: Test the Connection

```bash
node ag.js status
```

**Expected Output:**
```json
{
  "status": "connected",
  "title": "YourProjectName — somefile.ext",
  ...
}
```

> **Note:** The title should be your workspace name, NOT "Manager" or "Launchpad". If you see "Launchpad", the workspace hasn't opened or ag.js is targeting the wrong page.

### Step 7: Send Test Message

```bash
node ag.js send "Hello from Claude Code. Please respond ACK."
```

Check Antigravity's Agent Manager panel for the response.

---

## Architecture

### Communication Channels

```
┌─────────────────┐         ┌─────────────────┐
│   Claude Code   │         │   Antigravity   │
│   (VS Code)     │         │   (Electron)    │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │    CDP (Port 9222)        │
         │◄─────────────────────────►│
         │                           │
         │    comms.md (shared)      │
         │◄─────────────────────────►│
         │                           │
         │    ag_log.md (CC writes)  │
         │──────────────────────────►│
         │                           │
         ▼                           ▼
┌─────────────────────────────────────────────┐
│              Human Operator                  │
│  (monitors comms.md, ag_log.md, screenshots) │
└─────────────────────────────────────────────┘
```

### Key Files

| File | Purpose | Who Writes | Who Reads |
|------|---------|------------|-----------|
| `comms.md` | Primary coordination | CC + AG | CC + AG + Human |
| `ag_log.md` | CC command log | CC only | AG + Human |
| `ag.js` | Control script | N/A (code) | CC executes |
| `/tmp/ag_*.png` | Screenshots | CC | CC + Human |

---

## Control Script Reference (ag.js)

### Commands

```bash
# Send message to Antigravity
node ag.js send "your message here"

# Read current Agent Manager panel text
node ag.js read

# Take screenshot
node ag.js screenshot [optional-path]

# Check connection status
node ag.js status

# Log AG's response (manual)
node ag.js log-response "AG's response text"
```

### Expected Output: `read` Command

```bash
node ag.js read
```

Returns the **entire visible text** of the Agent Manager panel, including:
- Task list items with timestamps
- Button labels
- Agent conversation history (if visible)
- Status indicators

> **Note:** The `read` command returns raw DOM text, not a clean extraction of AG's latest response. For reliable response capture, use screenshots or check `comms.md` where AG writes.

### How It Works

1. **Connect:** Script connects to CDP endpoint at `http://127.0.0.1:9222`
2. **Find Workspace Page:** Locates the workspace page by URL (contains `workbench.html` but NOT `jetski`). Title is NOT checked — it varies based on whether a file is open.
3. **Find Agent Manager Iframe:** Navigates into the `cascade-panel.html` iframe embedded in the workspace
4. **Find Input:** Locates the contenteditable div (chat input) **inside the iframe**
5. **Type & Submit:** Types message and clicks Submit button
6. **Log:** Appends to `ag_log.md` for human visibility

> **Critical:** Steps 2-4 are the key insight. The Agent Manager is NOT a separate CDP page — it's an iframe inside the workspace page. The script must navigate into the iframe to access the chat input.

---

## End-to-End Workflow Example

Here's a complete example of sending a task to AG and monitoring the response:

```bash
# 1. Verify connection
node ag.js status
# Expected: {"status": "connected", "title": "YourProject — file.ext", ...}

# 2. Send a task to AG
node ag.js send "Please create a file named test.txt with 'Hello World' content."
# Expected: {"status": "sent", "message": "Please create..."}
# Check ag_log.md to confirm logging

# 3. Wait for AG to process (human monitors or use sleep)
sleep 10

# 4. Take screenshot to see AG's response
node ag.js screenshot /tmp/ag_response.png
# Expected: {"status": "screenshot saved", "path": "/tmp/ag_response.png"}
# Open the screenshot to read AG's response

# 5. (Optional) Read panel text
node ag.js read
# Returns raw text; useful for quick checks

# 6. Log AG's response manually (for audit trail)
node ag.js log-response "AG confirmed file created successfully."
```

**Coordination via comms.md:** For sustained multi-turn conversations, both CC and AG should read/write to `comms.md` with timestamped entries. This survives context resets and provides a shared state.

---

## Technical Obstacles & Solutions

### Obstacle 1: Finding the Executable Path

**Problem:** Initial path `/Applications/Antigravity.app/Contents/MacOS/Antigravity` doesn't exist.

**Solution:** The executable is named `Electron`:
```bash
/Applications/Antigravity.app/Contents/MacOS/Electron
```

**How to discover:**
```bash
ls /Applications/Antigravity.app/Contents/MacOS/
```

---

### Obstacle 2: Antigravity Not Launched with Debug Port

**Problem:** CDP endpoint not available when Antigravity launched normally.

**Symptom:**
```bash
curl http://127.0.0.1:9222/json/list
# Connection refused
```

**Solution:** Must launch with `--remote-debugging-port=9222` flag.

---

### Obstacle 3: osascript Accessibility Permissions

**Problem:** AppleScript automation blocked by macOS security.

**Symptom:**
```
execution error: osascript is not allowed assistive access. (-1728)
```

**Solution:** Grant Accessibility permissions in System Settings.

**Note:** This is only needed for osascript fallback, not for CDP approach.

---

### Obstacle 4: Puppeteer vs Puppeteer-Core

**Problem:** Full `puppeteer` package tries to download Chromium (unnecessary).

**Solution:** Use `puppeteer-core` which connects to existing browser:
```bash
npm install puppeteer-core
```

**Code change:**
```javascript
// Wrong
const puppeteer = require('puppeteer');

// Correct
const puppeteer = require('puppeteer-core');
```

---

### Obstacle 5: waitForTimeout Not a Function

**Problem:** Newer Puppeteer versions removed `page.waitForTimeout()`.

**Symptom:**
```
{"error":"managerPage.waitForTimeout is not a function"}
```

**Solution:** Use custom sleep function:
```javascript
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Instead of: await page.waitForTimeout(200);
await sleep(200);
```

---

### Obstacle 6: Chat Input is Not a Standard Input/Textarea

**Problem:** Antigravity's chat input is a `contenteditable` div, not `<input>` or `<textarea>`.

**Discovery:** Used DOM probing:
```javascript
document.querySelectorAll('[contenteditable="true"]')
```

**Solution:** Target by class pattern:
```javascript
const input = document.querySelector('[contenteditable="true"].max-h-\\[300px\\]');
```

> ⚠️ **Selector Fragility Warning:** The `.max-h-[300px]` class is a Tailwind CSS utility that may change in future Antigravity updates. See the **Selector Update Playbook** below for maintenance instructions.

---

### Obstacle 7: Agent Manager is an Iframe, Not a Separate Page

**Problem:** Agent Manager panel is **NOT** a separate CDP page target. It's an iframe embedded in the workspace page.

**Previous incorrect assumption:** We expected a CDP target titled "Manager".

**Actual architecture:**
- `Launchpad` - Workspace selector (`workbench-jetski-agent.html`)
- `ProjectName — file.ext` - Workspace with **embedded** Agent Manager iframe
- No standalone "Manager" page exists

**Discovery method:**
```javascript
// Probing the workspace page for iframes:
const frameInfo = await page.evaluate(() => {
    const iframes = document.querySelectorAll('iframe');
    return Array.from(iframes).map(f => ({src: f.src, id: f.id}));
});
// Returns: [{src: ".../cascade-panel.html", id: "antigravity.agentPanel"}]
```

**Solution:** Two-step targeting:
```javascript
// Step 1: Find workspace page by URL (not Launchpad)
// IMPORTANT: Don't check title format - it varies based on whether a file is open
for (const page of pages) {
    const url = page.url();
    if (url.includes('workbench.html') && !url.includes('jetski')) {
        return page;  // This is the workspace
    }
}

// Step 2: Find Agent Manager iframe within workspace
const frames = page.frames();
for (const frame of frames) {
    if (frame.url().includes('cascade-panel')) {
        return frame;  // This is the Agent Manager
    }
}
```

---

### Obstacle 8: Connecting to Launchpad Instead of Workspace

**Problem:** Script connects to Launchpad instead of the workspace page.

**Symptom:**
```bash
node ag.js status
# Returns: {"status": "connected", "title": "Launchpad", ...}
# Screenshot shows workspace selector, not Agent Manager
```

**Root cause:** Old ag.js fallback logic looked for pages with "jetski" in URL. Launchpad URL contains `workbench-jetski-agent.html`, triggering the fallback.

**Solution:** Prioritize workspace pages over jetski fallback using URL-based detection:
```javascript
// Correct priority order (v1.2.1):
// 1. Look for page titled "Manager" (legacy, may not exist)
// 2. Look for workspace page by URL (workbench.html but NOT jetski) - DON'T check title
// 3. Fallback to jetski page (Launchpad)
```

---

### Obstacle 9: Reading Chat Content

**Problem:** osascript cannot read Electron app content (renders via Chromium, not native UI).

**Symptom:** `entire contents` returns empty or minimal UI hints.

**Solution:** Use CDP screenshots + DOM text extraction instead of accessibility APIs.

---

### Obstacle 10: Human Visibility

**Problem:** Human cannot see CC→AG communications happening programmatically.

**Solution:** Created `ag_log.md` as a transcript:
- All CC→AG messages logged with timestamps
- AG→CC responses logged manually or via observation
- Human can `tail -f ag_log.md` for live monitoring

---

## Dead Ends (What Didn't Work)

### 1. VS Code Chat Participant API

**Attempted:** Use VS Code's Chat Participant API to intercept Antigravity's agent chat.

**Why it failed:** Chat Participant API is designed for Copilot Chat, not Antigravity's proprietary agent interface. Antigravity's agent UI is not the same surface.

### 2. osascript for Reading Content

**Attempted:** Use AppleScript `entire contents` to read chat messages.

**Why it failed:** Electron apps render content via Chromium WebView, which doesn't expose text to macOS Accessibility APIs in a useful way.

### 3. tmux Terminal Control

**Attempted:** Use tmux to capture/control Antigravity like a terminal app.

**Why it failed:** Antigravity is a GUI application, not a terminal process. tmux only works for CLI agents.

### 4. File-Only Coordination

**Attempted:** Coordinate only via shared files without direct control.

**Why it partially failed:** Works for async coordination, but Claude Code cannot "nudge" a stalled Antigravity or see its real-time thinking without CDP access.

---

## Best Practices

### 1. Always Log Communications

```javascript
function log(direction, message) {
    const timestamp = new Date().toISOString();
    const entry = `\n[${timestamp}] **${direction}:** ${message}\n`;
    fs.appendFileSync('ag_log.md', entry);
}
```

### 2. Take Screenshots After Sending

Screenshots are the most reliable way to verify AG received and processed a message.

### 3. Use comms.md for Coordination

Both agents should read/write to `comms.md` for persistent coordination that survives context resets.

### 4. Verify CDP Connection Before Operations

```javascript
try {
    const browser = await puppeteer.connect({ browserURL: CDP_URL });
    // proceed
} catch (err) {
    console.error('Antigravity not running with debug port');
}
```

### 5. Handle Agent Manager Page Changes

The Manager page ID can change. Always search by URL pattern (`workbench.html` but NOT `jetski`), not by cached ID or title pattern.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| "Connection refused" on port 9222 | AG not launched with debug flag | Restart AG with `--remote-debugging-port=9222` |
| "Connection refused" but AG running | Port 9222 already in use | Check with `lsof -i :9222` and kill conflicting process |
| Status shows `"title": "Launchpad"` | Workspace not opened, or old ag.js version | Open a workspace in AG; update ag.js to v1.2.1 |
| `{"error": "Could not find chat input"}` | Not accessing iframe, or Agent Manager panel closed | Ensure ag.js has `getAgentFrame()` function; open Agent Manager panel |
| Message not appearing in AG | Wrong page targeted or iframe not found | Check `node ag.js status` shows workspace title (not "Launchpad") |
| Screenshot shows Launchpad | ag.js connecting to wrong page | Update ag.js to prioritize workspace pages over jetski fallback |
| Fails when no file is open in workspace | Old ag.js (v1.2) checked for ` — ` in title | Update to ag.js v1.2.1 which uses URL-based detection |
| Message going to wrong workspace | Multiple workspaces open | Close other workspaces or modify ag.js to target specific workspace |
| "Cannot find module puppeteer" | Missing dependency | `npm install puppeteer-core` (not `puppeteer`) |
| osascript permission error | Accessibility not granted | System Settings → Accessibility |

### Port Conflict Check

Before launching Antigravity with debug port, verify the port is free:

```bash
# Check if port 9222 is in use
lsof -i :9222

# If something is using it, either:
# 1. Kill the process: kill -9 <PID>
# 2. Use a different port: --remote-debugging-port=9223
```

**Zombie Process Tip:** If `lsof` shows an Electron process using port 9222 but no Antigravity window is visible, the process is a "zombie" from a previous crash. Kill it with `kill -9 <PID>` before relaunching.

### Multi-Workspace Behavior

**Known limitation:** If you have multiple Antigravity workspaces open, `ag.js` connects to the first "Manager" page it finds. This may not be your intended workspace.

**Workaround:** Close other Antigravity windows before using the control scripts, or modify `ag.js` to filter by workspace title.

---

## Selector Update Playbook

When Antigravity updates break the chat input selector, follow this process:

### Step 1: Identify the Break

```bash
node ag.js send "test"
# If you get: {"error": "Could not find chat input"}
```

### Step 2: Find the New Selector

1. Open Antigravity with the Agent Manager panel visible
2. Open DevTools (Cmd+Option+I or via Chrome's `chrome://inspect`)
3. Navigate to the Manager page in DevTools
4. Use the Elements inspector to find the chat input
5. Look for `contenteditable="true"` attributes

```javascript
// In DevTools Console:
document.querySelectorAll('[contenteditable="true"]')
// Examine each result to find the chat input
```

### Step 3: Identify Unique Attributes

Look for:
- Unique class names (e.g., `max-h-[300px]`, `chat-input`)
- Parent container IDs
- Data attributes (`data-testid`, etc.)
- Nearby elements (Submit button, chat composer wrapper)

### Step 4: Update ag.js

Edit the selector in `ag.js` around line 49:

```javascript
// Old (broken):
let input = document.querySelector('[contenteditable="true"].max-h-\\[300px\\]');

// New (example):
let input = document.querySelector('[contenteditable="true"].NEW-CLASS-HERE');
```

### Step 5: Fallback Strategy

The script includes a fallback to any `[contenteditable="true"]` element. If multiple exist, you may need to:
1. Find the chat composer container first
2. Then locate `contenteditable` within it
3. Verify by checking for nearby "Submit" button

---

## Future Improvements

1. **Automatic response capture:** Parse DOM for AG's latest response instead of manual logging
2. **Workspace targeting:** Ensure messages go to the correct workspace
3. **Bi-directional WebSocket:** Replace polling with real-time event stream
4. **Error recovery:** Auto-reconnect on CDP disconnection
5. **Multi-AG support:** Control multiple Antigravity instances

---

## Files in This Project

```
projects/claude_code_controls_antigravity/
├── README.md          # This documentation
├── ag.js              # Main control script
├── ag_log.md          # Communication transcript
├── ag_send.js         # Simplified send-only script
├── ag_chat.js         # Chat-specific utilities
├── ag_manager.js      # Manager panel utilities
├── ag_probe.js        # DOM probing utilities
└── package.json       # Node.js dependencies
```

---

## Credits

- **Human Operator:** Dazza Greenwood
- **Primary Agent:** Claude Code (Anthropic Opus 4.5)
- **Partner Agent:** Antigravity (Google Gemini 3 Pro)
- **Date:** January 18, 2026

---

## Changelog

- **v1.2.1** (2026-01-18): **DOCUMENTATION CONSISTENCY** - Updated all references from title-based detection to URL-based detection; fixed ADDENDA version string; added troubleshooting entry for "no file open" scenario; updated Quick Start and Best Practices sections
- **v1.2** (2026-01-18): **CRITICAL FIXES** - Agent Manager iframe discovery, updated page targeting, fixed ag.js for current Antigravity architecture
- **v1.1** (2026-01-18): Added ADDENDA with source code, selector playbook, end-to-end workflow, security notes
- **v1.0** (2026-01-18): Initial documentation of CC→AG control setup

---

# ADDENDA: REFERENCE FILES

This section contains the complete source code for all required files. Copy these directly if you don't have access to the original repository.

---

## 1. package.json

```json
{
  "name": "claude-controls-antigravity",
  "version": "1.0.0",
  "description": "Claude Code control scripts for Antigravity",
  "main": "ag.js",
  "scripts": {
    "status": "node ag.js status",
    "send": "node ag.js send",
    "read": "node ag.js read",
    "screenshot": "node ag.js screenshot"
  },
  "dependencies": {
    "puppeteer-core": "^22.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

---

## 2. ag.js (Main Controller) — v1.2.1

> **IMPORTANT:** This version includes critical fixes for iframe-based Agent Manager architecture AND URL-based page detection.

```javascript
#!/usr/bin/env node
// ag.js v1.2.1 - Unified Antigravity control with logging
// All communications are logged to ag_log.md for human visibility
// v1.2.1: Fixed page selection to use URL-based detection (not title pattern)
//
// CRITICAL: Agent Manager is an IFRAME inside the workspace page, not a separate CDP target.

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'ag_log.md');
const CDP_URL = 'http://127.0.0.1:9222';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function log(direction, message) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const entry = `\n[${timestamp}] **${direction}:** ${message}\n`;
    fs.appendFileSync(LOG_FILE, entry);
    console.error(`[LOGGED] ${direction}: ${message.substring(0, 50)}...`);
}

async function getManagerPage() {
    const browser = await puppeteer.connect({ browserURL: CDP_URL });
    const pages = await browser.pages();

    // First, look for a page titled "Manager" (standalone Agent Manager - legacy)
    for (const page of pages) {
        const title = await page.title();
        if (title === 'Manager') {
            return { browser, page };
        }
    }

    // Second, look for a workspace page (workbench.html but NOT jetski/Launchpad)
    // IMPORTANT: Don't require specific title format - just check URL
    // Title may be "ProjectName" or "ProjectName — file.ext" depending on whether a file is open
    for (const page of pages) {
        const url = page.url();
        if (url.includes('workbench.html') && !url.includes('jetski')) {
            return { browser, page };
        }
    }

    // Fallback to Launchpad (jetski page) - least preferred
    const jetski = pages.find(p => p.url().includes('jetski'));
    if (jetski) {
        return { browser, page: jetski };
    }

    throw new Error('Manager page not found. Is Antigravity running with --remote-debugging-port=9222?');
}

async function getAgentFrame(page) {
    // Agent Manager panel is inside an iframe (cascade-panel.html)
    const frames = page.frames();
    for (const frame of frames) {
        if (frame.url().includes('cascade-panel')) {
            return frame;
        }
    }
    return null;
}

async function send(message) {
    const { browser, page } = await getManagerPage();

    // Get the Agent Manager iframe
    const agentFrame = await getAgentFrame(page);
    const targetFrame = agentFrame || page;

    // Find and click the contenteditable chat input
    const inputClicked = await targetFrame.evaluate(() => {
        // Try the specific class first
        let input = document.querySelector('[contenteditable="true"].max-h-\\[300px\\]');
        if (!input) {
            input = document.querySelector('[contenteditable="true"]');
        }
        if (input) {
            input.click();
            input.focus();
            return { found: true };
        }
        return { found: false };
    });

    if (!inputClicked.found) {
        console.log(JSON.stringify({ error: 'Could not find chat input' }));
        await browser.disconnect();
        return;
    }

    await sleep(200);
    await page.keyboard.type(message, { delay: 5 });
    await sleep(100);

    // Click Submit button
    const submitted = await targetFrame.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
            if (btn.innerText.trim() === 'Submit') {
                btn.click();
                return true;
            }
        }
        return false;
    });

    if (!submitted) {
        await page.keyboard.down('Meta');
        await page.keyboard.press('Enter');
        await page.keyboard.up('Meta');
    }

    // Log the message
    log('CC → AG', message);

    console.log(JSON.stringify({ status: 'sent', message: message }));
    await browser.disconnect();
}

async function read() {
    const { browser, page } = await getManagerPage();

    // Try reading from the Agent Manager iframe first
    const agentFrame = await getAgentFrame(page);
    const targetFrame = agentFrame || page;

    const content = await targetFrame.evaluate(() => {
        return document.body.innerText;
    });

    console.log(content);
    await browser.disconnect();
}

async function screenshot(filename = '/tmp/ag_screenshot.png') {
    const { browser, page } = await getManagerPage();
    await page.screenshot({ path: filename });
    console.log(JSON.stringify({ status: 'screenshot saved', path: filename }));
    await browser.disconnect();
}

async function status() {
    try {
        const { browser, page } = await getManagerPage();
        const title = await page.title();

        const info = await page.evaluate(() => {
            const text = document.body.innerText;
            // Extract key info
            const lines = text.split('\n').filter(l => l.trim());
            return {
                tasks: lines.filter(l => l.includes('ago')).slice(0, 5),
                preview: text.substring(0, 500)
            };
        });

        console.log(JSON.stringify({ status: 'connected', title, ...info }, null, 2));
        await browser.disconnect();
    } catch (err) {
        console.log(JSON.stringify({ status: 'error', error: err.message }));
    }
}

async function logResponse(response) {
    // Manually log a response from AG (for when you see it)
    log('AG → CC', response);
    console.log(JSON.stringify({ status: 'logged', response }));
}

// Main
const command = process.argv[2];
const arg = process.argv.slice(3).join(' ');

switch (command) {
    case 'send':
        if (!arg) {
            console.log('Usage: node ag.js send "your message"');
        } else {
            send(arg);
        }
        break;
    case 'read':
        read();
        break;
    case 'screenshot':
        screenshot(arg || '/tmp/ag_screenshot.png');
        break;
    case 'status':
        status();
        break;
    case 'log-response':
        if (!arg) {
            console.log('Usage: node ag.js log-response "AG response text"');
        } else {
            logResponse(arg);
        }
        break;
    default:
        console.log(`
Antigravity Control (ag.js) v1.2.1
==================================
Commands:
  node ag.js send "message"      - Send message to AG (logged to ag_log.md)
  node ag.js read                - Read current AG panel text
  node ag.js screenshot [path]   - Take screenshot
  node ag.js status              - Check connection status
  node ag.js log-response "text" - Manually log AG's response

All communications are logged to: ag_log.md
        `);
}
```

---

## 3. ag_log.md (Template)

```markdown
# Claude Code ↔ Antigravity Communication Log

This file records all programmatic communications from Claude Code to Antigravity.
Human operator can monitor with: `tail -f ag_log.md`

---

[System] Log initialized.
```

---

## 4. comms.md (Template)

```markdown
# Agent Coordination File

**Protocol:**
- Use format: `[AGENT] @TARGET [TIMESTAMP]` for all entries
- Agents: CC (Claude Code), AG (Antigravity)
- Append only - never edit past entries
- Human can also write with `[HUMAN]` tag

---

[System] Coordination file initialized.

---

## Example Entry Format

[CC] @AG [2026-01-18 T12:00:00]
Your message here. Be specific about tasks, requests, or status updates.

---

[AG] @CC [2026-01-18 T12:05:00]
Response here. Include relevant context and next steps.

---
```

---

## 5. Timeout/Retry Guidance

When AG doesn't respond within expected time:

1. **Take a screenshot** to verify AG received the message
2. **Check ag_log.md** to confirm the send was logged
3. **Wait 30-60 seconds** - AG may be processing
4. **Send a "nudge"**: `node ag.js send "Status check - did you receive my last message?"`
5. **Check comms.md** - AG may have written there instead
6. **Escalate to human** if no response after 2-3 attempts

**Human Escalation:**
If automated coordination fails, the human operator should:
1. Manually check Antigravity's Agent Manager panel
2. Verify AG is not in an error state
3. Restart AG with debug port if necessary
4. Resume coordination via comms.md

---

*End of ADDENDA*
