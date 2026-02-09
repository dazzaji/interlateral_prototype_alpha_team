/**
 * CC JSONL Parser
 * Parses Claude Code transcript files (.jsonl) into StreamEvents
 *
 * CC JSONL format:
 * - type: "user" - User messages
 * - type: "assistant" - Assistant responses with content blocks
 * - type: "file-history-snapshot" - File state (ignored)
 *
 * Content block types:
 * - thinking - Claude's reasoning
 * - text - Text output
 * - tool_use - Tool invocation
 * - tool_result - Tool response
 */

// Parse a single JSONL line into StreamEvent(s)
export function parseCCJsonlLine(line, lineNumber = 0) {
  if (!line.trim()) return [];

  try {
    const data = JSON.parse(line);
    const events = [];

    // Skip file-history-snapshot entries
    if (data.type === 'file-history-snapshot') {
      return [];
    }

    const baseEvent = {
      timestamp: data.timestamp || new Date().toISOString(),
      source: 'cc',
      sessionId: data.sessionId,
      uuid: data.uuid,
    };

    if (data.type === 'user') {
      // User message
      const content = typeof data.message?.content === 'string'
        ? data.message.content
        : JSON.stringify(data.message?.content);

      events.push({
        ...baseEvent,
        id: `cc-user-${data.uuid || lineNumber}`,
        type: 'user_message',
        content: content,
        metadata: {
          cwd: data.cwd,
          gitBranch: data.gitBranch,
        },
      });
    } else if (data.type === 'assistant') {
      // Assistant message - can have multiple content blocks
      const contentBlocks = data.message?.content || [];

      for (let i = 0; i < contentBlocks.length; i++) {
        const block = contentBlocks[i];
        const blockId = `cc-assistant-${data.uuid || lineNumber}-${i}`;

        if (block.type === 'thinking') {
          events.push({
            ...baseEvent,
            id: blockId,
            type: 'thinking',
            content: block.thinking,
            metadata: {
              model: data.message?.model,
            },
          });
        } else if (block.type === 'text') {
          events.push({
            ...baseEvent,
            id: blockId,
            type: 'text',
            content: block.text,
            metadata: {
              model: data.message?.model,
            },
          });
        } else if (block.type === 'tool_use') {
          events.push({
            ...baseEvent,
            id: blockId,
            type: 'tool_use',
            content: `Tool: ${block.name}\nInput: ${JSON.stringify(block.input, null, 2)}`,
            metadata: {
              toolName: block.name,
              toolId: block.id,
              input: block.input,
            },
          });
        } else if (block.type === 'tool_result') {
          const resultContent = typeof block.content === 'string'
            ? block.content
            : JSON.stringify(block.content);

          events.push({
            ...baseEvent,
            id: blockId,
            type: 'tool_result',
            content: `Result for ${block.tool_use_id}:\n${resultContent.slice(0, 500)}${resultContent.length > 500 ? '...' : ''}`,
            metadata: {
              toolUseId: block.tool_use_id,
              isError: block.is_error,
            },
          });
        }
      }
    }

    return events;
  } catch (error) {
    // Gracefully handle parse errors
    console.warn(`[CC Parser] Failed to parse line ${lineNumber}:`, error.message);
    return [];
  }
}

// Parse multiple JSONL lines
export function parseCCJsonl(content) {
  const lines = content.split('\n');
  const events = [];

  for (let i = 0; i < lines.length; i++) {
    const lineEvents = parseCCJsonlLine(lines[i], i);
    events.push(...lineEvents);
  }

  return events;
}

// Get the CC transcript path for a project
export function getCCTranscriptPath(projectPath) {
  // Convert project path to Claude's directory format
  // Claude converts both / and _ to - in directory names
  // NOTE: Claude KEEPS the leading hyphen (from the leading /)
  const sanitized = projectPath
    .replace(/\//g, '-')
    .replace(/_/g, '-');  // Claude also converts underscores to hyphens
  // DO NOT remove leading hyphen - Claude keeps it
  const claudeProjectsDir = `${process.env.HOME}/.claude/projects/${sanitized}`;

  return claudeProjectsDir;
}

// Find the most recent session transcript
export async function findLatestSession(projectDir) {
  const { readdir, stat } = await import('fs/promises');
  const { join } = await import('path');

  try {
    const files = await readdir(projectDir);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    if (jsonlFiles.length === 0) return null;

    // Find most recently modified
    let latest = null;
    let latestTime = 0;

    for (const file of jsonlFiles) {
      const filePath = join(projectDir, file);
      const stats = await stat(filePath);
      if (stats.mtimeMs > latestTime) {
        latestTime = stats.mtimeMs;
        latest = filePath;
      }
    }

    return latest;
  } catch (error) {
    console.error('[CC Parser] Error finding session:', error.message);
    return null;
  }
}
