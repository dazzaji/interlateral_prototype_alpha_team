# core/ingestion/cc_jsonl_ingester.py
"""
Claude Code JSONL Transcript Ingester for CC + AG Observability

Parses Claude Code's native JSONL transcript files from ~/.claude/projects/.

BC-06: Uses locator file + discovery fallback for finding the correct project.

Format:
  Each line is a JSON object representing a conversation turn or event.
  Common fields: type, role, content, timestamp, tool_use, etc.
"""

import json
import os
from pathlib import Path
from typing import List, Dict, Any, Union, Optional, Generator
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ToolUse:
    """Represents a tool call in a CC transcript."""
    tool_name: str
    tool_id: str
    input: Dict[str, Any]
    output: Optional[str] = None
    timestamp: Optional[datetime] = None


@dataclass
class Message:
    """Represents a message in a CC transcript."""
    role: str  # "user", "assistant", "system"
    content: str
    timestamp: Optional[datetime] = None
    tool_uses: List[ToolUse] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CCTranscript:
    """Represents a complete Claude Code session transcript."""
    session_id: str
    messages: List[Message]
    tool_calls: List[ToolUse]
    token_counts: Dict[str, int]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    source_file: Optional[str]
    metadata: Dict[str, Any]


class CCJSONLIngester:
    """
    Ingests Claude Code JSONL transcript files.

    BC-06: Supports locator file and discovery fallback.

    Usage:
        ingester = CCJSONLIngester()

        # With locator file
        transcript = ingester.ingest_from_locator(".observability/cc_locator.json")

        # Or directly
        transcript = ingester.ingest("~/.claude/projects/xxx/session.jsonl")
    """

    CC_PROJECTS_DIR = Path.home() / ".claude" / "projects"

    def __init__(self, locator_path: Optional[Union[str, Path]] = None):
        """
        Initialize the ingester.

        Args:
            locator_path: Optional path to .observability/cc_locator.json
        """
        self.locator_path = Path(locator_path) if locator_path else None
        self._discovered_path: Optional[Path] = None

    def get_project_path(self) -> Optional[Path]:
        """
        Get the CC project path using locator or discovery.

        BC-06: Locator + discovery fallback.
        """
        # Try locator file first
        if self.locator_path and self.locator_path.exists():
            try:
                with open(self.locator_path) as f:
                    locator = json.load(f)
                    path_str = locator.get("cc_project_path", "")
                    if path_str:
                        path = Path(os.path.expanduser(path_str))
                        if path.exists():
                            return path
            except (json.JSONDecodeError, KeyError):
                pass

        # Discovery fallback: find most recently modified project
        if self._discovered_path:
            return self._discovered_path

        self._discovered_path = self._discover_project()
        return self._discovered_path

    def _discover_project(self) -> Optional[Path]:
        """
        Discover the most recently modified CC project directory.

        Warning: This may select the wrong project on machines with multiple active projects.
        """
        if not self.CC_PROJECTS_DIR.exists():
            return None

        # Find all project directories
        projects = [d for d in self.CC_PROJECTS_DIR.iterdir() if d.is_dir()]
        if not projects:
            return None

        # Find the one with most recent JSONL modification
        def get_latest_jsonl_time(project_dir: Path) -> float:
            jsonl_files = list(project_dir.glob("*.jsonl"))
            if not jsonl_files:
                return 0
            return max(f.stat().st_mtime for f in jsonl_files)

        projects_with_times = [(p, get_latest_jsonl_time(p)) for p in projects]
        projects_with_times = [(p, t) for p, t in projects_with_times if t > 0]

        if not projects_with_times:
            return None

        # Return most recently modified
        return max(projects_with_times, key=lambda x: x[1])[0]

    def list_sessions(self, project_path: Optional[Path] = None) -> List[Path]:
        """List all JSONL session files in the project."""
        path = project_path or self.get_project_path()
        if not path or not path.exists():
            return []

        return sorted(path.glob("*.jsonl"), key=lambda f: f.stat().st_mtime, reverse=True)

    def ingest(self, source: Union[str, Path]) -> CCTranscript:
        """
        Parse a JSONL transcript file.

        Args:
            source: Path to the JSONL file

        Returns:
            CCTranscript with parsed messages and tool calls
        """
        source_path = Path(os.path.expanduser(str(source)))

        messages: List[Message] = []
        tool_calls: List[ToolUse] = []
        token_counts: Dict[str, int] = {"input": 0, "output": 0}
        start_time: Optional[datetime] = None
        end_time: Optional[datetime] = None
        metadata: Dict[str, Any] = {}

        with open(source_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, start=1):
                line = line.strip()
                if not line:
                    continue

                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue

                # Parse based on entry type
                entry_type = entry.get("type", "")
                timestamp = self._parse_timestamp(entry.get("timestamp"))

                if timestamp:
                    if start_time is None or timestamp < start_time:
                        start_time = timestamp
                    if end_time is None or timestamp > end_time:
                        end_time = timestamp

                # Handle different entry types
                if entry_type == "message" or "role" in entry:
                    msg = self._parse_message(entry, timestamp)
                    if msg:
                        messages.append(msg)
                        # Extract tool uses from message
                        tool_calls.extend(msg.tool_uses)

                elif entry_type == "tool_use" or "tool_name" in entry:
                    tool = self._parse_tool_use(entry, timestamp)
                    if tool:
                        tool_calls.append(tool)

                elif entry_type == "token_usage" or "usage" in entry:
                    usage = entry.get("usage", entry)
                    token_counts["input"] += usage.get("input_tokens", 0)
                    token_counts["output"] += usage.get("output_tokens", 0)

        # Extract session ID from filename
        session_id = source_path.stem

        return CCTranscript(
            session_id=session_id,
            messages=messages,
            tool_calls=tool_calls,
            token_counts=token_counts,
            start_time=start_time,
            end_time=end_time,
            source_file=str(source_path),
            metadata=metadata
        )

    def _parse_timestamp(self, ts: Any) -> Optional[datetime]:
        """Parse various timestamp formats."""
        if ts is None:
            return None
        if isinstance(ts, datetime):
            return ts
        if isinstance(ts, (int, float)):
            try:
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

    def _parse_message(self, entry: Dict, timestamp: Optional[datetime]) -> Optional[Message]:
        """Parse a message entry."""
        role = entry.get("role", "")
        content = entry.get("content", "")

        # Handle content that's a list (Claude's content blocks)
        if isinstance(content, list):
            text_parts = []
            tool_uses = []
            for block in content:
                if isinstance(block, dict):
                    if block.get("type") == "text":
                        text_parts.append(block.get("text", ""))
                    elif block.get("type") == "tool_use":
                        tool = self._parse_tool_use(block, timestamp)
                        if tool:
                            tool_uses.append(tool)
                elif isinstance(block, str):
                    text_parts.append(block)
            content = "\n".join(text_parts)
        else:
            tool_uses = []

        if not role:
            return None

        return Message(
            role=role,
            content=str(content),
            timestamp=timestamp,
            tool_uses=tool_uses,
            metadata={k: v for k, v in entry.items() if k not in {"role", "content", "timestamp"}}
        )

    def _parse_tool_use(self, entry: Dict, timestamp: Optional[datetime]) -> Optional[ToolUse]:
        """Parse a tool use entry."""
        tool_name = entry.get("tool_name", entry.get("name", ""))
        tool_id = entry.get("tool_id", entry.get("id", ""))
        tool_input = entry.get("input", entry.get("arguments", {}))

        if not tool_name:
            return None

        return ToolUse(
            tool_name=tool_name,
            tool_id=tool_id,
            input=tool_input if isinstance(tool_input, dict) else {},
            output=entry.get("output"),
            timestamp=timestamp
        )

    def ingest_from_locator(self, locator_path: Union[str, Path]) -> Optional[CCTranscript]:
        """
        Ingest the most recent session using a locator file.

        BC-06: Primary method for template repo usage.
        """
        self.locator_path = Path(locator_path)
        project_path = self.get_project_path()
        if not project_path:
            return None

        sessions = self.list_sessions(project_path)
        if not sessions:
            return None

        # Return most recent session
        return self.ingest(sessions[0])


# Convenience function
def parse_cc_transcript(path: Union[str, Path]) -> CCTranscript:
    """Quick helper to parse a CC JSONL transcript."""
    return CCJSONLIngester().ingest(path)
