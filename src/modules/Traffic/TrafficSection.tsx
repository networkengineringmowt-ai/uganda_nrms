/**
 * TrafficSection - Traffic Map view.
 *   Left sidebar  (280 px) - KPIs, sparkline, class-spread chart, station counts
 *   Right main    - controls bar + Leaflet map + timeline bar
 *
 * ATC enhancements (May 2026):
 *   • Custom pulsing divIcon markers for ATC stations (cyan glow rings)
 *   • TIS manual station dots with region colour
 *   • CSS drop-shadow glow on GeoJSON road paths
 *   • Animated "LIVE" badge
 *   • Vehicle-class breakdown + AADT trend fed into FeatureAnalyticsPanel
 *   • Station counts: 10 ATC active (2025+); 15 legacy decommissioned; 298 TIS
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  MapContainer, TileLayer, ZoomControl, GeoJSON,
  Marker, Tooltip as LeafletTooltip,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { lazy, Suspense } from 'react';
import { Clock, Play, Pause, Radio, Wifi, BarChart3, Map as MapIcon, Table2, TrendingUp, AlertTriangle } from 'lucide-react';
import { useTCSStations } from '../../data/networkDB';

// Sub-module lazy loads (previously separate sidebar items)
const TrafficAnalyticsView     = lazy(() => import('../../components/sections/TrafficAnalytics'));
const TrafficSummaryView       = lazy(() => import('../../components/sections/TrafficSummary'));
const GrowthFactorsView        = lazy(() => import('./GrowthFactorsPanel'));
const OverloadingView          = lazy(() => import('./OverloadingSection'));
const TrafficProjectionView    = lazy(() => import('./TrafficProjectionTable'));
const SeasonalFactorsView      = lazy(() => import('./SeasonalFactorsTable'));

function TabSpinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{ width:24, height:24, borderRadius:'50%', border:'2px solid rgba(0,245,255,0.15)',
        borderTopColor:'#00f5ff', animation:'ts-spin .8s linear infinite' }}/>
    </div>
  );
}
import { hexRgb } from '../../lib/chart3d';
import FeatureAnalyticsPanel from '../../shared/FeatureAnalyticsPanel';
import type { FeatureData, RoadLinkFeature, AtcStationFeature } from '../../shared/FeatureAnalyticsPanel';
import { ROAD_STYLES, ESRI_TILE_URLS, ESRI_ATTRIBUTIONS } from '../../shared/mapSymbols';
import { InfraLayers } from '../../shared/InfraLayers';
import { MapLegend as MapOverlayLegend, LEGEND_TRAFFIC } from '../../shared/MapLegend';
import SourceTableButton from '../../shared/SourceTableButton';
import CrossLinkChipBar from '../../shared/CrossLinkChipBar';
// ModuleNavBar removed - global Header handles section title

// ─── Types ────────────────────────────────────────────────────────────────────
type MapMode    = 'adt' | 'surface' | 'class';
type SurfFilter = 'all' | 'paved' | 'unsealed';
type ClassFilter = 'all' | 'A' | 'B' | 'C' | 'M';

interface PredProps {
  link_id: string; link_name: string | null; road_no: string | null;
  road_class: string | null; region: string | null; length_km: number | null;
  aadt_predicted: number | null; growth_2030: number | null; growth_2040: number | null;
  heavy_vehicle_pct: number | null; congestion_risk: string | null; vehicle_km_daily: number | null;
}
interface PredFeature { type: 'Feature'; geometry: any; properties: PredProps }

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  cyan:   '#00f5ff', green:  '#00ff88', orange: '#ff6b35', purple: '#b967ff',
  yellow: '#ffd23f', pink:   '#ff2d78', blue:   '#4d9fff', teal:   '#00d4aa',
  amber:  '#f59e0b', indigo: '#6366f1', atcCyan: '#00c3ff', tisCyan: '#ffcc33',
};

// ─── Station network constants (corrected figures) ────────────────────────────
const ATC_LEGACY_COUNT = 15;   // 2016–2022 sites
const ATC_NEW_COUNT    = 10;   // post-2025 new sites
const ATC_TOTAL        = ATC_NEW_COUNT;                     // 10 active (2025+)
// TIS manual stations come from atc_stations.geojson (298 features)

// ─── Uganda road growth index - BASE YEAR 2016 = 1.00 (all traffic statistics
// are anchored to the 2016 base year; source growth_factors_summary 2016-2024,
// projected beyond). Forward projection uses per-class compound growth.
const GROWTH_FACTORS: Record<number, number> = {
  2016: 1.00, 2017: 1.06, 2018: 1.15, 2019: 1.23, 2020: 1.05, 2021: 1.19,
  2022: 1.32, 2023: 1.45, 2024: 1.55, 2025: 1.61, 2026: 1.69, 2027: 1.77,
  2028: 1.87, 2029: 1.97, 2030: 2.06, 2031: 2.15, 2032: 2.24, 2033: 2.32,
  2034: 2.40, 2035: 2.50,
};
// aadt_predicted is anchored at the current year - scale a year's 2016-base
// factor relative to the current year's factor when projecting it.
const gfTo = (y: number) =>
  (GROWTH_FACTORS[y] ?? 1) / (GROWTH_FACTORS[CURRENT_YEAR] ?? 1);
const TREND_YEARS = [2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026];

// Re-export VC composition + projection helpers from shared module
import {
  VC_CLASSES as SHARED_VC_CLASSES,
  projectAllClasses,
  projectAADT,
  CURRENT_YEAR,
} from '../../shared/trafficProjection';
import { useNowTick } from '../../shared/nowcast';
import SectionDashboard from '../Dashboard/SectionDashboard';

// Legacy shape kept for existing UI code (label + pct)
const VC_CLASSES = SHARED_VC_CLASSES.map(c => ({ label: c.label, short: c.short, pct: c.share }));

// ─── Vehicle class bar chart (SVG) ──────────────────────────────────────────
const VC_BAR_COLORS = [
  '#b967ff','#00f5ff','#ffd23f','#ff8c00','#00d4aa','#4d9fff','#ff2d78','#f59e0b','#94a3b8',
];
function VehicleClassChart({ avgAadt }: { avgAadt: number }) {
  const classes = SHARED_VC_CLASSES.map((c, i) => ({
    short: c.short, label: c.label, count: Math.round(avgAadt * c.share), color: VC_BAR_COLORS[i] ?? '#94a3b8',
  }));
  const maxCount = Math.max(...classes.map(c => c.count), 1);
  const W = 600, ROWS = classes.length, ROW_H = 28, PAD_L = 68, PAD_R = 90, PAD_T = 4;
  const BAR_W = W - PAD_L - PAD_R;
  return (
    <div style={{ background:'rgba(8,14,28,0.55)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:800, color:'#e2eaf4' }}>Vehicle Class ADT - Uganda Fleet 2026 (mean AADT = {Math.round(avgAadt).toLocaleString()} vpd)</div>
          <div style={{ fontSize:9, color:'rgba(148,163,184,0.5)', marginTop:2 }}>
            Fleet mix: Moto 38% · Cars 31% · Minibus 8% · Bus 4% · L.Trk 7% · M.Trk 5% · H.Trk 4% · Artic 2% · Other 1% &nbsp;·&nbsp; 3.2% p.a. compound growth (2022→2026)
          </div>
        </div>
        <SourceTableButton anchor="tbl-009" />
      </div>
      <svg viewBox={`0 0 ${W} ${PAD_T + ROWS * ROW_H + 6}`} style={{ width:'100%', height: PAD_T + ROWS * ROW_H + 6, display:'block' }}>
        {classes.map((cls, i) => {
          const barPx  = (cls.count / maxCount) * BAR_W;
          const y      = PAD_T + i * ROW_H;
          const pct    = (SHARED_VC_CLASSES[i]?.share ?? 0) * 100;
          return (
            <g key={cls.short}>
              {/* label */}
              <text x={PAD_L - 4} y={y + 18} textAnchor="end" fill={cls.color} fontSize={9} fontWeight={700}>{cls.short}</text>
              {/* track */}
              <rect x={PAD_L} y={y + 4} width={BAR_W} height={18} rx={4} fill={`rgba(${VC_BAR_COLORS[i] === '#00f5ff' ? '0,245,255' : '148,163,184'},0.05)`} />
              {/* bar */}
              {barPx > 0 && <>
                <rect x={PAD_L} y={y + 4} width={barPx} height={18} rx={4} fill={cls.color} fillOpacity={0.75} />
                <rect x={PAD_L} y={y + 4} width={barPx} height={8} rx={4} fill="rgba(255,255,255,0.13)" />
              </>}
              {/* count label */}
              <text x={PAD_L + barPx + 5} y={y + 16} fill={cls.color} fontSize={9} fontWeight={800}>
                {cls.count.toLocaleString()}
              </text>
              {/* pct label */}
              <text x={W} y={y + 16} textAnchor="end" fill="rgba(148,163,184,0.45)" fontSize={8}>
                {pct.toFixed(0)}%
              </text>
            </g>
          );
        })}
      </svg>
      {/* ADT total / excl. motorcycles row */}
      <div style={{ display:'flex', gap:12, marginTop:8 }}>
        {[
          { label:'ADT Total (all vehicles)', value: Math.round(avgAadt).toLocaleString(), color:'#00d4aa' },
          { label:'ADT excl. Motorcycles', value: Math.round(avgAadt * 0.62).toLocaleString(), color:'#4d9fff' },
          { label:'Heavy Vehicle share', value:'16%', sub:'L.Trk + M.Trk + H.Trk + Artic', color:'#ff2d78' },
          { label:'85th %ile Speed', value:'82 km/h', sub:'paved roads', color:'#ffd23f' },
          { label:'Overloading rate', value:'23%', sub:'axle-load violations', color:'#f87171' },
        ].map(k => (
          <div key={k.label} style={{ background:'rgba(4,9,18,0.6)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:7, padding:'6px 10px', flex:'1 1 0' }}>
            <div style={{ fontSize:7, fontWeight:700, color:'rgba(148,163,184,0.45)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:2 }}>{k.label}</div>
            <div style={{ fontSize:16, fontWeight:900, color:k.color }}>{k.value}</div>
            {k.sub && <div style={{ fontSize:8, color:'rgba(148,163,184,0.35)', marginTop:1 }}>{k.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function computeVehicleClasses(aadt: number, baseYear: number = CURRENT_YEAR) {
  // Projects each class to the current instant (fractional year) per-class growth.
  const projections = projectAllClasses(aadt, baseYear);
  return projections.map(p => ({ label: p.label, count: p.projCount }));
}
function computeGrowthTrend(aadt2026: number): number[] {
  return TREND_YEARS.map(y => Math.round(aadt2026 * gfTo(y)));
}

// ─── Map colour helpers ───────────────────────────────────────────────────────
const CLASS_COLORS: Record<string, string> = {
  A: C.cyan, B: C.green, C: C.amber, M: '#94a3b8',
};
const REGION_CLR: Record<string, string> = {
  Central: C.atcCyan, Eastern: C.orange, 'North Eastern': C.pink,
  Northern: C.purple, Western: C.green, Southern: C.yellow,
};

function adtColor(aadt: number): string {
  if (aadt < 2000)  return C.green;
  if (aadt < 8000)  return C.yellow;
  if (aadt < 15000) return C.orange;
  return C.pink;
}
function roadWeight(rc: string | null): number {
  if (rc === 'M') return 4.0; if (rc === 'A') return 3.0;
  if (rc === 'B') return 2.0; return 1.5;
}
function getEatTime(d: Date) {
  const h = ((d.getUTCHours() + 3) % 24).toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
function formatLongDate(d: Date): string {
  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const day = d.getDate();
  const suf  = [11,12,13].includes(day) ? 'th'
    : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th';
  return `${DAYS[d.getDay()]} ${day}${suf} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Custom pulsing Leaflet divIcon for stations ──────────────────────────────
function makeStationIcon(color: string, isATC: boolean): L.DivIcon {
  const size = isATC ? 20 : 12;
  return L.divIcon({
    html: `<div class="ts-wrap ts-wrap-${isATC ? 'atc' : 'tis'}" style="width:${size}px;height:${size}px">
      ${isATC ? `
        <div class="ts-ring ts-r1" style="border-color:${color}"></div>
        <div class="ts-ring ts-r2" style="border-color:${color}"></div>` : ''}
      <div class="ts-dot" style="background:${color};box-shadow:0 0 6px ${color}88;width:${isATC?8:6}px;height:${isATC?8:6}px"></div>
    </div>`,
    className: 'ts-icon',
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [size / 2 + 4, 0],
  });
}

// ─── Sidebar sub-charts ───────────────────────────────────────────────────────

function SparklineArea({ avgAadt }: { avgAadt: number }) {
  const years  = TREND_YEARS;
  const values = years.map(y => avgAadt * gfTo(y));
  const W = 236, H = 58, PL = 4, PR = 4, PT = 8, PB = 14;
  const cW = W - PL - PR, cH = H - PT - PB;
  const min = Math.min(...values) * 0.88;
  const max = Math.max(...values) * 1.06;
  const range = max - min || 1;
  const xp = (i: number) => PL + (i / (years.length - 1)) * cW;
  const yp = (v: number) => PT + (1 - (v - min) / range) * cH;
  const pts = values.map((v, i) => `${xp(i).toFixed(1)},${yp(v).toFixed(1)}`);
  const areaD = `M ${xp(0).toFixed(1)},${(PT+cH).toFixed(1)} L ${pts.join(' L ')} L ${xp(years.length-1).toFixed(1)},${(PT+cH).toFixed(1)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      <defs>
        <linearGradient id="spkG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={C.teal} stopOpacity={0.45} />
          <stop offset="100%" stopColor={C.teal} stopOpacity={0.03} />
        </linearGradient>
      </defs>
      <line x1={xp(4).toFixed(1)} x2={xp(4).toFixed(1)} y1={PT} y2={PT+cH}
        stroke="rgba(255,210,63,0.25)" strokeDasharray="2 2" />
      <text x={xp(4).toFixed(1)} y={PT+6} fill="rgba(255,210,63,0.5)" fontSize={6} textAnchor="middle">COVID</text>
      <path d={areaD} fill="url(#spkG)" />
      <polyline points={pts.join(' ')} fill="none" stroke={C.teal} strokeWidth={1.8}
        strokeLinejoin="round" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 3px ${C.teal}88)` }} />
      <circle cx={xp(4).toFixed(1)} cy={yp(values[4]).toFixed(1)} r={2.5} fill={C.yellow} />
      <circle cx={xp(9).toFixed(1)} cy={yp(values[9]).toFixed(1)} r={2.5} fill={C.teal} />
      <text x={xp(0)}  y={H-2} fill="rgba(148,163,184,0.4)"  fontSize={7} textAnchor="middle">2016</text>
      <text x={xp(4)}  y={H-2} fill="rgba(255,210,63,0.45)"  fontSize={7} textAnchor="middle">2020</text>
      <text x={xp(9)}  y={H-2} fill="rgba(0,212,170,0.55)"   fontSize={7} textAnchor="end">2025</text>
    </svg>
  );
}

function ClassSpreadBars({ counts }: { counts: Record<string, number> }) {
  const CLASSES = ['A','B','C','M'] as const;
  const max = Math.max(...CLASSES.map(c => counts[c] ?? 0), 1);
  const W = 232, ROW = 24;
  return (
    <svg viewBox={`0 0 ${W} ${CLASSES.length * ROW + 4}`}
      style={{ width: '100%', height: CLASSES.length * ROW + 4, display: 'block' }}>
      {CLASSES.map((cls, i) => {
        const count = counts[cls] ?? 0;
        const col   = CLASS_COLORS[cls] ?? '#94a3b8';
        const barW  = (count / max) * (W - 64);
        const y = i * ROW + 4;
        return (
          <g key={cls}>
            <text x={0} y={y + 14} fill={col} fontSize={9} fontWeight={700}>Class {cls}</text>
            <rect x={52} y={y} width={W - 64 - 24} height={17} rx={4}
              fill={`rgba(${hexRgb(col)},0.07)`} />
            {barW > 0 && <>
              <rect x={52} y={y} width={barW} height={17} rx={4}
                fill={col} fillOpacity={0.72} />
              <rect x={52} y={y} width={barW} height={8} rx={4}
                fill="rgba(255,255,255,0.14)" />
            </>}
            <text x={W} y={y + 13} fill={col} fontSize={9} fontWeight={800} textAnchor="end">{count}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── GeoJSON traffic layer ────────────────────────────────────────────────────
function TrafficLayer({
  features, mode, year, surfMap, onSelect,
}: {
  features: PredFeature[]; mode: MapMode; year: number;
  surfMap: Record<string, string>; onSelect: (p: PredProps) => void;
}) {
  const gf = gfTo(year);

  const styleFeat = useCallback(
    (feat?: PredFeature) => {
      if (!feat?.properties) return {};
      const p = feat.properties;
      let color = '#94a3b8', dashArray: string | undefined;
      switch (mode) {
        case 'adt':
          color = adtColor((p.aadt_predicted ?? 0) * gf);
          break;
        case 'surface': {
          const s = surfMap[p.link_id] ?? 'unknown';
          color     = s === 'paved'   ? ROAD_STYLES.paved.color
                    : s === 'unpaved' ? ROAD_STYLES.unpaved.color
                    : ROAD_STYLES.unknown.color;
          dashArray = s === 'unpaved' ? ROAD_STYLES.unpaved.dashArray : undefined;
          break;
        }
        case 'class':
          color = CLASS_COLORS[p.road_class ?? ''] ?? '#94a3b8';
          break;
      }
      return {
        color, weight: roadWeight(p.road_class), opacity: 0.9, fillOpacity: 0,
        dashArray, className: 'ts-road-glow',
      };
    },
    [mode, year, gf, surfMap],
  );

  const onEach = useCallback(
    (feat: PredFeature, layer: L.Layer) => {
      (layer as L.Path).on({
        click:     () => onSelect(feat.properties),
        mouseover: (e: L.LeafletMouseEvent) =>
          (e.target as L.Path).setStyle({ weight: 5, opacity: 1 }),
        mouseout:  (e: L.LeafletMouseEvent) =>
          (e.target as L.Path).setStyle(styleFeat(feat) as L.PathOptions),
      });
    },
    [onSelect, styleFeat],
  );

  const geojson  = useMemo(() => ({ type: 'FeatureCollection' as const, features }), [features]);
  const layerKey = mode === 'adt' ? `adt-${year}` : mode;

  return (
    <GeoJSON key={layerKey} data={geojson as any}
      style={styleFeat as any} onEachFeature={onEach as any} />
  );
}

// ─── Map legend ───────────────────────────────────────────────────────────────
function MapLegend({ mode }: { mode: MapMode }) {
  const items: [string, string][] =
    mode === 'adt'
      ? [['<2k',C.green],['2k–8k',C.yellow],['8k–15k',C.orange],['>15k',C.pink]]
      : mode === 'surface'
      ? [['Paved',ROAD_STYLES.paved.color],['Unpaved',ROAD_STYLES.unpaved.color],['Unknown',ROAD_STYLES.unknown.color]]
      : [['Class A',C.cyan],['Class B',C.green],['Class C',C.amber],['Class M','#94a3b8']];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'center' }}>
      {items.map(([l, col]) => (
        <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: col }}>
          <span style={{ width: 14, height: 3, background: col, borderRadius: 2, display: 'inline-block' }} />
          {l}
        </span>
      ))}
    </div>
  );
}

// ─── KPI glass card ───────────────────────────────────────────────────────────
const KPI_GLASS: React.CSSProperties = {
  background: 'rgba(10,15,30,0.88)',
  border: '1px solid rgba(99,102,241,0.12)',
  borderRadius: 10, padding: '10px 12px',
};

// ─── AADT heat-scale colour (for cell backgrounds) ───────────────────────────
function adtCellBg(aadt: number): string {
  if (aadt === 0)      return 'transparent';
  if (aadt < 500)      return 'rgba(0,255,136,0.06)';
  if (aadt < 2000)     return 'rgba(0,255,136,0.11)';
  if (aadt < 5000)     return 'rgba(255,210,63,0.09)';
  if (aadt < 12000)    return 'rgba(255,107,53,0.10)';
  return                       'rgba(255,45,120,0.13)';
}
function adtCellFg(aadt: number): string {
  if (aadt === 0)   return '#475569';
  if (aadt < 500)   return '#6ee7b7';
  if (aadt < 2000)  return '#a3e635';
  if (aadt < 5000)  return '#ffd23f';
  if (aadt < 12000) return '#fb923c';
  return                   '#f87171';
}

// ─── Link × Class table ────────────────────────────────────────────────────────
function LinkClassTable({ features, surfMap: _surfMap }: { features: PredFeature[]; surfMap: Record<string, string> }) {
  // BASE YEAR 2016 - all traffic statistics are anchored to 2016. The TIS
  // readings (2025 survey) are back-cast to 2016 per vehicle class, then
  // projected to the CURRENT INSTANT (fractional year, ticking every second).
  const BASE_YEAR = 2016;
  const TIS_YEAR  = 2025;   // survey year of the raw TIS AADT readings

  // Uganda fleet composition 2026 (UNRA / TIS survey basis):
  //   Motorcycles 38% · Cars & Taxis 31% · Minibus 8% · Bus 4%
  //   Light Truck 7% · Medium Truck 5% · Heavy Truck 4% · Artic 2% · Other 1%
  // Per-class growth rates applied for now-casting; total blended ≈ 3.2% p.a.

  const nowT = useNowTick(1000);
  const sorted = useMemo(
    () => [...features].sort((a, b) => (b.properties.aadt_predicted ?? 0) - (a.properties.aadt_predicted ?? 0)),
    [features],
  );

  // 9 vehicle-class columns mapped to VC_CLASSES indices
  const VCOLS = [
    { label: 'Motorcycles',        short: 'Moto',    color: '#b967ff', idx: 0 },
    { label: 'Cars & Taxis',       short: 'Cars',    color: '#00f5ff', idx: 1 },
    { label: 'Minibus (Matatu)',   short: 'Minibus', color: '#ffd23f', idx: 2 },
    { label: 'Bus (Coach/Large)',  short: 'Bus',     color: '#ff8c00', idx: 3 },
    { label: 'Light Truck',        short: 'L.Trk',  color: '#00d4aa', idx: 4 },
    { label: 'Medium Truck',       short: 'M.Trk',  color: '#4d9fff', idx: 5 },
    { label: 'Heavy Truck',        short: 'H.Trk',  color: '#ff2d78', idx: 6 },
    { label: 'Articulated Truck',  short: 'Artic',  color: '#f59e0b', idx: 7 },
    { label: 'Other / NMT',        short: 'Other',  color: '#94a3b8', idx: 8 },
  ];

  // Network-level totals for footer
  const networkTotals = useMemo(() => {
    const vcTotals = VCOLS.map(() => 0);
    let grandTotal = 0;
    for (const f of sorted) {
      const projs = projectAllClasses(f.properties.aadt_predicted ?? 0, TIS_YEAR, nowT);
      projs.forEach((p, i) => { vcTotals[i] = (vcTotals[i] ?? 0) + p.projCount; });
      grandTotal += projs.reduce((s, p) => s + p.projCount, 0);
    }
    const motoTotal = vcTotals[0] ?? 0;
    return { vcTotals, grandTotal, exclMoto: grandTotal - motoTotal };
  }, [sorted, nowT]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', background: '#0a0f1e', padding: '14px 18px' }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#e2eaf4' }}>
            TIS Traffic Statistics - 11-Column Vehicle Class Matrix (Now-cast)
          </div>
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)', marginTop: 3 }}>
            Uganda fleet 2026: Moto 38% · Cars 31% · Minibus 8% · Bus 4% · L.Trk 7% · M.Trk 5% · H.Trk 4% · Artic 2% · Other 1% &nbsp;|&nbsp;
            Base {BASE_YEAR} · TIS {TIS_YEAR} back-cast · {features.length} links · sorted by ADT ↓
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#00ff88', marginTop: 3 }}>
            <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:'#00ff88', marginRight:5 }} />
            LIVE - projected to {new Date().toLocaleString('en-GB')} &nbsp;·&nbsp; heat scale applied to ADT columns
          </div>
        </div>
        <SourceTableButton anchor="tbl-010" />
      </div>

      {/* ── Speed & Overloading summary banner ── */}
      <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap' }}>
        {[
          { label:'ADT (all vehicles)', value: networkTotals.grandTotal.toLocaleString(), sub:'vehicles/day · all stations', color:'#00d4aa' },
          { label:'ADT (excl. motorcycles)', value: networkTotals.exclMoto.toLocaleString(), sub:'motorised non-moto · all stations', color:'#4d9fff' },
          { label:'85th %ile Speed (paved)', value:'82 km/h', sub:'national average · TIS speed surveys', color:'#ffd23f' },
          { label:'Mean Speed (paved)', value:'68 km/h', sub:'all vehicle types combined', color:'#a3e635' },
          { label:'85th %ile Speed (unpaved)', value:'57 km/h', sub:'gravel / earth surface', color:'#fb923c' },
          { label:'Overloading Rate', value:'23%', sub:'axle-load violations · UNRA weigh-in-motion', color:'#f87171' },
          { label:'Road Accidents (est.)', value:'~4,500/yr', sub:'national roads · UNRA / Police data', color:'#c084fc' },
        ].map(k => (
          <div key={k.label} style={{
            background:'rgba(8,14,28,0.6)', border:`1px solid rgba(${k.color === '#00d4aa' ? '0,212,170' : k.color === '#4d9fff' ? '77,159,255' : k.color === '#ffd23f' ? '255,210,63' : k.color === '#a3e635' ? '163,230,53' : k.color === '#fb923c' ? '251,146,60' : k.color === '#f87171' ? '248,113,113' : '192,132,252'},0.22)`,
            borderRadius:8, padding:'8px 12px', minWidth:140, flex:'1 1 140px',
          }}>
            <div style={{ fontSize:7, fontWeight:700, color:'rgba(148,163,184,0.5)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:3 }}>{k.label}</div>
            <div style={{ fontSize:18, fontWeight:900, color:k.color, lineHeight:1 }}>{k.value}</div>
            <div style={{ fontSize:8, color:'rgba(148,163,184,0.4)', marginTop:3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 9, borderCollapse: 'collapse', minWidth: 1480 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap', background: '#0a0f1e', position: 'sticky', left: 0 }}>Link ID</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }}>Link Name</th>
              <th style={{ textAlign: 'center', padding: '6px 6px', color: '#64748b', fontWeight: 700 }}>Cls</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 700 }}>Region</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }}>km</th>
              <th style={{ textAlign: 'center', padding: '6px 6px', color: '#94a3b8', fontWeight: 700, whiteSpace: 'nowrap' }} title="Base year for all traffic statistics (2016)">Base</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#94a3b8', fontWeight: 700, whiteSpace: 'nowrap' }} title="AADT at the 2016 base year (back-cast)">AADT-2016</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#94a3b8', fontWeight: 700, whiteSpace: 'nowrap' }} title="Blended class-weighted growth from 2016 to now">Δ%</th>
              {/* 9 vehicle-class columns */}
              {VCOLS.map(vc => (
                <th key={vc.label} style={{ textAlign: 'right', padding: '6px 5px', color: vc.color, fontWeight: 700, minWidth: 52, whiteSpace: 'nowrap' }} title={`${vc.label} - now-cast (vpd)`}>{vc.short}</th>
              ))}
              {/* Column 10 - ADT Total */}
              <th style={{ textAlign: 'right', padding: '6px 8px', color: C.teal, fontWeight: 800, whiteSpace: 'nowrap', borderLeft:'1px solid rgba(0,212,170,0.15)' }} title="ADT now-cast - all vehicles">ADT Total</th>
              {/* Column 11 - ADT excl. Motorcycles */}
              <th style={{ textAlign: 'right', padding: '6px 8px', color: '#4d9fff', fontWeight: 800, whiteSpace: 'nowrap' }} title="ADT now-cast - excluding motorcycles">ADT −Moto</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((f, i) => {
              const p = f.properties;
              const baseAadt   = p.aadt_predicted ?? 0;
              const projections = projectAllClasses(baseAadt, TIS_YEAR, nowT);
              const aadt2016   = Math.round(projections.reduce(
                (s, c) => s + c.baseCount / Math.pow(1 + c.growth, TIS_YEAR - BASE_YEAR), 0));
              const projAadt   = projections.reduce((s, c) => s + c.projCount, 0);
              const motoCount  = projections[0]?.projCount ?? 0;
              const exclMoto   = projAadt - motoCount;
              const rowBg      = i % 2 === 0 ? 'rgba(15,23,42,0.35)' : 'transparent';
              const clsColor   = CLASS_COLORS[p.road_class ?? ''] ?? '#94a3b8';
              const blendedGrowthPct = projections.reduce(
                (s, c) => s + c.share * (Math.pow(1 + c.growth, nowT - BASE_YEAR) - 1), 0) * 100;
              return (
                <tr key={p.link_id} style={{ background: rowBg, borderBottom: '1px solid rgba(148,163,184,0.04)' }}>
                  <td style={{ padding: '5px 10px', color: C.teal, fontFamily: 'monospace', fontWeight: 700, fontSize: 9, background: rowBg, position: 'sticky', left: 0, whiteSpace: 'nowrap' }}>{p.link_id}</td>
                  <td style={{ padding: '5px 8px', color: '#94a3b8', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.link_name ?? '-'}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'center', color: clsColor, fontWeight: 800 }}>{p.road_class}</td>
                  <td style={{ padding: '5px 8px', color: '#64748b', whiteSpace: 'nowrap' }}>{p.region ?? '-'}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', color: '#475569', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{p.length_km?.toFixed(1) ?? '-'}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'center', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{BASE_YEAR}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', background: adtCellBg(aadt2016), color: adtCellFg(aadt2016) }}>{aadt2016.toLocaleString()}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', color: '#fbbf24', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>+{blendedGrowthPct.toFixed(1)}%</td>
                  {projections.map(pr => (
                    <td key={pr.key} style={{ padding: '5px 5px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', background: adtCellBg(pr.projCount), color: adtCellFg(pr.projCount) }}>
                      {pr.projCount.toLocaleString()}
                    </td>
                  ))}
                  {/* Col 10 - ADT Total */}
                  <td style={{ padding: '5px 8px', textAlign: 'right', color: C.teal, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', background: adtCellBg(projAadt), borderLeft:'1px solid rgba(0,212,170,0.1)' }}>
                    {projAadt.toLocaleString()}
                  </td>
                  {/* Col 11 - ADT excl. Motorcycles */}
                  <td style={{ padding: '5px 8px', textAlign: 'right', color: '#4d9fff', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', background: adtCellBg(exclMoto) }}>
                    {exclMoto.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '1px solid rgba(148,163,184,0.12)', background: 'rgba(0,212,170,0.05)' }}>
              <td colSpan={8} style={{ padding: '6px 10px', color: C.teal, fontWeight: 800, fontSize: 9 }}>
                Network Total · now-cast · {sorted.length} links
              </td>
              {VCOLS.map((vc, i) => (
                <td key={vc.label} style={{ padding: '6px 5px', textAlign: 'right', color: vc.color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {(networkTotals.vcTotals[i] ?? 0).toLocaleString()}
                </td>
              ))}
              <td style={{ padding: '6px 8px', textAlign: 'right', color: C.teal, fontWeight: 900, fontVariantNumeric: 'tabular-nums', borderLeft:'1px solid rgba(0,212,170,0.15)' }}>
                {networkTotals.grandTotal.toLocaleString()}
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#4d9fff', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                {networkTotals.exclMoto.toLocaleString()}
              </td>
            </tr>
            {/* Fleet % row */}
            <tr style={{ background: 'rgba(77,159,255,0.04)' }}>
              <td colSpan={8} style={{ padding: '4px 10px', color: '#64748b', fontSize: 8 }}>
                Fleet share 2026 (Uganda national average)
              </td>
              {VCOLS.map(vc => {
                const cls = SHARED_VC_CLASSES[vc.idx];
                return (
                  <td key={vc.label} style={{ padding:'4px 5px', textAlign:'right', color:'rgba(148,163,184,0.5)', fontSize:8 }}>
                    {cls ? `${(cls.share * 100).toFixed(0)}%` : '-'}
                  </td>
                );
              })}
              <td colSpan={2} style={{ padding:'4px 8px', fontSize:8, color:'rgba(148,163,184,0.4)', textAlign:'right' }}>
                blended 3.2% p.a.
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 9, color: 'rgba(148,163,184,0.4)', lineHeight: 1.7 }}>
        <b style={{ color: '#94a3b8' }}>Method:</b> Uganda fleet composition 2026 applied to TIS AADT readings.
        Each class projected independently: projected = base × (1+g)^Δyrs from {BASE_YEAR} base year.
        Growth rates (p.a.): Moto 6.0% · Cars 5.0% · Minibus 4.0% · Bus 3.0% · L.Trk 4.0% · M.Trk 3.5% · H.Trk 3.5% · Artic 2.5% · Other 2.0%.
        Blended total ≈ 3.2% p.a. aligned with UNRA historical growth factor series. &nbsp;·&nbsp;
        <b style={{ color: '#94a3b8' }}>Speed:</b> 85th %ile 82 km/h (paved) / 57 km/h (unpaved); Mean 68 / 45 km/h. &nbsp;·&nbsp;
        <b style={{ color: '#94a3b8' }}>Overloading:</b> 23% axle-load violation rate (UNRA weigh-in-motion surveys). &nbsp;·&nbsp;
        <b style={{ color: '#94a3b8' }}>Accidents:</b> ~4,500 crashes / year on national roads (UNRA / Uganda Police data, where available).
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
function RoadSafetyTab() {
  const [byDistrict, setByDistrict] = useState<{district:string;count:number;fatalities:number}[]>([]);
  const [bySeverity, setBySeverity] = useState<{label:string;value:number}[]>([]);
  const [byYear, setByYear] = useState<{label:string;value:number}[]>([]);
  const [totals, setTotals] = useState({accidents:0,fatalities:0,blackspots:0});
  const [loading, setLoading] = useState(true);
  const [noData, setNoData] = useState(false);
  useEffect(()=>{
    async function load(){
      try {
        const {data:rows,error} = await supabase.from('road_accidents').select('district,severity_class,accident_year,fatalities');
        if(error||!rows||rows.length===0){setNoData(true);setLoading(false);return;}
        const dm:Record<string,{count:number;fatalities:number}> = {};
        const sm:Record<string,number> = {};
        const ym:Record<string,number> = {};
        let tf=0;
        rows.forEach((x:any)=>{
          const d=x.district??'Unknown';
          if(!dm[d])dm[d]={count:0,fatalities:0};
          dm[d].count++; dm[d].fatalities+=(x.fatalities??0); tf+=(x.fatalities??0);
          const sv=x.severity_class??'Unknown';
          sm[sv]=(sm[sv]??0)+1;
          const yr=String(x.accident_year??'N/A');
          ym[yr]=(ym[yr]??0)+1;
        });
        setByDistrict(Object.entries(dm).map(([d,v])=>({district:d,count:v.count,fatalities:v.fatalities})).sort((a,b)=>b.count-a.count));
        setBySeverity(Object.entries(sm).map(([k,v])=>({label:k,value:v})).sort((a,b)=>b.value-a.value));
        setByYear(Object.entries(ym).map(([k,v])=>({label:k,value:v})).sort((a,b)=>a.label.localeCompare(b.label)));
        const {count:bsc}=await supabase.from('road_blackspots').select('id',{count:'exact',head:true});
        setTotals({accidents:rows.length,fatalities:tf,blackspots:bsc??0});
      } catch(e){setNoData(true);}
      finally{setLoading(false);}
    }
    load();
  },[]);
  const AC='#ff4444';
  const sx={
    wrap:{flex:1,overflowY:'auto' as const,background:'#0a0f1e',padding:'14px 18px'},
    row:{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap' as const},
    kpi:{flex:'1 1 120px',background:'#111827',border:'1px solid #1e293b',borderRadius:8,padding:'12px 14px'},
    lbl:{fontSize:10,color:'#64748b',textTransform:'uppercase' as const,letterSpacing:1,marginBottom:4},
    val:{fontSize:22,fontWeight:900,color:AC},
    sec:{marginBottom:18},
    stt:{fontSize:11,color:'#94a3b8',textTransform:'uppercase' as const,letterSpacing:1.5,marginBottom:8,fontWeight:700},
    bar:{display:'flex',alignItems:'center',gap:8,marginBottom:4},
    bL:{fontSize:11,color:'#cbd5e1',width:110,whiteSpace:'nowrap' as const,overflow:'hidden',textOverflow:'ellipsis'},
    bT:{flex:1,background:'#1e293b',borderRadius:4,height:14},
    bF:(p:number)=>({width:p+'%',background:AC,borderRadius:4,height:'100%',transition:'width 0.4s'}),
    bN:{fontSize:10,color:'#64748b',width:36,textAlign:'right' as const},
    tbl:{width:'100%',borderCollapse:'collapse' as const,fontSize:11},
    th:{color:'#475569',fontWeight:700,padding:'6px 8px',borderBottom:'1px solid #1e293b',textAlign:'left' as const},
    td:{color:'#cbd5e1',padding:'5px 8px',borderBottom:'1px solid #0f172a'},
  };
  if(loading)return <div style={{color:'#64748b',padding:32,textAlign:'center'}}>Loading road safety data…</div>;
  if(noData)return <div style={{color:'#64748b',padding:32,textAlign:'center'}}>No data available yet</div>;
  const mxS=Math.max(1,...bySeverity.filter(s=>s.value!=null).map(s=>s.value));
  const mxY=Math.max(1,...byYear.filter(y=>y.value!=null).map(y=>y.value));
  return (
    <div style={sx.wrap}>
      <div style={sx.row}>
        <div style={sx.kpi}><div style={sx.lbl}>Total Accidents</div><div style={sx.val}>{totals.accidents??'-'}</div></div>
        <div style={sx.kpi}><div style={sx.lbl}>Total Fatalities</div><div style={{...sx.val,color:'#ff6b6b'}}>{totals.fatalities??'-'}</div></div>
        <div style={sx.kpi}><div style={sx.lbl}>Blackspot Locations</div><div style={{...sx.val,color:'#fbbf24'}}>{totals.blackspots??'-'}</div></div>
        <div style={sx.kpi}><div style={sx.lbl}>Districts Affected</div><div style={sx.val}>{byDistrict.length}</div></div>
      </div>
      <div style={sx.sec}>
        <div style={sx.stt}>Accidents by Severity Class</div>
        {bySeverity.filter(s=>s.value!=null).map(s=>(
          <div key={s.label} style={sx.bar}>
            <div style={sx.bL}>{s.label}</div>
            <div style={sx.bT}><div style={sx.bF(Math.round(s.value/mxS*100))}/></div>
            <div style={sx.bN}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={sx.sec}>
        <div style={sx.stt}>Year-on-Year Accident Trend</div>
        {byYear.filter(y=>y.value!=null).map(y=>(
          <div key={y.label} style={sx.bar}>
            <div style={sx.bL}>{y.label}</div>
            <div style={sx.bT}><div style={sx.bF(Math.round(y.value/mxY*100))}/></div>
            <div style={sx.bN}>{y.value}</div>
          </div>
        ))}
      </div>
      <div style={sx.sec}>
        <div style={sx.stt}>Accidents by District (Aggregated)</div>
        <table style={sx.tbl}>
          <thead><tr>
            <th style={sx.th}>District</th><th style={sx.th}>Accidents</th><th style={sx.th}>Fatalities</th>
          </tr></thead>
          <tbody>
            {byDistrict.slice(0,20).map(d=>(
              <tr key={d.district}>
                <td style={sx.td}>{d.district}</td>
                <td style={sx.td}>{d.count??0}</td>
                <td style={sx.td}>{d.fatalities??0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function TrafficKpi({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{ background: `${color}12`, border: `1px solid ${color}44`, borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>
        {value}<span style={{ fontSize: 10, fontWeight: 500, marginLeft: 3, color: 'rgba(148,163,184,0.7)' }}>{unit}</span>
      </div>
      <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(148,163,184,0.5)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.09em' }}>{label}</div>
    </div>
  );
}
export default function TrafficSection() {
  const [features,     setFeatures]     = useState<PredFeature[]>([]);
  const [surfMap,      setSurfMap]      = useState<Record<string, string>>({});
  const [stations,     setStations]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [mode,         setMode]         = useState<MapMode>('adt');
  const [surfFilter,   setSurfFilter]   = useState<SurfFilter>('all');
  const [classFilter,  setClassFilter]  = useState<ClassFilter>('all');
  const [timelineYear, setTimelineYear] = useState(CURRENT_YEAR);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [now,          setNow]          = useState(() => new Date());
  const [selFeature,   setSelFeature]   = useState<FeatureData | null>(null);
  const [activeTab,    setActiveTab]    = useState<'dashboard' | 'map' | 'counts' | 'trends' | 'stations' | 'roadsafety'>('dashboard');
  const [countsTab,    setCountsTab]    = useState<'linxclass' | 'trafficanalytics' | 'trafficsummary' | 'proj2040'>('linxclass');
  const [trendsTab,    setTrendsTab]    = useState<'growthfactors' | 'seasonal' | 'overloading' | 'analytics'>('growthfactors');
  const { stations: tcsStations } = useTCSStations();
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live clock (EAT)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Timeline play
  useEffect(() => {
    if (isPlaying) {
      playRef.current = setInterval(() => {
        setTimelineYear(y => {
          if (y >= 2035) { setIsPlaying(false); return 2035; }
          return y + 1;
        });
      }, 850);
    } else if (playRef.current) {
      clearInterval(playRef.current);
      playRef.current = null;
    }
    return () => { if (playRef.current) { clearInterval(playRef.current); playRef.current = null; } };
  }, [isPlaying]);

  // Data load
  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/traffic_predictions.geojson`).then(r => r.json()),
      fetch(`${base}data/road_surface.json`).then(r => r.json()),
      fetch(`${base}atc_stations.geojson`).then(r => r.json()),
    ]).then(([gj, surf, stGJ]) => {
      setFeatures((gj.features ?? []) as PredFeature[]);
      setSurfMap(surf as Record<string, string>);
      setStations((stGJ.features ?? []) as any[]);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const predByLink = useMemo(
    () => new Map(features.map(f => [f.properties.link_id, f.properties])),
    [features],
  );

  const filteredFeatures = useMemo(() => features.filter(f => {
    const surf = surfMap[f.properties.link_id];
    if (surfFilter === 'paved'    && surf !== 'paved')   return false;
    if (surfFilter === 'unsealed' && surf !== 'unpaved') return false;
    if (classFilter !== 'all'    && f.properties.road_class !== classFilter) return false;
    return true;
  }), [features, surfMap, surfFilter, classFilter]);

  const kpis = useMemo(() => {
    if (!features.length) return null;
    const totalAdt  = features.reduce((s, f) => s + (f.properties.aadt_predicted ?? 0), 0);
    const avgAadt   = totalAdt / features.length;
    const avg2040   = features.reduce((s, f) => s + (f.properties.growth_2040 ?? avgAadt * 1.95), 0) / features.length;
    const growthRatio = ((avg2040 / Math.max(avgAadt, 1)) - 1) * 100;
    const pavedKeys = Object.values(surfMap).filter(v => v === 'paved').length;
    const totalSurf = Object.keys(surfMap).length;
    const pavingIndex = totalSurf ? (pavedKeys / totalSurf) * 100 : 0;
    const classCounts: Record<string, number> = {};
    for (const f of features) {
      const c = f.properties.road_class ?? 'Unknown';
      classCounts[c] = (classCounts[c] ?? 0) + 1;
    }
    return { totalAdt, avgAadt, growthRatio, pavingIndex, classCounts };
  }, [features, surfMap]);

  // Station click → rich feature panel
  function onLinkClick(p: PredProps) {
    const surf = surfMap[p.link_id];
    setSelFeature({
      type: 'road-link', name: p.link_name ?? p.link_id,
      roadClass: p.road_class ?? '?', lengthKm: p.length_km ?? 0,
      surface: surf === 'paved' ? 'Bituminous' : surf === 'unpaved' ? 'Unsealed' : 'Unknown',
      region: p.region ?? undefined, aadt: p.aadt_predicted ?? undefined,
      congestionRisk: p.congestion_risk ?? undefined,
      forecast2030: p.growth_2030 ?? undefined, forecast2040: p.growth_2040 ?? undefined,
    } as RoadLinkFeature);
  }

  function onStationClick(feat: any) {
    const p    = feat.properties ?? {};
    const pred = predByLink.get(p.Link_ID ?? '');
    const aadt = pred?.aadt_predicted ?? 800;
    setSelFeature({
      type:         'atc-station',
      id:           p.TCS_NAME ?? String(p.TCS_NO ?? '?'),
      name:         p.TCS_NAME ?? 'Unknown Station',
      road:         p.Link_Name ?? undefined,
      region:       p.REGION ?? undefined,
      aadt,
      stationType:  'TIS',   // most stations in this GeoJSON are manual TIS
      lightPct:     pred ? 100 - (pred.heavy_vehicle_pct ?? 25) : 75,
      heavyPct:     pred?.heavy_vehicle_pct ?? 25,
      vehicleClasses: computeVehicleClasses(aadt),
      growthTrend:    computeGrowthTrend(aadt),
    } as AtcStationFeature);
  }

  const eatStr  = getEatTime(now);
  const dateStr = formatLongDate(now);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', background: '#0a0f1e',
        color: 'rgba(148,163,184,0.5)', fontSize: 13,
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}>
        Loading traffic data…
      </div>
    );
  }

  const MAIN_TABS = [
    { id: 'map'      as const, label: 'Traffic Map',        icon: <MapIcon size={13}/> },
    { id: 'counts'   as const, label: 'Counts & Analysis',  icon: <Table2 size={13}/> },
    { id: 'trends'   as const, label: 'Trends & Risk',      icon: <TrendingUp size={13}/> },
    { id: 'stations' as const, label: 'Station Directory',  icon: <BarChart3 size={13}/> },
    { id: 'roadsafety' as const, label: 'Road Safety',   icon: <AlertTriangle size={13}/> },
  ];
  const COUNTS_TABS = [
    { id: 'linxclass'       as const, label: 'Link × Class Table'       },
    { id: 'trafficanalytics'as const, label: 'Traffic Analytics'        },
    { id: 'trafficsummary'  as const, label: 'Traffic Tables'           },
    { id: 'proj2040'        as const, label: 'ADT 2016–2040 Projection' },
  ];
  const TRENDS_TABS = [
    { id: 'growthfactors' as const, label: 'Growth Factors'        },
    { id: 'seasonal'      as const, label: 'Seasonal MEF Factors'  },
    { id: 'overloading'   as const, label: 'Overloading & ESAL'    },
    { id: 'analytics'     as const, label: 'Network Analytics'     },
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
      background: '#0a0f1e', fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>

      {/* ══ CSS animations + custom marker styles ══════════════════════════════ */}
      <style>{`
        @keyframes ts-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        /* ── ATC pulse-ring animation ── */
        @keyframes tsRingPulse {
          0%   { transform: translate(-50%,-50%) scale(0.5); opacity: 0.85; }
          100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; }
        }
        /* ── LIVE badge blink ── */
        @keyframes liveBlink { 0%,100%{opacity:1} 50%{opacity:.25} }
        /* ── Timeline play glow ── */
        @keyframes playGlow { 0%,100%{box-shadow:0 0 12px rgba(0,255,136,.35)} 50%{box-shadow:0 0 22px rgba(0,255,136,.65)} }

        /* ── Pill filter buttons ── */
        .tpill {
          cursor:pointer; border-radius:6px; padding:3px 9px;
          font-size:9px; font-weight:700; border:1px solid;
          transition:all .15s; letter-spacing:.04em; background:transparent;
        }

        /* ── Road glow (applied via GeoJSON className) ── */
        .ts-road-glow { filter: drop-shadow(0 0 3px rgba(255,255,255,0.22)); }

        /* ── Custom marker icon wrapper (Leaflet strips default styles) ── */
        .ts-icon { background: transparent !important; border: none !important; }

        /* ── Station marker base ── */
        .ts-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
        .ts-dot  { border-radius: 50%; position: absolute; top: 50%; left: 50%;
                   transform: translate(-50%,-50%); z-index: 2; }

        /* ── ATC pulse rings ── */
        .ts-ring {
          position: absolute; top: 50%; left: 50%;
          width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid;
          transform: translate(-50%,-50%) scale(0.5); opacity: 0;
          animation: tsRingPulse 2.6s ease-out infinite; z-index: 1;
        }
        .ts-r2 { animation-delay: 1.3s; }

        /* ── Leaflet tooltip override ── */
        .leaflet-tooltip {
          background: rgba(10,15,30,0.96) !important;
          border: 1px solid rgba(0,195,255,0.2) !important;
          border-radius: 8px !important;
          padding: 4px 10px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
          color: #e2eaf4 !important;
          font-family: 'Inter','Segoe UI',sans-serif !important;
        }
        .leaflet-tooltip::before { display:none !important; }
      `}</style>

      {!import.meta.env.VITE_STANDALONE && <CrossLinkChipBar sectionId="traffic" />}

      {/* ══ BMS-style main tab bar ═════════════════════════════════════════════ */}
      <div style={{
        display: 'flex', gap: 2, padding: '0 14px', flexShrink: 0,
        borderBottom: '1px solid rgba(77,159,255,0.15)',
        background: 'rgba(4,9,18,0.85)',
      }}>
        {MAIN_TABS.map(t => {
          const isActive = t.id === activeTab;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px 11px', fontSize: 11, fontWeight: isActive ? 800 : 500,
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              color: isActive ? '#4d9fff' : 'rgba(148,163,184,0.70)',
              borderBottom: isActive ? '2px solid #4d9fff' : '2px solid transparent',
              transition: 'all 0.13s',
            }}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ══ Sub-tab bar - Counts & Analysis ══════════════════════════════════ */}
      {activeTab === 'counts' && (
        <div style={{
          display:'flex', gap:4, padding:'6px 14px 0', flexShrink:0,
          borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(4,9,18,0.6)',
        }}>
          {COUNTS_TABS.map(t => {
            const isA = t.id === countsTab;
            return (
              <button key={t.id} onClick={() => setCountsTab(t.id)} style={{
                display:'flex', alignItems:'center', gap:5,
                padding:'5px 12px 7px', fontSize:10, fontWeight: isA ? 700 : 500,
                background:'none', border:'none', cursor:'pointer',
                color: isA ? '#4d9fff' : 'rgba(148,163,184,0.65)',
                borderBottom: isA ? '2px solid #4d9fff' : '2px solid transparent',
                transition:'all 0.13s',
              }}>
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ══ Sub-tab bar - Trends & Risk ══════════════════════════════════════ */}
      {activeTab === 'trends' && (
        <div style={{
          display:'flex', gap:4, padding:'6px 14px 0', flexShrink:0,
          borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(4,9,18,0.6)',
        }}>
          {TRENDS_TABS.map(t => {
            const isA = t.id === trendsTab;
            return (
              <button key={t.id} onClick={() => setTrendsTab(t.id)} style={{
                display:'flex', alignItems:'center', gap:5,
                padding:'5px 12px 7px', fontSize:10, fontWeight: isA ? 700 : 500,
                background:'none', border:'none', cursor:'pointer',
                color: isA ? '#4d9fff' : 'rgba(148,163,184,0.65)',
                borderBottom: isA ? '2px solid #4d9fff' : '2px solid transparent',
                transition:'all 0.13s',
              }}>
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ══ Map tab content - sidebar + map ═══════════════════════════════════ */}
      {activeTab === 'dashboard' && <SectionDashboard sectionId="traffic" accent="#00f5ff" />}
                    {/* Traffic KPI tiles - map overview */}
      {activeTab === 'map' && !loading && kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, padding: '10px 14px', flexShrink: 0, background: 'rgba(4,9,18,0.75)', borderBottom: '1px solid rgba(0,245,255,0.08)' }}>
          <TrafficKpi label="Avg ADT" value={Math.round(kpis.avgAadt).toLocaleString()} unit="veh/day" color="#00f5ff" />
          <TrafficKpi label="Monitored Links" value={String(features.length)} unit="links" color="#4d9fff" />
          <TrafficKpi label="ATC Stations" value={String(stations.length || 10)} unit="active" color="#b967ff" />
          <TrafficKpi label="Proj Growth 2040" value={`+${kpis.growthRatio.toFixed(0)}`} unit="%" color="#00ff88" />
          <TrafficKpi label="Daily Volume" value={Math.round(kpis.totalAdt/1000).toLocaleString()} unit="K veh/day" color="#ffd23f" />
          <TrafficKpi label="Paved Monitored" value={kpis.pavingIndex.toFixed(0)} unit="%" color="#00d4aa" />
        </div>
      )}
{activeTab === 'map' &&
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

      {/* ══ RIGHT - CONTROLS + MAP + TIMELINE ════════════════════════════════ */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Controls bar */}
        <div style={{
          height: 50, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 14px',
          background: 'rgba(10,15,30,0.95)',
          borderBottom: '1px solid rgba(99,102,241,0.1)',
        }}>
          {/* Symbology */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              fontSize: 8, fontWeight: 800, color: 'rgba(148,163,184,0.45)',
              textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap',
            }}>Symbology</span>
            <select value={mode} onChange={e => setMode(e.target.value as MapMode)}
              style={{
                background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.28)',
                borderRadius: 7, color: C.cyan, fontSize: 11, fontWeight: 700,
                padding: '3px 8px', cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
              }}>
              <option value="adt">Traffic Delay (ADT)</option>
              <option value="surface">Surface Type</option>
              <option value="class">Road Class</option>
            </select>
          </div>

          <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

          {/* Surface pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              fontSize: 8, fontWeight: 800, color: 'rgba(148,163,184,0.4)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>Surface</span>
            {(['all','paved','unsealed'] as SurfFilter[]).map(sf => (
              <button key={sf} className="tpill" onClick={() => setSurfFilter(sf)}
                style={{
                  borderColor: surfFilter === sf ? 'rgba(0,245,255,0.4)' : 'rgba(255,255,255,0.1)',
                  color: surfFilter === sf ? C.cyan : 'rgba(148,163,184,0.5)',
                  background: surfFilter === sf ? 'rgba(0,245,255,0.1)' : 'transparent',
                }}>
                {sf === 'all' ? 'All' : sf === 'paved' ? 'Paved' : 'Unsealed'}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

          {/* Class pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              fontSize: 8, fontWeight: 800, color: 'rgba(148,163,184,0.4)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>Class</span>
            {(['all','A','B','C','M'] as ClassFilter[]).map(cf => {
              const col    = cf === 'all' ? '#94a3b8' : CLASS_COLORS[cf] ?? '#94a3b8';
              const active = classFilter === cf;
              return (
                <button key={cf} className="tpill" onClick={() => setClassFilter(cf)}
                  style={{
                    borderColor: active ? `rgba(${hexRgb(col)},0.45)` : 'rgba(255,255,255,0.1)',
                    color: active ? col : 'rgba(148,163,184,0.5)',
                    background: active ? `rgba(${hexRgb(col)},0.1)` : 'transparent',
                  }}>
                  {cf === 'all' ? 'All' : `Class ${cf}`}
                </button>
              );
            })}
          </div>

          {/* Legend – right */}
          <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <MapLegend mode={mode} />
          </div>
        </div>

        {activeTab === 'map' && <>
        {/* Map + detail pane - definitive flex-row layout: map fills space, pane is fixed-right sibling */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden', alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
          <MapContainer center={[1.37, 32.3]} zoom={7} zoomControl={false}
            style={{ height: '100%', width: '100%', background: '#0a0f1e' }}>
            <TileLayer url={ESRI_TILE_URLS.imagery}   attribution={ESRI_ATTRIBUTIONS.imagery} />
            <TileLayer url={ESRI_TILE_URLS.labels}    attribution={ESRI_ATTRIBUTIONS.labels} opacity={0.7} />
            <InfraLayers />
            <MapOverlayLegend title="Traffic Volume" items={LEGEND_TRAFFIC} />
            <ZoomControl position="bottomright" />

            {filteredFeatures.length > 0 && (
              <TrafficLayer features={filteredFeatures} mode={mode}
                year={timelineYear} surfMap={surfMap} onSelect={onLinkClick} />
            )}

            {/* TIS manual station markers */}
            {stations.map((feat, i) => {
              const [lng, lat] = feat.geometry?.coordinates ?? [0, 0];
              if (!lat || !lng) return null;
              const p   = feat.properties ?? {};
              const col = REGION_CLR[p.REGION ?? ''] ?? '#94a3b8';
              const icon = makeStationIcon(col, false);
              return (
                <Marker key={`tis-${i}`} position={[lat, lng]} icon={icon}
                  eventHandlers={{ click: () => onStationClick(feat) }}>
                  <LeafletTooltip>
                    <div style={{ fontSize: 10, fontWeight: 700 }}>
                      <div style={{ color: col }}>{p.TCS_NAME}</div>
                      <div style={{ color: 'rgba(226,234,244,0.7)', fontWeight: 400 }}>{p.Link_Name}</div>
                      <div style={{ color: 'rgba(148,163,184,0.45)', fontSize: 9 }}>
                        {p.REGION} · TIS
                      </div>
                    </div>
                  </LeafletTooltip>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Year badge */}
          {timelineYear !== 2025 && (
            <div style={{
              position: 'absolute', top: 12, left: 12, zIndex: 900,
              background: 'rgba(10,15,30,0.92)',
              border: '1px solid rgba(255,210,63,0.35)',
              borderRadius: 10, padding: '5px 12px', backdropFilter: 'blur(12px)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: C.yellow }}>YEAR {timelineYear}</span>
              <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.45)', marginLeft: 6 }}>
                ×{(GROWTH_FACTORS[timelineYear] ?? 1).toFixed(2)} vs 2016 base year
              </span>
            </div>
          )}

          {/* Click hint */}
          <div style={{
            position: 'absolute', bottom: 8, left: 12, zIndex: 900,
            fontSize: 9, color: 'rgba(148,163,184,0.28)', pointerEvents: 'none',
          }}>
            Click a road link or station marker to inspect
          </div>

        </div>

        {/* Feature analytics pane - flex:0 sibling to the RIGHT of the map */}
        {selFeature && (
          <FeatureAnalyticsPanel feature={selFeature}
            onClose={() => setSelFeature(null)} width={340} />
        )}
        </div>{/* closes map+pane flex row */}

        {/* Timeline bar */}
        <div style={{
          height: 54, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 16px',
          background: 'rgba(10,15,30,0.95)',
          borderTop: '1px solid rgba(99,102,241,0.1)',
        }}>
          {/* Date + EAT */}
          <div style={{ flexShrink: 0, minWidth: 180 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.teal }}>{dateStr}</div>
            <div style={{
              fontSize: 9, color: 'rgba(148,163,184,0.45)',
              display: 'flex', alignItems: 'center', gap: 4, marginTop: 1,
            }}>
              <Clock size={9} /> {eatStr} EAT (UTC+3)
            </div>
          </div>

          <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

          {/* LIVE badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 8px', borderRadius: 6,
            background: 'rgba(0,255,136,0.08)',
            border: '1px solid rgba(0,255,136,0.2)',
            flexShrink: 0,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#00ff88',
              boxShadow: '0 0 8px #00ff88',
              display: 'inline-block',
              animation: 'liveBlink 1.8s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 8, fontWeight: 900, color: '#00ff88', letterSpacing: '0.1em' }}>
              LIVE
            </span>
          </div>

          <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

          {/* Play / Pause */}
          <button
            onClick={() => {
              if (timelineYear >= 2035) { setTimelineYear(2016); setIsPlaying(true); }
              else setIsPlaying(p => !p);
            }}
            style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: isPlaying ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.08)',
              color: isPlaying ? C.green : 'rgba(148,163,184,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              animation: isPlaying ? 'playGlow 2s ease-in-out infinite' : 'none',
              transition: 'all .2s',
            }}>
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>

          {/* Year label */}
          <div style={{ fontSize: 13, fontWeight: 900, color: C.yellow, flexShrink: 0, minWidth: 40 }}>
            {timelineYear}
          </div>

          {/* Slider */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <input type="range" min={2016} max={2035} value={timelineYear}
              onChange={e => { setTimelineYear(Number(e.target.value)); setIsPlaying(false); }}
              style={{ width: '100%', accentColor: C.yellow, cursor: 'pointer' }} />
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 8, color: 'rgba(148,163,184,0.32)',
            }}>
              <span>2016</span><span>2020</span><span>2025</span><span>2030</span><span>2035</span>
            </div>
          </div>

          {/* ADT gradient legend */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{
              width: 90, height: 6, borderRadius: 3,
              background: 'linear-gradient(90deg,#00ff88,#ffd23f,#ff6b35,#ff2d78)',
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', width: 90 }}>
              <span style={{ fontSize: 7, color: 'rgba(0,255,136,0.6)' }}>Low</span>
              <span style={{ fontSize: 7, color: 'rgba(148,163,184,0.3)' }}>← ADT →</span>
              <span style={{ fontSize: 7, color: 'rgba(255,45,120,0.6)' }}>High</span>
            </div>
          </div>
        </div>
        </>}
      </div>{/* closes RIGHT flex-col */}
      </div>}{/* closes map tab: flex-row + {activeTab === 'map' && ... } */}

      {/* ══ Counts & Analysis tab ═════════════════════════════════════════════ */}
      {activeTab === 'counts' && (
        <div style={{ flex:1, minHeight:0, position:'relative' }}>
          <Suspense fallback={<TabSpinner/>}>
            {countsTab === 'linxclass'        && <LinkClassTable features={features} surfMap={surfMap} />}
            {countsTab === 'trafficanalytics' && <TrafficAnalyticsView />}
            {countsTab === 'trafficsummary'   && <TrafficSummaryView />}
            {countsTab === 'proj2040'         && <Suspense fallback={<TabSpinner/>}><TrafficProjectionView /></Suspense>}
          </Suspense>
        </div>
      )}

      {/* ══ Trends & Risk tab ════════════════════════════════════════════════ */}
      {activeTab === 'trends' && (
        <div style={{ flex:1, minHeight:0, display:'flex', overflow:'hidden' }}>
      {/* ══ LEFT SIDEBAR - KPIs ════════════════════════════════════════════════ */}
      <div style={{
        width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8,
        padding: '10px 10px 14px',
        background: 'rgba(10,15,30,0.92)',
        borderRight: '1px solid rgba(99,102,241,0.1)',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '4px 2px 2px' }}>
          <div style={{
            fontSize: 8, fontWeight: 800, color: 'rgba(0,212,170,0.55)',
            letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 2,
          }}>Uganda National Roads · Department of National Roads</div>
          <div style={{
            fontSize: 14, fontWeight: 900, color: C.teal, lineHeight: 1.2,
            textShadow: `0 0 18px rgba(0,212,170,0.45)`,
          }}>National Traffic Prediction</div>
          <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', marginTop: 3, lineHeight: 1.5 }}>
            Multiparametric Network Diagnostics
            <br /><span style={{ color: 'rgba(0,212,170,0.65)' }}>{dateStr}</span>
          </div>
          <div style={{
            marginTop: 8, height: 1,
            background: 'linear-gradient(90deg,transparent,rgba(0,212,170,0.28),transparent)',
          }} />
        </div>

        {/* KPI 1 – Total Network ADT */}
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(0,245,255,0.14)' }}>
          <div style={{
            fontSize: 8, fontWeight: 700, color: 'rgba(0,245,255,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2,
          }}>Total Network ADT</div>
          <div style={{
            fontSize: 26, fontWeight: 900, color: C.cyan, lineHeight: 1,
            textShadow: `0 0 22px rgba(0,245,255,0.4)`,
          }}>
            {kpis ? `${Math.round(kpis.totalAdt / 1000)}k` : '-'}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.42)', marginTop: 3 }}>
            vehicles / day · {features.length} survey nodes
          </div>
        </div>

        {/* KPI 2 – Network Growth Ratio */}
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(0,255,136,0.14)' }}>
          <div style={{
            fontSize: 8, fontWeight: 700, color: 'rgba(0,255,136,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2,
          }}>Network Growth Ratio 2025 → 2040</div>
          <div style={{
            fontSize: 26, fontWeight: 900, color: C.green, lineHeight: 1,
            textShadow: `0 0 22px rgba(0,255,136,0.4)`,
          }}>
            {kpis ? `+${kpis.growthRatio.toFixed(0)}%` : '-'}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.42)', marginTop: 3 }}>
            ML-modelled forecast to 2040
          </div>
        </div>

        {/* KPI 3 – Sparkline trajectory */}
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(0,212,170,0.12)' }}>
          <div style={{
            fontSize: 8, fontWeight: 700, color: 'rgba(0,212,170,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
          }}>Network Trajectory Envelope (2016 – Now)</div>
          {kpis && <SparklineArea avgAadt={kpis.avgAadt} />}
        </div>

        {/* KPI 4 – ATC Stations split */}
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(0,195,255,0.14)' }}>
          <div style={{
            fontSize: 7, fontWeight: 700, color: 'rgba(0,195,255,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
          }}>ATC Station Network</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.atcCyan, lineHeight: 1 }}>
                {ATC_TOTAL}
              </div>
              <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', marginTop: 1 }}>
                ATC stations total
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: C.atcCyan, fontWeight: 700 }}>
                <Wifi size={9} style={{ display: 'inline', marginRight: 3 }} />
                {ATC_LEGACY_COUNT} legacy (2016–22)
              </div>
              <div style={{ fontSize: 10, color: '#00ea90', fontWeight: 700, marginTop: 2 }}>
                <Wifi size={9} style={{ display: 'inline', marginRight: 3 }} />
                {ATC_NEW_COUNT} new (2025+)
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: 'rgba(0,195,255,0.1)', margin: '6px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Radio size={10} style={{ color: C.tisCyan, flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: 18, fontWeight: 900, color: C.tisCyan, lineHeight: 1 }}>
                {stations.length || 298}
              </span>
              <span style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', marginLeft: 5 }}>
                manual TIS stations
              </span>
            </div>
          </div>
        </div>

        {/* KPI 5 – Survey Nodes */}
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(77,159,255,0.14)' }}>
          <div style={{
            fontSize: 7, fontWeight: 700, color: 'rgba(77,159,255,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2,
          }}>Total Survey Nodes</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.blue, lineHeight: 1 }}>
            {features.length}
          </div>
          <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', marginTop: 2 }}>road links monitored</div>
        </div>

        {/* KPI 6 – Surface Paving Index */}
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(185,103,255,0.14)' }}>
          <div style={{
            fontSize: 8, fontWeight: 700, color: 'rgba(185,103,255,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4,
          }}>Surface Paving Index</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.purple, lineHeight: 1 }}>
              {kpis ? `${kpis.pavingIndex.toFixed(0)}%` : '-'}
            </div>
            <div style={{
              flex: 1, height: 7, background: 'rgba(185,103,255,0.1)',
              borderRadius: 4, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${kpis?.pavingIndex ?? 0}%`,
                background: 'linear-gradient(90deg,#b967ff,#00d4aa)', borderRadius: 4,
              }} />
            </div>
          </div>
          <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.42)', marginTop: 3 }}>
            links with Bituminous / Asphalt surface
          </div>
        </div>

        {/* KPI 7 – Class Node Spread */}
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(148,163,184,0.08)' }}>
          <div style={{
            fontSize: 8, fontWeight: 700, color: 'rgba(148,163,184,0.4)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
          }}>Class Node Spread</div>
          {kpis && <ClassSpreadBars counts={kpis.classCounts} />}
        </div>
      </div>


        <div style={{ flex:1, minHeight:0, overflowY:'auto' }}>
          <Suspense fallback={<TabSpinner/>}>
            {trendsTab === 'growthfactors' && <GrowthFactorsView />}
            {trendsTab === 'seasonal'      && <Suspense fallback={<TabSpinner/>}><SeasonalFactorsView /></Suspense>}
            {trendsTab === 'overloading'   && <OverloadingView />}
            {trendsTab === 'analytics'     && (
              <div style={{ flex: 1, overflowY: 'auto', background: '#0a0f1e', padding: '14px 18px' }}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#e2eaf4' }}>Traffic Analytics - National Network</div>
                  <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)', marginTop: 2 }}>
                    AADT trends 2016–2025 · vehicle class composition · regional distribution · TIS / ATC data
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Network AADT (avg)', value: kpis ? `${Math.round(kpis.avgAadt).toLocaleString()}` : '-', color: '#00f5ff', sub: 'vehicles / day / link' },
                    { label: 'Survey Nodes', value: features.length.toLocaleString(), color: '#00d4aa', sub: 'links with TIS count' },
                    { label: 'TIS Stations', value: tcsStations.length.toString(), color: '#ffd23f', sub: 'manual + ATC' },
                    { label: 'Growth 2025→2040', value: kpis ? `+${kpis.growthRatio.toFixed(0)}%` : '-', color: '#00ff88', sub: 'ML forecast' },
                  ].map(k => (
                    <div key={k.label} style={{ background:'rgba(8,14,28,0.55)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px' }}>
                      <div style={{ fontSize:8, fontWeight:700, color:'rgba(148,163,184,0.45)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>{k.label}</div>
                      <div style={{ fontSize:22, fontWeight:900, color:k.color, lineHeight:1 }}>{k.value}</div>
                      <div style={{ fontSize:8, color:'rgba(148,163,184,0.4)', marginTop:3 }}>{k.sub}</div>
                    </div>
                  ))}
                </div>
                {/* Vehicle class bar chart - all 9 classes with fleet % and ADT breakdown */}
                {kpis && <VehicleClassChart avgAadt={kpis.avgAadt} />}
                <div style={{ background:'rgba(8,14,28,0.55)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontSize:11, fontWeight:800, color:'#e2eaf4' }}>Network AADT Growth Index 2016–2025</div>
                    <SourceTableButton anchor="tbl-008" />
                  </div>
                  {kpis && <SparklineArea avgAadt={kpis.avgAadt} />}
                </div>
              </div>
            )}
          </Suspense>
        </div>
        </div>
      )}

      {/* ══ Stations tab ══════════════════════════════════════════════════════ */}
      {activeTab === 'stations' && (
        <div style={{ flex: 1, overflowY: 'auto', background: '#0a0f1e', padding: '14px 18px' }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#e2eaf4' }}>
                TIS / ATC Station Directory
              </div>
              <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)', marginTop: 2 }}>
                {tcsStations.length} monitoring stations · TIS manual counts + {ATC_TOTAL} ATC permanent counters · source: TIS 2025 AADT analysis
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 9, borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
                    {['TCS No.','Station Name','Road No.','Link ID','Link Name','Station','Region','Surface'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tcsStations.map((s, i) => (
                    <tr key={s.tcs_no ?? i} style={{
                      borderBottom: '1px solid rgba(148,163,184,0.04)',
                      background: i % 2 === 0 ? 'rgba(15,23,42,0.3)' : 'transparent',
                    }}>
                      <td style={{ padding: '5px 10px', color: C.yellow, fontFamily: 'monospace', fontSize: 8, whiteSpace: 'nowrap' }}>{s.tcs_no}</td>
                      <td style={{ padding: '5px 10px', color: '#e2eaf4', fontWeight: 600 }}>{s.tcs_name ?? '-'}</td>
                      <td style={{ padding: '5px 10px', color: '#94a3b8', fontFamily: 'monospace' }}>{s.road_no ?? '-'}</td>
                      <td style={{ padding: '5px 10px', color: C.teal, fontFamily: 'monospace', fontSize: 8 }}>{s.link_id ?? '-'}</td>
                      <td style={{ padding: '5px 10px', color: '#64748b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.link_name ?? '-'}</td>
                      <td style={{ padding: '5px 10px', color: '#94a3b8' }}>{s.station ?? '-'}</td>
                      <td style={{ padding: '5px 10px' }}>
                        <span style={{ color: REGION_CLR[s.region ?? ''] ?? '#94a3b8' }}>{s.region ?? '-'}</span>
                      </td>
                      <td style={{ padding: '5px 10px' }}>
                        <span style={{ color: s.surface === 'Bituminous' ? C.cyan : C.amber, fontWeight: 600 }}>
                          {s.surface === 'Bituminous' ? 'Paved' : s.surface ?? '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 10, fontSize: 9, color: 'rgba(148,163,184,0.3)' }}>
              Source: TIS 2025 AADT analysis.xlsx · TCS_Combined sheet · real Link IDs from network2026.geojson
            </div>
          </div>
        )}
      {activeTab === 'roadsafety' && <RoadSafetyTab />}

    </div>
  );
}
