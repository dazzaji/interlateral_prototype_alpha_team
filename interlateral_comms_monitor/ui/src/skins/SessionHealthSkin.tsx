import { useMemo, useState, useEffect } from 'react';
import type { SkinProps, SkinMeta } from './types';
import type { StreamEvent } from '../hooks/useStreams';

/**
 * SessionHealthSkin - Session-level health view showing agent connections,
 * timestamps, and message counts in a unified dashboard.
 *
 * Key features:
 * - Session uptime counter
 * - Per-agent connection status with timestamps
 * - Message count breakdown by agent
 * - Connection health indicator
 * - Messages per minute metric
 * - Visual warning for delayed activity (>60s)
 *
 * ## Change Log (v1.1)
 * - **Fixed:** Added warning color (#f59e0b) for lastSeen >60s (Thanks @AG - SUGGESTION 2)
 * - **Fixed:** Added messages-per-minute (MPM) metric card (Thanks @AG - SUGGESTION 4)
 * - **Hardened:** Tightened prefix regex to require space after bracket ^\[(CC|...)\]\s (Thanks @Codex - FAILURE 3)
 * - **Hardened:** Added hasInvalidTimestamps flag and warning badge (Thanks @Codex - FAILURE 2)
 * - **Hardened:** Added comment about immutable updates assumption for useMemo (Thanks @Codex - FAILURE 1)
 * - **Declined:** Session Reset Action (AG SUGGESTION 1) - Requires parent component changes, noted for future
 * - **Declined:** Agent Log Navigation (AG SUGGESTION 3) - UX enhancement, out of scope for health skin
 *
 * @version 1.1
 * @date 2026-01-26
 * @drafter CC
 * @reviewer AG (4 suggestions - 2 implemented, 2 noted)
 * @breaker Codex (3 failure scenarios - all addressed)
 */

// Skin metadata for auto-discovery
export const meta: SkinMeta = {
  id: 'session-health',
  name: 'Session Health',
  description: 'Session-level view of agent connections, timestamps, and message counts',
  icon: '🩺',
};

interface AgentStatus {
  id: string;
  name: string;
  color: string;
  messageCount: number;
  firstSeen: Date | null;
  lastSeen: Date | null;
  isActive: boolean;
  // FIX (AG SUGGESTION 2): Track seconds since last activity for warning color
  lastSeenSeconds: number | null;
}

// Agent configuration
// FIX (Codex FAILURE 3): Tightened regex to require space after bracket to prevent misclassification
const AGENT_CONFIG = [
  { id: 'cc', name: 'Claude Code', color: '#7c3aed', prefix: /^\[CC\]\s/m },
  { id: 'ag', name: 'Antigravity', color: '#059669', prefix: /^\[(AG|Antigravity)\]\s/m },
  { id: 'codex', name: 'Codex', color: '#f59e0b', prefix: /^\[Codex\]\s/mi },
] as const;

// Safe date parsing with validation
function safeParseDate(timestamp: string | undefined): Date | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return null;
  return date;
}

// Format timestamp for display
function formatTimestamp(date: Date | null): string {
  if (!date) return 'N/A';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Format duration since a date
function formatDuration(startDate: Date | null): string {
  if (!startDate) return '00:00:00';

  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();

  if (diffMs < 0 || isNaN(diffMs)) return '00:00:00';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Get time since last activity
function getTimeSince(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0 || isNaN(diffMs)) return 'Unknown';

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

// Determine if agent is active (activity within last 5 minutes)
function isAgentActive(lastSeen: Date | null): boolean {
  if (!lastSeen) return false;
  const diffMin = (Date.now() - lastSeen.getTime()) / 1000 / 60;
  return diffMin < 5;
}

// Filter function for agent events
function filterAgentEvents(
  events: StreamEvent[],
  config: typeof AGENT_CONFIG[number]
): StreamEvent[] {
  return events.filter((e) => {
    // Priority 1: source/type match
    if (e.type === `${config.id}_message` || e.source === config.id) return true;
    if (config.id === 'ag' && e.source === 'ag_log') return true;
    // Priority 2: prefix match in comms
    if (e.source === 'comms' && config.prefix.test(e.content || '')) return true;
    return false;
  });
}

// Connection status badge
function ConnectionBadge({ isConnected }: { isConnected: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      borderRadius: '20px',
      background: isConnected ? '#10b98122' : '#ef444422',
      border: `1px solid ${isConnected ? '#10b981' : '#ef4444'}`,
    }}>
      <div style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: isConnected ? '#10b981' : '#ef4444',
        boxShadow: isConnected ? '0 0 8px #10b981' : 'none',
        animation: isConnected ? 'pulse 2s infinite' : 'none',
      }} />
      <span style={{
        color: isConnected ? '#10b981' : '#ef4444',
        fontWeight: 'bold',
        fontSize: '14px',
      }}>
        {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
      </span>
    </div>
  );
}

