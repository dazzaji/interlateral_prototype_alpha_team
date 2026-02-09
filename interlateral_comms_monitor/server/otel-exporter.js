// OTEL Trace Exporter for Interlateral Comms Monitor
// Phase B - OTEL Eval Pipeline v1.2
// Converts dashboard events to OpenTelemetry-compatible JSON traces

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Generate OTEL-compliant hex trace ID (32 chars)
function generateTraceId(seed) {
  return crypto.createHash('md5').update(seed || Date.now().toString()).digest('hex');
}

// Generate OTEL-compliant hex span ID (16 chars)
function generateSpanId(traceId, idx) {
  return crypto.createHash('md5').update(`${traceId}-${idx}`).digest('hex').slice(0, 16);
}

// Safe timestamp conversion with NaN guard
function safeTimestampNano(timestamp) {
  if (!timestamp) return Date.now() * 1000000;
  const ms = new Date(timestamp).getTime();
  if (isNaN(ms)) return Date.now() * 1000000;
  return ms * 1000000;
}

// Extract token counts from event if present
function extractTokens(event) {
  const tokens = [];
  if (event.metadata?.prompt_tokens) {
    tokens.push({ key: 'prompt_tokens', value: { intValue: event.metadata.prompt_tokens } });
  }
  if (event.metadata?.completion_tokens) {
    tokens.push({ key: 'completion_tokens', value: { intValue: event.metadata.completion_tokens } });
  }
  if (event.metadata?.total_tokens) {
    tokens.push({ key: 'total_tokens', value: { intValue: event.metadata.total_tokens } });
  }
  return tokens;
}

// Extract agent from content prefix
function extractAgent(content) {
  if (!content) return 'unknown';
  if (content.startsWith('[CC]')) return 'CC';
  if (content.startsWith('[AG]')) return 'AG';
  if (content.startsWith('[Codex]')) return 'Codex';
  if (content.startsWith('[Antigravity]')) return 'AG';
  return 'unknown';
}

/**
 * Convert dashboard events to OTEL trace format
 * @param {Array} events - Array of dashboard events
 * @param {Object} metadata - Trace metadata (skillName, sessionId, traceId)
 * @returns {Object} OTEL-compatible trace object
 */
export function eventsToOtelTrace(events, metadata = {}) {
  const traceId = generateTraceId(metadata.traceId || metadata.sessionId);

  const spans = events.map((event, idx) => {
    const baseAttrs = [
      { key: 'source', value: { stringValue: event.source || 'unknown' } },
      { key: 'agent', value: { stringValue: extractAgent(event.content) } },
      { key: 'content', value: { stringValue: event.content || '' } },
      { key: 'event_id', value: { stringValue: event.id || '' } }
    ];

    // Add token attributes if present
    const tokenAttrs = extractTokens(event);

    return {
      traceId,
      spanId: generateSpanId(traceId, idx),
      name: event.type || 'unknown',
      startTimeUnixNano: safeTimestampNano(event.timestamp),
      endTimeUnixNano: safeTimestampNano(event.timestamp),
      attributes: [...baseAttrs, ...tokenAttrs]
    };
  });

  // Calculate total tokens for the trace
  const totalTokens = events.reduce((sum, e) => sum + (e.metadata?.total_tokens || 0), 0);

  return {
    resourceSpans: [{
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'interlateral' } },
          { key: 'skill.name', value: { stringValue: metadata.skillName || 'unknown' } },
          { key: 'session.id', value: { stringValue: metadata.sessionId || traceId } },
          { key: 'total_tokens', value: { intValue: totalTokens } }
        ]
      },
      scopeSpans: [{
        scope: { name: 'interlateral.comms_monitor' },
        spans
      }]
    }]
  };
}

/**
 * Export events to OTEL trace file
 * @param {Array} events - Array of dashboard events
 * @param {string} outputPath - Path to write trace file
 * @param {Object} metadata - Trace metadata
 * @returns {string} Path to written file
 */
export function exportTraceToFile(events, outputPath, metadata = {}) {
  const trace = eventsToOtelTrace(events, metadata);

  // Ensure output directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(trace, null, 2));
  return outputPath;
}

/**
 * Load events from JSONL file
 * @param {string} filePath - Path to events.jsonl file
 * @returns {Array} Array of parsed events
 */
export function loadEventsFromJsonl(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Events file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.warn(`Failed to parse line: ${line.slice(0, 50)}...`);
        return null;
      }
    })
    .filter(e => e !== null);
}

/**
 * Filter events by time range
 * @param {Array} events - Array of events
 * @param {Date|string} startTime - Start of time range
 * @param {Date|string} endTime - End of time range
 * @returns {Array} Filtered events
 */
export function filterEventsByTimeRange(events, startTime, endTime) {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();

  return events.filter(e => {
    const eventTime = new Date(e.timestamp).getTime();
    return !isNaN(eventTime) && eventTime >= start && eventTime <= end;
  });
}
