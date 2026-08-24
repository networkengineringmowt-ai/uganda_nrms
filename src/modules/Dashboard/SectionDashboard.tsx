import { useState, useEffect, lazy, Suspense } from 'react';
import { RefreshCw } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import { supabase } from '../../lib/supabase';

/* ── Section metadata ─────────────────────────────────────────────────────── */
const DEFS: Record<string, { title: string; body: string; icon: string }> = {
  rms:          { icon: '🔧', title: 'Road Maintenance System',             body: 'Tracks maintenance activities, work orders, and road condition improvement across the national road network.' },
  pms:          { icon: '📐', title: 'Pavement Management System',          body: 'IRI-based pavement condition surveys, roughness analysis, and treatment recommendations for Uganda\'s classified roads.' },
  roadcondition:{ icon: '🛣',  title: 'Road Condition Assessment',           body: 'Visual and instrumental road condition data including cracking, rutting, potholing, and surface distress indices.' },
  bms:          { icon: '🌉', title: 'Bridge Management System',             body: 'Inventory, structural inspection reports, load ratings, and maintenance prioritisation for bridges and culverts.' },
  traffic:      { icon: '🚦', title: 'Traffic Information System',           body: 'Automatic Traffic Counter data, AADT computation, vehicle classification, and seasonal adjustment factors.' },
  atc:          { icon: '📡', title: 'ATC Station Network',                  body: '25 Automatic Traffic Counters (15 legacy + 10 new) providing real-time classified volume data across the national road network.' },
  ntis:         { icon: '📈', title: 'National Traffic Information System',  body: 'AADT trends, growth forecasting, axle-load monitoring, and road safety analysis for Uganda\'s national corridors.' },
  npms:         { icon: '🗺',  title: 'National PMS',                         body: 'Strategic-level pavement performance indicators and network-wide condition distribution across all road classes.' },
  nbms:         { icon: '🗂',  title: 'National BMS',                         body: 'Consolidated bridge and structure data across all road agencies — UNRA, URF, district, and urban authorities.' },
  network:      { icon: '🌐', title: 'Road Network Overview',                body: 'The classified road network: national, district, urban, and community access roads, total extent and agency responsibilities.' },
  roadreserve:  { icon: '📏', title: 'Road Reserve Management',              body: 'Surveyed road reserve boundaries, encroachment detection, gazette status, and reserve width compliance monitoring.' },
  gisenterprise:{ icon: '🗺',  title: 'GIS Enterprise Platform',             body: 'Spatial data infrastructure, GIS layers, aerial imagery, and geospatial analysis tools for road asset management.' },
  bridgeworks:  { icon: '🏗',  title: 'Bridge Works Contracts',               body: 'Active and completed bridge construction and rehabilitation contracts, progress tracking, and financial performance.' },
  pim:          { icon: '📋', title: 'Project Information Management',       body: 'Capital investment project register, milestone tracking, contractor performance, and disbursement records.' },
  budget:       { icon: '💰', title: 'Budget Management',                    body: 'MTEF budget allocations, approved estimates, actual expenditure, and funding gap analysis by programme and road agency.' },
  lifecycle:    { icon: '♻',  title: 'Lifecycle Cost Analysis',              body: 'HDM-4 based life-cycle costing, NPV/BCR computation, and optimal maintenance strategy selection over a 20-year horizon.' },
  roadatlas:    { icon: '📖', title: 'Road Atlas',                           body: 'Official Uganda road atlas with classified inventory, road numbers, chainage references, and district-level statistics.' },
  roadvideo:    { icon: '🎥', title: 'Road Video Survey',                    body: 'Continuous video log survey footage referenced to road chainage, used for remote visual condition assessment.' },
  projects:     { icon: '🏛',  title: 'Projects & Programmes',                body: 'Capital, maintenance, and safety programmes funded by GOU, World Bank, AfDB, JICA, and other development partners.' },
  casestudies:  { icon: '📝', title: 'Case Studies',                         body: 'Documented project outcomes, best-practice engineering interventions, and value-for-money analyses.' },
  admin:        { icon: '⚙',  title: 'Administration',                       body: 'User management, access control, audit logs, system configuration, and the platform architecture mind map.' },
  hdm4:         { icon: '🔬', title: 'HDM-4 Analysis',                       body: 'Highway Development and Management model runs for road investment planning and budget optimisation.' },
  ducar:        { icon: '🌿', title: 'DUCAR Roads',                          body: 'District, Urban, Community Access Road network data — condition, coverage, and maintenance funding by local government.' },
  sources:      { icon: '📚', title: 'Sources & Evidence',                   body: 'Evidence catalogue, tabular summaries, and the platform data dictionary underpinning every figure shown across the site.' },
  downloads:    { icon: '⬇',  title: 'Downloads',                            body: 'Bulk exports of structures, road network, and survey data in CSV, KML, and GeoJSON formats.' },
};

