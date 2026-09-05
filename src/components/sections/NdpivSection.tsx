import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Chart3DWrap, Bar3D, TT_NEON, TICK } from '../../lib/chart3d';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS, ROAD_STYLES, surfaceCategory } from '../../shared/mapSymbols';
import { InfraLayers } from '../../shared/InfraLayers';
import { MapLegend, LEGEND_PROJECTS } from '../../shared/MapLegend';
import { BarChart2 } from 'lucide-react';
import { ModuleNavBar } from '../../shared/ModuleNavBar';
import MapDetailPane, { StatCard, AttributeRow, SectionHeader } from '../../shared/MapDetailPane';
import SourceTableButton from '../../shared/SourceTableButton';
import CrossLinkChipBar from '../../shared/CrossLinkChipBar';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';

// ─── Types ────────────────────────────────────────────────────────────────────
// Matches data/oprc_ndpiv.json exactly. budget_usd is 0 for every entry
// today (these are FY26/27 NDPIV master-plan components, not yet costed
// project-by-project) - the removed disbursed_usd/completion_pct/target_year
// fields never existed in the real data and previously rendered as NaN/"$NaNM"
// everywhere they were used.
interface NdpivProject {
  project_id: string; name: string; component: string; road_links: string[]; region: string;
  priority: string; type: string; status: string;
  total_km: number; funder: string; budget_usd: number;
  centroid: [number, number];
}
interface OprcNdpivData { oprc_lots: unknown[]; ndpiv_projects: NdpivProject[] }

// ─── Categorical colour maps ──────────────────────────────────────────────────
const CATEGORY_COLOR: Record<string, string> = {
  'Roads':             '#3b82f6',
  'Bridges':           '#f97316',
  'Urban Roads':       '#a855f7',
  'Rehabilitation':    '#22c55e',
  'New Construction':  '#06b6d4',
};
function categoryColor(type: string): string { return CATEGORY_COLOR[type] ?? '#6b7280'; }

const STATUS_CLR: Record<string, string> = {
  'Construction': '#3b82f6', 'Procurement': '#8b5cf6',
  'Completed':    '#22c55e', 'Design / Planning': '#f59e0b',
};
function statusColor(s: string): string { return STATUS_CLR[s] ?? '#6b7280'; }

const TT_STYLE = { background: 'rgba(8,14,28,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 };

// ─── Diamond DivIcon factory - colored by project CATEGORY ───────────────────
const ICONS: Record<string, L.DivIcon> = Object.fromEntries(
  Object.entries(CATEGORY_COLOR).map(([type, color]) => [
    type,
    L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;background:${color};transform:rotate(45deg);border:2px solid rgba(255,255,255,0.85);box-shadow:0 0 10px ${color}90;"></div>`,
      iconSize:   [18, 18] as L.PointExpression,
      iconAnchor: [9,  9]  as L.PointExpression,
      popupAnchor:[0, -12] as L.PointExpression,
    }),
  ]),
);
const DEFAULT_ICON = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:#6b7280;transform:rotate(45deg);border:2px solid rgba(255,255,255,0.85);box-shadow:0 0 6px #6b728080;"></div>`,
  iconSize:   [18, 18] as L.PointExpression,
  iconAnchor: [9,  9]  as L.PointExpression,
  popupAnchor:[0, -12] as L.PointExpression,
});
function diamondIcon(type: string): L.DivIcon { return ICONS[type] ?? DEFAULT_ICON; }

function roadStyle(feature?: GeoJSON.Feature): L.PathOptions {
  const surf = (feature?.properties as { surface?: string })?.surface ?? '';
  const s = ROAD_STYLES[surfaceCategory(surf)];
  return { color: s.color, weight: s.weight, opacity: s.opacity, dashArray: s.dashArray };
}

const GLASS: React.CSSProperties = {
  background: 'rgba(15,23,42,0.55)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
};

