/**
 * SectionDashboard — Dynamic Supabase-connected dashboard panel.
 *
 * Serves as the first "Dashboard" sub-tab in every section across all platforms.
 * ALL metrics, labels, and chart data come from Supabase — zero hardcoded values.
 * Styling matches the "network story" dark-neon theme used throughout NRMS.
 *
 * Props:
 *   sectionId  — matches the sidebar view id (e.g. 'rms', 'bms', 'traffic')
 *   accent     — optional override for the accent colour
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import {
  LayoutDashboard, RefreshCw, TrendingUp, Database,
  Activity, Gauge, Route, Layers, Network, Building2,
  Hammer, Search, DollarSign, Clock, FolderOpen, Map,
  ClipboardCheck, Wrench, Globe, Shield,
} from 'lucide-react';

// ── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg:     '#020202',
  panel:  'rgba(6,12,20,0.96)',
  border: 'rgba(0,245,255,0.12)',
  cyan:   '#00f5ff',
  green:  '#00ff88',
  orange: '#ff6600',
  pink:   '#ff006e',
  yellow: '#ffee00',
  blue:   '#4d9fff',
  purple: '#a855f7',
  dim:    'rgba(148,163,184,0.6)',
  text:   '#e2eaf4',
} as const;

// ── Icon map ─────────────────────────────────────────────────────────────────
const ICONS: Record<string, React.ReactNode> = {
  Route:         <Route size={15} />,
  Layers:        <Layers size={15} />,
  Network:       <Network size={15} />,
  Building2:     <Building2 size={15} />,
  Hammer:        <Hammer size={15} />,
  Search:        <Search size={15} />,
  DollarSign:    <DollarSign size={15} />,
  Clock:         <Clock size={15} />,
  FolderOpen:    <FolderOpen size={15} />,
  Map:           <Map size={15} />,
  ClipboardCheck:<ClipboardCheck size={15} />,
  Wrench:        <Wrench size={15} />,
  Globe:         <Globe size={15} />,
  Shield:        <Shield size={15} />,
  Gauge:         <Gauge size={15} />,
  BarChart3:     <TrendingUp size={15} />,
  Activity:      <Activity size={15} />,
  Database:      <Database size={15} />,
};

// ── Type definitions ─────────────────────────────────────────────────────────
interface KpiConfig {
  label: string;
  table: string;
  column?: string;
  filter?: Record<string, string | number | boolean>;
  agg: 'count' | 'sum' | 'avg' | 'max';
  unit?: string;
  color: string;
  icon: string;
}

interface ChartConfig {
  title: string;
  table: string;
  groupBy: string;
  limit?: number;
}

interface SectionConf {
  subtitle: string;
  accent: string;
  kpis: KpiConfig[];
  chart?: ChartConfig;
}

// ── Section configurations ────────────────────────────────────────────────────
// One entry per sectionId — drives KPI cards and optional bar chart
// ALL values come from Supabase; no figures hardcoded here.
const SECTION_CONFIG: Record<string, SectionConf> = {
  rms: {
    subtitle: 'Road Management System',
    accent: C.cyan,
    kpis: [
      { label: 'Road Links',       table: 'road_links',            agg: 'count', color: C.cyan,   icon: 'Route'     },
      { label: 'Total km',         table: 'road_links', column: 'length_km', agg: 'sum', unit: ' km', color: C.green, icon: 'Map' },
      { label: 'Structures',       table: 'structures',            agg: 'count', color: C.orange, icon: 'Network'   },
      { label: 'Active Projects',  table: 'projects',              agg: 'count', color: C.yellow, icon: 'FolderOpen' },
    ],
    chart: { title: 'Road Links by Region', table: 'road_links', groupBy: 'region', limit: 10 },
  },
  pms: {
    subtitle: 'Pavement Management System',
    accent: C.orange,
    kpis: [
      { label: 'Road Sections',   table: 'road_links',            agg: 'count', color: C.orange, icon: 'Layers'        },
      { label: 'Inspections',     table: 'inspections',           agg: 'count', color: C.green,  icon: 'ClipboardCheck' },
      { label: 'Maint. Works',    table: 'maintenance_programme', agg: 'count', color: C.cyan,   icon: 'Wrench'        },
      { label: 'Projects',        table: 'projects',              agg: 'count', color: C.yellow, icon: 'FolderOpen'    },
    ],
    chart: { title: 'Maintenance Works by Type', table: 'maintenance_programme', groupBy: 'category', limit: 8 },
  },
  roadcondition: {
    subtitle: 'Pavement & Road Condition',
    accent: C.orange,
    kpis: [
      { label: 'Road Links',      table: 'road_links',            agg: 'count', color: C.orange, icon: 'Route'         },
      { label: 'Inspections',     table: 'inspections',           agg: 'count', color: C.green,  icon: 'ClipboardCheck' },
      { label: 'Maint. Works',    table: 'maintenance_programme', agg: 'count', color: C.cyan,   icon: 'Wrench'        },
    ],
    chart: { title: 'Inspections by Rating', table: 'inspections', groupBy: 'condition_rating', limit: 8 },
  },
  bms: {
    subtitle: 'Bridge Management System',
    accent: C.blue,
    kpis: [
      { label: 'Structures',      table: 'structures',            agg: 'count', color: C.blue,   icon: 'Network'       },
      { label: 'Inspections',     table: 'inspections',           agg: 'count', color: C.green,  icon: 'Search'        },
      { label: 'Bridge Works',    table: 'maintenance_programme', agg: 'count', color: C.pink,   icon: 'Hammer'        },
      { label: 'Projects',        table: 'projects',              agg: 'count', color: C.yellow, icon: 'FolderOpen'    },
    ],
    chart: { title: 'Structures by Type', table: 'structures', groupBy: 'structure_type', limit: 8 },
  },
  traffic: {
    subtitle: 'Traffic Information System',
    accent: C.cyan,
    kpis: [
      { label: 'ATC Stations',    table: 'atc_stations',  agg: 'count',                            color: C.cyan,   icon: 'Gauge'    },
      { label: 'Active Stations', table: 'atc_stations',  agg: 'count', filter: { status: 'Active' }, color: C.green, icon: 'Activity' },
      { label: 'Count Records',   table: 'traffic_counts', agg: 'count',                           color: C.orange, icon: 'BarChart3' },
    ],
    chart: { title: 'Stations by Region', table: 'atc_stations', groupBy: 'region', limit: 10 },
  },
  atc: {
    subtitle: 'Automatic Traffic Counter System',
    accent: C.orange,
    kpis: [
      { label: 'Total Stations',  table: 'atc_stations',  agg: 'count',                            color: C.orange, icon: 'Gauge'     },
      { label: 'Active',          table: 'atc_stations',  agg: 'count', filter: { status: 'Active' }, color: C.green, icon: 'Activity'  },
      { label: 'Count Records',   table: 'traffic_counts', agg: 'count',                           color: C.cyan,   icon: 'BarChart3' },
    ],
    chart: { title: 'Stations by County', table: 'atc_stations', groupBy: 'county', limit: 12 },
  },
  ntis: {
    subtitle: 'National Transport Information System',
    accent: C.cyan,
    kpis: [
      { label: 'ATC Stations',    table: 'atc_stations',   agg: 'count', color: C.cyan,   icon: 'Gauge'     },
      { label: 'Traffic Records', table: 'traffic_counts', agg: 'count', color: C.green,  icon: 'Activity'  },
      { label: 'Road Links',      table: 'road_links',     agg: 'count', color: C.orange, icon: 'Route'     },
    ],
    chart: { title: 'Traffic Stations by Region', table: 'atc_stations', groupBy: 'region', limit: 10 },
  },
  npms: {
    subtitle: 'National Pavement Management System',
    accent: C.orange,
    kpis: [
      { label: 'Road Sections',   table: 'road_links',            agg: 'count', color: C.orange, icon: 'Layers'        },
      { label: 'Inspections',     table: 'inspections',           agg: 'count', color: C.green,  icon: 'ClipboardCheck' },
      { label: 'Maint. Works',    table: 'maintenance_programme', agg: 'count', color: C.cyan,   icon: 'Wrench'        },
      { label: 'Projects',        table: 'projects',              agg: 'count', color: C.yellow, icon: 'FolderOpen'    },
    ],
    chart: { title: 'Works by Category', table: 'maintenance_programme', groupBy: 'category', limit: 8 },
  },
  nbms: {
    subtitle: 'National Bridge Management System',
    accent: C.blue,
    kpis: [
      { label: 'Bridge Inventory', table: 'structures',            agg: 'count', color: C.blue,   icon: 'Network'  },
      { label: 'Inspections',      table: 'inspections',           agg: 'count', color: C.green,  icon: 'Search'   },
      { label: 'Bridge Works',     table: 'maintenance_programme', agg: 'count', color: C.pink,   icon: 'Hammer'   },
    ],
    chart: { title: 'Structures by Type', table: 'structures', groupBy: 'structure_type', limit: 8 },
  },
  network: {
    subtitle: 'Network Overview',
    accent: C.cyan,
    kpis: [
      { label: 'Road Links',      table: 'road_links',    agg: 'count', color: C.cyan,   icon: 'Route'     },
      { label: 'Structures',      table: 'structures',    agg: 'count', color: C.blue,   icon: 'Building2' },
      { label: 'ATC Stations',    table: 'atc_stations',  agg: 'count', color: C.orange, icon: 'Gauge'     },
      { label: 'Projects',        table: 'projects',      agg: 'count', color: C.yellow, icon: 'FolderOpen' },
    ],
    chart: { title: 'Traffic Stations by Region', table: 'atc_stations', groupBy: 'region', limit: 10 },
  },
  roadreserve: {
    subtitle: 'Road Reserve Management',
    accent: C.green,
    kpis: [
      { label: 'Road Links',      table: 'road_links',   agg: 'count', color: C.green,  icon: 'Route'         },
      { label: 'Structures',      table: 'structures',   agg: 'count', color: C.blue,   icon: 'Building2'     },
      { label: 'Inspections',     table: 'inspections',  agg: 'count', color: C.cyan,   icon: 'ClipboardCheck' },
    ],
    chart: { title: 'Road Links by Region', table: 'road_links', groupBy: 'region', limit: 10 },
  },
  gisenterprise: {
    subtitle: 'GIS Enterprise Platform',
    accent: C.purple,
    kpis: [
      { label: 'Road Links',      table: 'road_links',    agg: 'count', color: C.purple, icon: 'Layers'    },
      { label: 'Structures',      table: 'structures',    agg: 'count', color: C.blue,   icon: 'Building2' },
      { label: 'ATC Stations',    table: 'atc_stations',  agg: 'count', color: C.orange, icon: 'Gauge'     },
    ],
    chart: { title: 'Network by Region', table: 'road_links', groupBy: 'region', limit: 10 },
  },
  bridgeworks: {
    subtitle: 'Bridge Works Programme',
    accent: C.blue,
    kpis: [
      { label: 'Structures',      table: 'structures',            agg: 'count', color: C.blue,   icon: 'Network'  },
      { label: 'Works Items',     table: 'maintenance_programme', agg: 'count', color: C.green,  icon: 'Hammer'   },
      { label: 'Inspections',     table: 'inspections',           agg: 'count', color: C.cyan,   icon: 'Search'   },
    ],
    chart: { title: 'Works by Category', table: 'maintenance_programme', groupBy: 'category', limit: 8 },
  },
  pim: {
    subtitle: 'Public Investment Management',
    accent: C.yellow,
    kpis: [
      { label: 'Projects',        table: 'projects',              agg: 'count', color: C.yellow, icon: 'Building2' },
      { label: 'Road Links',      table: 'road_links',            agg: 'count', color: C.cyan,   icon: 'Route'     },
      { label: 'Works Items',     table: 'maintenance_programme', agg: 'count', color: C.orange, icon: 'Wrench'    },
    ],
    chart: { title: 'Projects by Phase', table: 'projects', groupBy: 'phase', limit: 10 },
  },
  budget: {
    subtitle: 'Budget & Financial Management',
    accent: C.yellow,
    kpis: [
      { label: 'Projects',        table: 'projects',              agg: 'count', color: C.yellow, icon: 'DollarSign' },
      { label: 'Maint. Works',    table: 'maintenance_programme', agg: 'count', color: C.orange, icon: 'Wrench'     },
      { label: 'Road Links',      table: 'road_links',            agg: 'count', color: C.cyan,   icon: 'Route'      },
    ],
    chart: { title: 'Projects by Phase', table: 'projects', groupBy: 'phase', limit: 10 },
  },
  lifecycle: {
    subtitle: 'Life Cycle Management',
    accent: C.green,
    kpis: [
      { label: 'Road Links',      table: 'road_links',            agg: 'count', color: C.green,  icon: 'Clock'    },
      { label: 'Structures',      table: 'structures',            agg: 'count', color: C.blue,   icon: 'Building2' },
      { label: 'Works Items',     table: 'maintenance_programme', agg: 'count', color: C.orange, icon: 'Wrench'   },
    ],
    chart: { title: 'Road Links by Region', table: 'road_links', groupBy: 'region', limit: 10 },
  },
  roadatlas: {
    subtitle: 'Road Atlas',
    accent: C.cyan,
    kpis: [
      { label: 'Road Links',      table: 'road_links',   agg: 'count', color: C.cyan,   icon: 'Map'       },
      { label: 'Structures',      table: 'structures',   agg: 'count', color: C.blue,   icon: 'Building2' },
      { label: 'ATC Stations',    table: 'atc_stations', agg: 'count', color: C.orange, icon: 'Gauge'     },
    ],
    chart: { title: 'Road Links by Region', table: 'road_links', groupBy: 'region', limit: 10 },
  },
  roadvideo: {
    subtitle: 'Road Video Survey',
    accent: C.cyan,
    kpis: [
      { label: 'Road Links',      table: 'road_links',   agg: 'count', color: C.cyan,   icon: 'Route'    },
      { label: 'Inspections',     table: 'inspections',  agg: 'count', color: C.green,  icon: 'Search'   },
    ],
    chart: { title: 'Road Links by Region', table: 'road_links', groupBy: 'region', limit: 10 },
  },
  projects: {
    subtitle: 'Road Projects Tracker',
    accent: C.yellow,
    kpis: [
      { label: 'Total Projects',  table: 'projects',   agg: 'count', color: C.yellow, icon: 'FolderOpen' },
      { label: 'Road Links',      table: 'road_links', agg: 'count', color: C.cyan,   icon: 'Route'      },
    ],
    chart: { title: 'Projects by Phase', table: 'projects', groupBy: 'phase', limit: 10 },
  },
  casestudies: {
    subtitle: 'Global Case Studies',
    accent: C.cyan,
    kpis: [
      { label: 'Road Links',      table: 'road_links',   agg: 'count', color: C.cyan,   icon: 'Globe'     },
      { label: 'ATC Stations',    table: 'atc_stations', agg: 'count', color: C.orange, icon: 'Gauge'     },
    ],
  },
  admin: {
    subtitle: 'Admin Tools',
    accent: C.cyan,
    kpis: [
      { label: 'Road Links',      table: 'road_links',    agg: 'count', color: C.cyan,   icon: 'Database'  },
      { label: 'ATC Stations',    table: 'atc_stations',  agg: 'count', color: C.green,  icon: 'Gauge'     },
      { label: 'Traffic Records', table: 'traffic_counts', agg: 'count', color: C.orange, icon: 'Activity' },
      { label: 'Structures',      table: 'structures',    agg: 'count', color: C.blue,   icon: 'Network'   },
    ],
    chart: { title: 'Network Stats by Region', table: 'atc_stations', groupBy: 'region', limit: 10 },
  },
  hdm4: {
    subtitle: 'HDM-4 Analysis',
    accent: C.orange,
    kpis: [
      { label: 'Road Links',      table: 'road_links',            agg: 'count', color: C.orange, icon: 'Route'    },
      { label: 'Maint. Works',    table: 'maintenance_programme', agg: 'count', color: C.cyan,   icon: 'Wrench'   },
    ],
  },
};

const DEFAULT_CONF: SectionConf = {
  subtitle: 'Section Overview',
  accent: C.cyan,
  kpis: [
    { label: 'Road Links',      table: 'road_links',     agg: 'count', color: C.cyan,   icon: 'Route'     },
    { label: 'ATC Stations',    table: 'atc_stations',   agg: 'count', color: C.green,  icon: 'Gauge'     },
    { label: 'Traffic Records', table: 'traffic_counts', agg: 'count', color: C.orange, icon: 'BarChart3' },
    { label: 'Structures',      table: 'structures',     agg: 'count', color: C.yellow, icon: 'Building2' },
  ],
  chart: { title: 'Traffic Stations by Region', table: 'atc_stations', groupBy: 'region', limit: 10 },
};

// ── Types for runtime data ───────────────────────────────────────────────────
interface KpiResult { label: string; value: number | string; color: string; unit: string; icon: string }
interface ChartRow  { label: string; value: number }

// ── Tooltip for bar chart ────────────────────────────────────────────────────
function NeonTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(2,6,14,0.97)', border: `1px solid ${C.border}`,
      padding: '6px 10px', borderRadius: 6, fontSize: 11, color: C.text,
    }}>
      <div style={{ color: C.dim, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, color: C.cyan }}>{payload[0].value}</div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function SectionDashboard({
  sectionId,
  accent: accentProp,
}: {
  sectionId: string;
  accent?: string;
}) {
  const conf = SECTION_CONFIG[sectionId] ?? DEFAULT_CONF;
  const accent = accentProp ?? conf.accent;

  const [kpis,      setKpis]      = useState<KpiResult[]>([]);
  const [chartData, setChartData] = useState<ChartRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [tick,      setTick]      = useState(0); // refresh trigger

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // ── KPI fetches ─────────────────────────────────────────────────────
      const kpiResults = await Promise.all(conf.kpis.map(async (k): Promise<KpiResult> => {
        try {
          if (k.agg === 'count') {
            let q = supabase.from(k.table).select('*', { count: 'exact', head: true });
            if (k.filter) {
              for (const [col, val] of Object.entries(k.filter)) q = q.eq(col, val);
            }
            const { count, error } = await q;
            if (error) throw error;
            return { label: k.label, value: count ?? 0, color: k.color, unit: k.unit ?? '', icon: k.icon };
          }

          if (k.agg === 'sum' && k.column) {
            const { data, error } = await supabase.from(k.table).select(k.column).limit(5000);
            if (error) throw error;
            const total = (data ?? []).reduce((s, r) => s + (Number(r[k.column!]) || 0), 0);
            return { label: k.label, value: Math.round(total * 10) / 10, color: k.color, unit: k.unit ?? '', icon: k.icon };
          }

          if (k.agg === 'avg' && k.column) {
            const { data, error } = await supabase.from(k.table).select(k.column).limit(5000);
            if (error) throw error;
            const arr = (data ?? []).map(r => Number(r[k.column!]) || 0).filter(v => v > 0);
            const avg = arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 10) / 10 : 0;
            return { label: k.label, value: avg, color: k.color, unit: k.unit ?? '', icon: k.icon };
          }

          return { label: k.label, value: '—', color: k.color, unit: k.unit ?? '', icon: k.icon };
        } catch {
          return { label: k.label, value: '—', color: k.color, unit: k.unit ?? '', icon: k.icon };
        }
      }));

      // ── Chart fetch ─────────────────────────────────────────────────────
      let chart: ChartRow[] = [];
      if (conf.chart) {
        const { data } = await supabase
          .from(conf.chart.table)
          .select(conf.chart.groupBy)
          .limit(conf.chart.limit ?? 500);

        if (data && data.length > 0) {
          const grouped: Record<string, number> = {};
          for (const row of data) {
            const key = String(row[conf.chart.groupBy] ?? 'Unknown');
            grouped[key] = (grouped[key] ?? 0) + 1;
          }
          chart = Object.entries(grouped)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, conf.chart.limit ?? 10);
        }
      }

      setKpis(kpiResults);
      setChartData(chart);
      setFetchedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [sectionId, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // ── Bar colours cycling accent shades ────────────────────────────────────
  const barColors = [accent, C.green, C.orange, C.blue, C.pink, C.yellow, C.purple, C.cyan];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:C.bg, overflow:'auto', fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <style>{`
        @keyframes sdFadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sdPulse  { 0%,100%{opacity:1} 50%{opacity:.45} }
        .sd-kpi  { transition:transform .15s,box-shadow .15s; }
        .sd-kpi:hover { transform:translateY(-2px)!important; box-shadow:0 8px 32px rgba(0,0,0,.6)!important; }
        .sd-panel { transition:box-shadow .2s; border-radius:8px; }
        .sd-panel:hover { box-shadow:0 0 0 1px rgba(0,245,255,.2)!important; }
      `}</style>

      {/* Header */}
      <div style={{ padding:'16px 20px 4px', display:'flex', alignItems:'flex-end', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ color:accent, fontSize:10, fontWeight:700, letterSpacing:'.2em', textTransform:'uppercase', opacity:.7 }}>{conf.subtitle}</div>
          <div style={{ color:'#e2e8f0', fontSize:18, fontWeight:700, marginTop:2 }}>
            Analytics
            <span style={{ color:'rgba(148,163,184,.35)', fontSize:11, fontWeight:400, marginLeft:8 }}>
              · {kpis.filter(k=>k.value!==null).length} metrics
            </span>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {error && <span style={{ color:C.orange, fontSize:10 }}>⚠ {String(error)}</span>}
          {fetchedAt && <span style={{ color:'rgba(148,163,184,.4)', fontSize:10 }}>{(fetchedAt as Date).toLocaleTimeString()}</span>}
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10, padding:'12px 20px', flexShrink:0 }}>
        {kpis.length === 0 && loading
          ? Array.from({length:6}).map((_,i) => (
              <div key={i} style={{ background:'rgba(0,14,28,.92)', borderRadius:8, padding:'14px 16px', borderTop:'2px solid rgba(0,245,255,.15)', animation:`sdPulse 1.4s ease ${i*0.1}s infinite` }}>
                <div style={{ height:22, background:'rgba(255,255,255,.06)', borderRadius:3, marginBottom:6 }} />
                <div style={{ height:10, background:'rgba(255,255,255,.03)', borderRadius:3, width:'55%' }} />
              </div>
            ))
          : kpis.slice(0,6).map((k,i) => {
              const col = k.color || barColours[i % barColours.length];
              const v = k.value;
              const display = v === null
                ? (k.loading ? '…' : '—')
                : (v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 10_000 ? `${(v/1_000).toFixed(0)}k` : v >= 1_000 ? `${(v/1_000).toFixed(1)}k` : v.toLocaleString());
              const sfx = k.unit || '';
              return (
                <div key={k.label} className="sd-kpi" style={{ background:'rgba(0,14,28,.92)', border:`1px solid ${col}22`, borderTop:`2px solid ${col}`, borderRadius:8, padding:'14px 16px', animation:`sdFadeIn .35s ease ${i*55}ms both` }}>
                  <div style={{ color:col, fontSize:22, fontWeight:800, letterSpacing:'-.02em', lineHeight:1 }}>
                    {display}{sfx && <span style={{ fontSize:11, marginLeft:3, opacity:.7 }}>{sfx}</span>}
                  </div>
                  <div style={{ color:'rgba(148,163,184,.7)', fontSize:9, fontWeight:600, letterSpacing:'.12em', textTransform:'uppercase', marginTop:4 }}>{k.label}</div>
                </div>
              );
            })
        }
      </div>

      {/* Charts Row 1: 3 columns */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, padding:'0 20px 12px', flexShrink:0 }}>

        {/* Donut / Pie */}
        <div className="sd-panel" style={{ background:'rgba(0,14,28,.92)', border:'1px solid rgba(0,245,255,.12)', padding:'12px 16px' }}>
          <div style={{ color:'#e2e8f0', fontSize:10, fontWeight:600, letterSpacing:'.1em', textTransform:'uppercase', opacity:.75, marginBottom:6 }}>Composition</div>
          {kpis.some(k=>k.value!==null&&(k.value as number)>0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={kpis.filter(k=>k.value!==null&&(k.value as number)>0).map((k,i)=>({ name:k.label, value:k.value as number, color:k.color||barColours[i%barColours.length] }))}
                  cx="50%" cy="50%" innerRadius={52} outerRadius={82} dataKey="value" paddingAngle={2} strokeWidth={0}
                >
                  {kpis.filter(k=>k.value!==null&&(k.value as number)>0).map((k,i)=>(
                    <Cell key={i} fill={k.color||barColours[i%barColours.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background:'rgba(2,14,28,.97)', border:'1px solid rgba(0,245,255,.15)', borderRadius:6, color:'#e2e8f0', fontSize:11 }} formatter={(v:any)=>[typeof v==='number'?v.toLocaleString():v,'']} />
                <Legend iconType="circle" iconSize={7} formatter={(v:any)=><span style={{ color:'rgba(148,163,184,.6)', fontSize:9 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(148,163,184,.3)', fontSize:11 }}>{loading ? 'Loading…' : 'No data yet'}</div>
          )}
        </div>

        {/* Vertical Bar — Metrics Overview */}
        <div className="sd-panel" style={{ background:'rgba(0,14,28,.92)', border:'1px solid rgba(0,245,255,.12)', padding:'12px 16px' }}>
          <div style={{ color:'#e2e8f0', fontSize:10, fontWeight:600, letterSpacing:'.1em', textTransform:'uppercase', opacity:.75, marginBottom:6 }}>Metrics Overview</div>
          {kpis.some(k=>k.value!==null) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={kpis.slice(0,8).filter(k=>k.value!==null).map((k,i)=>({ name:k.label.split(' ').slice(-1)[0], full:k.label, value:k.value as number }))}
                margin={{ top:4, right:6, bottom:30, left:0 }}
              >
                <XAxis dataKey="name" tick={{ fill:'rgba(148,163,184,.6)', fontSize:9 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fill:'rgba(148,163,184,.6)', fontSize:9 }} />
                <Tooltip contentStyle={{ background:'rgba(2,14,28,.97)', border:'1px solid rgba(0,245,255,.15)', borderRadius:6, color:'#e2e8f0', fontSize:11 }} formatter={(v:any,_:any,p:any)=>[typeof v==='number'?v.toLocaleString():v, p?.payload?.full||'']} />
                <Bar dataKey="value" radius={[3,3,0,0]}>
                  {kpis.slice(0,8).filter(k=>k.value!==null).map((k,i)=>(<Cell key={i} fill={k.color||barColours[i%barColours.length]} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(148,163,184,.3)', fontSize:11 }}>{loading ? 'Loading…' : 'No data yet'}</div>
          )}
        </div>

        {/* Horizontal Bar — Ranked or chartData */}
        <div className="sd-panel" style={{ background:'rgba(0,14,28,.92)', border:'1px solid rgba(0,245,255,.12)', padding:'12px 16px' }}>
          <div style={{ color:'#e2e8f0', fontSize:10, fontWeight:600, letterSpacing:'.1em', textTransform:'uppercase', opacity:.75, marginBottom:6 }}>
            {chartData.length > 0 ? 'Category Breakdown' : 'Ranked'}
          </div>
          {(() => {
            const rows = chartData.length > 0
              ? chartData.slice(0,8)
              : [...kpis].filter(k=>k.value!==null).sort((a,b)=>(b.value as number)-(a.value as number)).slice(0,8).map((k,i)=>({ label:k.label, value:k.value as number }));
            return rows.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={rows} layout="vertical" margin={{ top:4, right:20, bottom:4, left:68 }}>
                  <XAxis type="number" tick={{ fill:'rgba(148,163,184,.6)', fontSize:9 }} />
                  <YAxis type="category" dataKey="label" tick={{ fill:'rgba(148,163,184,.6)', fontSize:8 }} width={66} />
                  <Tooltip contentStyle={{ background:'rgba(2,14,28,.97)', border:'1px solid rgba(0,245,255,.15)', borderRadius:6, color:'#e2e8f0', fontSize:11 }} formatter={(v:any)=>[typeof v==='number'?v.toLocaleString():v,'']} />
                  <Bar dataKey="value" radius={[0,3,3,0]}>
                    {rows.map((_:any,i:number)=>(<Cell key={i} fill={barColours[i%barColours.length]} opacity={0.88} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(148,163,184,.3)', fontSize:11 }}>{loading ? 'Loading…' : 'No data yet'}</div>;
          })()}
        </div>
      </div>

      {/* Charts Row 2: 2 columns */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, padding:'0 20px 20px', flexShrink:0 }}>

        {/* Value Distribution */}
        <div className="sd-panel" style={{ background:'rgba(0,14,28,.92)', border:'1px solid rgba(0,245,255,.12)', padding:'12px 16px' }}>
          <div style={{ color:'#e2e8f0', fontSize:10, fontWeight:600, letterSpacing:'.1em', textTransform:'uppercase', opacity:.75, marginBottom:6 }}>Value Distribution</div>
          {kpis.some(k=>k.value!==null) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={kpis.filter(k=>k.value!==null).map((k,i)=>({ name:k.label.split(' ').map((w:string)=>w[0]||'').join('').toUpperCase(), full:k.label, value:k.value as number }))}
                margin={{ top:4, right:6, bottom:20, left:0 }}
              >
                <XAxis dataKey="name" tick={{ fill:'rgba(148,163,184,.6)', fontSize:9 }} />
                <YAxis tick={{ fill:'rgba(148,163,184,.6)', fontSize:9 }} />
                <Tooltip contentStyle={{ background:'rgba(2,14,28,.97)', border:'1px solid rgba(0,245,255,.15)', borderRadius:6, color:'#e2e8f0', fontSize:11 }} formatter={(v:any,_:any,p:any)=>[typeof v==='number'?v.toLocaleString():v, p?.payload?.full||'']} />
                <Bar dataKey="value" radius={[3,3,0,0]}>
                  {kpis.filter(k=>k.value!==null).map((_:any,i:number)=>(<Cell key={i} fill={barColours[i%barColours.length]} opacity={0.88} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(148,163,184,.3)', fontSize:11 }}>{loading ? 'Loading…' : 'No data yet'}</div>
          )}
        </div>

        {/* Score Matrix */}
        <div className="sd-panel" style={{ background:'rgba(0,14,28,.92)', border:'1px solid rgba(0,245,255,.12)', padding:'12px 16px' }}>
          <div style={{ color:'#e2e8f0', fontSize:10, fontWeight:600, letterSpacing:'.1em', textTransform:'uppercase', opacity:.75, marginBottom:8 }}>Score Matrix</div>
          {kpis.some(k=>k.value!==null) ? (() => {
            const loaded = kpis.filter(k=>k.value!==null);
            const maxV = Math.max(...loaded.map(k=>k.value as number), 1);
            return (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
                {loaded.slice(0,9).map((k,i) => {
                  const col = k.color || barColours[i%barColours.length];
                  const pct = Math.min(100, Math.round(((k.value as number)/maxV)*100));
                  const v = k.value as number;
                  const disp = v>=1_000_000?`${(v/1_000_000).toFixed(1)}M`:v>=1_000?`${(v/1_000).toFixed(1)}k`:v.toLocaleString();
                  return (
                    <div key={k.label} style={{ background:`${col}10`, border:`1px solid ${col}28`, borderRadius:6, padding:'8px 9px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <span style={{ color:'rgba(148,163,184,.6)', fontSize:7.5, textTransform:'uppercase', letterSpacing:'.06em', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', maxWidth:'68%' }}>{k.label}</span>
                        <span style={{ color:col, fontSize:8, fontWeight:700 }}>{pct}%</span>
                      </div>
                      <div style={{ height:2.5, background:`${col}1a`, borderRadius:2, overflow:'hidden', marginBottom:5 }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:col, borderRadius:2, transition:'width .6s ease' }} />
                      </div>
                      <div style={{ color:col, fontSize:13, fontWeight:800, lineHeight:1 }}>
                        {disp}
                        {k.unit && <span style={{ fontSize:8.5, opacity:.65, marginLeft:2 }}>{k.unit}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })() : (
            <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(148,163,184,.3)', fontSize:11 }}>{loading ? 'Loading…' : 'No data yet'}</div>
          )}
        </div>
      </div>
    </div>
  );
}
