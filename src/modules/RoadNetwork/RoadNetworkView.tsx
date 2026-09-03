/**
 * RoadNetworkView - Uganda National Road Network
 * Features:
 *  - Animated timeline 1960–2026 showing road paving progression
 *  - Paved (cyan) vs Unsealed (amber) clear symbology
 *  - Play/pause with adjustable speed
 *  - Road Network Dashboard with accurate statistics
 *  - Filter by surface, class, region
 */
import { useEffect, useState, useMemo, useRef, useCallback, useContext } from 'react';
import { CURRENT_YEAR } from '../../shared/year';
import {
  MapContainer, TileLayer, GeoJSON, Marker, Tooltip as LeafletTooltip, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Play, Pause, SkipBack, SkipForward, Layers, BarChart3,
  Map as MapIcon, X, ChevronRight, ChevronLeft, Info,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { useBMS } from '../../store/BMSContext';
import type { Structure } from '../../index';
import { ROAD_STYLES, surfaceCategory } from '../../shared/mapSymbols';
import FeatureAnalyticsPanel from '../../shared/FeatureAnalyticsPanel';
import type { FeatureData } from '../../shared/FeatureAnalyticsPanel';
import { InfraLayers } from '../../shared/InfraLayers';
import MapGISControls, { UGANDA_BOUNDS } from '../../shared/MapGISControls';
import { MapLegend, LEGEND_FULL } from "../../shared/MapLegend";
import SourceTableButton from '../../shared/SourceTableButton';
import CrossLinkChipBar from '../../shared/CrossLinkChipBar';
import { BotHighlightContext } from '../AssetBot/types';
import { useNetworkStats } from '../../shared/useNetworkStats';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';

// ── Types ──────────────────────────────────────────────────────────────────────
interface LinkProps {
  link_id:   string;
  link_name: string;
  road:      string;
  road_class:string;
  surface:   string;
  region:    string;
  station:   string;
  length_km: number;
  start_km:  number;
}
interface PaveYearEntry {
  road_no:    string;
  road_class: string;
  length_km:  number;
  road_name:  string;
  age_years:  number | null;
  pave_year:  number | null;
}
interface CumulativeEntry { year: number; cum_paved_km: number }
interface RegionEntry { region: string; paved_km: number; unpaved_km: number; links: number }
interface NdpivSummary {
  total_links: number; total_km: number; paved_km: number; unsealed_km: number; paved_pct: number;
}
interface NdpivData {
  summary:   NdpivSummary;
  by_class:  Record<string, { paved: number; unsealed: number }>;
  by_region: Record<string, { paved: number; unsealed: number; links: number }>;
}

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  paved:   '#00f5ff',   // neon cyan  (charts/stats only)
  unsealed:'#ff8c00',  // amber-orange (charts/stats only)
  bgVoid:  '#020508',
  glass:   'rgba(6,13,24,0.88)',
};

// ── Road line symbology - sourced from shared/mapSymbols.ts ──────────────────
// ROAD_STYLES and surfaceCategory are imported above; use them directly.
// Local alias for brevity within this module.
const ROAD_SYM    = ROAD_STYLES;                         // { paved, unpaved, unknown, shimmer }
const PAVED_SHIMMER = ROAD_STYLES.shimmer;               // { color, weight, opacity }

const REGION_COLORS: Record<string,string> = {
  'Central':      '#00f5ff',
  'Eastern':      '#ffd23f',
  'Northern':     '#00ff88',
  'Western':      '#b967ff',
  'Southern':     '#ff2d78',
  'North Eastern':'#ff6b35',
};
const CLASS_COLORS: Record<string,string> = { A:'#ff3366', B:'#ff6b35', C:'#ffd23f', M:'#b967ff' };
const CLASS_WEIGHT: Record<string,number> = { A:4, B:3, C:2, M:2.5 };

// ── Structure icon helpers (bridges & culverts) ───────────────────────────────
const structIconCache = new Map<string, L.DivIcon>();

function makeRNBridgeIcon(critical: boolean, _sz: number): L.DivIcon {
  const key = `rnbridge|${critical}`;
  if (structIconCache.has(key)) return structIconCache.get(key)!;
  const html = `<svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block">
    <circle cx="6" cy="6" r="5" fill="#3B82F6" stroke="white" stroke-width="1.5"/>
    ${critical ? `<circle cx="6" cy="6" r="5" fill="none" stroke="#ff2d78" stroke-width="1.5" stroke-dasharray="3 2" opacity="0.9"/>` : ''}
  </svg>`;
  const icon = L.divIcon({ className: '', html, iconSize: [12, 12], iconAnchor: [6, 6] });
  structIconCache.set(key, icon);
  return icon;
}

function makeRNCulvertIcon(critical: boolean, _sz: number): L.DivIcon {
  const key = `rnculvert|${critical}`;
  if (structIconCache.has(key)) return structIconCache.get(key)!;
  const html = `<svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block">
    <rect x="1" y="1" width="10" height="10" rx="2" fill="#F59E0B" stroke="white" stroke-width="1.5"/>
    ${critical ? `<rect x="0.75" y="0.75" width="10.5" height="10.5" rx="2.5" fill="none" stroke="#ff2d78" stroke-width="1.5" stroke-dasharray="3 2" opacity="0.9"/>` : ''}
  </svg>`;
  const icon = L.divIcon({ className: '', html, iconSize: [12, 12], iconAnchor: [6, 6] });
  structIconCache.set(key, icon);
  return icon;
}

// ── Zoom tracker (inside MapContainer) ───────────────────────────────────────
function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const h = () => onZoom(map.getZoom());
    map.on('zoomend', h);
    return () => { map.off('zoomend', h); };
  }, [map, onZoom]);
  return null;
}

// ── Timeline config ────────────────────────────────────────────────────────────
const ANIM_MIN = 1960;
const ANIM_MAX = 2026;
const ANIM_STEP = 1;

