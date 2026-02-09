#!/bin/bash
# conformance-check.sh - Automated conformance verification
# Location: scripts/conformance-check.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Source shared tmux configuration
source "$SCRIPT_DIR/tmux-config.sh"
cd "$REPO_ROOT"

PASS=0
FAIL=0
WARN=0

check() {
    local name="$1"
    local cmd="$2"
    if eval "$cmd" > /dev/null 2>&1; then
        echo "  [PASS] $name"
        PASS=$((PASS+1))
    else
        echo "  [FAIL] $name"
        FAIL=$((FAIL+1))
    fi
}

warn_check() {
    local name="$1"
    local cmd="$2"
    if eval "$cmd" > /dev/null 2>&1; then
        echo "  [PASS] $name"
        PASS=$((PASS+1))
    else
        echo "  [WARN] $name (optional)"
        WARN=$((WARN+1))
    fi
}

echo "=== Interlateral Conformance Check v1.2 ==="
echo "Repo: $REPO_ROOT"
echo ""

# Section 1: Philosophy
echo "[1] Philosophy Checks"
check "wake-up.sh exists" "[ -f scripts/wake-up.sh ]"
check "bootstrap-full not commented" "grep -E '^[^#]*bootstrap-full' scripts/wake-up.sh"

# Section 2: Architecture
echo "[2] Architecture Checks"
check "AG CDP (127.0.0.1:9222)" "curl -s --max-time 2 http://127.0.0.1:9222/json/list"
check "Dashboard backend (127.0.0.1:3001)" "curl -s --max-time 2 http://127.0.0.1:3001/api/streams/status"
warn_check "Dashboard frontend (127.0.0.1:5173)" "curl -s --max-time 2 http://127.0.0.1:5173"

# Section 3: Quad-Agent
echo "[3] Quad-Agent Checks"
# CRITICAL: Use system socket sessions (interlateral-*) - see Section 13.5
check "CC tmux session exists (explicit socket)" "run_tmux has-session -t interlateral-claude 2>/dev/null"
warn_check "Codex tmux session exists (explicit socket)" "run_tmux has-session -t interlateral-codex 2>/dev/null"
warn_check "Gemini tmux session exists (explicit socket)" "run_tmux has-session -t interlateral-gemini 2>/dev/null"
check "ag.js exists" "[ -f interlateral_dna/ag.js ]"
check "cc.js exists" "[ -f interlateral_dna/cc.js ]"
check "codex.js exists" "[ -f interlateral_dna/codex.js ]"
check "gemini.js exists" "[ -f interlateral_dna/gemini.js ]"
check "leadership.json valid JSON" "jq empty interlateral_dna/leadership.json 2>/dev/null || python3 -c 'import json; json.load(open(\"interlateral_dna/leadership.json\"))'"

# Section 4: Coordination
echo "[4] Coordination Checks"
check "comms.md exists" "[ -f interlateral_dna/comms.md ]"
check "ag_log.md exists" "[ -f interlateral_dna/ag_log.md ]"

# Section 7: Plugin Architecture
echo "[7] Plugin Architecture Checks"
check "Glob pattern correct" "grep '\\*Skin\\.tsx' interlateral_comms_monitor/ui/src/skins/index.ts | grep -v '^[[:space:]]*//' | head -1"
check "Skins exist" "ls interlateral_comms_monitor/ui/src/skins/*Skin.tsx"

# Section 8: Injection
echo "[8] Injection Checks"
check "cc.js has 1s delay (not commented)" "grep -E '^[^#]*sleep 1' interlateral_dna/cc.js"
check "codex.js has 1s delay (not commented)" "grep -E '^[^#]*sleep 1' interlateral_dna/codex.js"
check "gemini.js has 1s delay (not commented)" "grep -E '^[^#]*sleep 1' interlateral_dna/gemini.js"

# Section 9: Configuration
echo "[9] Configuration Checks"
check "CLAUDE.md exists" "[ -f CLAUDE.md ]"
check "GEMINI.md exists" "[ -f GEMINI.md ]"
check "dev_plan.md exists" "[ -f dev_plan/dev_plan.md ]"

# Section 10: Dependencies
echo "[10] Dependency Checks"
check "Node.js >= 18" "node -v | grep -E 'v(1[89]|[2-9][0-9])'"
check "tmux installed" "which tmux"
warn_check "Codex CLI installed" "which codex"
warn_check "Gemini CLI installed" "which gemini"
check "Claude CLI installed" "which claude"

