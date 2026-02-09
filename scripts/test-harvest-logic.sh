#!/usr/bin/env bash
# test-harvest-logic.sh - Mock test for harvest-session.sh logic
# Verifies path matching and repo anchoring

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

MOCK_PROJECT_DIR="/tmp/mock_claude_project"
rm -rf "$MOCK_PROJECT_DIR"
mkdir -p "$MOCK_PROJECT_DIR"

MOCK_ANCHOR="test_anchor_123"
MOCK_LOG="$MOCK_PROJECT_DIR/mock_session.jsonl"

# Create a mock log file with the anchor and correct cwd
cat > "$MOCK_LOG" <<EOF
{"type": "user", "message": {"content": [{"text": "Hello"}]}, "cwd": "$REPO_ROOT", "session_id": "999"}
{"type": "assistant", "message": {"content": [{"text": "Hi, anchor is $MOCK_ANCHOR"}]}, "cwd": "$REPO_ROOT", "session_id": "999"}
EOF

echo "=== Mocking CC Project Directory ==="
# Temporarily override ~/.claude/projects/ by mocking the variable if possible, 
# but harvest-session.sh uses the literal path. We'll have to mock the HOME for the test.
OLD_HOME="$HOME"
export HOME="/tmp/mock_home"
mkdir -p "$HOME/.claude/projects/test_proj"
cp "$MOCK_LOG" "$HOME/.claude/projects/test_proj/"

echo "=== Running harvest-session.sh with Mock Home ==="
./scripts/harvest-session.sh "$MOCK_ANCHOR"

BUNDLE_DIR=".observability/runs/$MOCK_ANCHOR"
if [[ -f "$BUNDLE_DIR/cc_native.jsonl" ]]; then
    echo "✅ TEST PASS: cc_native.jsonl harvested successfully."
else
    echo "❌ TEST FAIL: cc_native.jsonl NOT harvested."
    exit 1
fi

# Cleanup
rm -rf "/tmp/mock_home"
rm -rf "$MOCK_PROJECT_DIR"

echo "=== Test Complete ==="
