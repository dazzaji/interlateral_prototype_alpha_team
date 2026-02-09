# Skin Development Guide 

**Version:** 1.0
**Date:** 2026-01-21
**Authors:** Claude Code (CC) + Antigravity (AG)

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Plugin Architecture](#plugin-architecture)
4. [Creating a Skin](#creating-a-skin)
5. [SkinProps Reference](#skinprops-reference)
6. [SkinMeta Reference](#skinmeta-reference)
7. [Styling Best Practices](#styling-best-practices)
8. [Hello World Tutorial](#hello-world-tutorial)
9. [Advanced Features](#advanced-features)
10. [Testing Your Skin](#testing-your-skin)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The Interlateral Comms Monitor uses a **plugin-based skin system** that allows you to create custom visualizations without modifying the core application.

### Key Features

- **Zero Configuration:** Drop a `.tsx` file in the skins folder, refresh, done
- **Auto-Discovery:** Uses Vite's `import.meta.glob` for automatic registration
- **Hot Reloading:** Changes appear immediately during development
- **Type Safety:** Full TypeScript support with defined interfaces

### Existing Skins

| Skin | Description | Best For |
|------|-------------|----------|
| **Cockpit** | Split-screen with resizable panes | Multi-agent monitoring |
| **Timeline** | Chronological interleaved view | Following conversations |
| **Focus** | Tabbed interface with badges | Single-source focus |

---

## Quick Start

**Create a skin in 3 steps:**

```tsx
// 1. Create ui/src/skins/MySkin.tsx

import type { SkinProps, SkinMeta } from './types';

// 2. Export metadata
export const meta: SkinMeta = {
  id: 'my-skin',
  name: 'My Skin',
  description: 'A custom visualization',
  icon: '✨',
};

// 3. Export default component
function MySkin({ events }: SkinProps) {
  return (
    <div>
      {events.map(e => <div key={e.id}>{e.content}</div>)}
    </div>
  );
}

export default MySkin;
```

**That's it!** Refresh the browser and your skin appears in the dropdown.

---

## Plugin Architecture

### How Auto-Discovery Works

The skin system uses Vite's `import.meta.glob` to find all matching files:

```typescript
// ui/src/skins/index.ts
const skinModules = import.meta.glob<SkinModule>('./*Skin.tsx', { eager: true });
```

### File Naming Convention

**Required:** Files must match the pattern `*Skin.tsx`

| Valid Names | Invalid Names |
|-------------|---------------|
| `MySkin.tsx` | `my-skin.tsx` |
| `CustomViewSkin.tsx` | `CustomView.tsx` |
| `DebugSkin.tsx` | `debug-skin.tsx` |

### Required Exports

Every skin file must export:

1. **`meta`** - A `SkinMeta` object with id, name, description
2. **`default`** - A React component that accepts `SkinProps`

```typescript
// Both exports are REQUIRED
export const meta: SkinMeta = { ... };  // Named export
export default MySkinComponent;          // Default export
```

### Registration Flow

```
1. Vite discovers *Skin.tsx files
2. Each file is imported eagerly
3. index.ts extracts meta + default
4. Skins array is built and sorted
5. SkinSelector reads the array
6. User sees all skins in dropdown
```

---

## Creating a Skin

### Step 1: Create the File

Create a new file in `ui/src/skins/` with the `*Skin.tsx` pattern:

```bash
touch ui/src/skins/MySkin.tsx
```

### Step 2: Add Imports

```typescript
import type { SkinProps, SkinMeta } from './types';
import type { StreamEvent } from '../hooks/useStreams';

// Optional: React hooks
import { useState, useEffect, useMemo } from 'react';
```

### Step 3: Define Metadata

```typescript
export const meta: SkinMeta = {
  id: 'my-skin',           // Unique ID (used for localStorage)
  name: 'My Custom Skin',  // Display name in dropdown
  description: 'Brief description of what this skin does',
  icon: '🎨',              // Optional emoji or icon
};
```

### Step 4: Create the Component

```typescript
function MySkin({ events, isConnected, error, reconnect, containerRef }: SkinProps) {
  // Your rendering logic here
  return (
    <div ref={containerRef} style={{ height: '100%', overflow: 'auto' }}>
      {/* Render events */}
    </div>
  );
}

export default MySkin;
```

---

## SkinProps Reference

Every skin component receives these props:

```typescript
interface SkinProps {
  // Core data
  events: StreamEvent[];      // All events from the stream

  // Connection status
  isConnected: boolean;       // WebSocket connected?
  error: string | null;       // Connection error message
  reconnect: () => void;      // Function to reconnect

  // Navigation (optional)
  containerRef?: React.RefObject<HTMLDivElement>;
  onNewEvents?: (count: number) => void;
  loadHistory?: () => Promise<void>;
  isLoadingHistory?: boolean;
  hasMoreHistory?: boolean;
}
```

### StreamEvent Structure

```typescript
interface StreamEvent {
  id: string;           // Unique event ID
  type: string;         // Event type (e.g., 'cc_message', 'ag_message')
  source: string;       // Source file ('comms', 'ag_log', etc.)
  content: string;      // Event content/text
  timestamp: string;    // ISO timestamp
  metadata?: Record<string, unknown>;  // Additional data
}
```

### Event Types

| Type | Source | Description |
|------|--------|-------------|
| `cc_message` | Various | Claude Code message |
| `ag_message` | Various | Antigravity message |
| `comms_entry` | comms | Entry from comms.md |
| `file_change` | watchers | File modification event |

---

## SkinMeta Reference

```typescript
interface SkinMeta {
  id: string;          // REQUIRED: Unique identifier (lowercase, hyphens OK)
  name: string;        // REQUIRED: Display name for dropdown
  description: string; // REQUIRED: Brief description
  icon?: string;       // OPTIONAL: Emoji or icon string
}
```

### ID Guidelines

- Use lowercase with hyphens: `my-custom-skin`
- Must be unique across all skins
- Stored in localStorage for persistence

---

## Styling Best Practices

### Inline Styles (Recommended for Simple Skins)

```tsx
<div style={{
  padding: '16px',
  background: '#0f0f1a',
  color: '#e0e0e0',
  fontFamily: 'monospace',
}}>
```

### CSS-in-JS with Style Tags

```tsx
function MySkin({ events }: SkinProps) {
  return (
    <>
      <style>{`
        .my-skin-container { padding: 16px; }
        .my-skin-event { margin-bottom: 8px; }
      `}</style>
      <div className="my-skin-container">
        {/* content */}
      </div>
    </>
  );
}
```

### Color Palette (Match Existing Skins)

```css
/* Backgrounds */
--bg-primary: #0f0f1a;
--bg-secondary: #1a1a2e;
--bg-highlight: #252538;

/* Text */
--text-primary: #e0e0e0;
--text-secondary: #888888;
--text-muted: #666666;

/* Accent Colors */
--cc-color: #7c3aed;    /* Purple for Claude Code */
--ag-color: #059669;    /* Green for Antigravity */
--comms-color: #0891b2; /* Cyan for Comms */
```

### Container Requirements

**Important:** Include `containerRef` for navigation features to work:

```tsx
<div
  ref={containerRef}
  style={{
    height: '100%',
    overflow: 'auto'  // Required for scroll detection
  }}
>
```

---

## Hello World Tutorial

Let's create a minimal "Hello World" skin step by step.

### Step 1: Create the File

```bash
# From repo root
touch interlateral_comms_monitor/ui/src/skins/HelloWorldSkin.tsx
```

### Step 2: Write the Code

```tsx
// ui/src/skins/HelloWorldSkin.tsx

import type { SkinProps, SkinMeta } from './types';

// Metadata for skin registration
export const meta: SkinMeta = {
  id: 'hello-world',
  name: 'Hello World',
  description: 'A minimal example skin for learning',
  icon: '👋',
};

// Main component
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
        👋 Hello World Skin
      </h2>

      {/* Connection status */}
      <div style={{ marginBottom: '20px' }}>
        Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      {/* Event count */}
      <div style={{ marginBottom: '20px' }}>
        Total Events: {events.length}
      </div>

      {/* Event list */}
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
              {event.type} • {new Date(event.timestamp).toLocaleTimeString()}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {event.content.substring(0, 200)}
              {event.content.length > 200 && '...'}
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {events.length === 0 && (
        <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
          No events yet. Try adding content to comms.md!
        </div>
      )}
    </div>
  );
}

export default HelloWorldSkin;
```

### Step 3: Test It

1. Start the dev server: `cd ui && npm run dev`
2. Open http://localhost:5173
3. Click the skin dropdown
4. Select "Hello World" - your skin should appear!

### Step 4: Verify Auto-Discovery

Check the browser console for:
```
[Skins] Discovered 4 skins: ["cockpit", "focus", "hello-world", "timeline"]
```

---

## Advanced Features

### Filtering Events

```tsx
// Filter by source
const ccEvents = events.filter(e => e.source === 'cc' || e.type === 'cc_message');
const agEvents = events.filter(e => e.source === 'ag' || e.source === 'ag_log');
const commsEvents = events.filter(e => e.source === 'comms');
```

### Using State

```tsx
function MySkin({ events }: SkinProps) {
  const [filter, setFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Memoize filtered events
  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter(e => e.source === filter);
  }, [events, filter]);

  // ...
}
```

### Handling History Loading

```tsx
function MySkin({ events, loadHistory, isLoadingHistory, hasMoreHistory, containerRef }: SkinProps) {
  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget;

    // Load more when scrolled to top
    if (scrollTop === 0 && hasMoreHistory && !isLoadingHistory && loadHistory) {
      await loadHistory();
    }
  };

  return (
    <div ref={containerRef} onScroll={handleScroll}>
      {isLoadingHistory && <div>Loading...</div>}
      {/* events */}
    </div>
  );
}
```

### Tracking New Events (Unread Badges)

```tsx
function MySkin({ events, onNewEvents }: SkinProps) {
  const [lastSeenCount, setLastSeenCount] = useState(events.length);

  useEffect(() => {
    const newCount = events.length - lastSeenCount;
    if (newCount > 0 && onNewEvents) {
      onNewEvents(newCount);
    }
  }, [events.length]);

  // Reset on user interaction
  const handleFocus = () => setLastSeenCount(events.length);
  // ...
}
```

---

## Testing Your Skin

### Manual Testing Checklist

- [ ] Skin appears in dropdown after refresh
- [ ] Skin renders without errors
- [ ] Events display correctly
- [ ] Scroll works properly
- [ ] Connection status displays
- [ ] Empty state shows when no events
- [ ] Dark theme colors match other skins

### T5 Plugin Architecture Test

The T5 test verifies auto-discovery:

1. Add a new `*Skin.tsx` file
2. Refresh the browser
3. New skin should appear in dropdown
4. No code changes to App.tsx or index.ts required

### Console Checks

```javascript
// Check registered skins
console.log(skins);  // Should include your skin

// Check for errors
// Look for: "[Skins] Invalid skin module: ..."
```

---

## Troubleshooting

### Skin Not Appearing in Dropdown

**Check file name:** Must match `*Skin.tsx` pattern
```bash
# Correct
MySkin.tsx
CustomViewSkin.tsx

# Incorrect
my-skin.tsx
MyView.tsx
```

**Check exports:** Both `meta` and `default` required
```typescript
// Must have BOTH
export const meta: SkinMeta = { ... };
export default MySkinComponent;
```

**Check console:** Look for warnings
```
[Skins] Invalid skin module: ./MySkin.tsx (missing default export or meta)
```

### TypeScript Errors

**Missing types:** Import from types.ts
```typescript
import type { SkinProps, SkinMeta } from './types';
```

**StreamEvent type:** Import separately
```typescript
import type { StreamEvent } from '../hooks/useStreams';
```

### Styling Issues

**Scroll not working:** Add `overflow: auto` and `height: 100%`
```tsx
<div style={{ height: '100%', overflow: 'auto' }}>
```

**Navigation not working:** Include `containerRef`
```tsx
<div ref={containerRef}>
```

### Events Not Displaying

**Check events array:** May be empty initially
```tsx
if (events.length === 0) {
  return <div>Waiting for events...</div>;
}
```

**Check event structure:** Use console.log
```tsx
console.log('Events:', events);
```

---

## Quick Reference

### Minimal Skin Template

```tsx
import type { SkinProps, SkinMeta } from './types';

export const meta: SkinMeta = {
  id: 'my-skin',
  name: 'My Skin',
  description: 'Description here',
};

function MySkin({ events, containerRef }: SkinProps) {
  return (
    <div ref={containerRef} style={{ height: '100%', overflow: 'auto' }}>
      {events.map(e => <div key={e.id}>{e.content}</div>)}
    </div>
  );
}

export default MySkin;
```

### File Locations

| File | Purpose |
|------|---------|
| `ui/src/skins/*.tsx` | Skin components |
| `ui/src/skins/types.ts` | Type definitions |
| `ui/src/skins/index.ts` | Auto-discovery logic |

### Commands

```bash
# Start dev server
cd ui && npm run dev

# Check for TypeScript errors
cd ui && npx tsc --noEmit
```

---

*Guide created by CC + AG for Sprint 2C on 2026-01-21*
