import { useState, useCallback, useEffect } from 'react';

type InjectTarget = 'cc' | 'ag' | 'codex' | 'both' | 'all';

interface CommandInputProps {
  onInject?: (message: string, target: InjectTarget, result: InjectResult) => void;
}

interface InjectResult {
  success: boolean;
  target: string;
  message?: string;
  error?: string;
  method?: string;
  note?: string;
}

interface InjectionStatus {
  tmux: { available: boolean; session: string };
  applescript: { available: boolean };
  comms: { available: boolean; path: string };
}

function CommandInput({ onInject }: CommandInputProps) {
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<InjectTarget>('cc');
  const [directMode, setDirectMode] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [lastResult, setLastResult] = useState<InjectResult | null>(null);
  const [injectionStatus, setInjectionStatus] = useState<InjectionStatus | null>(null);

  // Fetch injection status on mount and periodically
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/inject/status');
        const status = await response.json();
        setInjectionStatus(status);
      } catch {
        // Ignore errors
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleInject = useCallback(async () => {
    if (!message.trim() || isInjecting) return;

    setIsInjecting(true);
    setLastResult(null);

    try {
      const response = await fetch('http://localhost:3001/api/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), target, direct: directMode }),
      });

      const result: InjectResult = await response.json();
      setLastResult(result);

      if (result.success) {
        setMessage(''); // Clear on success
      }

      onInject?.(message.trim(), target, result);
    } catch (error) {
      const result: InjectResult = {
        success: false,
        target,
        error: error instanceof Error ? error.message : 'Network error',
      };
      setLastResult(result);
    } finally {
      setIsInjecting(false);
    }
  }, [message, target, isInjecting, onInject]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleInject();
    }
  };

  const targetButtons: { id: InjectTarget; label: string; color: string }[] = [
    { id: 'cc', label: 'CC', color: '#7c3aed' },
    { id: 'ag', label: 'AG', color: '#059669' },
    { id: 'codex', label: 'Codex', color: '#0ea5e9' },
    { id: 'both', label: 'CC+AG', color: '#f59e0b' },
    { id: 'all', label: 'ALL', color: '#ef4444' },
  ];

  return (
    <div style={{
      padding: '12px 16px',
      background: '#1a1a2e',
      borderTop: '1px solid #333',
    }}>
      {/* Target selector */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '8px',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '12px', color: '#888' }}>
          Send to:
        </span>
        {targetButtons.map((btn) => (
          <button
            key={btn.id}
            onClick={() => setTarget(btn.id)}
            style={{
              padding: '4px 12px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              background: target === btn.id ? btn.color : '#333',
              color: target === btn.id ? 'white' : '#888',
              transition: 'all 0.2s',
            }}
          >
            {btn.label}
          </button>
        ))}

        {/* CC/Codex Injection Status Indicator */}
        {(target === 'cc' || target === 'codex' || target === 'both' || target === 'all') && injectionStatus && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: '16px',
            fontSize: '11px',
          }}>
            {/* tmux status */}
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '10px',
                background: injectionStatus.tmux.available ? '#064e3b' : '#374151',
                color: injectionStatus.tmux.available ? '#6ee7b7' : '#9ca3af',
              }}
              title={injectionStatus.tmux.available
                ? `tmux session '${injectionStatus.tmux.session}' found - direct injection enabled`
                : `No tmux session '${injectionStatus.tmux.session}' found. Run: ./scripts/start-cc-tmux.sh`}
            >
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: injectionStatus.tmux.available ? '#10b981' : '#6b7280',
              }} />
              tmux
            </span>

            {/* AppleScript fallback toggle (only show if tmux not available) */}
            {!injectionStatus.tmux.available && injectionStatus.applescript.available && (
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                color: '#888',
              }}>
                <input
                  type="checkbox"
                  checked={directMode}
                  onChange={(e) => setDirectMode(e.target.checked)}
                  style={{ cursor: 'pointer', width: '12px', height: '12px' }}
                />
                AppleScript fallback
              </label>
            )}
          </div>
        )}
      </div>

      {/* Input and send button */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Type a message to send to ${target.toUpperCase()}... (Cmd/Ctrl+Enter to send)`}
          style={{
            flex: 1,
            padding: '10px 12px',
            border: '1px solid #333',
            borderRadius: '6px',
            background: '#0f0f1a',
            color: '#eee',
            fontSize: '14px',
            fontFamily: 'monospace',
            resize: 'vertical',
            minHeight: '60px',
            maxHeight: '200px',
          }}
          disabled={isInjecting}
        />
        <button
          onClick={handleInject}
          disabled={!message.trim() || isInjecting}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            cursor: message.trim() && !isInjecting ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 'bold',
            background: message.trim() && !isInjecting
              ? targetButtons.find(b => b.id === target)?.color || '#7c3aed'
              : '#333',
            color: 'white',
            opacity: !message.trim() || isInjecting ? 0.5 : 1,
            transition: 'all 0.2s',
            alignSelf: 'flex-end',
          }}
        >
          {isInjecting ? 'Sending...' : 'Send'}
        </button>
      </div>

      {/* Result feedback */}
      {lastResult && (
        <div style={{
          marginTop: '8px',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          background: lastResult.success ? '#064e3b' : '#7f1d1d',
          color: lastResult.success ? '#6ee7b7' : '#fecaca',
        }}>
          {lastResult.success
            ? <>
                Message sent to {lastResult.target.toUpperCase()}
                {lastResult.method && <span style={{ opacity: 0.7 }}> via {lastResult.method}</span>}
                {lastResult.note && <div style={{ marginTop: '4px', opacity: 0.8, fontSize: '11px' }}>{lastResult.note}</div>}
              </>
            : `Failed: ${lastResult.error}`}
        </div>
      )}
    </div>
  );
}

export default CommandInput;
