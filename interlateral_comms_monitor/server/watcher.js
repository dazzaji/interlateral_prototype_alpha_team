import chokidar from 'chokidar';
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseContent, StreamSources, getOptionalStreamPaths, parseCCJsonlLine, parseAGTelemetryLine, parseCodexTelemetryLine } from './parsers/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to project root
const PROJECT_ROOT = join(__dirname, '..', '..');

// Path to interlateral_dna (sibling directory)
const DNA_PATH = join(PROJECT_ROOT, 'interlateral_dna');

// Core files to watch (always present)
const CORE_FILES = {
  comms: join(DNA_PATH, 'comms.md'),
  ag_log: join(DNA_PATH, 'ag_log.md'),
};

// Optional files (may or may not exist)
let OPTIONAL_FILES = {};

// Track file positions for incremental reads
const filePositions = new Map();

// Track which optional streams are available
const streamStatus = new Map();

// Stateful Parsing: Track last known timestamp for each file
const lastTimestamps = new Map();

// Parse a line from comms.md or ag_log.md into a StreamEvent
function parseCommsLine(line, source, lastTimestamp) {
  let timestamp = lastTimestamp || new Date().toISOString();

  // Try multiple timestamp patterns to handle different formats
  // Pattern 1: [2026-01-22 02:00:43] at start (ag_log.md format)
  // Pattern 2: [CC] @AG [2026-01-21 T01:15:00] (comms.md format)
  // Pattern 3: [AG] @CC [2026-01-22 01:30:00] (comms.md variant)
  const patterns = [
    /\[(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\]/, // Space between date and time
    /\[(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})\]/,   // T between date and time
    /\[(\d{4}-\d{2}-\d{2})\s*T?\s*(\d{2}:\d{2}:\d{2})?\]/, // Original flexible pattern
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match && match[1]) {
      timestamp = `${match[1]}T${match[2] || '00:00:00'}Z`;
      break;
    }
  }

  // Determine message type
  let type = 'message';
  if (line.includes('[CC]')) type = 'cc_message';
  else if (line.includes('[AG]')) type = 'ag_message';
  else if (line.startsWith('---')) type = 'separator';
  else if (line.startsWith('#')) type = 'heading';

  const event = {
    id: `${source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: timestamp, // Use extracted or inherited timestamp
    source,
    type,
    content: line,
  };

  return { event, newTimestamp: timestamp };
}

// Parse content based on source type
function parseLineForSource(line, source, lastTimestamp) {
  if (source === StreamSources.CC_JSONL) {
    const events = parseCCJsonlLine(line);
    return { events, newTimestamp: lastTimestamp }; // JSONL has its own timestamps, don't update state
  } else if (source === StreamSources.AG_TELEMETRY) {
    const events = parseAGTelemetryLine(line);
    return { events, newTimestamp: lastTimestamp }; // Telemetry has its own timestamps
  } else {
    // comms.md or ag_log.md (Stateful)
    const { event, newTimestamp } = parseCommsLine(line, source, lastTimestamp);
    return { events: [event], newTimestamp };
  }
}

// Read new content from a file since last position
async function readNewContent(filePath, source) {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const stats = await stat(filePath);
    const lastPosition = filePositions.get(filePath) || 0;

    if (stats.size <= lastPosition) {
      return [];
    }

    const content = await readFile(filePath, 'utf-8');
    const newContent = content.slice(lastPosition);
    filePositions.set(filePath, stats.size);

    // Parse lines into events based on source type
    const lines = newContent.split('\n').filter(line => line.trim());
    const events = [];

    // Get last known timestamp for this file
    let currentTimestamp = lastTimestamps.get(filePath);

    for (const line of lines) {
      const { events: parsedEvents, newTimestamp } = parseLineForSource(line, source, currentTimestamp);
      events.push(...parsedEvents);
      currentTimestamp = newTimestamp;
    }

    // Update state
    if (currentTimestamp) {
      lastTimestamps.set(filePath, currentTimestamp);
    }

    return events;
  } catch (error) {
    console.error(`[Watcher] Error reading ${filePath}:`, error.message);
    return [];
  }
}

// Initialize file positions (start from end of file for existing content)
async function initializePositions(files) {
  for (const [source, filePath] of Object.entries(files)) {
    if (existsSync(filePath)) {
      try {
        const stats = await stat(filePath);
        filePositions.set(filePath, stats.size);
        streamStatus.set(source, true);
        console.log(`[Watcher] Initialized ${source} at position ${stats.size}`);
      } catch (error) {
        console.error(`[Watcher] Error initializing ${filePath}:`, error.message);
        filePositions.set(filePath, 0);
        streamStatus.set(source, false);
      }
    } else {
      console.log(`[Watcher] File not found (will watch for creation): ${filePath}`);
      filePositions.set(filePath, 0);
      streamStatus.set(source, false);
    }
  }
}

// Discover optional streams
async function discoverOptionalStreams() {
  console.log('[Watcher] Discovering optional streams...');

  try {
    const optionalStreams = await getOptionalStreamPaths(PROJECT_ROOT);

    for (const stream of optionalStreams) {
      if (stream.exists && stream.path) {
        OPTIONAL_FILES[stream.source] = stream.path;
        console.log(`[Watcher] Found optional stream: ${stream.source} at ${stream.path}`);
      } else {
        console.log(`[Watcher] Optional stream not available: ${stream.source}`);
      }
    }
  } catch (error) {
    console.error('[Watcher] Error discovering optional streams:', error.message);
  }
}

// Start watching files
export async function startWatcher(onEvent) {
  console.log('[Watcher] Starting file watchers...');
  console.log(`[Watcher] DNA path: ${DNA_PATH}`);
  console.log(`[Watcher] Project root: ${PROJECT_ROOT}`);

  // Discover optional streams
  await discoverOptionalStreams();

  // Combine core and optional files
  const allFiles = { ...CORE_FILES, ...OPTIONAL_FILES };

  // Initialize positions
  await initializePositions(allFiles);

  // Create watcher for all files
  const filePaths = Object.values(allFiles).filter(p => p);

  const watcher = chokidar.watch(filePaths, {
    persistent: true,
    ignoreInitial: true,
    usePolling: false, // Try native first (faster updates)
    // Removed awaitWriteFinish for faster updates on append-only logs
  });

  watcher.on('change', async (filePath) => {
    const source = Object.entries(allFiles).find(([, path]) => path === filePath)?.[0] || 'unknown';
    console.log(`[Watcher] Change detected in ${source}`);

    const events = await readNewContent(filePath, source);
    events.forEach(event => onEvent(event));
  });

  watcher.on('add', async (filePath) => {
    const source = Object.entries(allFiles).find(([, path]) => path === filePath)?.[0] || 'unknown';
    console.log(`[Watcher] File added: ${source}`);
    filePositions.set(filePath, 0);
    streamStatus.set(source, true);
  });

  watcher.on('unlink', (filePath) => {
    const source = Object.entries(allFiles).find(([, path]) => path === filePath)?.[0] || 'unknown';
    console.log(`[Watcher] File removed: ${source}`);
    streamStatus.set(source, false);
  });

  watcher.on('error', (error) => {
    console.error('[Watcher] Error:', error);
  });

  console.log('[Watcher] Watching for changes...');
  console.log(`[Watcher] Active streams: ${Array.from(streamStatus.entries()).filter(([, v]) => v).map(([k]) => k).join(', ')}`);

  return watcher;
}

// Get initial content from files (for client sync)
export async function getInitialContent() {
  const events = [];
  const allFiles = { ...CORE_FILES, ...OPTIONAL_FILES };

  for (const [source, filePath] of Object.entries(allFiles)) {
    if (existsSync(filePath)) {
      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        // Only get last 100 lines for initial load
        const recentLines = lines.slice(-100);

        // STATEFUL PARSING: Carry timestamp state between lines during initial load
        let currentTimestamp = null;
        for (const line of recentLines) {
          const { events: parsedEvents, newTimestamp } = parseLineForSource(line, source, currentTimestamp);
          events.push(...parsedEvents);
          currentTimestamp = newTimestamp; // Inherit timestamp for subsequent lines
        }
      } catch (error) {
        console.error(`[Watcher] Error reading initial content from ${filePath}:`, error.message);
      }
    }
  }

  // Sort by timestamp
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return events;
}

// Get stream status (for UI display)
export function getStreamStatus() {
  return Object.fromEntries(streamStatus);
}

// Get all watched file paths
export function getWatchedFiles() {
  return { ...CORE_FILES, ...OPTIONAL_FILES };
}
