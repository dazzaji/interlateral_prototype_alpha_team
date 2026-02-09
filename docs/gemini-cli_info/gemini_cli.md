# Gemini CLI 

# 🔴 FEBRUARY 2026 UPDATE — KNOWN BUG AFFECTING AUTONOMY

> **Last Updated:** 2026-02-04
> **Gemini CLI Version:** 0.17.0+

---

## CRITICAL: YOLO Mode Has an Open Bug (#13561)

**Status:** Open, P2 priority, "help wanted"

**Problem:** Even with YOLO mode enabled (`--approval-mode=yolo` or `--yolo`), Gemini CLI still asks "Does this plan sound good to you?" requiring user confirmation.

**CLI Output Shows:**
```
YOLO mode is enabled. All tool calls will be automatically approved.
```

Yet it STILL prompts for approval. This is a **confirmed bug**, not misconfiguration.

**GitHub Issue:** https://github.com/google-gemini/gemini-cli/issues/13561

**Workaround:** None available. Must manually approve when prompted, OR have another agent grant the permission.

---

## DEPRECATED: `-y` and `--yolo` Flags

**Do NOT use:**
```bash
gemini -y          # DEPRECATED
gemini --yolo      # DEPRECATED
```

**Use instead:**
```bash
gemini --approval-mode=yolo --sandbox=false
```

