import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, GeoJSON as GeoJSONLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS, ROAD_STYLES, surfaceCategory } from '../../shared/mapSymbols';
import { InfraLayers } from '../../shared/InfraLayers';
import { MapLegend, LEGEND_PROJECTS } from '../../shared/MapLegend';
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip as ReTooltip,
  CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { Chart3DWrap, Bar3D } from '../../lib/chart3d';
import {
  Construction, AlertTriangle, Clock,
  Search, X, ChevronLeft, ChevronRight, Camera,
} from 'lucide-react';
import { loadEnhancedProjects, type Project } from '../../data/appStore';
import { ModuleNavBar } from '../../shared/ModuleNavBar';
import MapDetailPane, { StatCard, AttributeRow, SectionHeader } from '../../shared/MapDetailPane';
import CrossLinkChipBar from '../../shared/CrossLinkChipBar';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';
import { NULL_ZERO_STYLE } from '../../shared/tableFormatting';

// ── Under-construction corridor definitions ───────────────────────────────────
interface UCorridor {
  id: string; name: string; km: number;
  funder: string; contractor: string; lot: string;
  completion: string; status: string;
  positions: [number, number][];  // [lat, lng] pairs for Leaflet Polyline
}

const UNDER_CONSTRUCTION: UCorridor[] = [
  {
    id: 'neramp-lot1',
    name: 'Kamdini – Lira – Soroti – Koloin',
    km: 216,
    funder: 'World Bank (NERAMP)',
    contractor: 'Mota-Engil Consortium',
    lot: 'OPRC Lot 1',
    completion: 'June 2027',
    status: 'Under Construction',
    positions: [[2.22, 32.27], [2.25, 32.90], [1.95, 33.25], [1.72, 33.61], [1.42, 33.82]],
  },
  {
    id: 'hoima-wanseko',
    name: 'Hoima – Butiaba – Wanseko (Oil Road)',
    km: 111,
    funder: 'GoU / TotalEnergies',
    contractor: 'China Harbour Engineering',
    lot: 'Albertine Oil Road',
    completion: 'December 2026',
    status: 'Under Construction',
    positions: [[1.43, 31.35], [1.62, 31.38], [1.83, 31.40], [2.05, 31.42], [2.19, 31.39]],
  },
  {
    id: 'northern-bypass',
    name: 'Kampala Northern Bypass (Phase 2)',
    km: 17,
    funder: 'African Development Bank',
    contractor: 'China Harbour Engineering',
    lot: 'Urban Bypass',
    completion: 'March 2027',
    status: 'Under Construction',
    positions: [[0.35, 32.68], [0.41, 32.68], [0.44, 32.62], [0.44, 32.52], [0.43, 32.46], [0.36, 32.46]],
  },
  {
    id: 'kla-jinja-exp',
    name: 'Kampala – Jinja Expressway',
    km: 76,
    funder: 'GoU / PPP',
    contractor: 'China Road & Bridge Corp.',
    lot: 'Expressway',
    completion: 'TBD 2028',
    status: 'Under Construction',
    positions: [[0.32, 32.58], [0.36, 32.72], [0.40, 32.90], [0.43, 33.06], [0.45, 33.20]],
  },
];

// Inline equivalent of the .bms-input CSS class, since SearchableSelect
// takes a style prop rather than className (see index.css .bms-input).
const bmsInputStyle: React.CSSProperties = {
  background: 'rgba(6,13,24,0.8)', border: '1px solid rgba(100, 210, 255,0.12)',
  borderRadius: 8, padding: '4px 10px', color: '#e2eaf4',
};

// ── Colour helpers ────────────────────────────────────────────────────────────
const FUNDER_COLORS: Record<string, string> = {
  GOU: '#3b82f6', GoU: '#3b82f6',
  AFDB: '#10b981', AfDB: '#10b981',
  'BADEA': '#f59e0b', 'OFID': '#f59e0b',
  'World Bank': '#8b5cf6',
  ADB: '#06b6d4', JICA: '#ec4899', EU: '#f97316',
  EXIM: '#a855f7', 'CHINA EXIM': '#a855f7',
};
function funderColor(agency: string): string {
  for (const [key, color] of Object.entries(FUNDER_COLORS)) {
    if (agency.toUpperCase().includes(key.toUpperCase())) return color;
  }
  return '#64748b';
}

const STATUS_STYLE = {
  planned:  { border: '#3b82f6', badge: 'text-blue-400 bg-blue-900/30 border-blue-800/50' },
  ongoing:  { border: '#f59e0b', badge: 'text-amber-400 bg-amber-900/30 border-amber-800/50' },
  complete: { border: '#22c55e', badge: 'text-green-400 bg-green-900/30 border-green-800/50' },
} as const;

