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
 *   • Corrected station counts: 25 ATC (15 legacy + 10 new) + 298 TIS
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  MapContainer, TileLayer, GeoJSON,
  Marker, Tooltip as LeafletTooltip,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { lazy, Suspense } from 'react';
import { Clock, Play, Pause, Radio, Wifi, BarChart3, Map as MapIcon, Table2, TrendingUp , LayoutDashboard, ShieldAlert } from 'lucide-react';
import { useTCSStations } from '../../data/networkDB';

// Sub-module lazy loads (previously separate sidebar items)
const TrafficAnalyticsView     = lazy(() => import('../../components/sections/TrafficAnalytics'));
const TrafficSummaryView       = lazy(() => import('../../components/sections/TrafficSummary'));
const GrowthFactorsView        = lazy(() => import('./GrowthFactorsPanel'));
const OverloadingView          = lazy(() => import('./OverloadingSection'));
const TrafficProjectionView    = lazy(() => import('./TrafficProjectionTable'));
const SeasonalFactorsView      = lazy(() => import('./SeasonalFactorsTable'));
const SectionDashboard = lazy(() => import('../Dashboard/SectionDashboard'));
const RoadSafetyDashboard = lazy(() => import('./RoadSafetyDashboard'));

function TabSpinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{ width:24, height:24, borderRadius:'50%', border:'2px solid rgba(100, 210, 255,0.15)',
        borderTopColor:'#64d2ff', animation:'ts-spin .8s linear infinite' }}/>
    </div>
  );
}
import { hexRgb } from '../../lib/chart3d';
import FeatureAnalyticsPanel from '../../shared/FeatureAnalyticsPanel';
import type { FeatureData, RoadLinkFeature, AtcStationFeature } from '../../shared/FeatureAnalyticsPanel';
import { ROAD_STYLES, ESRI_TILE_URLS, ESRI_ATTRIBUTIONS } from '../../shared/mapSymbols';
import { MapLegend as MapOverlayLegend, LEGEND_TRAFFIC } from '../../shared/MapLegend';
import MapGISControls, { UGANDA_BOUNDS } from '../../shared/MapGISControls';
import SourceTableButton from '../../shared/SourceTableButton';
import CrossLinkChipBar from '../../shared/CrossLinkChipBar';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';
import { RoadClassPill, AadtHeatCell } from '../../shared/tableFormatting';
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
  cyan:   '#64d2ff', green:  '#30d158', orange: '#ff9f0a', purple: '#bf5af2',
  yellow: '#ffd60a', pink:   '#ff375f', blue:   '#0a84ff', teal:   '#00d4aa',
  amber:  '#f59e0b', indigo: '#6366f1', atcCyan: '#00c3ff', tisCyan: '#ffcc33',
};

// ─── Station network constants (corrected figures) ────────────────────────────
const ATC_LEGACY_COUNT = 15;   // 2016–2022 sites
const ATC_NEW_COUNT    = 10;   // post-2025 new sites
const ATC_TOTAL        = ATC_LEGACY_COUNT + ATC_NEW_COUNT;  // 25
// TIS manual stations come from atc_stations.geojson (298 features)

