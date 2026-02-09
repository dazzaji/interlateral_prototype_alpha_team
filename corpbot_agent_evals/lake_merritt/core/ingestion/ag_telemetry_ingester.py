# core/ingestion/ag_telemetry_ingester.py
"""
Antigravity (Gemini CLI) Telemetry Log Ingester for CC + AG Observability

Parses AG's telemetry.log file from repo-local .gemini/ directory.

BC-04: Expects repo-local telemetry at .gemini/telemetry.log
BC-05: Extracts token evidence (thoughtsTokenCount) for success criteria.

Format:
  JSONL with events like API calls, tool uses, and thought metadata.
"""

import json
import os
from pathlib import Path
from typing import List, Dict, Any, Union, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class AGEvent:
    """Represents a single event from AG telemetry."""
    event_type: str
    timestamp: Optional[datetime]
    data: Dict[str, Any]


@dataclass
class AGToolCall:
    """Represents a tool call from AG."""
    tool_name: str
    arguments: Dict[str, Any]
    result: Optional[str]
    timestamp: Optional[datetime]
    duration_ms: Optional[float]


@dataclass
class AGThoughtMetadata:
    """
    Represents thought/reasoning metadata from AG.

    BC-05: This captures token evidence for thought verification.
    """
    thoughts_token_count: int
    thought_signature: Optional[str]
    timestamp: Optional[datetime]


@dataclass
class AGSession:
    """Represents an AG session extracted from telemetry."""
    events: List[AGEvent]
    tool_calls: List[AGToolCall]
    thought_metadata: List[AGThoughtMetadata]
    token_counts: Dict[str, int]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    source_file: Optional[str]


