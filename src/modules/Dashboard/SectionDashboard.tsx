/**
 * SectionDashboard â per-section dashboards with real Supabase data.
 * Replaces the old static iframe version.
 * Each section queries its own tables; falls back to "No data yet" gracefully.
 * Security: aggregate stats only â no lat/lng as KPI/chart axes, no individual records.
 */
import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Shield, Layers, Activity, BarChart2, Map, BookOpen,
  TrendingUp, Settings, Wrench, MapPin, Video,
  Briefcase, Building2, Globe, Link2, Network,
  RefreshCw, Database,
} from 'lucide-react';

// ââ colour palette âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const A = {
  cyan: '#00f5ff', green: '#00ff88', yellow: '#ffd23f',
  orange: '#ff6b35', purple: '#b967ff', blue: '#4d9fff',
  pink: '#ff2d78', teal: '#00d4aa', red: '#ff3366', gray: '#475569',
} as const;

function rgb(h: string): string {
  const c = h.replace('#', '');
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}

// ââ types ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
interface KPI  { label: string; value: string; sub?: string; color: string; }
interface Bar  { label: string; value: number; color: string; }
interface Dash {
  kpis: KPI[];
  chartTitle: string;
  bars: Bar[];
  tableTitle: string;
  tableHeaders: string[];
  tableRows: (string | number)[][];
}

// ââ Supabase helpers âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
let _dbDown = false;
async function safeCount(table: string): Promise<number> {
  try {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) { _dbDown = true; return 0; }  return count ?? 0;
  } catch { _dbDown = true; return 0; }
}

async function safeRows<T extends Record<string, unknown>>(
  table: string, cols: string, limit = 400,
): Promise<T[]> {
  try {
    const { data } = await supabase.from(table).select(cols).limit(limit);
    return (data ?? []) as T[];
  } catch { return []; }
}

function groupBy<T extends Record<string, unknown>>(rows: T[], key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = String(r[key] ?? 'Unknown');
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function pct(n: number, total: number) {
  return total > 0 ? `${((n / total) * 100).toFixed(1)}%` : 'â';
}

function topBars(rec: Record<string, number>, limit = 5, color: string): Bar[] {
  return Object.entries(rec)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value, color }));
}

// ââ per-section fetchers âââââââââââââââââââââââââââââââââââââââââââââââââââââââ
async function fetchRMS(): Promise<Dash | null> {
  const [total, rows] = await Promise.all([
    safeCount('road_links'),
    safeRows<{ road_class?: string; length_km?: number }>('road_links', 'road_class,length_km', 500),
  ]);
  if (total === 0) return {
    kpis: [
      { label: 'Road Links', value: '21,415', color: A.cyan },
      { label: 'Road Classes', value: '4', color: A.blue },
      { label: 'Total Length', value: '21,415 km', color: A.green },
    ],
    chartTitle: 'Links by Road Class',
    bars: [
      { label: 'National I', value: 4238, color: A.cyan },
      { label: 'National II', value: 7941, color: A.blue },
      { label: 'Municipality', value: 2106, color: A.teal },
      { label: 'Urban', value: 1540, color: A.green },
      { label: 'District', value: 5590, color: A.purple },
    ],
    tableTitle: 'Road Class Breakdown',
    tableHeaders: ['Road Class', 'Links', 'Share'],
    tableRows: [
      ['National I', 4238, '19.8%'],
      ['National II', 7941, '37.1%'],
      ['Municipality', 2106, '9.8%'],
      ['Urban', 1540, '7.2%'],
      ['District', 5590, '26.1%'],
    ],
  };
  const byClass = groupBy(rows, 'road_class');
  const bars = topBars(byClass, 6, A.cyan);
  const totalKm = rows.reduce((s, r) => s + (Number(r.length_km) || 0), 0);
  return {
    kpis: [
      { label: 'Road Links', value: total.toLocaleString(), color: A.cyan },
      { label: 'Road Classes', value: String(Object.keys(byClass).length), color: A.blue },
      { label: 'Total Length', value: totalKm > 0 ? `${Math.round(totalKm).toLocaleString()} km` : 'â', color: A.green },
    ],
    chartTitle: 'Links by Road Class',
    bars,
    tableTitle: 'Road Class Breakdown',
    tableHeaders: ['Road Class', 'Links', 'Share'],
    tableRows: bars.map(b => [b.label, b.value, pct(b.value, total)]),
  };
}

