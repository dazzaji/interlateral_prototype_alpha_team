"""
Tests for wake-up reliability (BC-01).

Unit tests verify script structure and safety.
Integration tests verify end-to-end wake-up works.
"""

import os
import subprocess
import tempfile
import shutil
from pathlib import Path

import pytest


# Get repo root
REPO_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = REPO_ROOT / "scripts"


class TestWakeUpScript:
    """Unit tests for wake-up.sh structure and safety."""

    @pytest.mark.unit
    def test_wake_up_script_exists(self):
        """BC-01: Canonical wake-up.sh must exist."""
        script = SCRIPTS_DIR / "wake-up.sh"
        assert script.exists(), f"wake-up.sh not found at {script}"

    @pytest.mark.unit
    def test_wake_up_script_executable(self):
        """wake-up.sh must be executable."""
        script = SCRIPTS_DIR / "wake-up.sh"
        assert os.access(script, os.X_OK), "wake-up.sh is not executable"

    @pytest.mark.unit
    def test_wake_up_script_has_shebang(self):
        """wake-up.sh must have proper shebang."""
        script = SCRIPTS_DIR / "wake-up.sh"
        content = script.read_text()
        assert content.startswith("#!/bin/bash"), "Missing bash shebang"

    @pytest.mark.unit
    def test_wake_up_uses_set_euo_pipefail(self):
        """wake-up.sh must use strict mode for safety."""
        script = SCRIPTS_DIR / "wake-up.sh"
        content = script.read_text()
        assert "set -euo pipefail" in content, "Missing strict mode"

    @pytest.mark.unit
    def test_wake_up_creates_observability_dirs(self):
        """wake-up.sh must create .observability directories."""
        script = SCRIPTS_DIR / "wake-up.sh"
        content = script.read_text()
        assert ".observability/casts" in content, "Must create casts dir"
        assert ".observability/logs" in content, "Must create logs dir"

    @pytest.mark.unit
    def test_wake_up_calls_rotate_logs(self):
        """wake-up.sh should call rotate-logs.sh (best effort)."""
        script = SCRIPTS_DIR / "wake-up.sh"
        content = script.read_text()
        assert "rotate-logs.sh" in content, "Should call rotation"
        # Must not block on rotation failure
        assert "|| true" in content or "2>/dev/null" in content, \
            "Rotation must not block wake-up"

    @pytest.mark.unit
    def test_wake_up_calls_logged_claude(self):
        """wake-up.sh must delegate to logged-claude.sh."""
        script = SCRIPTS_DIR / "wake-up.sh"
        content = script.read_text()
        assert "logged-claude.sh" in content, "Must call logged-claude.sh"
        assert 'exec "$REPO_ROOT/scripts/logged-claude.sh"' in content, \
            "Must exec to logged-claude.sh for proper signal handling"


class TestWakeUpDependencies:
    """Verify all scripts wake-up.sh depends on exist."""

    @pytest.mark.unit
    def test_logged_claude_exists(self):
        """logged-claude.sh must exist."""
        script = SCRIPTS_DIR / "logged-claude.sh"
        assert script.exists(), f"logged-claude.sh not found"

    @pytest.mark.unit
    def test_logged_claude_executable(self):
        """logged-claude.sh must be executable."""
        script = SCRIPTS_DIR / "logged-claude.sh"
        assert os.access(script, os.X_OK), "logged-claude.sh is not executable"

    @pytest.mark.unit
    def test_rotate_logs_exists(self):
        """rotate-logs.sh must exist."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        assert script.exists(), f"rotate-logs.sh not found"


class TestWakeUpHelp:
    """Test wake-up.sh with --help flag (should pass through to claude)."""

    @pytest.mark.integration
    def test_wake_up_passes_args(self):
        """wake-up.sh should pass all arguments to claude."""
        # This integration test verifies argument passthrough
        # We test with --version which should work even without full claude setup
        result = subprocess.run(
            [str(SCRIPTS_DIR / "wake-up.sh"), "--version"],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(REPO_ROOT)
        )
        # Either works (claude outputs version) or fails gracefully
        # The key is it shouldn't crash on argument handling
        assert result.returncode == 0 or "claude" in result.stderr.lower() or \
               "asciinema" in result.stderr.lower(), \
            f"Unexpected error: {result.stderr}"


class TestWakeUpObservabilityDirs:
    """Test that wake-up.sh creates proper directory structure."""

    @pytest.mark.unit
    def test_observability_structure_after_script_parse(self):
        """Verify script would create correct structure."""
        script = SCRIPTS_DIR / "wake-up.sh"
        content = script.read_text()

        # Must use mkdir -p for idempotent creation
        assert "mkdir -p" in content, "Must use mkdir -p for idempotent creation"

    @pytest.mark.integration
    def test_creates_observability_dirs_in_temp(self):
        """Integration test: wake-up.sh creates dirs in a temp repo clone."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create minimal repo structure
            tmp_repo = Path(tmpdir)
            scripts_dir = tmp_repo / "scripts"
            scripts_dir.mkdir(parents=True)

            # Copy scripts
            for script in ["wake-up.sh", "logged-claude.sh", "rotate-logs.sh"]:
                src = SCRIPTS_DIR / script
                dst = scripts_dir / script
                shutil.copy2(src, dst)
                os.chmod(dst, 0o755)

            # Create a mock claude that just exits
            mock_claude = tmp_repo / "mock-claude.sh"
            mock_claude.write_text("#!/bin/bash\nexit 0\n")
            os.chmod(mock_claude, 0o755)

            # Modify logged-claude.sh to use mock instead
            logged_claude = scripts_dir / "logged-claude.sh"
            content = logged_claude.read_text()
            # Replace `command claude` with our mock
            content = content.replace(
                'cmd="command claude"',
                f'cmd="{mock_claude}"'
            )
            logged_claude.write_text(content)

            # Run wake-up.sh (should create dirs even if claude mock runs)
            result = subprocess.run(
                [str(scripts_dir / "wake-up.sh")],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=str(tmp_repo),
                env={**os.environ, "PATH": f"{scripts_dir}:{os.environ.get('PATH', '')}"}
            )

            # Check dirs were created (even if rest failed)
            obs_dir = tmp_repo / ".observability"
            assert (obs_dir / "casts").exists() or "asciinema" in result.stderr.lower(), \
                f"Casts dir not created. stderr: {result.stderr}"
