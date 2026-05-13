/**
 * PredictionsPanel — Geospatial Traffic Forecast Map
 * Renders ML-predicted AADT for all 1,014 road links with:
 *   • Congestion-risk colour gradient (green → amber → orange → red)
 *   • Forecast timeline slider (2025 → 2040)
 *   • Click popup: predicted AADT, 95% CI, forecasts, top model features
 *   • Network KPI strip (total veh-km, % at risk, highest-growth corridor)
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, ZoomControl, GeoJSON, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TrendingUp, Zap, AlertTriangle, Activity } from 'lucide-react';
import { hexRgb } from '../../lib/chart3d';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PredProps {
  link_id: string;
  link_name: string | null;
  road_no: string | null;
  road_class: string | null;
  region: string | null;
  length_km: number | null;
  aadt_predicted: number | null;
  aadt_lower_95: number | null;
  aadt_upper_95: number | null;
  growth_2025: number | null;
  growth_2030: number | null;
  growth_2040: number | null;
  peak_hour_volume: number | null;
  heavy_vehicle_pct: number | null;
  congestion_risk: string | null;
  congestion_risk_score: number | null;
  top_features: string | string[] | null;
  vehicle_km_daily: number | null;
}
interface PredFeature {
  type: 'Feature';
  geometry: { type: string; coordinates: any };
  properties: PredProps;
}
interface PredSummary {
  total_vehicle_km_daily: number;
  links_at_capacity_risk_pct: number;
  highest_growth_corridor_2040: {
    link_id: string; link_name: string;
    aadt_2025: number; aadt_2040: number;
  };
  congestion_breakdown: Record<string, number>;
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  cyan:   '#00f5ff', green:  '#00ff88', orange: '#ff6b35',
  purple: '#b967ff', yellow: '#ffd23f', pink:   '#ff2d78',
  blue:   '#4d9fff', teal:   '#00d4aa',
};

const CONG: Record<string, { color: string; label: string }> = {
  Low:      { color: '#00ff88', label: 'Low'      },
  Medium:   { color: '#ffd23f', label: 'Medium'   },
  High:     { color: '#ff6b35', label: 'High'     },
  Critical: { color: '#ff2d78', label: 'Critical' },
};

const glass = (accent = C.cyan): React.CSSProperties => ({
  background:     'rgba(2,5,8,0.82)',
  border:         `1px solid rgba(${hexRgb(accent)},0.18)`,
  borderRadius:   14,
  backdropFilter: 'blur(18px)',
});

// ─── Forecast interpolation ───────────────────────────────────────────────────
function getAadtForYear(p: PredProps, year: number): number {
  const g25 = p.growth_2025 ?? p.aadt_predicted ?? 0;
  const g30 = p.growth_2030 ?? g25 * 1.35;
  const g40 = p.growth_2040 ?? g25 * 1.95;
  if (year <= 2025) return g25;
  if (year >= 2040) return g40;
  if (year <= 2030) return Math.round(g25 + ((year - 2025) / 5) * (g30 - g25));
  return Math.round(g30 + ((year - 2030) / 10) * (g40 - g30));
}

// Congestion risk at a projected AADT for a given road class
const CAPACITY: Record<string, number> = {
  A: 10000, B: 5000, C: 2500, M: 15000, D: 1500,
};
function congestionAtYear(p: PredProps, year: number): string {
  const aadt = getAadtForYear(p, year);
  const cap  = CAPACITY[p.road_class ?? 'C'] ?? 2500;
  const vcr  = aadt / cap;
  if (vcr <= 0.40) return 'Low';
  if (vcr <= 0.70) return 'Medium';
  if (vcr <= 0.90) return 'High';
  return 'Critical';
}

// ─── Map layer that re-keys on year to force re-style ─────────────────────────
function PredLayer({
  features, year, onSelect,
}: {
  features: PredFeature[];
  year: number;
  onSelect: (p: PredProps) => void;
}) {
  const styleFeature = useCallback(
    (feat?: PredFeature) => {
      if (!feat) return {};
      const risk  = congestionAtYear(feat.properties, year);
      const color = CONG[risk]?.color ?? '#94a3b8';
      return {
        color,
        weight: feat.properties.road_class === 'A' ? 3.5
              : feat.properties.road_class === 'B' ? 2.5
              : feat.properties.road_class === 'M' ? 4.0
              : 1.8,
        opacity: 0.85,
        fillOpacity: 0,
      };
    },
    [year]
  );

  const onEach = useCallback(
    (feat: PredFeature, layer: L.Layer) => {
      (layer as L.Path).on({
        click: () => onSelect(feat.properties),
        mouseover: (e: L.LeafletMouseEvent) => {
          const p = e.target as L.Path;
          p.setStyle({ weight: 5, opacity: 1 });
        },
        mouseout: (e: L.LeafletMouseEvent) => {
          const p = e.target as L.Path;
          p.setStyle(styleFeature(feat) as L.PathOptions);
        },
      });
    },
    [onSelect, styleFeature]
  );

  const geojson = useMemo(
    () => ({ type: 'FeatureCollection' as const, features }),
    [features]
  );

  return (
    <GeoJSON
      key={year}
      data={geojson as any}
      style={styleFeature as any}
      onEachFeature={onEach as any}
    />
  );
}

// ─── Popup detail card ────────────────────────────────────────────────────────
function LinkPopup({
  p, year, onClose,
}: {
  p: PredProps; year: number; onClose: () => void;
}) {
  const features = useMemo(() => {
    if (!p.top_features) return [];
    if (Array.isArray(p.top_features)) return p.top_features;
    try { return JSON.parse(p.top_features as string); } catch { return []; }
  }, [p.top_features]);

  const risk  = congestionAtYear(p, year);
  const aadt  = getAadtForYear(p, year);
  const color = CONG[risk]?.color ?? '#94a3b8';

  return (
    <div style={{
      ...glass(color),
      padding: '14px 16px',
      minWidth: 260, maxWidth: 320,
      color: '#e2eaf4', fontSize: 11,
      boxShadow: `0 0 28px rgba(${hexRgb(color)},0.25)`,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:900, color, marginBottom:2 }}>
            {p.link_name ?? p.link_id}
          </div>
          <div style={{ fontSize:9, color:'rgba(148,163,184,0.6)', letterSpacing:'0.05em' }}>
            {p.road_no ?? ''} · {p.road_class}-class · {p.region ?? ''}
          </div>
        </div>
        <button onClick={onClose} style={{
          background:'none', border:'none', color:'rgba(148,163,184,0.5)',
          cursor:'pointer', fontSize:14, lineHeight:1, padding:0, marginLeft:8,
        }}>✕</button>
      </div>

      {/* Congestion badge */}
      <div style={{
        display:'inline-flex', alignItems:'center', gap:5,
        background:`rgba(${hexRgb(color)},0.15)`,
        border:`1px solid rgba(${hexRgb(color)},0.4)`,
        borderRadius:6, padding:'3px 10px', marginBottom:10,
        fontSize:10, fontWeight:800, color,
      }}>
        <span style={{ width:6, height:6, borderRadius:'50%', background:color, display:'inline-block' }}/>
        {risk} congestion risk — {year}
      </div>

      {/* AADT + CI */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
        <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 10px' }}>
          <div style={{ fontSize:18, fontWeight:900, color:'#fff' }}>
            {aadt.toLocaleString()}
          </div>
          <div style={{ fontSize:9, color:'rgba(148,163,184,0.6)' }}>Predicted AADT (veh/day)</div>
          <div style={{ fontSize:9, color:`rgba(${hexRgb(color)},0.7)`, marginTop:3 }}>
            95% CI: {(p.aadt_lower_95 ?? 0).toLocaleString()}–{(p.aadt_upper_95 ?? 0).toLocaleString()}
          </div>
        </div>
        <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 10px' }}>
          <div style={{ fontSize:18, fontWeight:900, color:C.orange }}>
            {(p.peak_hour_volume ?? 0).toLocaleString()}
          </div>
          <div style={{ fontSize:9, color:'rgba(148,163,184,0.6)' }}>Peak hour (AM)</div>
          <div style={{ fontSize:9, color:`rgba(${hexRgb(C.orange)},0.7)`, marginTop:3 }}>
            Heavy: {(p.heavy_vehicle_pct ?? 0).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Forecast row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, marginBottom:10 }}>
        {[2025, 2030, 2040].map(yr => {
          const v   = getAadtForYear(p, yr);
          const r   = congestionAtYear(p, yr);
          const col = CONG[r]?.color ?? '#94a3b8';
          return (
            <div key={yr} style={{
              background: yr === year ? `rgba(${hexRgb(col)},0.14)` : 'rgba(255,255,255,0.04)',
              border: `1px solid rgba(${hexRgb(col)},${yr===year?'0.4':'0.12'})`,
              borderRadius:7, padding:'6px 8px', textAlign:'center',
            }}>
              <div style={{ fontSize:11, fontWeight:900, color:col }}>
                {(v/1000).toFixed(0)}k
              </div>
              <div style={{ fontSize:8, color:'rgba(148,163,184,0.5)', marginTop:1 }}>{yr}</div>
            </div>
          );
        })}
      </div>

      {/* SHAP top features */}
      {features.length > 0 && (
        <div>
          <div style={{ fontSize:9, fontWeight:700, color:'rgba(148,163,184,0.5)',
            textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5 }}>
            Top model drivers
          </div>
          {features.slice(0, 3).map((f: string, i: number) => (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:6,
              marginBottom:3, fontSize:10, color:'rgba(226,234,244,0.8)',
            }}>
              <span style={{
                fontSize:8, fontWeight:900, color: [C.cyan,C.green,C.yellow][i],
                background:`rgba(${hexRgb([C.cyan,C.green,C.yellow][i])},0.12)`,
                borderRadius:4, padding:'1px 5px',
              }}>{i + 1}</span>
              {f}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PredictionsPanel() {
  const [features,   setFeatures]   = useState<PredFeature[]>([]);
  const [summary,    setSummary]    = useState<PredSummary | null>(null);
  const [forecastYr, setForecastYr] = useState<number>(2025);
  const [selLink,    setSelLink]    = useState<PredProps | null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/traffic_predictions.geojson`).then(r => r.json()),
      fetch(`${base}data/traffic_summary.json`).then(r => r.json()),
    ]).then(([gj, summ]) => {
      setFeatures((gj.features ?? []) as PredFeature[]);
      setSummary(summ as PredSummary);
      setLoading(false);
    }).catch(err => {
      console.error('Prediction data load error:', err);
      setLoading(false);
    });
  }, []);

  // KPI derivations for selected year
  const kpiData = useMemo(() => {
    if (!features.length) return null;
    const totalVkm = features.reduce((sum, f) => {
      const aadt = getAadtForYear(f.properties, forecastYr);
      return sum + aadt * (f.properties.length_km ?? 0);
    }, 0);
    const atRisk = features.filter(f => {
      const r = congestionAtYear(f.properties, forecastYr);
      return r === 'High' || r === 'Critical';
    }).length;
    const pctRisk = features.length > 0 ? (atRisk / features.length * 100).toFixed(1) : '0';
    return { totalVkm, atRisk, pctRisk };
  }, [features, forecastYr]);

  const topCorridor = summary?.highest_growth_corridor_2040;

  const sectionHead = (label: string, icon: React.ReactNode, color: string) => (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
      <span style={{ color, filter:`drop-shadow(0 0 6px ${color})` }}>{icon}</span>
      <span style={{ fontSize:13, fontWeight:800, color, letterSpacing:'0.04em',
        textShadow:`0 0 14px rgba(${hexRgb(color)},0.5)` }}>{label}</span>
      <div style={{ flex:1, height:1, background:`linear-gradient(90deg, rgba(${hexRgb(color)},0.4), transparent)` }}/>
    </div>
  );

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
        height:400, color:'rgba(148,163,184,0.5)', fontSize:13 }}>
        Loading prediction data…
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:800, color:`rgba(${hexRgb(C.purple)},0.5)`,
            letterSpacing:'0.18em', textTransform:'uppercase' }}>
            ST-GNN / XGBOOST ENSEMBLE · SPATIAL INTERPOLATION
          </div>
          <div style={{ fontSize:20, fontWeight:900, color:C.purple,
            textShadow:`0 0 20px rgba(${hexRgb(C.purple)},0.5)`, letterSpacing:'0.02em' }}>
            Traffic Forecast Map
          </div>
          <div style={{ fontSize:11, color:'rgba(148,163,184,0.6)', marginTop:3 }}>
            ML predictions for all {features.length} road links · Spatial-temporal model trained 2018–2025
          </div>
        </div>
        {/* Year slider */}
        <div style={{ ...glass(C.yellow), padding:'10px 16px', minWidth:220 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontSize:10, fontWeight:800, color:C.yellow, letterSpacing:'0.05em' }}>
              FORECAST YEAR
            </span>
            <span style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{forecastYr}</span>
          </div>
          <input type="range" min={2025} max={2040} step={1}
            value={forecastYr}
            onChange={e => setForecastYr(Number(e.target.value))}
            style={{ width:'100%', accentColor: C.yellow, cursor:'pointer' }}
          />
          <div style={{ display:'flex', justifyContent:'space-between',
            fontSize:8, color:'rgba(148,163,184,0.45)', marginTop:2 }}>
            <span>2025</span><span>2030</span><span>2040</span>
          </div>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          {
            label: 'Vehicle-km/day',
            value: kpiData ? `${((kpiData.totalVkm)/1e6).toFixed(0)}M` : '—',
            sub:   `Network total · ${forecastYr}`,
            color: C.cyan, icon: <Activity size={16}/>,
          },
          {
            label: 'Links at Capacity Risk',
            value: kpiData ? `${kpiData.pctRisk}%` : '—',
            sub:   `High + Critical (${kpiData?.atRisk ?? 0} links)`,
            color: C.pink, icon: <AlertTriangle size={16}/>,
          },
          {
            label: 'Highest Growth Corridor',
            value: topCorridor ? `+${Math.round((topCorridor.aadt_2040 / topCorridor.aadt_2025 - 1)*100)}%` : '—',
            sub:   topCorridor?.link_name ?? 'Loading…',
            color: C.green, icon: <TrendingUp size={16}/>,
          },
          {
            label: 'Predicted Data Coverage',
            value: `${features.filter(f => !f.properties.aadt_predicted).length === 0 ? '100' : ((features.filter(f => f.properties.aadt_predicted).length / features.length)*100).toFixed(0)}%`,
            sub:   `${features.length} links modelled`,
            color: C.teal, icon: <Zap size={16}/>,
          },
        ].map(kpi => (
          <div key={kpi.label} style={{
            ...glass(kpi.color),
            padding:'14px 16px', display:'flex', flexDirection:'column', gap:5,
            boxShadow:`0 0 24px rgba(${hexRgb(kpi.color)},0.08)`,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <span style={{ color:kpi.color, opacity:0.85 }}>{kpi.icon}</span>
              <span style={{ fontSize:9, fontWeight:700, color:'rgba(148,163,184,0.6)',
                textTransform:'uppercase', letterSpacing:'0.1em' }}>{kpi.label}</span>
            </div>
            <div style={{ fontSize:24, fontWeight:900, color:kpi.color, lineHeight:1,
              textShadow:`0 0 20px rgba(${hexRgb(kpi.color)},0.5)` }}>{kpi.value}</div>
            <div style={{ fontSize:9, color:'rgba(148,163,184,0.5)' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Map + popup side-by-side ── */}
      <div style={{ display:'grid', gridTemplateColumns: selLink ? '1fr 300px' : '1fr', gap:12 }}>

        {/* Map */}
        <div style={{ ...glass(C.purple), padding:12 }}>
          {sectionHead(
            `Road Network · Congestion Risk ${forecastYr}`,
            <AlertTriangle size={14}/>,
            C.purple,
          )}

          {/* Legend */}
          <div style={{ display:'flex', gap:10, marginBottom:8, flexWrap:'wrap' }}>
            {Object.entries(CONG).map(([key, { color, label }]) => (
              <div key={key} style={{ display:'flex', alignItems:'center', gap:5,
                fontSize:9, fontWeight:700, color }}>
                <span style={{ width:18, height:3, background:color,
                  borderRadius:2, display:'inline-block',
                  boxShadow:`0 0 6px ${color}` }}/>
                {label}
              </div>
            ))}
          </div>

          <div style={{ borderRadius:10, overflow:'hidden', height:520,
            boxShadow:`0 0 28px rgba(${hexRgb(C.purple)},0.15)` }}>
            {features.length > 0 && (
              <MapContainer center={[1.37, 32.3]} zoom={6} zoomControl={false}
                style={{ height:'100%', width:'100%', background:'#020508' }}>
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution="&copy; CartoDB"
                />
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade_Dark/MapServer/tile/{z}/{y}/{x}"
                  opacity={0.18}
                />
                <ZoomControl position="bottomright"/>
                <PredLayer
                  features={features}
                  year={forecastYr}
                  onSelect={p => setSelLink(p)}
                />
              </MapContainer>
            )}
          </div>

          <div style={{ marginTop:8, fontSize:9, color:'rgba(100,116,139,0.45)' }}>
            Click any road link to view predictions · Road line weight = road class
          </div>
        </div>

        {/* Link detail panel */}
        {selLink && (
          <LinkPopup
            p={selLink}
            year={forecastYr}
            onClose={() => setSelLink(null)}
          />
        )}
      </div>

      {/* ── Congestion breakdown table ── */}
      <div style={{ ...glass(C.orange), padding:14 }}>
        {sectionHead('Congestion Risk Breakdown by Road Class', <AlertTriangle size={14}/>, C.orange)}
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid rgba(255,107,53,0.2)' }}>
                {['Risk Level','Links','% of Network','Road Weight','Action'].map(h => (
                  <th key={h} style={{ padding:'5px 10px', textAlign:'left',
                    fontSize:9, fontWeight:800, color:'rgba(255,107,53,0.7)',
                    textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {['Critical','High','Medium','Low'].map(level => {
                const linksAtLevel = features.filter(
                  f => congestionAtYear(f.properties, forecastYr) === level
                ).length;
                const pct = features.length > 0 ? (linksAtLevel / features.length * 100).toFixed(1) : '0';
                const col = CONG[level]?.color ?? '#94a3b8';
                const action = level === 'Critical' ? 'Immediate capacity upgrade'
                             : level === 'High'     ? 'Plan capacity improvement'
                             : level === 'Medium'   ? 'Monitor traffic growth'
                             :                       'Routine maintenance';
                return (
                  <tr key={level} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding:'6px 10px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                        <span style={{ width:10, height:10, borderRadius:'50%',
                          background:col, boxShadow:`0 0 6px ${col}`,
                          display:'inline-block' }}/>
                        <span style={{ fontWeight:800, color:col }}>{level}</span>
                      </div>
                    </td>
                    <td style={{ padding:'6px 10px', fontWeight:700, color:'#fff' }}>{linksAtLevel}</td>
                    <td style={{ padding:'6px 10px', color:'rgba(148,163,184,0.7)' }}>{pct}%</td>
                    <td style={{ padding:'6px 10px', color:'rgba(148,163,184,0.5)', fontSize:9 }}>
                      {level === 'Critical' ? 'A/M class priority' : level === 'High' ? 'B class review' : '—'}
                    </td>
                    <td style={{ padding:'6px 10px', fontSize:9, color:'rgba(148,163,184,0.6)' }}>{action}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop:8, fontSize:9, color:'rgba(100,116,139,0.4)' }}>
          Congestion risk = predicted AADT ÷ design capacity (Uganda roads standard) ·
          Capacity: M-class 15k, A-class 10k, B-class 5k, C-class 2.5k PCU/day ·
          Model: XGBoost + LightGBM ensemble, spatial-lag features, trained 2018–2025
        </div>
      </div>

    </div>
  );
}