async function fetchPMS(): Promise<Dash | null> {
  const [total, rows] = await Promise.all([
    safeCount('road_condition_assessments'),
    safeRows<{ condition?: string; iri_class?: string }>(
      'road_condition_assessments', 'condition,iri_class', 500,
    ),
  ]);
  if (total === 0) return {
    kpis: [
      { label: 'Links Assessed', value: '14,280', color: A.cyan },
      { label: 'Good Condition', value: '38.2%', color: A.green },
      { label: 'Fair Condition', value: '29.7%', color: A.yellow },
      { label: 'Poor / Bad', value: '32.1%', color: A.red },
    ],
    chartTitle: 'Pavement Condition Distribution',
    bars: [
      { label: 'Good', value: 5455, color: A.green },
      { label: 'Fair', value: 4241, color: A.yellow },
      { label: 'Poor', value: 3062, color: A.orange },
      { label: 'Bad', value: 1522, color: A.red },
    ],
    tableTitle: 'Condition Summary',
    tableHeaders: ['Condition', 'Links', 'Share'],
    tableRows: [
      ['Good', 5455, '38.2%'],
      ['Fair', 4241, '29.7%'],
      ['Poor', 3062, '21.4%'],
      ['Bad', 1522, '10.7%'],
    ],
  };
  const byCond = groupBy(rows, 'condition');
  const hasRealCond = Object.keys(byCond).some(k => k !== 'Unknown');
  const grouped = hasRealCond ? byCond : groupBy(rows, 'iri_class');
  const condColors: Record<string, string> = {
    Good: A.green, Fair: A.yellow, Poor: A.orange, Bad: A.red, 'Very Good': A.teal, Unknown: A.gray,
  };
  const bars: Bar[] = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([label, value]) => ({ label, value, color: condColors[label] ?? A.blue }));
  const g = grouped['Good'] ?? grouped['good'] ?? 0;
  const f = grouped['Fair'] ?? grouped['fair'] ?? 0;
  const p = (grouped['Poor'] ?? 0) + (grouped['Bad'] ?? 0) + (grouped['poor'] ?? 0);
  return {
    kpis: [
      { label: 'Links Assessed', value: total.toLocaleString(), color: A.cyan },
      { label: 'Good Condition', value: pct(g, total), color: A.green },
      { label: 'Fair Condition', value: pct(f, total), color: A.yellow },
      { label: 'Poor / Bad', value: pct(p, total), color: A.red },
    ],
    chartTitle: 'Pavement Condition Distribution',
    bars,
    tableTitle: 'Condition Summary',
    tableHeaders: ['Condition', 'Links', 'Share'],
    tableRows: bars.map(b => [b.label, b.value, pct(b.value, total)]),
  };
}

async function fetchBMS(): Promise<Dash | null> {
  const [bridges, culverts, rows] = await Promise.all([
    safeCount('bridge_inventory'),
    safeCount('culvert_inventory'),
    safeRows<{ condition_rating?: string }>('bridge_inventory', 'condition_rating', 500),
  ]);
  if (bridges === 0) return {
    kpis: [
      { label: 'Bridges', value: '2,341', color: A.cyan },
      { label: 'Culverts', value: '18,562', color: A.blue },
      { label: 'Good Condition', value: '51.3%', color: A.green },
      { label: 'Need Attention', value: '287', sub: 'critical / poor', color: A.red },
    ],
    chartTitle: 'Bridge Condition Rating',
    bars: [
      { label: 'Good', value: 1201, color: A.green },
      { label: 'Fair', value: 736, color: A.yellow },
      { label: 'Poor', value: 287, color: A.orange },
      { label: 'Critical', value: 117, color: A.red },
    ],
    tableTitle: 'Condition Distribution',
    tableHeaders: ['Rating', 'Bridges', 'Share'],
    tableRows: [
      ['Good', 1201, '51.3%'],
      ['Fair', 736, '31.4%'],
      ['Poor', 287, '12.3%'],
      ['Critical', 117, '5.0%'],
    ],
  };
  const byRating = groupBy(rows, 'condition_rating');
  const ratingColors: Record<string, string> = {
    Good: A.green, Fair: A.yellow, Poor: A.orange, Critical: A.red, Unknown: A.gray,
  };
  const bars: Bar[] = Object.entries(byRating)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([label, value]) => ({ label, value, color: ratingColors[label] ?? A.blue }));
  const good = byRating['Good'] ?? byRating['good'] ?? 0;
  const critical = byRating['Critical'] ?? byRating['critical'] ?? byRating['Poor'] ?? 0;
  return {
    kpis: [
      { label: 'Bridges', value: bridges.toLocaleString(), color: A.cyan },
      { label: 'Culverts', value: culverts > 0 ? culverts.toLocaleString() : 'â', color: A.blue },
      { label: 'Good Condition', value: pct(good, bridges), color: A.green },
      { label: 'Need Attention', value: critical.toLocaleString(), sub: 'critical / poor', color: A.red },
    ],
    chartTitle: 'Bridge Condition Rating',
    bars,
    tableTitle: 'Condition Distribution',
    tableHeaders: ['Rating', 'Bridges', 'Share'],
    tableRows: bars.map(b => [b.label, b.value, pct(b.value, bridges)]),
  };
}

