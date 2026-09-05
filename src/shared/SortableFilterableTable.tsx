/**
 * SortableFilterableTable - the platform-wide shared table.
 * Click a header to sort (asc/desc), type to filter across all columns,
 * one-click CSV export (via exportUtils). Styled to match the platform's
 * dark table convention so it can be dropped into any section.
 */
import { useMemo, useState } from 'react';
import { Search, Download, FileSpreadsheet } from 'lucide-react';
import { exportTableToCSV } from './exportUtils';
import { exportTableToExcel } from './excelExport';
import { InfoTip } from './InfoTip';
import { lookup } from './dataDictionary';
import { useVirtualRows } from './useVirtualRows';
import { useSortableColumns, sortRows, SortArrow } from './useSortableColumns';

const ROW_HEIGHT = 36;

export interface STColumn<T> {
  key: keyof T & string;
  label: string;
  numeric?: boolean;
  /** Sort this column chronologically instead of lexicographically. */
  date?: boolean;
  /** Optional custom cell renderer; defaults to String(value). */
  render?: (row: T) => React.ReactNode;
  width?: number | string;
  /** Excel export: header-cell comment (definition, units, data source). */
  comment?: string;
  /** Excel export: totals-row formula for this column. */
  total?: 'sum' | 'avg';
}

interface Props<T> {
  columns: STColumn<T>[];
  rows: T[];
  /** Accent colour for header/controls (hex). */
  accent?: string;
  /** Filename stem for the CSV export. */
  exportName?: string;
  /** Initial sort column key. */
  initialSort?: string;
  emptyText?: string;
  /** Optional per-row style (e.g. a red left border on critical rows). */
  rowStyle?: (row: T) => React.CSSProperties | undefined;
}

export function SortableFilterableTable<T extends Record<string, any>>({
  columns, rows, accent = '#0a84ff', exportName = 'table-export',
  initialSort, emptyText = 'No rows match the current filter.', rowStyle,
}: Props<T>) {
  const { sortKey, sortDir, cycleSort } = useSortableColumns(initialSort ?? null);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      columns.some(c => String(r[c.key] ?? '').toLowerCase().includes(q)));
  }, [rows, columns, filter]);

  const visible = useMemo(() => {
    const col = columns.find(c => c.key === sortKey);
    const type = col?.numeric ? 'numeric' : col?.date ? 'date' : 'text';
    return sortRows(filtered, sortKey, sortDir, type);
  }, [filtered, columns, sortKey, sortDir]);

  const { containerRef, visibleRows, topSpacerHeight, bottomSpacerHeight } =
    useVirtualRows(visible, { rowHeight: ROW_HEIGHT });

  const doExport = () => {
    exportTableToCSV(
      visible.map(r => Object.fromEntries(columns.map(c => [c.label, r[c.key]]))),
      exportName,
    );
  };

  const [xlsBusy, setXlsBusy] = useState(false);
  const doExcelExport = async () => {
    setXlsBusy(true);
    try {
      await exportTableToExcel({
        filename: exportName,
        sheetName: 'Data',
        columns: columns.map(c => ({
          key: c.key, label: c.label, numeric: c.numeric,
          comment: c.comment, total: c.total,
        })),
        rows: visible as Record<string, unknown>[],
        meta: {
          'Filter applied': filter.trim() || '(none)',
          'Sorted by': sortKey && sortDir ? `${sortKey} (${sortDir})` : '(none)',
        },
      });
    } finally {
      setXlsBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, flex: '1 1 220px', maxWidth: 360,
          background: 'rgba(15,15,15,0.7)', border: '1px solid rgba(148,163,184,0.25)',
          borderRadius: 8, padding: '7px 11px',
        }}>
          <Search size={13} style={{ color: 'rgba(148,163,184,0.6)', flexShrink: 0 }} />
          <input
            value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Filter rows…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#e2eaf4', fontSize: 11.5 }}
          />
        </div>
        <span className="record-badge">{visible.length.toLocaleString()} of {rows.length.toLocaleString()} rows</span>
        <div style={{ flex: 1 }} />
        <button onClick={doExport} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px',
          borderRadius: 7, fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
          background: `${accent}1a`, border: `1px solid ${accent}55`, color: accent,
        }}>
          <Download size={12} /> CSV
        </button>
        <button onClick={doExcelExport} disabled={xlsBusy} title="Excel with live formulas + column-note comments" style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px',
          borderRadius: 7, fontSize: 10.5, fontWeight: 800, cursor: xlsBusy ? 'default' : 'pointer',
          background: '#30d1581a', border: '1px solid #30d15855', color: '#30d158',
          opacity: xlsBusy ? 0.6 : 1,
        }}>
          <FileSpreadsheet size={12} /> {xlsBusy ? 'Generating…' : 'Excel'}
        </button>
      </div>

      {/* Table - fixed-height virtualized scroll container, sticky header */}
      <div ref={containerRef} className="dt-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${accent}33` }}>
              {columns.map(c => {
                const active = sortKey === c.key;
                return (
                  <th key={c.key} onClick={() => cycleSort(c.key)} style={{
                    textAlign: c.numeric ? 'right' : 'left', padding: '9px 12px',
                    color: active ? accent : 'rgba(148,163,184,0.8)', fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9.5,
                    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', width: c.width,
                    position: 'sticky', top: 0, zIndex: 2, background: 'rgba(6,12,24,0.97)',
                    boxShadow: `inset 0 -1px 0 ${accent}33`,
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {c.label}
                      {(lookup(c.key) || lookup(c.label)) && (
                        <InfoTip term={lookup(c.key) ? c.key : c.label} />
                      )}
                      <SortArrow active={active} dir={sortDir} />
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {topSpacerHeight > 0 && (
              <tr aria-hidden style={{ height: topSpacerHeight }}><td colSpan={columns.length} style={{ padding: 0, border: 'none' }} /></tr>
            )}
            {visibleRows.map((r, i) => (
              <tr key={i} style={{
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: i % 2 ? 'rgba(255,255,255,0.012)' : 'transparent',
                ...rowStyle?.(r),
              }}>
                {columns.map(c => (
                  <td key={c.key} style={{
                    padding: '8px 12px', color: '#c4d2e1',
                    textAlign: c.numeric ? 'right' : 'left',
                  }}>
                    {c.render ? c.render(r) : String(r[c.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={columns.length} style={{ padding: '18px 12px', textAlign: 'center',
                color: 'rgba(148,163,184,0.5)', fontSize: 11 }}>{emptyText}</td></tr>
            )}
            {bottomSpacerHeight > 0 && (
              <tr aria-hidden style={{ height: bottomSpacerHeight }}><td colSpan={columns.length} style={{ padding: 0, border: 'none' }} /></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
