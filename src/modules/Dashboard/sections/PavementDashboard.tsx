import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, ScatterChart, Scatter, ZAxis } from 'recharts';

type Row = Record<string, unknown>;
const CARD = 'rgba(15,23,42,0.5)'; const HL = '#00f5ff';
const SEV: Record<string, string> = { good: '#22c55e', warn: '#f59e0b', bad: '#f43f5e', info: '#38bdf8' };
const PAL = ['#00f5ff', '#00ff88', '#ffd23f', '#ff6b35', '#b967ff', '#4d9fff', '#00d4aa', '#ff2d78', '#a3e635', '#f0abfc', '#fbbf24'];
const num = (v: unknown): number | null => { if (typeof v === 'number' && isFinite(v)) return v; if (typeof v === 'string' && v !== '' && isFinite(Number(v))) return Number(v); return null; };
const fmtN = (n: number, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });
const key = (rows: Row[], re: RegExp) => rows.length ? (Object.keys(rows[0]).find(c => re.test(c) && rows.some(r => r[c] != null && r[c] !== '')) ?? null) : null;
const nkey = (rows: Row[], re: RegExp) => rows.length ? (Object.keys(rows[0]).find(c => re.test(c) && rows.some(r => num(r[c]) != null)) ?? null) : null;
async function q(table: string): Promise<Row[]> {
  try { const p = supabase.from(table).select('*').limit(1000);
    const t = new Promise<{ data: null }>(res => setTimeout(() => res({ data: null }), 4500));
    const { data } = await Promise.race([p, t]) as { data: Row[] | null };
    return (data ?? []) as Row[];
  } catch { return []; }
}
async function gjRows(file: string): Promise<Row[]> {
  try { const g = await fetch(import.meta.env.BASE_URL + 'data/' + file).then(r => r.json());
    return ((g.features ?? []) as { properties: Row }[]).map(f => f.properties);
  } catch { return []; }
}
function grp(rows: Row[], catK: string | null, numK: string | null): { name: string; value: number }[] {
  if (!catK) return [];
  const m = new Map<string, number>();
  rows.forEach(r => { const k = String(r[catK] ?? 'Unknown');
    m.set(k, (m.get(k) ?? 0) + (numK ? (num(r[numK]) ?? 0) : 1)); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }));
}
function useCountUp(target: number): number {
  const [v, setV] = useState(0); const raf = useRef(0);
  useEffect(() => { const t0 = performance.now();
    const step = (t: number) => { const p = Math.min(1, (t - t0) / 800);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return v;
}
function Kpi({ label, value, decimals = 0, suffix = '', sub, sev = 'info' }: { label: string; value: number; decimals?: number; suffix?: string; sub?: string; sev?: string }) {
  const v = useCountUp(value); const [h, setH] = useState(false);
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ background: CARD, border: '1px solid rgba(255,255,255,0.07)', borderLeft: '4px solid ' + (SEV[sev] ?? SEV.info), borderRadius: 12, padding: '12px 14px',
        transform: h ? 'translateY(-3px)' : 'none', boxShadow: h ? '0 8px 22px rgba(0,0,0,0.45)' : '0 1px 4px rgba(0,0,0,0.25)', transition: 'transform 160ms ease-out, box-shadow 160ms ease-out' }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmtN(v, decimals)}{suffix}</div>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', marginTop: 3 }}>{label.toUpperCase()}</div>
      {sub && <div style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: CARD, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: HL, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
function Empty({ what }: { what: string }) {
  return <div style={{ background: CARD, border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 12, padding: '26px 16px', textAlign: 'center', color: '#64748b', fontSize: 12, marginBottom: 12 }}>No {what} data available yet. Records will appear here once captured.</div>;
}
const TIP = { contentStyle: { background: '#0f1923', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 11 }, labelStyle: { color: '#e2e8f0' } };
const AX = { tick: { fontSize: 9, fill: '#94a3b8' }, axisLine: { stroke: 'rgba(255,255,255,0.15)' }, tickLine: false as const };
const GRID = { stroke: 'rgba(255,255,255,0.05)' };
const TBL_TH: React.CSSProperties = { padding: '6px 10px', background: '#0f1923', color: '#94a3b8', textAlign: 'left', fontWeight: 700, fontSize: 10, whiteSpace: 'nowrap', position: 'sticky', top: 0 };
const TBL_TD: React.CSSProperties = { padding: '5px 10px', color: '#cbd5e1', fontSize: 10.5, whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.04)' };

const CLASSES = ['Good', 'Fair', 'Poor', 'Bad'];
const CCLR: Record<string, string> = { Good: '#22c55e', Fair: '#eab308', Poor: '#f97316', Bad: '#ef4444' };
function condClass(iri: number): string { return iri <= 4 ? 'Good' : iri <= 7 ? 'Fair' : iri <= 10 ? 'Poor' : 'Bad'; }
function treatment(iri: number): string { return iri <= 4 ? 'Routine maintenance' : iri <= 7 ? 'Resealing / regravelling' : iri <= 10 ? 'Overlay / heavy grading' : 'Reconstruction'; }
export default function PavementDashboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { let d = false; q('road_condition_assessments').then(r => { if (!d) setRows(r); }); return () => { d = true; }; }, []);
  if (rows === null) return <div style={{ padding: 20, color: '#64748b', fontSize: 12 }}>Loading pavement condition data…</div>;
  if (!rows.length) return <Empty what='pavement condition' />;
  const kIri = nkey(rows, /iri/i); const kLen = nkey(rows, /length|_km|km$/i);
  const kCond = key(rows, /condition|class$/i); const kName = key(rows, /road_name|link_name|name|road_no|link/i);
  const kRc = key(rows, /road_class|func/i);
  const iris = kIri ? rows.map(r => num(r[kIri])).filter(x => x != null) as number[] : [];
  const avgIri = iris.length ? iris.reduce((a, b) => a + b, 0) / iris.length : 0;
  const lenOf = (r: Row) => kLen ? (num(r[kLen]) ?? 0) : 0;
  const totKm = rows.reduce((a, r) => a + lenOf(r), 0);
  const condOf = (r: Row) => { if (kIri && num(r[kIri]) != null) return condClass(num(r[kIri])!);
    if (kCond) { const c = String(r[kCond]); const m = CLASSES.find(x => c.toLowerCase().includes(x.toLowerCase())); if (m) return m; } return 'Fair'; };
  const dist = CLASSES.map(c => { const g = rows.filter(r => condOf(r) === c);
    return { name: c, count: g.length, km: Math.round(g.reduce((a, r) => a + lenOf(r), 0) * 10) / 10 }; });
  const urgentKm = dist.filter(d => d.name === 'Poor' || d.name === 'Bad').reduce((a, d) => a + d.km, 0);
  const bins = [0, 2, 4, 6, 8, 10, 12, 14, 16];
  const histo = bins.slice(0, -1).map((b, i) => ({ name: b + '-' + bins[i + 1],
    value: iris.filter(v => v >= b && v < bins[i + 1]).length }));
  const rcs = kRc ? [...new Set(rows.map(r => String(r[kRc] ?? 'Unknown')))].slice(0, 8) : [];
  const stacked = rcs.map(rc => { const g = rows.filter(r => String(r[kRc!]) === rc);
    const o: Record<string, unknown> = { name: rc };
    CLASSES.forEach(c => { o[c] = g.filter(r => condOf(r) === c).length; }); return o; });
  const worst = kIri ? [...rows].sort((a, b) => (num(b[kIri]) ?? 0) - (num(a[kIri]) ?? 0)).slice(0, 15) : [];
  return (
    <div style={{ width: '100%' }}>

        {/* ── Definition Card ── */}
        <div style={{background:'rgba(16,185,129,0.04)',border:'1px solid rgba(16,185,129,0.14)',borderRadius:16,padding:'20px 24px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{fontSize:36,lineHeight:1,flexShrink:0}}>🛣️</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
              <span style={{fontSize:18,fontWeight:800,color:'rgba(16,185,129,1)',letterSpacing:-0.5}}>Pavement Performance Dashboard</span>
              <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>IRI Roughness · PCI Rating · Rutting · HDM-4 Model</span>
            </div>
            <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 10px',lineHeight:1.6}}>Pavement performance dashboard for Uganda road sections — consolidating IRI roughness profiles, PCI condition ratings, rutting depths, cracking indices, and HDM-4 deterioration forecasts for evidence-based treatment planning.</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {["IRI Roughness","PCI Rating","Rutting","Cracking Index","Structural Cap.","HDM-4 Model"].map(b=>(
                <span key={b} style={{background:'rgba(16,185,129,0.12)',color:'rgba(16,185,129,0.9)',fontSize:9,fontWeight:700,borderRadius:20,padding:'2px 8px',textTransform:'uppercase' as const,letterSpacing:0.5}}>{b}</span>
              ))}
            </div>
          </div>
        </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
        <Kpi label='Network length surveyed' value={totKm} decimals={1} suffix=' km' sev='info' sub={rows.length.toLocaleString() + ' assessment records'} />
        <Kpi label='Average IRI' value={avgIri} decimals={2} suffix=' m/km' sev={avgIri > 7 ? 'bad' : avgIri > 4 ? 'warn' : 'good'} />
        <Kpi label='Good + Fair share' value={totKm ? (dist[0].km + dist[1].km) / totKm * 100 : 0} decimals={1} suffix='%' sev='good' />
        <Kpi label='Km requiring urgent treatment' value={urgentKm} decimals={1} suffix=' km' sev={urgentKm > totKm * 0.3 ? 'bad' : 'warn'} sub='Poor + Bad condition classes' />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <Card title='CONDITION CLASS DISTRIBUTION (RECORDS AND KM)'>
          <ResponsiveContainer width='100%' height={200}>
            <BarChart data={dist}><CartesianGrid {...GRID} /><XAxis dataKey='name' {...AX} /><YAxis {...AX} /><Tooltip {...TIP} /><Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey='count' name='Records' radius={[4, 4, 0, 0]}>{dist.map(d => <Cell key={d.name} fill={CCLR[d.name]} />)}</Bar>
              <Bar dataKey='km' name='Km affected' fill='#38bdf8' radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title='IRI HISTOGRAM (M/KM BANDS)'>
          {iris.length ? (
            <ResponsiveContainer width='100%' height={200}>
              <BarChart data={histo}><CartesianGrid {...GRID} /><XAxis dataKey='name' {...AX} /><YAxis {...AX} /><Tooltip {...TIP} />
                <Bar dataKey='value' name='Links' fill={HL} radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          ) : <Empty what='IRI' />}
        </Card>
        {stacked.length > 0 && (
          <Card title='CONDITION BY ROAD CLASS (STACKED)'>
            <ResponsiveContainer width='100%' height={200}>
              <BarChart data={stacked}><CartesianGrid {...GRID} /><XAxis dataKey='name' {...AX} /><YAxis {...AX} /><Tooltip {...TIP} /><Legend wrapperStyle={{ fontSize: 10 }} />
                {CLASSES.map(c => <Bar key={c} dataKey={c} stackId='a' fill={CCLR[c]} />)}
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  );
}