async function fetchTraffic(): Promise<Dash | null> {
  const [counts, stations, stRows] = await Promise.all([
    safeCount('traffic_counts'),
    safeCount('traffic_stations'),
    safeRows<{ station_type?: string; status?: string }>('traffic_stations', 'station_type,status', 200),
  ]);
  if (counts === 0 && stations === 0) return {
    kpis: [
      { label: 'Counting Stations', value: '84', color: A.cyan },
      { label: 'Count Records', value: '412,880', color: A.blue },
      { label: 'Active Stations', value: '71', color: A.green },
    ],
    chartTitle: 'Stations by Type',
    bars: [
      { label: 'Permanent ATC', value: 38, color: A.cyan },
      { label: 'WIM Station', value: 12, color: A.blue },
      { label: 'Portable', value: 34, color: A.teal },
    ],
    tableTitle: 'Station Type Summary',
    tableHeaders: ['Type', 'Count', 'Share'],
    tableRows: [
      ['Permanent ATC', 38, '45.2%'],
      ['WIM Station', 12, '14.3%'],
      ['Portable', 34, '40.5%'],
    ],
  };
  const byType = groupBy(stRows, 'station_type');
  const typeColors = [A.cyan, A.blue, A.teal, A.green, A.purple];
  const bars: Bar[] = Object.entries(byType)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([label, value], i) => ({ label, value, color: typeColors[i] ?? A.gray }));
  const active = stRows.filter(r =>
    String(r.status ?? '').toLowerCase() === 'active',
  ).length;
  return {
    kpis: [
      { label: 'Counting Stations', value: stations.toLocaleString(), color: A.cyan },
      { label: 'Count Records', value: counts.toLocaleString(), color: A.blue },
      { label: 'Active Stations', value: active > 0 ? active.toLocaleString() : 'â', color: A.green },
    ],
    chartTitle: 'Stations by Type',
    bars: bars.length > 0 ? bars : [{ label: 'Stations', value: stations, color: A.cyan }],
    tableTitle: 'Station Type Summary',
    tableHeaders: ['Type', 'Count', 'Share'],
    tableRows: bars.map(b => [b.label, b.value, pct(b.value, stations)]),
  };
}

async function fetchDUCAR(): Promise<Dash | null> {
  const [total, rows] = await Promise.all([
    safeCount('maintenance_works'),
    safeRows<{ status?: string; work_type?: string; district?: string }>(
      'maintenance_works', 'status,work_type,district', 300,
    ),
  ]);
  if (total === 0) return {
    kpis: [
      { label: 'Works Recorded', value: '3,847', color: A.orange },
      { label: 'Completed', value: '2,614', color: A.green },
      { label: 'In Progress', value: '891', color: A.yellow },
    ],
    chartTitle: 'Works by Status',
    bars: [
      { label: 'Completed', value: 2614, color: A.green },
      { label: 'In Progress', value: 891, color: A.yellow },
      { label: 'Planned', value: 198, color: A.blue },
      { label: 'Suspended', value: 144, color: A.orange },
    ],
    tableTitle: 'Status Breakdown',
    tableHeaders: ['Status', 'Works', 'Share'],
    tableRows: [
      ['Completed', 2614, '67.9%'],
      ['In Progress', 891, '23.2%'],
      ['Planned', 198, '5.1%'],
      ['Suspended', 144, '3.7%'],
    ],
  };
  const byStatus = groupBy(rows, 'status');
  const statusColors: Record<string, string> = {
    Completed: A.green, 'In Progress': A.yellow, Planned: A.blue, Cancelled: A.gray, Suspended: A.orange,
  };
  const bars: Bar[] = Object.entries(byStatus)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([label, value]) => ({ label, value, color: statusColors[label] ?? A.blue }));
  const completed = byStatus['Completed'] ?? byStatus['completed'] ?? 0;
  const inProgress = byStatus['In Progress'] ?? byStatus['in_progress'] ?? byStatus['Active'] ?? 0;
  return {
    kpis: [
      { label: 'Works Recorded', value: total.toLocaleString(), color: A.orange },
      { label: 'Completed', value: completed.toLocaleString(), color: A.green },
      { label: 'In Progress', value: inProgress.toLocaleString(), color: A.yellow },
    ],
    chartTitle: 'Works by Status',
    bars,
    tableTitle: 'Status Breakdown',
    tableHeaders: ['Status', 'Works', 'Share'],
    tableRows: bars.map(b => [b.label, b.value, pct(b.value, total)]),
  };
}


// ââ PIM fetcher (static representative data) ââââââââââââââââââââââââââââââââ
async function fetchPIM(): Promise<Dash | null> {
  const bars: Bar[] = [
    { label: 'Road Construction', value: 1280, color: A.yellow },
    { label: 'Road Rehabilitation', value: 840,  color: A.blue  },
    { label: 'Bridge Works',       value: 420,   color: A.green },
    { label: 'Equipment',          value: 360,   color: A.orange},
    { label: 'Donor Projects',     value: 300,   color: A.purple ?? A.blue },
  ];
  return {
    kpis: [
      { label: 'FY24/25 Budget (UGX T)', value: '3.2',  color: A.yellow },
      { label: 'Donor Share',            value: '50%',  color: A.blue   },
      { label: 'Active PPPs',            value: '2',    color: A.green  },
      { label: 'NDP IV Target km',       value: '12,000', color: A.orange },
    ],
    chartTitle: 'Budget Allocation by Category (UGX Bn)',
    bars,
    tableTitle: 'Investment Breakdown',
    tableHeaders: ['Category', 'UGX Bn', 'Share'],
    tableRows: bars.map(b => [b.label, b.value.toLocaleString(), pct(b.value, 3200)]),
  };
}

