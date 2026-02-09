import { useState } from 'react';
import type { SkinProps, SkinMeta } from './types';
import type { StreamEvent } from '../hooks/useStreams';
import ResizablePanes from '../components/ResizablePanes';

// Skin metadata for auto-discovery
export const meta: SkinMeta = {
  id: 'cockpit',
  name: 'Cockpit View',
  description: 'Split-screen view with CC (left), AG (right), and Comms (bottom)',
  icon: '🛫',
};

// Helper to filter events
function getSourceEvents(events: StreamEvent[], source: string): StreamEvent[] {
  if (source === 'cc') {
    return events.filter(e => e.type === 'cc_message' || e.source === 'cc');
  }
  if (source === 'ag') {
    return events.filter(e => e.type === 'ag_message' || e.source === 'ag' || e.source === 'ag_log');
  }
  return events;
}

// Event list component
interface EventListProps {
  events: StreamEvent[];
  title: string;
  color: string;
  containerRef?: React.RefObject<HTMLDivElement>;
  badge?: number;
  onCollapse?: () => void;
  isCollapsible?: boolean;
}

function EventList({ events, title, color, containerRef, badge, onCollapse, isCollapsible }: EventListProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '8px 12px',
        background: color,
        fontWeight: 'bold',
        fontSize: '14px',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>
          {title} ({events.length})
          {badge && badge > 0 && (
            <span style={{
              marginLeft: '8px',
              background: '#f87171',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '11px',
            }}>
              +{badge}
            </span>
          )}
        </span>
        {isCollapsible && (
          <button
            onClick={onCollapse}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '4px',
              padding: '2px 8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Collapse panel"
          >
            Hide
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px',
          fontSize: '13px',
          fontFamily: 'monospace',
          lineHeight: '1.5'
        }}
      >
        {events.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic' }}>No events yet...</div>
        ) : (
          events.slice(-50).map(event => (
            <div key={event.id} style={{
              padding: '4px 8px',
              marginBottom: '4px',
              background: '#1e1e2e',
              borderRadius: '4px',
              borderLeft: `3px solid ${color}`,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              <div style={{ color: '#888', fontSize: '11px', marginBottom: '2px' }}>
                {new Date(event.timestamp).toLocaleTimeString()}
              </div>
              {event.content}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Collapsed panel bar
interface CollapsedBarProps {
  title: string;
  color: string;
  eventCount: number;
  onExpand: () => void;
}

function CollapsedBar({ title, color, eventCount, onExpand }: CollapsedBarProps) {
  return (
    <div
      style={{
        padding: '8px 16px',
        background: color,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
      }}
      onClick={onExpand}
    >
      <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
        {title} ({eventCount})
      </span>
      <button
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          borderRadius: '4px',
          padding: '4px 12px',
          color: 'white',
          cursor: 'pointer',
          fontSize: '12px',
        }}
      >
        Show
      </button>
    </div>
  );
}

// Main Cockpit Skin component
function CockpitSkin({ events, containerRef }: SkinProps) {
  const [isCommsCollapsed, setIsCommsCollapsed] = useState(false);

  const ccEvents = getSourceEvents(events, 'cc');
  const agEvents = getSourceEvents(events, 'ag');
  const commsEvents = events.filter(e => e.source === 'comms');

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 80px)',
        overflow: 'hidden',
      }}
    >
      {/* Main content with resizable panes */}
      <div style={{ flex: isCommsCollapsed ? 1 : 2, minHeight: '300px' }}>
        <ResizablePanes direction="horizontal" initialRatio={0.5}>
          <EventList events={ccEvents} title="Claude Code" color="#7c3aed" />
          <EventList events={agEvents} title="Antigravity" color="#059669" />
        </ResizablePanes>
      </div>

      {/* Comms panel - collapsible */}
      {isCommsCollapsed ? (
        <CollapsedBar
          title="Comms Log"
          color="#0891b2"
          eventCount={commsEvents.length}
          onExpand={() => setIsCommsCollapsed(false)}
        />
      ) : (
        <div style={{ flex: 1, minHeight: '150px', borderTop: '1px solid #333' }}>
          <ResizablePanes direction="vertical" initialRatio={0.6}>
            <div style={{ height: '100%' }} />
            <EventList
              events={commsEvents}
              title="Comms Log"
              color="#0891b2"
              isCollapsible
              onCollapse={() => setIsCommsCollapsed(true)}
            />
          </ResizablePanes>
        </div>
      )}
    </div>
  );
}

export default CockpitSkin;
