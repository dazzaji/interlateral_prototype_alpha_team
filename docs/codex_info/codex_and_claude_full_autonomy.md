Now I have everything needed. Let me compile the full audit. The current Codex CLI version is **0.103.0** as of Feb 17, 2026  — both documents were written for 0.98.0 and have several issues. Let me produce the full enumerated amendment list plus the Claude memo. [developers.openai](https://developers.openai.com/codex/changelog/)

***

# Codex Documentation Amendment List

The documents (`codex_info.md` and `codex_run_free.md`) were last updated for **Codex CLI 0.98.0** (Feb 5, 2026). The current CLI version as of Feb 17, 2026 is **0.103.0**, with intermediate releases 0.99.0, 0.100.0, 0.101.0, and 0.103.0 each introducing relevant changes.  Below are all items requiring amendment. [reddit](https://www.reddit.com/r/CodexAutomation/comments/1r3sgw7/codex_cli_update_01010_codex_app_v260212_model/)

***

## `codex_run_free.md` — Amendments

**1. Version stamp is outdated**

- **What's wrong:** The header states `Codex CLI Version: 0.98.0` and `Last Updated: 2026-02-05`.
- **Proposed language:**
  ```
  > **Last Updated:** 2026-02-24
  > **Codex CLI Version:** 0.103.0
  ```
- **Insertion point:** Lines 3–4, replace the two `>` lines at the top of the file. [developers.openai](https://developers.openai.com/codex/changelog/)

***

**2. `codex --yolo` listed as top-level invocation in "Current Best Practice" is unreliable as a bare flag**

- **What's wrong:** The doc lists `codex --yolo` as "still the best option for maximum autonomy." Your devs confirmed this flag no longer appears in `codex --help` on current builds. It exists as an undocumented alias and may not be surfaced reliably. The authoritative explicit form should be primary. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/1696097/3fe243a3-983a-44a6-821a-109a584a3202/codex_run_free.md)
- **Proposed language:**
  ```bash
  # PREFERRED explicit form (always works, version-safe):
  codex --dangerously-bypass-approvals-and-sandbox
  # OR equivalent with explicit flags:
  codex --ask-for-approval never --sandbox danger-full-access

  # --yolo is an alias for --dangerously-bypass-approvals-and-sandbox
  # but is no longer advertised in `codex --help` on current builds (0.99.0+).
  # Use the explicit form in all scripts and handoff docs.
  ```
- **Insertion point:** Replace the entire `## 🟡 CURRENT BEST PRACTICE` code block (lines below that header). [smartscope](https://smartscope.blog/en/generative-ai/chatgpt/codex-cli-approval-modes-no-approval/)

***

**3. Missing: `codex exec` subcommand form for non-interactive / automation use**

- **What's wrong:** The "Current Best Practice" section only lists interactive `codex --yolo` / `codex --ask-for-approval never --sandbox danger-full-access`. For CI/scripted/tmux handoff use (which your quad-agent mesh relies on), the correct form is `codex exec` with the flags appended. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/1696097/b1bfb4f8-bcca-4ff1-bb76-24aceadce6b7/codex_info.md)
- **Proposed addition (add after the existing best practice block):**
  ```bash
  # For non-interactive / scripted / tmux-injected use (codex exec subcommand):
  codex exec --dangerously-bypass-approvals-and-sandbox "Your task here"
  # OR with explicit flags:
  codex exec --ask-for-approval never --sandbox danger-full-access "Your task here"
  ```
- **Insertion point:** Immediately after the `## 🟡 CURRENT BEST PRACTICE` block, before the `## 🟢 OPERATIONS THAT STILL AUTO-APPROVE` table. [github](https://github.com/openai/codex/issues/7522)

***

**4. Missing changelog entries: v0.99.0, v0.100.0, v0.101.0, v0.103.0**

- **What's wrong:** The doc covers only through v0.98.0. Four subsequent releases (through 0.103.0) contain features relevant to your quad-agent mesh, especially concurrent shell and `requirements.toml` network constraints. [reddit](https://www.reddit.com/r/CodexAutomation/comments/1r2o9vv/codex_cli_update_0990_concurrent_shell_statusline/)
- **Proposed addition (new section at end of BREAKING CHANGES or as its own section):**
  ```markdown
  ### 5. Concurrent Shell During Active Turns (v0.99.0 – Feb 11, 2026)
  You can now run a direct shell command while Codex is actively working on a task without interrupting the agent. This changes tmux injection behavior — a shell-side command no longer forces a context switch.

  ### 6. `requirements.toml` Web Search & Network Constraints (v0.99.0 – Feb 11, 2026)
  Enterprise/admin configs can now restrict web search modes and define network constraints via `requirements.toml`. Relevant if your mesh runs in managed environments.

  ### 7. GPT-5.3-Codex-Spark + Model Slug Stability (v0.100.0 / v0.101.0 – Feb 12, 2026)
  New model `gpt-5.3-codex-spark` available. Model slug is now preserved when selecting by prefix — update any scripts that use prefix-based model selection.

  ### 8. Permission Profiles from `openai.yaml` (v0.103.0 – Feb 17, 2026)
  Skills can now declare permission profiles via `openai.yaml` metadata. This is relevant for MCP server tool approvals in your mesh workflow.
  ```
- **Insertion point:** After the existing "### 4. Allow and Remember for Tool Approvals" section, before the `---` divider. [reddit](https://www.reddit.com/r/CodexAutomation/comments/1r3sgw7/codex_cli_update_01010_codex_app_v260212_model/)

***

**5. `codex --yolo` in "closest match" section at bottom is `codex exec --yolo`, not `codex --yolo`**

- **What's wrong:** The bottom section "Closest match to Claude Code 'dangerously'" correctly uses `codex exec --dangerously-bypass-approvals-and-sandbox` but then gives `codex exec --yolo` as the alias. The earlier top section incorrectly uses bare `codex --yolo` without `exec`. These should be consistent and `exec` should be explicit for scripted use. [smartscope](https://smartscope.blog/en/generative-ai/chatgpt/codex-cli-approval-modes-no-approval/)
- **Proposed language (bottom section):**
  ```bash
  # Non-interactive / scripted form:
  codex exec --dangerously-bypass-approvals-and-sandbox "Your task here"
  # alias (may not appear in --help on current builds):
  codex exec --yolo "Your task here"

  # Interactive TUI form:
  codex --dangerously-bypass-approvals-and-sandbox
  ```
- **Insertion point:** Replace the existing code block under "# Closest match to Claude Code 'dangerously'" at the bottom of the file. [github](https://github.com/openai/codex/issues/7522)

***

## `codex_info.md` — Amendments

**6. Version stamp is outdated**

- **What's wrong:** Header states `Codex CLI 0.98.0` and `Updated: 2026-02-05`.
- **Proposed language:**
  ```
  > **Updated:** 2026-02-24 for **Codex CLI 0.103.0** and **gpt-5.3-codex**
  ```
- **Insertion point:** Line 3, replace the `> **Updated:**` line. [developers.openai](https://developers.openai.com/codex/changelog/)

***

**7. Section 4: `codex --yolo` listed as primary without warning it may not appear in `--help`**

- **What's wrong:** Section 4 ("The 'skip everything' mode") shows `codex --yolo` as the documented form. As your devs confirmed, `--help` on current builds no longer advertises this flag — it is an undocumented alias. Scripts and handoff docs depending on it will break as encountered. [smartscope](https://smartscope.blog/en/generative-ai/chatgpt/codex-cli-approval-modes-no-approval/)
- **Proposed language (replace the "skip everything" block in Section 4):**
  ```bash
  # Preferred explicit form (safe for scripts and handoffs — always advertised):
  codex --dangerously-bypass-approvals-and-sandbox
  # Exact equivalent flags (also always reliable):
  codex --ask-for-approval never --sandbox danger-full-access

  # --yolo is an alias but is NOT advertised in `codex --help` on v0.99.0+.
  # Avoid using --yolo in scripts, CLAUDE.md, or handoff documents.
  ```
- **Insertion point:** Replace the code block under "### The 'skip everything' mode (closest analog)" in Section 4. [github](https://github.com/openai/codex/issues/7522)

***

**8. Section 4: Missing `codex exec` form for non-interactive dangerous mode**

- **What's wrong:** Section 4 only shows interactive invocations. For CI, tmux-injected, and handoff automation use, `codex exec` is the documented non-interactive subcommand. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/1696097/b1bfb4f8-bcca-4ff1-bb76-24aceadce6b7/codex_info.md)
- **Proposed addition:**
  ```bash
  # For non-interactive / CI / tmux handoff tasks:
  codex exec --dangerously-bypass-approvals-and-sandbox "Your task here"
  # Sandboxed but no prompts:
  codex exec --ask-for-approval never --sandbox workspace-write "Your task here"
  ```
- **Insertion point:** Add as a new sub-block immediately after the "skip everything" code block in Section 4, with header `### Non-interactive dangerous mode (for scripts and tmux)`. [github](https://github.com/openai/codex/issues/7522)

***

**9. Section 8 changelog missing v0.99.0–0.103.0 entries**

- **What's wrong:** Section 8 ("Codex CLI 0.97–0.98 Changes") ends at 0.98.0. Releases 0.99.0 through 0.103.0 include changes directly relevant to your automation workflow (concurrent shell, `requirements.toml` constraints, model slug stability, permission profiles). [reddit](https://www.reddit.com/r/CodexAutomation/comments/1r2o9vv/codex_cli_update_0990_concurrent_shell_statusline/)
- **Proposed addition (new subsections in Section 8):**
  ```markdown
  ### Concurrent Shell During Active Turns (0.99.0 – Feb 11, 2026)
  You can now run a shell command while the agent is mid-task without interrupting it.
  **Impact for tmux mesh:** Shell-side injections no longer force a turn interruption.

  ### `requirements.toml` Network + Web Search Controls (0.99.0 – Feb 11, 2026)
  Admins can now restrict web search modes and network access per deployment using `requirements.toml`.

  ### GPT-5.3-Codex-Spark + Model Slug Stability (0.100.0/0.101.0 – Feb 12, 2026)
  New `gpt-5.3-codex-spark` model available; model slug now preserved when selecting by prefix.
  **Action:** Re-test any scripts using model prefix selection.

  ### Permission Profiles via `openai.yaml` (0.103.0 – Feb 17, 2026)
  Skills can declare permission profiles in `openai.yaml` metadata. Relevant to MCP tool approvals in multi-agent mesh workflows.
  ```
- **Insertion point:** Append after the existing "### Git Command Safety (0.95.0 – Still Active)" subsection at the bottom of Section 8. [reddit](https://www.reddit.com/r/CodexAutomation/comments/1r3sgw7/codex_cli_update_01010_codex_app_v260212_model/)

***

**10. `config.toml` profiles section: `[profiles.yolo]` should warn about `--yolo` alias unreliability**

- **What's wrong:** Section 5 includes a `[profiles.yolo]` config example that maps to `approval_policy = "never"` + `sandbox_mode = "danger-full-access"`. This is the correct config approach, but the comment says "prefer running YOLO only in a VM/container" without noting that the `--yolo` CLI flag itself is unreliable on current builds. Config profiles are in fact the *better* way to achieve this reliably. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/1696097/b1bfb4f8-bcca-4ff1-bb76-24aceadce6b7/codex_info.md)
- **Proposed amendment to the `[profiles.yolo]` block comment:**
  ```toml
  [profiles.yolo]
  # Full bypass: no approvals, no sandbox boundary.
  # NOTE: The --yolo CLI flag is an undocumented alias on v0.99.0+ and may not appear
  # in `codex --help`. Use this config profile instead for reliable YOLO invocation:
  #   codex --profile yolo "Your task"
  # This is the preferred approach over the --yolo flag in scripts and handoff docs.
  # Only use in externally hardened environments (VM/container).
  approval_policy = "never"
  sandbox_mode = "danger-full-access"
  ```
- **Insertion point:** Replace the `[profiles.yolo]` block comment in Section 5. [smartscope](https://smartscope.blog/en/generative-ai/chatgpt/codex-cli-approval-modes-no-approval/)

***

**11. Authoritative URLs section: Codex changelog URL needs update note**

- **What's wrong:** The changelog URL (`https://developers.openai.com/codex/changelog/`) is correct, but the document implies the referenced changelog matches 0.98.0. Since the live changelog now shows 0.103.0 as current, any reader following that link will see a different current version than the doc describes. [developers.openai](https://developers.openai.com/codex/changelog/)
- **Proposed addition (inline note next to changelog URL):**
  ```
  Codex changelog (current as of 2026-02-24: v0.103.0):
  https://developers.openai.com/codex/changelog/
  ```
- **Insertion point:** The changelog line in the "Authoritative URLs" section at the bottom. [developers.openai](https://developers.openai.com/codex/changelog/)

***

***

# 📋 MEMO: Getting Fully Autonomous Mode in Claude Code (Feb 2026)

**To:** Dev Team  
**Re:** Replacement for `claude --dangerously-skip-permissions`  
**Date:** 2026-02-24  

***

## Status

`--dangerously-skip-permissions` **still works** as of Claude Code v1.x (Feb 2026). It is a documented shortcut that maps directly to `--permission-mode bypassPermissions`. Both flags produce identical behavior. [pasqualepillitteri](https://pasqualepillitteri.it/en/news/141/claude-code-dangerously-skip-permissions-guide-autonomous-mode)

> Some builds surface only `--permission-mode` in `claude --help`, but `--dangerously-skip-permissions` remains a valid, accepted flag and is not deprecated — it is simply an alias. [code.claude](https://code.claude.com/docs/en/settings)

***

## Canonical Forms (use either, both work)

```bash
# Form 1 — classic "YOLO" shorthand (still valid):
claude --dangerously-skip-permissions

# Form 2 — explicit permission-mode form (what --help now shows):
claude --permission-mode bypassPermissions

# Form 3 — non-interactive / scripted / tmux handoff (add -p / --print):
claude --print --permission-mode bypassPermissions --add-dir <repo> "Your task here"
```

***

## With an Initial Prompt (pre-populate the first message)

```bash
claude --dangerously-skip-permissions "Scan repo, propose a 3-step plan, then execute it."
# or:
claude --permission-mode bypassPermissions "Scan repo, propose a 3-step plan, then execute it."
```

***

## Known Gotchas (Feb 2026)

| Issue | Detail |
|---|---|
| `--allowedTools` may be ignored with `bypassPermissions` | Use `--disallowedTools` instead — it works correctly in all modes  [pasqualepillitteri](https://pasqualepillitteri.it/en/news/141/claude-code-dangerously-skip-permissions-guide-autonomous-mode) |
| `bypassPermissions` can be disabled by admin/managed settings | Check `claude settings` for `bypassPermissions: "disable"` if the flag is rejected  [code.claude](https://code.claude.com/docs/en/settings) |
| `--dangerously-skip-permissions` not shown in `--help` on some builds | This does NOT mean it's broken; it's an alias that resolves correctly  [pasqualepillitteri](https://pasqualepillitteri.it/en/news/141/claude-code-dangerously-skip-permissions-guide-autonomous-mode) |

***

## Recommended Alias for Shell Config

Add to `~/.zshrc`:

```bash
alias clauded='claude --dangerously-skip-permissions'
alias clauded-print='claude --print --permission-mode bypassPermissions --add-dir .'
```

The `--dangerously-skip-permissions` flag is not going away — Anthropic's own settings docs explicitly reference it as the trigger for `bypassPermissions` mode, and disabling it is an enterprise admin option, not a default. [code.claude](https://code.claude.com/docs/en/settings)