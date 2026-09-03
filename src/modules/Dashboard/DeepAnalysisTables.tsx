import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { mean, stdDevPop, stdError, quantile as q, mode as modeOf, skewness, kurtosis, ci95,
  pearsonTest, oneWayAnova, chiSquareTest, sigStars } from '../../shared/statsUtils';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';
import { RoadClassPill, ConditionLabelBadge } from '../../shared/tableFormatting';
import { MAINTENANCE_REGIONS } from '../AssetBot/linkIdKnowledge';

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
// Table names corrected to match scripts/etl_all.py's real load targets - see
// the identical note in ExhaustiveTables.tsx. The old names
// pointed at tables that were never created in the live project, so this
// "analysed in full" view was always silently substituting the static
// GeoJSON fallback below for a live query result. 'reserve'/'pim' dropped
// (no real source dataset yet); budget/growthfactors/overloading/bridgeworks
// added (real ETL-backed data exists for these).
const SPECS: Record<string, string> = {
  rms: 'road_links', pms: 'road_link_condition', tis: 'traffic_count_stations',
  bms: 'structures', ducar: 'maintenance_programme', projects: 'maintenance_programme',
  budget: 'budget_alignment', growthfactors: 'traffic_growth_factors',
  overloading: 'overloading_by_link', bridgeworks: 'bridge_works',
};
// Fetches every row in `table`, paginating past PostgREST's ~1000-row-per-request
// cap so the "analysed in full" claim below is actually true, not a capped sample.
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
// road_links, with a generic traffic geojson fallback on top) means this
// view honestly says "no dataset wired" rather than mislabeling another
// section's records - e.g. traffic AADT data - as this section's own.
async function loadRows(sectionId: string): Promise<Row[]> {
  const table = SPECS[sectionId];
  if (!table) return [];
  try {
    const q = fetchAllRows(table);
    const t = new Promise<null>(res => setTimeout(() => res(null), 9000));
    const data = await Promise.race([q, t]);
    return (data ?? []) as Row[];
  } catch { return [] as Row[]; }
}
const num = (v: unknown): number | null => { if (typeof v === 'number' && isFinite(v)) return v; if (typeof v === 'string' && v !== '' && isFinite(Number(v))) return Number(v); return null; };
const fmtN = (n: number, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });
// Relative heat colouring (per-table, 0..1 -> cool green through hot red).
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
function SigBadge({ p }: { p: number }) {
  const stars = sigStars(p);
  return (
    <span style={{ color: stars ? '#00ff88' : '#94a3b8', fontWeight: 800 }}>{stars || 'n.s.'}</span>
  );
}
// "name" already catches surveyor_name/inspector_name/contact_name/etc.;
// the *_by fields and contact/email/phone are added explicitly since they
// don't contain "name" but still identify an individual person.
const EXCL = /lat|lng|lon|^x$|^y$|id$|_id|code|^no$|road_no|name|date|submitted_by|recorded_by|prepared_by|reported_by|approved_by|reviewed_by|decided_by|created_by|updated_by|contact|email|phone|mobile/i;