// Agent row in the status table
function AgentRow({ status }: { status: AgentStatus }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '140px 100px 120px 120px 100px',
      gap: '16px',
      padding: '12px 16px',
      background: status.isActive ? '#1a2e1a' : '#1a1a2e',
      borderRadius: '8px',
      borderLeft: `4px solid ${status.color}`,
      alignItems: 'center',
    }}>
      {/* Agent Name */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: status.isActive ? '#10b981' : '#666',
          boxShadow: status.isActive ? '0 0 6px #10b981' : 'none',
        }} />
        <span style={{
          color: status.color,
          fontWeight: 'bold',
          fontSize: '14px',
        }}>
          {status.name}
        </span>
      </div>

      {/* Status */}
      <span style={{
        color: status.isActive ? '#10b981' : '#888',
        fontSize: '12px',
        fontWeight: status.isActive ? 'bold' : 'normal',
      }}>
        {status.isActive ? 'ACTIVE' : 'IDLE'}
      </span>

      {/* First Seen */}
      <span style={{ color: '#aaa', fontSize: '12px', fontFamily: 'monospace' }}>
        {formatTimestamp(status.firstSeen)}
      </span>

      {/* Last Seen - FIX (AG SUGGESTION 2): Warning color for >60s */}
      <span style={{
        color: status.lastSeenSeconds !== null && status.lastSeenSeconds > 60 ? '#f59e0b' : '#aaa',
        fontSize: '12px',
        fontFamily: 'monospace',
        fontWeight: status.lastSeenSeconds !== null && status.lastSeenSeconds > 60 ? 'bold' : 'normal',
      }}>
        {status.lastSeen ? getTimeSince(status.lastSeen) : 'Never'}
      </span>

      {/* Message Count */}
      <span style={{
        color: '#e0e0e0',
        fontSize: '16px',
        fontWeight: 'bold',
        textAlign: 'right',
      }}>
        {status.messageCount}
      </span>
    </div>
  );
}

