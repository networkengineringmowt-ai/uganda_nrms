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

export default function InventoryDashboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { let d = false;
    (async () => { const live = await q('road_links');
      const r = live.length ? live : await gjRows('traffic_predictions.geojson');
      if (!d) setRows(r); })();
    return () => { d = true; };
  }, []);
  if (rows === null) return <div style={{ padding: 20, color: '#64748b', fontSize: 12 }}>Loading road register…</div>;

        {/* ── Definition Card ── */}
        <div style={{background:'rgba(139,92,246,0.04)',border:'1px solid rgba(139,92,246,0.14)',borderRadius:16,padding:'20px 24px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{fontSize:36,lineHeight:1,flexShrink:0}}>📋</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
              <span style={{fontSize:18,fontWeight:800,color:'rgba(139,92,246,1)',letterSpacing:-0.5}}>Road Inventory Dashboard</span>
              <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>Pavement Type · Width · Shoulders · Signs · Structures · UNRA</span>
            </div>
            <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 10px',lineHeight:1.6}}>Detailed road inventory dashboard for Uganda's national road sections — capturing pavement type, carriageway width, shoulder condition, road markings, signs, and structures in alignment with the UNRA inventory classification system.</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {["Pavement Type","Road Width","Shoulders","Signs & Markings","Structures","UNRA Inventory"].map(b=>(
                <span key={b} style={{background:'rgba(139,92,246,0.12)',color:'rgba(139,92,246,0.9)',fontSize:9,fontWeight:700,borderRadius:20,padding:'2px 8px',textTransform:'uppercase' as const,letterSpacing:0.5}}>{b}</span>
              ))}
            </div>
          </div>
        </div>
  if (!rows.length) return <Empty what='road register' />;
  const kLen = nkey(rows, /length|_km|km$/i); const kClass = key(rows, /road_class|class|func/i);
  const kSurf = key(rows, /surface|pav/i); const kName = key(rows, /link_name|road_name|name/i);
  const kId = key(rows, /link_id|road_no|^id$|code/i); const kDist = key(rows, /district|region/i);
  const lenOf = (r: Row) => kLen ? (num(r[kLen]) ?? 0) : 0;
  const totKm = rows.reduce((a, r) => a + lenOf(r), 0);
  const isPaved = (r: Row) => { if (kSurf) return /paved|bitum|asphalt|seal|tar/i.test(String(r[kSurf] ?? ''));
    return kClass ? /^a/i.test(String(r[kClass] ?? '')) : false; };
  const pavedKm = rows.filter(isPaved).reduce((a, r) => a + lenOf(r), 0);
  const byClass = grp(rows, kClass, kLen);
  const bySurf = kSurf ? grp(rows, kSurf, kLen) : [
    { name: 'Paved', value: Math.round(pavedKm * 10) / 10 }, { name: 'Unpaved', value: Math.round((totKm - pavedKm) * 10) / 10 }];
  const byDist = kDist ? grp(rows, kDist, kLen) : [];
  const reg = [...rows].sort((a, b) => lenOf(b) - lenOf(a)).slice(0, 20);
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
        <Kpi label='Total network' value={totKm} decimals={1} suffix=' km' sev='info' sub={rows.length.toLocaleString() + ' road links'} />
        <Kpi label='Paved' value={pavedKm} decimals={1} suffix=' km' sev='good' sub={totKm ? (pavedKm / totKm * 100).toFixed(1) + '% of network' : ''} />
        <Kpi label='Unpaved' value={totKm - pavedKm} decimals={1} suffix=' km' sev='warn' sub={totKm ? ((totKm - pavedKm) / totKm * 100).toFixed(1) + '% of network' : ''} />
        <Kpi label='Road links registered' value={rows.length} sev='info' />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <Card title='LENGTH BY FUNCTIONAL CLASS (KM)'>
          <ResponsiveContainer width='100%' height={200}>
            <BarChart data={byClass}><CartesianGrid {...GRID} /><XAxis dataKey='name' {...AX} /><YAxis {...AX} /><Tooltip {...TIP} />
              <Bar dataKey='value' name='Km' radius={[4, 4, 0, 0]}>{byClass.map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}</Bar></BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title='PAVED VS UNPAVED / SURFACE TYPE (KM)'>
          <ResponsiveContainer width='100%' height={200}>
            <PieChart><Pie data={bySurf} dataKey='value' nameKey='name' innerRadius={45} outerRadius={80} paddingAngle={2}>
              {bySurf.map((_, i) => <Cell key={i} fill={i === 0 ? '#22c55e' : PAL[(i + 2) % PAL.length]} />)}</Pie><Tooltip {...TIP} /><Legend wrapperStyle={{ fontSize: 10 }} /></PieChart>
          </ResponsiveContainer>
        </Card>
        {byDist.length > 0 && (
          <Card title='NETWORK KM BY DISTRICT / REGION'>
            <ResponsiveContainer width='100%' height={200}>
              <BarChart data={byDist} layout='vertical'><CartesianGrid {...GRID} /><XAxis type='number' {...AX} /><YAxis type='category' dataKey='name' width={90} {...AX} /><Tooltip {...TIP} />
                <Bar dataKey='value' name='Km' fill='#38bdf8' radius={[0, 4, 4, 0]} /></BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
      <Card title='ROAD REGISTER (LONGEST LINKS FIRST - FULL REGISTER IN EXHAUSTIVE TABLES TAB)'>
        <div style={{ overflow: 'auto', maxHeight: 380 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Link ID', 'Name', 'Class', 'Surface', 'Length km', 'District/Region'].map(h => <th key={h} style={TBL_TH}>{h}</th>)}</tr></thead>
            <tbody>{reg.map((r, i) => (
              <tr key={i}>
                <td style={{ ...TBL_TD, fontWeight: 700 }}>{String(kId ? r[kId] : i + 1)}</td>
                <td style={{ ...TBL_TD, color: '#f1f5f9', fontWeight: 700 }}>{String(kName ? r[kName] : '-')}</td>
                <td style={TBL_TD}>{String(kClass ? r[kClass] : '-')}</td>
                <td style={TBL_TD}>{kSurf ? String(r[kSurf]) : isPaved(r) ? 'Paved' : 'Unpaved'}</td>
                <td style={{ ...TBL_TD, color: HL, fontWeight: 700 }}>{fmtN(lenOf(r), 1)}</td>
                <td style={TBL_TD}>{String(kDist ? r[kDist] ?? '-' : '-')}</td></tr>))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
