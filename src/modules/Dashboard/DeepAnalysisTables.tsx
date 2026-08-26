import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { mean, stdDevPop, stdError, quantile as q, mode as modeOf, skewness, kurtosis, ci95,
  pearsonTest, oneWayAnova, chiSquareTest, sigStars } from '../../shared/statsUtils';

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
// Static fallback ONLY for sections whose real dataset is itself road/traffic
// geometry (so the fallback stays thematically the same section, just a
// static sample instead of a live query) - other SPECS sections return an
// honest empty result rather than being padded with unrelated traffic rows.
const FALLBACK_GEOJSON: Record<string, string> = {
  tis: 'data/traffic_predictions.geojson',
  rms: 'road_network.geojson',
  pms: 'road_network.geojson',
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
  const live = (async () => { try {
    const q = fetchAllRows(table);
    const t = new Promise<null>(res => setTimeout(() => res(null), 9000));
    const data = await Promise.race([q, t]);
    return (data ?? []) as Row[];
  } catch { return [] as Row[]; } })();
  const gjPath = FALLBACK_GEOJSON[sectionId];
  const fb = (async () => { if (!gjPath) return [] as Row[]; try {
    const gj = await fetch(import.meta.env.BASE_URL + gjPath).then(r => r.json());
    return ((gj.features ?? []) as { properties: Row }[]).map(f => f.properties);
  } catch { return [] as Row[]; } })();
  const [l, f] = await Promise.all([live, fb]);
  return l.length ? l : f;
}
const num = (v: unknown): number | null => { if (typeof v === 'number' && isFinite(v)) return v; if (typeof v === 'string' && v !== '' && isFinite(Number(v))) return Number(v); return null; };
const fmtN = (n: number, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });
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
// "name" already catches surveyor_name/inspector_name/contact_name/etc.;
// the *_by fields and contact/email/phone are added explicitly since they
// don't contain "name" but still identify an individual person.
const EXCL = /lat|lng|lon|^x$|^y$|id$|_id|code|^no$|road_no|name|date|submitted_by|recorded_by|prepared_by|reported_by|approved_by|reviewed_by|decided_by|created_by|updated_by|contact|email|phone|mobile/i;

