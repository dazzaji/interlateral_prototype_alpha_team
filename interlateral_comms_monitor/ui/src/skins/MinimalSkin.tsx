// MinimalSkin.tsx - A clean, minimal skin with maximum whitespace
// Monochrome only. Single-column. No icons, badges, or decorations.
//
// ## Change Log
// v1.1 (2026-01-26) - Revisions from AG + Codex reviews
//   - Fixed: Added useMemo for message filtering (Thanks @AG)
//   - Fixed: Timestamp guard for invalid dates (Thanks @AG, @Codex)
//   - Fixed: Added 'human' to agent attribution (Thanks @AG)
//   - Hardened: Broadened filter to include more event types (Thanks @AG, @Codex)
//   - Hardened: Fallback key if event.id is missing (Thanks @Codex)
//   - Hardened: Coerce content to string (Thanks @Codex)
// v1.0 (2026-01-26) - Initial draft

import { useMemo } from 'react';
import type { SkinProps, SkinMeta } from './types';

// Metadata for skin registration (required for auto-discovery)
export const meta: SkinMeta = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Clean monochrome view with maximum whitespace',
};

// Derive agent name from event source/type
function getAgentName(event: { source: string; type: string }): string {
  if (event.type === 'cc_message' || event.source === 'cc') return 'CC';
  if (event.type === 'ag_message' || event.source === 'ag') return 'AG';
  if (event.type === 'codex_message' || event.source === 'codex') return 'Codex';
  if (event.source === 'human' || event.type === 'human_message') return 'Human';
  if (event.source === 'comms') return 'System';
  return 'Unknown';
}

// Format timestamp to HH:MM:SS with guard for invalid dates
function formatTime(timestamp: string | undefined | null): string {
  if (!timestamp) return '--:--:--';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Coerce content to string safely
function safeContent(content: unknown): string {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object') {
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return '[Object]';
    }
  }
  return String(content);
}

// Event types to display (broadened to include more message types)
const DISPLAY_TYPES = [
  'message',
  'cc_message',
  'ag_message',
  'codex_message',
  'human_message',
  'system_message',
];

function MinimalSkin({ events, containerRef }: SkinProps) {
  // Memoize filtered messages to prevent re-filtering on every render
  const messages = useMemo(
    () => events.filter((e) => DISPLAY_TYPES.includes(e.type)),
    [events]
  );

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        overflow: 'auto',
        padding: '48px 24px',
        background: '#ffffff',
        color: '#000000',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: '#999999',
              padding: '64px 0',
              fontSize: '14px',
            }}
          >
            No messages yet
          </div>
        )}

        {messages.map((event, index) => (
          <div
            key={event.id || `${event.timestamp}-${index}`}
            style={{
              marginBottom: '32px',
              lineHeight: '1.6',
            }}
          >
            {/* Timestamp and Agent */}
            <div
              style={{
                fontSize: '12px',
                color: '#666666',
                marginBottom: '8px',
                letterSpacing: '0.02em',
              }}
            >
              {formatTime(event.timestamp)} — {getAgentName(event)}
            </div>

            {/* Message content */}
            <div
              style={{
                fontSize: '15px',
                color: '#1a1a1a',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {safeContent(event.content)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MinimalSkin;
