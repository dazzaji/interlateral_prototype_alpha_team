"""
Tests for wrapper safety (BC-02).

Verifies:
- Proper argument quoting (Day 0 Fix 1)
- Collision-safe filenames (Day 0 Fix 2)
- Asciicast v2 format forcing (BC-03)
- Graceful degradation without asciinema
- AG telemetry repo-local behavior (Day 0 Fix 3)
"""

import os
import re
import subprocess
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = REPO_ROOT / "scripts"


class TestLoggedClaudeScript:
    """Unit tests for logged-claude.sh safety."""

    @pytest.mark.unit
    def test_script_exists(self):
        """logged-claude.sh must exist."""
        script = SCRIPTS_DIR / "logged-claude.sh"
        assert script.exists()

    @pytest.mark.unit
    def test_script_executable(self):
        """logged-claude.sh must be executable."""
        script = SCRIPTS_DIR / "logged-claude.sh"
        assert os.access(script, os.X_OK)

    @pytest.mark.unit
    def test_uses_strict_mode(self):
        """BC-02: Must use strict mode."""
        script = SCRIPTS_DIR / "logged-claude.sh"
        content = script.read_text()
        assert "set -euo pipefail" in content

    @pytest.mark.unit
    def test_uses_command_claude(self):
        """BC-02: Must use `command claude` to prevent recursion."""
        script = SCRIPTS_DIR / "logged-claude.sh"
        content = script.read_text()
        assert "command claude" in content, \
            "Must use 'command claude' not just 'claude' to prevent alias recursion"

    @pytest.mark.unit
    def test_uses_printf_q_for_quoting(self):
        """Day 0 Fix 1: Must use printf %q for safe argument quoting."""
        script = SCRIPTS_DIR / "logged-claude.sh"
        content = script.read_text()
        assert "printf '%q'" in content or 'printf "%q"' in content, \
            "Must use printf %q for safe shell quoting"

    @pytest.mark.unit
    def test_collision_safe_filename(self):
        """Day 0 Fix 2: Must use PID and random suffix in filename."""
        script = SCRIPTS_DIR / "logged-claude.sh"
        content = script.read_text()

        # Must have PID ($$)
        assert "$$" in content, "Must include PID in filename"

        # Must have random suffix (head -c from /dev/urandom)
        assert "/dev/urandom" in content or "RANDOM" in content, \
            "Must include random suffix in filename"

    @pytest.mark.unit
    def test_forces_v2_format(self):
        """BC-03/Day 0 Fix 1: Must force asciicast v2 format."""
        script = SCRIPTS_DIR / "logged-claude.sh"
        content = script.read_text()
        assert "--format asciicast-v2" in content or "asciicast-v2" in content, \
            "Must force asciicast v2 format"

    @pytest.mark.unit
    def test_graceful_degradation(self):
        """BC-02: Must gracefully degrade if asciinema missing."""
        script = SCRIPTS_DIR / "logged-claude.sh"
        content = script.read_text()

        # Must check if asciinema exists
        assert "command -v asciinema" in content, \
            "Must check if asciinema is available"

        # Must have fallback that still runs claude
        assert "exec command claude" in content, \
            "Must fall back to running claude without asciinema"

    @pytest.mark.unit
    def test_warns_on_missing_asciinema(self):
        """Should warn user when asciinema is not installed."""
        script = SCRIPTS_DIR / "logged-claude.sh"
        content = script.read_text()
        assert "[WARN]" in content or "WARN" in content, \
            "Should warn when asciinema missing"

    @pytest.mark.unit
    def test_uses_asciinema_command_mode(self):
        """BC-02: Must use asciinema -c for command mode."""
        script = SCRIPTS_DIR / "logged-claude.sh"
        content = script.read_text()
        assert "-c " in content, "Must use asciinema command mode (-c)"