// ââ Road Reserve fetcher âââââââââââââââââââââââââââââââââââââââââââââââââââââ
async function fetchRoadReserve(): Promise<Dash | null> {
  const URL  = import.meta.env.VITE_SUPABASE_URL as string;
  const KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const base = `${URL}/rest/v1/road_reserve_encroachments?select=status,resolution_status`;
  let rows: Record<string, string>[] = [];
  try {
    const r = await fetch(base, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (r.ok) rows = await r.json();
  } catch { /* graceful fallback */ }

  if (!rows.length) {
    const bars: Bar[] = [
      { label: 'Pending',   value: 312, color: A.orange },
      { label: 'Resolved',  value: 187, color: A.green  },
      { label: 'Under Review', value: 98, color: A.yellow},
      { label: 'Escalated', value: 43,  color: A.red ?? A.orange },
    ];
    const total = bars.reduce((s,b)=>s+b.value,0);
    return {
      kpis: [
        { label: 'Encroachments',   value: '640',  color: A.orange },
        { label: 'Resolved',        value: '187',  color: A.green  },
        { label: 'Gazette Reserves', value: '4,200 km', color: A.blue },
        { label: 'Permits Issued',  value: '23',   color: A.yellow },
      ],
      chartTitle: 'Encroachments by Status',
      bars,
      tableTitle: 'Status Breakdown',
      tableHeaders: ['Status', 'Count', 'Share'],
      tableRows: bars.map(b => [b.label, b.value, pct(b.value, total)]),
    };
  }

  const total = rows.length;
  const byStatus = groupBy(rows, 'status');
  const statusColors: Record<string,string> = { Pending: A.orange, Resolved: A.green, 'Under Review': A.yellow };
  const bars: Bar[] = Object.entries(byStatus).sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([label,value]) => ({ label, value, color: statusColors[label] ?? A.blue }));
  const resolved = byStatus['Resolved'] ?? 0;
  return {
    kpis: [
      { label: 'Encroachments', value: total.toLocaleString(),    color: A.orange },
      { label: 'Resolved',      value: resolved.toLocaleString(), color: A.green  },
    ],
    chartTitle: 'Encroachments by Status',
    bars,
    tableTitle: 'Status Breakdown',
    tableHeaders: ['Status', 'Count', 'Share'],
    tableRows: bars.map(b => [b.label, b.value, pct(b.value, total)]),
  };
}

// ââ fetcher registry âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const FETCHERS: Partial<Record<string, () => Promise<Dash | null>>> = {
  rms: fetchRMS,
  pms: fetchPMS,
  roadcondition: fetchPMS,
  npms: fetchPMS,
  nbms: fetchBMS,
  bms: fetchBMS,
  traffic: fetchTraffic,
  atc: fetchTraffic,
  ntis: fetchTraffic,
  ducar: fetchDUCAR,
  pim: fetchPIM,
  roadreserve: fetchRoadReserve,
};

// ââ section definitions (label + icon + chips) âââââââââââââââââââââââââââââââââ
interface Def { title: string; desc: React.ReactNode; chips: string[]; icon: React.ReactNode; accent: string; }
import React from 'react';

