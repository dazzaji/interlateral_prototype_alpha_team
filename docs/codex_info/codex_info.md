# OpenAI Codex CLI on macOS Terminal (Feb 2026) — complete, accurate, Pro-plan friendly

> **Updated:** 2026-02-05 for **Codex CLI 0.98.0** and **gpt-5.3-codex**


## 0) The 3 things to understand before you touch anything

1. **Codex CLI is a local coding agent**: it can read/modify files and run commands on your Mac in the directory you start it from. ([OpenAI Developers][11])

2. **Safety is two independent dials**:

   * **Sandbox policy** (`--sandbox`): what the agent-generated shell commands are allowed to touch
   * **Approval policy** (`--ask-for-approval`): when it must stop and ask before running commands
     These are defined in official CLI docs. ([OpenAI Developers][8])

3. **Billing/auth has two distinct paths**:

   * ChatGPT login → uses your ChatGPT plan quotas (Plus/Pro/Business/Edu/Enterprise)
   * API key login → usage-based billing (API rates)
     This is explicit in OpenAI’s Codex documentation and pricing. ([OpenAI Developers][11])

---

## 1) Installation on Mac (easy, reliable)

### Option A: Homebrew cask (most “Mac normal”)

```bash
brew install --cask codex
codex --version
```

Homebrew cask is official/recognized for Codex. ([Homebrew Formulae][1])

### Option B: npm global install (best if you want quick updates)

```bash
npm i -g @openai/codex
codex --version
```

Also official. ([OpenAI Developers][11])

### Option C: GitHub release binary (pin exact versions)

Use the Codex GitHub releases if you want deterministic installs for multiple machines. ([GitHub][13])

---

## 2) Models that are real for Codex CLI (what to pick)

The authoritative list is the Codex Models page. ([OpenAI Developers][10])

### The short answer (Feb 2026)

* **New default / Frontier performance:** `gpt-5.3-codex` — 25% faster, better multi-file tasks, 77.3% Terminal-Bench ([OpenAI][19])
* **Legacy option:** `gpt-5.2-codex` — still excellent, well-tested ([OpenAI Developers][10])
* **Stretch your Pro quota / faster iterations:** `gpt-5.1-codex-mini` ([OpenAI Developers][10])

> **Note:** gpt-5.3-codex also uses fewer tokens for simple tasks (up to 93.7% fewer than GPT-5), making it cost-effective even without switching to mini.

### Why “Thinking vs Codex” matters (without hallucinating model IDs)

OpenAI clearly positions **GPT-5.2 Thinking** as a reasoning-heavy line in public communications. ([OpenAI][3])
But Codex CLI is optimized around **Codex-tuned** models (like `gpt-5.2-codex`) and exposes “think harder” via **reasoning effort** rather than requiring a separate “thinking” model name. ([OpenAI Platform][14])

### Reasoning effort (your “thinking mode” knob)

In API docs, GPT-5.2 supports reasoning effort including `xhigh`. ([OpenAI Platform][14])
In Codex CLI, you typically set it in `config.toml` using `model_reasoning_effort` (documented in config pages). ([OpenAI Developers][15])

---

## 3) How Codex actually works in Terminal

### Interactive (full-screen TUI)

```bash
codex
```

Starts the agent in your current directory. ([OpenAI Developers][11])

### Start with a prompt

```bash
codex "Scan this repo, explain architecture, then propose the smallest safe refactor plan."
```

The prompt argument is part of the official CLI interface. ([OpenAI Developers][8])

### Attach images (real vision support)

```bash
codex -i screenshot.png "What is this error and what file should I change?"
# or multiple:
codex -i ui.png,trace.png "Diagnose and fix"
```

`--image/-i` is the official way. ([OpenAI Developers][8])

### Non-interactive automation (CI / scripts)

```bash
codex exec "Generate release notes from the last 20 commits"
```

Documented in non-interactive mode docs. ([OpenAI Developers][16])

---

## 4) Permissions and the Codex equivalent of Claude’s `--dangerously-skip-permissions`

Codex exposes the exact “danger” mode you asked about.

### The real knobs (you’ll use these constantly)

**Sandbox policies** (`--sandbox`):

* `read-only`
* `workspace-write`
* `danger-full-access` ([OpenAI Developers][8])

**Approval policies** (`--ask-for-approval` / `-a`):

* `untrusted`
* `on-failure`
* `on-request`
* `never` ([OpenAI Developers][8])

### The “skip everything” mode (closest analog)

