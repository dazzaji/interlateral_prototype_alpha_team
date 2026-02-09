interface NavigationBarProps {
  isScrollLocked: boolean;
  isAutoScrolling: boolean;
  missedEventCount: number;
  onJumpToNow: () => void;
}

function NavigationBar({
  isScrollLocked,
  isAutoScrolling,
  missedEventCount,
  onJumpToNow,
}: NavigationBarProps) {
  // Don't show anything if auto-scrolling and no missed events
  if (isAutoScrolling && missedEventCount === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 16px',
        background: isScrollLocked ? '#7c3aed' : '#1a1a2e',
        borderRadius: '20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 1000,
      }}
    >
      {/* Status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isScrollLocked ? '#fbbf24' : '#4ade80',
            animation: isAutoScrolling ? 'pulse 2s infinite' : 'none',
          }}
        />
        <span style={{ fontSize: '13px', color: '#eee' }}>
          {isScrollLocked ? 'Paused' : 'Live'}
        </span>
      </div>

      {/* Missed events badge */}
      {missedEventCount > 0 && (
        <span
          style={{
            background: '#f87171',
            color: 'white',
            padding: '2px 8px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
        >
          {missedEventCount} new
        </span>
      )}

      {/* Jump to Now button */}
      {isScrollLocked && (
        <button
          onClick={onJumpToNow}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: '#4ade80',
            border: 'none',
            borderRadius: '12px',
            color: '#000',
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'transform 0.1s',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <span style={{ fontSize: '16px' }}>↓</span>
          Jump to Now
        </button>
      )}

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default NavigationBar;