/* ── Shared styles ────────────────────────────────────────────────────────── */
const SX = {
  wrap:   { padding: '18px 20px', maxWidth: 1300, margin: '0 auto' } as React.CSSProperties,
  defCard:{ background: 'rgba(15,15,18,0.9)', border: '1px solid rgba(77,159,255,0.10)',
            borderLeft: '3px solid', borderRadius: 8, padding: '14px 18px',
            marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' } as React.CSSProperties,
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
            gap: 10, marginBottom: 18 } as React.CSSProperties,
  kpi:    { background: 'rgba(10,10,14,0.92)', border: '1px solid rgba(255,255,255,0.06)',
            borderLeft: '3px solid', borderRadius: 7, padding: '12px 15px' } as React.CSSProperties,
  card:   { background: 'rgba(10,10,14,0.92)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8, padding: 16, marginBottom: 16 } as React.CSSProperties,
  grid2:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 } as React.CSSProperties,
  h3:     { fontSize: 11, fontWeight: 700, letterSpacing: '.5px',
            textTransform: 'uppercase' as const, marginBottom: 12,
            color: 'rgba(200,210,255,0.7)' } as React.CSSProperties,
  empty:  { textAlign: 'center' as const, padding: 40,
            color: 'rgba(148,163,184,0.4)', fontSize: 13 } as React.CSSProperties,
};

/* ── KPI Card ─────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, unit, accent, sub }: {
  label: string; value: string | number | null | undefined;
  unit?: string; accent: string; sub?: string;
}) {
  const display = value != null ? value : '—';
  return (
    <div style={{ ...SX.kpi, borderLeftColor: accent }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.5px',
                    textTransform: 'uppercase', color: 'rgba(148,163,184,0.55)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: accent, margin: '3px 0' }}>
        {display}
        {unit && <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 3 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)' }}>{sub}</div>}
    </div>
  );
}

/* ── Real Recharts bar chart — ticks, axes, legend, tooltip ─────────────────── */
const CHART_TIP = { contentStyle: { background: '#0f1923', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 11 }, labelStyle: { color: '#e2e8f0' } };
const CHART_AX = { tick: { fontSize: 10, fill: '#94a3b8' }, axisLine: { stroke: 'rgba(255,255,255,0.15)' }, tickLine: false as const };
const CHART_GRID = { stroke: 'rgba(255,255,255,0.06)' };
const PAL = ['#00f5ff', '#00ff88', '#ffd23f', '#ff6b35', '#b967ff', '#4d9fff', '#00d4aa', '#ff2d78'];

