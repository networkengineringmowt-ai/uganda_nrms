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

const WTYPES = ['Routine', 'Periodic', 'Emergency', 'Rehabilitation'];
const WCLR: Record<string, string> = { Routine: '#22c55e', Periodic: '#38bdf8', Emergency: '#f43f5e', Rehabilitation: '#a78bfa' };
export default function MaintenanceDashboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { let d = false; q('maintenance_works').then(r => { if (!d) setRows(r); }); return () => { d = true; }; }, []);
  if (rows === null) return <div style={{ padding: 20, color: '#64748b', fontSize: 12 }}>Loading maintenance works…</div>;
  if (!rows.length) return <Empty what='maintenance works' />;
  const kType = key(rows, /work_type|type|category/i); const kStat = key(rows, /status|state/i);
  const kLen = nkey(rows, /length|_km|km$/i); const kBud = nkey(rows, /budget|alloc|cost|amount/i);
  const kSpent = nkey(rows, /spent|utili|actual|paid/i); const kPct = nkey(rows, /percent|completion|progress/i);
  const kStart = key(rows, /start|begin|date/i); const kLink = key(rows, /link|road|name/i);
  const kContr = key(rows, /contractor|firm|company/i);
  const typeOf = (r: Row) => { const t = String(kType ? r[kType] ?? '' : '').toLowerCase();
    return WTYPES.find(w => t.includes(w.toLowerCase())) ?? (t.includes('emerg') ? 'Emergency' : t.includes('period') ? 'Periodic' : t.includes('rehab') ? 'Rehabilitation' : 'Routine'); };
  const byType = WTYPES.map(w => ({ name: w, value: rows.filter(r => typeOf(r) === w).length }));
  const kmTreated = rows.reduce((a, r) => a + (kLen ? num(r[kLen]) ?? 0 : 0), 0);
  const budget = rows.reduce((a, r) => a + (kBud ? num(r[kBud]) ?? 0 : 0), 0);
  const spent = rows.reduce((a, r) => a + (kSpent ? num(r[kSpent]) ?? 0 : 0), 0);
  const pcts = kPct ? rows.map(r => num(r[kPct])).filter(x => x != null) as number[] : [];
  const complete = pcts.length ? pcts.filter(p => p >= 100).length : (kStat ? rows.filter(r => /complete|done|closed/i.test(String(r[kStat]))).length : 0);
  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const trend = months.map((m, i) => { let v = 0;
    if (kStart) v = rows.filter(r => { const t = new Date(String(r[kStart] ?? '')); return isFinite(t.getTime()) && ((t.getMonth() + 6) % 12) === i; }).length;
    return { name: m, value: v }; });
  const hasTrend = trend.some(t => t.value > 0);
  const active = rows.filter(r => !kStat || !/complete|done|closed/i.test(String(r[kStat] ?? ''))).slice(0, 15);
  const budBars = [{ name: 'Allocated', value: budget }, { name: 'Utilised', value: spent }];
  return (
    <div style={{ width: '100%' }}>

        {/* ── Definition Card ── */}
        <div style={{background:'rgba(245,158,11,0.04)',border:'1px solid rgba(245,158,11,0.14)',borderRadius:16,padding:'20px 24px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{fontSize:36,lineHeight:1,flexShrink:0}}>🔧</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
              <span style={{fontSize:18,fontWeight:800,color:'rgba(245,158,11,1)',letterSpacing:-0.5}}>Maintenance Works Dashboard</span>
              <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>Routine · Periodic · Emergency · URF Work Plan · PPDA</span>
            </div>
            <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 10px',lineHeight:1.6}}>Section-level maintenance works dashboard — tracking routine maintenance coverage, periodic treatment progress, emergency works, force account activities, and URF-funded PPDA contracts across Uganda's national road sections.</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {["Routine Works","Periodic Maint","Emergency Works","Force Account","URF Work Plan","PPDA Contracts"].map(b=>(
                <span key={b} style={{background:'rgba(245,158,11,0.12)',color:'rgba(245,158,11,0.9)',fontSize:9,fontWeight:700,borderRadius:20,padding:'2px 8px',textTransform:'uppercase' as const,letterSpacing:0.5}}>{b}</span>
              ))}
            </div>
          </div>
        </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
        <Kpi label='Total works this FY' value={rows.length} sev='info' />
        <Kpi label='Works complete' value={rows.length ? complete / rows.length * 100 : 0} decimals={1} suffix='%' sev={complete / rows.length > 0.5 ? 'good' : 'warn'} sub={complete + ' of ' + rows.length} />
        <Kpi label='Budget utilised' value={budget ? spent / budget * 100 : 0} decimals={1} suffix='%' sev={budget && spent / budget > 0.9 ? 'bad' : 'good'} sub={budget ? 'of ' + fmtN(budget) + ' allocated' : 'no budget data'} />
        <Kpi label='Km treated' value={kmTreated} decimals={1} suffix=' km' sev='good' />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <Card title='WORKS BY TYPE'>
          <ResponsiveContainer width='100%' height={200}>
            <BarChart data={byType}><CartesianGrid {...GRID} /><XAxis dataKey='name' {...AX} /><YAxis {...AX} /><Tooltip {...TIP} />
              <Bar dataKey='value' name='Works' radius={[4, 4, 0, 0]}>{byType.map(d => <Cell key={d.name} fill={WCLR[d.name]} />)}</Bar></BarChart>
          </ResponsiveContainer>
        </Card>
        {budget > 0 && (
          <Card title='BUDGET ALLOCATED VS UTILISED'>
            <ResponsiveContainer width='100%' height={200}>
              <BarChart data={budBars}><CartesianGrid {...GRID} /><XAxis dataKey='name' {...AX} /><YAxis {...AX} /><Tooltip {...TIP} />
                <Bar dataKey='value' name='Amount' radius={[4, 4, 0, 0]}><Cell fill='#38bdf8' /><Cell fill={HL} /></Bar></BarChart>
            </ResponsiveContainer>
          </Card>
        )}
        {hasTrend && (
          <Card title='MONTHLY WORKS STARTED (FY JUL-JUN)'>
            <ResponsiveContainer width='100%' height={200}>
              <LineChart data={trend}><CartesianGrid {...GRID} /><XAxis dataKey='name' {...AX} /><YAxis {...AX} /><Tooltip {...TIP} />
                <Line dataKey='value' name='Works started' stroke={HL} strokeWidth={2.5} dot={{ r: 3 }} /></LineChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  );
}
