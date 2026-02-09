"""
Tests for Lake Merritt ingestors.

Tests the three observability ingestors:
- CastIngester (asciicast v2)
- CCJSONLIngester (Claude Code transcripts)
- AGTelemetryIngester (Antigravity telemetry)
"""

import json
import tempfile
from pathlib import Path
from datetime import datetime

import pytest

# Import from the lake_merritt package in corpbot_agent_evals
import sys
REPO_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(REPO_ROOT / "corpbot_agent_evals" / "lake_merritt"))

from core.ingestion import (
    CastIngester, CastRecording, parse_cast_file,
    CCJSONLIngester, CCTranscript, parse_cc_transcript,
    AGTelemetryIngester, AGSession, parse_ag_telemetry,
)


class TestCastIngester:
    """Tests for asciicast v2 parsing (BC-03)."""

    @pytest.mark.unit
    def test_parse_valid_v2_cast(self, sample_cast_v2, temp_dir):
        """Should parse valid asciicast v2 file."""
        cast_file = temp_dir / "test.cast"
        cast_file.write_text(sample_cast_v2)

        ingester = CastIngester()
        recording = ingester.ingest(cast_file)

        assert recording.version == 2
        assert recording.width == 80
        assert recording.height == 24
        assert len(recording.frames) == 5

    @pytest.mark.unit
    def test_parse_frames_correctly(self, sample_cast_v2, temp_dir):
        """Should parse frame timestamps and data correctly."""
        cast_file = temp_dir / "test.cast"
        cast_file.write_text(sample_cast_v2)

        recording = CastIngester().ingest(cast_file)

        # Check first frame
        assert recording.frames[0].timestamp == 0.0
        assert recording.frames[0].event_type == "o"
        assert recording.frames[0].data == "$ "

    @pytest.mark.unit
    def test_extract_text(self, sample_cast_v2, temp_dir):
        """Should extract all output text."""
        cast_file = temp_dir / "test.cast"
        cast_file.write_text(sample_cast_v2)

        ingester = CastIngester()
        recording = ingester.ingest(cast_file)
        text = ingester.extract_text(recording)

        assert "$ " in text
        assert "echo hello" in text
        assert "hello" in text

    @pytest.mark.unit
    def test_find_patterns(self, sample_cast_v2, temp_dir):
        """Should find patterns with timestamps."""
        cast_file = temp_dir / "test.cast"
        cast_file.write_text(sample_cast_v2)

        ingester = CastIngester()
        recording = ingester.ingest(cast_file)
        results = ingester.find_patterns(recording, ["$", "hello"])

        assert len(results["$"]) >= 1
        assert len(results["hello"]) >= 1

    @pytest.mark.unit
    def test_reject_v1_format(self, temp_dir):
        """BC-03: Should reject asciicast v1 format."""
        # v1 format has version: 1
        v1_content = json.dumps({"version": 1, "width": 80, "height": 24})
        cast_file = temp_dir / "v1.cast"
        cast_file.write_text(v1_content + "\n")

        ingester = CastIngester()
        with pytest.raises(ValueError, match="Unsupported asciicast version"):
            ingester.ingest(cast_file)

    @pytest.mark.unit
    def test_convenience_function(self, sample_cast_v2, temp_dir):
        """Test parse_cast_file convenience function."""
        cast_file = temp_dir / "test.cast"
        cast_file.write_text(sample_cast_v2)

        recording = parse_cast_file(cast_file)
        assert recording.version == 2

    @pytest.mark.unit
    def test_empty_file_raises(self, temp_dir):
        """Should raise on empty file."""
        cast_file = temp_dir / "empty.cast"
        cast_file.write_text("")

        with pytest.raises(ValueError, match="Empty cast file"):
            CastIngester().ingest(cast_file)

    @pytest.mark.unit
    def test_stores_source_file(self, sample_cast_v2, temp_dir):
        """Should store source file path."""
        cast_file = temp_dir / "test.cast"
        cast_file.write_text(sample_cast_v2)

        recording = CastIngester().ingest(cast_file)
        assert recording.source_file == str(cast_file)