function BarChartCard({ data, title, accent, seriesName = 'Value' }: {
  data: Array<{ label: string; value: number }>;
  title: string;
  accent: string;
  seriesName?: string;
}) {
  const clean = (data ?? []).filter(d => d != null && d.value != null && !isNaN(d.value));
  if (clean.length === 0) return (
    <div style={SX.card}>
      <div style={SX.h3}>{title}</div>
      <div style={SX.empty}>No chart data available</div>
    </div>
  );
  return (
    <div style={SX.card}>
      <div style={SX.h3}>{title}</div>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={clean} margin={{ top: 4, right: 8, left: -12, bottom: clean.length > 5 ? 34 : 4 }}>
          <CartesianGrid {...CHART_GRID} vertical={false} />
          <XAxis dataKey="label" {...CHART_AX} angle={clean.length > 5 ? -30 : 0} textAnchor={clean.length > 5 ? 'end' : 'middle'} interval={0} height={clean.length > 5 ? 46 : 22} />
          <YAxis {...CHART_AX} />
          <Tooltip {...CHART_TIP} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey="value" name={seriesName} radius={[4, 4, 0, 0]}>
            {clean.map((_, i) => <Cell key={i} fill={i === 0 ? accent : PAL[i % PAL.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── No-data placeholder ──────────────────────────────────────────────────── */
function NoData({ label = 'No data available yet' }: { label?: string }) {
  return (
    <div style={SX.card}>
      <div style={{ ...SX.empty, padding: 30 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
        <div>{label}</div>
        <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.3)', marginTop: 4 }}>
          Data will appear here once records are loaded into Supabase.
        </div>
      </div>
    </div>
  );
}

/* ── Spinner ──────────────────────────────────────────────────────────────── */
function Spinner({ label }: { label: string }) {
  return (
    <div style={{ ...SX.empty, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <RefreshCw size={13} style={{ animation: 'sd-spin 1s linear infinite' }} />
      {label}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── Budget Dashboard (KPIs + chart only — table lives in Exhaustive Tables) ── */
/* ─────────────────────────────────────────────────────────────────────────── */
function BudgetDashboard({ accent }: { accent: string }) {
  const [kpis, setKpis] = useState<{ allocated: number; spent: number; gap: number; lines: number } | null>(null);
  const [byProg, setByProg] = useState<Array<{ label: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [allocR, spentR, progR] = await Promise.all([
          supabase.from('budget_allocations').select('amount_ugx').limit(2000),
          supabase.from('budget_expenditures').select('amount_ugx').limit(2000),
          supabase.from('budget_allocations').select('programme,amount_ugx').limit(2000),
        ]);
        const toB = (v: number) => Math.round(v / 1e9 * 10) / 10;
        const totalAlloc = (allocR.data ?? []).reduce((s: number, r: any) => s + (r.amount_ugx ?? 0), 0);
        const totalSpent = (spentR.data ?? []).reduce((s: number, r: any) => s + (r.amount_ugx ?? 0), 0);
        const progMap: Record<string, number> = {};
        (progR.data ?? []).forEach((r: any) => {
          const k = r.programme ?? 'Other';
          progMap[k] = (progMap[k] ?? 0) + (r.amount_ugx ?? 0);
        });
        setKpis({
          allocated: toB(totalAlloc),
          spent: toB(totalSpent),
          gap: toB(Math.max(0, totalAlloc - totalSpent)),
          lines: (allocR.data ?? []).length,
        });
        setByProg(
          Object.entries(progMap)
            .map(([label, value]) => ({ label, value: toB(value) }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8),
        );
      } catch {
        setKpis(null);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner label="Loading budget data…" />;
  if (!kpis || kpis.lines === 0) return <NoData label="No budget allocation records found in Supabase" />;

  return (
    <>
      <div style={SX.kpiRow}>
        <KpiCard label="Total Allocated" value={kpis.allocated} unit="Bn UGX" accent={accent}   />
        <KpiCard label="Total Spent"     value={kpis.spent}     unit="Bn UGX" accent="#00ff88" />
        <KpiCard label="Funding Gap"     value={kpis.gap}       unit="Bn UGX" accent="#ff0040" />
        <KpiCard label="Budget Lines"    value={kpis.lines.toLocaleString()}  accent="#ffee00" />
      </div>
      <BarChartCard data={byProg} title="Allocation by Programme (Bn UGX)" accent={accent} seriesName="Bn UGX" />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── Road Reserve Dashboard ───────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────── */
function RoadReserveDashboard({ accent }: { accent: string }) {
  const [kpis, setKpis] = useState<{ total: number; gazetted: number; encroached: number; surveyed: number } | null>(null);
  const [byDist, setByDist] = useState<Array<{ label: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [totR, gazR, encR, survR, distR] = await Promise.all([
          supabase.from('road_reserves').select('*', { count: 'exact', head: true }),
          supabase.from('road_reserves').select('*', { count: 'exact', head: true }).eq('gazette_status', 'Gazetted'),
          supabase.from('road_reserves').select('*', { count: 'exact', head: true }).gt('encroachment_count', 0),
          supabase.from('road_reserves').select('*', { count: 'exact', head: true }).eq('survey_status', 'Surveyed'),
          supabase.from('road_reserves').select('district').limit(1000),
        ]);
        const distMap: Record<string, number> = {};
        (distR.data ?? []).forEach((r: any) => {
          const k = r.district ?? 'Unknown';
          distMap[k] = (distMap[k] ?? 0) + 1;
        });
        setKpis({
          total: totR.count ?? 0,
          gazetted: gazR.count ?? 0,
          encroached: encR.count ?? 0,
          surveyed: survR.count ?? 0,
        });
        setByDist(
          Object.entries(distMap)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8),
        );
      } catch {
        setKpis(null);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner label="Loading road reserve data…" />;
  if (!kpis || kpis.total === 0) return <NoData label="No road reserve records found in Supabase" />;

  return (
    <>
      <div style={SX.kpiRow}>
        <KpiCard label="Total Reserves" value={kpis.total.toLocaleString()}     accent={accent}   />
        <KpiCard label="Gazetted"       value={kpis.gazetted.toLocaleString()}  accent="#00ff88"  />
        <KpiCard label="Encroached"     value={kpis.encroached.toLocaleString()} accent="#ff0040" />
        <KpiCard label="Surveyed"       value={kpis.surveyed.toLocaleString()}  accent="#ffee00"  />
      </div>
      <BarChartCard data={byDist} title="Reserves by District (Top 8)" accent={accent} seriesName="Reserves" />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── NTIS Dashboard ───────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────── */
function NTISDashboard({ accent }: { accent: string }) {
  const [kpis, setKpis] = useState<{ stations: number; avgAadt: number; fatalities: number; blackspots: number } | null>(null);
  const [byRegion, setByRegion] = useState<Array<{ label: string; value: number }>>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [stR, fatR, bsR] = await Promise.all([
          supabase.from('atc_stations').select('station_id,aadt,region').limit(500),
          supabase.from('road_accidents').select('fatalities').limit(2000),
          supabase.from('road_blackspots').select('*', { count: 'exact', head: true }),
        ]);
        const stations = stR.data ?? [];
        const avg = stations.length
          ? Math.round(stations.reduce((s: number, r: any) => s + (r.aadt ?? 0), 0) / stations.length)
          : 0;
        const totalFat = (fatR.data ?? []).reduce((s: number, r: any) => s + (r.fatalities ?? 0), 0);
        const regMap: Record<string, { sum: number; count: number }> = {};
        stations.forEach((r: any) => {
          const k = r.region ?? 'Unknown';
          if (!regMap[k]) regMap[k] = { sum: 0, count: 0 };
          regMap[k].sum += r.aadt ?? 0;
          regMap[k].count += 1;
        });
        setKpis({ stations: stations.length, avgAadt: avg, fatalities: totalFat, blackspots: bsR.count ?? 0 });
        setByRegion(
          Object.entries(regMap)
            .map(([label, { sum, count }]) => ({ label, value: Math.round(sum / count) }))
            .sort((a, b) => b.value - a.value),
        );
      } catch {
        setKpis(null);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner label="Loading NTIS data…" />;
  if (!kpis || kpis.stations === 0) return <NoData label="No ATC station records found in Supabase" />;

  return (
    <>
      <div style={SX.kpiRow}>
        <KpiCard label="ATC Stations"    value={kpis.stations}                 accent={accent}   />
        <KpiCard label="Avg AADT"        value={kpis.avgAadt.toLocaleString()} accent="#00ff88"  unit="veh/day" />
        <KpiCard label="Road Fatalities" value={kpis.fatalities.toLocaleString()} accent="#ff0040" />
        <KpiCard label="Blackspots"      value={kpis.blackspots}               accent="#ff9900"  />
      </div>
      <BarChartCard data={byRegion} title="Avg AADT by Region" accent={accent} seriesName="Avg AADT" />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── Signature block — the rich, chart-heavy per-section dashboards that     */
/* ── already live under ./sections (Recharts, definition cards, no tables)   */
/* ─────────────────────────────────────────────────────────────────────────── */
const LazyTraffic     = lazy(() => import('./sections/TrafficDashboard'));
const LazyPavement    = lazy(() => import('./sections/PavementDashboard'));
const LazyStructures  = lazy(() => import('./sections/StructuresDashboard'));
const LazyMaintenance = lazy(() => import('./sections/MaintenanceDashboard'));
const LazyInventory   = lazy(() => import('./sections/InventoryDashboard'));
const LazyPriority    = lazy(() => import('./sections/PriorityDashboard'));
const LazyDrainage    = lazy(() => import('./sections/DrainageDashboard'));

function SectionSignatureBlock({ sectionId, accent }: { sectionId: string; accent: string }) {
  const C = sectionId === 'tis' ? LazyTraffic
    : sectionId === 'pms' ? LazyPavement
    : sectionId === 'bms' ? LazyStructures
    : (sectionId === 'ducar' || sectionId === 'projects') ? LazyMaintenance
    : sectionId === 'rms' ? LazyInventory
    : sectionId === 'pim' ? LazyPriority
    : null;

  if (sectionId === 'budget') return <div style={{ marginBottom: 14 }}><BudgetDashboard accent={accent} /></div>;
  if (sectionId === 'reserve') return <div style={{ marginBottom: 14 }}><RoadReserveDashboard accent={accent} /></div>;
  if (sectionId === 'ntis') return <div style={{ marginBottom: 14 }}><NTISDashboard accent={accent} /></div>;
  if (!C) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      <Suspense fallback={<div style={{ padding: 16, color: '#64748b', fontSize: 12 }}>Loading section dashboard…</div>}>
        <C />
        {sectionId === 'bms' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#38bdf8', margin: '10px 0 8px' }}>DRAINAGE STRUCTURES</div>
            <LazyDrainage />
          </>
        )}
      </Suspense>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── Section sub-tabs: Dashboard | Interactive Map | Exhaustive Tables |      */
/* ── Deep Analytics | SQL Database & Schema | Data Capture                   */
/* ─────────────────────────────────────────────────────────────────────────── */
import { InsightGrid } from './InsightGrid';
import { SchemaExplorer } from './SchemaExplorer';
import { SectionMap } from './SectionMap';
import { ExhaustiveTables } from './ExhaustiveTables';
import { DeepAnalysisTables } from './DeepAnalysisTables';

// Normalises a sidebar sectionId to the id used by ExhaustiveTables / DeepAnalysisTables
// / SchemaExplorer's underlying table specs, where the two differ.
const SECTION_ALIAS: Record<string, string> = {
  traffic: 'tis', atc: 'tis', condition: 'pms', roadcondition: 'pms', npms: 'pms',
  registry: 'bms', inspections: 'bms', bridgeworks: 'bms', nbms: 'bms',
  maintenance: 'ducar',
  roadreserve: 'reserve',
  gisenterprise: 'gis',
};

const SUBTABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'map', label: 'Interactive Map' },
  { id: 'tables', label: 'Exhaustive Tables' },
  { id: 'analytics', label: 'Deep Analytics' },
  { id: 'sql', label: 'SQL Database & Schema' },
  { id: 'capture', label: 'Data Capture' },
];
// TIS (Traffic Information System) gets its own Road Safety sub-tab, inserted
// right after Dashboard — kept out of the Dashboard tab so that one stays
// traffic-only (AADT/station data), not mixed with accident/blackspot stats.
function subtabsFor(sid: string) {
  if (sid !== 'tis') return SUBTABS;
  const out = [...SUBTABS];
  out.splice(1, 0, { id: 'safety', label: 'Road Safety' });
  return out;
}

function SectionSubTabs({ sectionId, accent }: { sectionId: string; accent: string }) {
  const [tab, setTab] = useState('dashboard');
  const sid = SECTION_ALIAS[sectionId] ?? sectionId;
  const tabs = subtabsFor(sid);
  return (
    <div style={{ width: '100%' }}>
      <style>{`@keyframes sd-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 10, position: 'sticky', top: 0, zIndex: 20, background: 'rgba(2,6,23,0.92)', backdropFilter: 'blur(8px)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '9px 16px', fontSize: 11, fontWeight: 800, letterSpacing: '0.07em',
              background: tab === t.id ? 'rgba(0,245,255,0.06)' : 'transparent',
              border: 'none', borderBottom: tab === t.id ? '2px solid ' + accent : '2px solid transparent',
              cursor: 'pointer', fontFamily: 'inherit',
              color: tab === t.id ? accent : 'rgba(148,163,184,0.7)', borderRadius: '8px 8px 0 0' }}>
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>
      {tab === 'dashboard' && (<><SectionSignatureBlock sectionId={sid} accent={accent} /><InsightGrid sectionId={sid} accent={accent} /><SectionExtra sectionId={sid} slot="dashboard" /></>)}
      {tab === 'safety' && sid === 'tis' && (
        <Suspense fallback={<div style={{ padding: 20, color: '#64748b', fontSize: 12 }}>Loading road safety data...</div>}>
          <TrafficRoadSafetyLegacy />
        </Suspense>
      )}
      {tab === 'map' && (<><SectionExtra sectionId={sid} slot="map" />
        <div style={{ marginTop: 18 }}><SectionMap sectionId={sid} accent={accent} /></div></>)}
      {tab === 'tables' && (<><ExhaustiveTables sectionId={sid} accent={accent} /><SectionExtra sectionId={sid} slot="tables" /></>)}
      {tab === 'analytics' && (<><DeepAnalysisTables sectionId={sid} accent={accent} /><SectionExtra sectionId={sid} slot="analytics" /></>)}
      {tab === 'sql' && <SchemaExplorer sectionId={sid} accent={accent} />}
      {tab === 'capture' && (
        <>
          <SectionExtra sectionId={sid} slot="capture" />
          <Suspense fallback={<div style={{ padding: 20, color: '#64748b', fontSize: 12 }}>Loading data capture module…</div>}>
            <LazyDataCaptureHub />
          </Suspense>
        </>
      )}
    </div>
  );
}

const LazyDataCaptureHub = lazy(() => import('../DataEntry/DataCaptureHub'));

// — Traffic legacy content ————————————————————
const LazyTrafficLegacy = lazy(() => import('../Traffic/TrafficLegacyContent'));
function TrafficMapLegacy() { return <LazyTrafficLegacy initialTab="map" hideTabBar />; }
function TrafficCountsLegacy() { return <LazyTrafficLegacy initialTab="counts" hideTabBar />; }
function TrafficStationsLegacy() { return <LazyTrafficLegacy initialTab="stations" hideTabBar />; }
function TrafficTrendsLegacy() { return <LazyTrafficLegacy initialTab="trends" hideTabBar />; }
function TrafficRoadSafetyLegacy() { return <LazyTrafficLegacy initialTab="roadsafety" hideTabBar />; }
const LazyGrowthFactors = lazy(() => import('../Traffic/GrowthFactorsPanel'));
const LazyOverloading = lazy(() => import('../Traffic/OverloadingSection'));
const LazyOprc = lazy(() => import('../../components/sections/OprcSection'));
const LazyNdpiv = lazy(() => import('../../components/sections/NdpivSection'));

// — RMS legacy content ————————————————————
const LazyRoadNetworkMap = lazy(() => import('../RoadNetwork/RoadNetworkView'));
const LazyNetworkStory = lazy(() => import('../NetworkStory/NetworkStory'));
const LazyRoadInventoryTbl = lazy(() => import('../RMS/RoadInventory'));

// — PMS legacy content ————————————————————
const PMS_CrossSectionAnalytics = lazy(() => import('../PMS/CrossSectionAnalytics'));
const PMS_RoadConditionView = lazy(() => import('../RoadCondition/RoadConditionView'));
const PMS_PavementCatalogue = lazy(() => import('../PMS/PavementCatalogue'));
const PMS_AIVisionDashboard = lazy(() => import('../PMS/AIVisionDashboard'));
const PMS_DigitalTwin = lazy(() => import('../PMS/DigitalTwin'));
const PMS_LifecycleView = lazy(() => import('../Lifecycle/LifecycleView'));
const PMS_RoadVideoView = lazy(() => import('../RoadVideoView/RoadVideoView'));
function PmsConditionMapLegacy() { return <PMS_RoadConditionView activeTab={'conditionmap' as any} embedded />; }
function PmsInventoryLegacy() { return <PMS_RoadConditionView activeTab={'inventory' as any} embedded />; }
function PmsAnalyticsViewLegacy() { return <PMS_RoadConditionView activeTab={'analytics' as any} embedded />; }
function PmsAgeLegacy() { return <PMS_RoadConditionView activeTab={'age' as any} embedded />; }
function PmsFwdLegacy() { return <PMS_RoadConditionView activeTab={'fwd' as any} embedded />; }

// — BMS legacy content ————————————————————
const BMS_GISMap = lazy(() => import('../GISMap/GISMapView'));
const BMS_Registry = lazy(() => import('../Registry/StructureRegistry'));
const BMS_Inspections = lazy(() => import('../Inspections/InspectionManagement'));
const BMS_Condition = lazy(() => import('../Condition/ConditionAssessment'));
const BMS_Maintenance = lazy(() => import('../Maintenance/MaintenanceWorks'));
const BMS_Analytics = lazy(() => import('../Analytics/Analytics'));
const BMS_PhotoTwin = lazy(() => import('../PhotoTwin/PhotoTwin'));
const BMS_BridgeWorks = lazy(() => import('../BridgeWorks/BridgeWorksSection'));
const BMS_Critical = lazy(() => import('../Condition/CriticalStructures'));

// — DUCAR legacy content ————————————————————
const LazyDucarOverview = lazy(() => import('../DUCAR/DucarOverviewPanel'));

// — PIM legacy content ————————————————————
const LazyPimLegacy = lazy(() => import('../PIM/PimLegacyContent'));
function PimBudgetLegacy() { return <LazyPimLegacy initialTab="budget" hideTabBar />; }
function PimFrameworkLegacy() { return <LazyPimLegacy initialTab="pim" hideTabBar />; }
function PimPppLegacy() { return <LazyPimLegacy initialTab="ppp" hideTabBar />; }
function PimDonorLegacy() { return <LazyPimLegacy initialTab="donor" hideTabBar />; }
function PimNdpivLegacy() { return <LazyPimLegacy initialTab="ndpiv" hideTabBar />; }

// — GIS Enterprise legacy content ————————————————————
const LazyGisLegacy = lazy(() => import('../GisEnterprise/GisEnterpriseLegacyContent'));
function GisMapLegacy() { return <LazyGisLegacy hideTabBar />; }

// — Road Reserve legacy content ————————————————————
const LazyReserveLegacy = lazy(() => import('../RoadReserve/RoadReserveLegacyContent'));
function ReserveOverviewLegacy() { return <LazyReserveLegacy initialTab="overview" hideTabBar />; }
function ReserveMapLegacy() { return <LazyReserveLegacy initialTab="map" hideTabBar />; }
function ReserveRegisterLegacy() { return <LazyReserveLegacy initialTab="register" hideTabBar />; }
function ReserveGazetteLegacy() { return <LazyReserveLegacy initialTab="gazette" hideTabBar />; }
function ReservePermitsLegacy() { return <LazyReserveLegacy initialTab="permits" hideTabBar />; }

// — Global Case Studies legacy content ————————————————————
const LazyCaseStudiesLegacy = lazy(() => import('../GlobalCaseStudies/GlobalCaseStudiesLegacyContent'));
function CaseStudiesWorldMapLegacy() { return <LazyCaseStudiesLegacy initialTab="worldmap" hideTabBar />; }
function CaseStudiesComparisonLegacy() { return <LazyCaseStudiesLegacy initialTab="analytics" hideTabBar />; }
function CaseStudiesMatrixLegacy() { return <LazyCaseStudiesLegacy initialTab="matrix" hideTabBar />; }
function CaseStudiesNarrativeLegacy() { return <LazyCaseStudiesLegacy initialTab="casestudies" hideTabBar />; }
function CaseStudiesLessonsLegacy() { return <LazyCaseStudiesLegacy initialTab="lessons" hideTabBar />; }

// — Admin: Interactive Map = the Platform Mind Map ————————————————————
const ADMIN_MindMap = lazy(() => import('../MindMap/MindMapSection'));
const ADMIN_Identity = lazy(() => import('../Admin/IdentityManager'));
const ADMIN_Activity = lazy(() => import('../Admin/ActivityLog'));
const ADMIN_DataAudit = lazy(() => import('../DataAudit/DataAuditPanel'));
const ADMIN_PendingSubmissions = lazy(() => import('../DataEntry/PendingSubmissions').then(m => ({ default: m.PendingSubmissions })));

// — Sources & Evidence ————————————————————
const SRC_Catalogue = lazy(() => import('../Sources/SourcesCatalogueSection'));
const SRC_Tabular = lazy(() => import('../Sources/TabularSummaries'));
const SRC_Dictionary = lazy(() => import('../Sources/DataDictionary'));

// — Downloads / Road Atlas / Road Video / Bridge Works / Budget / Lifecycle —
const DL_View = lazy(() => import('../Downloads/DownloadsView'));
const RA_View = lazy(() => import('../RoadAtlas/RoadAtlasView'));
const RV_View = lazy(() => import('../RoadVideoView/RoadVideoView'));
const BUD_Section = lazy(() => import('../Budget/BudgetSection'));
const LC_Section = lazy(() => import('../Lifecycle/LifecycleSection'));
const PROJ_View = lazy(() => import('../Projects/ProjectsView'));

type ExtraSlot = 'dashboard' | 'map' | 'tables' | 'analytics' | 'capture';
const SECTION_EXTRAS: Record<string, Partial<Record<ExtraSlot, React.ComponentType<any>[]>>> = {
  rms: {
    dashboard: [LazyNetworkStory],
    map: [LazyRoadNetworkMap],
    tables: [LazyRoadInventoryTbl],
  },
  tis: {
    map: [TrafficMapLegacy],
    tables: [TrafficCountsLegacy, TrafficStationsLegacy],
    analytics: [TrafficTrendsLegacy, LazyGrowthFactors, LazyOverloading],
  },
  pms: {
    map: [PmsConditionMapLegacy],
    tables: [PmsInventoryLegacy, PMS_RoadVideoView],
    analytics: [PMS_CrossSectionAnalytics, PmsAnalyticsViewLegacy, PmsAgeLegacy, PmsFwdLegacy, PMS_LifecycleView, PMS_PavementCatalogue, PMS_AIVisionDashboard, PMS_DigitalTwin],
  },
  bms: {
    map: [BMS_GISMap],
    tables: [BMS_Registry, BMS_Inspections, BMS_BridgeWorks, BMS_Maintenance],
    analytics: [BMS_Condition, BMS_Critical, BMS_Analytics, BMS_PhotoTwin],
  },
  ducar: {
    dashboard: [LazyDucarOverview],
  },
  pim: {
    dashboard: [PimFrameworkLegacy],
    tables: [PimPppLegacy, PimDonorLegacy],
    analytics: [PimBudgetLegacy, PimNdpivLegacy],
  },
  gis: {
    map: [GisMapLegacy],
  },
  reserve: {
    dashboard: [ReserveOverviewLegacy],
    map: [ReserveMapLegacy],
    tables: [ReserveRegisterLegacy, ReserveGazetteLegacy, ReservePermitsLegacy],
  },
  casestudies: {
    dashboard: [CaseStudiesNarrativeLegacy],
    map: [CaseStudiesWorldMapLegacy],
    tables: [CaseStudiesComparisonLegacy],
    analytics: [CaseStudiesMatrixLegacy, CaseStudiesLessonsLegacy],
  },
  admin: {
    map: [ADMIN_MindMap],
    tables: [ADMIN_Identity, ADMIN_Activity],
    analytics: [ADMIN_DataAudit],
    capture: [ADMIN_PendingSubmissions],
  },
  sources: {
    tables: [SRC_Catalogue, SRC_Dictionary],
    analytics: [SRC_Tabular],
  },
  downloads: {
    dashboard: [DL_View],
  },
  roadatlas: {
    map: [RA_View],
  },
  roadvideo: {
    tables: [RV_View],
  },
  bridgeworks: {
    tables: [BMS_BridgeWorks],
  },
  budget: {
    analytics: [BUD_Section],
  },
  lifecycle: {
    analytics: [LC_Section],
  },
  projects: {
    tables: [PROJ_View],
  },
};

function SectionExtra({ sectionId, slot }: { sectionId: string; slot: ExtraSlot }) {
  const list = SECTION_EXTRAS[sectionId]?.[slot];
  if (!list || !list.length) return null;
  return (
    <>
      {list.map((Comp, i) => (
        <Suspense key={i} fallback={null}>
          <div style={{
            marginTop: 18, position: 'relative', isolation: 'isolate',
            contain: 'layout paint style', overflow: 'hidden auto', maxHeight: '90vh',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
          }}><Comp /></div>
        </Suspense>
      ))}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── Main Export ──────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────── */
export default function SectionDashboard({ sectionId, accent }: { sectionId: string; accent: string }) {
  const def = DEFS[sectionId] ?? DEFS.rms;

  return (
    <div style={{ padding: '6px 8px', width: '100%' }}>
      {/* Compact definition strip — always visible above the 6-tab bar */}
      <div style={{
        background: `rgba(255,255,255,0.02)`, border: `1px solid ${accent}26`,
        borderRadius: 10, padding: '10px 14px', marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0, fontSize: 13,
            background: `linear-gradient(135deg,${accent}33,rgba(0,0,0,0))`,
            border: `1px solid ${accent}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent,
          }}>{def.icon}</div>
          <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minWidth: 0, rowGap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#e2eaf4', flexShrink: 0 }}>{def.title}</span>
            <span style={{ fontSize: 11.5, color: 'rgba(203,213,225,0.85)', lineHeight: 1.5, flex: '1 1 320px', minWidth: 260 }}>{def.body}</span>
          </div>
        </div>
      </div>

      {/* Section Sub-Tabs: Dashboard | Interactive Map | Exhaustive Tables | Deep Analytics | SQL Database & Schema | Data Capture */}
      <SectionSubTabs sectionId={sectionId} accent={accent} />
    </div>
  );
}