// ── Works-type categorical colors ─────────────────────────────────────────────
const WORKS_COLOR: Record<string, string> = {
  'Routine Maintenance':  '#6b7280',
  'Periodic Maintenance': '#eab308',
  'Rehabilitation':       '#f97316',
  'Reconstruction':       '#ef4444',
  'New Construction':     '#22c55e',
};
type WorksType = keyof typeof WORKS_COLOR;

function inferWorksType(name: string): WorksType {
  const n = name.toLowerCase();
  if (n.includes('reconstruction') || n.includes('emergency recon'))     return 'Reconstruction';
  if (n.includes('rehabilitation') || n.includes('rehab'))               return 'Rehabilitation';
  if (n.includes('remedial') || n.includes('periodic'))                  return 'Periodic Maintenance';
  if (n.includes('routine') || n.includes('maintenance') && !n.includes('periodic')) return 'Routine Maintenance';
  return 'New Construction'; // upgrading / expressway / bypass / new road
}

const MARKER_COLOR: Record<Project['status'], string> = {
  planned:  '#3b82f6',
  ongoing:  '#f59e0b',
  complete: '#22c55e',
};
const STATUS_LABEL: Record<Project['status'], string> = {
  planned: 'Planned', ongoing: 'Ongoing', complete: 'Complete',
};
function StatusBadge({ status }: { status: Project['status'] | null | undefined }) {
  if (!status) return <span style={NULL_ZERO_STYLE}>No data</span>;
  const color = MARKER_COLOR[status] ?? '#64748b';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999,
      background: `${color}1f`, border: `1px solid ${color}55`, color, fontSize: 10, fontWeight: 800,
    }}>{STATUS_LABEL[status] ?? status}</span>
  );
}

// ── Map controller: flies to target on change ─────────────────────────────────
function MapController({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 10, { duration: 0.8 });
  }, [target, map]);
  return null;
}

