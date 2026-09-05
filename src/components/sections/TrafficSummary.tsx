/**
 * TrafficSummary - Summary Tables view.
 * Sub-tabs: Road Links Data | Traffic Counting Stations
 * Year pills 2016-2035 with interpolated AADT values.
 * Export CSV, search, sortable columns.
 */
import { useState, useEffect, useMemo } from 'react';
import { CURRENT_YEAR } from '../../shared/year';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';
import { RoadClassPill, AadtHeatCell } from '../../shared/tableFormatting';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PredProps {
  link_id: string; link_name: string | null; road_no: string | null;
  road_class: string | null; region: string | null; length_km: number | null;
  aadt_predicted: number | null; growth_2030: number | null; growth_2040: number | null;
  heavy_vehicle_pct: number | null; congestion_risk: string | null; vehicle_km_daily: number | null;
}
interface PredFeature { type: 'Feature'; geometry: unknown; properties: PredProps }
interface StationProps { TCS_NAME?: string; STATION?: string; Link_Name?: string; Link_ID?: string; REGION?: string; TCS_NO?: number }
interface StationFeature { properties: StationProps }

// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
  cyan:'#64d2ff', green:'#30d158', orange:'#ff9f0a', yellow:'#ffd60a',
  pink:'#ff375f', teal:'#66d4cf', blue:'#0a84ff', amber:'#f59e0b',
};
const CONG_CLR: Record<string,string> = { Critical:'#ef4444', High:'#f97316', Medium:'#eab308', Low:'#22c55e' };
const CLASS_CLR: Record<string,string> = { A:C.cyan, B:C.green, C:C.amber, M:'#94a3b8' };
const REGION_CLR: Record<string,string> = {
  Central:C.cyan, Eastern:C.orange, Southern:C.yellow, Western:C.green,
  Northern:'#bf5af2', 'North Eastern':C.pink,
};
const GLASS: React.CSSProperties = {
  background:'rgba(15,23,42,0.55)', backdropFilter:'blur(20px)',
  WebkitBackdropFilter:'blur(20px)', border:'1px solid rgba(94, 92, 230,0.12)', borderRadius:14,
};

// Growth factors 2016-2035 - BASE YEAR 2016 = 1.00 (all traffic statistics
// are anchored to the 2016 base year; source growth_factors_summary).
const GF: Record<number,number> = {
  2016:1.00, 2017:1.06, 2018:1.15, 2019:1.23, 2020:1.05, 2021:1.19,
  2022:1.32, 2023:1.45, 2024:1.55, 2025:1.61, 2026:1.69, 2027:1.77,
  2028:1.87, 2029:1.97, 2030:2.06, 2031:2.15, 2032:2.24, 2033:2.32,
  2034:2.40, 2035:2.50,
};
// aadt_predicted is a 2025-anchored reading - scale a year's 2016-base factor
// relative to 2025 when projecting it.
const gfTo = (y: number) => (GF[y] ?? 1) / (GF[2025] ?? 1);
const ALL_YEARS = Object.keys(GF).map(Number).sort((a,b)=>a-b);

function hexRgb(hex: string): string {
  const h = hex.replace('#','');
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}

// ─── AADT interpolation for a given year ─────────────────────────────────────
function aadtForYear(p: PredProps, year: number): number {
  const base = p.aadt_predicted ?? 0;
  return Math.round(base * gfTo(year));
}

// ─── Capacity estimate for congestion alert ───────────────────────────────────
function growthAlert(p: PredProps, year: number): string {
  const cap: Record<string,number> = { A:10000, B:5000, C:2500, M:15000 };
  const c = cap[p.road_class??'C'] ?? 2500;
  const v = aadtForYear(p, year);
  if (v > c * 0.9)  return 'Critical';
  if (v > c * 0.7)  return 'High';
  if (v > c * 0.4)  return 'Medium';
  return 'Low';
}

// ─── Road Links Data tab ──────────────────────────────────────────────────────
interface RoadLinkRow {
  link_id: string; link_name: string; road_class: string; region: string;
  length_km: number | null; adt: number; adtInclMc: number; adtExclMc: number;
  nmt: number; alert: string; heavy_vehicle_pct: number | null;
}

