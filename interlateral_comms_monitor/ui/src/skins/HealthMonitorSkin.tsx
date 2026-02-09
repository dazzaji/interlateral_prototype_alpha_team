import { useMemo } from 'react';
import type { SkinProps, SkinMeta } from './types';
import type { StreamEvent } from '../hooks/useStreams';

/**
 * HealthMonitorSkin - Real-time status cards for CC, AG, and Codex agents
 *
 * ## Change Log (v1.1)
 * - **Fixed:** Agent attribution uses prefix match ^[CC] instead of includes (Thanks @Codex)
 * - **Fixed:** Session Start uses sortedEvents[0] for correct ordering (Thanks @Codex)
 * - **Hardened:** Added safeParseDate() and safeTimeDisplay() with NaN guards (Thanks @Codex)
 * - **Hardened:** Precomputed per-agent lists in single useMemo for performance (Thanks @Codex)
 *
 * @version 1.1
 * @date 2026-01-23
 * @drafter CC
 * @reviewer AG (APPROVE - 100% conformance)
 * @breaker Codex (4 failure scenarios fixed)
 */

// Skin metadata for auto-discovery
export const meta: SkinMeta = {
  id: 'health-monitor',
  name: 'Health Monitor',
  description: 'Real-time status cards for CC, AG, and Codex agents',
  icon: '💚',
};

interface AgentConfig {
  id: string;
  name: string;
  color: string;
  // Prioritize source/type over content matching to avoid double-counting
  filter: (e: StreamEvent) => boolean;
}

// FIX #1: Prioritize source/type, use prefix match (^\\[XX\\]) as fallback only
const AGENTS: AgentConfig[] = [
  {
    id: 'cc',
    name: 'Claude Code',
    color: '#7c3aed',
    filter: (e) => {
      // Priority 1: source/type match
      if (e.type === 'cc_message' || e.source === 'cc') return true;
      // Priority 2: Only match if content STARTS with [CC] (avoid mid-content matches)
      if (e.source === 'comms' && /^\[CC\]/m.test(e.content || '')) return true;
      return false;
    },
  },
  {
    id: 'ag',
    name: 'Antigravity',
    color: '#059669',
    filter: (e) => {
      if (e.type === 'ag_message' || e.source === 'ag' || e.source === 'ag_log') return true;
      if (e.source === 'comms' && /^\[(AG|Antigravity)\]/m.test(e.content || '')) return true;
      return false;
    },
  },
  {
    id: 'codex',
    name: 'Codex',
    color: '#f59e0b',
    filter: (e) => {
      // Codex has no dedicated source/type yet, use prefix match
      if (e.source === 'comms' && /^\[Codex\]/mi.test(e.content || '')) return true;
      return false;
    },
  },
];

// FIX #3: Safe date parsing with validation
function safeParseDate(timestamp: string | undefined): Date | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  // Check for Invalid Date
  if (isNaN(date.getTime())) return null;
  return date;
}

// Get status color based on last activity
function getStatusColor(lastSeen: Date | null): { color: string; label: string } {
  if (!lastSeen) return { color: '#666', label: 'Unknown' };

  const now = new Date();
  const diffMs = now.getTime() - lastSeen.getTime();
  const diffMin = diffMs / 1000 / 60;

  if (diffMin < 2) return { color: '#10b981', label: 'Active' };
  if (diffMin < 10) return { color: '#f59e0b', label: 'Idle' };
  return { color: '#ef4444', label: 'Inactive' };
}

