/**
 * AG Telemetry Parser
 * Parses Antigravity telemetry.log into StreamEvents
 *
 * AG telemetry format (when available):
 * - JSON lines with action, timestamp, metadata
 * - Or plain text log entries
 *
 * Gracefully handles missing telemetry file.
 */

// Parse a single telemetry line into StreamEvent(s)
export function parseAGTelemetryLine(line, lineNumber = 0) {
  if (!line.trim()) return [];

  try {
    // Try JSON format first
    const data = JSON.parse(line);

    return [{
      id: `ag-telemetry-${lineNumber}-${Date.now()}`,
      timestamp: data.timestamp || new Date().toISOString(),
      source: 'ag_telemetry',
      type: data.type || data.action || 'telemetry',
      content: data.message || data.content || JSON.stringify(data),
      metadata: {
        action: data.action,
        ...data.metadata,
      },
    }];
  } catch {
    // Plain text format - parse as simple log entry
    // Format might be: [TIMESTAMP] ACTION: message
    const timestampMatch = line.match(/^\[([^\]]+)\]/);
    const timestamp = timestampMatch
      ? new Date(timestampMatch[1]).toISOString()
      : new Date().toISOString();

    const content = timestampMatch
      ? line.slice(timestampMatch[0].length).trim()
      : line;

    // Try to detect action type from content
    let type = 'log';
    if (content.toLowerCase().includes('error')) type = 'error';
    else if (content.toLowerCase().includes('warning')) type = 'warning';
    else if (content.toLowerCase().includes('thinking')) type = 'thinking';
    else if (content.toLowerCase().includes('tool')) type = 'tool_use';

    return [{
      id: `ag-telemetry-${lineNumber}-${Date.now()}`,
      timestamp,
      source: 'ag_telemetry',
      type,
      content,
      metadata: {},
    }];
  }
}

// Parse multiple telemetry lines
export function parseAGTelemetry(content) {
  const lines = content.split('\n');
  const events = [];

  for (let i = 0; i < lines.length; i++) {
    const lineEvents = parseAGTelemetryLine(lines[i], i);
    events.push(...lineEvents);
  }

  return events;
}

// Get the AG telemetry path for a project
export function getAGTelemetryPath(projectPath) {
  // AG telemetry is typically in .gemini/telemetry.log in the repo
  return `${projectPath}/.gemini/telemetry.log`;
}

// Check if telemetry file exists
export async function telemetryExists(path) {
  const { access } = await import('fs/promises');
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
