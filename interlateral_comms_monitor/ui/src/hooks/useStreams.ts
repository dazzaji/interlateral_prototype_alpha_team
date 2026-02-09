import { useState, useEffect, useRef, useCallback } from 'react';

// StreamEvent type matching backend
export interface StreamEvent {
  id: string;
  timestamp: string;
  source: 'comms' | 'ag_log' | 'cc' | 'ag' | 'unknown';
  type: 'message' | 'cc_message' | 'ag_message' | 'separator' | 'heading' | 'thinking' | 'tool_use' | 'tool_result';
  content: string;
  metadata?: Record<string, unknown>;
}

interface WebSocketMessage {
  type: 'initial' | 'event';
  events?: StreamEvent[];
  event?: StreamEvent;
}

interface UseStreamsOptions {
  url?: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

interface UseStreamsReturn {
  events: StreamEvent[];
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
  loadHistory: () => Promise<void>;
  isLoadingHistory: boolean;
  hasMoreHistory: boolean;
  newEventCount: number;
  clearNewEventCount: () => void;
}

export function useStreams(options: UseStreamsOptions = {}): UseStreamsReturn {
  const {
    url = 'ws://localhost:3001',
    reconnectDelay = 2000,
    maxReconnectAttempts = 10,
  } = options;

  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [newEventCount, setNewEventCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyOffsetRef = useRef(0);

  const connect = useCallback(() => {
    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[useStreams] Connected');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);

          if (data.type === 'initial' && data.events) {
            // Replace events with initial batch
            setEvents(data.events);
            historyOffsetRef.current = data.events.length;
          } else if (data.type === 'event' && data.event) {
            // Append new event and increment count
            setEvents((prev) => [...prev, data.event!]);
            setNewEventCount((prev) => prev + 1);
          }
        } catch (err) {
          console.error('[useStreams] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        console.log('[useStreams] Disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = reconnectDelay * Math.min(reconnectAttemptsRef.current, 5);
          console.log(`[useStreams] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          setError('Max reconnection attempts reached');
        }
      };

      ws.onerror = (err) => {
        console.error('[useStreams] WebSocket error:', err);
        setError('WebSocket connection error');
      };
    } catch (err) {
      console.error('[useStreams] Failed to create WebSocket:', err);
      setError('Failed to connect to server');
    }
  }, [url, reconnectDelay, maxReconnectAttempts]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  // Load more history from the server
  const loadHistory = useCallback(async () => {
    if (isLoadingHistory || !hasMoreHistory) return;

    setIsLoadingHistory(true);
    try {
      const response = await fetch(
        `http://localhost:3001/api/events/history?offset=${historyOffsetRef.current}&limit=50`
      );
      const data = await response.json();

      if (data.events && data.events.length > 0) {
        // Prepend historical events
        setEvents((prev) => [...data.events, ...prev]);
        historyOffsetRef.current += data.events.length;
      }

      setHasMoreHistory(data.hasMore);
    } catch (err) {
      console.error('[useStreams] Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [isLoadingHistory, hasMoreHistory]);

  // Clear new event count (called when user catches up)
  const clearNewEventCount = useCallback(() => {
    setNewEventCount(0);
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    events,
    isConnected,
    error,
    reconnect,
    loadHistory,
    isLoadingHistory,
    hasMoreHistory,
    newEventCount,
    clearNewEventCount,
  };
}

// Filter events by source
export function filterBySource(events: StreamEvent[], source: string): StreamEvent[] {
  return events.filter((e) => e.source === source);
}

// Filter events by type
export function filterByType(events: StreamEvent[], types: string[]): StreamEvent[] {
  return events.filter((e) => types.includes(e.type));
}

// Get CC-related events
export function getCCEvents(events: StreamEvent[]): StreamEvent[] {
  return events.filter((e) => e.source === 'comms' && e.type === 'cc_message');
}

// Get AG-related events
export function getAGEvents(events: StreamEvent[]): StreamEvent[] {
  return events.filter((e) => e.source === 'comms' && e.type === 'ag_message');
}
