import { useCallback } from 'react';
import type { StreamEvent } from '../hooks/useStreams';

type ExportFormat = 'json' | 'txt' | 'csv';

interface ExportButtonsProps {
  events: StreamEvent[];
  filteredEvents?: StreamEvent[];
  filterLabel?: string;
}

function ExportButtons({ events, filteredEvents, filterLabel }: ExportButtonsProps) {
  const eventsToExport = filteredEvents || events;

  // Generate date-stamped filename
  const getFilename = (format: ExportFormat) => {
    const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const suffix = filterLabel ? `-${filterLabel}` : '';
    return `comms-export${suffix}-${date}.${format}`;
  };

  // Convert events to JSON format
  const toJSON = useCallback(() => {
    return JSON.stringify(eventsToExport, null, 2);
  }, [eventsToExport]);

  // Convert events to plain text format
  const toTXT = useCallback(() => {
    return eventsToExport
      .map((e) => {
        const time = new Date(e.timestamp).toLocaleString();
        const source = e.source.toUpperCase();
        const type = e.type.replace('_', ' ').toUpperCase();
        return `[${time}] [${source}] [${type}]\n${e.content}\n`;
      })
      .join('\n---\n\n');
  }, [eventsToExport]);

  // Convert events to CSV format
  const toCSV = useCallback(() => {
    const headers = ['timestamp', 'source', 'type', 'content'];
    const escapeCSV = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const rows = eventsToExport.map((e) =>
      [e.timestamp, e.source, e.type, e.content].map(escapeCSV).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }, [eventsToExport]);

  // Trigger download
  const download = useCallback(
    (format: ExportFormat) => {
      let content: string;
      let mimeType: string;

      switch (format) {
        case 'json':
          content = toJSON();
          mimeType = 'application/json';
          break;
        case 'txt':
          content = toTXT();
          mimeType = 'text/plain';
          break;
        case 'csv':
          content = toCSV();
          mimeType = 'text/csv';
          break;
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getFilename(format);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [toJSON, toTXT, toCSV]
  );

  const buttonStyle = {
    padding: '4px 10px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    background: '#333',
    color: '#eee',
    transition: 'all 0.2s',
  };

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <span style={{ fontSize: '11px', color: '#666' }}>
        Export {eventsToExport.length} events:
      </span>
      <button
        onClick={() => download('json')}
        style={buttonStyle}
        title="Export as JSON"
      >
        JSON
      </button>
      <button
        onClick={() => download('txt')}
        style={buttonStyle}
        title="Export as plain text"
      >
        TXT
      </button>
      <button
        onClick={() => download('csv')}
        style={buttonStyle}
        title="Export as CSV"
      >
        CSV
      </button>
    </div>
  );
}

export default ExportButtons;
