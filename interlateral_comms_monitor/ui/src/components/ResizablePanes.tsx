import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';

interface ResizablePanesProps {
  direction: 'horizontal' | 'vertical';
  children: [ReactNode, ReactNode];
  initialRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  dividerSize?: number;
  onResize?: (ratio: number) => void;
}

function ResizablePanes({
  direction,
  children,
  initialRatio = 0.5,
  minRatio = 0.1,
  maxRatio = 0.9,
  dividerSize = 6,
  onResize,
}: ResizablePanesProps) {
  const [ratio, setRatio] = useState(initialRatio);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isHorizontal = direction === 'horizontal';

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let newRatio: number;

      if (isHorizontal) {
        newRatio = (e.clientX - rect.left) / rect.width;
      } else {
        newRatio = (e.clientY - rect.top) / rect.height;
      }

      // Clamp ratio within bounds
      newRatio = Math.max(minRatio, Math.min(maxRatio, newRatio));
      setRatio(newRatio);
      onResize?.(newRatio);
    },
    [isDragging, isHorizontal, minRatio, maxRatio, onResize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp, isHorizontal]);

  const firstPaneStyle: React.CSSProperties = isHorizontal
    ? { width: `calc(${ratio * 100}% - ${dividerSize / 2}px)`, height: '100%' }
    : { height: `calc(${ratio * 100}% - ${dividerSize / 2}px)`, width: '100%' };

  const secondPaneStyle: React.CSSProperties = isHorizontal
    ? { width: `calc(${(1 - ratio) * 100}% - ${dividerSize / 2}px)`, height: '100%' }
    : { height: `calc(${(1 - ratio) * 100}% - ${dividerSize / 2}px)`, width: '100%' };

  const dividerStyle: React.CSSProperties = {
    ...(isHorizontal
      ? { width: dividerSize, height: '100%', cursor: 'col-resize' }
      : { height: dividerSize, width: '100%', cursor: 'row-resize' }),
    background: isDragging ? '#7c3aed' : '#333',
    flexShrink: 0,
    transition: isDragging ? 'none' : 'background 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const gripStyle: React.CSSProperties = {
    ...(isHorizontal
      ? { width: 2, height: 30 }
      : { width: 30, height: 2 }),
    background: isDragging ? '#fff' : '#666',
    borderRadius: 1,
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div style={{ ...firstPaneStyle, overflow: 'hidden' }}>{children[0]}</div>
      <div
        style={dividerStyle}
        onMouseDown={handleMouseDown}
        title="Drag to resize"
      >
        <div style={gripStyle} />
      </div>
      <div style={{ ...secondPaneStyle, overflow: 'hidden' }}>{children[1]}</div>
    </div>
  );
}

export default ResizablePanes;
