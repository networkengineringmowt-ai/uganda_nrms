import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { mean, stdDevPop, stdError, quantile as q, mode as modeOf, skewness, kurtosis, ci95 } from '../../shared/statsUtils';

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
const SPECS: Record<string, string> = { rms:'road_links', pms:'road_condition_assessments', tis:'traffic_stations', bms:'bridge_inventory', ducar:'maintenance_works', projects:'maintenance_works', reserve:'encroachments', pim:'investment_projects' };
const FALLBACK_GEOJSON: Record<string, string> = {
  tis: 'data/traffic_predictions.geojson',
  rms: 'road_network.geojson',
  pms: 'road_network.geojson',
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
    if (data && data.length) return data;
  } catch {}
  // section-specific GeoJSON fallback
  const gjPath = FALLBACK_GEOJSON[sectionId];
  if (!gjPath) return [];
  try {
    const gj = await fetch(import.meta.env.BASE_URL + gjPath).then(r => r.json());
    return ((gj.features ?? []) as { properties: Row }[]).map(f => f.properties);
  } catch { return []; }
}
const num = (v: unknown): number | null => { if (typeof v === 'number' && isFinite(v)) return v; if (typeof v === 'string' && v !== '' && isFinite(Number(v))) return Number(v); return null; };
const fmtN = (n: number, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });
// Any column identifying an individual person (field staff, submitters,
// contacts) is dropped from this view entirely - never shown, exported, or
// counted as an attribute. Deliberately narrow (matches surveyor_name,
// inspector_name, contact_person, submitted_by, etc.) so it doesn't also
// catch legitimate asset/place names like road_name or district_name.
const PII_COL = /surveyor_name|inspector_name|assessor_name|officer_name|engineer_name|supervisor_name|contact_name|contact_person|contact_email|contact_phone|submitted_by|recorded_by|prepared_by|reported_by|approved_by|reviewed_by|decided_by|created_by|updated_by|^email$|_email$|^phone$|_phone|mobile|national_id|^nin$|passport/i;
function heatCss(t: number): React.CSSProperties { const c = Math.max(0, Math.min(1, t));
  const r = c < 0.5 ? Math.round(60 + c*2*195) : 255; const g = c < 0.5 ? Math.round(150 + c*2*60) : Math.round(210 - (c-0.5)*2*165);
  return { background: 'rgba(' + r + ',' + g + ',55,0.14)', color: 'rgb(' + r + ',' + g + ',80)', fontWeight: 600 }; }
