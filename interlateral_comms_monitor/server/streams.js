// Unified data model for stream events
// This normalizes events from different sources into a consistent format
// v1.2: Added event persistence layer for OTEL eval pipeline

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @typedef {Object} StreamEvent
 * @property {string} id - Unique event identifier
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {'comms' | 'ag_log' | 'cc' | 'ag'} source - Event source
 * @property {'message' | 'cc_message' | 'ag_message' | 'separator' | 'heading' | 'thinking' | 'tool_use' | 'tool_result'} type - Event type
 * @property {string} content - Event content
 * @property {Object} [metadata] - Optional metadata
 */

// In-memory event buffer (last N events)
const MAX_BUFFER_SIZE = 1000;
const eventBuffer = [];

// ============================================================
// EVENT PERSISTENCE LAYER (Phase A - OTEL Eval Pipeline)
// ============================================================

// Event persistence directories
const eventLogDir = path.join(__dirname, '../../.observability');
const eventLogsDir = path.join(eventLogDir, 'logs');
const eventLogPath = path.join(eventLogDir, 'events.jsonl');

// Ensure directories exist
if (!fs.existsSync(eventLogDir)) {
  fs.mkdirSync(eventLogDir, { recursive: true });
}
if (!fs.existsSync(eventLogsDir)) {
  fs.mkdirSync(eventLogsDir, { recursive: true });
}

// Create write stream (append mode)
let eventLog = null;
try {
  eventLog = fs.createWriteStream(eventLogPath, { flags: 'a' });
  eventLog.on('error', (err) => {
    console.error('[PERSISTENCE ERROR] Write stream error:', err.message);
  });
} catch (err) {
  console.error('[PERSISTENCE ERROR] Failed to create event log stream:', err.message);
}

// Safe JSON stringify that handles circular refs and non-serializable values
function safeStringify(obj) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    // Handle undefined, functions, symbols
    if (value === undefined) return null;
    if (typeof value === 'function') return '[Function]';
    if (typeof value === 'symbol') return value.toString();
    return value;
  });
}

// Add event to buffer AND persist to disk
export function addEvent(event) {
  eventBuffer.push(event);

  // Trim buffer if too large
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.shift();
  }

  // Persist to disk with error handling
  if (eventLog) {
    try {
      const persistedEvent = {
        ...event,
        _persisted_at: new Date().toISOString()
      };
      eventLog.write(safeStringify(persistedEvent) + '\n');
    } catch (err) {
      console.error('[PERSISTENCE ERROR]', err.message);
      // Don't throw - event still in memory buffer
    }
  }

  return event;
}

// Flush event log on exit to prevent data loss
process.on('beforeExit', () => {
  if (eventLog) {
    eventLog.end();
  }
});

// Rotation-safe stream reopen (call after log rotation)
export function reopenLogStream() {
  if (eventLog) {
    eventLog.end();
  }
  try {
    eventLog = fs.createWriteStream(eventLogPath, { flags: 'a' });
    eventLog.on('error', (err) => {
      console.error('[PERSISTENCE ERROR] Write stream error:', err.message);
    });
  } catch (err) {
    console.error('[PERSISTENCE ERROR] Failed to reopen event log stream:', err.message);
  }
}

// ============================================================
// END EVENT PERSISTENCE LAYER
// ============================================================

// Get recent events
export function getRecentEvents(count = 100) {
  return eventBuffer.slice(-count);
}

// Get all events (for export)
export function getAllEvents() {
  return [...eventBuffer];
}

// Clear buffer (for testing)
export function clearBuffer() {
  eventBuffer.length = 0;
}

// Normalize an event to ensure consistent format
export function normalizeEvent(event) {
  return {
    id: event.id || `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: event.timestamp || new Date().toISOString(),
    source: event.source || 'unknown',
    type: event.type || 'message',
    content: event.content || '',
    metadata: event.metadata || {},
  };
}
