# ⚠️ FEBRUARY 2026 UPDATE — CRITICAL CHANGES

> **Last Updated:** 2026-02-05
> **Codex CLI Version:** 0.98.0

---

## 🔴 BREAKING CHANGES: Full Autonomy No Longer Possible

### 1. Git Commands Now ALWAYS Require Approval (Feb 4, 2026)

**Codex v0.95.0 changelog:**
> "Hardened Git command safety so destructive or write-capable invocations no longer bypass approval checks" (#10258)

**Impact:** Even with `--yolo`, the following git operations WILL prompt for approval:
- `git push` (any variant)
- `git reset --hard`
- `git checkout .` / `git restore .`
- `git clean -f`
- `git branch -D`
- Force pushes
- Any destructive/write-capable git command

**This is BY DESIGN, not a bug.** OpenAI hardened git commands for security.

### 2. Smart Approvals Enabled by Default (Jan 31, 2026)

**Codex v0.93.0 changelog:**
> "Smart approvals enabled by default with explicit approval prompts for MCP tool calls" (#10286)

**Impact:** MCP (Model Context Protocol) tool calls now require explicit approval, even with `--yolo`.

### 3. Steer Mode Now Default (Feb 5, 2026)

**Codex v0.98.0 changelog:**
> "Steer mode is now stable and enabled by default. Enter sends input immediately during running tasks; Tab queues follow-up input."

**Impact:** When Codex is actively working on a task:
- `Enter` sends your input **immediately** (interrupts/steers the agent)
- `Tab` queues your input for after the current task completes

**For Quad-Agent Mesh:** This affects tmux injection timing. When injecting messages while Codex is working, the message will be sent immediately rather than queued. Test injection patterns if you experience issues.

### 4. Allow and Remember for Tool Approvals (Feb 2026)

**Codex v0.97.0 changelog:**
> "Session-scoped 'Allow and remember' option for MCP/App tool approvals"

**Impact:** When approving a tool call, you can now choose "Allow for this session" to auto-approve repeated calls to the same tool. Reduces approval fatigue for trusted tools.

---

## 🟡 CURRENT BEST PRACTICE

```bash
# Still the best option for maximum autonomy:
codex --yolo

# Equivalent explicit form:
codex --ask-for-approval never --sandbox danger-full-access
```

**Accept that:**
- Git write operations will prompt (security feature, cannot disable)
- MCP tool calls will prompt (new default, cannot disable)

---

## 🟢 OPERATIONS THAT STILL AUTO-APPROVE

| Operation | Auto-Approves with --yolo? |
|-----------|---------------------------|
| Read files | ✅ Yes |
| Write files | ✅ Yes |
| Run shell commands | ✅ Yes |
| Git read (status, log, diff) | ✅ Yes |
| **Git write (push, commit)** | ❌ No (hardened) |
| **Git destructive (reset, clean)** | ❌ No (hardened) |
| **MCP tool calls** | ❌ No (smart approvals) |

---

## 🔵 FOR QUAD-AGENT MESH: PERMISSION GRANTING

When Codex stops on a permission prompt, **another agent (CC, GM, or AG) must grant the permission** by injecting the appropriate response into Codex's tmux session.

See `CLAUDE.md` Section "Permission Granting Protocol" for instructions.

---

**Sources:**
- [OpenAI Codex Changelog](https://developers.openai.com/codex/changelog/)
- [CLI Reference](https://developers.openai.com/codex/cli/reference/)
- [GitHub Issue #2969](https://github.com/openai/codex/issues/2969)

---

# Closest match to Claude Code "dangerously" (no approvals, no sandbox)

```bash
codex exec --dangerously-bypass-approvals-and-sandbox "Your task here"
# alias:
codex exec --yolo "Your task here"
```

* Official CLI reference: this runs “without approvals or sandboxing” and should only be used in an externally hardened environment. ([OpenAI Developers][1])
  URL: `https://developers.openai.com/codex/cli/reference/`
* Security doc also labels it “No sandbox; no approvals” and notes the `--yolo` alias. ([OpenAI Developers][3])
  URL: `https://developers.openai.com/codex/security/`

### If you mean “automate heavily but keep sandbox guardrails”

```bash
codex exec --full-auto "Your task here"
```

* Official: `--full-auto` ≡ `--sandbox workspace-write --ask-for-approval on-request`. ([OpenAI Developers][3])
  URL: `https://developers.openai.com/codex/security/`
* Official noninteractive guidance also calls out `codex exec --full-auto "<task>"` as the “Allow edits” setting. ([OpenAI Developers][2])
  URL: `https://developers.openai.com/codex/noninteractive/`

### Fine-grained “no prompts but still sandboxed”

```bash
codex exec --sandbox workspace-write --ask-for-approval never "Your task here"
```

* Official: `--ask-for-approval never` works with all sandbox modes. ([OpenAI Developers][3])
  URL: `https://developers.openai.com/codex/security/`
* Caveat: known Windows issues may still cause prompts / unexpected behavior even with these settings. ([GitHub][4])
  URLs: `https://github.com/openai/codex/issues/2350`, `https://github.com/openai/codex/issues/2969`

**If you want a single “Claude run dangerously” analog line to memorize, it’s:**

```bash
codex exec --yolo "Your task here"
```

(Exact alias of `--dangerously-bypass-approvals-and-sandbox`.) ([OpenAI Developers][1])

[1]: https://developers.openai.com/codex/cli/reference/ "Command line options"
[2]: https://developers.openai.com/codex/noninteractive/ "Non-interactive mode"
[3]: https://developers.openai.com/codex/security/ "Security"
[4]: https://github.com/openai/codex/issues/2350?utm_source=chatgpt.com "--ask-for-approval never on Windows still requires ..."
