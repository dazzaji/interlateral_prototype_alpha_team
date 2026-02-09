/**
 * Stream Parsers Index
 * Provides unified interface to all parsers with graceful fallback
 */

import { parseCCJsonlLine, parseCCJsonl, getCCTranscriptPath, findLatestSession } from './ccJsonl.js';
import { parseAGTelemetryLine, parseAGTelemetry, getAGTelemetryPath, telemetryExists } from './agTelemetry.js';

// Stream source types
export const StreamSources = {
  COMMS: 'comms',
  AG_LOG: 'ag_log',
  CC_JSONL: 'cc_jsonl',
  AG_TELEMETRY: 'ag_telemetry',
  CODEX_TELEMETRY: 'codex_telemetry',
};

// Parse content based on source type
export function parseContent(content, source) {
  try {
    switch (source) {
      case StreamSources.CC_JSONL:
        return parseCCJsonl(content);
      case StreamSources.AG_TELEMETRY:
        return parseAGTelemetry(content);
      case StreamSources.CODEX_TELEMETRY:
        return parseCodexTelemetry(content);
      default:
        // Default: treat as plain text (comms.md, ag_log.md)
        return parseAsPlainText(content, source);
    }
  } catch (error) {
    console.error(`[Parsers] Error parsing ${source}:`, error.message);
    // Graceful fallback: return empty array on parse failure
    return [];
  }
}

// Parse Codex telemetry line (similar to AG telemetry - terminal capture)
export function parseCodexTelemetryLine(line) {
  // Skip empty lines
  if (!line.trim()) return [];

  // Create event from telemetry line
  const event = {
    id: `codex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    source: StreamSources.CODEX_TELEMETRY,
    type: 'codex_output',
    content: line,
    metadata: {},
  };

  return [event];
}

// Parse full Codex telemetry content
function parseCodexTelemetry(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const events = [];

  for (const line of lines) {
    events.push(...parseCodexTelemetryLine(line));
  }

  return events;
}

// Get Codex telemetry path
export function getCodexTelemetryPath(projectPath) {
  return `${projectPath}/interlateral_dna/codex_telemetry.log`;
}

// Parse plain text content (comms.md, ag_log.md)
function parseAsPlainText(content, source) {
  const lines = content.split('\n').filter(line => line.trim());
  const events = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    events.push({
      id: `${source}-${i}-${Date.now()}`,
      timestamp: extractTimestamp(line) || new Date().toISOString(),
      source,
      type: detectMessageType(line),
      content: line,
      metadata: {},
    });
  }

  return events;
}

// Extract timestamp from line if present
function extractTimestamp(line) {
  // Format: [2026-01-21 T08:00:00] or [2026-01-21T08:00:00]
  const match = line.match(/\[(\d{4}-\d{2}-\d{2})\s*T?(\d{2}:\d{2}:\d{2})?\]/);
  if (match) {
    const date = match[1];
    const time = match[2] || '00:00:00';
    return `${date}T${time}Z`;
  }
  return null;
}

// Detect message type from content
function detectMessageType(line) {
  if (line.includes('[CC]')) return 'cc_message';
  if (line.includes('[AG]')) return 'ag_message';
  if (line.startsWith('---')) return 'separator';
  if (line.startsWith('#')) return 'heading';
  if (line.startsWith('**') && line.endsWith('**')) return 'emphasis';
  return 'message';
}

// Get all optional stream paths for a project
export async function getOptionalStreamPaths(projectPath) {
  const streams = [];

  // CC JSONL transcript
  const ccProjectDir = getCCTranscriptPath(projectPath);
  const ccTranscript = await findLatestSession(ccProjectDir);
  if (ccTranscript) {
    streams.push({
      source: StreamSources.CC_JSONL,
      path: ccTranscript,
      exists: true,
    });
  } else {
    streams.push({
      source: StreamSources.CC_JSONL,
      path: null,
      exists: false,
    });
  }

  // AG Telemetry
  const agTelemetryPath = getAGTelemetryPath(projectPath);
  const agExists = await telemetryExists(agTelemetryPath);
  streams.push({
    source: StreamSources.AG_TELEMETRY,
    path: agTelemetryPath,
    exists: agExists,
  });

  // Codex Telemetry (Tri-Agent Mesh support)
  const codexTelemetryPath = getCodexTelemetryPath(projectPath);
  const codexExists = await telemetryExists(codexTelemetryPath);
  streams.push({
    source: StreamSources.CODEX_TELEMETRY,
    path: codexTelemetryPath,
    exists: codexExists,
  });

  return streams;
}

// Export individual parsers for direct use
export {
  parseCCJsonlLine,
  parseCCJsonl,
  parseAGTelemetryLine,
  parseAGTelemetry,
  // parseCodexTelemetryLine already exported above
};
