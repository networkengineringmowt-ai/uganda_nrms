import { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Activity, BrainCircuit, Database, RefreshCw, Route } from 'lucide-react';

type Datum = { label?: string; year?: string | number; value?: number; links?: number; files?: number; records?: number; [key: string]: unknown };
type Infographic = {
  id?: string;
  infographic_id?: string;
  title: string;
  subtitle?: string;
  type?: string;
  visualization_type?: string;
  unit?: string;
  payload: Datum[] | Record<string, unknown>;
};
type DashboardData = {
  generated_at: string;
  reporting_at: string;
  model?: { name?: string; model_name?: string; version?: string; model_version?: string; algorithm?: string; metrics?: Record<string, unknown>; validation_metrics?: Record<string, unknown> };
  source_summary?: Datum[];
  source_coverage?: Datum[];
  infographics: Infographic[];
};

const COLORS = ['#5da7ff', '#5df486', '#ffd633', '#ff7038', '#f23a82', '#8b7bff', '#55d4ff', '#20c997', '#f59e0b', '#94a3b8'];
const panel: React.CSSProperties = { background: '#0b0f18', border: '1px solid #1d2637', borderRadius: 14 };

function numericValue(item: Datum): number {
  for (const key of ['value', 'links', 'files', 'records', 'km', 'samples']) {
    const value = item[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

function chartData(payload: Infographic['payload']): Datum[] {
  if (!Array.isArray(payload)) return [];
  return payload.map(item => ({ ...item, value: numericValue(item), label: String(item.label ?? item.year ?? 'Value') }));
}

function CompactTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#070a10', border: '1px solid #29364b', borderRadius: 8, padding: '8px 10px', boxShadow: '0 12px 30px rgba(0,0,0,.45)' }}>
      <div style={{ color: '#8d98ad', fontSize: 10 }}>{label ?? payload[0]?.payload?.label}</div>
      <div style={{ color: payload[0].color ?? '#5da7ff', fontSize: 13, fontWeight: 900 }}>
        {Number(payload[0].value).toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}
      </div>
    </div>
  );
}

function StatGraphic({ card }: { card: Infographic }) {
  const payload = card.payload as Record<string, unknown>;
  const value = Number(payload.value ?? 0);
  return (
    <div style={{ display: 'grid', gap: 12, alignContent: 'center', minHeight: 178 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Route size={28} color="#5da7ff" />
        <span style={{ color: '#5df486', fontSize: 10, fontWeight: 800 }}>{Number(payload.links ?? 0).toLocaleString()} links</span>
      </div>
      <div style={{ color: '#f5f8fc', fontSize: 35, lineHeight: 1, fontWeight: 950 }}>
        {value.toLocaleString(undefined, { maximumFractionDigits: 1 })} <small style={{ color: '#7f8ba1', fontSize: 13 }}>{card.unit}</small>
      </div>
      <div style={{ color: '#8490a5', fontSize: 11 }}>{Number(payload.paved_km ?? 0).toLocaleString()} km paved</div>
    </div>
  );
}

function DonutGraphic({ card }: { card: Infographic }) {
  const data = chartData(card.payload);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,.8fr) minmax(130px,1fr)', gap: 8, alignItems: 'center', minHeight: 178 }}>
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={data} dataKey="value" nameKey="label" innerRadius="48%" outerRadius="76%" paddingAngle={2} stroke="none">
            {data.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
          </Pie><Tooltip content={<CompactTooltip unit={card.unit} />} /></PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'grid', gap: 7 }}>
        {data.slice(0, 6).map((item, index) => (
          <div key={`${item.label}-${index}`} style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: COLORS[index % COLORS.length] }} />
            <span style={{ color: '#8490a5', fontSize: 9.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
            <strong style={{ color: '#dfe6f1', fontSize: 10 }}>{numericValue(item).toLocaleString()}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarGraphic({ card }: { card: Infographic }) {
  const data = chartData(card.payload).slice(0, 10);
  return (
    <div style={{ height: 185, marginTop: 7 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 9, right: 5, left: -23, bottom: 26 }}>
          <CartesianGrid stroke="#172031" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="label" interval={0} angle={-24} textAnchor="end" tick={{ fill: '#68748a', fontSize: 8 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: '#68748a', fontSize: 8 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CompactTooltip unit={card.unit} />} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>{data.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LineGraphic({ card }: { card: Infographic }) {
  const data = chartData(card.payload).map(item => ({ ...item, label: String(item.year ?? item.label) }));
  return (
    <div style={{ height: 185, marginTop: 7 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 9, right: 7, left: -23, bottom: 0 }}>
          <defs><linearGradient id="dynamicIri" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#55d4ff" stopOpacity=".32"/><stop offset="1" stopColor="#55d4ff" stopOpacity="0"/></linearGradient></defs>
          <CartesianGrid stroke="#172031" strokeDasharray="3 4" />
          <XAxis dataKey="label" tick={{ fill: '#68748a', fontSize: 8 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: '#68748a', fontSize: 8 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CompactTooltip unit={card.unit} />} />
          <Area type="monotone" dataKey="value" stroke="#55d4ff" strokeWidth={2.2} fill="url(#dynamicIri)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Graphic({ card, index }: { card: Infographic; index: number }) {
  const type = card.type ?? card.visualization_type ?? 'bars';
  return (
    <article style={{ ...panel, minWidth: 0, padding: '15px 16px', borderTop: `2px solid ${COLORS[index % COLORS.length]}` }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, color: '#edf2f8', fontSize: 12.5, fontWeight: 900 }}>{index + 1}. {card.title}</h3>
          <div style={{ marginTop: 4, color: '#657189', fontSize: 9.5 }}>{card.subtitle}</div>
        </div>
        <Activity size={14} color={COLORS[index % COLORS.length]} />
      </div>
      {type === 'stat' ? <StatGraphic card={card} /> : type === 'donut' ? <DonutGraphic card={card} /> : type === 'line' ? <LineGraphic card={card} /> : <BarGraphic card={card} />}
    </article>
  );
}

async function loadDashboard(): Promise<DashboardData> {
  try {
    const api = await fetch('/api/pms/dashboard', { headers: { Accept: 'application/json' } });
    if (api.ok && api.headers.get('content-type')?.includes('application/json')) return await api.json();
  } catch { /* static deployment fallback */ }
  const staticResponse = await fetch(`${import.meta.env.BASE_URL}data/pms_dashboard.json`);
  if (!staticResponse.ok) throw new Error(`Dashboard data unavailable (${staticResponse.status})`);
  return staticResponse.json();
}

export default function CrossSectionAnalytics() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    loadDashboard().then(value => { if (live) { setData(value); setError(''); } }).catch(reason => { if (live) setError(String(reason)); });
    return () => { live = false; };
  }, [reload]);
  const sources = useMemo(() => data?.source_summary ?? data?.source_coverage ?? [], [data]);
  const sourceFiles = sources.reduce((sum, row) => sum + Number(row.files ?? 0), 0);
  const sourceRecords = sources.reduce((sum, row) => sum + Number(row.records ?? 0), 0);

  if (error) return <div style={{ padding: 28, color: '#ff7b88' }}>Unable to load the NPMS engine: {error} <button onClick={() => setReload(v => v + 1)}>Retry</button></div>;
  if (!data) return <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#6f7c91' }}><RefreshCw size={24} className="animate-spin" /></div>;

  const modelName = data.model?.name ?? data.model?.model_name ?? 'Pavement DNN';
  const modelVersion = data.model?.version ?? data.model?.model_version ?? '';
  return (
    <div style={{ minHeight: '100%', padding: '16px 18px 30px', background: '#070b16', color: '#e7ebf2', overflowY: 'auto' }}>

        {/* ── Definition Card ── */}
        <div style={{background:'rgba(14,165,233,0.04)',border:'1px solid rgba(14,165,233,0.14)',borderRadius:16,padding:'20px 24px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{fontSize:36,lineHeight:1,flexShrink:0}}>📐</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
              <span style={{fontSize:18,fontWeight:800,color:'rgba(14,165,233,1)',letterSpacing:-0.5}}>Cross-Section Analytics</span>
              <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>Pavement Layers · ROMDAS GPR · FWD · Structural Model</span>
            </div>
            <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 10px',lineHeight:1.6}}>Cross-section analytics for Uganda road pavement — visualising layer composition, pavement depths from ROMDAS GPR surveys, FWD deflection basins, and structural capacity modelling for targeted rehabilitation design.</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {["Cross-Section","Layer Analysis","Pavement Depth","ROMDAS GPR","FWD Deflection","Structural Model"].map(b=>(
                <span key={b} style={{background:'rgba(14,165,233,0.12)',color:'rgba(14,165,233,0.9)',fontSize:9,fontWeight:700,borderRadius:20,padding:'2px 8px',textTransform:'uppercase' as const,letterSpacing:0.5}}>{b}</span>
              ))}
            </div>
          </div>
        </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 15, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#5da7ff', fontSize: 10, fontWeight: 900, letterSpacing: '.14em', textTransform: 'uppercase' }}>National Pavement Management System</div>
          <h2 style={{ margin: '5px 0 4px', fontSize: 20, fontWeight: 950 }}>Current Network Intelligence</h2>
          <div style={{ color: '#6f7a91', fontSize: 10.5 }}>Ten live infographics generated from cross-linked SQL tables · reporting {data.reporting_at}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ ...panel, padding: '8px 11px', display: 'flex', alignItems: 'center', gap: 7 }}><BrainCircuit size={14} color="#8b7bff"/><span style={{ color: '#9aa6ba', fontSize: 9.5 }}><b style={{ color: '#dbe3ef' }}>{modelName}</b> {modelVersion}</span></div>
          <div style={{ ...panel, padding: '8px 11px', display: 'flex', alignItems: 'center', gap: 7 }}><Database size={14} color="#5df486"/><span style={{ color: '#9aa6ba', fontSize: 9.5 }}>{sourceFiles.toLocaleString()} files · {sourceRecords.toLocaleString()} registered records</span></div>
        </div>
      </div>
      <section aria-label="Ten NPMS infographics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 11 }}>
        {data.infographics.map((card, index) => <Graphic key={card.id ?? card.infographic_id ?? index} card={card} index={index} />)}
      </section>
      <div style={{ marginTop: 12, color: '#46536a', fontSize: 9 }}>Generated {data.generated_at} · values include source lineage, reporting timestamp, method and confidence in the backend.</div>
    </div>
  );
}