function RoadLinksTab({ features }: { features: PredFeature[] }) {
  const [year,    setYear]    = useState(CURRENT_YEAR);
  const [classF,  setClassF]  = useState('all');
  const [regionF, setRegionF] = useState('all');

  const regions = useMemo(() =>
    ['all', ...Array.from(new Set(features.map(f=>f.properties.region??'Unknown'))).sort()],
    [features]
  );

  const filteredFeatures = useMemo(() => {
    let arr = features;
    if (classF  !== 'all') arr = arr.filter(f => f.properties.road_class === classF);
    if (regionF !== 'all') arr = arr.filter(f => f.properties.region === regionF);
    return arr;
  }, [features, classF, regionF]);

  const rows: RoadLinkRow[] = useMemo(() => filteredFeatures.map(f => {
    const p = f.properties;
    const adt = aadtForYear(p, year);
    return {
      link_id: p.link_id, link_name: p.link_name ?? p.link_id, road_class: p.road_class ?? '-',
      region: p.region ?? '-', length_km: p.length_km,
      adt, adtInclMc: adt, adtExclMc: Math.round(adt * 0.705),
      nmt: Math.round(adt * 0.08), alert: growthAlert(p, year),
      heavy_vehicle_pct: p.heavy_vehicle_pct,
    };
  }), [filteredFeatures, year]);

  const columns: STColumn<RoadLinkRow>[] = useMemo(() => [
    { key: 'link_name', label: 'Road Link' },
    { key: 'road_class', label: 'Class', render: r => <RoadClassPill cls={r.road_class} /> },
    { key: 'region', label: 'Region', render: r => <span style={{ color: REGION_CLR[r.region] ?? 'rgba(148,163,184,0.55)' }}>{r.region}</span> },
    {
      key: 'length_km', label: 'Length (km)', numeric: true, total: 'sum',
      render: r => r.length_km != null ? `${r.length_km.toFixed(1)} km` : '-',
    },
    { key: 'adt', label: `Total ADT ${year}`, numeric: true, render: r => <AadtHeatCell value={r.adt} /> },
    { key: 'adtInclMc', label: 'ADT incl MC', numeric: true, render: r => <AadtHeatCell value={r.adtInclMc} /> },
    { key: 'adtExclMc', label: 'ADT excl MC', numeric: true, render: r => <AadtHeatCell value={r.adtExclMc} /> },
    {
      key: 'nmt', label: 'NMT', numeric: true,
      comment: 'Estimated Non-Motorised Transport share of ADT.',
      render: r => <span style={{ color: 'rgba(148,163,184,0.6)' }}>{r.nmt.toLocaleString()}</span>,
    },
    {
      key: 'alert', label: 'Alert',
      render: r => {
        const alertCol = CONG_CLR[r.alert] ?? '#94a3b8';
        return (
          <span style={{ fontSize:8, fontWeight:800, padding:'1px 7px', borderRadius:10,
            background:`rgba(${hexRgb(alertCol)},0.13)`,
            border:`1px solid rgba(${hexRgb(alertCol)},0.32)`, color:alertCol }}>
            {r.alert}
          </span>
        );
      },
    },
    {
      key: 'heavy_vehicle_pct', label: 'Heavy %', numeric: true,
      render: r => <span style={{ color: C.orange, fontFamily: 'monospace' }}>{r.heavy_vehicle_pct != null ? `${r.heavy_vehicle_pct.toFixed(0)}%` : '-'}</span>,
    },
  ], [year]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {/* Year pills */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:4, alignItems:'center' }}>
        <span style={{ fontSize:9, fontWeight:800, color:'rgba(148,163,184,0.45)',
          textTransform:'uppercase', letterSpacing:'0.1em', marginRight:4 }}>Year</span>
        {ALL_YEARS.map(y => (
          <button key={y} onClick={() => setYear(y)}
            style={{ padding:'3px 9px', borderRadius:6, border:'1px solid', fontSize:10,
              fontWeight:700, cursor:'pointer', transition:'all .15s',
              background: year===y ? 'rgba(48, 209, 88,0.15)' : 'rgba(255,255,255,0.04)',
              borderColor: year===y ? 'rgba(48, 209, 88,0.45)' : 'rgba(255,255,255,0.1)',
              color: year===y ? C.green : 'rgba(148,163,184,0.55)' }}>
            {y}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <SearchableSelect value={classF} onChange={setClassF}
          style={{ background:'rgba(94, 92, 230,0.08)', border:'1px solid rgba(94, 92, 230,0.25)',
            borderRadius:8, color:C.cyan, fontSize:11, padding:'5px 10px', outline:'none', cursor:'pointer' }}>
          <option value="all">All Classes</option>
          {['A','B','C','M'].map(c=><option key={c} value={c}>Class {c}</option>)}
        </SearchableSelect>
        <SearchableSelect value={regionF} onChange={setRegionF}
          style={{ background:'rgba(94, 92, 230,0.08)', border:'1px solid rgba(94, 92, 230,0.25)',
            borderRadius:8, color:C.cyan, fontSize:11, padding:'5px 10px', outline:'none', cursor:'pointer' }}>
          {regions.map(r=><option key={r} value={r}>{r==='all'?'All Regions':r}</option>)}
        </SearchableSelect>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:10, color:'rgba(148,163,184,0.4)' }}>
            {rows.length.toLocaleString()} links · use the table's own search / CSV / Excel export below
          </span>
        </div>
      </div>

      {/* Table */}
      <SortableFilterableTable
        columns={columns}
        rows={rows}
        accent={C.cyan}
        exportName={`uganda-roads-traffic-${year}`}
        initialSort="adt"
        emptyText="No road links match the current filters."
      />
    </div>
  );
}

