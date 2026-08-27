import { useCallback, useEffect, useRef } from 'react';

interface Props {
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
  variant?: 'column' | 'pane';
}

export function ResizeHandle({ onResize, onResizeEnd, variant = 'column' }: Props) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) {
        return;
      }
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      if (delta !== 0) {
        onResize(delta);
      }
    };
    const onUp = () => {
      if (!dragging.current) {
        return;
      }
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onResizeEnd?.();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onResize, onResizeEnd]);

  return (
    <div
      className={variant === 'pane' ? 'pane-split' : 'col-resize-handle'}
      onMouseDown={onMouseDown}
      role="separator"
      aria-orientation="vertical"
    />
  );
}
