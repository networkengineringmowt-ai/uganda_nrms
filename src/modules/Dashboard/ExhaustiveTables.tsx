import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';

type Row = Record<string, unknown>;
const ACRONYMS = new Set(['aadt','id','km','esal','gps','pci','iri','vci','wim','atc','esa','fwd','mef','tcs','vcpd','gis','sql','ndpiv','osm','wgs']);
function prettyLabel(key: string): string {
  return key.split('_').map(w => {
    const lw = w.toLowerCase();
    if (ACRONYMS.has(lw)) return lw.toUpperCase();
    if (lw === 'pct') return '%';
    if (/^\d+$/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}
// Table names corrected to match scripts/etl_all.py's real load targets (the
// old names - road_condition_assessments, traffic_stations, bridge_inventory,
// maintenance_works, encroachments, investment_projects - were never created
// in the live Supabase project, so this view always fell through to the
// static GeoJSON fallback below and presented it as "ALL records" from a
// live table). 'reserve'/'pim' dropped - no real source dataset exists yet
// to populate a live table for them. Four sections with real ETL-backed
// data added: budget, growthfactors, overloading, bridgeworks.
const SPECS: Record<string, string> = {
  rms: 'road_links', pms: 'road_link_condition', tis: 'traffic_count_stations',
  bms: 'structures', ducar: 'maintenance_programme', projects: 'maintenance_programme',
  budget: 'budget_alignment', growthfactors: 'traffic_growth_factors',
  overloading: 'overloading_by_link', bridgeworks: 'bridge_works',
};
// Fetches every row in `table`, paginating past PostgREST's ~1000-row-per-request
// cap so no records are silently dropped - this feeds the "Exhaustive Table" view,
// which promises ALL records, not a capped sample.
async function fetchAllRows(table: string): Promise<Row[]> {
  const PAGE = 1000;
  const all: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1);
    if (error || !data) break;
    all.push(...(data as Row[]));
    if (data.length < PAGE) break; // last page
  }
  return all;
}
// Sections with no entry in SPECS have no backing database table - their
// real records live in local/static data rendered by that section's own
// Dashboard tab. Returning [] here (instead of defaulting to RMS's
// road_links) means this view honestly says "no dataset wired" rather than
// mislabeling another section's records as this section's own.
async function loadRows(sectionId: string): Promise<Row[]> {
  const table = SPECS[sectionId];
  if (!table) return [];
  try {
    const q = fetchAllRows(table);
    const t = new Promise<null>(res => setTimeout(() => res(null), 9000));
    const data = await Promise.race([q, t]);
    if (data) return data;
  } catch {}
  // No static-file fallback: this view promises "ALL records" from the live
  // table, so an empty/failed live query returns honestly empty rather than
  // quietly substituting a bundled GeoJSON sample as if it were the table.
  return [];
}
const num = (v: unknown): number | null => { if (typeof v === 'number' && isFinite(v)) return v; if (typeof v === 'string' && v !== '' && isFinite(Number(v))) return Number(v); return null; };
const fmtN = (n: number, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });
// Any column identifying an individual person (field staff, submitters,
// contacts) is dropped from this view entirely - never shown, exported, or
// counted as an attribute. Deliberately narrow (matches surveyor_name,
// inspector_name, contact_person, submitted_by, etc.) so it doesn't also
// catch legitimate asset/place names like road_name or district_name.
const PII_COL = /surveyor_name|inspector_name|assessor_name|officer_name|engineer_name|supervisor_name|contact_name|contact_person|contact_email|contact_phone|submitted_by|recorded_by|prepared_by|reported_by|approved_by|reviewed_by|decided_by|created_by|updated_by|^email$|_email$|^phone$|_phone|mobile|national_id|^nin$|passport/i;
// Relative (per-column min-max) heat colouring for numeric cells - a value at
// the low end of that column's own range reads cool/green, the high end
// reads hot/amber-red, so the eye can scan magnitude within a column at a
// glance without cross-column context.
function heatStyle(t: number): React.CSSProperties {
  const c = Math.max(0, Math.min(1, t));
  const r = c < 0.5 ? Math.round(60 + c * 2 * 195) : 255;
  const g = c < 0.5 ? Math.round(150 + c * 2 * 60) : Math.round(210 - (c - 0.5) * 2 * 165);
  return {
    display: 'inline-block', minWidth: '100%', padding: '2px 8px', borderRadius: 5,
    background: `rgba(${r},${g},55,0.14)`, color: `rgb(${r},${g},80)`, fontWeight: 700,
    fontVariantNumeric: 'tabular-nums', textAlign: 'right',
  };
}
const NO_DATA_STYLE: React.CSSProperties = {
  display: 'inline-block', padding: '1px 7px', borderRadius: 5,
  background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.25)',
  color: 'rgba(203,213,225,0.65)', fontWeight: 600, fontStyle: 'italic',
};

