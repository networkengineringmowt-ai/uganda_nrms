/**
 * useTableSort — lightweight click-to-sort for bespoke tables.
 * Keeps the table's own rendering/formatting; just reorders the row array.
 *
 *   const { sorted, toggle, indicator } = useTableSort(rows, 'name');
 *   <th onClick={() => toggle('name')}>Name {indicator('name')}</th>
 *   {sorted.map(...)}
 */
import { useMemo, useState } from 'react';

export function useTableSort<T extends Record<string, any>>(
  rows: T[],
  initialKey?: keyof T & string,
  initialAsc = true,
) {
  const [sortKey, setSortKey] = useState<string | null>(initialKey ?? null);
  const [asc, setAsc] = useState(initialAsc);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = (typeof av === 'number' && typeof bv === 'number')
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return asc ? cmp : -cmp;
    });
  }, [rows, sortKey, asc]);

  const toggle = (k: string) => {
    if (k === sortKey) setAsc(a => !a);
    else { setSortKey(k); setAsc(true); }
  };

  /** Small unicode arrow indicating sort state for a column key. */
  const indicator = (k: string) => (sortKey === k ? (asc ? ' ▲' : ' ▼') : ' ⇅');

  return { sorted, sortKey, asc, toggle, indicator };
}
