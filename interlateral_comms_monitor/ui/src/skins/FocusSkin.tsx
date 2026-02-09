import { useState, useEffect } from 'react';
import type { SkinProps, SkinMeta } from './types';
import type { StreamEvent } from '../hooks/useStreams';

// Skin metadata for auto-discovery
export const meta: SkinMeta = {
  id: 'focus',
  name: 'Focus View',
  description: 'Tabbed interface with CC, AG, and Comms tabs',
  icon: '🎯',
};

type TabId = 'cc' | 'ag' | 'comms' | 'all';

interface Tab {
  id: TabId;
  label: string;
  color: string;
}

const TABS: Tab[] = [
  { id: 'all', label: 'All', color: '#6366f1' },
  { id: 'cc', label: 'Claude Code', color: '#7c3aed' },
  { id: 'ag', label: 'Antigravity', color: '#059669' },
  { id: 'comms', label: 'Comms', color: '#0891b2' },
];

// Filter events by tab
function filterEventsByTab(events: StreamEvent[], tab: TabId): StreamEvent[] {
  if (tab === 'all') return events;
  if (tab === 'cc') return events.filter(e => e.type === 'cc_message' || e.source === 'cc');
  if (tab === 'ag') return events.filter(e => e.type === 'ag_message' || e.source === 'ag' || e.source === 'ag_log');
  if (tab === 'comms') return events.filter(e => e.source === 'comms');
  return events;
}

// Get event count for a tab
function getTabCount(events: StreamEvent[], tab: TabId): number {
  return filterEventsByTab(events, tab).length;
}

// Main Focus Skin component
function FocusSkin({ events, containerRef }: SkinProps) {
  const [activeTab, setActiveTab] = useState<TabId>('all');

  // Track last seen event count for each tab (for unread badges)
  const [lastSeenCounts, setLastSeenCounts] = useState<Record<TabId, number>>({
    all: 0,
    cc: 0,
    ag: 0,
    comms: 0,
  });

  // Update last seen count when switching tabs
  const handleTabChange = (tabId: TabId) => {
    // Mark current tab as fully seen
    setLastSeenCounts(prev => ({
      ...prev,
      [activeTab]: getTabCount(events, activeTab),
    }));
    setActiveTab(tabId);
  };

  // Mark active tab as seen when events change
  useEffect(() => {
    setLastSeenCounts(prev => ({
      ...prev,
      [activeTab]: getTabCount(events, activeTab),
    }));
  }, [activeTab, events.length]);

  // Calculate unread count for a tab
  const getUnreadCount = (tabId: TabId): number => {
    if (tabId === activeTab) return 0;
    const currentCount = getTabCount(events, tabId);
    const lastSeen = lastSeenCounts[tabId] || 0;
    return Math.max(0, currentCount - lastSeen);
  };

  const filteredEvents = filterEventsByTab(events, activeTab);
  const activeTabData = TABS.find(t => t.id === activeTab) || TABS[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '12px',
        background: '#0f0f1a',
        borderBottom: '1px solid #333'
      }}>
        {TABS.map(tab => {
          const count = getTabCount(events, tab.id);
          const unreadCount = getUnreadCount(tab.id);
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: isActive ? tab.color : '#1a1a2e',
                color: isActive ? 'white' : '#888',
                fontWeight: isActive ? 'bold' : 'normal',
                fontSize: '14px',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
            >
              {tab.label}
              <span style={{
                background: isActive ? 'rgba(255,255,255,0.2)' : '#333',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '12px'
              }}>
                {count}
              </span>

              {/* Unread badge */}
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#f87171',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  minWidth: '18px',
                  textAlign: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  animation: 'pulse 2s infinite',
                }}>
                  +{unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Event list */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          background: '#0f0f1a'
        }}
      >
        {filteredEvents.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: '#666',
            padding: '40px',
            fontStyle: 'italic'
          }}>
            No events in this tab...
          </div>
        ) : (
          filteredEvents.slice(-100).map(event => (
            <div key={event.id} style={{
              padding: '12px',
              marginBottom: '8px',
              background: '#1a1a2e',
              borderRadius: '6px',
              borderLeft: `3px solid ${activeTabData.color}`,
              fontFamily: 'monospace',
              fontSize: '13px',
              lineHeight: '1.5'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                fontSize: '11px',
                color: '#666'
              }}>
                <span style={{
                  background: activeTabData.color,
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 'bold'
                }}>
                  {event.type.replace('_', ' ').toUpperCase()}
                </span>
                <span>{new Date(event.timestamp).toLocaleString()}</span>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {event.content}
              </div>
            </div>
          ))
        )}
      </div>

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}

export default FocusSkin;
