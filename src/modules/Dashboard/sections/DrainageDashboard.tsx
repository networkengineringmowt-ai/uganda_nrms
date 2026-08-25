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

const DCOND = ['Good', 'Fair', 'Poor', 'Failed'];
const DCLR: Record<string, string> = { Good: '#22c55e', Fair: '#eab308', Poor: '#f97316', Failed: '#ef4444' };
export default function DrainageDashboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { let d = false; q('culvert_inventory').then(r => { if (!d) setRows(r); }); return () => { d = true; }; }, []);
  if (rows === null) return <div style={{ padding: 20, color: '#64748b', fontSize: 12 }}>Loading drainage inventory…</div>;
  if (!rows.length) return <Empty what='drainage structure' />;
  const kCond = key(rows, /condition|rating|state/i); const kType = key(rows, /type|structure/i);
  const kRoad = key(rows, /road|link|route/i); const kDia = nkey(rows, /diameter|size|span/i);
  const kLen = nkey(rows, /length|_km|km$/i);
  const condOf = (r: Row) => { const c = String(kCond ? r[kCond] ?? '' : '').toLowerCase();
    const n = num(kCond ? r[kCond] : null);
    if (n != null) return n >= 3.5 ? 'Good' : n >= 2.5 ? 'Fair' : n >= 1.5 ? 'Poor' : 'Failed';
    return DCOND.find(x => c.includes(x.toLowerCase())) ?? (c.includes('collaps') || c.includes('block') ? 'Failed' : 'Fair'); };
  const dist = DCOND.map(c => ({ name: c, value: rows.filter(r => condOf(r) === c).length }));
  const poorPct = (dist[2].value + dist[3].value) / rows.length * 100;
  const byType = kType ? grp(rows, kType, null) : [];
  const roadsWith = kRoad ? new Set(rows.map(r => String(r[kRoad]))).size : 0;
  const kmNoDrain = rows.length && kLen ? Math.round(rows.reduce((a, r) => a + (num(r[kLen]) ?? 0), 0) * poorPct) / 100 : 0;
  const crit = rows.filter(r => condOf(r) === 'Failed' || condOf(r) === 'Poor').slice(0, 15);
  return (
    <div style={{ width: '100%' }}>

        {/* ── Definition Card ── */}
        <div style={{background:'rgba(6,182,212,0.04)',border:'1px solid rgba(6,182,212,0.14)',borderRadius:16,padding:'20px 24px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{fontSize:36,lineHeight:1,flexShrink:0}}>🌊</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
              <span style={{fontSize:18,fontWeight:800,color:'rgba(6,182,212,1)',letterSpacing:-0.5}}>Drainage Infrastructure Dashboard</span>
              <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>Culverts · Cross Drains · Flood Risk · MoWT Standards</span>
            </div>
            <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 10px',lineHeight:1.6}}>Section-level drainage infrastructure dashboard - tracking culvert condition, cross-drain capacity, side-drain maintenance needs, and flood vulnerability for Uganda's national road network against MoWT drainage design standards.</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {["Culverts","Cross Drains","Side Drains","Flood Risk","Maintenance Need","MoWT Standards"].map(b=>(
                <span key={b} style={{background:'rgba(6,182,212,0.12)',color:'rgba(6,182,212,0.9)',fontSize:9,fontWeight:700,borderRadius:20,padding:'2px 8px',textTransform:'uppercase' as const,letterSpacing:0.5}}>{b}</span>
              ))}
            </div>
          </div>
        </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
        <Kpi label='Total drainage structures' value={rows.length} sev='info' />
        <Kpi label='Poor or failed condition' value={poorPct} decimals={1} suffix='%' sev={poorPct > 25 ? 'bad' : 'warn'} sub={(dist[2].value + dist[3].value) + ' structures'} />
        <Kpi label='Road links covered' value={roadsWith} sev='good' />
        <Kpi label='Km with inadequate drainage (est.)' value={kmNoDrain} decimals={1} suffix=' km' sev='warn' />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <Card title='CONDITION DISTRIBUTION'>
          <ResponsiveContainer width='100%' height={200}>
            <BarChart data={dist}><CartesianGrid {...GRID} /><XAxis dataKey='name' {...AX} /><YAxis {...AX} /><Tooltip {...TIP} />
              <Bar dataKey='value' name='Structures' radius={[4, 4, 0, 0]}>{dist.map(d => <Cell key={d.name} fill={DCLR[d.name]} />)}</Bar></BarChart>
          </ResponsiveContainer>
        </Card>
        {byType.length > 0 && (
          <Card title='STRUCTURE TYPE BREAKDOWN'>
            <ResponsiveContainer width='100%' height={200}>
              <PieChart><Pie data={byType} dataKey='value' nameKey='name' innerRadius={45} outerRadius={80} paddingAngle={2}>
                {byType.map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}</Pie><Tooltip {...TIP} /><Legend wrapperStyle={{ fontSize: 10 }} /></PieChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  );
}