// ─── Stations tab ─────────────────────────────────────────────────────────────
interface StationRow {
  name: string; link_name: string; region: string; adt: number | null;
  heavy_vehicle_pct: number | null; lastCount: string;
}

function StationsTab({ stations, features }: { stations: StationFeature[]; features: PredFeature[] }) {
  const [year, setYear] = useState(CURRENT_YEAR);

  const predByLink = useMemo(
    () => new Map(features.map(f => [f.properties.link_id, f.properties])),
    [features],
  );

  const rows: StationRow[] = useMemo(() => stations.map((s, i) => {
    const p    = s.properties;
    const pred = predByLink.get(p.Link_ID??'');
    const adt  = pred ? Math.round((pred.aadt_predicted??0) * gfTo(year)) : null;
    return {
      name: p.TCS_NAME??p.STATION??`TCS-${p.TCS_NO??i}`,
      link_name: p.Link_Name??'-', region: p.REGION??'-', adt,
      heavy_vehicle_pct: pred?.heavy_vehicle_pct ?? null,
      lastCount: year<=2025?String(year):`Forecast ${year}`,
    };
  }), [stations, predByLink, year]);

  const columns: STColumn<StationRow>[] = useMemo(() => [
    { key: 'name', label: 'Station ID', render: r => <span style={{ color: C.teal, fontWeight: 700 }}>{r.name}</span> },
    { key: 'link_name', label: 'Road Name' },
    { key: 'region', label: 'Region', render: r => <span style={{ color: REGION_CLR[r.region] ?? 'rgba(148,163,184,0.55)' }}>{r.region}</span> },
    { key: 'adt', label: `AADT ${year}`, numeric: true, render: r => <AadtHeatCell value={r.adt} /> },
    {
      key: 'heavy_vehicle_pct', label: 'Heavy %', numeric: true,
      render: r => <span style={{ color: C.orange, fontFamily: 'monospace' }}>{r.heavy_vehicle_pct != null ? `${r.heavy_vehicle_pct.toFixed(0)}%` : '-'}</span>,
    },
    { key: 'lastCount', label: 'Last Count' },
  ], [year]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {/* Year pills (just 2025, 2030, 2035 for stations) */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:4, alignItems:'center' }}>
        <span style={{ fontSize:9, fontWeight:800, color:'rgba(148,163,184,0.45)',
          textTransform:'uppercase', letterSpacing:'0.1em', marginRight:4 }}>Projection Year</span>
        {ALL_YEARS.map(y => (
          <button key={y} onClick={() => setYear(y)}
            style={{ padding:'3px 9px', borderRadius:6, border:'1px solid', fontSize:10,
              fontWeight:700, cursor:'pointer', transition:'all .15s',
              background: year===y ? 'rgba(102, 212, 207,0.15)' : 'rgba(255,255,255,0.04)',
              borderColor: year===y ? 'rgba(102, 212, 207,0.45)' : 'rgba(255,255,255,0.1)',
              color: year===y ? C.teal : 'rgba(148,163,184,0.55)' }}>
            {y}
          </button>
        ))}
      </div>

      <SortableFilterableTable
        columns={columns}
        rows={rows}
        accent={C.teal}
        exportName={`uganda-atc-stations-${year}`}
        initialSort="adt"
        emptyText="No station data available."
      />
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
type SubTab = 'links' | 'stations';

export default function TrafficSummary() {
  const [features, setFeatures] = useState<PredFeature[]>([]);
  const [stations, setStations] = useState<StationFeature[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [subTab,   setSubTab]   = useState<SubTab>('links');

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/traffic_predictions.geojson`).then(r=>r.json()),
      fetch(`${base}atc_stations.geojson`).then(r=>r.json()),
    ]).then(([gj, stGJ]) => {
      setFeatures((gj.features??[]) as PredFeature[]);
      setStations((stGJ.features??[]) as StationFeature[]);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
        height:'100%', color:'rgba(148,163,184,0.5)', fontSize:13,
        fontFamily:"'Inter','Segoe UI',sans-serif" }}>
        Loading summary tables…
      </div>
    );
  }

  return (
    <div style={{ padding:'20px 22px 36px', fontFamily:"'Inter','Segoe UI',sans-serif", color:'#e2eaf4' }}>
      {/* Header */}
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:9, fontWeight:800, color:'rgba(94, 92, 230,0.55)',
          letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:3 }}>
          Uganda National Roads · Department of National Roads / DNR 2025
        </div>
        <div style={{ fontSize:22, fontWeight:900, color:C.cyan, lineHeight:1.2,
          textShadow:'0 0 22px rgba(100, 210, 255,0.35)' }}>
          Traffic Summary Tables
        </div>
        <div style={{ fontSize:11, color:'rgba(148,163,184,0.5)', marginTop:4 }}>
          {features.length.toLocaleString()} road links · 10 ATC + {stations.length} manual TIS stations ·
          Year-interpolated AADT values using ML growth factors
        </div>
      </div>

      {/* ── ATC-style KPI strip ──────────────────────────────────────────────── */}
      {features.length > 0 && (() => {
        const avgAdt = Math.round(features.reduce((s,f)=>s+(f.properties.aadt_predicted??0),0)/features.length);
        const totalVkt = Math.round(features.reduce((s,f)=>s+(f.properties.vehicle_km_daily??0),0)/1e6);
        const highRisk = features.filter(f=>['Critical','High'].includes(f.properties.congestion_risk??'')).length;
        const kpis = [
          { label:'Road Links',       value:features.length.toLocaleString(), unit:'data rows',   color:C.cyan },
          { label:'Avg ADT 2025',     value:avgAdt.toLocaleString(),          unit:'vpd',         color:C.green },
          { label:'TIS Stations',     value:stations.length.toString(),       unit:'survey pts',  color:C.orange },
          { label:'High-Risk Links',  value:highRisk.toString(),              unit:'links',       color:C.pink },
          { label:'Total Daily VKT',  value:`${totalVkt || '-'}M`,           unit:'veh-km/day',  color:C.yellow },
        ];
        return (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:18 }}>
            {kpis.map(k => (
              <div key={k.label} style={{
                background:`rgba(${hexRgb(k.color)},0.07)`,
                border:`1px solid rgba(${hexRgb(k.color)},0.18)`,
                borderLeft:`4px solid ${k.color}`,
                borderRadius:10, padding:'13px 15px 11px',
                boxShadow:`0 0 16px rgba(${hexRgb(k.color)},0.1)`,
              }}>
                <div style={{ fontSize:26, fontWeight:900, color:k.color, lineHeight:1.1,
                  fontVariantNumeric:'tabular-nums',
                  textShadow:`0 0 18px rgba(${hexRgb(k.color)},0.65)` }}>{k.value}</div>
                <div style={{ fontSize:9, fontWeight:800, color:'rgba(148,163,184,0.55)',
                  letterSpacing:'0.13em', textTransform:'uppercase', marginTop:4 }}>{k.label}</div>
                <div style={{ fontSize:9, color:`rgba(${hexRgb(k.color)},0.5)`,
                  fontWeight:700, marginTop:2 }}>{k.unit}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Sub-tab bar */}
      <div style={{ display:'flex', gap:2, marginBottom:16,
        borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        {([
          { id:'links'    as SubTab, label:'Road Links Data'           },
          { id:'stations' as SubTab, label:'Traffic Counting Stations' },
        ]).map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            style={{ padding:'8px 16px', fontSize:11, fontWeight:700, cursor:'pointer',
              border:'none', borderRadius:'8px 8px 0 0',
              background: subTab===t.id ? 'rgba(100, 210, 255,0.1)' : 'transparent',
              color: subTab===t.id ? C.cyan : 'rgba(148,163,184,0.5)',
              borderBottom: subTab===t.id ? `2px solid ${C.cyan}` : '2px solid transparent',
              transition:'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab==='links'    && <RoadLinksTab features={features}/>}
      {subTab==='stations' && <StationsTab  stations={stations} features={features}/>}
    </div>
  );
}
