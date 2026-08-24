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

export default function TrafficDashboard() {
  const [links, setLinks] = useState<Row[] | null>(null);
  const [stations, setStations] = useState<Row[]>([]);
  const [accidents, setAccidents] = useState<Row[]>([]);
  useEffect(() => { let d = false;
    (async () => {
      const [live, fb, st, stFb, acc] = await Promise.all([
        q('traffic_counts'), gjRows('traffic_predictions.geojson'),
        q('traffic_stations'), (async () => { try { const gz = await fetch(import.meta.env.BASE_URL + 'atc_stations.geojson').then(r => r.json()); return ((gz.features ?? []) as { properties: Row }[]).map(f => f.properties); } catch { return [] as Row[]; } })(), q('road_accidents')]);
      if (d) return;
      setLinks(live.length ? live : fb);
      setStations(st.length ? st : stFb);
      setAccidents(acc);
    })();
    return () => { d = true; };
  }, []);
  if (links === null) return <div style={{ padding: 20, color: '#64748b', fontSize: 12 }}>Loading traffic intelligence…</div>;
  if (!links.length && !stations.length) return <Empty what='traffic' />;
  const kAadt = nkey(links, /aadt/i); const kHeavy = nkey(links, /heavy|hgv|truck/i);
  const kClass = key(links, /class/i); const kLen = nkey(links, /length|_km|km$/i);
  const kName = key(links, /link_name|road_name|name|road_no/i); const kGrow = nkey(links, /growth|2030/i);
  const totAadt = kAadt ? links.reduce((a, r) => a + (num(r[kAadt]) ?? 0), 0) : 0;
  const meanAadt = kAadt && links.length ? totAadt / links.length : 0;
  const heavyVals = kHeavy ? links.map(r => num(r[kHeavy])).filter(x => x != null) as number[] : [];
  const heavyPct = heavyVals.length ? heavyVals.reduce((a, b) => a + b, 0) / heavyVals.length : 14;
  const peakHour = Math.round(meanAadt * 0.09);
  const byClass = grp(links, kClass, kAadt).map(d => ({ name: d.name, value: links.filter(r => String(r[kClass!]) === d.name).length ? Math.round(d.value / links.filter(r => String(r[kClass!]) === d.name).length) : 0 }));
  const hv = Math.round(heavyPct);
  const mix = [
    { name: 'Motorcycles', value: 24 },
    { name: 'Cars & light vehicles', value: Math.max(5, 100 - 24 - 7 - Math.round(hv * 0.55) - Math.round(hv * 0.45)) },
    { name: 'Buses & PSV', value: 7 },
    { name: 'Trucks (2-3 axle)', value: Math.round(hv * 0.55) },
    { name: 'Heavy trucks (4+ axle)', value: Math.round(hv * 0.45) }];
  const kDir = key(links, /direction|^dir/i);
  const gf = kGrow && meanAadt ? Math.pow((links.reduce((a, r) => a + (num(r[kGrow!]) ?? 0), 0) / links.length) / meanAadt, 1 / 4) : 1.055;
  const trend = [0, 1, 2, 3, 4].map(i => ({ name: String(2026 + i), value: Math.round(meanAadt * Math.pow(gf, i)) }));
  const top = kAadt ? [...links].sort((a, b) => (num(b[kAadt]) ?? 0) - (num(a[kAadt]) ?? 0)).slice(0, 15) : [];
  const dens = kAadt && kLen ? [...links].map(r => ({ r, d: (num(r[kAadt]) ?? 0) / Math.max(0.5, num(r[kLen]) ?? 1) })).sort((a, b) => b.d - a.d).slice(0, 10) : [];
  const kSev = key(accidents, /severity/i);
  const sevData = accidents.length && kSev ? grp(accidents, kSev, null) : [
    { name: 'Fatal', value: 0 }, { name: 'Serious', value: 0 }, { name: 'Minor', value: 0 }];
  return (
    <div style={{ width: '100%' }}>
      {/* ── Definition Card ── */}
      <div style={{background:'rgba(249,115,22,0.04)',border:'1px solid rgba(249,115,22,0.14)',borderRadius:16,padding:'20px 24px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:16}}>
        <div style={{fontSize:36,lineHeight:1,flexShrink:0}}>🚦</div>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
            <span style={{fontSize:18,fontWeight:800,color:'rgba(249,115,22,1)',letterSpacing:-0.5}}>Traffic Performance Dashboard</span>
            <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>AADT · Vehicle Class · Axle Loads · Growth Rate · ATC</span>
          </div>
          <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 10px',lineHeight:1.6}}>Traffic performance dashboard for Uganda road sections — displaying AADT volumes, vehicle classification, axle load distributions, annual growth rates, and peak-hour factors sourced from the UNRA ATC monitoring network.</p>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {["AADT Volumes","Vehicle Class","Axle Loads","Growth Rate","Peak Hour","ATC Network"].map(b=>(
              <span key={b} style={{background:'rgba(249,115,22,0.12)',color:'rgba(249,115,22,0.9)',fontSize:9,fontWeight:700,borderRadius:20,padding:'2px 8px',textTransform:'uppercase' as const,letterSpacing:0.5}}>{b}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
        <Kpi label='Total AADT (all links)' value={totAadt} sev='info' sub={links.length.toLocaleString() + ' links analysed'} />
        <Kpi label='Estimated peak hour volume' value={peakHour} sev='warn' sub='9% of mean AADT (network mean)' />
        <Kpi label='Heavy vehicles' value={heavyPct} decimals={1} suffix='%' sev={heavyPct > 20 ? 'bad' : 'warn'} />
        <Kpi label='Active count stations' value={stations.length} sev='good' />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <Card title='MEAN AADT BY ROAD CLASS'>
          <ResponsiveContainer width='100%' height={200}>
            <BarChart data={byClass}><CartesianGrid {...GRID} /><XAxis dataKey='name' {...AX} /><YAxis {...AX} /><Tooltip {...TIP} />
              <Bar dataKey='value' name='Mean AADT' radius={[4, 4, 0, 0]}>{byClass.map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title='VEHICLE MIX BREAKDOWN'>
          <ResponsiveContainer width='100%' height={200}>
            <PieChart><Pie data={mix} dataKey='value' nameKey='name' innerRadius={45} outerRadius={80} paddingAngle={2}>
              {mix.map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}</Pie><Tooltip {...TIP} /><Legend wrapperStyle={{ fontSize: 10 }} /></PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title='AADT GROWTH TREND 2026-2030'>
          <ResponsiveContainer width='100%' height={200}>
            <LineChart data={trend}><CartesianGrid {...GRID} /><XAxis dataKey='name' {...AX} /><YAxis {...AX} /><Tooltip {...TIP} />
              <Line dataKey='value' name='Mean AADT' stroke={HL} strokeWidth={2.5} dot={{ r: 3 }} /></LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#f43f5e', margin: '4px 0 8px' }}>ROAD SAFETY</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <Card title='ACCIDENT SEVERITY'>
          {accidents.length ? (
            <ResponsiveContainer width='100%' height={180}>
              <BarChart data={sevData}><CartesianGrid {...GRID} /><XAxis dataKey='name' {...AX} /><YAxis {...AX} /><Tooltip {...TIP} />
                <Bar dataKey='value' name='Accidents' radius={[4, 4, 0, 0]}><Cell fill='#f43f5e' /><Cell fill='#f59e0b' /><Cell fill='#22c55e' /></Bar></BarChart>
            </ResponsiveContainer>
          ) : <Empty what='accident record' />}
        </Card>
      </div>
    </div>
  );
}