```bash
codex --dangerously-bypass-approvals-and-sandbox
# alias:
codex --yolo
```

This is the documented “no sandbox; no approvals” mode, and OpenAI explicitly says to use it only in externally hardened environments. ([OpenAI Developers][8])

### A safer “fast but not insane” setup (recommended daily)

If your real goal is “don’t ask me every time” but keep the workspace boundary:

```bash
codex --sandbox workspace-write --ask-for-approval never
```

This is still risky (it will run commands without prompts), but it keeps the sandbox. The separation of sandbox vs approvals is core to Codex security. ([OpenAI Developers][6])

### “Full-auto” shortcut

```bash
codex --full-auto
```

Official docs define it as: `--ask-for-approval on-request` + `--sandbox workspace-write`. ([OpenAI Developers][8])

### Grant extra writable dirs without going full access

```bash
codex --add-dir /path/to/another/repo --add-dir /tmp/somewhere
```

This is first-class in the CLI reference. ([OpenAI Developers][8])

---

## 5) Configuration that actually sticks (`~/.codex/config.toml`)

Codex reads config from `~/.codex/config.toml`, shared between CLI and IDE extension. ([OpenAI Developers][12])

### Config precedence (how overrides work)

Codex resolves settings in this order:

1. CLI flags
2. `--profile`
3. root values in `config.toml`
4. built-in defaults ([OpenAI Developers][12])

### A strong “Pro-friendly daily driver” config (minimal, practical)

```toml
# ~/.codex/config.toml

# Model: best agentic coding default (Feb 2026)
model = "gpt-5.3-codex"
# Alternative: model = "gpt-5.2-codex" (legacy, still excellent)

# Safety defaults for local work
approval_policy = "on-request"
sandbox_mode = "workspace-write"

# Optional: allow web search + allow network inside workspace-write sandbox
[features]
web_search_request = true

[sandbox_workspace_write]
network_access = true

# Optional: keep environment tight
[shell_environment_policy]
include_only = ["PATH", "HOME", "USER", "SHELL", "LANG"]
```

Web search + network config is documented exactly in CLI features. ([OpenAI Developers][5])

### Profiles (switch quickly per repo or per mood)

Profiles are the clean way to encode “safe / normal / yolo” without rewriting config. Profiles are documented in Advanced Config. ([OpenAI Developers][15])

Example:

```toml
# ~/.codex/config.toml

[profiles.safe]
approval_policy = "untrusted"
sandbox_mode = "read-only"

[profiles.auto]
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[profiles.fast]
approval_policy = "never"
sandbox_mode = "workspace-write"

[profiles.yolo]
# This is intentionally extreme; prefer running YOLO only in a VM/container.
approval_policy = "never"
sandbox_mode = "danger-full-access"
```

Run:

```bash
codex --profile safe
codex --profile fast
```

### Useful management command

If you’re debugging config layers (especially under MDM), use:

```bash
codex config show --effective
```

Mentioned in the security doc for managed deployment validation. ([OpenAI Developers][6])

---

## 6) Custom instructions via `AGENTS.md` (how to make Codex behave like “your” engineer)

Codex supports agent instruction discovery using:

* Global: `~/.codex/AGENTS.override.md` then `~/.codex/AGENTS.md`
* Per-project: `AGENTS.override.md` then `AGENTS.md` up the directory tree
  This is documented in the AGENTS.md guide. ([OpenAI Developers][17])

### Practical global `~/.codex/AGENTS.md` starter

```md
# Global Codex Working Agreements

- Prefer small, reversible changes.
- Always run the project’s primary test command after code edits (ask if unclear).
- Never exfiltrate secrets; if you suspect secrets in repo, stop and ask.
- Don’t add new dependencies without asking first.
- Use existing formatting/linting conventions.
```

---

## 7) Automation + “programmatic” use (three real options)

### A) Scriptable CLI (`codex exec`)

Codex explicitly supports CI-style flows; OpenAI provides examples and a cookbook for autofixing CI failures. ([OpenAI Developers][16])

### B) MCP (Model Context Protocol) support

* Configure MCP servers in `~/.codex/config.toml` or manage with `codex mcp …` ([OpenAI Developers][18])
* Run Codex itself as an MCP server (`codex mcp-server`) and call it from other agents (Agents SDK guide). ([OpenAI Developers][7])

### C) Use the API directly (Responses API + tools)