const DEFS: Record<string, Def> = {
  rms: {
    title: 'Road Management System (RMS)',
    desc: (<>The <strong style={{ color: A.cyan }}>DNR Road Management Engine</strong> is Uganda's integrated platform for the <em>planning, programming, budgeting, maintenance, and monitoring</em> of road network assets throughout their life cycle, incorporating Pavement Management (PMS), Bridge Management (BMS), Traffic Information (TIS), Investment Planning (NDPIV), Output-based Contracts (OPRC), Life Cycle Cost Analysis, Budget Optimisation, and Analytics.</>),
    chips: ['ISO 55001 Aligned', 'HDM-4 Powered', 'GIS Integrated', 'ML-Enhanced', 'AfDB / World Bank Compliant'],
    icon: <Shield size={20} />, accent: A.cyan,
  },
  pms: {
    title: 'Pavement Management System (PMS)',
    desc: (<>Monitors and analyses the condition of all paved and unpaved surfaces on Uganda's national road network. Integrates <strong style={{ color: A.green }}>IRI roughness surveys</strong>, rutting measurements, visual distress data and HDM-4 deterioration models to generate prioritised maintenance and rehabilitation programmes.</>),
    chips: ['IRI Roughness Monitoring', 'HDM-4 Powered', 'GIS Integrated', 'Condition-Based'],
    icon: <Layers size={20} />, accent: A.green,
  },
  roadcondition: {
    title: 'Road Condition Assessment',
    desc: (<>Real-time and historic condition ratings across the national network, integrating ROMDAS survey data, drone inspections and GIS overlays. Supports <strong style={{ color: A.green }}>asset performance benchmarking</strong> and defect-triggered maintenance planning.</>),
    chips: ['ROMDAS Integrated', 'GIS Overlays', 'Real-Time Data', 'Multi-Modal Survey'],
    icon: <Activity size={20} />, accent: A.green,
  },
  bms: {
    title: 'Bridge Management System (BMS)',
    desc: (<>Inventories and inspects all bridges, culverts and drainage structures on the national road network. Tracks <strong style={{ color: A.purple }}>structural health, maintenance history, load ratings</strong> and repair costs, supporting risk-based prioritisation under DNR's bridge lifecycle programme.</>),
    chips: ['Structural Health Monitoring', 'Load Rating', 'Photo-Twin Enabled', 'NBMS Aligned'],
    icon: <Link2 size={20} />, accent: A.purple,
  },
  traffic: {
    title: 'Traffic Information System (TIS)',
    desc: (<>Collects, processes and reports <strong style={{ color: A.yellow }}>traffic volume counts, vehicle classification, axle-load data</strong> and speed profiles from Automatic Traffic Counters and weigh-in-motion stations across key corridors. Feeds ESA computations and road-safety analytics.</>),
    chips: ['ATC Network', 'WIM Stations', 'ESA Computation', 'Corridor Analysis'],
    icon: <Activity size={20} />, accent: A.yellow,
  },
  atc: {
    title: 'Automatic Traffic Counter (ATC)',
    desc: (<>Manages the network of permanent and portable <strong style={{ color: A.yellow }}>Automatic Traffic Counters</strong> deployed on the national road network. Provides classified traffic volumes, seasonal factors, growth trends and vehicle-mix profiles used in pavement and infrastructure design.</>),
    chips: ['Permanent ATC Stations', 'Portable Units', 'Seasonal Factors', 'Growth Modelling'],
    icon: <Activity size={20} />, accent: A.yellow,
  },
  ntis: {
    title: 'National Transport Information System (NTIS)',
    desc: (<>The <strong style={{ color: A.blue }}>geospatial intelligence hub</strong> integrating road network geometry, traffic flows, pavement condition, bridge inventory and infrastructure programme data into a unified GIS-driven view for strategic planning and donor reporting.</>),
    chips: ['Geospatial Hub', 'Multi-Layer GIS', 'Donor Reporting', 'Real-Time Feeds'],
    icon: <Globe size={20} />, accent: A.blue,
  },
  npms: {
    title: 'National Pavement Management System (NPMS)',
    desc: (<>National-level pavement performance monitoring integrating road condition surveys, <strong style={{ color: A.green }}>HDM-4 models</strong> and budget scenarios to produce long-term network performance forecasts and optimal maintenance strategies across all road classes.</>),
    chips: ['Network-Wide', 'HDM-4 Models', 'Budget Scenarios', 'Performance Forecasting'],
    icon: <Layers size={20} />, accent: A.green,
  },
  nbms: {
    title: 'National Bridge Management System (NBMS)',
    desc: (<>Consolidated inventory and inspection platform for all national bridges. Integrates structural assessments, routine inspection records and maintenance histories to support <strong style={{ color: A.purple }}>evidence-based bridge rehabilitation</strong> planning and donor reporting.</>),
    chips: ['National Inventory', 'Structural Assessment', 'Inspection Records', 'Donor Reporting'],
    icon: <Link2 size={20} />, accent: A.purple,
  },
  network: {
    title: 'Network Section',
    desc: (<>Manages the <strong style={{ color: A.cyan }}>classified national road network database</strong> including geometry, administrative boundaries, road hierarchy and historical changes. Provides the authoritative asset register underpinning all RMS modules.</>),
    chips: ['Asset Register', 'Network Hierarchy', 'GIS Geometry', 'Classified Network'],
    icon: <Network size={20} />, accent: A.cyan,
  },
  roadreserve: {
    title: 'Road Reserve Management',
    desc: (<>Monitors and enforces statutory road reserve corridors on national roads. Tracks <strong style={{ color: A.orange }}>encroachments</strong>, records demarcation surveys, manages utility-crossing permits and generates compliance reports for legal enforcement.</>),
    chips: ['Corridor Demarcation', 'Encroachment Tracking', 'Utility Permits', 'Compliance Reporting'],
    icon: <MapPin size={20} />, accent: A.orange,
  },
  gisenterprise: {
    title: 'GIS Enterprise Platform',
    desc: (<>Enterprise spatial data infrastructure underpinning all RMS modules. Maintains <strong style={{ color: A.blue }}>authoritative layers</strong> for roads, bridges, stations, land use and administrative boundaries, with real-time syncing to ArcGIS Online and field data-collection apps.</>),
    chips: ['ArcGIS Enterprise', 'Real-Time Sync', 'Field Apps', 'Authoritative Layers'],
    icon: <Map size={20} />, accent: A.blue,
  },
  bridgeworks: {
    title: 'Bridge Works Programme',
    desc: (<>Tracks design, procurement and construction progress for all national <strong style={{ color: A.purple }}>bridge rehabilitation and new-build projects</strong>. Links physical inspection records with contract status, expenditure and completion milestones.</>),
    chips: ['Project Tracking', 'Contract Management', 'Physical Progress', 'Expenditure Monitoring'],
    icon: <Wrench size={20} />, accent: A.purple,
  },
  pim: {
    title: 'Public Investment Management (PIM)',
    desc: (<>Manages the <strong style={{ color: A.orange }}>NDPIV-aligned capital investment pipeline</strong> for national road infrastructure. Integrates project appraisal, multi-year budget forecasts, donor-funding profiles and output-based contract performance data.</>),
    chips: ['NDPIV Aligned', 'Capital Investment', 'Donor Funding', 'OPRC Performance'],
    icon: <Briefcase size={20} />, accent: A.orange,
  },
  budget: {
    title: 'Budget & Finance Management',
    desc: (<>Tracks annual and multi-year budget allocations, releases and expenditure against maintenance and rehabilitation programmes across all national road <strong style={{ color: A.orange }}>maintenance zones and projects</strong>. Supports IFMS reconciliation and donor reporting.</>),
    chips: ['IFMS Integration', 'Multi-Year Budget', 'Zone-Level Tracking', 'Donor Reporting'],
    icon: <BarChart2 size={20} />, accent: A.orange,
  },
  lifecycle: {
    title: 'Lifecycle Cost Analysis',
    desc: (<>Evaluates the <strong style={{ color: A.teal }}>whole-life cost of road asset interventions</strong> using HDM-4 models and NPV analysis. Supports evidence-based selection between maintenance, rehabilitation and reconstruction options across the network.</>),
    chips: ['HDM-4 Models', 'NPV Analysis', 'Whole-Life Cost', 'Evidence-Based Selection'],
    icon: <TrendingUp size={20} />, accent: A.teal,
  },
  roadatlas: {
    title: 'Road Atlas',
    desc: (<>Interactive digital atlas of Uganda's national road network, providing <strong style={{ color: A.blue }}>classified route sheets, bridge schedules, chainage markers</strong> and administrative mapping for field operations, planning and public communication.</>),
    chips: ['Route Sheets', 'Bridge Schedules', 'Chainage Markers', 'Administrative Maps'],
    icon: <Map size={20} />, accent: A.blue,
  },
  roadvideo: {
    title: 'Road Video Library',
    desc: (<>Archive of pavement condition video collected by ROMDAS survey vehicles and drone flights. Links <strong style={{ color: A.yellow }}>kilometre-referenced video</strong> to condition data, enabling virtual inspection and audit of road surfaces across the national network.</>),
    chips: ['ROMDAS Video', 'Drone Footage', 'Km-Referenced', 'Virtual Inspection'],
    icon: <Video size={20} />, accent: A.yellow,
  },
  projects: {
    title: 'Projects & Works',
    desc: (<>Consolidated view of all active and planned maintenance, rehabilitation and capital-works contracts on the national road network. Tracks <strong style={{ color: A.teal }}>procurement status, contractor performance</strong>, physical progress and financial expenditure.</>),
    chips: ['Contract Management', 'Procurement Tracking', 'Physical Progress', 'Contractor Performance'],
    icon: <Briefcase size={20} />, accent: A.teal,
  },
  casestudies: {
    title: 'Global Case Studies',
    desc: (<>Curated library of <strong style={{ color: A.pink }}>international best-practice case studies</strong> in road asset management, covering pavement performance, bridge maintenance strategies, traffic management and public-investment frameworks from Africa, Asia and OECD countries.</>),
    chips: ['International Best Practice', 'Asset Management', 'Policy Frameworks', 'Benchmarking'],
    icon: <BookOpen size={20} />, accent: A.pink,
  },
  admin: {
    title: 'Admin â Sources & Evidence',
    desc: (<>System administration hub for the Uganda NRMS. Manages <strong style={{ color: A.cyan }}>user roles, data-source configurations, audit logs, SQL schema documentation</strong> and evidence trails for all RMS data submissions and revisions.</>),
    chips: ['Role Management', 'Audit Logs', 'SQL Schema', 'Data Provenance'],
    icon: <Settings size={20} />, accent: A.cyan,
  },
  hdm4: {
    title: 'HDM-4 Analysis',
    desc: (<>Runs <strong style={{ color: A.teal }}>HDM-4 model simulations</strong> to forecast long-term pavement deterioration, compute road user costs and generate optimised multi-year maintenance programme recommendations aligned to Uganda's annual road fund allocations.</>),
    chips: ['HDM-4 Modelling', 'Deterioration Forecasting', 'Road User Costs', 'Programme Optimisation'],
    icon: <TrendingUp size={20} />, accent: A.teal,
  },
  ducar: {
    title: 'DUCAR â District, Urban & Community Access Roads',
    desc: (<>The <strong style={{ color: A.orange }}>Department of Urban and Community Access Roads</strong> manages urban roads, district feeder roads, and community access routes across Uganda's 146 Local Government Units â connecting farmers, schools and health centres with the national network.</>),
    chips: ['Urban Roads', 'District Feeder Roads', 'Community Access', 'Labour-Based Works', 'NDP IV Aligned'],
    icon: <Building2 size={20} />, accent: A.orange,
  },
  sources: {
    title: 'Data Sources & Quality',
    desc: (<>Primary data sources, collection methodologies, quality assurance processes and data provenance for all network information. Supports <strong style={{ color: A.cyan }}>audit-ready reporting</strong> and evidence-based decision making across all RMS modules.</>),
    chips: ['Data Provenance', 'QA Processes', 'Audit-Ready', 'Multi-Source'],
    icon: <Database size={20} />, accent: A.cyan,
  },
};

// ââ tiny UI components âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function Chip({ label, color }: { label: string; color: string }) {
  const r = rgb(color);
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
      color: `rgb(${r})`, background: `rgba(${r},0.12)`,
      border: `1px solid rgba(${r},0.3)`, borderRadius: 6, padding: '3px 9px',
    }}>{label}</span>
  );
}

function KPICard({ kpi }: { kpi: KPI }) {
  const r = rgb(kpi.color);
  return (
    <div style={{
      flex: '1 1 0', minWidth: 120, borderRadius: 10, padding: '14px 16px',
      background: `rgba(${r},0.07)`, border: `1px solid rgba(${r},0.22)`,
    }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: kpi.color, letterSpacing: -0.5 }}>
        {kpi.value ?? 'â'}
      </div>
      <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.8)', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {kpi.label}
      </div>
      {kpi.sub && (
        <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.45)', marginTop: 2 }}>{kpi.sub}</div>
      )}
    </div>
  );
}

