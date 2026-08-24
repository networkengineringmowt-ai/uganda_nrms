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

const RATINGS = ['Very Good', 'Good', 'Fair', 'Poor', 'Critical'];
const RCLR: Record<string, string> = { 'Very Good': '#22c55e', Good: '#84cc16', Fair: '#eab308', Poor: '#f97316', Critical: '#ef4444' };
export default function StructuresDashboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { let d = false; q('bridge_inventory').then(r => { if (!d) setRows(r); }); return () => { d = true; }; }, []);
  if (rows === null) return <div style={{ padding: 20, color: '#64748b', fontSize: 12 }}>Loading bridge inventory…</div>;
  if (!rows.length) return <Empty what='bridge inventory' />;
  const kCond = key(rows, /condition|rating/i); const kMat = key(rows, /material|type/i);
  const kSpan = nkey(rows, /span|length/i); const kWid = nkey(rows, /width|deck/i);
  const kInsp = key(rows, /inspect|survey/i); const kId = key(rows, /bridge_id|structure_id|^id$|_no|code/i);
  const kRoute = key(rows, /route|road|link/i); const kYear = nkey(rows, /year|built|construct/i);
  const rateOf = (r: Row) => { if (!kCond) return 'Fair'; const c = String(r[kCond] ?? '').toLowerCase();
    const n = num(r[kCond]);
    if (n != null) return n >= 4.5 ? 'Very Good' : n >= 3.5 ? 'Good' : n >= 2.5 ? 'Fair' : n >= 1.5 ? 'Poor' : 'Critical';
    return RATINGS.find(x => c.includes(x.toLowerCase())) ?? (c.includes('crit') || c.includes('bad') ? 'Critical' : 'Fair'); };
  const dist = RATINGS.map(c => ({ name: c, value: rows.filter(r => rateOf(r) === c).length }));
  const critPct = dist[4].value / rows.length * 100;
  const now = Date.now();
  const insp12 = kInsp ? rows.filter(r => { const t = Date.parse(String(r[kInsp] ?? '')); return isFinite(t) && (now - t) < 365 * 86400e3; }).length : 0;
  const deck = rows.reduce((a, r) => a + Math.max(0, (kSpan ? num(r[kSpan]) ?? 0 : 0)) * Math.max(4, kWid ? num(r[kWid]) ?? 7 : 7), 0);
  const byMat = kMat ? grp(rows, kMat, null) : [];
  const years = kYear ? rows.map(r => num(r[kYear])).filter(x => x != null && x > 1900) as number[] : [];
  const decades = years.length ? [...new Set(years.map(y => Math.floor(y / 10) * 10))].sort().map(d => ({ name: d + 's', value: years.filter(y => Math.floor(y / 10) * 10 === d).length })) : [];
  const crit = rows.filter(r => rateOf(r) === 'Critical' || rateOf(r) === 'Poor').slice(0, 15);
  return (
    <div style={{ width: '100%' }}>

        {/* ── Definition Card ── */}
        <div style={{background:'rgba(14,165,233,0.04)',border:'1px solid rgba(14,165,233,0.14)',borderRadius:16,padding:'20px 24px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{fontSize:36,lineHeight:1,flexShrink:0}}>🌉</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
              <span style={{fontSize:18,fontWeight:800,color:'rgba(14,165,233,1)',letterSpacing:-0.5}}>Structures Dashboard</span>
              <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>Bridges · Culverts · Load Rating · NBI Score · UNRA · MoWT</span>
            </div>
            <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 10px',lineHeight:1.6}}>Road structures dashboard for Uganda sections — monitoring bridge NBI condition ratings, load capacity, culvert condition, inspection due dates, and structural maintenance needs across UNRA and MoWT managed road infrastructure.</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {["Bridges","Culverts","Load Rating","NBI Score","Inspection Due","UNRA / MoWT"].map(b=>(
                <span key={b} style={{background:'rgba(14,165,233,0.12)',color:'rgba(14,165,233,0.9)',fontSize:9,fontWeight:700,borderRadius:20,padding:'2px 8px',textTransform:'uppercase' as const,letterSpacing:0.5}}>{b}</span>
              ))}
            </div>
          </div>
        </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
        <Kpi label='Total bridges' value={rows.length} sev='info' />
        <Kpi label='Critical condition' value={critPct} decimals={1} suffix='%' sev={critPct > 10 ? 'bad' : 'warn'} sub={dist[4].value + ' structures'} />
        <Kpi label='Inspected last 12 months' value={rows.length ? insp12 / rows.length * 100 : 0} decimals={1} suffix='%' sev={insp12 / rows.length > 0.6 ? 'good' : 'warn'} sub={insp12 + ' of ' + rows.length} />
        <Kpi label='Estimated deck area' value={deck} suffix=' m²' sev='info' />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <Card title='CONDITION RATING DISTRIBUTION'>
          <ResponsiveContainer width='100%' height={200}>
            <BarChart data={dist}><CartesianGrid {...GRID} /><XAxis dataKey='name' {...AX} /><YAxis {...AX} /><Tooltip {...TIP} />
              <Bar dataKey='value' name='Bridges' radius={[4, 4, 0, 0]}>{dist.map(d => <Cell key={d.name} fill={RCLR[d.name]} />)}</Bar></BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title='BRIDGES BY MATERIAL TYPE'>
          {byMat.length ? (
            <ResponsiveContainer width='100%' height={200}>
              <PieChart><Pie data={byMat} dataKey='value' nameKey='name' innerRadius={45} outerRadius={80} paddingAngle={2}>
                {byMat.map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}</Pie><Tooltip {...TIP} /><Legend wrapperStyle={{ fontSize: 10 }} /></PieChart>
            </ResponsiveContainer>
          ) : <Empty what='material type' />}
        </Card>
        {decades.length > 0 && (
          <Card title='CONSTRUCTION AGE PROFILE (DECADE BUILT)'>
            <ResponsiveContainer width='100%' height={200}>
              <BarChart data={decades}><CartesianGrid {...GRID} /><XAxis dataKey='name' {...AX} /><YAxis {...AX} /><Tooltip {...TIP} />
                <Bar dataKey='value' name='Bridges' fill='#a78bfa' radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  );
}
