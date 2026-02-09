import { StreamEvent } from '../hooks/useStreams';

// Props passed to every skin component
export interface SkinProps {
  // All events from the stream
  events: StreamEvent[];

  // Connection status
  isConnected: boolean;

  // Connection error (if any)
  error: string | null;

  // Reconnect function
  reconnect: () => void;

  // Navigation props (optional for backwards compatibility)
  containerRef?: React.RefObject<HTMLDivElement>;
  onNewEvents?: (count: number) => void;
  loadHistory?: () => Promise<void>;
  isLoadingHistory?: boolean;
  hasMoreHistory?: boolean;
}

// Metadata for skin registration
export interface SkinMeta {
  // Unique identifier for the skin
  id: string;

  // Display name shown in dropdown
  name: string;

  // Brief description of the skin
  description: string;

  // Icon (optional, emoji or component)
  icon?: string;
}

// A skin module exports both the component and metadata
export interface SkinModule {
  default: React.ComponentType<SkinProps>;
  meta: SkinMeta;
}

// Registry entry for discovered skins
export interface SkinEntry {
  id: string;
  name: string;
  description: string;
  icon?: string;
  Component: React.ComponentType<SkinProps>;
}
