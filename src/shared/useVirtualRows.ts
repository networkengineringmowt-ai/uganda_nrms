import { useEffect, useRef, useState } from 'react';

interface VirtualRowsOptions {
  /** Fixed row height in px — required for offset math. */
  rowHeight: number;
  /** Extra rows rendered above/below the viewport to smooth fast scrolling. */
  overscan?: number;
}

interface VirtualRowsResult<T> {
  /** Attach to the scrollable container (the element with the fixed height + overflow:auto). */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Slice of `rows` that should actually be rendered right now. */
  visibleRows: T[];
  /** Index of the first rendered row within the full `rows` array. */
  startIndex: number;
  /** Height (px) of the leading spacer row, in place of the rows scrolled past. */
  topSpacerHeight: number;
  /** Height (px) of the trailing spacer row, in place of the rows not yet reached. */
  bottomSpacerHeight: number;
}

/**
 * Table-row virtualization via spacer <tr> elements — the standard technique
 * for HTML tables, where absolute positioning (used by div-based virtual
 * lists) breaks native table layout. Only rows near the viewport are mounted;
 * a leading and trailing spacer row keep the scrollbar/scroll height correct.
 */
export function useVirtualRows<T>(rows: T[], { rowHeight, overscan = 8 }: VirtualRowsOptions): VirtualRowsResult<T> {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    setViewportHeight(el.clientHeight);
    const ro = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    ro.observe(el);
    return () => { el.removeEventListener('scroll', onScroll); ro.disconnect(); };
  }, []);

  // Reset scroll position tracking when the row count shrinks below where we'd
  // scrolled to (e.g. a filter narrows the list) — avoids stranding the view
  // past the end with only spacer rows visible.
  useEffect(() => {
    const el = containerRef.current;
    if (el && el.scrollTop > rows.length * rowHeight) el.scrollTop = 0;
  }, [rows.length, rowHeight]);

  const total = rows.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const endIndex = Math.min(total, startIndex + visibleCount || total);

  return {
    containerRef,
    visibleRows: rows.slice(startIndex, endIndex),
    startIndex,
    topSpacerHeight: startIndex * rowHeight,
    bottomSpacerHeight: Math.max(0, (total - endIndex) * rowHeight),
  };
}