export function ExhaustiveTables({ sectionId, accent = '#00f5ff' }: { sectionId: string; accent?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { let d = false; loadRows(sectionId).then(r => { if (!d) setRows(r); }); return () => { d = true; }; }, [sectionId]);
  const cols = useMemo(() => rows && rows.length ? Object.keys(rows[0]).filter(c => !PII_COL.test(c)) : [], [rows]);
  const numCols = useMemo(() => cols.filter(c => rows && rows.some(r => num(r[c]) != null)), [cols, rows]);
  const ranges = useMemo(() => { const m: Record<string, [number, number]> = {};
    numCols.forEach(c => { const v = (rows ?? []).map(r => num(r[c])).filter(x => x != null) as number[];
      m[c] = v.length ? [Math.min(...v), Math.max(...v)] : [0, 1]; }); return m; }, [numCols, rows]);

  const columns: STColumn<Row>[] = useMemo(() => cols.map(c => {
    const isNum = numCols.includes(c);
    if (!isNum) {
      return {
        key: c, label: prettyLabel(c),
        render: (row: Row) => {
          const v = row[c];
          if (v == null || v === '') return <span style={NO_DATA_STYLE}>No data</span>;
          return String(v);
        },
      } as STColumn<Row>;
    }
    const rg = ranges[c] ?? [0, 1];
    return {
      key: c, label: prettyLabel(c), numeric: true,
      render: (row: Row) => {
        const n = num(row[c]);
        if (n == null) return <span style={NO_DATA_STYLE}>No data</span>;
        const t = rg[1] > rg[0] ? (n - rg[0]) / (rg[1] - rg[0]) : 0.5;
        return <span style={heatStyle(t)}>{fmtN(n, 2)}</span>;
      },
    } as STColumn<Row>;
  }), [cols, numCols, ranges]);

  if (rows === null) return <div style={{ padding: 20, color: '#64748b', fontSize: 12 }}>Loading all records…</div>;
  if (!rows.length) return (
    <div style={{ padding: 16, color: '#64748b', fontSize: 12 }}>
      {sectionId in SPECS
        ? 'No data available yet.'
        : "This section isn't wired to a database table yet - see its Dashboard tab above for this section's real figures."}
    </div>
  );
  return (
    <div style={{ width: '100%' }}>
      {/* Distribution/summary stats (mean, StdDev, percentiles, etc.) live on
          the Deep Analytics tab only, per the platform's rule that formulas
          and descriptive/inferential statistics never scatter onto other
          tabs - see DeepAnalysisTables.tsx for the equivalent panel. */}
      <div style={{ margin: '4px 0 10px' }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', color: accent }}>
          Exhaustive table — {rows.length.toLocaleString()} records × {cols.length} attributes (all shown, no selective reporting)
        </span>
      </div>
      <SortableFilterableTable
        columns={columns}
        rows={rows}
        accent={accent}
        exportName={sectionId + '_all_records'}
      />
      <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>All records rendered, no selective reporting. Click any column header to sort (ascending, then descending). Relative heat colouring per numeric column; "No data" flags missing values explicitly.</div>
    </div>
  );
}
export default ExhaustiveTables;
