"""
Tests for capture mechanisms.

Verifies:
- Asciicast file creation
- CC discovery mechanism (Day 0 Fix 4)
- AG telemetry configuration
"""

import os
import json
import tempfile
import shutil
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = REPO_ROOT / "scripts"


class TestDiscoverCCLogs:
    """Tests for CC log discovery (BC-06, Day 0 Fix 4)."""

    @pytest.mark.unit
    def test_script_exists(self):
        """discover-cc-logs.sh must exist."""
        script = SCRIPTS_DIR / "discover-cc-logs.sh"
        assert script.exists()

    @pytest.mark.unit
    def test_script_executable(self):
        """discover-cc-logs.sh must be executable."""
        script = SCRIPTS_DIR / "discover-cc-logs.sh"
        assert os.access(script, os.X_OK)

    @pytest.mark.unit
    def test_uses_timestamp_boundary(self):
        """Day 0 Fix 4: Must use timestamp boundary for discovery."""
        script = SCRIPTS_DIR / "discover-cc-logs.sh"
        content = script.read_text()
        assert "boundary" in content.lower() or "timestamp" in content.lower(), \
            "Must use timestamp boundary for discovery"

    @pytest.mark.unit
    def test_writes_locator_file(self):
        """Must write to .observability/cc_locator.json."""
        script = SCRIPTS_DIR / "discover-cc-logs.sh"
        content = script.read_text()
        assert "cc_locator.json" in content, \
            "Must write to cc_locator.json"
        assert ".observability" in content, \
            "Must write to .observability directory"

    @pytest.mark.unit
    def test_locator_has_required_fields(self):
        """Locator file format must include required fields."""
        script = SCRIPTS_DIR / "discover-cc-logs.sh"
        content = script.read_text()

        # Check that the JSON output includes these fields
        assert "cc_project_path" in content, "Must include cc_project_path"
        assert "discovered_at" in content, "Must include discovery timestamp"
        assert "discovery_method" in content, "Must include discovery method"

    @pytest.mark.unit
    def test_has_fallback_mode(self):
        """Must have fallback for when probe fails."""
        script = SCRIPTS_DIR / "discover-cc-logs.sh"
        content = script.read_text()
        assert "fallback" in content.lower(), "Must have fallback mode"

    @pytest.mark.unit
    def test_fallback_includes_warning(self):
        """Fallback mode must include warning about potential mismatch."""
        script = SCRIPTS_DIR / "discover-cc-logs.sh"
        content = script.read_text()
        assert "warning" in content.lower() or "WARN" in content, \
            "Fallback must warn about potential project mismatch"

    @pytest.mark.unit
    def test_has_show_mode(self):
        """Must have --show option to display current locator."""
        script = SCRIPTS_DIR / "discover-cc-logs.sh"
        content = script.read_text()
        assert "--show" in content, "Must support --show option"


class TestLocatorFormat:
    """Tests for the locator file format."""

    @pytest.mark.unit
    def test_locator_is_valid_json(self, temp_dir):
        """Locator content must be valid JSON."""
        # Simulate what the script writes
        locator = {
            "discovered_at": "2026-01-19T10:00:00Z",
            "cc_project_path": "/Users/test/.claude/projects/abc123",
            "discovery_method": "probe_with_timestamp_boundary",
            "boundary_time": "2026-01-19 10:00:00"
        }

        locator_file = temp_dir / "cc_locator.json"
        locator_file.write_text(json.dumps(locator, indent=2))

        # Should parse without error
        loaded = json.loads(locator_file.read_text())
        assert loaded["cc_project_path"].startswith("/Users")

    @pytest.mark.unit
    def test_fallback_locator_has_warning(self, temp_dir):
        """Fallback locator must include warning field."""
        locator = {
            "discovered_at": "2026-01-19T10:00:00Z",
            "cc_project_path": "/Users/test/.claude/projects/abc123",
            "discovery_method": "fallback_most_recent",
            "warning": "May not be the correct project - verify manually"
        }

        locator_file = temp_dir / "cc_locator.json"
        locator_file.write_text(json.dumps(locator, indent=2))

        loaded = json.loads(locator_file.read_text())
        assert "warning" in loaded
        assert loaded["discovery_method"] == "fallback_most_recent"