// Format time ago with validation
function formatTimeAgo(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // FIX #3: Guard against negative or invalid diffs
  if (diffMs < 0 || isNaN(diffMs)) return 'Unknown';

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${diffHour}h ago`;
}

// FIX #3: Safe time display
function safeTimeDisplay(timestamp: string | undefined): string {
  const date = safeParseDate(timestamp);
  if (!date) return 'N/A';
  return date.toLocaleTimeString();
}

// Agent card component - now receives precomputed events
function AgentCard({
  agent,
  agentEvents,
  isConnected
}: {
  agent: AgentConfig;
  agentEvents: StreamEvent[];
  isConnected: boolean;
}) {
  const messageCount = agentEvents.length;
  const lastEvent = agentEvents.length > 0 ? agentEvents[agentEvents.length - 1] : null;
  const lastSeen = safeParseDate(lastEvent?.timestamp);
  const recentMessages = agentEvents.slice(-3).reverse();
  const status = getStatusColor(lastSeen);

  return (
    <div style={{
      background: '#1a1a2e',
      borderRadius: '12px',
      padding: '20px',
      border: `2px solid ${agent.color}33`,
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      minWidth: '280px',
      flex: '1 1 300px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: isConnected ? status.color : '#666',
            boxShadow: isConnected && status.color === '#10b981'
              ? '0 0 8px #10b981'
              : 'none',
          }} />
          <span style={{
            color: agent.color,
            fontWeight: 'bold',
            fontSize: '18px',
          }}>
            {agent.name}
          </span>
        </div>
        <span style={{
          background: status.color + '22',
          color: status.color,
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 'bold',
        }}>
          {status.label}
        </span>
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex',
        gap: '20px',
      }}>
        <div>
          <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>
            Messages
          </div>
          <div style={{ color: '#e0e0e0', fontSize: '24px', fontWeight: 'bold' }}>
            {messageCount}
          </div>
        </div>
        <div>
          <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>
            Last Seen
          </div>
          <div style={{ color: '#e0e0e0', fontSize: '16px', fontWeight: '500' }}>
            {formatTimeAgo(lastSeen)}
          </div>
        </div>
      </div>

      {/* Recent Messages */}
      <div>
        <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>
          Recent Activity
        </div>
        <div style={{
          background: '#0f0f1a',
          borderRadius: '8px',
          padding: '8px',
          maxHeight: '120px',
          overflow: 'auto',
        }}>
          {recentMessages.length === 0 ? (
            <div style={{ color: '#666', fontSize: '12px', fontStyle: 'italic', padding: '8px' }}>
              No messages yet
            </div>
          ) : (
            recentMessages.map((event, idx) => (
              <div key={event.id || idx} style={{
                padding: '6px 8px',
                marginBottom: idx < recentMessages.length - 1 ? '4px' : 0,
                borderLeft: `2px solid ${agent.color}`,
                fontSize: '11px',
                lineHeight: '1.4',
              }}>
                <div style={{ color: '#666', fontSize: '10px', marginBottom: '2px' }}>
                  {safeTimeDisplay(event.timestamp)}
                </div>
                <div style={{
                  color: '#ccc',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '240px',
                }}>
                  {event.content?.substring(0, 80) || '(empty)'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Main Health Monitor Skin component
function HealthMonitorSkin({ events, isConnected, containerRef }: SkinProps) {
  // FIX #2 & #4: Precompute sorted events and per-agent lists in useMemo
  const { agentEventMap, activeCount, sessionStart } = useMemo(() => {
    // Sort events by timestamp
    const sorted = [...events].sort((a, b) => {
      const dateA = safeParseDate(a.timestamp);
      const dateB = safeParseDate(b.timestamp);
      if (!dateA || !dateB) return 0;
      return dateA.getTime() - dateB.getTime();
    });

    // Precompute per-agent event lists (FIX #4: Performance)
    const eventMap: Record<string, StreamEvent[]> = {};
    let active = 0;

    for (const agent of AGENTS) {
      const agentEvents = sorted.filter(agent.filter);
      eventMap[agent.id] = agentEvents;

      // Count active agents
      if (agentEvents.length > 0) {
        const lastEvent = agentEvents[agentEvents.length - 1];
        const lastDate = safeParseDate(lastEvent.timestamp);
        if (lastDate) {
          const diffMin = (Date.now() - lastDate.getTime()) / 1000 / 60;
          if (diffMin < 10) active++;
        }
      }
    }

    // FIX #2: Use sorted events for session start
    const start = sorted.length > 0 ? safeTimeDisplay(sorted[0].timestamp) : 'N/A';

    return {
      agentEventMap: eventMap,
      activeCount: active,
      sessionStart: start,
    };
  }, [events]);

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
      {/* Header */}
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
        }}>
          💚 Agent Health Monitor
        </h1>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: isConnected ? '#10b981' : '#ef4444',
          fontSize: '14px',
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isConnected ? '#10b981' : '#ef4444',
          }} />
          {isConnected ? 'WebSocket Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Agent Cards Grid */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
      }}>
        {AGENTS.map(agent => (
          <AgentCard
            key={agent.id}
            agent={agent}
            agentEvents={agentEventMap[agent.id] || []}
            isConnected={isConnected}
          />
        ))}
      </div>

      {/* Total Stats Footer */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        background: '#1a1a2e',
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'space-around',
        textAlign: 'center',
      }}>
        <div>
          <div style={{ color: '#888', fontSize: '12px' }}>Total Events</div>
          <div style={{ color: '#e0e0e0', fontSize: '20px', fontWeight: 'bold' }}>
            {events.length}
          </div>
        </div>
        <div>
          <div style={{ color: '#888', fontSize: '12px' }}>Active Agents</div>
          <div style={{ color: '#10b981', fontSize: '20px', fontWeight: 'bold' }}>
            {activeCount} / {AGENTS.length}
          </div>
        </div>
        <div>
          <div style={{ color: '#888', fontSize: '12px' }}>Session Start</div>
          <div style={{ color: '#e0e0e0', fontSize: '14px' }}>
            {sessionStart}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HealthMonitorSkin;