class TestCCJSONLIngester:
    """Tests for Claude Code transcript parsing (BC-06)."""

    @pytest.mark.unit
    def test_parse_valid_transcript(self, sample_cc_jsonl, temp_dir):
        """Should parse valid CC JSONL file."""
        jsonl_file = temp_dir / "session.jsonl"
        jsonl_file.write_text(sample_cc_jsonl)

        ingester = CCJSONLIngester()
        transcript = ingester.ingest(jsonl_file)

        assert transcript.session_id == "session"
        assert len(transcript.messages) >= 2

    @pytest.mark.unit
    def test_parse_messages(self, sample_cc_jsonl, temp_dir):
        """Should parse messages with roles."""
        jsonl_file = temp_dir / "session.jsonl"
        jsonl_file.write_text(sample_cc_jsonl)

        transcript = CCJSONLIngester().ingest(jsonl_file)

        # Check we have user and assistant messages
        roles = [m.role for m in transcript.messages]
        assert "user" in roles
        assert "assistant" in roles

    @pytest.mark.unit
    def test_extract_tool_uses(self, sample_cc_jsonl, temp_dir):
        """Should extract tool uses from content blocks."""
        jsonl_file = temp_dir / "session.jsonl"
        jsonl_file.write_text(sample_cc_jsonl)

        transcript = CCJSONLIngester().ingest(jsonl_file)

        # Should find the Read tool use
        tool_names = [t.tool_name for t in transcript.tool_calls]
        assert "Read" in tool_names

    @pytest.mark.unit
    def test_parse_token_counts(self, sample_cc_jsonl, temp_dir):
        """Should accumulate token counts."""
        jsonl_file = temp_dir / "session.jsonl"
        jsonl_file.write_text(sample_cc_jsonl)

        transcript = CCJSONLIngester().ingest(jsonl_file)

        assert transcript.token_counts["input"] == 100
        assert transcript.token_counts["output"] == 50

    @pytest.mark.unit
    def test_timestamps_parsed(self, sample_cc_jsonl, temp_dir):
        """Should parse ISO timestamps."""
        jsonl_file = temp_dir / "session.jsonl"
        jsonl_file.write_text(sample_cc_jsonl)

        transcript = CCJSONLIngester().ingest(jsonl_file)

        assert transcript.start_time is not None
        assert transcript.end_time is not None
        assert transcript.end_time >= transcript.start_time

    @pytest.mark.unit
    def test_convenience_function(self, sample_cc_jsonl, temp_dir):
        """Test parse_cc_transcript convenience function."""
        jsonl_file = temp_dir / "session.jsonl"
        jsonl_file.write_text(sample_cc_jsonl)

        transcript = parse_cc_transcript(jsonl_file)
        assert len(transcript.messages) >= 2

    @pytest.mark.unit
    def test_handles_malformed_lines(self, temp_dir):
        """Should skip malformed JSON lines gracefully."""
        content = '{"type": "message", "role": "user", "content": "Hello"}\n'
        content += "not valid json\n"
        content += '{"type": "message", "role": "assistant", "content": "Hi"}\n'

        jsonl_file = temp_dir / "mixed.jsonl"
        jsonl_file.write_text(content)

        transcript = CCJSONLIngester().ingest(jsonl_file)
        # Should have 2 messages (skipped the bad line)
        assert len(transcript.messages) == 2


