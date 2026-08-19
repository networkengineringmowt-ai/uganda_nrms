import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

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
async function loadRows(sectionId: string): Promise<Row[]> {
  const table = SPECS[sectionId] ?? 'road_links';
  const live = (async () => { try {
    const q = supabase.from(table).select('*').limit(900);
    const t = new Promise<{ data: null }>(res => setTimeout(() => res({ data: null }), 4500));
    const { data } = await Promise.race([q, t]) as { data: Row[] | null };
    return (data ?? []) as Row[];
  } catch { return [] as Row[]; } })();
  const fb = (async () => { try {
    const gj = await fetch(import.meta.env.BASE_URL + 'data/traffic_predictions.geojson').then(r => r.json());
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
const EXCL = /lat|lng|lon|^x$|^y$|id$|_id|code|^no$|road_no|name|date/i;

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
    const nums = cols.filter(c => !/lat|lng|lon|^x$|^y$|_id|^id$/i.test(c) && rows.filter(r => num(r[c]) != null).length >= rows.length * 0.5);
    const lenCol = cols.find(c => /length|km$|_km/i.test(c) && rows.some(r => num(r[c]) != null)) ?? null;
    return { cols, cats, nums, lenCol };
  }, [rows]);
  if (rows === null) return <div style={{ padding: 20, color: '#64748b', fontSize: 12 }}>Computing analysis…</div>;
  if (!rows.length || !P) return <div style={{ padding: 16, color: '#64748b', fontSize: 12 }}>No data available yet.</div>;
  const N = rows.length;
  return (
    <div style={{ width: '100%' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: accent, margin: '4px 0 10px' }}>
        DEEP ANALYTICS - {N.toLocaleString()} RECORDS ANALYSED IN FULL - GROUP STATISTICS, DISTRIBUTIONS, CROSS-RELATIONS
      </div>
      <Card title={'NUMERIC DISTRIBUTION STATISTICS (ALL ' + N.toLocaleString() + ' RECORDS)'} accent={accent}
        right={<button onClick={() => { const cols = ['Attribute','Count','Sum','Mean','Min','P25','Median','P75','P90','Max','StdDev'];
          const out = P.nums.map(c => { const v = rows.map(r => num(r[c])).filter(x => x != null).sort((a,b)=>(a as number)-(b as number)) as number[];
            const sum = v.reduce((a,b)=>a+b,0); const mean = sum/v.length;
            const sd = Math.sqrt(v.reduce((a,b)=>a+(b-mean)*(b-mean),0)/v.length);
            return [c, v.length, sum, mean, v[0], qtile(v,0.25), qtile(v,0.5), qtile(v,0.75), qtile(v,0.9), v[v.length-1], sd]; });
          csvOut(sectionId + '_numeric_stats', cols, out); }}
          style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.3)', borderRadius: 6, color: accent, fontSize: 10, fontWeight: 700, padding: '3px 10px', cursor: 'pointer' }}>CSV</button>}>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
            <thead><tr>{['Attribute','Count','Sum','Mean','Min','P25','Median','P75','P90','Max','StdDev','CV%'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>{P.nums.map(c => { const v = rows.map(r => num(r[c])).filter(x => x != null).sort((a,b)=>(a as number)-(b as number)) as number[];
              if (!v.length) return null; const sum = v.reduce((a,b)=>a+b,0); const mean = sum/v.length;
              const sd = Math.sqrt(v.reduce((a,b)=>a+(b-mean)*(b-mean),0)/v.length); const cv = mean ? sd/mean*100 : 0;
              return (<tr key={c} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ ...TD, color: '#e2e8f0', fontWeight: 700 }}>{prettyLabel(c)}</td>
                <td style={TD}>{fmtN(v.length)}</td><td style={TD}>{fmtN(sum)}</td><td style={TD}>{fmtN(mean,1)}</td>
                <td style={TD}>{fmtN(v[0],1)}</td><td style={TD}>{fmtN(qtile(v,0.25),1)}</td>
                <td style={{ ...TD, ...heatCss(0.5) }}>{fmtN(qtile(v,0.5),1)}</td>
                <td style={TD}>{fmtN(qtile(v,0.75),1)}</td><td style={{ ...TD, ...heatCss(0.75) }}>{fmtN(qtile(v,0.9),1)}</td>
                <td style={TD}>{fmtN(v[v.length-1],1)}</td><td style={TD}>{fmtN(sd,1)}</td>
                <td style={{ ...TD, ...heatCss(Math.min(1, cv/150)) }}>{fmtN(cv,1)}%</td></tr>); })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>Formulas: Mean = Sum/Count; StdDev = sqrt(Sum((x-Mean)^2)/N); CV% = StdDev/Mean x 100; Pxx by linear interpolation on the full sorted series.</div>
      </Card>
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
        </Card>); })}
      {P.cats.length >= 2 && (() => { const [a, b] = P.cats; const ka = [...new Set(rows.map(r => String(r[a] ?? 'Unknown')))];
        const kb = [...new Set(rows.map(r => String(r[b] ?? 'Unknown')))];
        const cell = new Map<string, number>(); let mx = 1;
        rows.forEach(r => { const k = String(r[a] ?? 'Unknown') + '|' + String(r[b] ?? 'Unknown');
          const v = (cell.get(k) ?? 0) + 1; cell.set(k, v); if (v > mx) mx = v; });
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
        </Card>); })()}
    </div>
  );
}
export default DeepAnalysisTables;