If you want full control and your own gating, build your own "codex-like agent" using the OpenAI Responses API and tool calling, and choose GPT-5.2/Codex models where appropriate. The GPT-5.2 model pages and the "latest model" guide describe relevant knobs like reasoning effort. ([OpenAI Platform][14])

---

## 8) Codex CLI 0.97-0.98 Changes (Feb 2026)

These behavioral changes affect how you interact with Codex, especially in automated/multi-agent scenarios.

### Steer Mode (0.98.0 - Now Default)

Steer mode changes how input is handled during running tasks:

* **`Enter`** sends input **immediately** (steers/interrupts the agent mid-task)
* **`Tab`** queues input for after the current task completes

**Impact for automation:** If you inject messages via tmux while Codex is working, the message sends immediately rather than waiting. Test your injection timing if you experience issues.

### Allow and Remember (0.97.0)

Session-scoped auto-approval for repeated tool calls:

* When approving an MCP tool call, choose "Allow for this session"
* Subsequent calls to the same tool auto-approve within that session
* Reduces approval fatigue for trusted tools

### Bubblewrap Sandbox (0.97.0 - Linux Only)

Enhanced filesystem isolation using Bubblewrap (bwrap) on Linux systems. Not applicable to macOS.

### Git Command Safety (0.95.0 - Still Active)

Reminder: Destructive git commands (`push`, `reset --hard`, `clean -f`, etc.) **always** prompt for approval, even with `--yolo`. This is by design and cannot be bypassed.

---

# Special section: LOGIN WITH YOUR CHATGPT PRO PLAN (so you burn Pro quota, not API tokens)

You said: “I have a LOT of Pro usage I don’t use; I want Codex to lean on it.” The practical rule is:

## Rule: Use ChatGPT sign-in for Codex CLI, and avoid API-key mode for your normal terminal workflow

* Codex is bundled with ChatGPT Pro (and Plus/Business/Edu/Enterprise). ([OpenAI Developers][11])
* The CLI supports ChatGPT sign-in vs API-key sign-in; API-key sign-in is metered usage. ([OpenAI Developers][11])

## Step-by-step (fast path)

1. Make sure Codex is installed:

```bash
brew install --cask codex
```

([Homebrew Formulae][1])

2. In the shell session you’ll use for Codex, **remove API key env vars** (prevents accidental API billing):

```bash
unset OPENAI_API_KEY
unset CODEX_API_KEY
```

3. Login to Codex with ChatGPT:

```bash
codex login
```

(Official docs cover ChatGPT login flow, credential storage, and related settings.) ([OpenAI Developers][2])

4. Verify you’re logged in (and debug config if needed):

```bash
codex config show --effective
```

([OpenAI Developers][6])

5. Run Codex in your repo. On current releases (0.98.0+), the ChatGPT-auth default model is `gpt-5.3-codex`. ([OpenAI Developers][2])

```bash
cd /path/to/repo
codex
```

## Pro plan quotas: what you should expect in practice

OpenAI publishes Pro quotas in the pricing table (local messages / 5h, cloud tasks / 5h, code reviews / week). ([OpenAI Developers][2])
OpenAI also explicitly advises switching to **`gpt-5.1-codex-mini`** to stretch the bucket (up to ~4× more local usage, per OpenAI’s pricing notes). ([OpenAI Developers][2])

---

## Your Mac `.sh` launcher (Pro-plan safe + your preferred defaults)

Save as `~/bin/codex-pro.sh` and `chmod +x ~/bin/codex-pro.sh`.

```bash
#!/usr/bin/env bash
set -euo pipefail

# Codex Pro launcher: prefer ChatGPT-auth (Pro quota), avoid API-key billing.

unset OPENAI_API_KEY
unset CODEX_API_KEY

REPO_DIR="${1:-$(pwd)}"
cd "$REPO_DIR"

# Optional: show effective config so you can sanity-check what will happen
# (especially useful if you use profiles or MDM-managed settings)
# codex config show --effective

# If you haven't logged in yet, Codex will prompt you.
# Run:
#   codex login
# once, then this script becomes "just open codex".

exec codex \
  --model gpt-5.3-codex \
  --sandbox workspace-write \
  --ask-for-approval on-request
```

Want the "fast but still sandboxed" variant?

```bash
codex --model gpt-5.3-codex --sandbox workspace-write --ask-for-approval never
```

All these flags and values are in the official CLI reference. ([OpenAI Developers][8])

Want the true “dangerously skip permissions” analog?

```bash
codex --yolo
```