function SummaryCard({ title, value, sub, accent }: { title: string; value: string; sub: string; accent: string }) {
  return (
    <div style={{ ...GLASS, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: accent, lineHeight: 1, textShadow: `0 0 16px ${accent}60` }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'rgba(100,116,139,0.8)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function PanelLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
      {text}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NdpivSection() {
  const [data,            setData]            = useState<OprcNdpivData | null>(null);
  const [regionFilter,    setRegionFilter]    = useState('All');
  const [selectedProject, setSelectedProject] = useState<NdpivProject | null>(null);
  const [roadGeo,         setRoadGeo]         = useState<GeoJSON.FeatureCollection | null>(null);
  const [corridorGeo,     setCorridorGeo]     = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}road_network.geojson`)
      .then(r => r.json())
      .then(setRoadGeo)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/ndpiv2026.geojson`)
      .then(r => r.json())
      .then(setCorridorGeo)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    fetch(`${base}data/oprc_ndpiv.json`)
      .then(r => r.json())
      .then((d: OprcNdpivData) => setData(d))
      .catch(() => {});
  }, []);

  const regions = useMemo(() =>
    data ? ['All', ...Array.from(new Set(data.ndpiv_projects.map(p => p.region))).sort()] : ['All'],
    [data],
  );
  const projects = useMemo(() =>
    !data ? [] : regionFilter === 'All' ? data.ndpiv_projects : data.ndpiv_projects.filter(p => p.region === regionFilter),
    [data, regionFilter],
  );

  const totalBudget = useMemo(() => projects.reduce((s, p) => s + p.budget_usd, 0), [projects]);
  const totalKm     = useMemo(() => projects.reduce((s, p) => s + p.total_km, 0), [projects]);

  // Clustered by category: km + road-link count (per-project cost isn't in
  // the FY26/27 master-plan rollup yet, so this reports what's real: scope)
  const categoryCluster = useMemo(() => {
    const m: Record<string, { km: number; links: number; count: number }> = {};
    projects.forEach(p => {
      if (!m[p.type]) m[p.type] = { km: 0, links: 0, count: 0 };
      m[p.type].km    += p.total_km;
      m[p.type].links += p.road_links.length;
      m[p.type].count++;
    });
    return Object.entries(m).map(([type, v]) => ({
      type: type.split(' ')[0], // abbreviate
      fullType: type,
      km:    Math.round(v.km),
      links: v.links,
      count: v.count,
    }));
  }, [projects]);

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: '#64748b' }}>
        <div style={{ textAlign: 'center', fontSize: 12 }}>Loading NDP IV data…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px', color: '#e2e8f0' }}>
      <CrossLinkChipBar sectionId="projects" />
      <ModuleNavBar module="Projects" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(191, 90, 242,0.25), rgba(59,130,246,0.2))',
          border: '1px solid rgba(191, 90, 242,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BarChart2 size={15} style={{ color: '#bf5af2' }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.01em' }}>NDP IV Investments</div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
            National Development Plan IV · Uganda Vision 2040 · Road Infrastructure Projects
          </div>
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
        <SummaryCard title="NDP IV Components"  value={String(projects.length)}              sub={`${totalKm.toLocaleString()} km total`}       accent="#bf5af2" />
        <SummaryCard title="Roads Involved"      value={String(projects.reduce((s,p)=>s+p.road_links.length,0))} sub="road links across all components" accent="#3b82f6" />
        <SummaryCard title="Total Budget"        value={totalBudget > 0 ? `$${(totalBudget/1e6).toFixed(0)}M` : 'TBD'} sub="costed per-project as FY26/27 firms up" accent="#30d158" />
      </div>

      {/* ── Region filter pills ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {regions.map(r => (
          <button key={r} onClick={() => setRegionFilter(r)} style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
            background: regionFilter === r ? 'rgba(191, 90, 242,0.15)' : 'transparent',
            border: `1px solid ${regionFilter === r ? 'rgba(191, 90, 242,0.5)' : 'rgba(255,255,255,0.1)'}`,
            color: regionFilter === r ? '#bf5af2' : '#94a3b8',
            transition: 'all 0.15s',
          }}>{r}</button>
        ))}
      </div>

      {/* ── 3-column layout ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 320px', gap: 12, alignItems: 'start' }}>

        {/* ── LEFT: legend ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...GLASS, padding: 14 }}>
            <PanelLabel text="Project Category" />
            {Object.entries(CATEGORY_COLOR).map(([type, c]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <div style={{ width: 10, height: 10, background: c, transform: 'rotate(45deg)', boxShadow: `0 0 5px ${c}70`, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{type}</span>
              </div>
            ))}
          </div>

          {/* Clustered bar: km + road links by category */}
          <div style={{ ...GLASS, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <PanelLabel text="Network km & Roads by Category" />
              <SourceTableButton anchor="tbl-086" />
            </div>
            <Chart3DWrap>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={categoryCluster} margin={{ top: 4, right: 4, left: -18, bottom: 28 }}
                  barCategoryGap="20%" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="type" tick={{ fill: '#64748b', fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} />
                  <ReTooltip contentStyle={TT_STYLE}
                    formatter={(v: number, name: string) => [name === 'Roads' ? `${v} roads` : `${v} km`, name]}
                    labelFormatter={(_: unknown, pl: { payload?: { fullType?: string } }[]) => pl[0]?.payload?.fullType ?? ''}
                  />
                  <Bar dataKey="km"    name="Network km" radius={[3,3,0,0]} shape={<Bar3D/>}>
                    {categoryCluster.map(d => <Cell key={d.type} fill={categoryColor(d.fullType)} fillOpacity={0.5} />)}
                  </Bar>
                  <Bar dataKey="links" name="Roads" radius={[3,3,0,0]} shape={<Bar3D/>}>
                    {categoryCluster.map(d => <Cell key={d.type} fill={categoryColor(d.fullType)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Chart3DWrap>
          </div>
        </div>

        {/* ── CENTRE: Leaflet map ───────────────────────────────────────────── */}
        <div style={{ ...GLASS, height: 680, overflow: 'hidden', position: 'relative' }}>
          <MapContainer center={[1.373, 32.29]} zoom={7} style={{ width: '100%', height: '100%' }} zoomControl>
            <TileLayer url={ESRI_TILE_URLS.imagery} attribution={ESRI_ATTRIBUTIONS.imagery} />
            <TileLayer url={ESRI_TILE_URLS.labels}  attribution={ESRI_ATTRIBUTIONS.labels}  />
            <InfraLayers />
            <MapLegend title="NDPIV Projects" items={LEGEND_PROJECTS} />
            {roadGeo && <GeoJSON key="roads" data={roadGeo} style={roadStyle} />}

            {/* NDP IV 2026 investment corridors */}
            {corridorGeo && (
              <GeoJSON
                key="ndpiv-corridors"
                data={corridorGeo}
                style={feat => {
                  const status = String((feat?.properties as Record<string, unknown>)?.status ?? '');
                  const color = STATUS_CLR[status] ?? '#bf5af2';
                  return { color, weight: 4, opacity: 0.78, dashArray: undefined };
                }}
              />
            )}

            {projects.map(proj => (
              <Marker key={proj.project_id}
                position={proj.centroid}
                icon={diamondIcon(proj.type)}
                eventHandlers={{ click: () => setSelectedProject(p => p?.project_id === proj.project_id ? null : proj) }}
              >
                <Popup>
                  <div style={{ minWidth: 190, fontFamily: 'system-ui,sans-serif' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{proj.name}</div>
                    <div>Status: <b style={{ color: statusColor(proj.status) }}>{proj.status}</b></div>
                    <div>Length: {proj.total_km} km · {proj.region}</div>
                    <div>Roads: {proj.road_links.length} · Funder: {proj.funder}</div>
                    <div>Budget: {proj.budget_usd > 0 ? `$${(proj.budget_usd/1e6).toFixed(0)}M` : 'TBD'}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* ── RIGHT: detail + progress + budget table ───────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* MapDetailPane - default = status distribution, selected = project detail */}
          <NdpivDetailPane
            projects={projects}
            selected={selectedProject}
            onClose={() => setSelectedProject(null)}
          />


          {/* Network km bars - relative scope, not fabricated completion % */}
          <div style={{ ...GLASS, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <PanelLabel text="Network km by Component" />
              <SourceTableButton anchor="tbl-014" />
            </div>
            {projects.map(proj => {
              const maxKm = Math.max(1, ...projects.map(p => p.total_km));
              return (
                <div key={proj.project_id} style={{ marginBottom: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 9, color: '#94a3b8', maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {proj.name}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: statusColor(proj.status), flexShrink: 0, marginLeft: 4 }}>
                      {proj.total_km} km
                    </span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                    <div style={{
                      width: `${(proj.total_km / maxKm) * 100}%`, height: '100%',
                      background: statusColor(proj.status), borderRadius: 2,
                      boxShadow: `0 0 4px ${statusColor(proj.status)}60`,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scope table - roads/km/funder is real; per-project budget isn't
              costed yet in the FY26/27 master-plan rollup */}
          <div style={{ ...GLASS, padding: 14 }}>
            <PanelLabel text="Component Scope" />
            <NdpivScopeTable projects={projects} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Component Scope table (sortable, colour-coded status) ─────────────────
interface ScopeRow { project_id: string; name: string; roadsCount: number; total_km: number; funder: string; status: string; }
function NdpivScopeTable({ projects }: { projects: NdpivProject[] }) {
  const rows: ScopeRow[] = projects.map(p => ({
    project_id: p.project_id, name: p.name, roadsCount: p.road_links.length,
    total_km: p.total_km, funder: p.funder, status: p.status,
  }));
  const columns: STColumn<ScopeRow>[] = [
    { key: 'name', label: 'Component', render: r => (
      <span title={r.name} style={{ display: 'inline-block', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
    ) },
    { key: 'roadsCount', label: 'Roads', numeric: true },
    { key: 'total_km', label: 'Km', numeric: true, render: r => r.total_km.toLocaleString() },
    { key: 'funder', label: 'Funder' },
    { key: 'status', label: 'Status', render: r => {
      const sc = statusColor(r.status);
      return <span style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3, background: `${sc}20`, color: sc, fontWeight: 700, whiteSpace: 'nowrap' }}>{r.status}</span>;
    } },
  ];
  return <SortableFilterableTable columns={columns} rows={rows} accent="#bf5af2" exportName="ndpiv_component_scope" initialSort="total_km" />;
}

// ─── Reusable detail pane for NDPIV ─────────────────────────────────────────
function NdpivDetailPane({
  projects, selected, onClose,
}: {
  projects: NdpivProject[];
  selected: NdpivProject | null;
  onClose: () => void;
}) {
  const accent = '#bf5af2';
  const statusCounts: Record<string, number> = {};
  let totalBudget = 0, totalKm = 0, totalLinks = 0;
  projects.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
    totalBudget += p.budget_usd;
    totalKm     += p.total_km;
    totalLinks  += p.road_links.length;
  });

  const renderDefault = (
    <div>
      <StatCard label="Total Components" value={projects.length} unit="NDPIV" color={accent} />
      <StatCard label="Network Scope" value={`${Math.round(totalKm).toLocaleString()} km`} unit={`${totalLinks} roads`} color="#30d158"
        sub={totalBudget > 0 ? `$${(totalBudget/1e6).toFixed(0)}M budgeted` : 'per-project costing pending'} />

      <SectionHeader title="Status Distribution" accent={accent} />
      <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:10 }}>
        {Object.entries(statusCounts).map(([st, n]) => {
          const c = statusColor(st);
          const pct = (n/projects.length)*100;
          return (
            <div key={st} style={{ display:'flex', alignItems:'center', gap:6, fontSize:9.5 }}>
              <span style={{ width:8, height:8, borderRadius:2, background:c, flexShrink:0 }}/>
              <span style={{ color:'#94a3b8', flex:1 }}>{st}</span>
              <span style={{ color:c, fontWeight:800 }}>{n}</span>
              <div style={{ width:50, height:4, background:'rgba(255,255,255,0.06)', borderRadius:2 }}>
                <div style={{ width:`${pct}%`, height:'100%', background:c, borderRadius:2 }}/>
              </div>
            </div>
          );
        })}
      </div>

      <SectionHeader title="Top 3 by Network km" accent={accent} />
      {[...projects].sort((a,b) => b.total_km - a.total_km).slice(0,3).map(p => (
        <div key={p.project_id} style={{
          padding:'6px 8px', marginBottom:4, fontSize:9.5,
          background:'rgba(15,23,42,0.6)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:6,
        }}>
          <div style={{ color:'#e2eaf4', fontWeight:700 }}>{p.name}</div>
          <div style={{ color:'#64748b', marginTop:2 }}>
            {p.total_km} km · {p.road_links.length} roads · {p.funder}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <MapDetailPane
      defaultContent={renderDefault}
      selectedFeature={selected}
      onClose={onClose}
      defaultTitle="NDP IV Portfolio"
      defaultSubtitle="Click any project marker to see details"
      selectedTitle="Project Detail"
      width={320}
      accent={accent}
      renderFeature={(p: NdpivProject) => {
        const sc = statusColor(p.status);
        return (
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:'#e2eaf4', marginBottom:4 }}>{p.name}</div>
            <div style={{ fontSize:9, color:'rgba(148,163,184,0.7)', marginBottom:10 }}>{p.type} · {p.region}</div>

            <StatCard label="Status" value={p.status} color={sc} />
            <StatCard label="Roads Selected" value={p.road_links.length} unit="road links" color={sc} />

            <SectionHeader title="Attributes" accent={accent} />
            <AttributeRow label="Priority" value={p.priority} color={
              p.priority === 'High' ? '#ef4444' : p.priority === 'Medium' ? '#f59e0b' : '#94a3b8'
            }/>
            <AttributeRow label="Length" value={`${p.total_km} km`} mono />
            <AttributeRow label="Funder" value={p.funder} mono />
            <AttributeRow label="Budget" value={p.budget_usd > 0 ? `$${(p.budget_usd/1e6).toFixed(1)}M` : 'TBD'} color="#30d158" mono />
            <AttributeRow label="Region" value={p.region} />

            <SectionHeader title="Roads in This Component" accent={accent} />
            <div style={{ fontSize:9.5, color:'#94a3b8', lineHeight:1.6 }}>
              {p.road_links.join(' · ')}
            </div>
          </div>
        );
      }}
    />
  );
}