# Section 13.5: Explicit tmux Socket (prevents silent agent failures)
echo "[13.5] tmux Socket Checks"
check "Bootstrap sources tmux-config" "grep -E 'tmux-config.sh' scripts/bootstrap-full.sh"
check "Bootstrap-no-ag sources tmux-config" "grep -E 'tmux-config.sh' scripts/bootstrap-full-no-ag.sh"
check "Bootstrap unsets TMUX" "grep -E '^unset TMUX' scripts/bootstrap-full.sh"
check "Bootstrap-no-ag unsets TMUX" "grep -E '^unset TMUX' scripts/bootstrap-full-no-ag.sh"
check "open-tmux-window uses TMUX_SOCKET" "grep -E 'TMUX_SOCKET' scripts/open-tmux-window.sh"

# Section 16.2: Gemini model pinning (CRITICAL)
echo "[16.2] Gemini Model Pinning Checks"
check "bootstrap-full pins GEMINI_MODEL default" "grep -E 'GEMINI_MODEL=\"\\$\\{GEMINI_MODEL:-gemini-3-flash-preview\\}\"' scripts/bootstrap-full.sh"
check "bootstrap-full-no-ag pins GEMINI_MODEL default" "grep -E 'GEMINI_MODEL=\"\\$\\{GEMINI_MODEL:-gemini-3-flash-preview\\}\"' scripts/bootstrap-full-no-ag.sh"
check "bootstrap-full validates model preflight" "grep -E 'Validating Gemini model availability' scripts/bootstrap-full.sh"
check "bootstrap-full-no-ag validates model preflight" "grep -E 'Validating Gemini model availability' scripts/bootstrap-full-no-ag.sh"
check "bootstrap-full launches Gemini with pinned model" "grep -E \"gemini -m '.+' --approval-mode=yolo --sandbox=false\" scripts/bootstrap-full.sh"
check "bootstrap-full-no-ag launches Gemini with pinned model" "grep -E \"gemini -m '.+' --approval-mode=yolo --sandbox=false\" scripts/bootstrap-full-no-ag.sh"

# Section 16.2b: Codex startup autonomy policy (CRITICAL)
echo "[16.2b] Codex Startup Autonomy Checks"
check "bootstrap-full launches Codex with --yolo" "grep -E 'codex --yolo' scripts/bootstrap-full.sh"
check "bootstrap-full-no-ag launches Codex with --yolo" "grep -E 'codex --yolo' scripts/bootstrap-full-no-ag.sh"
check "start-codex-tmux launches Codex with --yolo" "grep -E 'codex --yolo' scripts/start-codex-tmux.sh"
check "No startup script uses codex --full-auto" "! rg -n 'codex --full-auto' scripts/bootstrap-full.sh scripts/bootstrap-full-no-ag.sh scripts/start-codex-tmux.sh"

# Section 16.5: Claude model pinning (hybrid)
echo "[16.5] Claude Model Policy Checks"
check "logged-claude sets CLAUDE_MODEL default" "grep -E 'DEFAULT_CLAUDE_MODEL=\"\\$\\{CLAUDE_MODEL:-opus\\}\"' scripts/logged-claude.sh"
check "logged-claude injects model when absent" "grep -F 'CLAUDE_ARGS=(--model \"\$DEFAULT_CLAUDE_MODEL\"' scripts/logged-claude.sh"
check "logged-claude preflights explicit full model IDs" "grep -F 'if [[ \"\$SELECTED_MODEL\" == claude-* ]]; then' scripts/logged-claude.sh"
check "logged-claude fails fast on unavailable explicit model" "grep -E 'exit 1' scripts/logged-claude.sh"

# Build validation (if TypeScript files changed)
echo "[Build] Validation"
if [ -d "interlateral_comms_monitor/ui/node_modules" ]; then
    warn_check "TypeScript compiles" "cd interlateral_comms_monitor/ui && npx tsc --noEmit"
else
    echo "  [SKIP] TypeScript check (run npm install first)"
fi

echo ""
echo "=========================================="
echo "  PASS: $PASS  |  FAIL: $FAIL  |  WARN: $WARN"
echo "=========================================="

if [ $FAIL -gt 0 ]; then
    echo ""
    echo "CONFORMANCE CHECK FAILED"
    echo "Fix the failures above before committing."
    exit 1
else
    echo ""
    echo "CONFORMANCE CHECK PASSED"
    exit 0
fi