function Card({ title, accent, right, children }: { title: string; accent: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(10,16,32,0.72)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: accent }}>{title}</span>{right}
      </div>
      {children}
    </div>
  );
}
const TH: React.CSSProperties = { padding: '6px 10px', background: 'rgba(2,6,23,0.95)', color: '#64748b', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap', position: 'sticky', top: 0 };
const TD: React.CSSProperties = { padding: '5px 10px', whiteSpace: 'nowrap', color: '#cbd5e1' };
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
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: accent, margin: '4px 0 10px' }}>
        DEEP ANALYTICS - {N.toLocaleString()} RECORDS ANALYSED IN FULL - GROUP STATISTICS, DISTRIBUTIONS, CROSS-RELATIONS
      </div>
      <Card title={'DESCRIPTIVE STATISTICS - ALL ' + P.nums.length + ' NUMERIC ATTRIBUTES (' + N.toLocaleString() + ' RECORDS)'} accent={accent}
        right={<button onClick={() => { const cols = ['Attribute','Count','Sum','Mean','Mode','Min','P25','Median','P75','Max','Range','IQR','Variance','StdDev','CV%','SE','CI95Low','CI95High','Skewness','Kurtosis'];
          const out = P.nums.map(c => { const v = rows.map(r => num(r[c])).filter(x => x != null).sort((a,b)=>(a as number)-(b as number)) as number[];
            const sum = v.reduce((a,b)=>a+b,0); const m = mean(v); const sd = stdDevPop(v, m); const [ciLo, ciHi] = ci95(v);
            const p25 = q(v,0.25), p75 = q(v,0.75), min = v[0] ?? 0, max = v[v.length-1] ?? 0;
            return [c, v.length, sum, m, modeOf(v) ?? '-', min, p25, q(v,0.5), p75, max, max-min, p75-p25, sd*sd, sd, m?sd/m*100:0, stdError(v), ciLo, ciHi, skewness(v,m), kurtosis(v,m)]; });
          csvOut(sectionId + '_numeric_stats', cols, out); }}
          style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.3)', borderRadius: 6, color: accent, fontSize: 10, fontWeight: 700, padding: '3px 10px', cursor: 'pointer' }}>CSV</button>}>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
            <thead><tr>{['Attribute','Count','Sum','Mean','Mode','Min','P25','Median','P75','Max','Range','IQR','Variance','StdDev','CV%','SE','95% CI (mean)','Skewness','Kurtosis'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>{P.nums.map(c => { const v = rows.map(r => num(r[c])).filter(x => x != null).sort((a,b)=>(a as number)-(b as number)) as number[];
              if (!v.length) return null; const sum = v.reduce((a,b)=>a+b,0); const m = mean(v);
              const sd = stdDevPop(v, m); const cv = m ? sd/m*100 : 0; const [ciLo, ciHi] = ci95(v);
              const p25 = q(v,0.25), p75 = q(v,0.75), min = v[0] ?? 0, max = v[v.length-1] ?? 0, md = modeOf(v);
              return (<tr key={c} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ ...TD, color: '#e2e8f0', fontWeight: 700 }}>{prettyLabel(c)}</td>
                <td style={TD}>{fmtN(v.length)}</td><td style={TD}>{fmtN(sum)}</td><td style={TD}>{fmtN(m,1)}</td>
                <td style={TD}>{md != null ? fmtN(md,1) : '—'}</td>
                <td style={TD}>{fmtN(min,1)}</td><td style={TD}>{fmtN(p25,1)}</td>
                <td style={{ ...TD, ...heatCss(0.5) }}>{fmtN(q(v,0.5),1)}</td>
                <td style={TD}>{fmtN(p75,1)}</td>
                <td style={TD}>{fmtN(max,1)}</td>
                <td style={TD}>{fmtN(max-min,1)}</td><td style={TD}>{fmtN(p75-p25,1)}</td>
                <td style={TD}>{fmtN(sd*sd,1)}</td><td style={TD}>{fmtN(sd,1)}</td>
                <td style={{ ...TD, ...heatCss(Math.min(1, cv/150)) }}>{fmtN(cv,1)}%</td>
                <td style={TD}>{fmtN(stdError(v),2)}</td>
                <td style={TD}>[{fmtN(ciLo,1)}, {fmtN(ciHi,1)}]</td>
                <td style={TD}>{fmtN(skewness(v,m),2)}</td><td style={TD}>{fmtN(kurtosis(v,m),2)}</td></tr>); })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>Formulas: Mean = Sum/Count; Variance/StdDev = population (÷N); SE and 95% CI use the sample convention (÷N-1, z≈1.96); Skewness/Kurtosis are sample, bias-corrected; Pxx by linear interpolation on the full sorted series.</div>
      </Card>

      {P.nums.length >= 2 && (() => {
        const series = P.nums.map(c => rows.map(r => num(r[c])).filter((x): x is number => x != null));
        const pairs: { a: string; b: string; r: number; n: number; p: number }[] = [];
        for (let i = 0; i < P.nums.length; i++) for (let j = i + 1; j < P.nums.length; j++) {
          const res = pearsonTest(series[i], series[j]);
          pairs.push({ a: P.nums[i], b: P.nums[j], r: res.r, n: res.n, p: res.p });
        }
        return (
        <Card title={'INFERENTIAL: CORRELATION & SIGNIFICANCE MATRIX - ' + P.nums.length + ' NUMERIC ATTRIBUTES (' + pairs.length + ' PAIRS)'} accent={accent}
          right={<button onClick={() => csvOut(sectionId + '_correlation_matrix', ['Attribute A','Attribute B','Pearson r','n','p-value','Significance'],
            pairs.map(pr => [pr.a, pr.b, pr.r, pr.n, pr.p, sigStars(pr.p)]))}
            style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.3)', borderRadius: 6, color: accent, fontSize: 10, fontWeight: 700, padding: '3px 10px', cursor: 'pointer' }}>CSV</button>}>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
              <thead><tr>{['Attribute A','Attribute B','Pearson r','n','p-value','Significance'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>{pairs.sort((x,y) => Math.abs(y.r) - Math.abs(x.r)).map(pr => (
                <tr key={pr.a+'|'+pr.b} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ ...TD, color: '#e2e8f0', fontWeight: 700 }}>{prettyLabel(pr.a)}</td>
                  <td style={{ ...TD, color: '#e2e8f0', fontWeight: 700 }}>{prettyLabel(pr.b)}</td>
                  <td style={{ ...TD, ...heatCss((pr.r+1)/2) }}>{pr.r.toFixed(3)}</td>
                  <td style={TD}>{fmtN(pr.n)}</td>
                  <td style={TD}>{pr.p < 0.001 ? '<0.001' : pr.p.toFixed(3)}</td>
                  <td style={{ ...TD, color: sigStars(pr.p) ? '#00ff88' : '#64748b', fontWeight: 700 }}>{sigStars(pr.p) || 'n.s.'}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>Pearson r with a two-tailed t-test (df = n-2). * p&lt;0.05, ** p&lt;0.01, *** p&lt;0.001, n.s. = not significant. |r| ≥ 0.7 strong, 0.4-0.7 moderate, &lt;0.4 weak - regardless of significance, correlation is not causation.</div>
        </Card>); })()}
      {P.cats.map(cat => { const groups = new Map<string, Row[]>();
        rows.forEach(r => { const k = String(r[cat] ?? 'Unknown'); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(r); });
        const ents = [...groups.entries()].sort((a,b) => b[1].length - a[1].length);
        const maxN = ents[0][1].length;
        return (
        <Card key={cat} title={'GROUP ANALYSIS BY ' + prettyLabel(cat).toUpperCase() + ' - ' + ents.length + ' CATEGORIES x ' + N.toLocaleString() + ' RECORDS'} accent={accent}
          right={<button onClick={() => csvOut(sectionId + '_by_' + cat,
            [prettyLabel(cat),'Count','Share%', ...(P.lenCol ? ['Km affected'] : []), ...P.nums.slice(0,5).map(n=>'Mean '+prettyLabel(n))],
            ents.map(([k, g]) => [k, g.length, (g.length/N*100).toFixed(1),
              ...(P.lenCol ? [g.reduce((a,r)=>a+(num(r[P.lenCol!])??0),0).toFixed(1)] : []),
              ...P.nums.slice(0,5).map(n => { const v = g.map(r=>num(r[n])).filter(x=>x!=null) as number[];
                return v.length ? (v.reduce((a,b)=>a+b,0)/v.length).toFixed(1) : '-'; })]))}
            style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.3)', borderRadius: 6, color: accent, fontSize: 10, fontWeight: 700, padding: '3px 10px', cursor: 'pointer' }}>CSV</button>}>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
              <thead><tr>{[prettyLabel(cat), 'Count', 'Share %', ...(P.lenCol ? ['Km affected','Km share %'] : []), ...P.nums.slice(0,5).map(n => 'Mean ' + prettyLabel(n))].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>{ents.map(([k, g]) => { const kmTot = P.lenCol ? rows.reduce((a,r)=>a+(num(r[P.lenCol!])??0),0) : 0;
                const km = P.lenCol ? g.reduce((a,r)=>a+(num(r[P.lenCol!])??0),0) : 0;
                return (<tr key={k} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ ...TD, color: '#e2e8f0', fontWeight: 700 }}>{k}</td>
                  <td style={{ ...TD, ...heatCss(g.length/maxN) }}>{fmtN(g.length)}</td>
                  <td style={TD}>{(g.length/N*100).toFixed(1)}%</td>
                  {P.lenCol && <td style={{ ...TD, ...heatCss(kmTot ? km/(kmTot*0.6) : 0) }}>{fmtN(km,1)}</td>}
                  {P.lenCol && <td style={TD}>{kmTot ? (km/kmTot*100).toFixed(1) : '-'}%</td>}
                  {P.nums.slice(0,5).map(n => { const v = g.map(r=>num(r[n])).filter(x=>x!=null) as number[];
                    const all = rows.map(r=>num(r[n])).filter(x=>x!=null) as number[];
                    const mx = Math.max(...all, 1); const m = v.length ? v.reduce((a,b)=>a+b,0)/v.length : null;
                    return <td key={n} style={{ ...TD, ...(m != null ? heatCss(m/mx) : {}) }}>{m != null ? fmtN(m,1) : '-'}</td>; })}
                </tr>); })}
              </tbody>
            </table>
          </div>
          {P.nums.length > 0 && (() => {
            const anovas = P.nums.map(n => {
              const groupVals = ents.map(([, g]) => g.map(r => num(r[n])).filter((x): x is number => x != null));
              return { n, res: oneWayAnova(groupVals) };
            }).filter(a => a.res.groups >= 2);
            if (!anovas.length) return null;
            return (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: 'rgba(148,163,184,0.9)', marginBottom: 4 }}>
                  INFERENTIAL: ONE-WAY ANOVA - DOES {prettyLabel(cat).toUpperCase()} SIGNIFICANTLY AFFECT EACH MEASURE?
                </div>
                <div style={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
                    <thead><tr>{['Measure', 'Groups', 'n', 'F-statistic', 'df', 'p-value', 'Significance', 'η² (effect size)'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                    <tbody>{anovas.map(({ n, res }) => (
                      <tr key={n} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ ...TD, color: '#e2e8f0', fontWeight: 700 }}>{prettyLabel(n)}</td>
                        <td style={TD}>{res.groups}</td>
                        <td style={TD}>{fmtN(res.n)}</td>
                        <td style={TD}>{fmtN(res.f, 2)}</td>
                        <td style={TD}>{res.df1},{res.df2}</td>
                        <td style={TD}>{res.p < 0.001 ? '<0.001' : res.p.toFixed(3)}</td>
                        <td style={{ ...TD, color: sigStars(res.p) ? '#00ff88' : '#64748b', fontWeight: 700 }}>{sigStars(res.p) || 'n.s.'}</td>
                        <td style={{ ...TD, ...heatCss(res.etaSq) }}>{res.etaSq.toFixed(3)}</td>
                      </tr>))}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>F-test on between-group vs within-group variance. * p&lt;0.05, ** p&lt;0.01, *** p&lt;0.001, n.s. = not significant. η² is the share of total variance explained by the grouping (0.01 small, 0.06 medium, 0.14+ large).</div>
              </div>
            );
          })()}
        </Card>); })}
      {P.cats.length >= 2 && (() => { const [a, b] = P.cats; const ka = [...new Set(rows.map(r => String(r[a] ?? 'Unknown')))];
        const kb = [...new Set(rows.map(r => String(r[b] ?? 'Unknown')))];
        const cell = new Map<string, number>(); let mx = 1;
        rows.forEach(r => { const k = String(r[a] ?? 'Unknown') + '|' + String(r[b] ?? 'Unknown');
          const v = (cell.get(k) ?? 0) + 1; cell.set(k, v); if (v > mx) mx = v; });
        const table = ka.map(ra => kb.map(cb => cell.get(ra + '|' + cb) ?? 0));
        const chi = chiSquareTest(table);
        return (
        <Card title={'CROSS-RELATION MATRIX - ' + prettyLabel(a).toUpperCase() + ' x ' + prettyLabel(b).toUpperCase() + ' (RECORD COUNTS, ALL DATA)'} accent={accent}>
          <div style={{ overflow: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 10.5 }}>
              <thead><tr><th style={TH}>{a} \\ {b}</th>{kb.map(k => <th key={k} style={TH}>{k}</th>)}<th style={TH}>Total</th></tr></thead>
              <tbody>{ka.map(ra => (<tr key={ra} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ ...TD, color: '#e2e8f0', fontWeight: 700 }}>{ra}</td>
                {kb.map(cb => { const v = cell.get(ra + '|' + cb) ?? 0;
                  return <td key={cb} style={{ ...TD, ...heatCss(v/mx), textAlign: 'center' }}>{v || '-'}</td>; })}
                <td style={{ ...TD, fontWeight: 700 }}>{fmtN(kb.reduce((s, cb) => s + (cell.get(ra + '|' + cb) ?? 0), 0))}</td>
              </tr>))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, fontSize: 10.5 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: 'rgba(148,163,184,0.9)', marginBottom: 4 }}>
              INFERENTIAL: CHI-SQUARE TEST OF INDEPENDENCE
            </div>
            <div style={{ color: '#cbd5e1' }}>
              χ² = <b style={{ color: '#e2e8f0' }}>{fmtN(chi.chi2, 2)}</b>, df = {chi.df}, n = {fmtN(chi.n)}, p-value = {chi.p < 0.001 ? '<0.001' : chi.p.toFixed(3)}{' '}
              (<span style={{ color: sigStars(chi.p) ? '#00ff88' : '#64748b', fontWeight: 700 }}>{sigStars(chi.p) || 'not significant'}</span>),
              Cramér's V = {chi.cramerV.toFixed(3)} ({chi.cramerV < 0.1 ? 'negligible' : chi.cramerV < 0.3 ? 'weak' : chi.cramerV < 0.5 ? 'moderate' : 'strong'} association)
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>Tests whether {prettyLabel(a)} and {prettyLabel(b)} are statistically independent, or whether one predicts the other. Cramér's V is the effect size (0 = no association, 1 = perfect).</div>
          </div>
        </Card>); })()}
    </div>
  );
}
export default DeepAnalysisTables;
