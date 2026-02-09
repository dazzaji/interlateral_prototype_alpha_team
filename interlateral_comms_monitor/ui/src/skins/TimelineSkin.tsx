import type { SkinProps, SkinMeta } from './types';
import type { StreamEvent } from '../hooks/useStreams';

// Skin metadata for auto-discovery
export const meta: SkinMeta = {
  id: 'timeline',
  name: 'Timeline View',
  description: 'Chronologically interleaved event stream from all sources',
  icon: '📜',
};

// Color mapping for event sources/types
function getEventColor(event: StreamEvent): string {
  if (event.type === 'cc_message') return '#7c3aed';
  if (event.type === 'ag_message') return '#059669';
  if (event.source === 'ag_log') return '#059669';
  if (event.type === 'separator') return '#333';
  return '#0891b2';
}

// Label for event source
function getEventLabel(event: StreamEvent): string {
  if (event.type === 'cc_message') return 'CC';
  if (event.type === 'ag_message') return 'AG';
  if (event.source === 'ag_log') return 'AG Log';
  if (event.source === 'comms') return 'Comms';
  return event.source.toUpperCase();
}

// Main Timeline Skin component
function TimelineSkin({ events, containerRef }: SkinProps) {
  // Sort events by timestamp (should already be sorted, but ensure)
  const sortedEvents = [...events].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div
      ref={containerRef}
      style={{
        height: 'calc(100vh - 80px)',
        overflow: 'auto',
        padding: '16px',
        background: '#0f0f1a'
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {sortedEvents.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: '#666',
            padding: '40px',
            fontStyle: 'italic'
          }}>
            Waiting for events...
          </div>
        ) : (
          sortedEvents.slice(-100).map((event, index) => {
            const color = getEventColor(event);
            const label = getEventLabel(event);

            if (event.type === 'separator') {
              return (
                <div key={event.id} style={{
                  borderBottom: '1px solid #333',
                  margin: '16px 0'
                }} />
              );
            }

            return (
              <div key={event.id} style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '12px',
                animation: index === sortedEvents.length - 1 ? 'fadeIn 0.3s ease' : undefined
              }}>
                {/* Timestamp */}
                <div style={{
                  width: '70px',
                  flexShrink: 0,
                  fontSize: '11px',
                  color: '#666',
                  paddingTop: '4px',
                  fontFamily: 'monospace'
                }}>
                  {new Date(event.timestamp).toLocaleTimeString()}
                </div>

                {/* Source badge */}
                <div style={{
                  width: '60px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'flex-start'
                }}>
                  <span style={{
                    background: color,
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}>
                    {label}
                  </span>
                </div>

                {/* Content */}
                <div style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: '#1a1a2e',
                  borderRadius: '6px',
                  borderLeft: `3px solid ${color}`,
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {event.content}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default TimelineSkin;