// ── Progress bar strip ────────────────────────────────────────────────────────
function ProgressBar({ planned, actual, financial }: {
  planned: number | null; actual: number | null; financial: number | null;
}) {
  return (
    <div className="space-y-1 mt-2">
      {[
        { label: 'Physical',  val: actual,    color: '#3b82f6' },
        { label: 'Financial', val: financial, color: '#10b981' },
        { label: 'Planned',   val: planned,   color: '#475569' },
      ].map(b => (
        <div key={b.label}>
          <div className="flex justify-between text-[8px] text-slate-500 mb-0.5">
            <span>{b.label}</span>
            <span>{b.val !== null ? `${b.val.toFixed(0)}%` : '-'}</span>
          </div>
          <div className="bg-slate-700 rounded-full h-1.5">
            {b.val !== null && (
              <div className="rounded-full h-1.5 transition-all"
                style={{ width: `${Math.min(b.val, 100)}%`, background: b.color }} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Photo strip ───────────────────────────────────────────────────────────────
function PhotoStrip({ photos, onPhotoClick, projectName }: {
  photos: string[];
  onPhotoClick: (src: string) => void;
  projectName: string;
}) {
  if (!photos.length) return null;
  return (
    <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
      {photos.map((src, i) => (
        <button
          key={i}
          onClick={e => { e.stopPropagation(); onPhotoClick(src); }}
          className="flex-shrink-0 relative"
          style={{ width: 72, height: 52 }}
        >
          <img
            src={src}
            alt={`${projectName} - site progress photo ${i + 1} of ${photos.length}`}
            className="w-full h-full object-cover rounded"
            style={{ background: '#1e293b' }}
            onError={e => {
              const t = e.currentTarget;
              t.style.display = 'none';
              const ph = t.nextElementSibling as HTMLElement | null;
              if (ph) ph.style.display = 'flex';
            }}
          />
          {/* Placeholder shown when img fails */}
          <div
            className="absolute inset-0 rounded flex items-center justify-center bg-slate-800 border border-slate-700"
            style={{ display: 'none' }}
          >
            <Camera size={14} className="text-slate-600" />
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Lightbox overlay ──────────────────────────────────────────────────────────
function Lightbox({ src, caption, onClose, onPrev, onNext, hasPrev, hasNext }: {
  src: string; caption: string; onClose: () => void;
  onPrev: () => void; onNext: () => void; hasPrev: boolean; hasNext: boolean;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
      if (e.key === 'ArrowRight' && hasNext) onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/40 rounded-full p-1.5"
      >
        <X size={20} />
      </button>
      {hasPrev && (
        <button
          onClick={e => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 text-white/70 hover:text-white bg-black/40 rounded-full p-2"
        >
          <ChevronLeft size={24} />
        </button>
      )}
      {hasNext && (
        <button
          onClick={e => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 text-white/70 hover:text-white bg-black/40 rounded-full p-2"
        >
          <ChevronRight size={24} />
        </button>
      )}
      <img
        src={src}
        alt={caption}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
        onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
      />
      <div className="absolute bottom-4 text-xs text-white/60 text-center px-4 max-w-xl">
        {caption}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const UGANDA_CENTER: [number, number] = [1.37, 32.3];

export default function ProjectsView() {
  const [projects,   setProjects]   = useState<Project[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selectedId, setSelectedId]           = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [flyTarget,  setFlyTarget]            = useState<[number, number] | null>(null);
  const [search,     setSearch]     = useState('');
  const [regionF,    setRegionF]    = useState('all');
  const [statusF,    setStatusF]    = useState<'all' | 'planned' | 'ongoing' | 'complete'>('all');
  const [lightbox,   setLightbox]   = useState<{ photos: string[]; idx: number; caption: string } | null>(null);

  const cardListRef = useRef<HTMLDivElement>(null);
  const [roadsGeo, setRoadsGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'register' | 'ndpiv' | 'oprc'>('map');

  // Load projects and road network base layer
  useEffect(() => {
    loadEnhancedProjects()
      .then(p => { setProjects(p); setLoading(false); })
      .catch(() => setLoading(false));

    fetch(`${import.meta.env.BASE_URL}road_network.geojson`)
      .then(r => r.json())
      .then(setRoadsGeo)
      .catch(() => {/* road base layer optional */});

    // Inject CSS for marching-ants animation on under-construction corridors
    const s = document.createElement('style');
    s.id = 'uc-road-anim';
    s.textContent = `
      @keyframes pv-march { to { stroke-dashoffset: -24; } }
      .uc-road-line { animation: pv-march 0.9s linear infinite !important; }
    `;
    document.head.appendChild(s);
    return () => { document.getElementById('uc-road-anim')?.remove(); };
  }, []);

  const regions = useMemo(() => {
    const s = new Set<string>();
    projects.forEach(p => p.regions.split(',').forEach(r => s.add(r.trim())));
    return [...s].filter(Boolean).sort();
  }, [projects]);

  const filtered = useMemo(() => projects.filter(p => {
    if (search) {
      const q = search.toLowerCase();
      if (!p.project_name.toLowerCase().includes(q) &&
          !p.location.toLowerCase().includes(q)) return false;
    }
    if (regionF !== 'all' && !p.regions.includes(regionF)) return false;
    if (statusF !== 'all' && p.status !== statusF) return false;
    return true;
  }), [projects, search, regionF, statusF]);

  const stats = useMemo(() => ({
    planned:  projects.filter(p => p.status === 'planned').length,
    ongoing:  projects.filter(p => p.status === 'ongoing').length,
    complete: projects.filter(p => p.status === 'complete').length,
    totalKm:  projects.reduce((s, p) => s + p.parsed_length_km, 0),
  }), [projects]);

  // ── Works Register table - Project rows mapped to a flat, uniquely-keyed
  // shape (SortableFilterableTable uses each column's key as its React key,
  // so every column here needs a distinct one even where two columns derive
  // from the same underlying Project field, e.g. project_name -> both the
  // Name and the inferred Type columns).
  interface RegisterRow extends Record<string, unknown> {
    project_name: string; region: string | null; km: number; status: Project['status'];
    funder: string; type: string; completion: string | null;
  }
  const registerRows: RegisterRow[] = useMemo(() => filtered.map(p => ({
    project_name: p.project_name, region: p.regions, km: p.parsed_length_km,
    status: p.status, funder: p.funding_agency, type: inferWorksType(p.project_name),
    completion: p.target_completion_date,
  })), [filtered]);
  const registerColumns: STColumn<RegisterRow>[] = useMemo(() => [
    { key: 'project_name', label: 'Project Name' },
    { key: 'region', label: 'Region', render: r => r.region || <span style={NULL_ZERO_STYLE}>No data</span> },
    {
      key: 'km', label: 'Length (km)', numeric: true,
      render: r => r.km ? r.km.toLocaleString(undefined, { maximumFractionDigits: 1 }) : <span style={NULL_ZERO_STYLE}>No data</span>,
    },
    { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> },
    { key: 'funder', label: 'Funder', render: r => r.funder || <span style={NULL_ZERO_STYLE}>No data</span> },
    { key: 'type', label: 'Type' },
    { key: 'completion', label: 'Completion', render: r => r.completion || <span style={NULL_ZERO_STYLE}>No data</span> },
  ], []);

  // ── NDPIV table - Link ID/Road No./Class/Surface/OPRC Lot are not yet
  // joined to the master network register for these projects, so they
  // render an explicit "No data" flag rather than a fabricated value.
  interface NdpivRow extends Record<string, unknown> {
    linkId: null; roadNo: null; linkName: string; cls: null; km: number;
    surface: null; region: string | null; component: string; funder: string; oprcLot: null;
  }
  const ndpivProjects = useMemo(
    () => filtered.filter(p => p.project_name.toLowerCase().includes('ndp') || p.funding_agency.toLowerCase().includes('gou')),
    [filtered],
  );
  const ndpivRows: NdpivRow[] = useMemo(() => ndpivProjects.map(p => ({
    linkId: null, roadNo: null, linkName: p.project_name, cls: null, km: p.parsed_length_km,
    surface: null, region: p.regions, component: inferWorksType(p.project_name), funder: p.funding_agency, oprcLot: null,
  })), [ndpivProjects]);
  const ndpivColumns: STColumn<NdpivRow>[] = useMemo(() => [
    { key: 'linkId', label: 'Link ID', render: () => <span style={NULL_ZERO_STYLE}>No data</span> },
    { key: 'roadNo', label: 'Road No.', render: () => <span style={NULL_ZERO_STYLE}>No data</span> },
    { key: 'linkName', label: 'Link Name' },
    { key: 'cls', label: 'Class', render: () => <span style={NULL_ZERO_STYLE}>No data</span> },
    {
      key: 'km', label: 'Length (km)', numeric: true,
      render: r => r.km ? r.km.toLocaleString(undefined, { maximumFractionDigits: 1 }) : <span style={NULL_ZERO_STYLE}>No data</span>,
    },
    { key: 'surface', label: 'Surface', render: () => <span style={NULL_ZERO_STYLE}>No data</span> },
    { key: 'region', label: 'Region', render: r => r.region || <span style={NULL_ZERO_STYLE}>No data</span> },
    { key: 'component', label: 'NDPIV Component' },
    { key: 'funder', label: 'Funder', render: r => r.funder || <span style={NULL_ZERO_STYLE}>No data</span> },
    { key: 'oprcLot', label: 'OPRC Lot', render: () => <span style={NULL_ZERO_STYLE}>No data</span> },
  ], []);

  const scrollToCard = useCallback((id: string) => {
    if (!cardListRef.current) return;
    const el = cardListRef.current.querySelector(`[data-project-id="${id}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  function selectFromCard(p: Project) {
    setSelectedId(p.id);
    setSelectedProject(p);
    setFlyTarget([p.lat, p.lng]);
  }

  function selectFromMap(p: Project) {
    setSelectedId(p.id);
    setSelectedProject(p);
    scrollToCard(p.id);
  }

  function openLightbox(photos: string[], idx: number, caption: string) {
    setLightbox({ photos, idx, caption });
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">

        {/* ─── Definition card ─── */}
        <div style={{ background:'rgba(48, 209, 88,0.04)', border:'1px solid rgba(48, 209, 88,0.14)', borderRadius:12, padding:'14px 18px', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
            <span style={{ fontSize:26 }}>🏗️</span>
            <div>
              <div style={{ fontSize:15, fontWeight:900, color:'#e2e8f0', letterSpacing:'-0.02em' }}>Road Projects & Capital Works</div>
              <div style={{ fontSize:10, color:'rgba(148,163,184,0.55)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>UNRA · MoWT · AfDB / World Bank · PPDA</div>
            </div>
          </div>
          <p style={{ fontSize:11, color:'rgba(148,163,184,0.72)', lineHeight:1.6, margin:0 }}>
            Active and planned road construction and rehabilitation projects across Uganda - tracking UNRA capital works, AfDB-funded corridors, NERAMP rehabilitation lots, northern bypass, and expressway programmes with real-time progress and disbursement monitoring.
          </p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
            {['UNRA Capital Works','AfDB Funded','NERAMP Lots','World Bank IDA','PPDA Compliant','NDPIV Aligned'].map((b: string)=>(
              <span key={b} style={{ fontSize:9, fontWeight:700, color:'#30d158', background:'rgba(48, 209, 88,0.07)', border:'1px solid rgba(48, 209, 88,0.18)', borderRadius:20, padding:'2px 8px', textTransform:'uppercase', letterSpacing:'0.07em' }}>{b}</span>
            ))}
          </div>
        </div>
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-amber-500 animate-spin mx-auto" />
          <div className="text-sm text-slate-400">Loading projects…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      <CrossLinkChipBar sectionId="projects" />

      {/* ── BMS-style tab bar - FIRST (matches BMS pattern) ── */}
      <div style={{
        display: 'flex', gap: 2, padding: '0 14px', flexShrink: 0,
        borderBottom: '1px solid rgba(10, 132, 255,0.15)',
        background: 'rgba(4,9,18,0.85)',
      }}>
        {([
          { id: 'map',      label: 'Projects Map',   icon: '🗺️' },
          { id: 'register', label: 'Works Register', icon: '📋' },
          { id: 'ndpiv',    label: 'NDPIV Projects', icon: '🏗️' },
          { id: 'oprc',     label: 'OPRC Lots',      icon: '🔧' },
        ] as const).map(t => {
          const isActive = t.id === activeTab;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px 11px', fontSize: 11, fontWeight: isActive ? 800 : 500,
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              color: isActive ? '#0a84ff' : 'rgba(148,163,184,0.70)',
              borderBottom: isActive ? '2px solid #0a84ff' : '2px solid transparent',
              transition: 'all 0.13s',
            }}>
              <span style={{ fontSize: 12 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Map + MapDetailPane (Map tab) - flex row, map fills space ── */}
      {activeTab === 'map' && <div className="flex flex-1 min-h-0 overflow-hidden border-t border-slate-800">

        {/* Map fills remaining space */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {/* Floating filter bar - keeps the whole pane for the map */}
          <div style={{
            position: 'absolute', top: 10, left: 54, zIndex: 1000,
            display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
            background: 'rgba(8,14,28,0.88)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(100, 210, 255,0.2)', borderRadius: 9, padding: '6px 10px',
          }}>
            <div className="relative" style={{ minWidth: 170 }}>
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search projects…" className="bms-input pl-6 w-full text-xs" style={{ height: 26 }} />
            </div>
            <SearchableSelect value={regionF} onChange={setRegionF} style={{ ...bmsInputStyle, height: 26, fontSize: 12 }}>
              <option value="all">All Regions</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </SearchableSelect>
            <SearchableSelect value={statusF} onChange={v => setStatusF(v as typeof statusF)} style={{ ...bmsInputStyle, height: 26, fontSize: 12 }}>
              <option value="all">All Status</option>
              <option value="planned">Planned</option>
              <option value="ongoing">Ongoing</option>
              <option value="complete">Complete</option>
            </SearchableSelect>
            <span className="text-[10px] text-slate-400 font-bold">{filtered.length}/{projects.length}</span>
          </div>
          <MapContainer
            center={UGANDA_CENTER}
            zoom={7}
            style={{ width: '100%', height: '100%' }}
            zoomControl
          >
            <TileLayer url={ESRI_TILE_URLS.imagery} attribution={ESRI_ATTRIBUTIONS.imagery}/>
            <TileLayer url={ESRI_TILE_URLS.labels}  attribution={ESRI_ATTRIBUTIONS.labels} opacity={0.7}/>
            <InfraLayers />
            <MapLegend title="Projects" items={LEGEND_PROJECTS} />
            <MapController target={flyTarget} />

            {/* ── Road network base layer ── */}
            {roadsGeo && (
              <GeoJSONLayer
                key="roads-base"
                data={roadsGeo as GeoJSON.GeoJsonObject}
                style={(feature) => {
                  const surface: string = (feature?.properties as { surface?: string })?.surface ?? '';
                  const cat = surfaceCategory(surface);
                  const sym = ROAD_STYLES[cat === 'unknown' ? 'unknown' : cat];
                  return {
                    color: sym.color,
                    weight: sym.weight,
                    opacity: sym.opacity,
                    dashArray: sym.dashArray,
                  };
                }}
              />
            )}

            {/* ── Under-construction corridors (animated yellow dashes) ── */}
            {UNDER_CONSTRUCTION.map(c => (
              <Polyline
                key={c.id}
                positions={c.positions}
                pathOptions={{
                  color: '#FCD34D',
                  weight: 5,
                  opacity: 0.92,
                  dashArray: '12 6',
                  className: 'uc-road-line',
                }}
              >
                <Popup>
                  <div style={{ fontSize: 11, minWidth: 210, maxWidth: 250 }}>
                    <div style={{ fontWeight: 800, fontSize: 12, color: '#1e293b', borderBottom: '1.5px solid #fcd34d', paddingBottom: 4, marginBottom: 6 }}>
                      🚧 {c.name}
                    </div>
                    <table style={{ fontSize: 10, borderCollapse: 'collapse', width: '100%' }}>
                      {[
                        ['Lot / Category', c.lot],
                        ['Length', `${c.km} km`],
                        ['Funder', c.funder],
                        ['Contractor', c.contractor],
                        ['Status', c.status],
                        ['Est. Completion', c.completion],
                      ].map(([k, v]) => (
                        <tr key={k}>
                          <td style={{ color: '#64748b', paddingRight: 8, paddingBottom: 3, fontWeight: 600, verticalAlign: 'top' }}>{k}</td>
                          <td style={{ color: '#111827', fontWeight: 700 }}>{v}</td>
                        </tr>
                      ))}
                    </table>
                  </div>
                </Popup>
              </Polyline>
            ))}

            {filtered.map(p => {
              const isSelected  = selectedId === p.id;
              const worksColor  = WORKS_COLOR[inferWorksType(p.project_name)] ?? '#64748b';
              const statusColor = MARKER_COLOR[p.status];
              return (
                <CircleMarker
                  key={p.id}
                  center={[p.lat, p.lng]}
                  radius={isSelected ? 10 : 7}
                  pathOptions={{
                    color:       isSelected ? '#fff' : statusColor,
                    fillColor:   worksColor,
                    fillOpacity: isSelected ? 0.95 : 0.75,
                    weight:      isSelected ? 3 : 2,
                  }}
                  eventHandlers={{ click: () => selectFromMap(p) }}
                >
                  <Popup>
                    <div style={{ fontSize: 11, maxWidth: 200 }}>
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>{p.project_name}</div>
                      <div style={{ color: '#94a3b8', fontSize: 10 }}>{p.location}</div>
                      <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
                        <span style={{ color: '#f59e0b' }}>{p.parsed_length_km.toFixed(0)} km</span>
                        <span style={{ color: statusColor, textTransform: 'capitalize' }}>{p.status}</span>
                      </div>
                      {p.actual_progress_pct !== null && (
                        <div style={{ marginTop: 4 }}>
                          <div style={{ fontSize: 9, color: '#64748b' }}>Physical progress</div>
                          <div style={{ background: '#1e293b', borderRadius: 4, height: 5, marginTop: 2 }}>
                            <div style={{ background: '#3b82f6', width: `${Math.min(p.actual_progress_pct, 100)}%`, height: '100%', borderRadius: 4 }} />
                          </div>
                          <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>{p.actual_progress_pct.toFixed(0)}%</div>
                        </div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* Map legend */}
          <div style={{
            position: 'absolute', bottom: 20, left: 8, zIndex: 1000,
            background: 'rgba(2,5,8,0.85)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '6px 10px',
          }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Works Type</div>
            {Object.entries(WORKS_COLOR).map(([type, c]) => (
              <div key={type} className="flex items-center gap-1.5 mb-1">
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                <span style={{ fontSize: 9, color: '#94a3b8' }}>{type}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 5, paddingTop: 5 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Status (ring)</div>
              {(['planned', 'ongoing', 'complete'] as const).map(s => (
                <div key={s} className="flex items-center gap-1.5 mb-1 last:mb-0">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', border: `2px solid ${MARKER_COLOR[s]}`, background: 'transparent' }} />
                  <span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'capitalize' }}>{s}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 5, paddingTop: 5 }}>
              <div className="flex items-center gap-1.5 mb-1">
                <svg width="18" height="5" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="2.5" x2="18" y2="2.5" stroke={ROAD_STYLES.paved.color} strokeWidth="2.5"/>
                </svg>
                <span style={{ fontSize: 9, color: '#94a3b8' }}>Paved road</span>
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                <svg width="18" height="5" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="2.5" x2="18" y2="2.5" stroke={ROAD_STYLES.unpaved.color} strokeWidth="1.5" strokeDasharray="3 2"/>
                </svg>
                <span style={{ fontSize: 9, color: '#94a3b8' }}>Unpaved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="18" height="5" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="2.5" x2="18" y2="2.5" stroke="#FCD34D" strokeWidth="3" strokeDasharray="5 2"/>
                </svg>
                <span style={{ fontSize: 9, color: '#fcd34d' }}>Under construction</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: MapDetailPane - default=stats, selected=project detail */}
        <MapDetailPane
          width={340}
          accent="#f59e0b"
          defaultTitle="Projects Overview"
          defaultSubtitle="Click a project marker on the map to inspect"
          defaultContent={
            <div>
              <StatCard label="Total Projects" value={projects.length} color="#f59e0b" />
              <StatCard label="Total km"        value={`${stats.totalKm.toFixed(0)} km`} color="#64d2ff" />
              <StatCard label="Ongoing"         value={stats.ongoing}  color="#3b82f6" sub="active construction" />
              <StatCard label="Planned"         value={stats.planned}  color="#a855f7" sub="in pipeline" />
              <StatCard label="Completed"       value={stats.complete} color="#22c55e" sub="works complete" />
              <div style={{ marginTop:10, fontSize:9.5, color:'#64748b' }}>
                Filtered: <strong style={{ color:'#e2eaf4' }}>{filtered.length}</strong> of {projects.length} projects match current filters.
              </div>
              <div style={{ marginTop:8, fontSize:9, color:'#475569', lineHeight:1.5 }}>
                Browse projects on the map or use the Works Register tab for the full table view.
              </div>
            </div>
          }
          selectedFeature={selectedProject}
          renderFeature={(p: Project) => {
            const wc = WORKS_COLOR[inferWorksType(p.project_name)] ?? '#64748b';
            return (
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#fff', lineHeight:1.3, marginBottom:8 }}>
                  {p.project_name}
                </div>
                <SectionHeader title="Location & Scope" accent={wc} />
                <AttributeRow label="Location"    value={p.location} />
                <AttributeRow label="Length"      value={`${p.parsed_length_km.toFixed(1)} km`} color="#f59e0b" />
                <AttributeRow label="Status"      value={p.status}   color={MARKER_COLOR[p.status]} />
                <AttributeRow label="Works Type"  value={inferWorksType(p.project_name)} color={wc} />
                <AttributeRow label="Funder"      value={p.funding_agency} color={funderColor(p.funding_agency)} />
                {p.target_completion_date && (
                  <AttributeRow label="Target Completion" value={p.target_completion_date} />
                )}
                {p.behind_schedule && (
                  <div style={{ marginTop:6, padding:'5px 10px', borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', fontSize:9.5, color:'#ef4444', fontWeight:700 }}>
                    ⚠ Behind schedule
                  </div>
                )}
                <SectionHeader title="Progress" accent={wc} />
                <ProgressBar
                  planned={p.planned_progress_pct}
                  actual={p.actual_progress_pct}
                  financial={p.financial_progress_pct}
                />
                {p.progressPhotos.length > 0 && (
                  <>
                    <SectionHeader title="Site Photos" accent={wc} />
                    <PhotoStrip
                      photos={p.progressPhotos}
                      projectName={p.project_name}
                      onPhotoClick={src => {
                        const idx = p.progressPhotos.indexOf(src);
                        openLightbox(p.progressPhotos, idx >= 0 ? idx : 0, p.project_name);
                      }}
                    />
                  </>
                )}
              </div>
            );
          }}
          onClose={() => { setSelectedId(null); setSelectedProject(null); }}
        />
      </div>}

      {/* ── Works Register tab ── */}
      {activeTab === 'register' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', minHeight: 0 }}>
          {/* Programme overview - moved here from the map tab so the map fills its pane */}
          <div className="space-y-3" style={{ marginBottom: 14 }}>
        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total km',  value: `${stats.totalKm.toFixed(0)}`, unit: 'km',    color: '#f59e0b' },
            { label: 'Planned',   value: `${stats.planned}`,            unit: 'proj',  color: '#3b82f6' },
            { label: 'Ongoing',   value: `${stats.ongoing}`,            unit: 'proj',  color: '#f59e0b' },
            { label: 'Complete',  value: `${stats.complete}`,           unit: 'proj',  color: '#22c55e' },
          ].map(k => (
            <div key={k.label} className="bms-card py-2 px-3 text-center">
              <div className="text-lg font-black" style={{ color: k.color }}>{k.value}</div>
              <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">{k.label}</div>
            </div>
          ))}
        </div>

        {/* ── OPRC + NDP IV info cards ── */}
        <div className="grid grid-cols-2 gap-2">

          {/* OPRC Card */}
          <div style={{
            background: 'rgba(253,211,77,0.05)',
            border: '1px solid rgba(253,211,77,0.25)',
            borderLeft: '3px solid #fcd34d',
            borderRadius: 8, padding: '8px 12px',
          }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
              🚧 NERAMP OPRC - Output-Performance Road Contracts
            </div>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.8)', lineHeight: 1.5 }}>
              <span style={{ color: '#fcd34d', fontWeight: 700 }}>Lot 1 (216 km)</span>
              {' '}Kamdini–Lira–Soroti–Koloin · Mota-Engil · World Bank · Completion Jun 2027
            </div>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.8)', lineHeight: 1.5, marginTop: 2 }}>
              <span style={{ color: '#fcd34d', fontWeight: 700 }}>Lot 2 (307 km)</span>
              {' '}Soroti–Moroto–Kotido · In procurement · World Bank NERAMP
            </div>
            <div style={{ fontSize: 8, color: 'rgba(100,116,139,0.5)', marginTop: 4 }}>
              NERAMP = North East Road Asset Management Programme · 10-yr performance contracts
            </div>
          </div>

          {/* NDP IV Card */}
          <div style={{
            background: 'rgba(10, 132, 255,0.05)',
            border: '1px solid rgba(10, 132, 255,0.25)',
            borderLeft: '3px solid #0a84ff',
            borderRadius: 8, padding: '8px 12px',
          }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: '#0a84ff', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
              📋 NDP IV Targets · FY 2025/26 – 2029/30
            </div>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.8)', lineHeight: 1.5 }}>
              <span style={{ color: '#30d158', fontWeight: 700 }}>1,200+ km</span>
              {' '}new paved roads (upgrading gravel-to-bituminous)
            </div>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.8)', lineHeight: 1.5, marginTop: 2 }}>
              <span style={{ color: '#64d2ff', fontWeight: 700 }}>Key priorities:</span>
              {' '}Albertine oil roads · GKMA improvements · Northern Bypass Ph 2 · border connectivity
            </div>
            <div style={{ fontSize: 8, color: 'rgba(100,116,139,0.5)', marginTop: 4 }}>
              Target: 35% paved network by 2030 · Current baseline: ~30.3% (6,405 km)
            </div>
          </div>

        </div>

        {/* Works-type clustered bar chart */}
        {(() => {
          const wt: Record<string, { count: number; km: number }> = {};
          projects.forEach(p => {
            const t = inferWorksType(p.project_name);
            if (!wt[t]) wt[t] = { count: 0, km: 0 };
            wt[t].count++;
            wt[t].km += Math.round(p.parsed_length_km);
          });
          const data = Object.entries(wt)
            .map(([type, v]) => ({ type: type.replace(' ', '\n').split(' ')[0], fullType: type, ...v }))
            .sort((a, b) => b.km - a.km);
          return (
            <div style={{
              background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '10px 12px',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                Projects by Works Type - Count &amp; Length (km)
              </div>
              <Chart3DWrap>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={data} margin={{ top: 2, right: 6, left: -24, bottom: 0 }}
                    barCategoryGap="20%" barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="fullType" tick={{ fill: '#64748b', fontSize: 8 }}
                      tickFormatter={(s: string) => s.split(' ')[0]} />
                    <YAxis yAxisId="cnt" tick={{ fill: '#64748b', fontSize: 8 }}
                      label={{ value: 'Projects', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 8 }} />
                    <YAxis yAxisId="km" orientation="right" tick={{ fill: '#64748b', fontSize: 8 }}
                      label={{ value: 'km', angle: 90, position: 'insideRight', fill: '#64748b', fontSize: 8 }} />
                    <ReTooltip
                      contentStyle={{ background: 'rgba(8,14,28,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 10 }}
                      formatter={(v: number, name: string) => [name === 'count' ? `${v} projects` : `${v} km`, name === 'count' ? 'Projects' : 'Total km']}
                      labelFormatter={(l: string) => l}
                    />
                    <Bar yAxisId="cnt" dataKey="count" name="count" radius={[3,3,0,0]} maxBarSize={28} shape={<Bar3D/>}>
                      {data.map(d => <Cell key={d.fullType} fill={WORKS_COLOR[d.fullType] ?? '#64748b'} />)}
                    </Bar>
                    <Bar yAxisId="km" dataKey="km" name="km" radius={[3,3,0,0]} maxBarSize={28} shape={<Bar3D/>}>
                      {data.map(d => <Cell key={d.fullType} fill={WORKS_COLOR[d.fullType] ?? '#64748b'} fillOpacity={0.4} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Chart3DWrap>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 4 }}>
                {Object.entries(WORKS_COLOR).map(([type, c]) => (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: c, flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: '#64748b' }}>{type}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

          </div>

          <div style={{ fontSize: 14, fontWeight: 900, color: '#e2eaf4', marginBottom: 4 }}>Works Register - All Projects</div>
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)', marginBottom: 12 }}>
            {projects.length} projects · {stats.totalKm.toFixed(0)} km total · source: appStore / NDPIV Excel
          </div>
          <SortableFilterableTable
            accent="#f59e0b"
            exportName="works-register"
            columns={registerColumns}
            rows={registerRows}
          />
        </div>
      )}

      {/* ── NDPIV tab ── */}
      {activeTab === 'ndpiv' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', minHeight: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#e2eaf4', marginBottom: 4 }}>NDP IV Road Projects</div>
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)', marginBottom: 12 }}>
            National Development Plan IV · FY 2025/26 – 2029/30 · links matched from master network register
          </div>
          <SortableFilterableTable
            accent="#0a84ff"
            exportName="ndpiv-projects"
            columns={ndpivColumns}
            rows={ndpivRows}
          />
        </div>
      )}

      {/* ── OPRC tab ── */}
      {activeTab === 'oprc' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', minHeight: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#e2eaf4', marginBottom: 4 }}>OPRC - Output & Performance Road Contracts</div>
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)', marginBottom: 12 }}>
            Long-term performance-based road maintenance contracts · NERAMP & other OPRC programs
          </div>
          {UNDER_CONSTRUCTION.map(uc => (
            <div key={uc.id} style={{ background: 'rgba(8,14,28,0.55)', border: '1px solid rgba(245,158,11,0.2)', borderLeft: '4px solid #f59e0b', borderRadius: 10, padding: '12px 16px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: '#f59e0b' }}>{uc.lot}</span>
                <span style={{ fontSize: 10, background: 'rgba(48, 209, 88,0.1)', border: '1px solid rgba(48, 209, 88,0.2)', borderRadius: 4, padding: '1px 6px', color: '#30d158', fontWeight: 700 }}>{uc.status}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2eaf4', marginBottom: 4 }}>{uc.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { label: 'Length', value: `${uc.km} km` },
                  { label: 'Funder', value: uc.funder },
                  { label: 'Contractor', value: uc.contractor },
                  { label: 'Completion', value: uc.completion },
                ].map(k => (
                  <div key={k.label}>
                    <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1 }}>{k.label}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{k.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 12, fontSize: 9, color: 'rgba(148,163,184,0.3)' }}>
            OPRC = Output & Performance Road Contract · long-term maintenance performance agreements · NERAMP = North East Road Asset Management Programme
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <Lightbox
          src={lightbox.photos[lightbox.idx]}
          caption={lightbox.caption}
          onClose={() => setLightbox(null)}
          hasPrev={lightbox.idx > 0}
          hasNext={lightbox.idx < lightbox.photos.length - 1}
          onPrev={() => setLightbox(lb => lb ? { ...lb, idx: lb.idx - 1 } : lb)}
          onNext={() => setLightbox(lb => lb ? { ...lb, idx: lb.idx + 1 } : lb)}
        />
      )}
    </div>
  );
}
