/**
 * OverloadingSection - Pavement overloading analytics
 *
 * ESAL methodology (SATCC/TRH4, standard axle = 80 kN):
 *   - HGV at legal weight: 2.4 ESALs → overloaded +25%: 5.86 ESALs (4th power law)
 *   - Bus at legal weight: 1.6 ESALs → overloaded +10%: 2.34 ESALs
 *   - Risk index = min(100, heavy_veh_per_day / 1000 × 100) × surface/class multipliers
 */
import { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
  PieChart, Pie,
} from 'recharts';
import { Truck, AlertTriangle, Info, Activity } from 'lucide-react';
import {
  REGION_NEON, Bar3D, Chart3DWrap, TT_NEON, TICK,
} from '../../lib/chart3d';
import { ModuleNavBar } from '../../shared/ModuleNavBar';
import SourceTableButton from '../../shared/SourceTableButton';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';
import { RoadClassPill } from '../../shared/tableFormatting';

// ── Risk colour palette ───────────────────────────────────────────────────────
const RISK_COLOR: Record<string, string> = {
  Critical: '#ef4444',
  High:     '#f97316',
  Medium:   '#eab308',
  Low:      '#22c55e',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface OverloadingKPIs {
  total_links:          number;
  total_daily_esals:    number;
  annual_esal_millions: number;
  avg_hgv_pct:          number;
  critical_links:       number;
  high_risk_links:      number;
  mean_esals_per_link:  number;
}
interface RegionRow {
  region:             string;
  total_esals_daily:  number;
  avg_hgv_pct:        number;
  critical_links:     number;
  high_risk_links:    number;
  overload_risk_score: number;
  link_count:         number;
}
interface LinkRow {
  link_id:              string;
  road_name:            string;
  road_no:              string;
  region:               string;
  road_class:           string;
  surface_type:         string;
  length_km:            number;
  aadt:                 number;
  hgv_pct:              number;
  estimated_daily_esals: number;
  overload_risk_index:  number;
  risk_category:        string;
  pavement_damage_factor: number;
}
interface LinkRisk { rc: string; idx: number; hpct: number; esal: number }
interface OverloadingSummary {
  network_kpis:            OverloadingKPIs;
  esal_breakdown_by_class: Record<string, number>;
  risk_distribution:       Record<string, number>;
  overloading_by_region:   RegionRow[];
  top_overloaded_links:    LinkRow[];
  link_risk_map:           Record<string, LinkRisk>;
}

// ── KPI neon card (ATC-style) ─────────────────────────────────────────────────
function hexRgbInline(hex: string) {
  if (hex.startsWith('#')) {
    return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
  }
  return '148,163,184';
}
function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub: string; color: string; icon: React.ReactNode;
}) {
  const rgb = hexRgbInline(color);
  return (
    <div style={{
      background: `rgba(${rgb},0.07)`,
      border: `1px solid rgba(${rgb},0.18)`,
      borderLeft: `4px solid ${color}`,
      borderRadius: 12, padding: '14px 16px',
      boxShadow: `0 0 20px rgba(${rgb},0.11), inset 0 1px 0 rgba(255,255,255,0.04)`,
      backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: `rgba(${rgb},0.14)`, border: `1px solid rgba(${rgb},0.25)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '0.12em', color: 'rgba(148,163,184,0.55)', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
          textShadow: `0 0 16px rgba(${rgb},0.65)` }}>{value}</div>
        <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', marginTop: 3 }}>{sub}</div>
      </div>
    </div>
  );
}

// ── Custom donut label ────────────────────────────────────────────────────────
function DonutLabel({ cx, cy, midAngle, outerRadius, name, value, total }: any) {
  if (!value || value / total < 0.03) return null;
  const RADIAN = Math.PI / 180;
  const r = outerRadius + 22;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  const pct = ((value / total) * 100).toFixed(0);
  return (
    <text x={x} y={y} fill="rgba(148,163,184,0.75)" fontSize={9} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {name} {pct}%
    </text>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function OverloadingSection() {
  const [summary,      setSummary]      = useState<OverloadingSummary | null>(null);
  const [geoFeatures,  setGeoFeatures]  = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedLink, setSelectedLink] = useState<any>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/overloading_summary.json`).then(r => r.json()),
      fetch(`${base}data/traffic_predictions.geojson`).then(r => r.json()),
    ]).then(([sum, gj]) => {
      setSummary(sum as OverloadingSummary);
      setGeoFeatures((gj.features ?? []) as any[]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const kpis        = summary?.network_kpis;
  const riskDist    = summary?.risk_distribution ?? {};
  const byRegion    = summary?.overloading_by_region ?? [];
  const top20       = summary?.top_overloaded_links ?? [];
  const linkRiskMap = summary?.link_risk_map ?? {};
  const esalBreak   = summary?.esal_breakdown_by_class ?? {};

  // Full-network ESAL ranking - every link in link_risk_map, not just the top 20.
  // link_risk_map carries fewer columns than top_overloaded_links (no road name/class/
  // surface - the pre-generated bundle only ships full detail for the top 20), but it
  // does carry the ranking metric (esal) for the whole network, so this is the genuine
  // "all available records" view rather than a re-hash of the same 20.
  const allRanked = useMemo(() =>
    Object.entries(linkRiskMap)
      .map(([link_id, v]) => ({ link_id, ...v }))
      .sort((a, b) => b.esal - a.esal)
      .map((r, i) => ({ ...r, rank: i + 1 })),
    [linkRiskMap]);

  const top20WithRank = useMemo(
    () => top20.map((r, i) => ({ ...r, rank: i + 1 })),
    [top20],
  );
  const top20LengthKm = useMemo(
    () => top20.reduce((s, r) => s + (r.length_km ?? 0), 0),
    [top20],
  );

  // ESAL donut data - filter Motorcycles (=0)
  const donutData = useMemo(() => {
    const total = Object.values(esalBreak).reduce((a, b) => a + b, 0);
    return Object.entries(esalBreak)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, total }))
      .sort((a, b) => b.value - a.value);
  }, [esalBreak]);
  const donutTotal = donutData.reduce((a, b) => a + b.value, 0);

  const DONUT_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#0a84ff'];

  // Regional chart data sorted by ESALs
  const regionChart = byRegion.map(r => ({
    region: r.region,
    ESALs:  Math.round(r.total_esals_daily / 1000),  // thousands
    Risk:   r.overload_risk_score,
    color:  REGION_NEON[r.region] ?? '#475569',
  })).sort((a, b) => b.ESALs - a.ESALs);

  // Risk distribution bar
  const riskBar = [
    { name: 'Critical', count: riskDist.Critical ?? 0, color: RISK_COLOR.Critical },
    { name: 'High',     count: riskDist.High     ?? 0, color: RISK_COLOR.High     },
    { name: 'Medium',   count: riskDist.Medium   ?? 0, color: RISK_COLOR.Medium   },
    { name: 'Low',      count: riskDist.Low       ?? 0, color: RISK_COLOR.Low      },
  ];

  const top20Columns: STColumn<LinkRow & { rank: number }>[] = useMemo(() => [
    {
      key: 'road_name', label: 'Road',
      render: r => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', fontFamily: 'monospace', width: 18, flexShrink: 0 }}>{r.rank}</span>
          <span style={{ color: '#e2eaf4', fontWeight: 600 }} title={r.road_name}>{r.road_name}</span>
        </span>
      ),
    },
    { key: 'region', label: 'Region' },
    { key: 'road_class', label: 'Class', render: r => <RoadClassPill cls={r.road_class} /> },
    {
      key: 'length_km', label: 'Length (km)', numeric: true, total: 'sum',
      comment: 'Length of this road link affected by the overloading risk assessment.',
      render: r => r.length_km != null ? r.length_km.toFixed(1) : '-',
    },
    {
      key: 'hgv_pct', label: 'HGV %', numeric: true,
      render: r => <span style={{ color: '#ffd60a', fontFamily: 'monospace' }}>{r.hgv_pct.toFixed(1)}%</span>,
    },
    {
      key: 'estimated_daily_esals', label: 'Daily ESALs', numeric: true, total: 'sum',
      render: r => <span style={{ color: '#e2eaf4', fontFamily: 'monospace' }}>{r.estimated_daily_esals.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>,
    },
    {
      key: 'pavement_damage_factor', label: 'Dmg Factor', numeric: true,
      render: r => <span style={{ color: '#c4d2e1', fontFamily: 'monospace' }}>{r.pavement_damage_factor.toFixed(2)}×</span>,
    },
    {
      key: 'risk_category', label: 'Risk',
      render: r => (
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '2px 9px', borderRadius: 999,
          background: `rgba(${hexRgbInline(RISK_COLOR[r.risk_category] ?? '#94a3b8')},0.15)`,
          color: RISK_COLOR[r.risk_category] ?? '#94a3b8',
          border: `1px solid rgba(${hexRgbInline(RISK_COLOR[r.risk_category] ?? '#94a3b8')},0.3)`,
        }}>
          {r.risk_category}
        </span>
      ),
    },
    {
      key: 'surface_type', label: 'Surface',
      render: r => <span style={{ textTransform: 'capitalize' }}>{r.surface_type}</span>,
    },
  ], []);

  const allRankedColumns: STColumn<{ link_id: string; rank: number } & LinkRisk>[] = useMemo(() => [
    { key: 'rank', label: '#', numeric: true, width: 44 },
    { key: 'link_id', label: 'Link ID', render: r => <span style={{ color: '#e2eaf4', fontWeight: 600 }}>{r.link_id}</span> },
    {
      key: 'idx', label: 'Risk Index', numeric: true,
      render: r => <span style={{ color: '#c4d2e1', fontFamily: 'monospace' }}>{r.idx.toFixed(1)}</span>,
    },
    {
      key: 'hpct', label: 'HGV %', numeric: true,
      render: r => <span style={{ color: '#ffd60a', fontFamily: 'monospace' }}>{r.hpct.toFixed(1)}%</span>,
    },
    {
      key: 'esal', label: 'Daily ESALs', numeric: true, total: 'sum',
      render: r => <span style={{ color: '#e2eaf4', fontFamily: 'monospace' }}>{r.esal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>,
    },
    {
      key: 'rc', label: 'Risk',
      render: r => (
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '2px 9px', borderRadius: 999,
          background: `rgba(${hexRgbInline(RISK_COLOR[r.rc] ?? '#94a3b8')},0.15)`,
          color: RISK_COLOR[r.rc] ?? '#94a3b8',
          border: `1px solid rgba(${hexRgbInline(RISK_COLOR[r.rc] ?? '#94a3b8')},0.3)`,
        }}>
          {r.rc}
        </span>
      ),
    },
  ], []);

  function onLinkClick(props: any) {
    const lr = linkRiskMap[props?.link_id ?? ''];
    setSelectedLink(lr ? { ...lr, link_name: props?.link_name ?? props?.link_id } : null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        Computing ESAL risk indices…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 animate-fade-in">

      <ModuleNavBar module="TIS" />

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <Truck size={20} style={{ color: '#ef4444' }}/>
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Overloading Analytics</h1>
          <p className="text-xs text-slate-400">
            ESAL risk index · SATCC/TRH4 methodology · Uganda legal limits 10/16/24/48 t
          </p>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Daily ESALs"
          value={kpis ? `${(kpis.total_daily_esals / 1_000_000).toFixed(1)}M` : '-'}
          sub="Equiv. standard axle loads / day"
          color="#ef4444"
          icon={<Activity size={18}/>}
        />
        <KpiCard
          label="Critical Risk Links"
          value={kpis ? kpis.critical_links.toString() : '-'}
          sub={`+ ${kpis?.high_risk_links ?? 0} High risk links`}
          color="#f97316"
          icon={<AlertTriangle size={18}/>}
        />
        <KpiCard
          label="Avg Network HGV %"
          value={kpis ? `${kpis.avg_hgv_pct.toFixed(1)}%` : '-'}
          sub="Heavy vehicles as % of AADT"
          color="#eab308"
          icon={<Truck size={18}/>}
        />
        <KpiCard
          label="Annual Pavement Damage"
          value={kpis ? `${kpis.annual_esal_millions.toFixed(0)}M` : '-'}
          sub="Million ESALs / year (network)"
          color="#a78bfa"
          icon={<Activity size={18}/>}
        />
      </div>

      {/* ── Map + Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Overloading risk map removed - TIS Traffic Map already covers the network map */}

        {/* Charts column */}
        <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ESAL breakdown donut */}
          <div className="bms-card flex-1">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-bold text-white mb-1">ESAL Load by Vehicle Class</div>
                <div className="text-[10px] text-slate-500 mb-2">Daily overloaded ESALs</div>
              </div>
              <SourceTableButton anchor="tbl-024" />
            </div>
            <Chart3DWrap tilt={0}>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Tooltip
                    {...TT_NEON}
                    formatter={(v: number) => [v.toLocaleString(), 'ESALs/day']}
                  />
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                    label={(p) => <DonutLabel {...p} total={donutTotal}/>}
                    animationDuration={800}
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]}/>
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </Chart3DWrap>
          </div>

          {/* Risk distribution mini-bar */}
          <div className="bms-card">
            <div className="flex items-start justify-between mb-3">
              <div className="text-xs font-bold text-white">Risk Distribution</div>
              <SourceTableButton anchor="tbl-023" />
            </div>
            <div className="space-y-2">
              {riskBar.map(item => {
                const pct = kpis ? (item.count / kpis.total_links) * 100 : 0;
                return (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-16 text-[10px] font-semibold" style={{ color: item.color }}>{item.name}</div>
                    <div className="flex-1 h-4 rounded-sm overflow-hidden bg-slate-800/60">
                      <div
                        className="h-full rounded-sm transition-all duration-700"
                        style={{ width: `${pct}%`, background: item.color, opacity: 0.8 }}
                      />
                    </div>
                    <div className="w-10 text-right text-[10px] text-slate-400">{item.count}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-[9px] text-slate-600">{kpis?.total_links ?? 0} road links total</div>
          </div>
        </div>
      </div>

      {/* ── Regional ESALs bar chart ── */}
      <div className="bms-card">
        <div className="text-sm font-bold text-white mb-1">Daily ESAL Load by Region (thousands)</div>
        <div className="text-[10px] text-slate-500 mb-4">
          Total estimated equivalent standard axle loads per day · overloaded HGV +25%, bus +10%
        </div>
        <Chart3DWrap>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={regionChart} layout="vertical" margin={{ top: 0, right: 16, left: 90, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" horizontal={false}/>
              <XAxis type="number" tick={TICK} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `${v.toLocaleString()}k`}/>
              <YAxis type="category" dataKey="region" tick={TICK} axisLine={false} tickLine={false} width={88}/>
              <Tooltip {...TT_NEON}
                formatter={(v: number) => [`${(v * 1000).toLocaleString()}`, 'ESALs/day']}/>
              <Bar dataKey="ESALs" radius={[0, 4, 4, 0]} animationDuration={900} shape={<Bar3D/>}>
                {regionChart.map(r => <Cell key={r.region} fill={REGION_NEON[r.region] ?? '#475569'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Chart3DWrap>
      </div>

      {/* ── Top 20 overloaded roads table ── */}
      <div className="bms-card">
        <div className="text-sm font-bold text-white mb-1 flex items-center gap-2">
          <AlertTriangle size={15} style={{ color: '#ef4444' }}/>
          Top 20 Highest-Risk Road Links
        </div>
        <div className="text-[10px] text-slate-500 mb-4">
          Ranked by estimated daily ESAL load - full detail (road name/class/surface) is only pre-computed for these top 20; see the full {allRanked.length.toLocaleString()}-link ranking below for every other road.
          {' '}Combined length affected: <span style={{ color: '#e2eaf4', fontWeight: 700 }}>{top20LengthKm.toFixed(1)} km</span>.
        </div>
        <SortableFilterableTable
          columns={top20Columns}
          rows={top20WithRank}
          accent="#ef4444"
          exportName="top-20-overloaded-links"
          initialSort="estimated_daily_esals"
          emptyText="No overloaded-link data available."
        />
      </div>

      {/* ── Full-network ESAL ranking - every link, not just the top 20 ── */}
      <div className="bms-card">
        <div className="text-sm font-bold text-white mb-1 flex items-center gap-2">
          <Truck size={15} style={{ color: '#64d2ff' }}/>
          Full Network Ranking - All {allRanked.length.toLocaleString()} Links
        </div>
        <div className="text-[10px] text-slate-500 mb-4">
          Every link with a computed risk score, ranked by estimated daily ESAL load (no cap). Link-level length (km) is not
          carried in this dataset - see the Top 20 table above for length figures on the highest-risk links.
        </div>
        <SortableFilterableTable
          columns={allRankedColumns}
          rows={allRanked}
          accent="#64d2ff"
          exportName="full-network-esal-ranking"
          initialSort="esal"
          emptyText="No network risk-ranking data available."
        />
      </div>

      {/* ── Info panel ── */}
      <div className="bms-card" style={{ borderColor: 'rgba(167,139,250,0.15)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Info size={15} style={{ color: '#a78bfa' }}/>
          <div className="text-sm font-bold text-white">Methodology & Legal Standards</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-[11px] text-slate-400 leading-relaxed">

          <div>
            <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-2">
              Uganda Legal Axle Load Limits
            </div>
            <div className="space-y-1">
              {[
                ['Single axle',   '10 t'],
                ['Tandem axle',   '16 t'],
                ['Tridem axle',   '24 t'],
                ['Gross vehicle', '48 t (54 t for 5-axle)'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-500">{k}</span>
                  <span className="text-slate-200 font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2">
              4th Power Law - Pavement Damage
            </div>
            <p>
              Damage ∝ (axle_load / standard_axle)<sup>4</sup>. Standard axle = 80 kN (8.16 t).
              A vehicle 20% overloaded causes <span className="text-amber-300 font-semibold">2.1× the pavement damage</span> of
              a legal vehicle. At Uganda's typical +25% HGV overloading, an HGV
              generates <span className="text-red-400 font-semibold">5.86 ESALs</span> vs 2.4 at legal weight.
            </p>
          </div>

          <div>
            <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">
              Risk Index Calculation
            </div>
            <p>
              <span className="text-slate-300">Base score</span> = min(100, heavy_veh_day / 1000 × 100).
              Multiplied by surface vulnerability: unpaved ×1.3, Class&nbsp;C ×1.2.
              Sources: SATCC/TRH4 ESAL factors · AFCAP Uganda overloading surveys
              (+25% HGV, +10% bus) · Department of National Roads traffic count surveys 2017–2025.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