// ── Main component ─────────────────────────────────────────────────────────────
export default function RoadNetworkView({ defaultHistory }: { defaultHistory?: boolean } = {}) {
  // Data
  const [geoData,    setGeoData]    = useState<GeoJSON.FeatureCollection | null>(null);
  const [paveYears,  setPaveYears]  = useState<Record<string, number | null>>({});
  const [storyData,  setStoryData]  = useState<{ cumulative_paved: CumulativeEntry[]; by_region: RegionEntry[] } | null>(null);
  const [ndpiv,      setNdpiv]      = useState<NdpivData | null>(null);
  const [networkSummary, setNetworkSummary] = useState<{ official_total_km?: number } | null>(null);
  const [loading,    setLoading]    = useState(true);
  const netStatsLoad = useNetworkStats();

  // UI state
  const [panel,      setPanel]      = useState<'map'|'dashboard'>('map');
  const [sideOpen,   setSideOpen]   = useState(true);

  // Animation
  const [animYear,   setAnimYear]   = useState(CURRENT_YEAR);
  const [playing,    setPlaying]    = useState(false);
  const [speed,      setSpeed]      = useState(600); // ms per year
  // defaultHistory lets a caller (e.g. LifecycleView, where asset history
  // over time is the whole point) open this map already in History mode
  // instead of the usual Current-state default.
  const [animMode,   setAnimMode]   = useState(!!defaultHistory); // false = current state

  // Filter (current mode)
  const [colorBy,    setColorBy]    = useState<'surface'|'class'|'region'>('surface');
  const [surfFilter, setSurfFilter] = useState<'all'|'Bituminous'|'Unsealed'>('all');
  const [clsFilter,  setClsFilter]  = useState<string>('all');
  const [regFilter,  setRegFilter]  = useState<string>('all');

  // Selected link / structure
  const [selected,          setSelected]          = useState<LinkProps | null>(null);
  const [selectedRaw,       setSelectedRaw]       = useState<Record<string, unknown> | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<Structure | null>(null);

  const [mapZoom, setMapZoom] = useState(7);

  const { state: bmsState } = useBMS();
  const structures: Structure[] = bmsState.structures;
  const { highlightedLinks } = useContext(BotHighlightContext);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const geoRef   = useRef<L.GeoJSON | null>(null);

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}road_network.geojson`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}road_pave_years.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}network_story_data.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}road_links_ndpiv.json`).then(r => r.json()).catch(() => null),
      fetch(`${import.meta.env.BASE_URL}data/network_summary.json`).then(r => r.json()).catch(() => null),
    ]).then(([geo, pave, story, ndpivData, networkSummaryData]) => {
      setGeoData(geo);
      const map: Record<string, number | null> = {};
      (pave as PaveYearEntry[]).forEach(e => { map[e.road_no] = e.pave_year; });
      setPaveYears(map);
      setStoryData(story);
      if (ndpivData) setNdpiv(ndpivData);
      if (networkSummaryData) setNetworkSummary(networkSummaryData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // ── Playback ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (playing && animMode) {
      timerRef.current = setInterval(() => {
        setAnimYear(y => {
          if (y >= ANIM_MAX) { setPlaying(false); return ANIM_MAX; }
          return y + ANIM_STEP;
        });
      }, speed);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, speed, animMode]);

  // ── Network stats at current anim year ────────────────────────────────────────
  const yearStats = useMemo(() => {
    if (!geoData || !storyData) return null;
    const cp = storyData.cumulative_paved;
    // Interpolate cumulative paved for animYear
    const entry = [...cp].reverse().find(e => e.year <= animYear);
    const pavKm  = entry?.cum_paved_km ?? 0;

    // Total from geojson
    let totalKm = 0;
    geoData.features.forEach(f => { totalKm += Number((f.properties as LinkProps).length_km) || 0; });
    const unsKm = totalKm - pavKm;

    return { pavKm: Math.min(pavKm, totalKm), unsKm: Math.max(unsKm, 0), totalKm, pavPct: (pavKm / totalKm * 100) };
  }, [animYear, geoData, storyData]);

  // ── Current-mode stats ────────────────────────────────────────────────────────
  const currentStats = useMemo(() => {
    if (!geoData) return null;
    let totalKm = 0, pavKm = 0, unsKm = 0;
    const byClass: Record<string,number>  = {};
    const byRegion: Record<string,number> = {};
    geoData.features.forEach(f => {
      const p = f.properties as LinkProps;
      const km = Number(p.length_km) || 0;
      totalKm += km;
      if (p.surface === 'Bituminous') pavKm += km; else unsKm += km;
      byClass[p.road_class]  = (byClass[p.road_class]  || 0) + km;
      byRegion[p.region] = (byRegion[p.region] || 0) + km;
    });
    return { totalKm, pavKm, unsKm, byClass, byRegion };
  }, [geoData]);

  // ── Style each feature ─────────────────────────────────────────────────────────
  const styleFeature = useCallback((feature?: GeoJSON.Feature): L.PathOptions => {
    if (!feature) return {};
    const p = feature.properties as LinkProps;

    if (highlightedLinks.length && highlightedLinks.includes(p.link_id)) {
      return { color: '#fbbf24', weight: 7, opacity: 1 };
    }

    if (animMode) {
      // Historical animation: paved if pave_year <= animYear
      const paveYr  = paveYears[p.road] ?? null;
      const isPaved = paveYr !== null ? paveYr <= animYear : surfaceCategory(p.surface) === 'paved';
      const sym = ROAD_SYM[isPaved ? 'paved' : 'unpaved'];
      return { color: sym.color, weight: sym.weight, opacity: sym.opacity, dashArray: sym.dashArray };
    }

    // Current mode with filters
    if (surfFilter !== 'all' && p.surface !== surfFilter)    return { opacity: 0, fillOpacity: 0 };
    if (clsFilter  !== 'all' && p.road_class !== clsFilter)  return { opacity: 0, fillOpacity: 0 };
    if (regFilter  !== 'all' && p.region !== regFilter)      return { opacity: 0, fillOpacity: 0 };

    if (colorBy === 'surface') {
      const sym = ROAD_SYM[surfaceCategory(p.surface)];
      return { color: sym.color, weight: sym.weight, opacity: sym.opacity, dashArray: sym.dashArray };
    }

    const color = colorBy === 'class'
      ? (CLASS_COLORS[p.road_class] ?? '#64748b')
      : (REGION_COLORS[p.region]   ?? '#64748b');
    return { color, weight: CLASS_WEIGHT[p.road_class] ?? 2, opacity: 0.88 };
  }, [animMode, animYear, paveYears, colorBy, surfFilter, clsFilter, regFilter, highlightedLinks]);

  // ── Shimmer layer - only renders on paved roads in surface/history modes ──────
  const styleFeatureShimmer = useCallback((feature?: GeoJSON.Feature): L.PathOptions => {
    if (!feature) return {};
    const p = feature.properties as LinkProps;
    const hidden: L.PathOptions = { opacity: 0, fillOpacity: 0 };

    if (animMode) {
      const paveYr  = paveYears[p.road] ?? null;
      const isPaved = paveYr !== null ? paveYr <= animYear : surfaceCategory(p.surface) === 'paved';
      return isPaved
        ? { color: PAVED_SHIMMER.color, weight: PAVED_SHIMMER.weight, opacity: PAVED_SHIMMER.opacity }
        : hidden;
    }

    if (colorBy !== 'surface') return hidden;
    if (surfFilter !== 'all' && p.surface !== surfFilter)   return hidden;
    if (clsFilter  !== 'all' && p.road_class !== clsFilter) return hidden;
    if (regFilter  !== 'all' && p.region !== regFilter)     return hidden;
    return surfaceCategory(p.surface) === 'paved'
      ? { color: PAVED_SHIMMER.color, weight: PAVED_SHIMMER.weight, opacity: PAVED_SHIMMER.opacity }
      : hidden;
  }, [animMode, animYear, paveYears, colorBy, surfFilter, clsFilter, regFilter]);

  const onEachFeature = useCallback((feature: GeoJSON.Feature, layer: L.Layer) => {
    const p = feature.properties as LinkProps;
    layer.on({
      click: () => { setSelected(p); setSelectedStructure(null); setSelectedRaw(feature.properties as Record<string, unknown>); },
      mouseover: (e: { target: L.Polyline }) => e.target.setStyle({ weight: 6, opacity: 1 }),
      mouseout:  (e: { target: L.Polyline }) => e.target.setStyle(styleFeature(feature)),
    });
    layer.bindTooltip(`
      <div style="font:600 11px/1.7 'Inter',system-ui,sans-serif;color:#111827;min-width:150px">
        <div style="font-weight:800;font-family:monospace;font-size:12px;color:#111827;border-bottom:1.5px solid #e5e7eb;padding-bottom:3px;margin-bottom:3px">${p.link_id}</div>
        ${p.link_name ? `<div style="font-size:9px;color:#6b7280;font-weight:500;margin-bottom:4px">${p.link_name}</div>` : ''}
        <table style="font-size:10px;border-collapse:collapse;width:100%">
          <tr><td style="color:#6b7280;padding-right:10px;font-weight:500">Class</td><td style="color:#1d4ed8;font-weight:800">${p.road_class ?? '-'}</td></tr>
          <tr><td style="color:#6b7280;font-weight:500">Surface</td><td style="color:${p.surface==='Bituminous'?'#1d4ed8':'#b45309'};font-weight:700">${p.surface ?? '-'}</td></tr>
          <tr><td style="color:#6b7280;font-weight:500">Region</td><td style="color:#111827;font-weight:700">${p.region ?? '-'}</td></tr>
          <tr><td style="color:#6b7280;font-weight:500">Length</td><td style="color:#111827;font-weight:700">${Number(p.length_km).toFixed(1)} km</td></tr>
        </table>
      </div>
    `, { sticky: true, className: 'road-tooltip' });
  }, [styleFeature]);

  const geojsonKey = `${animMode}-${animYear}-${colorBy}-${surfFilter}-${clsFilter}-${regFilter}-${highlightedLinks.length}`;

  const regions = useMemo(() => {
    if (!geoData) return [];
    const s = new Set<string>();
    geoData.features.forEach(f => { const r = (f.properties as LinkProps).region; if (r) s.add(r); });
    return [...s].sort();
  }, [geoData]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background: C.bgVoid, overflow:'hidden' }}>
      <CrossLinkChipBar sectionId="roadnetwork" />
    <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>

      {/* ══ MAP ═══════════════════════════════════════════════════════════════ */}
      <div style={{ flex:1, position:'relative', minWidth:0 }}>
        {loading && (
          <div style={{ position:'absolute', inset:0, zIndex:2000, display:'flex',
            alignItems:'center', justifyContent:'center',
            background:'rgba(2,5,8,0.85)', backdropFilter:'blur(8px)' }}>
            <div style={{ textAlign:'center', color:'#00f5ff' }}>
              <div style={{ width:32, height:32, border:'2px solid rgba(0,245,255,0.2)',
                borderTopColor:'#00f5ff', borderRadius:'50%',
                animation:'spin-slow 1s linear infinite', margin:'0 auto 12px' }}/>
              <div style={{ fontSize:13, fontWeight:700 }}>Loading road network…</div>
              <div style={{ fontSize:10, color:'rgba(0,245,255,0.5)', marginTop:4 }}>{netStatsLoad.totalLinks.toLocaleString()} links mapped · {(networkSummary?.official_total_km ?? netStatsLoad.officialKm).toLocaleString()} km official</div>
            </div>
          </div>
        )}

        <MapContainer center={[1.4, 32.3]} zoom={7}
          style={{ width:'100%', height:'100%' }} zoomControl={false}>
          {/* Satellite imagery base */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution='Esri, Maxar'
          />
          {/* Reference labels overlay */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            opacity={0.85}
            attribution='Esri'
          />
          <InfraLayers />
          <MapLegend title="Road Network" items={LEGEND_FULL} position="bottomleft" />
          <MapGISControls bounds={UGANDA_BOUNDS} accent={C.paved} position="bottomright" style={animMode ? { bottom: 130 } : undefined} />
          <ZoomWatcher onZoom={setMapZoom}/>
          {geoData && (
            <>
              {/* Base road layer */}
              <GeoJSON
                key={geojsonKey}
                data={geoData as GeoJSON.GeoJsonObject}
                style={(f: unknown) => styleFeature(f as GeoJSON.Feature)}
                onEachFeature={(f: unknown, l: L.Layer) => onEachFeature(f as GeoJSON.Feature, l)}
                ref={geoRef as React.RefObject<L.GeoJSON>}
              />
              {/* Shimmer highlight - paved roads only, rendered above base */}
              <GeoJSON
                key={`${geojsonKey}-shimmer`}
                data={geoData as GeoJSON.GeoJsonObject}
                style={(f: unknown) => styleFeatureShimmer(f as GeoJSON.Feature)}
              />
            </>
          )}
          {/* ── Bridges & Culverts ── */}
          {mapZoom >= 10 && structures.map(s => {
            const isCritical = s.conditionRating === 1;
            const isBridge   = s.type === 'bridge';
            const icon       = isBridge
              ? makeRNBridgeIcon(isCritical, 12)
              : makeRNCulvertIcon(isCritical, 12);
            return (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={icon}
                eventHandlers={{ click: () => { setSelectedStructure(s); setSelected(null); } }}>
                <LeafletTooltip direction="top" offset={[0, -8]} opacity={1}>
                  <div style={{fontSize:12,fontWeight:900,color:'#111827',marginBottom:2}}>{s.name}</div>
                  <div style={{fontSize:10,fontWeight:700,color: isBridge ? '#0891b2' : '#b45309'}}>
                    {isBridge ? '🌉 Bridge' : '🔵 Major Culvert'} · {s.road}
                  </div>
                  <div style={{fontSize:10,fontWeight:600,color:'#374151',marginTop:2}}>
                    {s.spanLength} m span · {s.noOfSpans} span{s.noOfSpans !== 1 ? 's' : ''} ·{' '}
                    Cond: <span style={{color: isCritical ? '#dc2626' : '#166534', fontWeight:800}}>
                      {['','Critical','Poor','Fair','Good','Excellent'][s.conditionRating]}
                    </span>
                  </div>
                </LeafletTooltip>
              </Marker>
            );
          })}
        </MapContainer>

        {/* ── Map top-left legend/controls ── */}
        <div style={{ position:'absolute', top:12, left:12, zIndex:999, display:'flex', flexDirection:'column', gap:8 }}>

          {/* Mode toggle */}
          <div style={{ ...glassStyle, padding:'8px 10px', display:'flex', gap:6 }}>
            <ModeBtn active={!animMode} onClick={() => { setAnimMode(false); setPlaying(false); }} icon={<MapIcon size={12}/>} label="Current"/>
            <ModeBtn active={animMode}  onClick={() => setAnimMode(true)}  icon={<Play size={12}/>} label="History"/>
          </div>

          {/* Legend */}
          <div style={{ ...glassStyle, padding:'10px 12px', minWidth:180 }}>
            <div style={sectionHead}>
              {animMode ? `${animYear} Snapshot` : (colorBy === 'surface' ? 'Surface Type' : colorBy === 'class' ? 'Road Class' : 'Region')}
            </div>
            {animMode ? (
              <>
                <LegRow color={ROAD_SYM.paved.color}   label="Paved"             val={yearStats ? `${yearStats.pavKm.toFixed(0)} km` : ''} thick shimmer={PAVED_SHIMMER.color}/>
                <LegRow color={ROAD_SYM.unpaved.color} label="Unpaved / Gravel"  val={yearStats ? `${yearStats.unsKm.toFixed(0)} km` : ''} dash="4 3"/>
                <LegRow color={ROAD_SYM.unknown.color} label="Unknown / Constr." val="" dash="2 4"/>
                {yearStats && (
                  <div style={{ marginTop:8, paddingTop:6, borderTop:'1px solid rgba(0,245,255,0.08)' }}>
                    <div style={{ fontSize:9, color:'rgba(0,245,255,0.5)', marginBottom:3 }}>Paved proportion</div>
                    <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:2 }}>
                      <div style={{ height:'100%', borderRadius:2, background:`linear-gradient(90deg,${C.paved},#4d9fff)`,
                        width:`${yearStats.pavPct.toFixed(1)}%`, transition:'width 0.4s' }}/>
                    </div>
                    <div style={{ marginTop:4, fontSize:10, fontWeight:800, color:C.paved }}>
                      {yearStats.pavPct.toFixed(1)}% paved
                    </div>
                  </div>
                )}
              </>
            ) : (
              colorBy === 'surface' ? (
                <>
                  <LegRow color={ROAD_SYM.paved.color}   label="Paved (Bituminous)" val={currentStats ? `${currentStats.pavKm.toFixed(0)} km` : ''} thick shimmer={PAVED_SHIMMER.color}/>
                  <LegRow color={ROAD_SYM.unpaved.color} label="Unsealed / Gravel"  val={currentStats ? `${currentStats.unsKm.toFixed(0)} km` : ''} dash="4 3"/>
                  <LegRow color={ROAD_SYM.unknown.color} label="Unknown / Constr."  val="" dash="2 4"/>
                </>
              ) : colorBy === 'class' ? (
                Object.entries(CLASS_COLORS).map(([k,v]) => (
                  <LegRow key={k} color={v} label={`Class ${k}`} val={currentStats ? `${(currentStats.byClass[k]??0).toFixed(0)} km` : ''} thick={k==='A'}/>
                ))
              ) : (
                Object.entries(REGION_COLORS).map(([k,v]) => (
                  <LegRow key={k} color={v} label={k} val={currentStats ? `${(currentStats.byRegion[k]??0).toFixed(0)} km` : ''}/>
                ))
              )
            )}
          </div>

          {/* Current-mode colour controls */}
          {!animMode && (
            <div style={{ ...glassStyle, padding:'10px 12px' }}>
              <div style={sectionHead}>Colour By</div>
              {(['surface','class','region'] as const).map(m => (
                <button key={m} onClick={() => setColorBy(m)} style={{
                  display:'block', width:'100%', textAlign:'left', marginBottom:3,
                  padding:'5px 8px', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600,
                  background: colorBy===m ? 'rgba(0,245,255,0.12)' : 'transparent',
                  border: colorBy===m ? '1px solid rgba(0,245,255,0.3)' : '1px solid transparent',
                  color: colorBy===m ? '#00f5ff' : 'rgba(148,163,184,0.7)',
                }}>
                  {m === 'surface' ? 'Surface Type' : m === 'class' ? 'Road Class' : 'Region'}
                </button>
              ))}

              {/* Filters */}
              <div style={{ marginTop:8, paddingTop:6, borderTop:'1px solid rgba(0,245,255,0.08)' }}>
                <div style={sectionHead}>Filter</div>
                <div style={{ fontSize:9, color:'rgba(100,116,139,0.6)', marginBottom:3 }}>Surface</div>
                <div style={{ display:'flex', gap:3, marginBottom:6 }}>
                  {(['all','Bituminous','Unsealed'] as const).map(f => (
                    <button key={f} onClick={() => setSurfFilter(f)} style={filterBtn(surfFilter===f)}>
                      {f==='all'?'All':f==='Bituminous'?'Paved':'Unsealed'}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:9, color:'rgba(100,116,139,0.6)', marginBottom:3 }}>Class</div>
                <div style={{ display:'flex', gap:3, marginBottom:6 }}>
                  {(['all','A','B','C','M']).map(f => (
                    <button key={f} onClick={() => setClsFilter(f)} style={filterBtn(clsFilter===f)}>
                      {f==='all'?'All':`${f}`}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:9, color:'rgba(100,116,139,0.6)', marginBottom:3 }}>Region</div>
                <SearchableSelect value={regFilter} onChange={setRegFilter} style={{ fontSize:10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '4px 7px', color: '#e2eaf4' }}>
                  <option value="all">All Regions</option>
                  {regions.map(r => <option key={r} value={r}>{r}</option>)}
                </SearchableSelect>
              </div>
            </div>
          )}
        </div>

        {/* ── Animation timeline bar (bottom) ── */}
        {animMode && (
          <div style={{
            position:'absolute', bottom:0, left:0, right:0, zIndex:999,
            background:'rgba(2,5,8,0.92)', backdropFilter:'blur(16px)',
            borderTop:'1px solid rgba(0,245,255,0.10)',
            padding:'10px 20px 12px',
          }}>
            {/* Year display */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
              <span style={{ fontSize:28, fontWeight:900, color:'#00f5ff',
                textShadow:'0 0 20px rgba(0,245,255,0.5)', fontVariantNumeric:'tabular-nums',
                minWidth:60 }}>
                {animYear}
              </span>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:9,
                  color:'rgba(100,116,139,0.6)', marginBottom:4 }}>
                  <span>1960</span><span>1980</span><span>2000</span><span>2026</span>
                </div>
                <input type="range"
                  min={ANIM_MIN} max={ANIM_MAX} step={ANIM_STEP} value={animYear}
                  onChange={e => { setAnimYear(Number(e.target.value)); setPlaying(false); }}
                  style={{ width:'100%' }}
                />
              </div>

              {/* Playback controls */}
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <ABtn onClick={() => { setAnimYear(ANIM_MIN); setPlaying(false); }}><SkipBack size={12}/></ABtn>
                <button onClick={() => setPlaying(p => !p)} style={{
                  padding:'6px 16px', borderRadius:8, cursor:'pointer',
                  background: playing ? 'rgba(255,107,53,0.15)' : 'rgba(0,245,255,0.12)',
                  border: playing ? '1px solid rgba(255,107,53,0.4)' : '1px solid rgba(0,245,255,0.35)',
                  color: playing ? '#ff6b35' : '#00f5ff',
                  display:'flex', alignItems:'center', gap:6, fontWeight:700, fontSize:12,
                }}>
                  {playing ? <Pause size={13}/> : <Play size={13}/>}
                  {playing ? 'Pause' : 'Play'}
                </button>
                <ABtn onClick={() => { setAnimYear(ANIM_MAX); setPlaying(false); }}><SkipForward size={12}/></ABtn>

                {/* Speed */}
                <div style={{ display:'flex', gap:3, marginLeft:8 }}>
                  {[{l:'1×',v:800},{l:'2×',v:400},{l:'5×',v:160}].map(s => (
                    <button key={s.v} onClick={() => setSpeed(s.v)} style={filterBtn(speed===s.v, '#b967ff')}>
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paving progress */}
              {yearStats && (
                <div style={{ textAlign:'right', minWidth:100 }}>
                  <div style={{ fontSize:18, fontWeight:900, color:'#00f5ff' }}>
                    {yearStats.pavKm.toFixed(0)} km
                  </div>
                  <div style={{ fontSize:9, color:'rgba(100,116,139,0.6)' }}>paved · {yearStats.pavPct.toFixed(1)}%</div>
                </div>
              )}
            </div>

            {/* Mini chart sparkline */}
            {storyData && (
              <div style={{ height:36 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={storyData.cumulative_paved.filter(e => e.year >= ANIM_MIN)}
                    margin={{ top:0, right:0, bottom:0, left:0 }}>
                    <defs>
                      <linearGradient id="rnvGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#00f5ff" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00f5ff" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="cum_paved_km" stroke="#00f5ff" strokeWidth={1.5}
                      fill="url(#rnvGrad)" dot={false} animationDuration={200}/>
                    {/* Reference line for current year */}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ── Selected feature panel (road-link or structure) ── */}
        {(selected || selectedStructure) && (() => {
          const featureData: FeatureData | null = selected
            ? {
                type: 'road-link',
                name: selected.link_name || selected.link_id,
                roadClass: selected.road_class,
                lengthKm: Number(selected.length_km),
                surface: selected.surface,
                region: selected.region,
              }
            : selectedStructure
            ? {
                type: selectedStructure.type as 'bridge' | 'culvert',
                id: selectedStructure.id,
                name: selectedStructure.name,
                road: selectedStructure.road,
                spanLength: selectedStructure.spanLength,
                conditionRating: selectedStructure.conditionRating,
                lastInspection: selectedStructure.lastInspection,
                material: selectedStructure.material,
                crossingType: selectedStructure.crossingType,
              }
            : null;
          if (!featureData) return null;
          return (
            <div style={{ position:'absolute', top:20, right: sideOpen ? 436+12 : 12, zIndex:1001,
              display:'flex', flexDirection:'column', gap:6, maxHeight:'calc(100% - 32px)', overflowY:'auto' }}>
              <FeatureAnalyticsPanel
                feature={featureData}
                onClose={() => { setSelected(null); setSelectedStructure(null); setSelectedRaw(null); }}
                width={270}
              />
              {selectedRaw && selected && (
                <div style={{
                  width: 270, background:'rgba(6,13,24,0.97)', backdropFilter:'blur(16px)',
                  border:'1px solid rgba(0,245,255,0.12)', borderRadius:10, padding:'10px 12px',
                }}>
                  <div style={{ fontSize:9, fontWeight:800, color:'rgba(0,245,255,0.5)',
                    textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>
                    GeoJSON Attributes · {selected.link_id}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    {Object.entries(selectedRaw)
                      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
                      .map(([k, v]) => (
                        <div key={k} style={{ display:'flex', justifyContent:'space-between',
                          gap:8, borderBottom:'1px solid rgba(255,255,255,0.04)', paddingBottom:2 }}>
                          <span style={{ fontSize:8, color:'rgba(100,116,139,0.7)', fontFamily:'monospace',
                            whiteSpace:'nowrap', flexShrink:0 }}>{k}</span>
                          <span style={{ fontSize:8, color:'rgba(226,234,244,0.85)', textAlign:'right',
                            wordBreak:'break-all', fontFamily:'monospace' }}>
                            {typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(3)) : String(v)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ══ COLLAPSE TOGGLE ══════════════════════════════════════════════════ */}
      <button onClick={() => setSideOpen(o => !o)} style={{
        position:'absolute', right: sideOpen ? 420 : 0, top:'50%',
        transform:'translateY(-50%)', zIndex:1001,
        padding:'10px 4px',
        background:'rgba(2,5,8,0.9)', backdropFilter:'blur(10px)',
        border:'1px solid rgba(0,245,255,0.15)',
        borderRight: sideOpen ? undefined : 'none',
        borderRadius: sideOpen ? '8px 0 0 8px' : '0 8px 8px 0',
        color:'#00f5ff', cursor:'pointer', transition:'right 0.3s',
      }}>
        {sideOpen ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
      </button>

      {/* ══ RIGHT PANEL - Dashboard ══════════════════════════════════════════ */}
      {sideOpen && (
        <div style={{ width:420, flexShrink:0,
          background:'rgba(2,5,8,0.95)', backdropFilter:'blur(24px)',
          borderLeft:'1px solid rgba(0,245,255,0.08)',
          display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Tab header */}
          <div style={{ display:'flex', borderBottom:'1px solid rgba(0,245,255,0.08)', flexShrink:0 }}>
            {[{id:'map' as const,icon:<Layers size={12}/>,label:'Network'},
              {id:'dashboard' as const,icon:<BarChart3 size={12}/>,label:'Dashboard'}].map(t => (
              <button key={t.id} onClick={() => setPanel(t.id)} style={{
                flex:1, padding:'10px 8px', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                fontSize:11, fontWeight:700, cursor:'pointer', border:'none',
                background: panel===t.id ? 'rgba(0,245,255,0.06)' : 'transparent',
                color: panel===t.id ? '#00f5ff' : 'rgba(100,116,139,0.6)',
                borderBottom: panel===t.id ? '2px solid #00f5ff' : '2px solid transparent',
                transition:'all 0.2s',
              }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* ── Network stats panel ── */}
          {panel === 'map' && (
            <div style={{ flex:1, overflowY:'auto', padding:16 }}>
              <NetworkStatsPanel stats={currentStats} ndpiv={ndpiv} storyData={storyData} animYear={animYear} animMode={animMode} networkSummary={networkSummary}/>
            </div>
          )}

          {/* ── Dashboard panel ── */}
          {panel === 'dashboard' && (
            <div style={{ flex:1, overflowY:'auto', padding:16 }}>
              <DashboardPanel stats={currentStats} storyData={storyData} networkSummary={networkSummary}/>
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Network Stats Panel
// ─────────────────────────────────────────────────────────────────────────────
function NetworkStatsPanel({ stats, ndpiv, storyData, animYear, animMode, networkSummary }: {
  stats: { totalKm:number; pavKm:number; unsKm:number; byClass:Record<string,number>; byRegion:Record<string,number> } | null;
  ndpiv: NdpivData | null;
  storyData: { cumulative_paved: CumulativeEntry[]; by_region: RegionEntry[] } | null;
  animYear: number;
  animMode: boolean;
  networkSummary?: { official_total_km?: number } | null;
}) {
  // Live network totals (network2026.geojson) for the Coverage Note below -
  // must not be a hardcoded snapshot, or it drifts from the StatCards above.
  const netStats = useNetworkStats();
  // Derive KPIs - reactive to animYear in history mode, static (inventory) in current mode
  const { totalKm, pavKm, unsKm, pavPct } = useMemo(() => {
    const netTotal = ndpiv?.summary.total_km ?? stats?.totalKm ?? networkSummary?.official_total_km ?? 21302;
    if (animMode && storyData) {
      // Interpolate cumulative paved at the current timeline year
      const cp    = storyData.cumulative_paved;
      const entry = [...cp].reverse().find(e => e.year <= animYear);
      const pav   = Math.min(entry?.cum_paved_km ?? 0, netTotal);
      const uns   = Math.max(netTotal - pav, 0);
      return { totalKm: netTotal, pavKm: pav, unsKm: uns, pavPct: (pav / netTotal) * 100 };
    }
    // Current mode - use authoritative inventory figures when available
    const pav  = ndpiv?.summary.paved_km    ?? stats?.pavKm   ?? 0;
    const uns  = ndpiv?.summary.unsealed_km ?? stats?.unsKm   ?? 0;
    const pct  = ndpiv?.summary.paved_pct   ?? (stats ? stats.pavKm / stats.totalKm * 100 : 0);
    return { totalKm: netTotal, pavKm: pav, unsKm: uns, pavPct: pct };
  }, [animMode, animYear, storyData, ndpiv, stats]);

  if (!stats && !ndpiv) return <div style={{ color:'rgba(100,116,139,0.5)', fontSize:12, textAlign:'center', marginTop:40 }}>Loading…</div>;

  return (
    <>
      <div style={sectionHead}>Uganda National Road Network</div>
      <div style={{ fontSize:9, color:'rgba(100,116,139,0.5)', marginBottom:14 }}>
        {animMode ? `Historical snapshot: ${animYear}` : 'Current state · FY2025-26'}
      </div>

      {/* Summary stats */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
        <StatCard val={totalKm.toFixed(0)} unit="km" label="Total Network" color="#00f5ff"/>
        <StatCard val={pavKm.toFixed(0)}   unit="km" label="Paved"         color="#00ff88"/>
        <StatCard val={unsKm.toFixed(0)}   unit="km" label="Unsealed"      color="#ff8c00"/>
        <StatCard val={`${pavPct.toFixed(1)}%`} unit="" label="Paved Share" color="#ffd23f"/>
      </div>
      {/* GeoJSON vs Official coverage note */}
      <div style={{
        padding: '7px 10px', borderRadius: 8, marginBottom: 10,
        background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)',
        fontSize: 8.5,
      }}>
        <div style={{ fontWeight: 800, color: '#93c5fd', marginBottom: 4 }}>Coverage Note</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(148,163,184,0.7)', marginBottom: 2 }}>
          <span>GeoJSON mapped:</span><span style={{ color: '#60a5fa', fontWeight: 700 }}>{netStats.totalKm.toLocaleString()} km (mapped) · {netStats.totalLinks.toLocaleString()} links</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(148,163,184,0.7)', marginBottom: 2 }}>
          <span>Official Department of National Roads 2026:</span><span style={{ color: '#00f5ff', fontWeight: 700 }}>{(networkSummary?.official_total_km ?? netStats.officialKm).toLocaleString()} km</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(148,163,184,0.5)' }}>
          <span>Unmapped gap:</span><span style={{ color: '#fb923c', fontWeight: 700 }}>{Math.max(0, (networkSummary?.official_total_km ?? netStats.officialKm) - netStats.totalKm).toLocaleString()} km</span>
        </div>
      </div>
      {ndpiv && <div style={{ fontSize:8, color:'rgba(0,245,255,0.35)', marginBottom:8 }}>Network inventory · FY 2025/26</div>}

      {/* Paved proportion bar */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'rgba(100,116,139,0.6)', marginBottom:4 }}>
          <span>Paved (Bituminous)</span><span>Unsealed / Gravel</span>
        </div>
        <div style={{ height:8, borderRadius:4, background:'rgba(255,255,255,0.05)', overflow:'hidden' }}>
          <div style={{ height:'100%', background:`linear-gradient(90deg,${C.paved},#00b8ff)`,
            width:`${pavPct}%`, borderRadius:4, transition:'width 0.5s',
            boxShadow:`0 0 8px rgba(0,245,255,0.4)` }}/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:3, fontSize:9 }}>
          <span style={{ color:C.paved }}>{pavPct.toFixed(1)}%</span>
          <span style={{ color:C.unsealed }}>{(100-pavPct).toFixed(1)}%</span>
        </div>
      </div>

      {/* By class - use authoritative inventory when available */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={sectionHead}>By Road Class · km Paved / Unsealed</div>
          <SourceTableButton anchor="tbl-002" />
        </div>
        {(ndpiv
          ? Object.entries(ndpiv.by_class).sort()
          : Object.entries(stats?.byClass ?? {}).sort().map(([k,v]) => [k,{paved:v,unsealed:0}] as [string,{paved:number;unsealed:number}])
        ).map(([cls, d]) => {
          const pd = d as { paved:number; unsealed:number };
          const total = pd.paved + pd.unsealed;
          return (
          <div key={cls} style={{ marginBottom:6 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}>
              <span style={{ color: CLASS_COLORS[cls] ?? '#94a3b8' }}>Class {cls}</span>
              <span style={{ color:'#e2eaf4', fontWeight:700 }}>
                <span style={{ color:C.paved }}>{pd.paved.toFixed(0)}</span>
                {pd.unsealed > 0 && <span style={{ color:'rgba(100,116,139,0.5)', fontSize:8 }}> / {total.toFixed(0)}</span>}
                {' '}km
              </span>
            </div>
            <div style={{ height:4, background:'rgba(255,255,255,0.05)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', background: CLASS_COLORS[cls] ?? '#64748b',
                width:`${total > 0 ? (pd.paved/totalKm*100) : 0}%`, borderRadius:2,
                boxShadow:`0 0 6px ${CLASS_COLORS[cls] ?? '#64748b'}60` }}/>
            </div>
          </div>
          );
        })}
      </div>

      {/* By region - authoritative inventory figures */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={sectionHead}>By Maintenance Region · Paved / Total</div>
          <SourceTableButton anchor="tbl-001" />
        </div>
        {(ndpiv
          ? Object.entries(ndpiv.by_region).map(([k,v]) => ({ region:k, paved_km:v.paved, unpaved_km:v.unsealed, links:v.links }))
          : storyData?.by_region ?? []
        ).map(r => {
          const tot = r.paved_km + r.unpaved_km;
          return (
          <div key={r.region} style={{ marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:3 }}>
              <span style={{ color: REGION_COLORS[r.region] ?? '#94a3b8' }}>{r.region}</span>
              <div style={{ textAlign:'right' }}>
                <span style={{ color:C.paved, fontSize:9, fontWeight:700 }}>{r.paved_km.toFixed(0)}</span>
                <span style={{ color:'rgba(100,116,139,0.4)', fontSize:8 }}> / {tot.toFixed(0)} km</span>
                <span style={{ color:'rgba(0,245,255,0.5)', fontSize:8 }}> · {(r.paved_km/tot*100).toFixed(0)}%</span>
              </div>
            </div>
            <div style={{ height:5, background:'rgba(255,255,255,0.05)', borderRadius:3, overflow:'hidden' }}>
              <div style={{ height:'100%', background: REGION_COLORS[r.region] ?? '#64748b',
                width:`${(r.paved_km/tot*100)}%`, borderRadius:3 }}/>
            </div>
          </div>
          );
        })}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Panel - detailed stats + charts
// ─────────────────────────────────────────────────────────────────────────────
function DashboardPanel({ stats, storyData, networkSummary }: {
  stats: { totalKm:number; pavKm:number; unsKm:number; byClass:Record<string,number>; byRegion:Record<string,number> } | null;
  storyData: { cumulative_paved: CumulativeEntry[]; by_region: RegionEntry[] } | null;
  networkSummary?: { official_total_km?: number } | null;
}) {
  if (!stats || !storyData) return null;

  const cp1986 = storyData.cumulative_paved.find(e => e.year===1986)?.cum_paved_km ?? 0;
  const cp2025 = storyData.cumulative_paved.find(e => e.year===2025)?.cum_paved_km ?? 0;
  const growth = ((cp2025 - cp1986) / cp1986 * 100);

  return (
    <>
      {/* KPIs */}
      <div style={sectionHead}>Road Network Dashboard</div>
      <div style={{ fontSize:9, color:'rgba(100,116,139,0.5)', marginBottom:12 }}>
        FY2025-26 · Uganda National Roads · DNR/MoWT
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
        <KpiCard val={(networkSummary?.official_total_km || 21302).toLocaleString()} unit="km" label="Total Network" sub="1,018 links · National inventory FY25-26" color="#00f5ff"/>
        <KpiCard val="6,405" unit="km" label="Paved Roads" sub="30.3% of network" color="#00ff88"/>
        <KpiCard val="14,732" unit="km" label="Unsealed Roads" sub="69.7% of network" color="#ff8c00"/>
        <KpiCard val={`+${growth.toFixed(0)}%`} unit="" label="Growth Since 1986" sub={`+${(cp2025-cp1986).toFixed(0)} km paved`} color="#ffd23f"/>
      </div>

      {/* Cumulative paved chart */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={sectionHead}>Paved Road Growth 1960–2026</div>
          <SourceTableButton anchor="tbl-005" />
        </div>
        <div style={{ height:140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={storyData.cumulative_paved.filter(e => e.year >= 1960)}
              margin={{ top:4, right:4, bottom:0, left:0 }}>
              <defs>
                <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00f5ff" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#00f5ff" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="year" tick={{ fill:'#64748b', fontSize:8 }} tickLine={false} axisLine={false}
                interval={9} tickFormatter={v => `'${String(v).slice(2)}`}/>
              <YAxis tick={{ fill:'#64748b', fontSize:8 }} tickLine={false} axisLine={false}
                tickFormatter={v => `${(v/1000).toFixed(0)}k`} width={28}/>
              <RechartsTip
                contentStyle={{ background:'rgba(6,13,24,0.95)', border:'1px solid rgba(0,245,255,0.2)', borderRadius:8, fontSize:10 }}
                labelStyle={{ color:'#00f5ff' }}
                formatter={(v: number) => [`${v.toLocaleString()} km`, 'Paved']}
              />
              <Area type="monotone" dataKey="cum_paved_km" stroke="#00f5ff" strokeWidth={2}
                fill="url(#dashGrad)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* By region bar chart */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={sectionHead}>Paved km by Region</div>
          <SourceTableButton anchor="tbl-003" />
        </div>
        <div style={{ height:160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={storyData.by_region} layout="vertical"
              margin={{ top:0, right:4, bottom:0, left:56 }}>
              <XAxis type="number" tick={{ fill:'#64748b', fontSize:8 }} tickLine={false} axisLine={false}
                tickFormatter={v => `${v.toFixed(0)}`}/>
              <YAxis type="category" dataKey="region" tick={{ fill:'#94a3b8', fontSize:9 }}
                tickLine={false} axisLine={false} width={54}/>
              <RechartsTip
                contentStyle={{ background:'rgba(6,13,24,0.95)', border:'1px solid rgba(0,245,255,0.2)', borderRadius:8, fontSize:10 }}
                formatter={(v: number, name: string) => [`${v.toFixed(0)} km`, name === 'paved_km' ? 'Paved' : 'Unsealed']}
              />
              <Bar dataKey="paved_km" stackId="a" radius={[0,0,0,0]} maxBarSize={14}>
                {storyData.by_region.map(r => (
                  <Cell key={r.region} fill={REGION_COLORS[r.region] ?? '#64748b'} fillOpacity={0.85}/>
                ))}
              </Bar>
              <Bar dataKey="unpaved_km" stackId="a" fill="rgba(255,140,0,0.25)" maxBarSize={14}
                radius={[0,3,3,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Accurate station-level region table - all maintenance regions, every time */}
      <div style={{ marginBottom:16 }}>
        <div style={sectionHead}>Region & Station Breakdown</div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'rgba(148,163,184,0.6)', marginBottom:6 }}>
          <span>{storyData.by_region.length} regions · {storyData.by_region.reduce((s,r)=>s+r.links,0).toLocaleString()} links</span>
          <span>
            <span style={{ color:'#00ff88', fontWeight:700 }}>{storyData.by_region.reduce((s,r)=>s+r.paved_km,0).toFixed(0)} km paved</span>
            {' + '}
            <span style={{ color:C.unsealed, fontWeight:700 }}>{storyData.by_region.reduce((s,r)=>s+r.unpaved_km,0).toFixed(0)} km unsealed</span>
            {' = '}
            <span style={{ color:'#ffd23f', fontWeight:700 }}>
              {(storyData.by_region.reduce((s,r)=>s+r.paved_km,0) /
                storyData.by_region.reduce((s,r)=>s+r.paved_km+r.unpaved_km,0)*100).toFixed(1)}% paved
            </span>
          </span>
        </div>
        <SortableFilterableTable<RegionEntry & { pavedPct: number }>
          accent="#00f5ff"
          exportName="region-station-breakdown"
          initialSort="paved_km"
          columns={[
            { key: 'region', label: 'Region', render: r => <span style={{ color: REGION_COLORS[r.region] ?? '#94a3b8', fontWeight: 700 }}>{r.region}</span> },
            { key: 'links', label: 'Links', numeric: true, total: 'sum' },
            { key: 'paved_km', label: 'Paved (km)', numeric: true, total: 'sum', render: r => <span style={{ color: C.paved }}>{r.paved_km.toFixed(0)}</span> },
            { key: 'unpaved_km', label: 'Unsealed (km)', numeric: true, total: 'sum', render: r => <span style={{ color: C.unsealed }}>{r.unpaved_km.toFixed(0)}</span> },
            { key: 'pavedPct', label: '% Paved', numeric: true, render: r => (
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <div style={{ flex:1, height:3, background:'rgba(255,255,255,0.05)', borderRadius:2 }}>
                    <div style={{ height:'100%', background:REGION_COLORS[r.region]??'#64748b',
                      width:`${r.pavedPct}%`, borderRadius:2 }}/>
                  </div>
                  <span style={{ color:'#e2eaf4', fontWeight:700 }}>{r.pavedPct.toFixed(0)}%</span>
                </div>
              ) },
          ] as STColumn<RegionEntry & { pavedPct: number }>[]}
          rows={storyData.by_region.map(r => ({ ...r, pavedPct: (r.paved_km + r.unpaved_km) ? (r.paved_km / (r.paved_km + r.unpaved_km) * 100) : 0 }))}
        />
      </div>

      {/* Vision 2040 & NDP programs */}
      <div style={{ marginBottom:16 }}>
        <div style={sectionHead}>Vision 2040 & NDP Programs</div>
        {[
          { prog:'Vision 2040',   target:'100% paved', year:'2040', color:'#ffd23f', desc:'All national roads bituminous, expressways to key cities' },
          { prog:'NDP IV',        target:'+2,000 km',  year:'2026', color:'#00f5ff', desc:'21 major road projects · dual carriageways to Gulu, Mbale' },
          { prog:'NDP III',       target:'+1,700 km',  year:'2025', color:'#00ff88', desc:'Completed · 5,360→6,405 km paved · OPRC contracts' },
          { prog:'NDP II',        target:'+1,100 km',  year:'2020', color:'#b967ff', desc:'Completed · Kampala-Jinja, Northern Bypass, Kabale-Katuna' },
          { prog:'RSDP',          target:'+900 km',    year:'2013', color:'#ff6b35', desc:'Road Sector Dev. Programme · World Bank co-financed' },
        ].map(p => (
          <div key={p.prog} style={{ marginBottom:8, padding:'8px 10px',
            background:`rgba(${hexRgb(p.color)},0.04)`,
            border:`1px solid rgba(${hexRgb(p.color)},0.15)`, borderRadius:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:10, fontWeight:800, color:p.color }}>{p.prog}</span>
              <span style={{ fontSize:9, color:'rgba(100,116,139,0.6)' }}>{p.year}</span>
            </div>
            <div style={{ fontSize:9, color:'rgba(148,163,184,0.7)', marginTop:2 }}>{p.desc}</div>
            <div style={{ fontSize:9, fontWeight:700, color:p.color, marginTop:2 }}>Target: {p.target}</div>
          </div>
        ))}
      </div>

      {/* Key milestones */}
      <div>
        <div style={sectionHead}>Paving Milestones · National Road Network FY25-26</div>
        {[
          { year:1986, km:1282, label:'Liberation - 1,282 km paved' },
          { year:1996, km:1871, label:'NRM growth - 1,871 km (+46%)' },
          { year:2006, km:2476, label:'Department of National Roads established - 2,476 km' },
          { year:2015, km:3927, label:'NDP II target - 3,927 km' },
          { year:2020, km:5360, label:'NDP III - 5,360 km paved' },
          { year:2025, km:6405, label:'Current - 6,405 km (30.3%)' },
        ].map(m => (
          <div key={m.year} style={{ display:'flex', gap:10, marginBottom:8, alignItems:'flex-start' }}>
            <div style={{ fontSize:10, fontWeight:900, color:'rgba(0,245,255,0.6)',
              minWidth:36, fontVariantNumeric:'tabular-nums' }}>{m.year}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:'#e2eaf4' }}>{m.label}</div>
              <div style={{ height:2, background:'rgba(255,255,255,0.05)', borderRadius:1, marginTop:3 }}>
                <div style={{ height:'100%', background:'linear-gradient(90deg,#00f5ff,#00b8ff)',
                  width:`${(m.km/6405*100)}%`, borderRadius:1 }}/>
              </div>
            </div>
            <div style={{ fontSize:10, fontWeight:700, color:C.paved, minWidth:50, textAlign:'right' }}>
              {m.km.toLocaleString()} km
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small presentational components
// ─────────────────────────────────────────────────────────────────────────────
const glassStyle: React.CSSProperties = {
  background: C.glass,
  backdropFilter: 'blur(20px) saturate(160%)',
  border: '1px solid rgba(0,245,255,0.10)',
  borderRadius: 12,
};
const sectionHead: React.CSSProperties = {
  fontSize: 8, fontWeight: 900, color: 'rgba(0,245,255,0.45)',
  textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8,
};
function filterBtn(active: boolean, accent = '#00f5ff'): React.CSSProperties {
  return {
    flex:1, padding:'3px 5px', borderRadius:5, cursor:'pointer', fontSize:9, fontWeight:700,
    background: active ? `rgba(${hexRgb(accent)},0.12)` : 'rgba(255,255,255,0.04)',
    border: active ? `1px solid rgba(${hexRgb(accent)},0.35)` : '1px solid rgba(255,255,255,0.06)',
    color: active ? accent : '#64748b',
  };
}
function hexRgb(h: string) {
  const c = h.replace('#','');
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}
function LegRow({ color, label, val, thick, dash, shimmer }: { color:string; label:string; val:string; thick?:boolean; dash?: string; shimmer?: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
      <svg width="20" height="8" style={{ flexShrink:0, overflow:'visible' }}>
        <line x1="1" y1="4" x2="19" y2="4"
          stroke={color} strokeWidth={thick ? 4 : 2.5}
          strokeDasharray={dash} strokeLinecap="round"
          style={{ filter:`drop-shadow(0 0 2px ${color}80)` }}/>
        {shimmer && (
          <line x1="1" y1="4" x2="19" y2="4"
            stroke={shimmer} strokeWidth={1.5}
            strokeLinecap="round" opacity={0.5}/>
        )}
      </svg>
      <span style={{ fontSize:10, color:'rgba(203,213,225,0.8)', flex:1 }}>{label}</span>
      {val && <span style={{ fontSize:9, color:'rgba(100,116,139,0.6)' }}>{val}</span>}
    </div>
  );
}
function StatCard({ val, unit, label, color }: { val:string; unit:string; label:string; color:string }) {
  return (
    <div style={{ ...glassStyle, padding:'10px 12px' }}>
      <div style={{ fontSize:18, fontWeight:900, color, textShadow:`0 0 12px ${color}60`, lineHeight:1 }}>
        {val}<span style={{ fontSize:11, marginLeft:2, opacity:0.7 }}>{unit}</span>
      </div>
      <div style={{ fontSize:9, color:'rgba(100,116,139,0.6)', marginTop:4 }}>{label}</div>
    </div>
  );
}
function KpiCard({ val, unit, label, sub, color }: { val:string; unit:string; label:string; sub:string; color:string }) {
  return (
    <div style={{ ...glassStyle, padding:'10px 12px' }}>
      <div style={{ fontSize:16, fontWeight:900, color, lineHeight:1 }}>
        {val}<span style={{ fontSize:10, marginLeft:2 }}>{unit}</span>
      </div>
      <div style={{ fontSize:9, color:'#94a3b8', marginTop:3, fontWeight:600 }}>{label}</div>
      <div style={{ fontSize:8, color:'rgba(100,116,139,0.5)', marginTop:1 }}>{sub}</div>
    </div>
  );
}
function PField({ l, v, c, span }: { l:string; v:string; c?:string; span?:boolean }) {
  return (
    <div style={{ gridColumn: span ? 'span 2' : undefined }}>
      <div style={{ fontSize:8, color:'rgba(100,116,139,0.6)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{l}</div>
      <div style={{ fontSize:10, fontWeight:700, marginTop:2, color: c ?? '#e2eaf4' }}>{v || '-'}</div>
    </div>
  );
}
function ModeBtn({ active, onClick, icon, label }: { active:boolean; onClick:()=>void; icon:React.ReactNode; label:string }) {
  return (
    <button onClick={onClick} style={{
      flex:1, padding:'5px 8px', borderRadius:6, cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', gap:4,
      fontSize:10, fontWeight:700,
      background: active ? 'rgba(0,245,255,0.12)' : 'transparent',
      border: active ? '1px solid rgba(0,245,255,0.3)' : '1px solid rgba(255,255,255,0.05)',
      color: active ? '#00f5ff' : 'rgba(100,116,139,0.6)',
    }}>{icon}{label}</button>
  );
}
function ABtn({ onClick, children }: { onClick:()=>void; children:React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding:'5px 8px', borderRadius:6, cursor:'pointer',
      background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
      color:'#94a3b8', display:'flex', alignItems:'center',
    }}>{children}</button>
  );
}