function Card({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(10,16,32,0.72)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', color: accent }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ─── Descriptive statistics row ────────────────────────────────────────────
interface StatRow {
  attr: string; count: number; sum: number; mean: number; mode: number | null;
  min: number; p25: number; median: number; p75: number; max: number;
  range: number; iqr: number; variance: number; stdDev: number; cv: number;
  se: number; ci: string; skewness: number; kurtosis: number;
}
function DescriptiveStatsCard({ accent, nums, rows, sectionId }: { accent: string; nums: string[]; rows: Row[]; sectionId: string }) {
  const statRows: StatRow[] = useMemo(() => nums.map(c => {
    const v = rows.map(r => num(r[c])).filter((x): x is number => x != null).sort((a, b) => a - b);
    if (!v.length) return null;
    const sum = v.reduce((a, b) => a + b, 0);
    const m = mean(v);
    const sd = stdDevPop(v, m);
    const [ciLo, ciHi] = ci95(v);
    const p25 = q(v, 0.25), p75 = q(v, 0.75), min = v[0] ?? 0, max = v[v.length - 1] ?? 0;
    return {
      attr: prettyLabel(c), count: v.length, sum, mean: m, mode: modeOf(v) ?? null,
      min, p25, median: q(v, 0.5), p75, max, range: max - min, iqr: p75 - p25,
      variance: sd * sd, stdDev: sd, cv: m ? (sd / m) * 100 : 0, se: stdError(v),
      ci: `[${fmtN(ciLo, 1)}, ${fmtN(ciHi, 1)}]`, skewness: skewness(v, m), kurtosis: kurtosis(v, m),
    };
  }).filter((r): r is StatRow => r != null), [nums, rows]);

  const columns: STColumn<StatRow>[] = [
    { key: 'attr', label: 'Attribute' },
    { key: 'count', label: 'Count', numeric: true, render: r => fmtN(r.count) },
    { key: 'sum', label: 'Sum', numeric: true, render: r => fmtN(r.sum) },
    { key: 'mean', label: 'Mean', numeric: true, render: r => fmtN(r.mean, 1) },
    { key: 'mode', label: 'Mode', numeric: true, render: r => r.mode != null ? fmtN(r.mode, 1) : '—' },
    { key: 'min', label: 'Min', numeric: true, render: r => fmtN(r.min, 1) },
    { key: 'p25', label: 'P25', numeric: true, render: r => fmtN(r.p25, 1) },
    { key: 'median', label: 'Median', numeric: true, render: r => <span style={{ color: '#ffd23f', fontWeight: 800 }}>{fmtN(r.median, 1)}</span> },
    { key: 'p75', label: 'P75', numeric: true, render: r => fmtN(r.p75, 1) },
    { key: 'max', label: 'Max', numeric: true, render: r => fmtN(r.max, 1) },
    { key: 'range', label: 'Range', numeric: true, render: r => fmtN(r.range, 1) },
    { key: 'iqr', label: 'IQR', numeric: true, render: r => fmtN(r.iqr, 1) },
    { key: 'variance', label: 'Variance', numeric: true, render: r => fmtN(r.variance, 1) },
    { key: 'stdDev', label: 'Std Dev', numeric: true, render: r => fmtN(r.stdDev, 1) },
    { key: 'cv', label: 'CV %', numeric: true, render: r => <span style={heatStyle(Math.min(1, r.cv / 150))}>{fmtN(r.cv, 1)}%</span> },
    { key: 'se', label: 'SE', numeric: true, render: r => fmtN(r.se, 2) },
    { key: 'ci', label: '95% CI (mean)' },
    { key: 'skewness', label: 'Skewness', numeric: true, render: r => fmtN(r.skewness, 2) },
    { key: 'kurtosis', label: 'Kurtosis', numeric: true, render: r => fmtN(r.kurtosis, 2) },
  ];

  return (
    <Card title={`Descriptive statistics — all ${nums.length} numeric attributes (${rows.length.toLocaleString()} records)`} accent={accent}>
      <SortableFilterableTable columns={columns} rows={statRows} accent={accent} exportName={sectionId + '_numeric_stats'} initialSort="attr" />
      <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>Formulas: Mean = Sum/Count; Variance/StdDev = population (÷N); SE and 95% CI use the sample convention (÷N-1, z≈1.96); Skewness/Kurtosis are sample, bias-corrected; Pxx by linear interpolation on the full sorted series.</div>
    </Card>
  );
}

// ─── Correlation & significance matrix ─────────────────────────────────────
interface CorrRow { a: string; b: string; r: number; n: number; p: number; sig: string; }
function CorrelationCard({ accent, nums, rows, sectionId }: { accent: string; nums: string[]; rows: Row[]; sectionId: string }) {
  const corrRows: CorrRow[] = useMemo(() => {
    const series = nums.map(c => rows.map(r => num(r[c])).filter((x): x is number => x != null));
    const pairs: CorrRow[] = [];
    for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) {
      const res = pearsonTest(series[i], series[j]);
      pairs.push({ a: prettyLabel(nums[i]), b: prettyLabel(nums[j]), r: res.r, n: res.n, p: res.p, sig: sigStars(res.p) || 'n.s.' });
    }
    return pairs;
  }, [nums, rows]);

  const columns: STColumn<CorrRow>[] = [
    { key: 'a', label: 'Attribute A' },
    { key: 'b', label: 'Attribute B' },
    { key: 'r', label: 'Pearson r', numeric: true, render: row => <span style={heatStyle((row.r + 1) / 2)}>{row.r.toFixed(3)}</span> },
    { key: 'n', label: 'n', numeric: true, render: row => fmtN(row.n) },
    { key: 'p', label: 'p-value', numeric: true, render: row => row.p < 0.001 ? '<0.001' : row.p.toFixed(3) },
    { key: 'sig', label: 'Significance', render: row => <SigBadge p={row.p} /> },
  ];

  return (
    <Card title={`Inferential: correlation & significance matrix — ${nums.length} numeric attributes (${corrRows.length} pairs)`} accent={accent}>
      <SortableFilterableTable columns={columns} rows={corrRows} accent={accent} exportName={sectionId + '_correlation_matrix'} initialSort="r" />
      <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>Pearson r with a two-tailed t-test (df = n-2). * p&lt;0.05, ** p&lt;0.01, *** p&lt;0.001, n.s. = not significant. |r| ≥ 0.7 strong, 0.4-0.7 moderate, &lt;0.4 weak - regardless of significance, correlation is not causation.</div>
    </Card>
  );
}

// ─── Group analysis by category (+ nested one-way ANOVA) ───────────────────
interface GroupRow {
  key: string; count: number; share: number; kmAffected?: number; kmShare?: number;
  means: Record<string, number | null>;
}
interface AnovaRow { measure: string; groups: number; n: number; f: number; df: string; p: number; etaSq: number; }
function GroupAnalysisCard({ accent, cat, rows, nums, lenCol, sectionId }: {
  accent: string; cat: string; rows: Row[]; nums: string[]; lenCol: string | null; sectionId: string;
}) {
  const isRegionCat = /region/i.test(cat);
  const isClassCat = /class/i.test(cat);
  const isConditionCat = /condition|rating|status/i.test(cat) && !isClassCat;

  const { groupRows, statMeasures, anovaRows } = useMemo(() => {
    const groups = new Map<string, Row[]>();
    rows.forEach(r => { const k = String(r[cat] ?? 'Unknown'); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(r); });
    // Rule: all 6 maintenance regions always shown, even with zero records -
    // never a silently-dropped region because the dataset happens to have no
    // rows for it.
    if (isRegionCat) MAINTENANCE_REGIONS.forEach(r => { if (!groups.has(r.id)) groups.set(r.id, []); });
    const ents = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
    const N = rows.length;
    const kmTot = lenCol ? rows.reduce((a, r) => a + (num(r[lenCol]) ?? 0), 0) : 0;
    const measures = nums.slice(0, 5);
    const maxByMeasure: Record<string, number> = {};
    measures.forEach(m => { const all = rows.map(r => num(r[m])).filter((x): x is number => x != null); maxByMeasure[m] = Math.max(...all, 1); });

    const gRows: GroupRow[] = ents.map(([k, g]) => {
      const km = lenCol ? g.reduce((a, r) => a + (num(r[lenCol]) ?? 0), 0) : undefined;
      const means: Record<string, number | null> = {};
      measures.forEach(m => { const v = g.map(r => num(r[m])).filter((x): x is number => x != null);
        means[m] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; });
      return {
        key: k, count: g.length, share: N ? (g.length / N) * 100 : 0,
        kmAffected: km, kmShare: lenCol && kmTot ? (km! / kmTot) * 100 : undefined,
        means,
      };
    });

    const anovas: AnovaRow[] = nums.map(n => {
      const groupVals = ents.map(([, g]) => g.map(r => num(r[n])).filter((x): x is number => x != null));
      const res = oneWayAnova(groupVals);
      return { measure: prettyLabel(n), groups: res.groups, n: res.n, f: res.f, df: `${res.df1},${res.df2}`, p: res.p, etaSq: res.etaSq };
    }).filter(a => a.groups >= 2);

    return { groupRows: gRows, statMeasures: measures, anovaRows: anovas };
  }, [cat, rows, nums, lenCol, isRegionCat]);

  const maxCount = Math.max(...groupRows.map((g: GroupRow) => g.count), 1);

  const columns: STColumn<GroupRow>[] = [
    {
      key: 'key', label: prettyLabel(cat),
      render: row => {
        if (isClassCat) return <RoadClassPill cls={row.key} />;
        if (isConditionCat) return <ConditionLabelBadge label={row.key} />;
        return row.key;
      },
    },
    { key: 'count', label: 'Count', numeric: true, render: row => <span style={heatStyle(row.count / maxCount)}>{fmtN(row.count)}</span> },
    { key: 'share', label: 'Share %', numeric: true, render: row => `${row.share.toFixed(1)}%` },
    ...(lenCol ? [
      { key: 'kmAffected', label: 'Km affected', numeric: true, render: (row: GroupRow) => row.kmAffected != null ? fmtN(row.kmAffected, 1) : <span style={{ color: 'rgba(148,163,184,0.5)', fontStyle: 'italic' }}>No data</span> } as STColumn<GroupRow>,
      { key: 'kmShare', label: 'Km share %', numeric: true, render: (row: GroupRow) => row.kmShare != null ? `${row.kmShare.toFixed(1)}%` : '-' } as STColumn<GroupRow>,
    ] : []),
    ...statMeasures.map((m: string): STColumn<GroupRow> => ({
      key: ('mean_' + m) as any,
      label: 'Mean ' + prettyLabel(m),
      numeric: true,
      render: (row: GroupRow) => {
        const v = row.means[m];
        if (v == null) return <span style={{ color: 'rgba(148,163,184,0.5)', fontStyle: 'italic' }}>No data</span>;
        return fmtN(v, 1);
      },
    })),
  ];
  // Flatten mean_<measure> accessors onto each row so SortableFilterableTable's
  // generic `row[c.key]` sort/filter access (used when a column has no custom
  // sort logic) works for the synthetic per-measure mean columns too.
  const flatRows = groupRows.map((r: GroupRow) => {
    const flat: Record<string, any> = { ...r };
    statMeasures.forEach((m: string) => { flat['mean_' + m] = r.means[m]; });
    return flat;
  });

  return (
    <Card title={`Group analysis by ${prettyLabel(cat)} — ${groupRows.length} categories × ${rows.length.toLocaleString()} records`} accent={accent}>
      <SortableFilterableTable columns={columns as STColumn<any>[]} rows={flatRows} accent={accent} exportName={sectionId + '_by_' + cat} initialSort="count" />
      {anovaRows.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', color: 'rgba(148,163,184,0.9)', marginBottom: 6 }}>
            Inferential: one-way ANOVA — does {prettyLabel(cat)} significantly affect each measure?
          </div>
          <AnovaTable accent={accent} anovaRows={anovaRows} sectionId={sectionId} cat={cat} />
        </div>
      )}
    </Card>
  );
}
function AnovaTable({ accent, anovaRows, sectionId, cat }: { accent: string; anovaRows: AnovaRow[]; sectionId: string; cat: string }) {
  const columns: STColumn<AnovaRow>[] = [
    { key: 'measure', label: 'Measure' },
    { key: 'groups', label: 'Groups', numeric: true, render: r => fmtN(r.groups) },
    { key: 'n', label: 'n', numeric: true, render: r => fmtN(r.n) },
    { key: 'f', label: 'F-statistic', numeric: true, render: r => fmtN(r.f, 2) },
    { key: 'df', label: 'df' },
    { key: 'p', label: 'p-value', numeric: true, render: r => r.p < 0.001 ? '<0.001' : r.p.toFixed(3) },
    { key: 'sig' as any, label: 'Significance', render: r => <SigBadge p={r.p} /> },
    { key: 'etaSq', label: 'η² (effect size)', numeric: true, render: r => <span style={heatStyle(r.etaSq)}>{r.etaSq.toFixed(3)}</span> },
  ];
  return (
    <>
      <SortableFilterableTable columns={columns} rows={anovaRows} accent={accent} exportName={sectionId + '_anova_' + cat} initialSort="etaSq" />
      <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>F-test on between-group vs within-group variance. * p&lt;0.05, ** p&lt;0.01, *** p&lt;0.001, n.s. = not significant. η² is the share of total variance explained by the grouping (0.01 small, 0.06 medium, 0.14+ large).</div>
    </>
  );
}