class AGTelemetryIngester:
    """
    Ingests Antigravity telemetry log files.

    BC-04: Expects repo-local .gemini/telemetry.log
    BC-05: Extracts token evidence for thought capture verification.

    Usage:
        ingester = AGTelemetryIngester()

        # From repo-local path
        session = ingester.ingest(".gemini/telemetry.log")

        # Check thought evidence
        for thought in session.thought_metadata:
            print(f"Thoughts: {thought.thoughts_token_count} tokens")
    """

    DEFAULT_PATH = Path(".gemini/telemetry.log")

    def __init__(self, repo_root: Optional[Union[str, Path]] = None):
        """
        Initialize the ingester.

        Args:
            repo_root: Optional repo root to find .gemini/telemetry.log
        """
        self.repo_root = Path(repo_root) if repo_root else Path.cwd()

    def get_telemetry_path(self) -> Path:
        """Get the expected telemetry log path."""
        return self.repo_root / self.DEFAULT_PATH

    def ingest(self, source: Optional[Union[str, Path]] = None) -> AGSession:
        """
        Parse an AG telemetry log file.

        Args:
            source: Path to telemetry.log, or None to use default repo-local path

        Returns:
            AGSession with parsed events and metadata
        """
        if source is None:
            source_path = self.get_telemetry_path()
        else:
            source_path = Path(os.path.expanduser(str(source)))

        events: List[AGEvent] = []
        tool_calls: List[AGToolCall] = []
        thought_metadata: List[AGThoughtMetadata] = []
        token_counts: Dict[str, int] = {"input": 0, "output": 0, "thoughts": 0}
        start_time: Optional[datetime] = None
        end_time: Optional[datetime] = None

        if not source_path.exists():
            return AGSession(
                events=[],
                tool_calls=[],
                thought_metadata=[],
                token_counts=token_counts,
                start_time=None,
                end_time=None,
                source_file=str(source_path)
            )

        with open(source_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, start=1):
                line = line.strip()
                if not line:
                    continue

                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue

                timestamp = self._parse_timestamp(entry.get("timestamp"))

                if timestamp:
                    if start_time is None or timestamp < start_time:
                        start_time = timestamp
                    if end_time is None or timestamp > end_time:
                        end_time = timestamp

                # Parse based on entry type/content
                event_type = entry.get("type", entry.get("event", "unknown"))

                # Create generic event
                events.append(AGEvent(
                    event_type=event_type,
                    timestamp=timestamp,
                    data=entry
                ))

                # Extract tool calls
                if self._is_tool_call(entry):
                    tool = self._parse_tool_call(entry, timestamp)
                    if tool:
                        tool_calls.append(tool)

                # BC-05: Extract thought metadata (token evidence)
                thought = self._parse_thought_metadata(entry, timestamp)
                if thought:
                    thought_metadata.append(thought)
                    token_counts["thoughts"] += thought.thoughts_token_count

                # Extract token counts
                self._update_token_counts(entry, token_counts)

        return AGSession(
            events=events,
            tool_calls=tool_calls,
            thought_metadata=thought_metadata,
            token_counts=token_counts,
            start_time=start_time,
            end_time=end_time,
            source_file=str(source_path)
        )

    def _parse_timestamp(self, ts: Any) -> Optional[datetime]:
        """Parse various timestamp formats."""
        if ts is None:
            return None
        if isinstance(ts, datetime):
            return ts
        if isinstance(ts, (int, float)):
            try:
                # Handle milliseconds
                if ts > 1e12:
                    ts = ts / 1000
                return datetime.fromtimestamp(ts)
            except (ValueError, OSError):
                return None
        if isinstance(ts, str):
            for fmt in ["%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S"]:
                try:
                    return datetime.strptime(ts, fmt)
                except ValueError:
                    continue
        return None

    def _is_tool_call(self, entry: Dict) -> bool:
        """Check if entry represents a tool call."""
        return (
            entry.get("type") == "tool_call" or
            entry.get("event") == "tool_call" or
            "tool_name" in entry or
            "functionCall" in entry
        )

    def _parse_tool_call(self, entry: Dict, timestamp: Optional[datetime]) -> Optional[AGToolCall]:
        """Parse a tool call entry."""
        # Handle different possible formats
        tool_name = (
            entry.get("tool_name") or
            entry.get("name") or
            entry.get("functionCall", {}).get("name") or
            ""
        )

        if not tool_name:
            return None

        arguments = (
            entry.get("arguments") or
            entry.get("input") or
            entry.get("functionCall", {}).get("args") or
            {}
        )

        return AGToolCall(
            tool_name=tool_name,
            arguments=arguments if isinstance(arguments, dict) else {},
            result=entry.get("result", entry.get("output")),
            timestamp=timestamp,
            duration_ms=entry.get("duration_ms", entry.get("latency"))
        )

    def _parse_thought_metadata(self, entry: Dict, timestamp: Optional[datetime]) -> Optional[AGThoughtMetadata]:
        """
        Extract thought metadata from entry.

        BC-05: This is the primary source for thought verification.
        """
        # Check for thoughtsTokenCount (Gemini's thinking stats)
        thoughts_tokens = entry.get("thoughtsTokenCount", 0)
        thought_signature = entry.get("thoughtSignature")

        # Also check nested structures
        if not thoughts_tokens and "usage" in entry:
            usage = entry["usage"]
            thoughts_tokens = usage.get("thoughtsTokenCount", usage.get("thoughts_tokens", 0))

        if not thoughts_tokens and "response" in entry:
            resp = entry["response"]
            thoughts_tokens = resp.get("thoughtsTokenCount", 0)

        if thoughts_tokens > 0:
            return AGThoughtMetadata(
                thoughts_token_count=thoughts_tokens,
                thought_signature=thought_signature,
                timestamp=timestamp
            )

        return None

    def _update_token_counts(self, entry: Dict, counts: Dict[str, int]):
        """Update token counts from entry."""
        # Check direct fields
        for key, target in [
            ("input_tokens", "input"),
            ("output_tokens", "output"),
            ("inputTokenCount", "input"),
            ("outputTokenCount", "output"),
            ("promptTokenCount", "input"),
            ("candidatesTokenCount", "output"),
        ]:
            if key in entry:
                counts[target] += int(entry[key])

        # Check usage block
        if "usage" in entry:
            usage = entry["usage"]
            for key, target in [
                ("input_tokens", "input"),
                ("output_tokens", "output"),
                ("prompt_tokens", "input"),
                ("completion_tokens", "output"),
            ]:
                if key in usage:
                    counts[target] += int(usage[key])

    def has_thought_evidence(self, session: AGSession) -> bool:
        """
        Check if session has thought evidence.

        BC-05: Success criteria is token evidence OR readable thoughts.
        """
        return len(session.thought_metadata) > 0 or session.token_counts.get("thoughts", 0) > 0


# Convenience function
def parse_ag_telemetry(path: Optional[Union[str, Path]] = None) -> AGSession:
    """Quick helper to parse AG telemetry."""
    return AGTelemetryIngester().ingest(path)
