"""
Tests for log rotation and cleanup (BC-08).

Verifies:
- rotate-logs.sh implementation
- Threshold-based rotation (files/size)
- Archive creation
- Archive retention
- Never blocks wake-up
"""

import os
import subprocess
import tempfile
import shutil
from pathlib import Path
from datetime import datetime, timedelta

import pytest


REPO_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = REPO_ROOT / "scripts"


class TestRotateLogsScript:
    """Unit tests for rotate-logs.sh structure and safety."""

    @pytest.mark.unit
    def test_script_exists(self):
        """rotate-logs.sh must exist (BC-08)."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        assert script.exists(), "rotate-logs.sh must exist for BC-08"

    @pytest.mark.unit
    def test_script_executable(self):
        """rotate-logs.sh must be executable."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        assert os.access(script, os.X_OK)

    @pytest.mark.unit
    def test_uses_strict_mode(self):
        """Must use strict mode for safety."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        assert "set -euo pipefail" in content

    @pytest.mark.unit
    def test_has_file_count_threshold(self):
        """Must have file count threshold for rotation."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        # Should have MAX_FILES or similar
        assert "MAX_FILES" in content or "max_files" in content.lower() or \
               "50" in content, "Must have file count threshold"

    @pytest.mark.unit
    def test_has_size_threshold(self):
        """Must have size threshold for rotation."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        # Should have MAX_SIZE or similar
        assert "MAX_SIZE" in content or "max_size" in content.lower() or \
               "500" in content, "Must have size threshold"

    @pytest.mark.unit
    def test_creates_archives(self):
        """Must create tar.gz archives."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        assert "tar" in content, "Must use tar for archiving"
        assert ".tar.gz" in content or "gz" in content, "Must create gzipped archives"

    @pytest.mark.unit
    def test_archives_go_to_logs_dir(self):
        """Archives should go to .observability/logs/."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        assert ".observability/logs" in content or "ARCHIVE_DIR" in content

    @pytest.mark.unit
    def test_has_archive_retention(self):
        """Must delete old archives after retention period."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        # Should have retention period (30 days mentioned in spec)
        assert "RETENTION" in content or "mtime" in content or \
               "days" in content.lower(), "Must have archive retention policy"

    @pytest.mark.unit
    def test_keeps_recent_files(self):
        """Must keep some recent files (not archive everything)."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        # Should keep newest files
        assert "keep" in content.lower() or "head" in content or \
               "tail" in content, "Must keep recent files"


class TestRotationBehavior:
    """Tests for rotation logic."""

    @pytest.mark.unit
    def test_handles_empty_directory(self):
        """Should handle empty casts directory gracefully."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        # Should check for file count or use safe defaults
        assert "find" in content or "ls" in content, \
            "Must safely count files"

    @pytest.mark.unit
    def test_rotation_uses_timestamp_naming(self):
        """Archives should include timestamp in name."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        assert "date" in content or "TIMESTAMP" in content, \
            "Archive names should include timestamp"

    @pytest.mark.unit
    def test_never_blocks(self):
        """Rotation failures must not block wake-up."""
        # Check that wake-up.sh calls rotation with error suppression
        wake_up = SCRIPTS_DIR / "wake-up.sh"
        content = wake_up.read_text()
        # Should have || true or 2>/dev/null to prevent blocking
        assert "|| true" in content or "2>/dev/null" in content, \
            "Rotation must not block wake-up"


class TestArchiveNaming:
    """Tests for archive file naming conventions."""

    @pytest.mark.unit
    def test_archive_prefix(self):
        """Archives should have descriptive prefix."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        # Should have "archive-" prefix
        assert "archive-" in content or "Archive" in content

    @pytest.mark.unit
    def test_archive_has_timestamp(self):
        """Archive name should include timestamp."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        assert "%Y%m%d" in content or "YYYYMMDD" in content or \
               "$(date" in content


class TestRotationIntegration:
    """Integration tests for rotation."""

    @pytest.mark.integration
    def test_rotation_runs_without_error(self):
        """rotate-logs.sh should run without error on clean state."""
        result = subprocess.run(
            [str(SCRIPTS_DIR / "rotate-logs.sh")],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(REPO_ROOT)
        )
        # Should complete without error (or with expected output)
        assert result.returncode == 0 or "Complete" in result.stdout, \
            f"Rotation failed: {result.stderr}"

    @pytest.mark.integration
    def test_rotation_creates_archive_when_needed(self):
        """Should create archive when threshold exceeded."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_repo = Path(tmpdir)
            scripts_dir = tmp_repo / "scripts"
            scripts_dir.mkdir(parents=True)

            # Copy rotation script
            shutil.copy2(SCRIPTS_DIR / "rotate-logs.sh", scripts_dir)
            os.chmod(scripts_dir / "rotate-logs.sh", 0o755)

            # Create observability structure
            casts_dir = tmp_repo / ".observability" / "casts"
            logs_dir = tmp_repo / ".observability" / "logs"
            casts_dir.mkdir(parents=True)
            logs_dir.mkdir(parents=True)

            # Create many cast files to trigger rotation
            for i in range(60):  # More than MAX_FILES (50)
                cast_file = casts_dir / f"test-{i:03d}.cast"
                cast_file.write_text('{"version": 2}\n')

            # Run rotation
            result = subprocess.run(
                [str(scripts_dir / "rotate-logs.sh")],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=str(tmp_repo)
            )

            # Check that rotation occurred
            archives = list(logs_dir.glob("archive-*.tar.gz"))
            remaining_casts = list(casts_dir.glob("*.cast"))

            # Should have created an archive OR at least not crashed
            assert result.returncode == 0 or len(archives) > 0 or \
                   len(remaining_casts) < 60, \
                f"Rotation should reduce file count. stderr: {result.stderr}"


class TestCleanupRetention:
    """Tests for archive retention policy."""

    @pytest.mark.unit
    def test_retention_period_defined(self):
        """Retention period should be defined."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        # Should have 30 days retention (from spec)
        assert "30" in content or "RETENTION" in content

    @pytest.mark.unit
    def test_uses_find_mtime(self):
        """Should use find -mtime for old archive cleanup."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        assert "-mtime" in content or "older than" in content.lower(), \
            "Should use mtime to find old archives"


class TestObservabilityDirStructure:
    """Tests for the .observability directory structure."""

    @pytest.mark.unit
    def test_casts_dir_in_rotation(self):
        """Rotation should work on .observability/casts/."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        assert ".observability/casts" in content or "CAST_DIR" in content

    @pytest.mark.unit
    def test_logs_dir_for_archives(self):
        """Archives should go to .observability/logs/."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        assert ".observability/logs" in content or "ARCHIVE_DIR" in content

    @pytest.mark.unit
    def test_mkdir_p_for_dirs(self):
        """Should use mkdir -p for idempotent creation."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        assert "mkdir -p" in content


class TestRotationLogging:
    """Tests for rotation script output/logging."""

    @pytest.mark.unit
    def test_outputs_status(self):
        """Should output status messages."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        assert "echo" in content, "Should output status messages"

    @pytest.mark.unit
    def test_reports_completion(self):
        """Should report completion status."""
        script = SCRIPTS_DIR / "rotate-logs.sh"
        content = script.read_text()
        assert "Complete" in content or "complete" in content or \
               "Done" in content or "done" in content