// ─── Cross-relation matrix (pivot table) ────────────────────────────────────
function CrossRelationCard({ accent, a, b, rows, sectionId }: { accent: string; a: string; b: string; rows: Row[]; sectionId: string }) {
  const { pivotRows, columns, chi } = useMemo(() => {
    const ka = [...new Set(rows.map(r => String(r[a] ?? 'Unknown')))];
    const kb = [...new Set(rows.map(r => String(r[b] ?? 'Unknown')))];
    const cell = new Map<string, number>(); let mx = 1;
    rows.forEach(r => { const k = String(r[a] ?? 'Unknown') + '|' + String(r[b] ?? 'Unknown');
      const v = (cell.get(k) ?? 0) + 1; cell.set(k, v); if (v > mx) mx = v; });
    const table = ka.map(ra => kb.map(cb => cell.get(ra + '|' + cb) ?? 0));
    const chiRes = chiSquareTest(table);
    const pv: Row[] = ka.map(ra => {
      const row: Row = { category: ra };
      let total = 0;
      kb.forEach(cb => { const v = cell.get(ra + '|' + cb) ?? 0; row[cb] = v; total += v; });
      row.Total = total;
      return row;
    });
    const cols: STColumn<Row>[] = [
      { key: 'category', label: prettyLabel(a) },
      ...kb.map((cb): STColumn<Row> => ({
        key: cb, label: cb, numeric: true,
        render: (row: Row) => { const v = Number(row[cb]) || 0;
          return v ? <span style={heatStyle(v / mx)}>{v}</span> : <span style={{ color: 'rgba(148,163,184,0.4)' }}>-</span>; },
      })),
      { key: 'Total', label: 'Total', numeric: true, render: (row: Row) => <span style={{ fontWeight: 800, color: '#e2e8f0' }}>{fmtN(Number(row.Total) || 0)}</span> },
    ];
    return { pivotRows: pv, columns: cols, chi: chiRes };
  }, [a, b, rows]);

  return (
    <Card title={`Cross-relation matrix — ${prettyLabel(a)} × ${prettyLabel(b)} (record counts, all data)`} accent={accent}>
      <SortableFilterableTable columns={columns} rows={pivotRows} accent={accent} exportName={sectionId + '_cross_' + a + '_' + b} initialSort="Total" />
      <div style={{ marginTop: 10, fontSize: 10.5 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', color: 'rgba(148,163,184,0.9)', marginBottom: 4 }}>
          Inferential: chi-square test of independence
        </div>
        <div style={{ color: '#cbd5e1' }}>
          χ² = <b style={{ color: '#e2e8f0' }}>{fmtN(chi.chi2, 2)}</b>, df = {chi.df}, n = {fmtN(chi.n)}, p-value = {chi.p < 0.001 ? '<0.001' : chi.p.toFixed(3)}{' '}
          (<span style={{ color: sigStars(chi.p) ? '#00ff88' : '#94a3b8', fontWeight: 700 }}>{sigStars(chi.p) || 'not significant'}</span>),
          Cramér's V = {chi.cramerV.toFixed(3)} ({chi.cramerV < 0.1 ? 'negligible' : chi.cramerV < 0.3 ? 'weak' : chi.cramerV < 0.5 ? 'moderate' : 'strong'} association)
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>Tests whether {prettyLabel(a)} and {prettyLabel(b)} are statistically independent, or whether one predicts the other. Cramér's V is the effect size (0 = no association, 1 = perfect).</div>
      </div>
    </Card>
  );
}

export function DeepAnalysisTables({ sectionId, accent = '#00f5ff' }: { sectionId: string; accent?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { let d = false; loadRows(sectionId).then(r => { if (!d) setRows(r); }); return () => { d = true; }; }, [sectionId]);
  const P = useMemo(() => {
    if (!rows || !rows.length) return null;
    const cols = Object.keys(rows[0]);
    const cats = cols.filter(c => { if (EXCL.test(c)) return false;
      const vals = rows.map(r => r[c]).filter(v => v != null && v !== '');
      if (!vals.length || num(vals[0]) != null) return false;
      return new Set(vals.map(String)).size <= 16; });
    // Any column with at least one real numeric value gets a distribution
    // row - no 50%-fill threshold that could quietly drop a sparsely-filled
    // but genuinely numeric attribute from the "exhaustive" stats below.
    const nums = cols.filter(c => !/lat|lng|lon|^x$|^y$|_id|^id$/i.test(c) && rows.some(r => num(r[c]) != null));
    const lenCol = cols.find(c => /length|km$|_km/i.test(c) && rows.some(r => num(r[c]) != null)) ?? null;
    return { cols, cats, nums, lenCol };
  }, [rows]);
  if (rows === null) return <div style={{ padding: 20, color: '#64748b', fontSize: 12 }}>Computing analysis…</div>;
  if (!rows.length || !P) return (
    <div style={{ padding: 16, color: '#64748b', fontSize: 12 }}>
      {sectionId in SPECS
        ? 'No data available yet.'
        : "This section isn't wired to a database table yet - see its Dashboard tab above for this section's real figures."}
    </div>
  );
  const N = rows.length;
  return (
    <div style={{ width: '100%' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', color: accent, margin: '4px 0 10px' }}>
        Deep analytics — {N.toLocaleString()} records analysed in full: group statistics, distributions, cross-relations
      </div>
      <DescriptiveStatsCard accent={accent} nums={P.nums} rows={rows} sectionId={sectionId} />
      {P.nums.length >= 2 && <CorrelationCard accent={accent} nums={P.nums} rows={rows} sectionId={sectionId} />}
      {P.cats.map(cat => (
        <GroupAnalysisCard key={cat} accent={accent} cat={cat} rows={rows} nums={P.nums} lenCol={P.lenCol} sectionId={sectionId} />
      ))}
      {P.cats.length >= 2 && (
        <CrossRelationCard accent={accent} a={P.cats[0]} b={P.cats[1]} rows={rows} sectionId={sectionId} />
      )}
    </div>
  );
}
export default DeepAnalysisTables;
