import { useState, useEffect, useRef } from 'react';
import { useStreams } from './hooks/useStreams';
import { useNavigation } from './hooks/useNavigation';
import { skins, getSkinById } from './skins';
import SkinSelector, { loadSavedSkin, saveSkin } from './components/SkinSelector';
import NavigationBar from './components/NavigationBar';
import CommandInput from './components/CommandInput';
import ExportButtons from './components/ExportButtons';

function App() {
  // Load saved skin preference from localStorage
  const [currentSkinId, setCurrentSkinId] = useState(() => loadSavedSkin());

  // Get stream data from WebSocket
  const {
    events,
    isConnected,
    error,
    reconnect,
    loadHistory,
    isLoadingHistory,
    hasMoreHistory,
    newEventCount,
    clearNewEventCount,
  } = useStreams();

  // Navigation state
  const {
    containerRef,
    isAutoScrolling,
    isScrollLocked,
    missedEventCount,
    jumpToNow,
    onNewEvents,
  } = useNavigation();

  // Track previous event count to detect new events
  const prevEventCountRef = useRef(events.length);

  // Notify navigation when new events arrive
  useEffect(() => {
    const newCount = events.length - prevEventCountRef.current;
    if (newCount > 0) {
      onNewEvents(newCount);
    }
    prevEventCountRef.current = events.length;
  }, [events.length, onNewEvents]);

  // Clear new event count when jumping to now
  const handleJumpToNow = () => {
    jumpToNow();
    clearNewEventCount();
  };

  // Get current skin component
  const currentSkin = getSkinById(currentSkinId);
  const SkinComponent = currentSkin?.Component;

  // Handle skin change
  const handleSkinChange = (skinId: string) => {
    setCurrentSkinId(skinId);
    saveSkin(skinId);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a' }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 20px',
        background: '#1a1a2e',
        borderBottom: '1px solid #333'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
            Comms Monitor
          </h1>
          <span style={{ fontSize: '12px', color: '#666' }}>
            {events.length} events
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Export buttons */}
          <ExportButtons events={events} />

          {/* Skin selector */}
          <SkinSelector
            currentSkinId={currentSkinId}
            onSkinChange={handleSkinChange}
          />

          {/* Connection status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: isConnected ? '#4ade80' : error ? '#f87171' : '#fbbf24'
            }} />
            <span style={{ fontSize: '13px', color: '#888' }}>
              {isConnected ? 'Connected' : error ? 'Error' : 'Connecting...'}
            </span>
            {!isConnected && (
              <button
                onClick={reconnect}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  background: '#333',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#eee',
                  cursor: 'pointer'
                }}
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content - render current skin */}
      <main style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {SkinComponent ? (
            <SkinComponent
              events={events}
              isConnected={isConnected}
              error={error}
              reconnect={reconnect}
              containerRef={containerRef}
              onNewEvents={onNewEvents}
              loadHistory={loadHistory}
              isLoadingHistory={isLoadingHistory}
              hasMoreHistory={hasMoreHistory}
            />
          ) : (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: '#666'
            }}>
              No skin selected. Available skins: {skins.map(s => s.id).join(', ')}
            </div>
          )}
        </div>

        {/* Command injection input */}
        <CommandInput />
      </main>

      {/* Navigation bar */}
      <NavigationBar
        isScrollLocked={isScrollLocked}
        isAutoScrolling={isAutoScrolling}
        missedEventCount={missedEventCount + newEventCount}
        onJumpToNow={handleJumpToNow}
      />

      {/* Error banner */}
      {error && (
        <div style={{
          position: 'fixed',
          bottom: '70px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 24px',
          background: '#7f1d1d',
          borderRadius: '8px',
          color: '#fecaca',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default App;
