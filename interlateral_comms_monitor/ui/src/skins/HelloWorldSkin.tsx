// HelloWorldSkin.tsx - A minimal example skin for learning
// Part of SKIN_DEV_GUIDE.md tutorial

import type { SkinProps, SkinMeta } from './types';

// Metadata for skin registration
// This is REQUIRED for auto-discovery
export const meta: SkinMeta = {
  id: 'hello-world',
  name: 'Hello World',
  description: 'A minimal example skin for learning the plugin architecture',
  icon: '👋',
};

// Main component
// Receives SkinProps with events, connection status, and navigation helpers
function HelloWorldSkin({ events, isConnected, containerRef }: SkinProps) {
  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        overflow: 'auto',
        padding: '20px',
        background: '#0f0f1a',
        color: '#e0e0e0',
        fontFamily: 'monospace',
      }}
    >
      {/* Header */}
      <h2 style={{ color: '#7c3aed', marginBottom: '20px' }}>
        Hello World Skin
      </h2>

      {/* Connection status */}
      <div style={{ marginBottom: '20px' }}>
        Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      {/* Event count */}
      <div style={{ marginBottom: '20px' }}>
        Total Events: {events.length}
      </div>

      {/* Instructions */}
      <div style={{
        padding: '16px',
        marginBottom: '20px',
        background: '#1a1a2e',
        borderRadius: '8px',
        borderLeft: '4px solid #059669',
      }}>
        <strong style={{ color: '#059669' }}>How This Skin Works:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', lineHeight: '1.6' }}>
          <li>File: <code>ui/src/skins/HelloWorldSkin.tsx</code></li>
          <li>Auto-discovered by matching <code>*Skin.tsx</code> pattern</li>
          <li>Exports <code>meta</code> (SkinMeta) and <code>default</code> (component)</li>
          <li>Receives events, connection status via <code>SkinProps</code></li>
        </ul>
      </div>

      {/* Event list - show last 10 events */}
      <h3 style={{ color: '#888', marginBottom: '12px' }}>Recent Events:</h3>
      <div>
        {events.slice(-10).map(event => (
          <div
            key={event.id}
            style={{
              padding: '12px',
              marginBottom: '8px',
              background: '#1a1a2e',
              borderRadius: '6px',
              borderLeft: '3px solid #7c3aed',
            }}
          >
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
              <span style={{
                background: '#333',
                padding: '2px 6px',
                borderRadius: '4px',
                marginRight: '8px',
              }}>
                {event.type}
              </span>
              {new Date(event.timestamp).toLocaleTimeString()}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {event.content.substring(0, 200)}
              {event.content.length > 200 && '...'}
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {events.length === 0 && (
        <div style={{
          textAlign: 'center',
          color: '#666',
          padding: '40px',
          fontStyle: 'italic',
        }}>
          No events yet. Try adding content to comms.md!
        </div>
      )}

      {/* Footer with documentation link */}
      <div style={{
        marginTop: '20px',
        padding: '12px',
        background: '#252538',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#888',
      }}>
        See <code>docs/SKIN_DEV_GUIDE.md</code> for the full tutorial on creating custom skins.
      </div>
    </div>
  );
}

export default HelloWorldSkin;
