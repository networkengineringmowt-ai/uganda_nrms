import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc' | null;
export type ColumnType = 'text' | 'numeric' | 'date';

/**
 * Three-state column sort: neutral (↕) → asc (↑) → desc (↓) → neutral, on
 * each header click. Shared across every sortable table in the platform so
 * the click behaviour and arrow styling stay identical everywhere.
 */
export function useSortableColumns<K extends string = string>(defaultKey: K | null = null) {
  const [sortKey, setSortKey] = useState<K | null>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultKey ? 'asc' : null);

  function cycleSort(key: K) {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); return; }
    if (sortDir === 'asc')  { setSortDir('desc'); return; }
    if (sortDir === 'desc') { setSortKey(null); setSortDir(null); return; }
    setSortDir('asc');
  }

  return { sortKey, sortDir, cycleSort };
}

/**
 * Type-aware comparator-based sort. Returns a new array; `rows` is untouched.
 * `getValue` defaults to a plain `row[key]` lookup — pass a custom one for
 * synthetic columns whose value is computed rather than stored (e.g. a
 * specific year's projected total in a wide year-by-year table).
 */
export function sortRows<T extends Record<string, any>>(
  rows: T[], key: string | null, dir: SortDir, type: ColumnType = 'text',
  getValue: (row: T, key: string) => any = (row, k) => row[k],
): T[] {
  if (!key || !dir) return rows;
  const sorted = [...rows].sort((a, b) => {
    const av = getValue(a, key), bv = getValue(b, key);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    let cmp: number;
    if (type === 'numeric') {
      cmp = Number(av) - Number(bv);
    } else if (type === 'date') {
      cmp = new Date(av as string).getTime() - new Date(bv as string).getTime();
    } else {
      cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    }
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

/** Convenience: cycle state + memoized sorted rows in one call. */
export function useSortedRows<T extends Record<string, any>>(
  rows: T[], columnTypes: Record<string, ColumnType> = {}, defaultKey: string | null = null,
  getValue?: (row: T, key: string) => any,
) {
  const { sortKey, sortDir, cycleSort } = useSortableColumns(defaultKey);
  const sorted = useMemo(
    () => sortRows(rows, sortKey, sortDir, sortKey ? (columnTypes[sortKey] ?? 'text') : 'text', getValue),
    [rows, sortKey, sortDir, columnTypes, getValue],
  );
  return { sorted, sortKey, sortDir, cycleSort };
}

/** ↕ neutral / ↑ asc / ↓ desc — white when inactive, amber when the column drives the sort. */
export function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  const color = active && dir ? '#ffd23f' : 'rgba(255,255,255,0.55)';
  const glyph = active && dir === 'asc' ? '↑' : active && dir === 'desc' ? '↓' : '↕';
  return (
    <span style={{ color, fontSize: 10, marginLeft: 5, fontWeight: 900, display: 'inline-block', lineHeight: 1 }}>
      {glyph}
    </span>
  );
}

/** Drop-in sortable <th> — label + click-to-cycle + SortArrow, styled to match the platform's dark tables. */
export function SortableTh({
  label, sortKeyName, activeKey, dir, onSort, align = 'left', style,
}: {
  label: React.ReactNode;
  sortKeyName: string;
  activeKey: string | null;
  dir: SortDir;
  onSort: (key: string) => void;
  align?: 'left' | 'right' | 'center';
  style?: React.CSSProperties;
}) {
  const active = activeKey === sortKeyName;
  return (
    <th
      onClick={() => onSort(sortKeyName)}
      style={{
        padding: '9px 12px', textAlign: align, fontSize: 9.5, fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
        cursor: 'pointer', userSelect: 'none',
        color: active ? '#ffd23f' : 'rgba(148,163,184,0.8)',
        ...style,
      }}
    >
      {label}<SortArrow active={active} dir={dir} />
    </th>
  );
}
