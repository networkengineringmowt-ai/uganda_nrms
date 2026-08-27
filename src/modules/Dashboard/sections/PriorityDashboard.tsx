import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, ScatterChart, Scatter, ZAxis } from 'recharts';
import { GaugeC, RankList } from '../../../shared/dashboardKit';

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

const TIERS = ['Critical', 'High', 'Medium', 'Low'];
const TCLR: Record<string, string> = { Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#22c55e' };
const UNIT_COST_UGX_BN_PER_KM = 0.9;
export default function PriorityDashboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { let d = false;
    (async () => { const live = await q('investment_projects');
      const r = live.length ? live : await gjRows('traffic_predictions.geojson');
      if (!d) setRows(r); })();
    return () => { d = true; };
  }, []);
  if (rows === null) return <div style={{ padding: 20, color: '#64748b', fontSize: 12 }}>Computing priority ranking…</div>;
  if (!rows.length) return <Empty what='priority ranking' />;
  const kAadt = nkey(rows, /aadt|traffic/i); const kIri = nkey(rows, /iri|condition_score|score/i);
  const kLen = nkey(rows, /length|_km|km$/i); const kName = key(rows, /link_name|road_name|name|road_no|project/i);
  const kCost = nkey(rows, /cost|budget|amount/i);
  const aMax = kAadt ? Math.max(...rows.map(r => num(r[kAadt]) ?? 0), 1) : 1;
  const iMax = kIri ? Math.max(...rows.map(r => num(r[kIri]) ?? 0), 1) : 1;
  const scored = rows.map(r => {
    const a = kAadt ? (num(r[kAadt]) ?? 0) / aMax : 0.5;
    const c = kIri ? (num(r[kIri]) ?? 0) / iMax : 0.5;
    const score = Math.round((a * 0.55 + c * 0.45) * 100);
    const tier = score >= 70 ? 'Critical' : score >= 50 ? 'High' : score >= 30 ? 'Medium' : 'Low';
    const km = kLen ? (num(r[kLen]) ?? 0) : 0;
    const cost = kCost && num(r[kCost]) != null ? num(r[kCost])! : km * UNIT_COST_UGX_BN_PER_KM;
    const reason = a > c ? 'Traffic demand (AADT)' : 'Condition / IRI driven';
    return { r, score, tier, km, cost, reason, a: a * 100, c: c * 100 };
  }).sort((x, y) => y.score - x.score);
  const byTier = TIERS.map(t => ({ name: t, value: scored.filter(s => s.tier === t).length }));
  const totalCost = scored.filter(s => s.tier === 'Critical' || s.tier === 'High').reduce((s, x) => s + x.cost, 0);
  const kmPri = scored.filter(s => s.tier === 'Critical' || s.tier === 'High').reduce((s, x) => s + x.km, 0);
  const distBins = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const histo = distBins.slice(0, -1).map((b, i) => ({ name: b + '-' + distBins[i + 1], value: scored.filter(s => s.score >= b && s.score < distBins[i + 1]).length }));
  const scatter = scored.map(s => ({ x: Math.round(s.c), y: s.score, z: Math.max(1, s.km) }));
  const top = scored; // full ranked list (already sorted desc by score) - no cap; RankList scrolls
  return (
    <div style={{ width: '100%' }}>
      {/* ── Definition Card ── */}
      <div style={{background:'rgba(239,68,68,0.04)',border:'1px solid rgba(239,68,68,0.14)',borderRadius:16,padding:'20px 24px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:16}}>
        <div style={{fontSize:36,lineHeight:1,flexShrink:0}}>🎯</div>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
            <span style={{fontSize:18,fontWeight:800,color:'rgba(239,68,68,1)',letterSpacing:-0.5}}>Priority Works Dashboard</span>
            <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>HDM-4 Ranking · URF · PCI · Traffic Score · Budget Optimised</span>
          </div>
          <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 10px',lineHeight:1.6}}>Priority works ranking dashboard for Uganda national road sections - combining HDM-4 economic analysis, PCI condition scores, AADT traffic weighting, social impact factors, and URF budget constraints to optimise maintenance priorities.</p>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {["HDM-4 Priority","URF Ranking","PCI Weighted","Traffic Score","Social Impact","Budget Optimised"].map(b=>(
              <span key={b} style={{background:'rgba(239,68,68,0.12)',color:'rgba(239,68,68,0.9)',fontSize:9,fontWeight:700,borderRadius:20,padding:'2px 8px',textTransform:'uppercase' as const,letterSpacing:0.5}}>{b}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
        <Kpi label='Links ranked' value={scored.length} sev='info' />
        <Kpi label='Critical priority tier' value={byTier[0].value} sev='bad' sub={(byTier[0].value / scored.length * 100).toFixed(1) + '% of ranked links'} />
        <Kpi label='Investment needed (Critical + High)' value={totalCost} decimals={1} suffix=' bn UGX' sev='warn' />
        <Kpi label='Km prioritised for treatment' value={kmPri} decimals={1} suffix=' km' sev='warn' />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <Card title='PRIORITY SCORE DISTRIBUTION (0-100)'>
          <ResponsiveContainer width='100%' height={200}>
            <BarChart data={histo}><CartesianGrid {...GRID} /><XAxis dataKey='name' {...AX} /><YAxis {...AX} /><Tooltip {...TIP} />
              <Bar dataKey='value' name='Links' fill={HL} radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title='PRIORITY TIER BREAKDOWN'>
          <ResponsiveContainer width='100%' height={200}>
            <PieChart><Pie data={byTier} dataKey='value' nameKey='name' innerRadius={45} outerRadius={80} paddingAngle={2}>
              {byTier.map(d => <Cell key={d.name} fill={TCLR[d.name]} />)}</Pie><Tooltip {...TIP} /><Legend wrapperStyle={{ fontSize: 10, color: 'rgba(148,163,184,0.7)' }} /></PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title='PRIORITY SCORE VS CONDITION INDEX (BUBBLE = KM)'>
          <ResponsiveContainer width='100%' height={200}>
            <ScatterChart><CartesianGrid {...GRID} />
              <XAxis type='number' dataKey='x' name='Condition index' {...AX} />
              <YAxis type='number' dataKey='y' name='Priority score' {...AX} />
              <ZAxis type='number' dataKey='z' range={[15, 120]} name='Km' />
              <Tooltip {...TIP} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={scatter} fill={HL} fillOpacity={0.55} /></ScatterChart>
          </ResponsiveContainer>
        </Card>
        <Card title='NETWORK SHARE IN CRITICAL + HIGH TIER'>
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GaugeC
              value={Math.round((byTier[0].value + byTier[1].value) / scored.length * 100)}
              target={30}
              color='#ef4444'
              label='of ranked links need urgent action'
            />
          </div>
        </Card>
        <div style={{ gridColumn: '1 / -1' }}>
          <Card title={`ALL ${top.length} PRIORITY LINKS - RANKED (scroll for full list)`}>
            <RankList
              items={top.map((s, i) => ({
                id: i,
                title: kName ? String(s.r[kName] ?? `Link ${i + 1}`) : `Link ${i + 1}`,
                subtitle: `${s.reason} · ${s.km.toFixed(1)} km${s.cost ? ` · ${fmtN(s.cost, 1)} bn UGX est.` : ''}`,
                value: `${s.score}`,
                badge: { label: s.tier, color: TCLR[s.tier] },
              }))}
              emptyLabel='No ranked links available yet.'
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