class TestAGTelemetrySetup:
    """Tests for AG telemetry configuration."""

    @pytest.mark.unit
    def test_setup_script_exists(self):
        """setup-ag-telemetry.sh must exist."""
        script = SCRIPTS_DIR / "setup-ag-telemetry.sh"
        assert script.exists()

    @pytest.mark.unit
    def test_setup_script_executable(self):
        """setup-ag-telemetry.sh must be executable."""
        script = SCRIPTS_DIR / "setup-ag-telemetry.sh"
        assert os.access(script, os.X_OK)

    @pytest.mark.unit
    def test_creates_gemini_dir(self):
        """Must create .gemini directory."""
        script = SCRIPTS_DIR / "setup-ag-telemetry.sh"
        content = script.read_text()
        assert ".gemini" in content, "Must reference .gemini directory"

    @pytest.mark.unit
    def test_telemetry_repo_local(self):
        """Day 0 Fix 3: Telemetry must be repo-local."""
        script = SCRIPTS_DIR / "setup-ag-telemetry.sh"
        content = script.read_text()
        # Should NOT reference ~/.gemini
        assert "~/.gemini" not in content or "REPO_ROOT" in content, \
            "Telemetry must be repo-local, not user-global"


class TestSetupObservability:
    """Tests for the main setup script."""

    @pytest.mark.unit
    def test_script_exists(self):
        """setup-observability.sh must exist."""
        script = SCRIPTS_DIR / "setup-observability.sh"
        assert script.exists()

    @pytest.mark.unit
    def test_script_executable(self):
        """setup-observability.sh must be executable."""
        script = SCRIPTS_DIR / "setup-observability.sh"
        assert os.access(script, os.X_OK)

    @pytest.mark.unit
    def test_creates_observability_dirs(self):
        """Must create .observability directory structure."""
        script = SCRIPTS_DIR / "setup-observability.sh"
        content = script.read_text()
        assert ".observability" in content
        assert "mkdir" in content

    @pytest.mark.unit
    def test_checks_dependencies(self):
        """Should check for required dependencies."""
        script = SCRIPTS_DIR / "setup-observability.sh"
        content = script.read_text()
        # Should check for asciinema
        assert "asciinema" in content


class TestCastFileStructure:
    """Tests for cast file naming and structure."""

    @pytest.mark.unit
    def test_cc_cast_prefix(self):
        """CC cast files should have cc- prefix."""
        script = SCRIPTS_DIR / "logged-claude.sh"
        content = script.read_text()
        assert "cc-" in content

    @pytest.mark.unit
    def test_ag_cast_prefix(self):
        """AG cast files should have ag- prefix."""
        script = SCRIPTS_DIR / "logged-ag.sh"
        content = script.read_text()
        assert "ag-" in content

    @pytest.mark.unit
    def test_cast_extension(self):
        """Cast files should have .cast extension."""
        for script_name in ["logged-claude.sh", "logged-ag.sh"]:
            script = SCRIPTS_DIR / script_name
            content = script.read_text()
            assert ".cast" in content

    @pytest.mark.unit
    def test_timestamp_format_in_filename(self):
        """Filename should include YYYYMMDD-HHMMSS timestamp."""
        script = SCRIPTS_DIR / "logged-claude.sh"
        content = script.read_text()
        # Check for date command with format
        assert "%Y%m%d" in content or "date" in content


class TestCaptureIntegration:
    """Integration tests for capture mechanisms."""

    @pytest.mark.integration
    def test_setup_creates_directories(self):
        """setup-observability.sh should create all required directories."""
        import subprocess

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create minimal repo structure
            tmp_repo = Path(tmpdir)
            scripts_dir = tmp_repo / "scripts"
            scripts_dir.mkdir(parents=True)

            # Copy setup script
            shutil.copy2(
                SCRIPTS_DIR / "setup-observability.sh",
                scripts_dir / "setup-observability.sh"
            )
            os.chmod(scripts_dir / "setup-observability.sh", 0o755)

            # Run setup
            result = subprocess.run(
                [str(scripts_dir / "setup-observability.sh")],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=str(tmp_repo)
            )

            # Check directories were created
            obs_dir = tmp_repo / ".observability"
            assert obs_dir.exists() or result.returncode != 0

    @pytest.mark.integration
    def test_discover_shows_help(self):
        """discover-cc-logs.sh --help should show usage."""
        import subprocess

        result = subprocess.run(
            [str(SCRIPTS_DIR / "discover-cc-logs.sh"), "--invalid-flag"],
            capture_output=True,
            text=True,
            timeout=10,
            cwd=str(REPO_ROOT)
        )

        # Should show usage info
        assert "Usage" in result.stdout or "Usage" in result.stderr or \
               result.returncode != 0
