import { useState, useEffect } from 'react';
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
  admin:        { icon: '⚙',  title: 'Administration',                       body: 'User management, access control, audit logs, system configuration, and reference data maintenance.' },
  hdm4:         { icon: '🔬', title: 'HDM-4 Analysis',                       body: 'Highway Development and Management model runs for road investment planning and budget optimisation.' },
  ducar:        { icon: '🌿', title: 'DUCAR Roads',                          body: 'District, Urban, Community Access Road network data — condition, coverage, and maintenance funding by local government.' },
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
  table:  { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 } as React.CSSProperties,
  th:     { padding: '7px 10px', textAlign: 'left' as const, fontSize: 10,
            letterSpacing: '.4px', textTransform: 'uppercase' as const, fontWeight: 700,
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            color: 'rgba(148,163,184,0.6)' } as React.CSSProperties,
  td:     { padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)',
            color: 'rgba(200,210,225,0.8)', verticalAlign: 'middle' as const } as React.CSSProperties,
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

/* ── CSS Bar Chart ────────────────────────────────────────────────────────── */
function BarChart({ data, title, accent }: {
  data: Array<{ label: string; value: number }>;
  title: string;
  accent: string;
}) {
  const clean = (data ?? []).filter(d => d != null && d.value != null && !isNaN(d.value));
  if (clean.length === 0) return (
    <div style={SX.card}>
      <div style={SX.h3}>{title}</div>
      <div style={SX.empty}>No chart data available</div>
    </div>
  );
  const max = Math.max(...clean.map(d => d.value), 1);
  return (
    <div style={SX.card}>
      <div style={SX.h3}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {clean.map(d => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 110, fontSize: 11, color: 'rgba(148,163,184,0.75)',
                          textAlign: 'right', flexShrink: 0,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {d.label}
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 3, height: 16 }}>
              <div style={{
                width: `${Math.round((d.value / max) * 100)}%`,
                height: '100%', borderRadius: 3, background: accent, opacity: 0.8,
              }} />
            </div>
            <div style={{ width: 54, fontSize: 11, fontFamily: 'monospace',
                          color: accent, textAlign: 'right', flexShrink: 0 }}>
              {d.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
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
  return <div style={SX.empty}>{label}</div>;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── BMS Dashboard ────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────── */
function BMSDashboard({ accent }: { accent: string }) {
  const [kpis, setKpis] = useState<{ total: number; inspected: number; critical: number; maintenance: number } | null>(null);
  const [byType, setByType] = useState<Array<{ label: string; value: number }>>([]);
  const [rows, setRows]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [totR, insR, critR, maintR, typeR, rowsR] = await Promise.all([
          supabase.from('bridges').select('*', { count: 'exact', head: true }),
          supabase.from('bridges').select('*', { count: 'exact', head: true }).eq('inspected', true),
          supabase.from('bridges').select('*', { count: 'exact', head: true }).eq('condition', 'Critical'),
          supabase.from('bridges').select('*', { count: 'exact', head: true }).eq('maintenance_required', true),
          supabase.from('bridges').select('structure_type').limit(500),
          supabase.from('bridges').select('bridge_name,road_link,structure_type,span_m,condition').order('condition').limit(10),
        ]);
        const typeCounts: Record<string, number> = {};
        (typeR.data ?? []).forEach((r: any) => {
          const t = r.structure_type ?? 'Unknown';
          typeCounts[t] = (typeCounts[t] ?? 0) + 1;
        });
        setKpis({
          total: totR.count ?? 0,
          inspected: insR.count ?? 0,
          critical: critR.count ?? 0,
          maintenance: maintR.count ?? 0,
        });
        setByType(
          Object.entries(typeCounts)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8),
        );
        setRows(rowsR.data ?? []);
      } catch {
        setKpis(null);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner label="Loading bridge data…" />;
  if (!kpis || kpis.total === 0) return <NoData label="No bridge records found in Supabase" />;

  return (
    <>
      <div style={SX.kpiRow}>
        <KpiCard label="Total Structures"    value={kpis.total.toLocaleString()}       accent={accent}    sub="bridges & culverts" />
        <KpiCard label="Inspected"           value={kpis.inspected.toLocaleString()}   accent="#00ff88"   sub="with inspection records" />
        <KpiCard label="Critical Condition"  value={kpis.critical.toLocaleString()}    accent="#ff0040"   sub="urgent works required" />
        <KpiCard label="Maintenance Required" value={kpis.maintenance.toLocaleString()} accent="#ff9900" />
      </div>
      <div style={SX.grid2}>
        <BarChart data={byType} title="Bridges by Structure Type" accent={accent} />
        <div style={SX.card}>
          <div style={SX.h3}>Bridge Inventory — Sample Records</div>
          {rows.length === 0 ? <NoData /> : (
            <table style={SX.table}>
              <thead><tr>
                {['Name', 'Road', 'Type', 'Span (m)', 'Condition'].map(h => <th key={h} style={SX.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={SX.td}>{r.bridge_name ?? '—'}</td>
                    <td style={SX.td}>{r.road_link ?? '—'}</td>
                    <td style={SX.td}>{r.structure_type ?? '—'}</td>
                    <td style={SX.td}>{r.span_m ?? '—'}</td>
                    <td style={SX.td}>
                      <span style={{
                        padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                        background: r.condition === 'Critical' ? '#ff004022'
                          : r.condition === 'Poor' ? '#ff660022' : '#00ff8822',
                        color: r.condition === 'Critical' ? '#ff0040'
                          : r.condition === 'Poor' ? '#ff6600' : '#00ff88',
                      }}>
                        {r.condition ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── Traffic Dashboard ────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────── */
function TrafficDashboard({ accent }: { accent: string }) {
  const [kpis, setKpis] = useState<{ stations: number; avgAadt: number; surveys: number; heavyPct: number } | null>(null);
  const [byRoad, setByRoad]   = useState<Array<{ label: string; value: number }>>([]);
  const [rows, setRows]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [stR, survR, roadR, rowsR] = await Promise.all([
          supabase.from('atc_stations').select('station_id,aadt,heavy_pct').limit(500),
          supabase.from('traffic_surveys').select('*', { count: 'exact', head: true }),
          supabase.from('traffic_surveys').select('road_link,aadt').order('aadt', { ascending: false }).limit(10),
          supabase.from('traffic_surveys').select('road_link,station,survey_date,aadt,heavy_pct').order('survey_date', { ascending: false }).limit(10),
        ]);
        const stations = stR.data ?? [];
        const avg = stations.length
          ? Math.round(stations.reduce((s: number, r: any) => s + (r.aadt ?? 0), 0) / stations.length)
          : 0;
        const hvg = stations.length
          ? Math.round(stations.reduce((s: number, r: any) => s + (r.heavy_pct ?? 0), 0) / stations.length)
          : 0;
        const roadMap: Record<string, number> = {};
        (roadR.data ?? []).forEach((r: any) => {
          const k = r.road_link ?? 'Unknown';
          if (!roadMap[k] || (r.aadt ?? 0) > roadMap[k]) roadMap[k] = r.aadt ?? 0;
        });
        setKpis({ stations: stations.length, avgAadt: avg, surveys: survR.count ?? 0, heavyPct: hvg });
        setByRoad(
          Object.entries(roadMap)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8),
        );
        setRows(rowsR.data ?? []);
      } catch {
        setKpis(null);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner label="Loading traffic data…" />;
  if (!kpis || (kpis.stations === 0 && kpis.surveys === 0)) return <NoData label="No traffic records found in Supabase" />;

  return (
    <>
      <div style={SX.kpiRow}>
        <KpiCard label="ATC Stations"    value={kpis.stations}                accent={accent}   sub="active counters" />
        <KpiCard label="Avg AADT"        value={kpis.avgAadt.toLocaleString()} accent="#00ff88" unit="veh/day" />
        <KpiCard label="Survey Records"  value={kpis.surveys.toLocaleString()} accent="#ffee00" />
        <KpiCard label="Heavy Vehicle %" value={`${kpis.heavyPct}%`}          accent="#ff9900"  sub="HGV + buses" />
      </div>
      <div style={SX.grid2}>
        <BarChart data={byRoad} title="AADT by Road Link (Top 8)" accent={accent} />
        <div style={SX.card}>
          <div style={SX.h3}>Recent Traffic Surveys</div>
          {rows.length === 0 ? <NoData /> : (
            <table style={SX.table}>
              <thead><tr>
                {['Road', 'Station', 'Date', 'AADT', 'Heavy %'].map(h => <th key={h} style={SX.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={SX.td}>{r.road_link ?? '—'}</td>
                    <td style={SX.td}>{r.station ?? '—'}</td>
                    <td style={SX.td}>{r.survey_date ?? '—'}</td>
                    <td style={SX.td}><b style={{ color: accent }}>{r.aadt?.toLocaleString() ?? '—'}</b></td>
                    <td style={SX.td}>{r.heavy_pct != null ? `${r.heavy_pct}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── PMS Dashboard ────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────── */
function PMSDashboard({ accent }: { accent: string }) {
  const [kpis, setKpis] = useState<{ total: number; poor: number; avgIri: number; surveyed: number } | null>(null);
  const [byClass, setByClass] = useState<Array<{ label: string; value: number }>>([]);
  const [rows, setRows]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [totR, poorR, iriR, survR, classR, rowsR] = await Promise.all([
          supabase.from('pavement_conditions').select('*', { count: 'exact', head: true }),
          supabase.from('pavement_conditions').select('*', { count: 'exact', head: true }).gte('iri', 8),
          supabase.from('pavement_conditions').select('iri').limit(1000),
          supabase.from('pavement_conditions').select('*', { count: 'exact', head: true }).not('survey_date', 'is', null),
          supabase.from('pavement_conditions').select('road_class').limit(1000),
          supabase.from('pavement_conditions').select('road_link,road_class,length_km,iri,condition').order('iri', { ascending: false }).limit(10),
        ]);
        const allIri = (iriR.data ?? []).map((r: any) => r.iri).filter((v: any) => v != null && !isNaN(v));
        const avg = allIri.length
          ? Math.round(allIri.reduce((a: number, b: number) => a + b, 0) / allIri.length * 10) / 10
          : 0;
        const classCounts: Record<string, number> = {};
        (classR.data ?? []).forEach((r: any) => {
          const k = r.road_class ?? 'Unknown';
          classCounts[k] = (classCounts[k] ?? 0) + 1;
        });
        setKpis({ total: totR.count ?? 0, poor: poorR.count ?? 0, avgIri: avg, surveyed: survR.count ?? 0 });
        setByClass(Object.entries(classCounts).map(([label, value]) => ({ label, value })));
        setRows(rowsR.data ?? []);
      } catch {
        setKpis(null);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner label="Loading pavement data…" />;
  if (!kpis || kpis.total === 0) return <NoData label="No pavement condition records found in Supabase" />;

  return (
    <>
      <div style={SX.kpiRow}>
        <KpiCard label="Total Segments"      value={kpis.total.toLocaleString()}    accent={accent}   />
        <KpiCard label="Poor Condition (IRI≥8)" value={kpis.poor.toLocaleString()} accent="#ff0040"  />
        <KpiCard label="Avg IRI"             value={kpis.avgIri}                   accent="#ffee00" unit="m/km" />
        <KpiCard label="Surveyed Segments"   value={kpis.surveyed.toLocaleString()} accent="#00ff88" />
      </div>
      <div style={SX.grid2}>
        <BarChart data={byClass} title="Segments by Road Class" accent={accent} />
        <div style={SX.card}>
          <div style={SX.h3}>Worst Pavement Segments (Highest IRI)</div>
          {rows.length === 0 ? <NoData /> : (
            <table style={SX.table}>
              <thead><tr>
                {['Road Link', 'Class', 'Length (km)', 'IRI', 'Condition'].map(h => <th key={h} style={SX.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={SX.td}>{r.road_link ?? '—'}</td>
                    <td style={SX.td}>{r.road_class ?? '—'}</td>
                    <td style={SX.td}>{r.length_km ?? '—'}</td>
                    <td style={SX.td}>
                      <b style={{ color: (r.iri ?? 0) >= 8 ? '#ff0040' : (r.iri ?? 0) >= 5 ? '#ff9900' : '#00ff88' }}>
                        {r.iri ?? '—'}
                      </b>
                    </td>
                    <td style={SX.td}>{r.condition ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── Budget Dashboard ─────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────── */
function BudgetDashboard({ accent }: { accent: string }) {
  const [kpis, setKpis] = useState<{ allocated: number; spent: number; gap: number; lines: number } | null>(null);
  const [byProg, setByProg]   = useState<Array<{ label: string; value: number }>>([]);
  const [rows, setRows]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [allocR, spentR, progR, rowsR] = await Promise.all([
          supabase.from('budget_allocations').select('amount_ugx').limit(2000),
          supabase.from('budget_expenditures').select('amount_ugx').limit(2000),
          supabase.from('budget_allocations').select('programme,amount_ugx').limit(2000),
          supabase.from('budget_allocations').select('programme,sub_programme,amount_ugx,financial_year').order('amount_ugx', { ascending: false }).limit(10),
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
        setRows(rowsR.data ?? []);
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
      <div style={SX.grid2}>
        <BarChart data={byProg} title="Allocation by Programme (Bn UGX)" accent={accent} />
        <div style={SX.card}>
          <div style={SX.h3}>Top Budget Lines</div>
          {rows.length === 0 ? <NoData /> : (
            <table style={SX.table}>
              <thead><tr>
                {['Programme', 'Sub-Programme', 'FY', 'Allocated (Bn)'].map(h => <th key={h} style={SX.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={SX.td}>{r.programme ?? '—'}</td>
                    <td style={SX.td}>{r.sub_programme ?? '—'}</td>
                    <td style={SX.td}>{r.financial_year ?? '—'}</td>
                    <td style={SX.td}>
                      <b style={{ color: accent }}>
                        {r.amount_ugx != null ? (r.amount_ugx / 1e9).toFixed(1) : '—'}
                      </b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── Road Reserve Dashboard ───────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────── */
function RoadReserveDashboard({ accent }: { accent: string }) {
  const [kpis, setKpis] = useState<{ total: number; gazetted: number; encroached: number; surveyed: number } | null>(null);
  const [byDist, setByDist]   = useState<Array<{ label: string; value: number }>>([]);
  const [rows, setRows]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [totR, gazR, encR, survR, distR, rowsR] = await Promise.all([
          supabase.from('road_reserves').select('*', { count: 'exact', head: true }),
          supabase.from('road_reserves').select('*', { count: 'exact', head: true }).eq('gazette_status', 'Gazetted'),
          supabase.from('road_reserves').select('*', { count: 'exact', head: true }).gt('encroachment_count', 0),
          supabase.from('road_reserves').select('*', { count: 'exact', head: true }).eq('survey_status', 'Surveyed'),
          supabase.from('road_reserves').select('district').limit(1000),
          supabase.from('road_reserves').select('road_link,district,width_m,gazette_status,encroachment_count').order('encroachment_count', { ascending: false }).limit(10),
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
        setRows(rowsR.data ?? []);
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
      <div style={SX.grid2}>
        <BarChart data={byDist} title="Reserves by District (Top 8)" accent={accent} />
        <div style={SX.card}>
          <div style={SX.h3}>Most Encroached Reserves</div>
          {rows.length === 0 ? <NoData /> : (
            <table style={SX.table}>
              <thead><tr>
                {['Road Link', 'District', 'Width (m)', 'Gazette Status', 'Encroachments'].map(h => <th key={h} style={SX.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={SX.td}>{r.road_link ?? '—'}</td>
                    <td style={SX.td}>{r.district ?? '—'}</td>
                    <td style={SX.td}>{r.width_m ?? '—'}</td>
                    <td style={SX.td}>{r.gazette_status ?? '—'}</td>
                    <td style={SX.td}>
                      <b style={{ color: (r.encroachment_count ?? 0) > 0 ? '#ff0040' : '#00ff88' }}>
                        {r.encroachment_count ?? 0}
                      </b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── RMS Dashboard ────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────── */
function RMSDashboard({ accent }: { accent: string }) {
  const [kpis, setKpis] = useState<{ total: number; active: number; completed: number; lengthKm: number } | null>(null);
  const [byActivity, setByActivity] = useState<Array<{ label: string; value: number }>>([]);
  const [rows, setRows]             = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [totR, actR, compR, lenR, typeR, rowsR] = await Promise.all([
          supabase.from('road_maintenance').select('*', { count: 'exact', head: true }),
          supabase.from('road_maintenance').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
          supabase.from('road_maintenance').select('*', { count: 'exact', head: true }).eq('status', 'Completed'),
          supabase.from('road_maintenance').select('length_km').limit(2000),
          supabase.from('road_maintenance').select('activity_type').limit(2000),
          supabase.from('road_maintenance').select('road_link,activity_type,length_km,status,contractor').limit(10),
        ]);
        const totalLen = (lenR.data ?? []).reduce((s: number, r: any) => s + (r.length_km ?? 0), 0);
        const typeCounts: Record<string, number> = {};
        (typeR.data ?? []).forEach((r: any) => {
          const k = r.activity_type ?? 'Unknown';
          typeCounts[k] = (typeCounts[k] ?? 0) + 1;
        });
        setKpis({
          total: totR.count ?? 0,
          active: actR.count ?? 0,
          completed: compR.count ?? 0,
          lengthKm: Math.round(totalLen),
        });
        setByActivity(
          Object.entries(typeCounts)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8),
        );
        setRows(rowsR.data ?? []);
      } catch {
        setKpis(null);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner label="Loading maintenance data…" />;
  if (!kpis || kpis.total === 0) return <NoData label="No maintenance records found in Supabase" />;

  return (
    <>
      <div style={SX.kpiRow}>
        <KpiCard label="Total Works"   value={kpis.total.toLocaleString()}     accent={accent}   />
        <KpiCard label="Active"        value={kpis.active.toLocaleString()}    accent="#ffee00"  />
        <KpiCard label="Completed"     value={kpis.completed.toLocaleString()} accent="#00ff88"  />
        <KpiCard label="Total Length"  value={kpis.lengthKm.toLocaleString()}  accent="#00f5ff"  unit="km" />
      </div>
      <div style={SX.grid2}>
        <BarChart data={byActivity} title="Works by Activity Type" accent={accent} />
        <div style={SX.card}>
          <div style={SX.h3}>Recent Maintenance Works</div>
          {rows.length === 0 ? <NoData /> : (
            <table style={SX.table}>
              <thead><tr>
                {['Road Link', 'Activity', 'Length (km)', 'Status', 'Contractor'].map(h => <th key={h} style={SX.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={SX.td}>{r.road_link ?? '—'}</td>
                    <td style={SX.td}>{r.activity_type ?? '—'}</td>
                    <td style={SX.td}>{r.length_km ?? '—'}</td>
                    <td style={SX.td}>
                      <span style={{
                        padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                        background: r.status === 'Active' ? '#ffee0022'
                          : r.status === 'Completed' ? '#00ff8822' : '#ffffff11',
                        color: r.status === 'Active' ? '#ffee00'
                          : r.status === 'Completed' ? '#00ff88' : '#aaa',
                      }}>
                        {r.status ?? '—'}
                      </span>
                    </td>
                    <td style={SX.td}>{r.contractor ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── NTIS Dashboard ───────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────── */
function NTISDashboard({ accent }: { accent: string }) {
  const [kpis, setKpis] = useState<{ stations: number; avgAadt: number; fatalities: number; blackspots: number } | null>(null);
  const [byRegion, setByRegion] = useState<Array<{ label: string; value: number }>>([]);
  const [rows, setRows]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [stR, fatR, bsR, rowsR] = await Promise.all([
          supabase.from('atc_stations').select('station_id,aadt,region').limit(500),
          supabase.from('road_accidents').select('fatalities').limit(2000),
          supabase.from('road_blackspots').select('*', { count: 'exact', head: true }),
          supabase.from('atc_stations').select('station_id,road,location,region,aadt').order('aadt', { ascending: false }).limit(10),
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
        setRows(rowsR.data ?? []);
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
      <div style={SX.grid2}>
        <BarChart data={byRegion} title="Avg AADT by Region" accent={accent} />
        <div style={SX.card}>
          <div style={SX.h3}>Top Stations by AADT</div>
          {rows.length === 0 ? <NoData /> : (
            <table style={SX.table}>
              <thead><tr>
                {['Station', 'Road', 'Location', 'Region', 'AADT'].map(h => <th key={h} style={SX.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={SX.td}><b style={{ color: accent }}>{r.station_id ?? '—'}</b></td>
                    <td style={SX.td}>{r.road ?? '—'}</td>
                    <td style={SX.td}>{r.location ?? '—'}</td>
                    <td style={SX.td}>{r.region ?? '—'}</td>
                    <td style={SX.td}><b style={{ color: '#ffee00' }}>{r.aadt?.toLocaleString() ?? '—'}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── Default / Fallback Dashboard ────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────── */
function DefaultDashboard({ sectionId, accent }: { sectionId: string; accent: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { count: c } = await supabase
          .from(sectionId)
          .select('*', { count: 'exact', head: true });
        setCount(c ?? 0);
      } catch {
        setCount(null);
      }
      setLoading(false);
    })();
  }, [sectionId]);

  if (loading) return <Spinner label="Loading…" />;
  if (count == null) return <NoData label="Section data not yet configured in Supabase" />;

  return (
    <div style={SX.kpiRow}>
      <KpiCard label="Records" value={count.toLocaleString()} accent={accent} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── Main Export ──────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────── */
export default function SectionDashboard({ sectionId, accent }: { sectionId: string; accent: string }) {
  const def = DEFS[sectionId] ?? DEFS.rms;

  let content: React.ReactNode;
  switch (sectionId) {
    case 'bms':
    case 'nbms':
      content = <BMSDashboard accent={accent} />;
      break;
    case 'traffic':
    case 'atc':
      content = <TrafficDashboard accent={accent} />;
      break;
    case 'pms':
    case 'roadcondition':
    case 'npms':
      content = <PMSDashboard accent={accent} />;
      break;
    case 'budget':
      content = <BudgetDashboard accent={accent} />;
      break;
    case 'roadreserve':
      content = <RoadReserveDashboard accent={accent} />;
      break;
    case 'rms':
      content = <RMSDashboard accent={accent} />;
      break;
    case 'ntis':
      content = <NTISDashboard accent={accent} />;
      break;
    default:
      content = <DefaultDashboard sectionId={sectionId} accent={accent} />;
  }

  return (
    <div style={{ ...SX.wrap, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      {/* ── Section definition card ── */}
      <div style={{ ...SX.defCard, borderLeftColor: accent }}>
        <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{def.icon}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'rgba(220,230,255,0.9)', marginBottom: 4 }}>
            {def.title}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.65)', lineHeight: 1.55 }}>
            {def.body}
          </div>
        </div>
      </div>
      {/* ── Section-specific KPIs, chart, table ── */}
      {content}
    </div>
  );
}