// Main Session Health Skin component
function SessionHealthSkin({ events, isConnected, reconnect, containerRef }: SkinProps) {
  // Uptime counter (re-renders every second)
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute session statistics
  // NOTE (Codex FAILURE 1): This useMemo depends on `events` array reference.
  // The stream hook MUST use immutable updates (replace array, not mutate).
  // If the hook mutates in-place, stats will go stale silently.
  const { agentStatuses, sessionStart, totalMessages, messagesPerMinute, hasInvalidTimestamps } = useMemo(() => {
    // Sort events by timestamp
    const sorted = [...events].sort((a, b) => {
      const dateA = safeParseDate(a.timestamp);
      const dateB = safeParseDate(b.timestamp);
      if (!dateA || !dateB) return 0;
      return dateA.getTime() - dateB.getTime();
    });

    // FIX (Codex FAILURE 2): Track invalid timestamps
    let invalidCount = 0;
    for (const e of events) {
      if (!safeParseDate(e.timestamp)) invalidCount++;
    }

    // Compute per-agent statistics
    const now = Date.now();
    const statuses: AgentStatus[] = AGENT_CONFIG.map((config) => {
      const agentEvents = filterAgentEvents(sorted, config);
      const firstEvent = agentEvents[0];
      const lastEvent = agentEvents[agentEvents.length - 1];
      const firstSeen = safeParseDate(firstEvent?.timestamp);
      const lastSeen = safeParseDate(lastEvent?.timestamp);

      // FIX (AG SUGGESTION 2): Compute seconds since last activity
      const lastSeenSeconds = lastSeen ? Math.floor((now - lastSeen.getTime()) / 1000) : null;

      return {
        id: config.id,
        name: config.name,
        color: config.color,
        messageCount: agentEvents.length,
        firstSeen,
        lastSeen,
        isActive: isAgentActive(lastSeen),
        lastSeenSeconds,
      };
    });

    // Session start is the earliest event
    const start = sorted.length > 0 ? safeParseDate(sorted[0].timestamp) : null;

    // FIX (AG SUGGESTION 4): Compute messages per minute
    let mpm = 0;
    if (start && events.length > 0) {
      const durationMin = (now - start.getTime()) / 1000 / 60;
      if (durationMin > 0) {
        mpm = Math.round((events.length / durationMin) * 10) / 10;
      }
    }

    return {
      agentStatuses: statuses,
      sessionStart: start,
      totalMessages: events.length,
      messagesPerMinute: mpm,
      hasInvalidTimestamps: invalidCount > 0,
    };
  }, [events]);

  const activeAgentCount = agentStatuses.filter(s => s.isActive).length;

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        overflow: 'auto',
        padding: '24px',
        background: '#0f0f1a',
      }}
    >
      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Header Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
      }}>
        <h1 style={{
          color: '#e0e0e0',
          fontSize: '24px',
          fontWeight: 'bold',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span>🩺</span> Session Health
        </h1>
        <ConnectionBadge isConnected={isConnected} />
      </div>

      {/* Session Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        {/* Uptime Card */}
        <div style={{
          background: '#1a1a2e',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center',
        }}>
          <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>
            SESSION UPTIME
          </div>
          <div style={{
            color: '#10b981',
            fontSize: '28px',
            fontWeight: 'bold',
            fontFamily: 'monospace',
          }}>
            {formatDuration(sessionStart)}
          </div>
        </div>

        {/* Session Start Card */}
        <div style={{
          background: '#1a1a2e',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center',
        }}>
          <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>
            SESSION START
          </div>
          <div style={{
            color: '#e0e0e0',
            fontSize: '18px',
            fontWeight: 'bold',
            fontFamily: 'monospace',
          }}>
            {formatTimestamp(sessionStart)}
          </div>
        </div>

        {/* Active Agents Card */}
        <div style={{
          background: '#1a1a2e',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center',
        }}>
          <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>
            ACTIVE AGENTS
          </div>
          <div style={{
            color: activeAgentCount > 0 ? '#10b981' : '#ef4444',
            fontSize: '28px',
            fontWeight: 'bold',
          }}>
            {activeAgentCount} / {AGENT_CONFIG.length}
          </div>
        </div>

        {/* Total Messages Card */}
        <div style={{
          background: '#1a1a2e',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center',
        }}>
          <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>
            TOTAL MESSAGES
          </div>
          <div style={{
            color: '#7c3aed',
            fontSize: '28px',
            fontWeight: 'bold',
          }}>
            {totalMessages}
          </div>
        </div>

        {/* FIX (AG SUGGESTION 4): Messages Per Minute Card */}
        <div style={{
          background: '#1a1a2e',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center',
        }}>
          <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>
            MSGS/MIN
          </div>
          <div style={{
            color: messagesPerMinute > 0 ? '#10b981' : '#888',
            fontSize: '28px',
            fontWeight: 'bold',
          }}>
            {messagesPerMinute}
          </div>
        </div>
      </div>

      {/* FIX (Codex FAILURE 2): Invalid timestamps warning */}
      {hasInvalidTimestamps && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 16px',
          background: '#f59e0b22',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <span style={{ color: '#f59e0b', fontSize: '13px' }}>
            Some events have invalid or missing timestamps. Stats may be inaccurate.
          </span>
        </div>
      )}

      {/* Agent Status Table */}
      <div style={{
        background: '#1a1a2e',
        borderRadius: '12px',
        padding: '20px',
      }}>
        <h2 style={{
          color: '#e0e0e0',
          fontSize: '16px',
          fontWeight: 'bold',
          margin: '0 0 16px 0',
        }}>
          Agent Connection Status
        </h2>

        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '140px 100px 120px 120px 100px',
          gap: '16px',
          padding: '8px 16px',
          borderBottom: '1px solid #333',
          marginBottom: '12px',
        }}>
          <span style={{ color: '#888', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Agent</span>
          <span style={{ color: '#888', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Status</span>
          <span style={{ color: '#888', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>First Seen</span>
          <span style={{ color: '#888', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Last Activity</span>
          <span style={{ color: '#888', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'right' }}>Messages</span>
        </div>

        {/* Agent Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {agentStatuses.map((status) => (
            <AgentRow key={status.id} status={status} />
          ))}
        </div>
      </div>

      {/* Reconnect Button (shown when disconnected) */}
      {!isConnected && (
        <div style={{
          marginTop: '24px',
          textAlign: 'center',
        }}>
          <button
            onClick={reconnect}
            style={{
              padding: '12px 24px',
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Reconnect to Server
          </button>
        </div>
      )}
    </div>
  );
}

export default SessionHealthSkin;