// ─── Uganda road growth index - BASE YEAR 2016 = 1.00 (all traffic statistics
// are anchored to the 2016 base year). Recomputed as (1+r)^(year-2016) using
// BLENDED_GROWTH_RATE (r=3.2% p.a., shared/trafficProjection.ts) - the same rate driving
// AADT nowcasting in shared/liveEngine.ts. The prior hand-typed series implied ~4.9% CAGR
// by 2035, diverging from the live engine's 3.2% by ~30% cumulative; now reconciled.
const GROWTH_FACTORS: Record<number, number> = {
  2016: 1.00, 2017: 1.03, 2018: 1.07, 2019: 1.10, 2020: 1.13, 2021: 1.17,
  2022: 1.21, 2023: 1.25, 2024: 1.29, 2025: 1.33, 2026: 1.37, 2027: 1.41,
  2028: 1.46, 2029: 1.51, 2030: 1.55, 2031: 1.60, 2032: 1.66, 2033: 1.71,
  2034: 1.76, 2035: 1.82,
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

// Legacy shape kept for existing UI code (label + pct)
const VC_CLASSES = SHARED_VC_CLASSES.map(c => ({ label: c.label, pct: c.share }));

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
  Northern: C.purple, Western: C.green, Southern: C.yellow, 'West Nile': C.indigo,
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
        stroke="rgba(255, 214, 10,0.25)" strokeDasharray="2 2" />
      <text x={xp(4).toFixed(1)} y={PT+6} fill="rgba(255, 214, 10,0.5)" fontSize={6} textAnchor="middle">COVID</text>
      <path d={areaD} fill="url(#spkG)" />
      <polyline points={pts.join(' ')} fill="none" stroke={C.teal} strokeWidth={1.8}
        strokeLinejoin="round" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 3px ${C.teal}88)` }} />
      <circle cx={xp(4).toFixed(1)} cy={yp(values[4]).toFixed(1)} r={2.5} fill={C.yellow} />
      <circle cx={xp(9).toFixed(1)} cy={yp(values[9]).toFixed(1)} r={2.5} fill={C.teal} />
      <text x={xp(0)}  y={H-2} fill="rgba(148,163,184,0.4)"  fontSize={7} textAnchor="middle">2016</text>
      <text x={xp(4)}  y={H-2} fill="rgba(255, 214, 10,0.45)"  fontSize={7} textAnchor="middle">2020</text>
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

// ─── Link × Class table ────────────────────────────────────────────────────────
interface LinkClassRow {
  link_id: string; link_name: string; road_class: string; region: string;
  length_km: number | null; base_year: number; aadt2016: number; growthPct: number;
  vc0: number; vc1: number; vc2: number; vc3: number; vc4: number; vc5: number; vc6: number; vc7: number; vc8: number;
  adtNow: number;
}

function LinkClassTable({ features, surfMap: _surfMap }: { features: PredFeature[]; surfMap: Record<string, string> }) {
  // BASE YEAR 2016 - all traffic statistics are anchored to 2016. The TIS
  // readings (2025 survey) are back-cast to 2016 per vehicle class, then
  // projected to the CURRENT INSTANT (fractional year, ticking every second).
  const BASE_YEAR = 2016;
  const TIS_YEAR  = 2025;   // survey year of the raw TIS AADT readings
  const nowT = useNowTick(1000);
  const VCOLS = [
    { label: 'Motorcycles',         short: 'Moto',  color: '#bf5af2', idx: 0, key: 'vc0' as const },
    { label: 'Saloon Cars & Taxis', short: 'Cars',  color: '#64d2ff', idx: 1, key: 'vc1' as const },
    { label: 'Light Goods',         short: 'LGV',   color: '#30d158', idx: 2, key: 'vc2' as const },
    { label: 'Small Buses',         short: 'S.Bus', color: '#ffd60a', idx: 3, key: 'vc3' as const },
    { label: 'Medium Buses',        short: 'M.Bus', color: '#ff8c00', idx: 4, key: 'vc4' as const },
    { label: 'Large Buses',         short: 'L.Bus', color: '#ff9f0a', idx: 5, key: 'vc5' as const },
    { label: 'Light Trucks',        short: 'L.Trk', color: '#00d4aa', idx: 6, key: 'vc6' as const },
    { label: 'Heavy Trucks',        short: 'H.Trk', color: '#ff375f', idx: 7, key: 'vc7' as const },
    { label: 'Truck Trailers',      short: 'Artic', color: '#f59e0b', idx: 8, key: 'vc8' as const },
  ];

  const rows: LinkClassRow[] = useMemo(() => features.map(f => {
    const p = f.properties;
    const baseAadt = p.aadt_predicted ?? 0;   // raw TIS reading (2025)
    const projections = projectAllClasses(baseAadt, TIS_YEAR, nowT);
    // deflate each class to the 2016 base year for the base column
    const aadt2016 = Math.round(projections.reduce(
      (s, c) => s + c.baseCount / Math.pow(1 + c.growth, TIS_YEAR - BASE_YEAR), 0));
    const projAadt = projections.reduce((s, c) => s + c.projCount, 0);
    // Blended growth (weighted by share) from the 2016 base to now
    const blendedGrowthPct = projections.reduce(
      (s, c) => s + c.share * (Math.pow(1 + c.growth, nowT - BASE_YEAR) - 1),
      0,
    ) * 100;
    return {
      link_id: p.link_id, link_name: p.link_name ?? '-', road_class: p.road_class ?? '-',
      region: p.region ?? '-', length_km: p.length_km, base_year: BASE_YEAR,
      aadt2016, growthPct: blendedGrowthPct,
      vc0: projections[0].projCount, vc1: projections[1].projCount, vc2: projections[2].projCount,
      vc3: projections[3].projCount, vc4: projections[4].projCount, vc5: projections[5].projCount,
      vc6: projections[6].projCount, vc7: projections[7].projCount, vc8: projections[8].projCount,
      adtNow: projAadt,
    };
  }), [features, nowT]);

  const networkTotal = useMemo(() => rows.reduce((s, r) => s + r.adtNow, 0), [rows]);
  const networkLengthKm = useMemo(() => rows.reduce((s, r) => s + (r.length_km ?? 0), 0), [rows]);

  const columns: STColumn<LinkClassRow>[] = useMemo(() => [
    { key: 'link_id', label: 'Link ID', render: r => <span style={{ color: C.teal, fontFamily: 'monospace', fontWeight: 700 }}>{r.link_id}</span> },
    { key: 'link_name', label: 'Link Name' },
    { key: 'road_class', label: 'Cls', render: r => <RoadClassPill cls={r.road_class} /> },
    { key: 'region', label: 'Region' },
    {
      key: 'length_km', label: 'Length (km)', numeric: true, total: 'sum',
      render: r => r.length_km != null ? `${r.length_km.toFixed(1)} km` : '-',
    },
    {
      key: 'base_year', label: 'Base Yr', numeric: true,
      comment: 'Base year for all traffic statistics (2016).',
    },
    {
      key: 'aadt2016', label: 'AADT 2016', numeric: true,
      comment: 'AADT at the 2016 base year (TIS reading back-cast per class).',
      render: r => <AadtHeatCell value={r.aadt2016} />,
    },
    {
      key: 'growthPct', label: 'Growth %', numeric: true,
      comment: 'Blended class-weighted growth p.a.',
      render: r => <span style={{ color: '#fbbf24', fontWeight: 700 }}>+{r.growthPct.toFixed(1)}%</span>,
    },
    ...VCOLS.map(vc => ({
      key: vc.key, label: vc.short, numeric: true, total: 'sum' as const,
      comment: `${vc.label} - now-cast to the current instant.`,
      render: (r: LinkClassRow) => <span style={{ color: vc.color }}>{r[vc.key].toLocaleString()}</span>,
    })),
    {
      key: 'adtNow', label: 'ADT Now', numeric: true, total: 'sum',
      comment: 'AADT now-cast to the current instant.',
      render: r => <span style={{ color: C.teal, fontWeight: 800 }}>{r.adtNow.toLocaleString()}</span>,
    },
  ], []);

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', background: '#0a0f1e', padding: '14px 18px' }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#e2eaf4' }}>
            Traffic by Road Link × Vehicle Class - Now-cast to the Current Instant
          </div>
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)', marginTop: 3 }}>
            Base year {BASE_YEAR} · TIS {TIS_YEAR} readings back-cast to {BASE_YEAR} per class · compound growth applied · {features.length} links · network length {networkLengthKm.toFixed(0)} km · click a column to sort
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#30d158', marginTop: 3 }}>
            <span className="animate-pulse" style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:'#30d158', marginRight:5 }} />
            LIVE - projected to {new Date().toLocaleString('en-GB')} (reporting instant {nowT.toFixed(7)})
          </div>
        </div>
        <SourceTableButton anchor="tbl-010" />
      </div>

      <div style={{
        marginBottom: 10, padding: '9px 14px', borderRadius: 8,
        background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.18)',
        display: 'flex', alignItems: 'center', gap: 10, fontSize: 10.5,
      }}>
        <span style={{ color: C.teal, fontWeight: 800 }}>Network Total (now-cast): {networkTotal.toLocaleString()} vehicles/day</span>
        <span style={{ color: 'rgba(148,163,184,0.5)' }}>across {rows.length.toLocaleString()} links · {networkLengthKm.toFixed(0)} km total network length</span>
      </div>

      <SortableFilterableTable
        columns={columns}
        rows={rows}
        accent={C.teal}
        exportName="traffic-link-by-class"
        initialSort="adtNow"
        emptyText="No traffic prediction data available."
      />

      <div style={{ marginTop: 8, fontSize: 9, color: 'rgba(148,163,184,0.4)', lineHeight: 1.6 }}>
        <b style={{ color: '#94a3b8' }}>Method:</b> per-class compound growth - projected = base × (1+g)^(years).
        {/* Rates below reconciled to UGANDA_FLEET.growthRate (shared/trafficProjection.ts) -
            the values actually powering the (1+g)^(years) projection above; this caption
            previously listed a stale 10-class breakdown that didn't match the code it
            was describing (SHARED_VC_CLASSES uses UGANDA_FLEET's 9-class scheme). */}
        Class growth (p.a.): Motorcycles 4.5% · Cars/Taxis 3.2% · Minibus 2.8% · Bus 2.0% · Light Trucks 3.5% · Medium Trucks 3.0% · Heavy Trucks 2.5% · Articulated Trucks 2.2% · Other/NMT 1.0%.
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function TrafficLegacyContent({ initialTab, hideTabBar }: { initialTab?: 'dashboard' | 'map' | 'counts' | 'trends' | 'stations' | 'roadsafety'; hideTabBar?: boolean } = {}) {
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
  const [activeTab,    setActiveTab]    = useState<'dashboard' | 'map' | 'counts' | 'trends' | 'stations' | 'roadsafety'>(initialTab || 'dashboard');
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
    { id: 'dashboard' as const, label: 'Dashboard', icon: <LayoutDashboard size={13}/> },
  { id: 'map'      as const, label: 'Traffic Map',        icon: <MapIcon size={13}/> },
    { id: 'counts'   as const, label: 'Counts & Analysis',  icon: <Table2 size={13}/> },
    { id: 'trends'   as const, label: 'Trends & Risk',      icon: <TrendingUp size={13}/> },
    { id: 'stations' as const, label: 'Station Directory',  icon: <BarChart3 size={13}/> },
    { id: 'roadsafety' as const, label: 'Road Safety',     icon: <ShieldAlert size={13}/> },
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
        @keyframes playGlow { 0%,100%{box-shadow:0 0 12px rgba(48, 209, 88,.35)} 50%{box-shadow:0 0 22px rgba(48, 209, 88,.65)} }

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
      {!hideTabBar && (
        <div style={{
        display: 'flex', gap: 2, padding: '0 14px', flexShrink: 0,
        borderBottom: '1px solid rgba(10, 132, 255,0.15)',
        background: 'rgba(8,8,8,0.85)',
      }}>
        {MAIN_TABS.map(t => {
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
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
      )}

      {/* ══ Sub-tab bar - Counts & Analysis ══════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <Suspense fallback={<div style={{padding:'1.5rem',color:'#64d2ff',textAlign:'center',opacity:0.7,fontSize:'12px'}}>Loading dashboard…</div>}>
            <SectionDashboard sectionId="traffic" accent="#64d2ff" />
          </Suspense>
        )}
      {activeTab === 'counts' && (
        <div style={{
          display:'flex', gap:4, padding:'6px 14px 0', flexShrink:0,
          borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(8,8,8,0.6)',
        }}>
          {COUNTS_TABS.map(t => {
            const isA = t.id === countsTab;
            return (
              <button key={t.id} onClick={() => setCountsTab(t.id)} style={{
                display:'flex', alignItems:'center', gap:5,
                padding:'5px 12px 7px', fontSize:10, fontWeight: isA ? 700 : 500,
                background:'none', border:'none', cursor:'pointer',
                color: isA ? '#0a84ff' : 'rgba(148,163,184,0.65)',
                borderBottom: isA ? '2px solid #0a84ff' : '2px solid transparent',
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
          borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(8,8,8,0.6)',
        }}>
          {TRENDS_TABS.map(t => {
            const isA = t.id === trendsTab;
            return (
              <button key={t.id} onClick={() => setTrendsTab(t.id)} style={{
                display:'flex', alignItems:'center', gap:5,
                padding:'5px 12px 7px', fontSize:10, fontWeight: isA ? 700 : 500,
                background:'none', border:'none', cursor:'pointer',
                color: isA ? '#0a84ff' : 'rgba(148,163,184,0.65)',
                borderBottom: isA ? '2px solid #0a84ff' : '2px solid transparent',
                transition:'all 0.13s',
              }}>
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ══ Map tab content - sidebar + map ═══════════════════════════════════ */}
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
            <SearchableSelect value={mode} onChange={v => setMode(v as MapMode)}
              style={{
                background: 'rgba(100, 210, 255,0.08)', border: '1px solid rgba(100, 210, 255,0.28)',
                borderRadius: 7, color: C.cyan, fontSize: 11, fontWeight: 700,
                padding: '3px 8px', cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
              }}>
              <option value="adt">Traffic Delay (ADT)</option>
              <option value="surface">Surface Type</option>
              <option value="class">Road Class</option>
            </SearchableSelect>
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
                  borderColor: surfFilter === sf ? 'rgba(100, 210, 255,0.4)' : 'rgba(255,255,255,0.1)',
                  color: surfFilter === sf ? C.cyan : 'rgba(148,163,184,0.5)',
                  background: surfFilter === sf ? 'rgba(100, 210, 255,0.1)' : 'transparent',
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
            <MapOverlayLegend title="Traffic Volume" items={LEGEND_TRAFFIC} position="bottomleft" />
            <MapGISControls bounds={UGANDA_BOUNDS} accent={C.atcCyan} position="bottomright" />

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
              border: '1px solid rgba(255, 214, 10,0.35)',
              borderRadius: 10, padding: '5px 12px', backdropFilter: 'blur(12px)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: C.yellow }}>Year {timelineYear}</span>
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
            background: 'rgba(48, 209, 88,0.08)',
            border: '1px solid rgba(48, 209, 88,0.2)',
            flexShrink: 0,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#30d158',
              boxShadow: '0 0 8px #30d158',
              display: 'inline-block',
              animation: 'liveBlink 1.8s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 8, fontWeight: 900, color: '#30d158', letterSpacing: '0.1em' }}>
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
              background: isPlaying ? 'rgba(48, 209, 88,0.15)' : 'rgba(255,255,255,0.08)',
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
              background: 'linear-gradient(90deg,#30d158,#ffd60a,#ff9f0a,#ff375f)',
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', width: 90 }}>
              <span style={{ fontSize: 7, color: 'rgba(48, 209, 88,0.6)' }}>Low</span>
              <span style={{ fontSize: 7, color: 'rgba(148,163,184,0.3)' }}>← ADT →</span>
              <span style={{ fontSize: 7, color: 'rgba(255, 55, 95,0.6)' }}>High</span>
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
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(100, 210, 255,0.14)' }}>
          <div style={{
            fontSize: 8, fontWeight: 700, color: 'rgba(100, 210, 255,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2,
          }}>Total Network ADT</div>
          <div style={{
            fontSize: 26, fontWeight: 900, color: C.cyan, lineHeight: 1,
            textShadow: `0 0 22px rgba(100, 210, 255,0.4)`,
          }}>
            {kpis ? `${Math.round(kpis.totalAdt / 1000)}k` : '-'}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.42)', marginTop: 3 }}>
            vehicles / day · {features.length} survey nodes
          </div>
        </div>

        {/* KPI 2 – Network Growth Ratio */}
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(48, 209, 88,0.14)' }}>
          <div style={{
            fontSize: 8, fontWeight: 700, color: 'rgba(48, 209, 88,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2,
          }}>Network Growth Ratio 2025 → 2040</div>
          <div style={{
            fontSize: 26, fontWeight: 900, color: C.green, lineHeight: 1,
            textShadow: `0 0 22px rgba(48, 209, 88,0.4)`,
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
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(10, 132, 255,0.14)' }}>
          <div style={{
            fontSize: 7, fontWeight: 700, color: 'rgba(10, 132, 255,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2,
          }}>Total Survey Nodes</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.blue, lineHeight: 1 }}>
            {features.length}
          </div>
          <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', marginTop: 2 }}>road links monitored</div>
        </div>

        {/* KPI 6 – Surface Paving Index */}
        <div style={{ ...KPI_GLASS, borderColor: 'rgba(191, 90, 242,0.14)' }}>
          <div style={{
            fontSize: 8, fontWeight: 700, color: 'rgba(191, 90, 242,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4,
          }}>Surface Paving Index</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.purple, lineHeight: 1 }}>
              {kpis ? `${kpis.pavingIndex.toFixed(0)}%` : '-'}
            </div>
            <div style={{
              flex: 1, height: 7, background: 'rgba(191, 90, 242,0.1)',
              borderRadius: 4, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${kpis?.pavingIndex ?? 0}%`,
                background: 'linear-gradient(90deg,#bf5af2,#00d4aa)', borderRadius: 4,
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
                    { label: 'Network AADT (avg)', value: kpis ? `${Math.round(kpis.avgAadt).toLocaleString()}` : '-', color: '#64d2ff', sub: 'vehicles / day / link' },
                    { label: 'Survey Nodes', value: features.length.toLocaleString(), color: '#00d4aa', sub: 'links with TIS count' },
                    { label: 'TIS Stations', value: tcsStations.length.toString(), color: '#ffd60a', sub: 'manual + ATC' },
                    { label: 'Growth 2025→2040', value: kpis ? `+${kpis.growthRatio.toFixed(0)}%` : '-', color: '#30d158', sub: 'ML forecast' },
                  ].map(k => (
                    <div key={k.label} style={{ background:'rgba(8,8,8,0.55)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px' }}>
                      <div style={{ fontSize:8, fontWeight:700, color:'rgba(148,163,184,0.45)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>{k.label}</div>
                      <div style={{ fontSize:22, fontWeight:900, color:k.color, lineHeight:1 }}>{k.value}</div>
                      <div style={{ fontSize:8, color:'rgba(148,163,184,0.4)', marginTop:3 }}>{k.sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background:'rgba(8,8,8,0.55)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ fontSize:11, fontWeight:800, color:'#e2eaf4' }}>Vehicle Class Composition - Uganda National Average (TIS 2025)</div>
                    <SourceTableButton anchor="tbl-009" />
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    {VC_CLASSES.map(vc => (
                      <div key={vc.label} style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:9, color:'rgba(148,163,184,0.7)', width:160, flexShrink:0 }}>{vc.label}</span>
                        <div style={{ flex:1, height:6, background:'rgba(255,255,255,0.06)', borderRadius:3 }}>
                          <div style={{ height:'100%', width:`${(vc.pct*100).toFixed(0)}%`, borderRadius:3, background:'#00d4aa', opacity:.8 }}/>
                        </div>
                        <span style={{ fontSize:9, color:'#00d4aa', fontWeight:700, width:36, textAlign:'right' }}>{(vc.pct*100).toFixed(1)}%</span>
                        {kpis && <span style={{ fontSize:9, color:'rgba(148,163,184,0.4)', width:60, textAlign:'right' }}>~{Math.round(kpis.avgAadt*vc.pct).toLocaleString()} v/d</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background:'rgba(8,8,8,0.55)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px' }}>
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
            <SortableFilterableTable
              columns={[
                { key: 'tcs_no', label: 'TCS No.', render: (s: any) => <span style={{ color: C.yellow, fontFamily: 'monospace' }}>{s.tcs_no}</span> },
                { key: 'tcs_name', label: 'Station Name' },
                { key: 'road_no', label: 'Road No.', render: (s: any) => <span style={{ fontFamily: 'monospace' }}>{s.road_no ?? '-'}</span> },
                { key: 'link_id', label: 'Link ID', render: (s: any) => <span style={{ color: C.teal, fontFamily: 'monospace' }}>{s.link_id ?? '-'}</span> },
                { key: 'link_name', label: 'Link Name' },
                { key: 'station', label: 'Station' },
                { key: 'region', label: 'Region', render: (s: any) => <span style={{ color: REGION_CLR[s.region ?? ''] ?? '#94a3b8' }}>{s.region ?? '-'}</span> },
                {
                  key: 'surface', label: 'Surface',
                  render: (s: any) => (
                    <span style={{ color: s.surface === 'Bituminous' ? C.cyan : C.amber, fontWeight: 600 }}>
                      {s.surface === 'Bituminous' ? 'Paved' : s.surface ?? '-'}
                    </span>
                  ),
                },
              ] as STColumn<any>[]}
              rows={tcsStations}
              accent={C.tisCyan}
              exportName="tis-atc-station-directory"
              initialSort="tcs_no"
              emptyText="No monitoring stations available."
            />
            <div style={{ marginTop: 10, fontSize: 9, color: 'rgba(148,163,184,0.3)' }}>
              Source: TIS 2025 AADT analysis.xlsx · TCS_Combined sheet · real Link IDs from network2026.geojson
            </div>
          </div>
        )}

      {activeTab === 'roadsafety' && <Suspense fallback={<div style={{padding:'1.5rem',color:'#ff453a',textAlign:'center',opacity:0.7,fontSize:'12px'}}>Loading…</div>}><RoadSafetyDashboard /></Suspense>}

    </div>
  );
}


// ═══ Road Safety Panel ═══════════════════════════════════════════════════
function RoadSafetyPanel() {
  const SB_URL = (import.meta.env.VITE_SUPABASE_URL ?? '') as string;
  const SB_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '') as string;

  const [accidents, setAccidents] = useState<Record<string, unknown>[]>([]);
  const [blackspots, setBlackspots] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!SB_URL) { setLoading(false); return; }
    const h: Record<string, string> = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
    Promise.all([
      fetch(`${SB_URL}/rest/v1/road_accidents?select=accident_date,severity,casualties,vehicles,road_name,district,cause&order=accident_date.desc&limit=5000`, { headers: h })
        .then(r => r.ok ? r.json() as Promise<Record<string, unknown>[]> : []).catch(() => []),
      fetch(`${SB_URL}/rest/v1/road_blackspots?select=road_name,road_number,accident_count,fatality_count&order=accident_count.desc&limit=30`, { headers: h })
        .then(r => r.ok ? r.json() as Promise<Record<string, unknown>[]> : []).catch(() => []),
    ]).then(([acc, bs]) => {
      setAccidents(Array.isArray(acc) ? acc : []);
      setBlackspots(Array.isArray(bs) ? bs : []);
      setLoading(false);
    });
  }, [SB_URL]);

  const total = accidents.length;
  const bySeverity = accidents.reduce<Record<string, number>>((m, a) => {
    const s = ((a['severity'] as string) || 'Unknown');
    m[s] = (m[s] || 0) + 1; return m;
  }, {});
  const byYear = accidents.reduce<Record<string, number>>((m, a) => {
    const y = ((a['accident_date'] as string) || '').slice(0, 4) || 'Unknown';
    m[y] = (m[y] || 0) + 1; return m;
  }, {});
  const byCause = accidents.reduce<Record<string, number>>((m, a) => {
    const c = ((a['cause'] as string) || 'Unknown');
    m[c] = (m[c] || 0) + 1; return m;
  }, {});
  const byDistrict = accidents.reduce<Record<string, number>>((m, a) => {
    const d = ((a['district'] as string) || 'Unknown');
    m[d] = (m[d] || 0) + 1; return m;
  }, {});
  const totalCasualties = accidents.reduce((s, a) => s + ((a['casualties'] as number) || 0), 0);
  const fatalCount = Object.entries(bySeverity).filter(([k]) => k.toLowerCase().includes('fatal')).reduce((s, [, v]) => s + v, 0);
  const seriousCount = Object.entries(bySeverity).filter(([k]) => k.toLowerCase().includes('serious')).reduce((s, [, v]) => s + v, 0);
  const minorCount = Object.entries(bySeverity).filter(([k]) => k.toLowerCase().includes('minor')).reduce((s, [, v]) => s + v, 0);

  const CARD: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 16px' };
  const LABEL: React.CSSProperties = { fontSize: 10, color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 };
  const VALUE: React.CSSProperties = { fontSize: 24, fontWeight: 700, lineHeight: 1.1 };
  const TITLE: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.8)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 };

  const HBar = ({ label, count, max, color }: { label: string; count: number; max: number; color: string }) => (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: 'rgba(226,232,240,0.85)', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ color: 'rgba(148,163,184,0.65)' }}>{count}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${max ? Math.min(100, Math.round(count / max * 100)) : 0}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(148,163,184,0.45)', fontSize: 13, gap: 10 }}>
      <ShieldAlert size={18} style={{ opacity: 0.4 }} /> Loading road safety data…
    </div>
  );

  if (total === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'rgba(148,163,184,0.45)', fontSize: 13 }}>
      <ShieldAlert size={42} style={{ opacity: 0.25 }} />
      <div>No accident records found in <code style={{ fontFamily: 'monospace', fontSize: 11 }}>road_accidents</code> table.</div>
      <div style={{ fontSize: 11 }}>Populate the table in Supabase to see statistics here.</div>
    </div>
  );

  const years = Object.keys(byYear).filter(y => y !== 'Unknown').sort().reverse().slice(0, 10);
  const maxYear = Math.max(1, ...years.map(y => byYear[y]));
  const causeEntries = Object.entries(byCause).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const distEntries = Object.entries(byDistrict).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const sevEntries = Object.entries(bySeverity).sort((a, b) => b[1] - a[1]);
  const maxSev = Math.max(1, sevEntries[0]?.[1] || 1);

  return (
    <div style={{ padding: '14px 16px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: 14, boxSizing: 'border-box' }}>
      {/* KPI row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {([
          { label: 'Total Accidents',  value: total.toLocaleString(),            color: '#ef4444' },
          { label: 'Fatal Accidents',  value: fatalCount.toLocaleString(),       color: '#dc2626' },
          { label: 'Serious Injuries', value: seriousCount.toLocaleString(),     color: '#f97316' },
          { label: 'Minor Injuries',   value: minorCount.toLocaleString(),       color: '#eab308' },
          { label: 'Total Casualties', value: totalCasualties.toLocaleString(), color: '#fb923c' },
          { label: 'Blackspots',       value: blackspots.length.toLocaleString(), color: '#a855f7' },
        ] as const).map(k => (
          <div key={k.label} style={{ ...CARD, flex: '1 1 130px', minWidth: 120 }}>
            <div style={LABEL}>{k.label}</div>
            <div style={{ ...VALUE, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Chart cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
        <div style={{ ...CARD, flex: '1 1 200px' }}>
          <div style={TITLE}>Severity Breakdown</div>
          {sevEntries.map(([sev, cnt]) => {
            const col = sev.toLowerCase().includes('fatal') ? '#dc2626' : sev.toLowerCase().includes('serious') ? '#f97316' : sev.toLowerCase().includes('minor') ? '#eab308' : '#64748b';
            return <HBar key={sev} label={`${sev} (${total ? Math.round(cnt / total * 100) : 0}%)`} count={cnt} max={maxSev} color={col} />;
          })}
        </div>

        <div style={{ ...CARD, flex: '1 1 200px' }}>
          <div style={TITLE}>Accidents by Year</div>
          {years.map(y => <HBar key={y} label={y} count={byYear[y]} max={maxYear} color='#ef4444' />)}
        </div>

        <div style={{ ...CARD, flex: '1 1 240px' }}>
          <div style={TITLE}>Top Accident Causes</div>
          {causeEntries.map(([cause, cnt]) => (
            <HBar key={cause} label={cause} count={cnt} max={causeEntries[0]?.[1] || 1} color='#f97316' />
          ))}
        </div>

        <div style={{ ...CARD, flex: '1 1 200px' }}>
          <div style={TITLE}>Accidents by District</div>
          {distEntries.map(([d, cnt]) => (
            <HBar key={d} label={d} count={cnt} max={distEntries[0]?.[1] || 1} color='#7c3aed' />
          ))}
        </div>

        {blackspots.length > 0 && (
          <div style={{ ...CARD, flex: '2 1 400px' }}>
            <div style={TITLE}>Accident Blackspots</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {['Road Name', 'Road No.', 'Accidents', 'Fatalities'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'rgba(148,163,184,0.55)', fontWeight: 600, fontSize: 10, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {blackspots.map((bs, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '5px 8px', color: 'rgba(226,232,240,0.85)' }}>{(bs['road_name'] as string) || '-'}</td>
                    <td style={{ padding: '5px 8px', color: 'rgba(148,163,184,0.65)' }}>{(bs['road_number'] as string) || '-'}</td>
                    <td style={{ padding: '5px 8px', color: '#ef4444', fontWeight: 600 }}>{(bs['accident_count'] as number) || 0}</td>
                    <td style={{ padding: '5px 8px', color: '#dc2626', fontWeight: 600 }}>{(bs['fatality_count'] as number) || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.28)', marginTop: 2 }}>
        Source: road_accidents · road_blackspots - Supabase · Uganda NTIS Road Safety Module
      </div>
    </div>
  );
}