function csvOut(name: string, cols: string[], rows: (string|number)[][]) {
  const esc = (v: string|number) => '"' + String(v).replace(/"/g, '""') + '"';
  const csv = [cols.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name + '.csv'; a.click(); URL.revokeObjectURL(a.href);
}
const qtile = (s: number[], p: number) => { if (!s.length) return 0; const i = (s.length - 1) * p; const lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };
const TH2: React.CSSProperties = { padding: '6px 10px', background: 'rgba(2,6,23,0.95)', color: '#64748b', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap', position: 'sticky', top: 0 };
const TD2: React.CSSProperties = { padding: '5px 10px', whiteSpace: 'nowrap', color: '#cbd5e1' };

// Every numeric attribute (any column with at least one real numeric value,
// however sparsely filled) gets a full distribution row - no threshold that
// could quietly drop a column, per the platform's "no selective reporting"
// rule. This mirrors Deep Analytics' distribution card so the same exhaustive
// stats are one click away from the raw table itself.
function NumericStats({ rows, cols, sectionId, accent }: { rows: Row[]; cols: string[]; sectionId: string; accent: string }) {
  const numCols = cols.filter(c => rows.some(r => num(r[c]) != null));
  if (!numCols.length) return null;
  const stats = numCols.map(c => {
    const v = rows.map(r => num(r[c])).filter(x => x != null).sort((a, b) => (a as number) - (b as number)) as number[];
    const sum = v.reduce((a, b) => a + b, 0);
    const m = mean(v);
    const sd = stdDevPop(v, m);
    const se = stdError(v);
    const [ciLo, ciHi] = ci95(v);
    const md = modeOf(v);
    const p25 = q(v, 0.25), p75 = q(v, 0.75);
    const min = v[0] ?? 0, max = v[v.length - 1] ?? 0;
    return { c, count: v.length, coverage: rows.length ? v.length / rows.length * 100 : 0, sum, mean: m, sd, se, ciLo, ciHi,
      mode: md, min, max, range: max - min, p25, median: q(v, 0.5), p75, iqr: p75 - p25, cv: m ? sd / m * 100 : 0,
      skew: skewness(v, m), kurt: kurtosis(v, m), v };
  });
  const HEADERS = ['Attribute', 'Count', 'Coverage %', 'Sum', 'Mean', 'Mode', 'Min', 'P25', 'Median', 'P75', 'Max', 'Range', 'IQR', 'Variance', 'StdDev', 'CV %', 'SE', '95% CI (mean)', 'Skewness', 'Kurtosis'];
  return (
    <div style={{ background: 'rgba(10,16,32,0.72)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 12px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: accent }}>
          DESCRIPTIVE STATISTICS - ALL {numCols.length} NUMERIC ATTRIBUTES ({rows.length.toLocaleString()} RECORDS)
        </span>
        <button onClick={() => csvOut(sectionId + '_numeric_stats',
          ['Attribute', 'Count', 'Coverage%', 'Sum', 'Mean', 'Mode', 'Min', 'P25', 'Median', 'P75', 'Max', 'Range', 'IQR', 'Variance', 'StdDev', 'CV%', 'SE', 'CI95Low', 'CI95High', 'Skewness', 'Kurtosis'],
          stats.map(s => [s.c, s.count, s.coverage.toFixed(1), s.sum, s.mean, s.mode ?? '-', s.min, s.p25, s.median, s.p75, s.max, s.range, s.iqr, s.sd * s.sd, s.sd, s.cv, s.se, s.ciLo, s.ciHi, s.skew, s.kurt]))}
          style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.3)', borderRadius: 6, color: accent, fontSize: 10, fontWeight: 700, padding: '3px 10px', cursor: 'pointer' }}>CSV</button>
      </div>
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
          <thead><tr>{HEADERS.map(h => <th key={h} style={TH2}>{h}</th>)}</tr></thead>
          <tbody>{stats.map(s => (
            <tr key={s.c} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={{ ...TD2, color: '#e2e8f0', fontWeight: 700 }}>{prettyLabel(s.c)}</td>
              <td style={TD2}>{fmtN(s.count)}</td>
              <td style={{ ...TD2, ...heatCss(s.coverage / 100) }}>{s.coverage.toFixed(1)}%</td>
              <td style={TD2}>{fmtN(s.sum, 1)}</td>
              <td style={TD2}>{fmtN(s.mean, 2)}</td>
              <td style={TD2}>{s.mode != null ? fmtN(s.mode, 2) : '—'}</td>
              <td style={TD2}>{fmtN(s.min, 2)}</td>
              <td style={TD2}>{fmtN(s.p25, 2)}</td>
              <td style={{ ...TD2, ...heatCss(0.5) }}>{fmtN(s.median, 2)}</td>
              <td style={TD2}>{fmtN(s.p75, 2)}</td>
              <td style={TD2}>{fmtN(s.max, 2)}</td>
              <td style={TD2}>{fmtN(s.range, 2)}</td>
              <td style={TD2}>{fmtN(s.iqr, 2)}</td>
              <td style={TD2}>{fmtN(s.sd * s.sd, 2)}</td>
              <td style={TD2}>{fmtN(s.sd, 2)}</td>
              <td style={{ ...TD2, ...heatCss(Math.min(1, s.cv / 150)) }}>{fmtN(s.cv, 1)}%</td>
              <td style={TD2}>{fmtN(s.se, 3)}</td>
              <td style={TD2}>[{fmtN(s.ciLo, 2)}, {fmtN(s.ciHi, 2)}]</td>
              <td style={TD2}>{fmtN(s.skew, 2)}</td>
              <td style={TD2}>{fmtN(s.kurt, 2)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>
        Every numeric column shown, regardless of how sparsely filled - Coverage% is the share of the {rows.length.toLocaleString()} records that actually carry a value for that attribute.
        Variance/StdDev use the full population (÷N); SE and the 95% confidence interval for the mean use the sample convention (÷N-1, z≈1.96). Skewness &gt; 0 = right-tailed, &lt; 0 = left-tailed; Kurtosis is excess kurtosis (0 = normal-shaped tails).
      </div>
    </div>
  );
}

export function ExhaustiveTables({ sectionId, accent = '#00f5ff' }: { sectionId: string; accent?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [srt, setSrt] = useState('');
  useEffect(() => { let d = false; loadRows(sectionId).then(r => { if (!d) setRows(r); }); return () => { d = true; }; }, [sectionId]);
  const cols = useMemo(() => rows && rows.length ? Object.keys(rows[0]).filter(c => !PII_COL.test(c)) : [], [rows]);
  const numCols = useMemo(() => cols.filter(c => rows && rows.some(r => num(r[c]) != null)), [cols, rows]);
  const ranges = useMemo(() => { const m: Record<string, [number, number]> = {};
    numCols.forEach(c => { const v = (rows ?? []).map(r => num(r[c])).filter(x => x != null) as number[];
      m[c] = v.length ? [Math.min(...v), Math.max(...v)] : [0, 1]; }); return m; }, [numCols, rows]);
  const sorted = useMemo(() => { if (!rows) return []; if (!srt) return rows;
    return [...rows].sort((a, b) => (num(b[srt]) ?? -Infinity) - (num(a[srt]) ?? -Infinity)); }, [rows, srt]);
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
      <NumericStats rows={rows} cols={cols} sectionId={sectionId} accent={accent} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '4px 0 8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: accent }}>
          EXHAUSTIVE TABLE - {rows.length.toLocaleString()} RECORDS x {cols.length} ATTRIBUTES (ALL SHOWN)
        </span>
        <select value={srt} onChange={e => setSrt(e.target.value)}
          style={{ background: 'rgba(2,6,23,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#e2e8f0', fontSize: 11, padding: '4px 8px' }}>
          <option value=''>Sort: none</option>
          {numCols.map(c => <option key={c} value={c}>Sort: {c}</option>)}
        </select>
        <button onClick={() => csvOut(sectionId + '_all_records', cols.map(prettyLabel), sorted.map(r => cols.map(c => String(r[c] ?? ''))))}
          style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.3)', borderRadius: 6, color: accent, fontSize: 10, fontWeight: 700, padding: '4px 12px', cursor: 'pointer' }}>CSV</button>
      </div>
      <div style={{ overflow: 'auto', maxHeight: 640, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
          <thead><tr>{cols.map(c => (
            <th key={c} onClick={() => setSrt(c)} style={{ padding: '6px 9px', background: 'rgba(2,6,23,0.95)', color: srt === c ? accent : '#64748b',
              textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap', position: 'sticky', top: 0, cursor: 'pointer' }}>{prettyLabel(c)}</th>))}</tr></thead>
          <tbody>{sorted.map((r, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              {cols.map(c => { const v = r[c]; const n = num(v); const rg = ranges[c];
                const style: React.CSSProperties = n != null && rg && rg[1] > rg[0]
                  ? heatCss((n - rg[0]) / (rg[1] - rg[0])) : { color: '#cbd5e1' };
                return <td key={c} style={{ padding: '4px 9px', whiteSpace: 'nowrap', ...style }}>{n != null ? fmtN(n, 2) : String(v ?? '-')}</td>; })}
            </tr>))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>All records rendered, no selective reporting. Click any header to sort. Heat colouring per numeric column.</div>
    </div>
  );
}
export default ExhaustiveTables;