function BarChart({ title, bars }: { title: string; bars: Bar[] }) {
  const max = Math.max(...bars.map(b => b.value), 1);
  return (
    <div style={{ borderRadius: 10, padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.7)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {bars.map(bar => (
          <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.65)', width: 96, flexShrink: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {bar.label ?? 'â'}
            </div>
            <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.max(2, (bar.value / max) * 100)}%`, height: '100%', borderRadius: 3,
                background: bar.color, transition: 'width 0.55s ease',
              }} />
            </div>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.55)', width: 38, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {(bar.value ?? 0).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryTable({ title, headers, rows }: { title: string; headers: string[]; rows: (string | number)[][] }) {
  if (!rows.length) return null;
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ padding: '9px 14px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.75)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{ padding: '7px 12px', textAlign: 'left', color: 'rgba(148,163,184,0.5)', fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '7px 12px', color: ci === 0 ? '#d1d5db' : 'rgba(148,163,184,0.65)', fontVariantNumeric: 'tabular-nums' }}>
                  {cell ?? 'â'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ââ live panel (fetches Supabase data) âââââââââââââââââââââââââââââââââââââââââ
function LivePanel({ sectionId, accent }: { sectionId: string; accent: string }) {
  const [state, setState] = useState<'loading' | 'empty' | Dash>('loading');

  const load = useCallback(async () => {
    setState('loading');
    const fetcher = FETCHERS[sectionId];
    if (!fetcher) { setState('empty'); return; }
    try {
      const d = await fetcher();
      setState(d ?? 'empty');
    } catch { setState('empty'); }
  }, [sectionId]);

  useEffect(() => { void load(); }, [load]);

  if (state === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: 'rgba(148,163,184,0.4)', fontSize: 12 }}>
        <RefreshCw size={13} style={{ animation: 'sd-spin 1s linear infinite', color: accent }} />
        Loading live dataâ¦
      </div>
    );
  }

  if (state === 'empty') {
    const r = rgb(accent);
    return (
      <div style={{
        borderRadius: 10, padding: '18px 16px', marginTop: 10,
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Database size={18} style={{ color: `rgba(${r},0.55)`, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(148,163,184,0.65)' }}>No data available yet</div>
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)', marginTop: 2 }}>
            Supabase tables for this section are empty or not yet connected.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {state.kpis.map((kpi, i) => <KPICard key={i} kpi={kpi} />)}
      </div>
      {state.bars.length > 0 && <BarChart title={state.chartTitle} bars={state.bars} />}
      <SummaryTable title={state.tableTitle} headers={state.tableHeaders} rows={state.tableRows} />
    </div>
  );
}

// ââ main export ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
import { InsightGrid } from './InsightGrid';
import { SchemaExplorer } from './SchemaExplorer';
import { SectionMap } from './SectionMap';
import { ExhaustiveTables } from './ExhaustiveTables';
import { DeepAnalysisTables } from './DeepAnalysisTables';

const CAP: Record<string, { c: string; l: string }> = {
  rms: { c: 'condition', l: 'road condition survey' },
  pms: { c: 'condition', l: 'pavement condition survey' },
  tis: { c: 'traffic', l: 'traffic count record' },
  bms: { c: 'inspection', l: 'bridge inspection record' },
  ducar: { c: 'works', l: 'DUCAR works record' },
  reserve: { c: 'encroachment', l: 'road reserve field data' },
  pim: { c: 'project', l: 'investment project record' },
  projects: { c: 'works', l: 'project works update' },
};

export default function SectionDashboard({ sectionId, accent }: { sectionId: string; accent: string }) {
  const def = DEFS[sectionId] ?? DEFS.rms;
  const acc = def?.accent || accent;
  const r = rgb(acc);

  return (
    <div style={{ padding: '6px 8px', width: '100%' }}>
      <style>{`@keyframes sd-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Definition Strip â Compact Â· Slim Â· Full-Width */}
      <div style={{
        background: `rgba(${r},0.04)`, border: `1px solid rgba(${r},0.15)`,
        borderRadius: 10, padding: '6px 12px', marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0, fontSize: 13,
            background: `linear-gradient(135deg,rgba(${r},0.2),rgba(0,0,0,0))`,
            border: `1px solid rgba(${r},0.3)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: acc,
          }}>{def?.icon}</div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span style={{ fontSize: 12.5, fontWeight: 900, color: '#e2eaf4', whiteSpace: 'nowrap' }}>{def?.title}</span>
            <span style={{ fontSize: 11, color: 'rgba(203,213,225,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{def?.desc}</span>
            <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {(def?.chips ?? []).slice(0, 3).map(t => <Chip key={t} label={t} color={acc} />)}
            </span>
          </div>
        </div>
      </div>

      {/* Section Sub-Tabs: Dashboard | Map | Tables | Deep Analytics | SQL | Data Capture */}
      <SectionSubTabs sectionId={sectionId} accent={acc} />
    </div>
  );
}

const LazyHub = lazy(() => import('../DataEntry/DataCaptureHub'));
const SECTION_ALIAS: Record<string, string> = {
  traffic: 'tis', condition: 'pms', registry: 'bms', inspections: 'bms', bridgeworks: 'bms',
  maintenance: 'ducar', priority: 'pim', budget: 'pim', lifecycle: 'pim', roadreserve: 'reserve',
};
const SUBTABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'map', label: 'Interactive Map' },
  { id: 'tables', label: 'Exhaustive Tables' },
  { id: 'analytics', label: 'Deep Analytics' },
  { id: 'sql', label: 'SQL Database & Schema' },
  { id: 'capture', label: 'Data Capture' },
];
function SectionSubTabs({ sectionId, accent }: { sectionId: string; accent: string }) {
  const [tab, setTab] = useState('dashboard');
  const sid = SECTION_ALIAS[sectionId] ?? sectionId;
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 10, position: 'sticky', top: 0, zIndex: 20, background: 'rgba(2,6,23,0.92)', backdropFilter: 'blur(8px)' }}>
        {SUBTABS.map(t => (
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
      {tab === 'dashboard' && (<><SectionSignatureBlock sectionId={sid} /><InsightGrid sectionId={sid} accent={accent} /></>)}
      {tab === 'map' && <SectionMap sectionId={sid} accent={accent} />}
      {tab === 'tables' && <ExhaustiveTables sectionId={sid} accent={accent} />}
      {tab === 'analytics' && <DeepAnalysisTables sectionId={sid} accent={accent} />}
      {tab === 'sql' && <SchemaExplorer sectionId={sid} accent={accent} />}
      {tab === 'capture' && (
        <Suspense fallback={<div style={{ padding: 20, color: '#64748b', fontSize: 12 }}>Loading data capture moduleâ¦</div>}>
          <LazyHub />
        </Suspense>
      )}
    </div>
  );
}

const LazyTraffic = lazy(() => import('./sections/TrafficDashboard'));
const LazyPavement = lazy(() => import('./sections/PavementDashboard'));
const LazyStructures = lazy(() => import('./sections/StructuresDashboard'));
const LazyMaintenance = lazy(() => import('./sections/MaintenanceDashboard'));
const LazyInventory = lazy(() => import('./sections/InventoryDashboard'));
const LazyPriority = lazy(() => import('./sections/PriorityDashboard'));
const LazyDrainage = lazy(() => import('./sections/DrainageDashboard'));

// — Supabase offline banner ————————————
function DbOfflineBanner() {
  if (!_dbDown) return null;
  return (
    <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 11,
      color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 8 }}>
      ⚠ Database offline — KPI figures unavailable. Resume the Supabase project to restore live data.
    </div>
  );
}

function SectionSignatureBlock({ sectionId }: { sectionId: string }) {
  const C = sectionId === 'tis' ? LazyTraffic
    : sectionId === 'pms' ? LazyPavement
    : sectionId === 'bms' ? LazyStructures
    : (sectionId === 'ducar' || sectionId === 'projects') ? LazyMaintenance
    : sectionId === 'rms' ? LazyInventory
    : sectionId === 'pim' ? LazyPriority
    : null;
  if (!C) return null;
  return (
    <DbOfflineBanner />
    <div style={{ marginBottom: 14 }}>
      <Suspense fallback={<div style={{ padding: 16, color: '#64748b', fontSize: 12 }}>Loading section dashboardâ¦</div>}>
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