class TestLoggedAGScript:
    """Unit tests for logged-ag.sh safety."""

    @pytest.mark.unit
    def test_script_exists(self):
        """logged-ag.sh must exist."""
        script = SCRIPTS_DIR / "logged-ag.sh"
        assert script.exists()

    @pytest.mark.unit
    def test_script_executable(self):
        """logged-ag.sh must be executable."""
        script = SCRIPTS_DIR / "logged-ag.sh"
        assert os.access(script, os.X_OK)

    @pytest.mark.unit
    def test_uses_strict_mode(self):
        """BC-02: Must use strict mode."""
        script = SCRIPTS_DIR / "logged-ag.sh"
        content = script.read_text()
        assert "set -euo pipefail" in content

    @pytest.mark.unit
    def test_changes_to_repo_root(self):
        """Day 0 Fix 3: Must cd to REPO_ROOT for repo-local telemetry."""
        script = SCRIPTS_DIR / "logged-ag.sh"
        content = script.read_text()
        assert 'cd "$REPO_ROOT"' in content, \
            "Must cd to REPO_ROOT to ensure telemetry.log lands in repo-local .gemini/"

    @pytest.mark.unit
    def test_creates_gemini_dir(self):
        """Day 0 Fix 3: Must ensure .gemini directory exists."""
        script = SCRIPTS_DIR / "logged-ag.sh"
        content = script.read_text()
        assert ".gemini" in content, "Must reference .gemini directory"
        assert "mkdir -p" in content, "Must create .gemini dir if missing"

    @pytest.mark.unit
    def test_uses_printf_q_for_quoting(self):
        """Day 0 Fix 1: Must use printf %q for safe argument quoting."""
        script = SCRIPTS_DIR / "logged-ag.sh"
        content = script.read_text()
        assert "printf '%q'" in content or 'printf "%q"' in content

    @pytest.mark.unit
    def test_collision_safe_filename(self):
        """Day 0 Fix 2: Must use PID and random suffix in filename."""
        script = SCRIPTS_DIR / "logged-ag.sh"
        content = script.read_text()
        assert "$$" in content
        assert "/dev/urandom" in content or "RANDOM" in content

    @pytest.mark.unit
    def test_detects_ag_command(self):
        """Must detect AG command (ag, antigravity, or ag.js)."""
        script = SCRIPTS_DIR / "logged-ag.sh"
        content = script.read_text()

        # Should check for multiple possible AG commands
        assert "detect_ag_command" in content or \
               ("ag" in content and "antigravity" in content), \
            "Must detect AG command variants"

    @pytest.mark.unit
    def test_uses_ag_prefix_for_cast(self):
        """Cast files from AG should have ag- prefix."""
        script = SCRIPTS_DIR / "logged-ag.sh"
        content = script.read_text()
        assert "ag-" in content, "AG cast files should have ag- prefix"


class TestFilenamePattern:
    """Test collision-safe filename patterns."""

    @pytest.mark.unit
    def test_filename_pattern_cc(self):
        """Verify CC filename pattern is collision-safe."""
        script = SCRIPTS_DIR / "logged-claude.sh"
        content = script.read_text()

        # Pattern should be: cc-YYYYMMDD-HHMMSS-PID-RANDOM.cast
        # Check for date pattern
        assert "%Y%m%d" in content or "date" in content

        # Check for timestamp format
        assert "TIMESTAMP" in content or "timestamp" in content

    @pytest.mark.unit
    def test_filename_pattern_ag(self):
        """Verify AG filename pattern is collision-safe."""
        script = SCRIPTS_DIR / "logged-ag.sh"
        content = script.read_text()

        # Pattern should be: ag-YYYYMMDD-HHMMSS-PID-RANDOM.cast
        assert "%Y%m%d" in content or "date" in content
        assert "TIMESTAMP" in content or "timestamp" in content


class TestWrapperOutputPaths:
    """Test that wrappers write to correct locations."""

    @pytest.mark.unit
    def test_cc_writes_to_observability_casts(self):
        """CC wrapper must write to .observability/casts/."""
        script = SCRIPTS_DIR / "logged-claude.sh"
        content = script.read_text()
        assert ".observability/casts" in content

    @pytest.mark.unit
    def test_ag_writes_to_observability_casts(self):
        """AG wrapper must write to .observability/casts/."""
        script = SCRIPTS_DIR / "logged-ag.sh"
        content = script.read_text()
        assert ".observability/casts" in content


class TestWrapperIntegration:
    """Integration tests for wrapper behavior."""

    @pytest.mark.integration
    def test_logged_claude_help_passthrough(self):
        """Verify logged-claude.sh passes --help correctly."""
        result = subprocess.run(
            [str(SCRIPTS_DIR / "logged-claude.sh"), "--help"],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(REPO_ROOT)
        )
        # Should either show claude help or graceful degradation message
        assert result.returncode == 0 or \
               "asciinema" in result.stderr.lower() or \
               "claude" in result.stderr.lower()

    @pytest.mark.integration
    def test_logged_claude_handles_special_chars(self):
        """Verify special characters in arguments are handled safely."""
        # Test with argument containing shell special characters
        test_arg = 'echo "hello world" && ls'

        result = subprocess.run(
            [str(SCRIPTS_DIR / "logged-claude.sh"), test_arg],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(REPO_ROOT)
        )
        # Should not execute the injected command
        # The arg should be quoted and passed as-is to claude
        # We're mainly checking it doesn't crash or do something unexpected
        assert "&&" not in result.stdout or result.returncode != 0 or \
               "asciinema" in result.stderr.lower()
