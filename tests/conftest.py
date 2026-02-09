"""
Pytest configuration and shared fixtures for observability tests.
"""

import os
import json
import tempfile
import shutil
from pathlib import Path
from typing import Generator

import pytest


# Get repo root (tests/ is one level down)
REPO_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = REPO_ROOT / "scripts"
OBSERVABILITY_DIR = REPO_ROOT / ".observability"


@pytest.fixture
def repo_root() -> Path:
    """Return the repository root path."""
    return REPO_ROOT


@pytest.fixture
def scripts_dir() -> Path:
    """Return the scripts directory path."""
    return SCRIPTS_DIR


@pytest.fixture
def temp_dir() -> Generator[Path, None, None]:
    """Create a temporary directory for test artifacts."""
    tmp = Path(tempfile.mkdtemp(prefix="observability_test_"))
    yield tmp
    shutil.rmtree(tmp, ignore_errors=True)


@pytest.fixture
def sample_cast_v2() -> str:
    """Return a sample asciicast v2 file content."""
    header = json.dumps({
        "version": 2,
        "width": 80,
        "height": 24,
        "timestamp": 1705700000,
        "title": "Test Session"
    })
    frames = [
        json.dumps([0.0, "o", "$ "]),
        json.dumps([0.5, "o", "echo hello"]),
        json.dumps([1.0, "o", "\r\n"]),
        json.dumps([1.2, "o", "hello\r\n"]),
        json.dumps([1.5, "o", "$ "]),
    ]
    return header + "\n" + "\n".join(frames)


@pytest.fixture
def sample_cast_file(temp_dir: Path, sample_cast_v2: str) -> Path:
    """Create a sample .cast file and return its path."""
    cast_file = temp_dir / "test_session.cast"
    cast_file.write_text(sample_cast_v2)
    return cast_file


@pytest.fixture
def sample_cc_jsonl() -> str:
    """Return sample CC JSONL content."""
    entries = [
        {"type": "message", "role": "user", "content": "Hello", "timestamp": "2026-01-19T10:00:00Z"},
        {"type": "message", "role": "assistant", "content": "Hi there!", "timestamp": "2026-01-19T10:00:01Z"},
        {
            "type": "message",
            "role": "assistant",
            "content": [
                {"type": "text", "text": "Let me check that."},
                {"type": "tool_use", "name": "Read", "id": "tool_123", "input": {"file_path": "/tmp/test.txt"}}
            ],
            "timestamp": "2026-01-19T10:00:02Z"
        },
        {"type": "token_usage", "usage": {"input_tokens": 100, "output_tokens": 50}},
    ]
    return "\n".join(json.dumps(e) for e in entries)


@pytest.fixture
def sample_cc_jsonl_file(temp_dir: Path, sample_cc_jsonl: str) -> Path:
    """Create a sample CC JSONL file and return its path."""
    jsonl_file = temp_dir / "test_session.jsonl"
    jsonl_file.write_text(sample_cc_jsonl)
    return jsonl_file


@pytest.fixture
def sample_ag_telemetry() -> str:
    """Return sample AG telemetry.log content."""
    entries = [
        {
            "type": "api_request",
            "timestamp": 1705700000000,
            "model": "gemini-pro"
        },
        {
            "type": "api_response",
            "timestamp": 1705700001000,
            "thoughtsTokenCount": 150,
            "outputTokenCount": 50,
            "inputTokenCount": 100
        },
        {
            "type": "tool_call",
            "timestamp": 1705700002000,
            "tool_name": "read_file",
            "arguments": {"path": "/tmp/test.txt"},
            "duration_ms": 50
        },
    ]
    return "\n".join(json.dumps(e) for e in entries)


@pytest.fixture
def sample_ag_telemetry_file(temp_dir: Path, sample_ag_telemetry: str) -> Path:
    """Create a sample AG telemetry.log file and return its path."""
    telemetry_file = temp_dir / "telemetry.log"
    telemetry_file.write_text(sample_ag_telemetry)
    return telemetry_file


@pytest.fixture
def mock_observability_dir(temp_dir: Path) -> Path:
    """Create a mock .observability directory structure."""
    obs_dir = temp_dir / ".observability"
    (obs_dir / "casts").mkdir(parents=True)
    (obs_dir / "logs").mkdir(parents=True)
    return obs_dir


# Markers for test categories
def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line(
        "markers", "integration: mark test as integration test (requires RUN_INTEGRATION_TESTS=1)"
    )
    config.addinivalue_line(
        "markers", "unit: mark test as unit test (always runs)"
    )


def pytest_collection_modifyitems(config, items):
    """Skip integration tests unless RUN_INTEGRATION_TESTS is set."""
    if os.environ.get("RUN_INTEGRATION_TESTS") != "1":
        skip_integration = pytest.mark.skip(reason="Set RUN_INTEGRATION_TESTS=1 to run")
        for item in items:
            if "integration" in item.keywords:
                item.add_marker(skip_integration)