(Again: only inside hardened environments.) ([OpenAI Developers][6])

---

## Authoritative URLs (official)

```text
Codex CLI overview:
https://developers.openai.com/codex/cli/

CLI reference (all flags, including --yolo, --sandbox, --ask-for-approval, --full-auto):
https://developers.openai.com/codex/cli/reference/

Security model (sandbox + approvals + recommended operating modes):
https://developers.openai.com/codex/security/

Models for Codex (real model IDs):
https://developers.openai.com/codex/models/

Pricing + plan inclusion (Plus/Pro/etc. and quota framing):
https://developers.openai.com/codex/pricing/

Config basics / advanced / reference / sample:
https://developers.openai.com/codex/config-basic/
https://developers.openai.com/codex/config-advanced/
https://developers.openai.com/codex/config-reference/
https://developers.openai.com/codex/config-sample/

AGENTS.md instructions:
https://developers.openai.com/codex/guides/agents-md/

Non-interactive mode (codex exec):
https://developers.openai.com/codex/noninteractive/

CLI features (web search opt-in, shell completions):
https://developers.openai.com/codex/cli/features/

MCP:
https://developers.openai.com/codex/mcp/

Codex changelog (important for defaults and behavior changes):
https://developers.openai.com/codex/changelog/

OpenAI blog: GPT-5.3-Codex launch (Feb 2026 - CURRENT):
https://openai.com/index/introducing-gpt-5-3-codex/

OpenAI blog: GPT-5.2-Codex launch (historical):
https://openai.com/index/introducing-gpt-5-2-codex/

OpenAI blog: GPT-5.2 "Thinking" (historical - naming and positioning):
https://openai.com/index/introducing-gpt-5-2/
```

---

If you paste your current Claude Code invocation (the exact flags + typical repo workflows), I’ll map it 1:1 to a Codex “safe / normal / dangerous” trio with:

* `~/.codex/config.toml` + profiles
* `~/.codex/AGENTS.md`
* two launch scripts (`codex-safe.sh`, `codex-fast.sh`)
* and a recommended “Pro quota stretching” fallback (`gpt-5.1-codex-mini`) per OpenAI’s own suggestion. ([OpenAI Developers][2])

[1]: https://formulae.brew.sh/cask/codex?utm_source=chatgpt.com "codex"
[2]: https://developers.openai.com/codex/changelog/?utm_source=chatgpt.com "Codex changelog"
[3]: https://openai.com/index/introducing-gpt-5-2/?utm_source=chatgpt.com "Introducing GPT-5.2"
[4]: https://platform.openai.com/docs/guides/latest-model?utm_source=chatgpt.com "Using GPT-5.2 | OpenAI API"
[5]: https://developers.openai.com/codex/cli/features/?utm_source=chatgpt.com "Codex CLI features"
[6]: https://developers.openai.com/codex/security/?utm_source=chatgpt.com "Security"
[7]: https://developers.openai.com/codex/guides/agents-sdk/?utm_source=chatgpt.com "Use Codex with the Agents SDK"
[8]: https://developers.openai.com/codex/cli/reference/?utm_source=chatgpt.com "Command line options"
[9]: https://github.com/openai/codex/issues/6522?utm_source=chatgpt.com "Incorrect full-auto description in `codex --help ..."
[10]: https://developers.openai.com/codex/models/?utm_source=chatgpt.com "Codex Models"
[11]: https://developers.openai.com/codex/cli/?utm_source=chatgpt.com "Codex CLI"
[12]: https://developers.openai.com/codex/config-basic/?utm_source=chatgpt.com "Basic Configuration"
[13]: https://github.com/openai/codex?utm_source=chatgpt.com "openai/codex: Lightweight coding agent that runs in your ..."
[14]: https://platform.openai.com/docs/models/gpt-5.2?utm_source=chatgpt.com "GPT-5.2 Model | OpenAI API"
[15]: https://developers.openai.com/codex/config-advanced/?utm_source=chatgpt.com "Advanced Configuration"
[16]: https://developers.openai.com/codex/noninteractive/?utm_source=chatgpt.com "Non-interactive mode"
[17]: https://developers.openai.com/codex/guides/agents-md/?utm_source=chatgpt.com "Custom instructions with AGENTS.md"
[18]: https://developers.openai.com/codex/mcp/?utm_source=chatgpt.com "Model Context Protocol"
[19]: https://openai.com/index/introducing-gpt-5-3-codex/ "Introducing GPT-5.3-Codex"