The `-y`/`--yolo` flags still function but are deprecated and may interact poorly with other settings (see Issue #13792, now fixed).

---

## CURRENT BEST PRACTICE

```bash
# Maximum autonomy attempt (bug may still cause prompts):
gemini --approval-mode=yolo --sandbox=false
```

**Accept that:**
- Plan confirmations may still prompt (bug #13561)
- Some tool calls may prompt unexpectedly
- Manual intervention may be needed until bug is fixed

---

## FOR QUAD-AGENT MESH: PERMISSION GRANTING

When Gemini stops on a permission prompt, **another agent (CC, CX, or AG) must grant the permission** by injecting the appropriate response into Gemini's tmux session.

See `CLAUDE.md` Section "Permission Granting Protocol" for instructions.

---

**Sources:**
- [Gemini CLI Configuration](https://geminicli.com/docs/get-started/configuration/)
- [GitHub Issue #13561 (Open Bug)](https://github.com/google-gemini/gemini-cli/issues/13561)
- [GitHub Issue #13792 (Fixed)](https://github.com/google-gemini/gemini-cli/issues/13792)

---

# ⚠️ URGENT SUPPLEMENTAL INFO — READ FIRST

> **Add this section to the TOP of your Gemini CLI guide.**
> Last updated: January 2026

---

## 🔴 CRITICAL CORRECTIONS

### 1. `--yolo` is DEPRECATED — Use `--approval-mode=yolo`

```bash
# ❌ DEPRECATED (still works but don't use)
gemini --yolo

# ✅ CORRECT
gemini --approval-mode=yolo
```

The `-y` / `--yolo` flags still function but are deprecated. Always use `--approval-mode=yolo` in scripts, docs, and muscle memory.

**Note:** While the official documentation recommends `--approval-mode=yolo`, in practice, `-y` or `--yolo` may be required to achieve full autonomy.

**Source**: [CLI Reference](https://geminicli.com/docs/cli/cli-reference/)

---

### 2. Resume Sessions from Command Line with `--resume`

```bash
# Resume most recent session
gemini --resume

# Resume specific session by index
gemini --resume 3

# Inside CLI, use /resume for interactive browser
/resume
```

This is **different from** `/chat save/resume` which manages named conversation checkpoints. `--resume` is for session continuity across CLI restarts.

**Source**: [Session Management](https://geminicli.com/docs/cli/session-management/)

---

### 3. Trusted Folders — Why Some Features May Be Disabled

If Gemini CLI seems restricted (no auto-accept, extensions disabled, memory not loading), check if you're in an **untrusted folder**.

**Untrusted folders disable:**
- Automatic tool acceptance
- Extension management
- Automatic memory loading from GEMINI.md

**To trust a folder:**
```bash
# Inside Gemini CLI
/trust
```

**Or configure in settings.json:**
```json
{
  "trustedFolders": [
    "/home/user/projects",
    "/workspace"
  ]
}
```

**Source**: [Trusted Folders](https://google-gemini.github.io/gemini-cli/docs/cli/trusted-folders.html)

---

### 4. Sandbox Default Behavior — BE PRECISE

| Scenario | Sandbox State |
|----------|---------------|
| `gemini` (no flags) | **OFF** |
| `gemini --sandbox` | **ON** |
| `gemini --approval-mode=yolo` | **ON** (auto-enabled) |
| `gemini --approval-mode=yolo --sandbox=false` | **OFF** (explicit override) |

**Note:** In some versions, you may need to use `gemini -y --sandbox=false` to achieve the desired behavior.

**Key insight**: Sandbox is OFF by default for normal use, but ON by default with YOLO. This is the opposite of what you might expect.

**Source**: [Configuration Docs](https://google-gemini.github.io/gemini-cli/docs/get-started/configuration.html)

---

## 🟡 QUICK COPY-PASTE COMMANDS

### Correct Daily Driver Commands

```bash
# Safe exploration (prompts for everything, sandboxed)
gemini --approval-mode=default --sandbox

# Fast coding (auto-approve edits only, sandboxed)
gemini --approval-mode=auto_edit --sandbox

# Full auto (auto-approve all, sandboxed — RECOMMENDED for "dangerous" work)
gemini --approval-mode=yolo

# Resume previous session
gemini --resume

# True dangerous mode (NO sandbox, NO prompts — ONLY in hardened VM)
gemini --approval-mode=yolo --sandbox=false
```

**Note:** In some versions, you may need to use `gemini -y` for full auto and `gemini -y --sandbox=false` for true dangerous mode.

### Correct Wrapper Scripts

```bash
#!/bin/bash
# gemini-fast — daily driver
gemini --approval-mode=auto_edit --sandbox "$@"
```

```bash
#!/bin/bash
# gemini-yolo — full auto but safe (sandbox on by default with yolo)
gemini --approval-mode=yolo "$@"
```

```bash
#!/bin/bash
# gemini-dangerous — ONLY use in hardened environments
gemini --approval-mode=yolo --sandbox=false "$@"
```

**Note:** In some versions, you may need to use `gemini -y "$@"` for the `gemini-yolo` script and `gemini -y --sandbox=false "$@"` for the `gemini-dangerous` script.

---

## 🟢 MODEL AVAILABILITY NOTES

### Verified Claims Only

| Claim | Status | Source |
|-------|--------|--------|
| Gemini 3 Flash in CLI | ✅ Verified | [Google Developers Blog](https://developers.googleblog.com/en/gemini-3-flash-is-now-available-in-gemini-cli/) |
| 78% SWE-bench (Gemini 3 Flash) | ✅ Verified | Same source |
| 1M context (Gemini 2.5 Pro) | ✅ Verified | Multiple official sources |
| 1M context (Gemini 3 Pro) | ⚠️ Likely but verify | No model spec page pulled |
| Free tier: 60/min, 1000/day | ✅ Verified | [Quota Docs](https://geminicli.com/docs/quota-and-pricing/) |

**Guidance**: Don't assume model capabilities transfer across tiers. Check your specific access level.

---

## 🔵 FEATURES NOT IN MAIN GUIDE (ADD THESE)

### Token Caching Availability

| Auth Method | Token Caching |
|-------------|---------------|
| API Key (Gemini API / Vertex) | ✅ Available |
| OAuth (Personal Google / Enterprise) | ❌ NOT available |

If you need token caching for cost optimization, use API key auth, not browser login.

**Source**: [Token Caching](https://geminicli.com/docs/cli/token-caching/)

### Headless Output Formats

```bash
# Plain text (default)
gemini -p "prompt"

# JSON (structured, for parsing)
gemini -p "prompt" --output-format json

# Streaming JSON (JSONL, real-time events)
gemini -p "prompt" --output-format stream-json
```

Use `stream-json` when your orchestrator needs to react to intermediate tool calls and progress.

**Source**: [Headless Mode](https://geminicli.com/docs/cli/headless/)

---

## ⚡ KEYBOARD SHORTCUTS CHEAT SHEET

| Key | Action |
|-----|--------|
| **Ctrl+Y** | Toggle YOLO (auto-approval) mid-session |
| **Ctrl+F** | Focus interactive shell (PTY) |
| **Ctrl+Z** | Undo in prompt input |
| **Ctrl+Shift+Z** | Redo in prompt input |
| **Esc Esc** | Open rewind interface |

**Source**: [Keyboard Shortcuts](https://geminicli.com/docs/cli/keyboard-shortcuts/)

---

## 📋 CHECKLIST: Is Your Setup Correct?

- [ ] Using `--approval-mode=yolo` not `--yolo`
- [ ] **Note:** In some versions, you may need to use `-y` or `--yolo` for full autonomy.
- [ ] Working directory is trusted (`/trust` if needed)
- [ ] Sandbox explicitly set or relying on YOLO default
- [ ] `GEMINI.md` in repo root with project context
- [ ] Checkpointing enabled for `/restore` capability
- [ ] Using API key (not OAuth) if you need token caching

---

*Prepend this to `gemini_cli_definitive_guide.md` for complete coverage.*

________

# Gemini CLI Field Guide (for Claude Code + Codex Users)

> **Definitive reference for frontier LLM coding agents operating Gemini CLI.**
> Last verified: January 2026 (Gemini CLI v0.23+)

---

## Table of Contents

1. [Mental Model: What Gemini CLI Is](#1-mental-model)
2. [Installation & First Run](#2-installation)
3. [Authentication Paths](#3-authentication)
4. [Configuration Model](#4-configuration)
5. [Permission Modes & "Run Dangerously"](#5-permission-modes)
6. [Sandboxing](#6-sandboxing)
7. [Tool Allowlists & Blocklists](#7-tool-restrictions)
8. [Agentic Long-Horizon Work](#8-agentic-work)
9. [Interactive Terminal (PTY) Support](#9-interactive-terminal)
10. [Model Selection](#10-model-selection)
11. [Context Files (GEMINI.md)](#11-context-files)
12. [Session & Checkpoint Management](#12-session-management)
13. [Context Compression](#13-context-compression)
14. [Token Caching](#14-token-caching)
15. [MCP Server Integration](#15-mcp-integration)
16. [Extensions](#16-extensions)
17. [Sub-Agents (Experimental)](#17-sub-agents)
18. [GitHub Actions Integration](#18-github-actions)
19. [Headless / Scripting Mode](#19-headless-mode)
20. [Slash Commands Reference](#20-slash-commands)
21. [Comparison: Claude Code vs Codex vs Gemini CLI](#21-comparison)
22. [Launcher Scripts](#22-launcher-scripts)
23. [Authoritative Sources](#23-sources)

---

<a name="1-mental-model"></a>
## 1) Mental Model: What Gemini CLI Is

Gemini CLI is an **open-source AI agent** that brings Gemini models into your terminal using a **ReAct (reason-and-act) loop**. It can call:

- **Built-in local tools**: file read/write, search, shell commands
- **Web tools**: Google Search grounding, web fetching
- **MCP servers**: local or remote, for extending capabilities

**Key differentiators from Claude Code/Codex:**

| Feature | Gemini CLI |
|---------|-----------|
| Context window | **1M tokens** (Gemini 2.5/3 Pro) |
| Interactive terminal | Full PTY support (vim, top, git rebase -i) |
| Free tier | 60 req/min, 1,000 req/day |
| Sandbox default | **Enabled with YOLO** (safer than competitors) |
| Extensions | First-class packaging system |

> **Sources**: [GitHub README](https://github.com/google-gemini/gemini-cli), [Google Cloud Docs](https://docs.cloud.google.com/gemini/docs/codeassist/gemini-cli)

---

<a name="2-installation"></a>
## 2) Installation & First Run

### Global Install (recommended)

```bash
npm install -g @google/gemini-cli
gemini --version
```

### Alternative Methods

```bash
# npx (one-off use)
npx @google/gemini-cli

# Homebrew (convenience, not canonical)
brew install gemini-cli

# Conda environment (isolated)
conda create -y -n gemini_env -c conda-forge nodejs
conda activate gemini_env
npm install -g @google/gemini-cli
```

### First Run

```bash
cd /path/to/repo
gemini
```

Opens the interactive TUI with access to tools and project context.

> **Source**: [Official Quickstart](https://geminicli.com/docs/get-started/)

---

<a name="3-authentication"></a>
## 3) Authentication Paths

### Option 1: Personal Google Login via Google Cloud SDK (Recommended for Individuals)

This method uses the Google Cloud SDK to securely link your Google Account to the Gemini CLI. It is the recommended path for individual developers.

**How it works:**
1.  Install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install).
2.  Authenticate your account by running `gcloud auth login` in your terminal and following the browser-based login process.

Once you have logged in via `gcloud`, the Gemini CLI (version 0.26.0 which we installed) will automatically use those credentials.

**What Dazza gets with this method:**
*   **Full Access to Plans:** Dazza, our Human user, can use this method to access any purchased plans, such as the "Google AI Ultra plan," associated with his `daz.greenwood@gmail.com` account.
*   **High Security:** No need to handle API keys manually. Credentials are managed securely by the SDK.
*   **Convenience:** Log in once and your authentication is automatically applied across all your terminal sessions.

**Note on "Free Tier":** The documentation mentions a free tier (60 requests/min). This is the default. When authenticated with an account that has a specific plan (like Ultra), the limits of that plan will apply instead.

### Option 2: API Key (automation/CI)

```bash
export GEMINI_API_KEY="your-key-here"
gemini
```

- Get key from [Google AI Studio](https://aistudio.google.com/)
- Best for: CI/CD, headless scripts, predictable billing
- **Enables token caching** (OAuth does not)

### Option 3: Vertex AI (enterprise)

```bash
export GOOGLE_API_KEY="your-cloud-key"
export GOOGLE_GENAI_USE_VERTEXAI=true
gemini
```

- Higher quotas, enterprise compliance
- Requires Google Cloud project setup

> **Source**: [Authentication Guide](https://geminicli.com/docs/get-started/authentication/)

---

<a name="4-configuration"></a>
## 4) Configuration Model

Gemini CLI uses **layered settings** with clear precedence:

### Precedence Order (lowest to highest)

1. **System defaults**: `~/.gemini/system-defaults.json`
2. **User**: `~/.gemini/settings.json`
3. **Project**: `<repo>/.gemini/settings.json`
4. **System overrides**: `/etc/gemini-cli/settings.json`
5. **Environment variables**: `GEMINI_*`
6. **CLI arguments**: `--flag`

### Key File Locations

| Scope | Path |
|-------|------|
| User settings | `~/.gemini/settings.json` |
| Project settings | `<repo>/.gemini/settings.json` |
| Context file | `<repo>/GEMINI.md` (configurable) |
| Custom sandbox | `<repo>/.gemini/sandbox.Dockerfile` |
| Custom commands | `<repo>/.gemini/commands/*.toml` |
| Extensions | `~/.gemini/extensions/` |

### Example settings.json

```json
{
  "model": "gemini-2.5-pro",
  "approvalMode": "auto_edit",
  "tools": {
    "sandbox": "docker",
    "core": ["run_shell_command(git)", "run_shell_command(npm)"],
    "exclude": ["run_shell_command(rm)", "run_shell_command(git push)"]
  },
  "context": {
    "contextFileName": "GEMINI.md"
  }
}
```

> **Source**: [Configuration Reference](https://geminicli.com/docs/get-started/configuration/)

---

<a name="5-permission-modes"></a>
## 5) Permission Modes & "Run Dangerously"

### Approval Modes

| Mode | Behavior |
|------|----------|
| `default` | Prompt for approval on each tool call |
| `auto_edit` | Auto-approve file edits, prompt for shell/others |
| `yolo` | Auto-approve all tool calls |
| `plan` | Read-only mode (experimental) |

### Usage

```bash
# Interactive with edit auto-approval (recommended daily driver)
gemini --approval-mode=auto_edit

# YOLO mode (auto-sandbox enabled!)
gemini --yolo
# or
gemini --approval-mode=yolo

# Toggle YOLO during session
# Press Ctrl+Y
```

### ⚠️ CRITICAL: Gemini's YOLO is NOT "Run Dangerously"

**Unlike Claude Code's `--dangerously-skip-permissions` or Codex's `--full-auto`:**

> **Sandbox is ENABLED by default when using `--yolo` or `--approval-mode=yolo`.**

This means Gemini CLI's YOLO mode is **safer by default** than equivalents in other tools.

### True "Dangerous" Mode (if you really need it)

```bash
# ⚠️ ONLY in hardened VMs/containers
gemini --yolo --sandbox=false
```

Or in settings.json:
```json
{
  "approvalMode": "yolo",
  "tools": {
    "sandbox": false
  }
}
```

> **Source**: [Configuration Docs](https://geminicli.com/docs/get-started/configuration/)

---

<a name="6-sandboxing"></a>
## 6) Sandboxing

### Sandbox Options

| Type | Description |
|------|-------------|
| `docker` | Docker container (default with YOLO) |
| `podman` | Podman container alternative |
| `seatbelt` | macOS sandbox-exec (lightweight) |
| `false` | Direct host execution (dangerous) |

### Enabling Sandbox

```bash
# Via flag
gemini --sandbox
gemini -s

# Via environment variable
export GEMINI_SANDBOX=docker
gemini

# Automatic with YOLO
gemini --yolo  # sandbox enabled by default
```

### Project-Specific Sandbox

Create `.gemini/sandbox.Dockerfile` in your project root:

```dockerfile
FROM gemini-cli-sandbox:latest
RUN apt-get update && apt-get install -y python3 nodejs
COPY . /workspace
WORKDIR /workspace
```

Gemini CLI builds and uses this image automatically.

> **Source**: [Sandboxing Docs](https://geminicli.com/docs/cli/sandbox/)

---

<a name="7-tool-restrictions"></a>
## 7) Tool Allowlists & Blocklists

### Allowlist (most secure)

Only permit specific tools:

```json
{
  "tools": {
    "core": [
      "ReadFileTool",
      "GlobTool",
      "run_shell_command(git)",
      "run_shell_command(npm test)"
    ]
  }
}
```

### Blocklist

Block specific dangerous commands:

```json
{
  "tools": {
    "exclude": [
      "run_shell_command(rm)",
      "run_shell_command(git push)",
      "run_shell_command(curl)"
    ]
  }
}
```

### CLI Flag

```bash
gemini --allowed-tools "ShellTool(git status),ShellTool(npm test)"
```

### Validation Logic

- **Command chaining disabled**: `&&`, `||`, `;` chains are split and each part validated
- **Prefix matching**: Allowing `git` permits `git status`, `git log`, etc.
- **Blocklist precedence**: Blocked commands are denied even if they match an allowed prefix

### ⚠️ Security Note

> Blocklisting is less secure than allowlisting. Simple string matching can be bypassed. Prefer `tools.core` allowlists for security-critical environments.

> **Source**: [Shell Tool Docs](https://geminicli.com/docs/tools/shell/)

---

<a name="8-agentic-work"></a>
## 8) Agentic Long-Horizon Work

### Strategy: Separate "approval policy" from "tool scope"

1. Use `auto_edit` mode for reduced friction
2. Allowlist only needed tools
3. Always pair with sandboxing
4. Use checkpointing for recovery

### Practical Workflow

```bash
# Start session with safe defaults
gemini --approval-mode=auto_edit --sandbox

# Periodically checkpoint
/chat save milestone-1

# Resume later
/chat resume milestone-1

# If context grows large
/compress
```

### Recommended settings.json for agentic work

```json
{
  "approvalMode": "auto_edit",
  "tools": {
    "sandbox": "docker",
    "core": [
      "run_shell_command(git)",
      "run_shell_command(npm)",
      "run_shell_command(python)"
    ],
    "exclude": [
      "run_shell_command(rm -rf)",
      "run_shell_command(git push --force)"
    ]
  },
  "experimental": {
    "enableCheckpointing": true
  }
}
```

---

<a name="9-interactive-terminal"></a>
## 9) Interactive Terminal (PTY) Support

**Since v0.9.0**, Gemini CLI supports full pseudo-terminal (PTY) integration:

### Enable Interactive Shell

```json
{
  "tools": {
    "shell": {
      "enableInteractiveShell": true,
      "showColor": true
    }
  }
}
```

### Supported Operations

- **Text editors**: vim, nvim, nano
- **System monitors**: top, htop
- **Interactive git**: git rebase -i, git add -p
- **REPLs**: python, node, irb
- **Setup wizards**: npm init, ng new

### Controls

| Key | Action |
|-----|--------|
| `Ctrl+F` | Focus interactive shell |
| (normal input) | Keystrokes sent to PTY |

### Why This Matters

Previously, you had to exit Gemini CLI for interactive commands. Now everything stays in context—the agent can see and react to interactive command output.

> **Source**: [Google Developers Blog](https://developers.googleblog.com/en/say-hello-to-a-new-level-of-interactivity-in-gemini-cli/)

---

<a name="10-model-selection"></a>
## 10) Model Selection

### Available Models

| Model | Context | Best For |
|-------|---------|----------|
| `gemini-2.5-pro` | 1M tokens | Complex debugging, architecture |
| `gemini-3-pro` | 1M tokens | Maximum reasoning (preview) |
| `gemini-3-flash` | 1M tokens | Fast iteration, 78% SWE-bench |
| Auto routing | 1M tokens | Switches Pro/Flash based on task |

### Selection Methods

```bash
# Via flag (session only)
gemini --model gemini-3-pro

# Via settings.json (persistent)
{
  "model": "gemini-2.5-pro"
}

# Interactive (during session)
/model
```

### Enable Gemini 3 Preview

```json
{
  "experimental": {
    "enableGemini3": true
  }
}
```

Then select via `/model` → "Auto (Gemini 3)"

> **Source**: [Gemini 3 Preview Docs](https://geminicli.com/docs/get-started/gemini-3/)

---

<a name="11-context-files"></a>
## 11) Context Files (GEMINI.md)

### Hierarchical Loading Order

1. **Global**: `~/.gemini/GEMINI.md`
2. **Project/Ancestors**: From current directory up to .git folder
3. **Sub-directory**: Component-specific instructions

### Recommended GEMINI.md Structure

```markdown
# Project: [Name]

## Overview
[Brief description of what this project does]

## Architecture
- [Key components and their relationships]

## Development Commands
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`

## Coding Conventions
- [Language-specific patterns]
- [Naming conventions]

## Security Rules
- Never commit secrets
- Don't modify production configs

## When Uncertain
Ask before:
- Deleting files
- Modifying CI/CD configs
- Running destructive commands
```

### Memory Commands

| Command | Action |
|---------|--------|
| `/memory show` | Display loaded context |
| `/memory refresh` | Reload GEMINI.md files |
| `/memory add <text>` | Add to session memory |
| `/memory init` | Generate GEMINI.md from repo analysis |

> **Source**: [Context Files Docs](https://geminicli.com/docs/cli/gemini-md/)

---

<a name="12-session-management"></a>
## 12) Session & Checkpoint Management

### Conversation Checkpoints

```bash
# Save named checkpoint
/chat save milestone-1

# Resume checkpoint
/chat resume milestone-1

# List all saved chats
/chat list
```

**Note**: All conversations are auto-saved. Manual saves create named recovery points.

### File Checkpointing

Gemini CLI snapshots project state before tool-driven modifications:

```bash
# List available restore points
/restore

# Restore to specific checkpoint
/restore <checkpoint-id>
```

### Rewind Interface

```bash
/rewind
# or press Esc twice
```

Opens interactive interface to rewind conversation and/or file changes.

> **Source**: [Checkpointing Docs](https://geminicli.com/docs/cli/checkpointing/)

---

<a name="13-context-compression"></a>
## 13) Context Compression

### Manual Compression

```bash
/compress
```

Replaces entire chat history with a summary, preserving essential details while reducing token load.

### How It Works

1. Takes entire conversation (except system context)
2. Generates concise summary with key points
3. Replaces history with summary as single message
4. Includes `<current_plan>` section for goal alignment

### Example Output

```
--- Conversation compressed ---
Summary: User and assistant debugging memory leak in DataProcessor.js.
Key points:
- Issue: Objects not being freed
- Suggested: Add logging, identified possible infinite loop
- User testing fix
--- End of summary ---
```

### Automatic Compression

Triggered when token usage reaches ~70% of model limit. The latest 30% of history is preserved uncompressed.

### Best Practices

- Use `/memory add` for critical facts before compressing (they persist)
- Monitor token usage with `/stats`
- Expect slight tone shift after compression

> **Source**: [CLI Commands Reference](https://geminicli.com/docs/cli/commands/)

---

<a name="14-token-caching"></a>
## 14) Token Caching

### Availability

| Auth Method | Token Caching |
|-------------|---------------|
| API key (Gemini/Vertex) | ✅ Available |
| OAuth (Personal/Enterprise) | ❌ Not available |

### How It Works

- Reuses previous system instructions and context
- Reduces tokens processed in subsequent requests
- Automatic—no configuration needed

### Monitor Usage

```bash
/stats
```

Shows token usage and cached token savings when available.

> **Source**: [Token Caching Docs](https://geminicli.com/docs/cli/token-caching/)

---

<a name="15-mcp-integration"></a>
## 15) MCP Server Integration

### Configure MCP Servers

In `~/.gemini/settings.json` or project settings:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "$GITHUB_TOKEN"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "$DATABASE_URL"
      }
    }
  }
}
```

### Usage

```bash
# Natural language with @ prefix
@github List my open pull requests
@postgres Show all tables in the public schema

# MCP management commands
/mcp list              # List configured servers
/mcp list --verbose    # With tool descriptions
/mcp restart           # Restart all servers
/mcp auth <server>     # OAuth authentication
```

### Tool Filtering per Server

```json
{
  "mcpServers": {
    "github": {
      "command": "...",
      "includeTools": ["list_issues", "create_issue"],
      "excludeTools": ["delete_repo"]
    }
  }
}
```

> **Source**: [MCP Server Docs](https://geminicli.com/docs/tools/mcp-server/)

---

<a name="16-extensions"></a>
## 16) Extensions

### What Extensions Package

- MCP servers
- Context files (GEMINI.md)
- Custom commands
- Tool exclusions
- Hooks
- Agent skills

### Install Extensions

```bash
# From GitHub
gemini extensions install https://github.com/gemini-cli-extensions/workspace

# From local path
gemini extensions install /path/to/extension
```

### Manage Extensions

```bash
gemini extensions list              # List installed
gemini extensions update <name>     # Update extension
gemini extensions disable <name>    # Disable globally
gemini extensions enable <name>     # Re-enable
gemini extensions uninstall <name>  # Remove

# Inside CLI
/extensions list
```

### Popular Extensions

| Extension | Purpose |
|-----------|---------|
| `workspace` | Google Workspace (Docs, Drive, Calendar) |
| `cloud-run` | Google Cloud Run deployments |
| `bigquery-data-analytics` | BigQuery analysis |
| `security` | Security vulnerability scanning |

### Browse Gallery

Visit [geminicli.com/extensions](https://geminicli.com/extensions/) for 100+ available extensions.

> **Source**: [Extensions Docs](https://geminicli.com/docs/extensions/)

---

<a name="17-sub-agents"></a>
## 17) Sub-Agents (Experimental)

### Enable Sub-Agents

```json
{
  "experimental": {
    "enableAgents": true,
    "enableSubagents": true,
    "codebaseInvestigatorSettings": {
      "enabled": true
    },
    "introspectionAgentSettings": {
      "enabled": true
    }
  }
}
```

### Built-in Agents

| Agent | Purpose |
|-------|---------|
| Codebase Investigator | Deep repository analysis |
| Introspection Agent | CLI internal documentation queries |

### ⚠️ Warning

> Sub-agents currently operate in a **YOLO-like way**—they auto-approve their own tool calls. Use with caution and prefer sandboxed environments.

### Custom Sub-Agents

Create `.gemini/agents/<name>.toml`:

```toml
name = "my_agent"
display_name = "My Custom Agent"
description = "Specialized for X tasks"
tools = ["run_shell_command", "ReadFileTool"]

[prompts]
system_prompt = """
You are a specialized agent for...
"""
```

> **Source**: [Sub-agents Docs](https://geminicli.com/docs/core/subagents/)

---

<a name="18-github-actions"></a>
## 18) GitHub Actions Integration

### Setup via CLI

```bash
gemini
/setup-github
```

Or manually via [google-github-actions/run-gemini-cli](https://github.com/google-github-actions/run-gemini-cli).

### Pre-built Workflows

| Workflow | Function |
|----------|----------|
| Issue Triage | Auto-label, prioritize incoming issues |
| PR Review | Automated code review with suggestions |
| Gemini Assistant | On-demand help via @gemini-cli mentions |

### Example Workflow

```yaml
name: Gemini PR Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/run-gemini-cli@v0
        with:
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          workflow: pr-review
```

### Authentication

- **Simple**: `GEMINI_API_KEY` secret
- **Enterprise**: Workload Identity Federation (no long-lived keys)

> **Source**: [GitHub Actions Blog Post](https://blog.google/innovation-and-ai/technology/developers-tools/introducing-gemini-cli-github-actions/)

---

<a name="19-headless-mode"></a>
## 19) Headless / Scripting Mode

### One-Shot Prompts

```bash
# Basic
gemini -p "Summarize the recent changes in this repo"

# With approval mode
gemini -p "Run tests and propose fixes" --approval-mode=auto_edit

# With sandbox
gemini -p "Refactor auth module" --yolo --sandbox
```

### Structured Output

```bash
# JSON output (for parsing)
gemini -p "List all TODO comments" --output-format json

# Stream JSON (real-time events)
gemini -p "Run migration" --output-format stream-json
```

### Interactive Bootstrap

```bash
# Start interactive session with initial prompt
gemini -i "Let's refactor the auth module"
```

### CI Pattern

```bash
#!/bin/bash
export GEMINI_API_KEY="$GEMINI_API_KEY"
gemini -p "Review changes in this PR and suggest improvements" \
  --approval-mode=auto_edit \
  --sandbox \
  --output-format json > review.json
```

> **Source**: [Headless Mode Docs](https://geminicli.com/docs/cli/headless/)

---

<a name="20-slash-commands"></a>
## 20) Slash Commands Reference

### Core Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/model` | Select AI model |
| `/settings` | Open settings editor |
| `/stats` | Session statistics |
| `/clear` | Clear conversation |
| `/quit` | Exit CLI |

### Memory & Context

| Command | Description |
|---------|-------------|
| `/memory show` | Display loaded context |
| `/memory refresh` | Reload GEMINI.md files |
| `/memory add <text>` | Add to session memory |
| `/memory init` | Generate GEMINI.md |
| `/compress` | Compress chat to summary |

### Session Management

| Command | Description |
|---------|-------------|
| `/chat save <tag>` | Save checkpoint |
| `/chat resume <tag>` | Resume checkpoint |
| `/chat list` | List saved chats |
| `/restore` | Restore file checkpoint |
| `/rewind` | Interactive rewind (or Esc×2) |

### Tools & Extensions

| Command | Description |
|---------|-------------|
| `/mcp list` | List MCP servers |
| `/mcp restart` | Restart MCP servers |
| `/extensions list` | List extensions |
| `/skills` | Manage agent skills |

### Special

| Command | Description |
|---------|-------------|
| `/bug` | File issue on GitHub |
| `@<file>` | Include file in prompt |
| `@<dir>` | Include directory contents |
| `!<cmd>` | Run shell command directly |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Y` | Toggle YOLO mode |
| `Ctrl+F` | Focus interactive shell |
| `Ctrl+Z` | Undo in prompt |
| `Ctrl+Shift+Z` | Redo in prompt |
| `Esc Esc` | Open rewind interface |

> **Source**: [Commands Reference](https://geminicli.com/docs/cli/commands/)

---

<a name="21-comparison"></a>
## 21) Comparison: Claude Code vs Codex vs Gemini CLI

| Feature | Claude Code | Codex CLI | Gemini CLI |
|---------|-------------|-----------|------------|
| **Dangerous mode** | `--dangerously-skip-permissions` | `--full-auto` | `--yolo --sandbox=false` |

**Note:** In some versions, you may need to use `-y --sandbox=false` for "Dangerous mode".
| **Auto-approve edits** | N/A | `--approval-mode=suggest` | `--approval-mode=auto_edit` |
| **YOLO default safety** | No sandbox | No sandbox | **Sandbox ON** |
| **Context file** | `CLAUDE.md` | `AGENTS.md` | `GEMINI.md` |
| **Context window** | 200K | 200K | **1M tokens** |
| **Free tier** | No | ChatGPT Pro required | 60/min, 1000/day |
| **Interactive terminal** | Limited | Limited | **Full PTY (vim, etc.)** |
| **Extensions system** | Skills | N/A | **First-class extensions** |
| **GitHub Actions** | N/A | N/A | **Official action** |

### Key Insight for Claude Code Users

> Gemini CLI's `--yolo` is **not equivalent** to Claude Code's `--dangerously-skip-permissions`. YOLO in Gemini CLI enables sandbox by default, making it safer. For true "dangerous" mode, you must explicitly add `--sandbox=false`.

---

<a name="22-launcher-scripts"></a>
## 22) Launcher Scripts

### gemini-safe (exploratory work)

```bash
#!/bin/bash
# Sandbox + strict approvals
gemini --approval-mode=default --sandbox "$@"
```

### gemini-fast (daily coding)

```bash
#!/bin/bash
# Sandbox + auto-approve edits
gemini --approval-mode=auto_edit --sandbox "$@"
```

### gemini-yolo (sandboxed autonomy)

```bash
#!/bin/bash
# Auto-approve all, but sandboxed (default)
gemini --yolo "$@"
```

### gemini-dangerous (hardened environments only)

```bash
#!/bin/bash
# ⚠️ ONLY run inside hardened VM/container
echo "WARNING: Running without sandbox. Ctrl+C to abort."
sleep 3
gemini --yolo --sandbox=false "$@"
```

**Note:** In some versions, you may need to use `gemini -y "$@"` for the `gemini-yolo` script and `gemini -y --sandbox=false "$@"` for the `gemini-dangerous` script.

---

<a name="23-sources"></a>
## 23) Authoritative Sources

### Official Documentation

- **Main Docs**: https://geminicli.com/docs/
- **GitHub Repo**: https://github.com/google-gemini/gemini-cli
- **GitHub Pages**: https://google-gemini.github.io/gemini-cli/
- **Google Cloud Docs**: https://docs.cloud.google.com/gemini/docs/codeassist/gemini-cli
- **Extensions Gallery**: https://geminicli.com/extensions/

### Key Documentation Pages

- [Configuration Reference](https://geminicli.com/docs/get-started/configuration/)
- [Shell Tool](https://geminicli.com/docs/tools/shell/)
- [Sandboxing](https://geminicli.com/docs/cli/sandbox/)
- [MCP Integration](https://geminicli.com/docs/tools/mcp-server/)
- [Checkpointing](https://geminicli.com/docs/cli/checkpointing/)
- [Headless Mode](https://geminicli.com/docs/cli/headless/)
- [Extensions](https://geminicli.com/docs/extensions/)
- [Sub-agents](https://geminicli.com/docs/core/subagents/)

### Google Developer Resources

- [Google Developers Blog](https://developers.googleblog.com/)
- [Google Codelabs](https://codelabs.developers.google.com/gemini-cli-hands-on)
- [GitHub Actions Announcement](https://blog.google/innovation-and-ai/technology/developers-tools/introducing-gemini-cli-github-actions/)

### GitHub Actions

- **Action Repo**: https://github.com/google-github-actions/run-gemini-cli
- **Marketplace**: https://github.com/marketplace/actions/run-gemini-cli

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    GEMINI CLI QUICK REFERENCE                   │
├─────────────────────────────────────────────────────────────────┤
│ INSTALL        npm install -g @google/gemini-cli                │
│ START          gemini                                           │
│ AUTH           gemini (browser flow) OR GEMINI_API_KEY env var  │
├─────────────────────────────────────────────────────────────────┤
│ APPROVAL MODES                                                  │
│   --approval-mode=default     Prompt for everything             │
│   --approval-mode=auto_edit   Auto-approve edits only           │
│   --approval-mode=yolo        Auto-approve all (sandbox ON)     │
├─────────────────────────────────────────────────────────────────┤
│ DANGEROUS MODE (sandbox OFF - use in hardened env only)         │
│   gemini --yolo --sandbox=false                                 │
│   (Note: May need -y or -y --sandbox=false in some versions)    │
├─────────────────────────────────────────────────────────────────┤
│ ESSENTIAL COMMANDS                                              │
│   /memory show          See loaded context                      │
│   /compress             Reduce token usage                      │
│   /chat save <tag>      Checkpoint conversation                 │
│   /restore              Undo file changes                       │
│   /stats                Token usage                             │
│   Ctrl+Y                Toggle YOLO                             │
├─────────────────────────────────────────────────────────────────┤
│ CONTEXT FILES                                                   │
│   GEMINI.md             Project instructions (like CLAUDE.md)   │
│   .gemini/settings.json Project configuration                   │
│   .gemini/commands/     Custom slash commands (.toml)           │
└─────────────────────────────────────────────────────────────────┘
```

---

*Document verified against Gemini CLI v0.23+ as of January 2026.*