class TestAGTelemetryIngester:
    """Tests for AG telemetry parsing (BC-04, BC-05)."""

    @pytest.mark.unit
    def test_parse_valid_telemetry(self, sample_ag_telemetry, temp_dir):
        """Should parse valid AG telemetry.log."""
        telemetry_file = temp_dir / "telemetry.log"
        telemetry_file.write_text(sample_ag_telemetry)

        ingester = AGTelemetryIngester()
        session = ingester.ingest(telemetry_file)

        assert len(session.events) == 3
        assert session.source_file == str(telemetry_file)

    @pytest.mark.unit
    def test_extract_tool_calls(self, sample_ag_telemetry, temp_dir):
        """Should extract tool calls from telemetry."""
        telemetry_file = temp_dir / "telemetry.log"
        telemetry_file.write_text(sample_ag_telemetry)

        session = AGTelemetryIngester().ingest(telemetry_file)

        assert len(session.tool_calls) >= 1
        tool_names = [t.tool_name for t in session.tool_calls]
        assert "read_file" in tool_names

    @pytest.mark.unit
    def test_extract_thought_metadata(self, temp_dir):
        """BC-05: Should extract thoughtsTokenCount for success criteria."""
        # Create telemetry with thought metadata
        entries = [
            {
                "type": "api_response",
                "timestamp": 1705700000000,
                "thoughtsTokenCount": 500,
                "outputTokenCount": 100
            }
        ]
        content = "\n".join(json.dumps(e) for e in entries)

        telemetry_file = temp_dir / "telemetry.log"
        telemetry_file.write_text(content)

        session = AGTelemetryIngester().ingest(telemetry_file)

        assert len(session.thought_metadata) == 1
        assert session.thought_metadata[0].thoughts_token_count == 500

    @pytest.mark.unit
    def test_has_thought_evidence(self, temp_dir):
        """BC-05: has_thought_evidence should detect thought data."""
        entries = [
            {"type": "api_response", "timestamp": 1705700000000, "thoughtsTokenCount": 500}
        ]
        content = "\n".join(json.dumps(e) for e in entries)

        telemetry_file = temp_dir / "telemetry.log"
        telemetry_file.write_text(content)

        ingester = AGTelemetryIngester()
        session = ingester.ingest(telemetry_file)

        assert ingester.has_thought_evidence(session) is True

    @pytest.mark.unit
    def test_no_thought_evidence(self, temp_dir):
        """BC-05: Should report false when no thought evidence."""
        entries = [
            {"type": "api_request", "timestamp": 1705700000000}
        ]
        content = "\n".join(json.dumps(e) for e in entries)

        telemetry_file = temp_dir / "telemetry.log"
        telemetry_file.write_text(content)

        ingester = AGTelemetryIngester()
        session = ingester.ingest(telemetry_file)

        assert ingester.has_thought_evidence(session) is False

    @pytest.mark.unit
    def test_accumulates_token_counts(self, sample_ag_telemetry, temp_dir):
        """Should accumulate token counts across entries."""
        telemetry_file = temp_dir / "telemetry.log"
        telemetry_file.write_text(sample_ag_telemetry)

        session = AGTelemetryIngester().ingest(telemetry_file)

        # From sample: inputTokenCount: 100, outputTokenCount: 50, thoughtsTokenCount: 150
        assert session.token_counts["input"] == 100
        assert session.token_counts["output"] == 50
        assert session.token_counts["thoughts"] == 150

    @pytest.mark.unit
    def test_convenience_function(self, sample_ag_telemetry, temp_dir):
        """Test parse_ag_telemetry convenience function."""
        telemetry_file = temp_dir / "telemetry.log"
        telemetry_file.write_text(sample_ag_telemetry)

        session = parse_ag_telemetry(telemetry_file)
        assert len(session.events) == 3

    @pytest.mark.unit
    def test_handles_missing_file(self, temp_dir):
        """Should return empty session for missing file."""
        ingester = AGTelemetryIngester()
        session = ingester.ingest(temp_dir / "nonexistent.log")

        assert len(session.events) == 0
        assert len(session.tool_calls) == 0

    @pytest.mark.unit
    def test_repo_local_default_path(self, temp_dir):
        """BC-04: Default path should be repo-local .gemini/telemetry.log."""
        ingester = AGTelemetryIngester(repo_root=temp_dir)
        expected_path = temp_dir / ".gemini" / "telemetry.log"
        assert ingester.get_telemetry_path() == expected_path

    @pytest.mark.unit
    def test_parses_millisecond_timestamps(self, temp_dir):
        """Should handle millisecond timestamps (Unix epoch * 1000)."""
        # 1705700000000 ms = 1705700000 seconds (Jan 20, 2024)
        entries = [
            {"type": "event", "timestamp": 1705700000000}
        ]
        content = "\n".join(json.dumps(e) for e in entries)

        telemetry_file = temp_dir / "telemetry.log"
        telemetry_file.write_text(content)

        session = AGTelemetryIngester().ingest(telemetry_file)

        assert session.start_time is not None
        assert session.start_time.year >= 2024


class TestIngesterImports:
    """Test that all ingestors are properly exported."""

    @pytest.mark.unit
    def test_all_exports_available(self):
        """All expected classes should be importable."""
        from core.ingestion import (
            CastIngester,
            CastRecording,
            CCJSONLIngester,
            CCTranscript,
            AGTelemetryIngester,
            AGSession,
        )
        assert CastIngester is not None
        assert CastRecording is not None
        assert CCJSONLIngester is not None
        assert CCTranscript is not None
        assert AGTelemetryIngester is not None
        assert AGSession is not None

    @pytest.mark.unit
    def test_convenience_functions_available(self):
        """Convenience functions should be importable."""
        from core.ingestion import (
            parse_cast_file,
            parse_cc_transcript,
            parse_ag_telemetry,
        )
        assert callable(parse_cast_file)
        assert callable(parse_cc_transcript)
        assert callable(parse_ag_telemetry)
