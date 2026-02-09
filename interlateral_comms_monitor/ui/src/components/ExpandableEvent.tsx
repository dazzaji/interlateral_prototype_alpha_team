import { useState } from 'react';
import type { StreamEvent } from '../hooks/useStreams';

interface ExpandableEventProps {
  event: StreamEvent;
  color: string;
  defaultExpanded?: boolean;
}

function ExpandableEvent({ event, color, defaultExpanded = false }: ExpandableEventProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Determine if content is long enough to warrant expansion
  const isLongContent = event.content.length > 200 || event.content.includes('\n');
  const shouldShowExpandButton = isLongContent;

  // Truncate content for collapsed view
  const displayContent = !isExpanded && isLongContent
    ? event.content.slice(0, 150) + '...'
    : event.content;

  // Get event type badge color
  const getTypeBadgeColor = () => {
    switch (event.type) {
      case 'thinking':
        return '#8b5cf6';
      case 'tool_use':
        return '#f59e0b';
      case 'tool_result':
        return '#10b981';
      case 'cc_message':
        return '#7c3aed';
      case 'ag_message':
        return '#059669';
      default:
        return '#6b7280';
    }
  };

  return (
    <div
      style={{
        padding: isExpanded ? '8px 12px' : '4px 8px',
        marginBottom: '4px',
        background: isExpanded ? '#252540' : '#1e1e2e',
        borderRadius: '4px',
        borderLeft: `3px solid ${color}`,
        cursor: shouldShowExpandButton ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
      }}
      onClick={() => shouldShowExpandButton && setIsExpanded(!isExpanded)}
    >
      {/* Header row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: isExpanded ? '8px' : '2px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Type badge */}
          <span style={{
            background: getTypeBadgeColor(),
            color: 'white',
            padding: '1px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}>
            {event.type.replace('_', ' ')}
          </span>
          {/* Timestamp */}
          <span style={{ color: '#888', fontSize: '11px' }}>
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
        </div>

        {/* Expand/collapse indicator */}
        {shouldShowExpandButton && (
          <span style={{
            color: '#666',
            fontSize: '12px',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}>
            {isExpanded ? '▲' : '▼'}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontSize: '13px',
        fontFamily: 'monospace',
        lineHeight: '1.5',
        color: isExpanded ? '#eee' : '#ccc',
      }}>
        {displayContent}
      </div>

      {/* Metadata (only when expanded) */}
      {isExpanded && event.metadata && Object.keys(event.metadata).length > 0 && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: '#1a1a2e',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#888',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Metadata:</div>
          <pre style={{ margin: 0, overflow: 'auto' }}>
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default ExpandableEvent;
