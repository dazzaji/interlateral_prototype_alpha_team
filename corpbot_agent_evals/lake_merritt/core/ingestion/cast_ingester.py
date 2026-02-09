# core/ingestion/cast_ingester.py
"""
Asciinema Cast File Ingester for CC + AG Observability

Parses asciicast v2 format files (.cast) into structured events.

Format (asciicast v2):
  Line 1: JSON header {"version": 2, "width": 80, "height": 24, ...}
  Line 2+: JSON events [timestamp, "o", "output_text"]

BC-03: This ingester expects v2 format (forced by logged-claude.sh/logged-ag.sh).
"""

import json
from pathlib import Path
from typing import List, Dict, Any, Union, IO, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class CastFrame:
    """Represents a single frame from an asciicast recording."""
    timestamp: float  # Seconds since recording start
    event_type: str   # "o" for output, "i" for input
    data: str         # The text content


@dataclass
class CastRecording:
    """Represents a complete asciicast recording."""
    version: int
    width: int
    height: int
    timestamp: Optional[datetime]
    duration: Optional[float]
    title: Optional[str]
    env: Dict[str, str]
    frames: List[CastFrame]
    source_file: Optional[str]


class CastIngester:
    """
    Ingests asciicast v2 (.cast) files for observability.

    Usage:
        ingester = CastIngester()
        recording = ingester.ingest("session.cast")

        # Access frames
        for frame in recording.frames:
            print(f"[{frame.timestamp:.2f}s] {frame.data}")
    """

    SUPPORTED_VERSIONS = {2}  # BC-03: We force v2

    def ingest(self, source: Union[str, Path, IO]) -> CastRecording:
        """
        Parse an asciicast file into a CastRecording.

        Args:
            source: File path, Path object, or file-like object

        Returns:
            CastRecording with header info and all frames
        """
        source_path = None

        # Handle different input types
        if isinstance(source, (str, Path)):
            source_path = str(source)
            with open(source, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        elif hasattr(source, 'read'):
            lines = source.read().splitlines()
            if hasattr(source, 'name'):
                source_path = source.name
        else:
            raise ValueError(f"Unsupported source type: {type(source)}")

        if not lines:
            raise ValueError("Empty cast file")

        # Parse header (first line)
        try:
            header = json.loads(lines[0])
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid cast header: {e}")

        version = header.get("version", 1)
        if version not in self.SUPPORTED_VERSIONS:
            raise ValueError(f"Unsupported asciicast version: {version}. Expected: {self.SUPPORTED_VERSIONS}")

        # Parse timestamp if present
        timestamp = None
        if "timestamp" in header:
            try:
                timestamp = datetime.fromtimestamp(header["timestamp"])
            except (TypeError, ValueError):
                pass

        # Parse frames (remaining lines)
        frames: List[CastFrame] = []
        max_timestamp = 0.0

        for i, line in enumerate(lines[1:], start=2):
            line = line.strip()
            if not line:
                continue

            try:
                event = json.loads(line)
                if isinstance(event, list) and len(event) >= 3:
                    ts, event_type, data = event[0], event[1], event[2]
                    frames.append(CastFrame(
                        timestamp=float(ts),
                        event_type=str(event_type),
                        data=str(data)
                    ))
                    max_timestamp = max(max_timestamp, float(ts))
            except (json.JSONDecodeError, TypeError, ValueError) as e:
                # Gracefully skip malformed lines
                continue

        return CastRecording(
            version=version,
            width=header.get("width", 80),
            height=header.get("height", 24),
            timestamp=timestamp,
            duration=max_timestamp if max_timestamp > 0 else None,
            title=header.get("title"),
            env=header.get("env", {}),
            frames=frames,
            source_file=source_path
        )

    def extract_text(self, recording: CastRecording) -> str:
        """
        Extract all output text from a recording (concatenated).

        Useful for searching/analyzing what was displayed.
        """
        return ''.join(
            frame.data for frame in recording.frames
            if frame.event_type == "o"
        )

    def find_patterns(self, recording: CastRecording, patterns: List[str]) -> Dict[str, List[float]]:
        """
        Find timestamps where patterns appear in the output.

        Useful for locating cognitive states like "Channelling...", "Thinking...".

        Args:
            recording: The cast recording to search
            patterns: List of text patterns to find

        Returns:
            Dict mapping pattern -> list of timestamps where found
        """
        results = {p: [] for p in patterns}

        for frame in recording.frames:
            if frame.event_type != "o":
                continue
            for pattern in patterns:
                if pattern in frame.data:
                    results[pattern].append(frame.timestamp)

        return results


# Convenience function for quick parsing
def parse_cast_file(path: Union[str, Path]) -> CastRecording:
    """Quick helper to parse a cast file."""
    return CastIngester().ingest(path)
