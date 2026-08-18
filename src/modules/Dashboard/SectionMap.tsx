/**
 * SectionMap — interactive, section-specific Leaflet map for every dashboard.
 * Renders the national link network from the platform geojson, themed per
 * section (class / risk / AADT band / region), with stations where relevant,
 * a colour legend, attribute popups (aggregates only) and full-width layout.
 */
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup } from 'react-leaflet';

const TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATTR = '(c) CARTO (c) OSM contributors';
const UGA: [number, number] = [1.3733, 32.2903];

type ThemeId = 'class' | 'risk' | 'aadt' | 'region';
const THEME_FOR: Record<string, ThemeId> = {
  rms: 'class', pms: 'risk', tis: 'aadt', bms: 'class',
  ducar: 'region', projects: 'region', reserve: 'risk', pim: 'aadt',
};
const RISK_CLR: Record<string, string> = { Critical: '#ff2d78', High: '#ff6b35', Medium: '#ffd23f', Low: '#00ff88' };
const CLASS_CLR: Record<string, string> = { A: '#00f5ff', B: '#00ff88', C: '#ffd23f', M: '#94a3b8' };
const REGION_CLR: Record<string, string> = { Central: '#00f5ff', Eastern: '#ff6b35', Southern: '#ffd23f', Western: '#00ff88', Northern: '#b967ff', 'North Eastern': '#ff2d78' };
const aadtClr = (v: number) => v >= 15000 ? '#ff2d78' : v >= 5000 ? '#ff6b35' : v >= 1000 ? '#ffd23f' : '#00ff88';

function colorFor(theme: ThemeId, p: Record<string, unknown>): string {
  if (theme === 'class') return CLASS_CLR[String(p.road_class ?? 'M')] ?? '#94a3b8';
  if (theme === 'risk') return RISK_CLR[String(p.congestion_risk ?? '')] ?? '#94a3b8';
  if (theme === 'region') return REGION_CLR[String(p.region ?? '')] ?? '#94a3b8';
  return aadtClr(Number(p.aadt_predicted ?? 0));
}
const LEGEND_ITEMS: Record<ThemeId, [string, string][]> = {
  class: [['Class A', '#00f5ff'], ['Class B', '#00ff88'], ['Class C', '#ffd23f'], ['Unclassified', '#94a3b8']],
  risk: [['Critical', '#ff2d78'], ['High', '#ff6b35'], ['Medium', '#ffd23f'], ['Low', '#00ff88']],
  aadt: [['15k+ AADT', '#ff2d78'], ['5k-15k', '#ff6b35'], ['1k-5k', '#ffd23f'], ['under 1k', '#00ff88']],
  region: [['Central', '#00f5ff'], ['Eastern', '#ff6b35'], ['Southern', '#ffd23f'], ['Western', '#00ff88'], ['Northern', '#b967ff'], ['North Eastern', '#ff2d78']],
};
const TITLE_FOR: Record<string, string> = {
  rms: 'Network by Road Class', pms: 'Network by Condition Risk', tis: 'Network by Traffic Band + Stations',
  bms: 'Structures Corridor Context by Class', ducar: 'Works Network by Region', projects: 'Project Corridors by Region',
  reserve: 'Reserve Pressure by Risk', pim: 'Investment Priority by Traffic Band',
};

export function SectionMap({ sectionId, accent = '#00f5ff' }: { sectionId: string; accent?: string }) {
  const [gj, setGj] = useState<any>(null);
  const [st, setSt] = useState<any[]>([]);
  const theme = THEME_FOR[sectionId] ?? 'class';
  useEffect(() => {
    let dead = false;
    const base = import.meta.env.BASE_URL;
    fetch(base + 'data/traffic_predictions.geojson').then(r => r.json())
      .then(j => { if (!dead) setGj(j); }).catch(() => {});
    if (sectionId === 'tis' || sectionId === 'bms') {
      fetch(base + 'atc_stations.geojson').then(r => r.json())
        .then(j => { if (!dead) setSt(j.features ?? []); }).catch(() => {});
    }
    return () => { dead = true; };
  }, [sectionId]);

  const styleFn = useMemo(() => (f: any) => ({
    color: colorFor(theme, f?.properties ?? {}),
    weight: theme === 'aadt' ? Math.max(1, Math.min(5, (f?.properties?.aadt_predicted ?? 0) / 6000)) : 1.6,
    opacity: 0.85,
  }), [theme]);

  const centroid = (geom: any): [number, number] | null => {
    try { const acc: number[][] = []; const walk = (c: any) => { if (typeof c[0] === 'number') acc.push(c); else c.forEach(walk); };
      walk(geom.coordinates); if (!acc.length) return null;
      return [acc.reduce((s, c) => s + c[1], 0) / acc.length, acc.reduce((s, c) => s + c[0], 0) / acc.length];
    } catch { return null; }
  };

  return (
    <div style={{ width: '100%', margin: '14px 0 10px' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: accent, marginBottom: 6 }}>
        INTERACTIVE SECTION MAP - {(TITLE_FOR[sectionId] ?? 'National Network').toUpperCase()}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
        background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
        padding: '5px 12px', marginBottom: 8, fontSize: 10, color: '#94a3b8' }}>
        <span style={{ fontWeight: 800, color: '#cbd5e1' }}>LEGEND</span>
        {LEGEND_ITEMS[theme].map(([label, c]) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 14, height: 4, borderRadius: 2, background: c, display: 'inline-block' }}/>{label}
          </span>
        ))}
        {st.length > 0 && <span>o Stations ({st.length})</span>}
        <span style={{ marginLeft: 'auto', color: '#475569' }}>click any link for attributes - scroll to zoom</span>
      </div>
      <div style={{ borderRadius: 10, overflow: 'hidden', height: 430, border: '1px solid rgba(255,255,255,0.07)' }}>
        <MapContainer center={UGA} zoom={7} style={{ height: '100%', width: '100%', background: '#0d1117' }} scrollWheelZoom>
          <TileLayer url={TILES} attribution={ATTR}/>
          {gj && (
            <GeoJSON data={gj} style={styleFn}
              onEachFeature={(f: any, l: any) => {
                const p = f.properties ?? {};
                l.bindPopup('<b>' + (p.link_name ?? p.link_id ?? 'Link') + '</b><br/>'
                  + 'Road: ' + (p.road_no ?? '-') + ' - Class ' + (p.road_class ?? 'M') + '<br/>'
                  + 'Region: ' + (p.region ?? '-') + '<br/>'
                  + 'Length: ' + (p.length_km ?? '-') + ' km<br/>'
                  + 'AADT: ' + Number(p.aadt_predicted ?? 0).toLocaleString() + '<br/>'
                  + 'Heavy: ' + (p.heavy_vehicle_pct ?? '-') + '%<br/>'
                  + 'Risk: ' + (p.congestion_risk ?? '-'));
              }}/>
          )}
          {st.map((s: any, i: number) => {
            const c = centroid(s.geometry); if (!c) return null;
            return (
              <CircleMarker key={'st' + i} center={c} radius={4}
                pathOptions={{ color: accent, fillColor: accent, fillOpacity: 0.8, weight: 1 }}>
                <Popup><b>{s.properties?.TCS_NAME ?? s.properties?.STATION ?? 'Station'}</b><br/>
                  TCS {String(s.properties?.TCS_NO ?? '-')} - {s.properties?.REGION ?? '-'}</Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

export default SectionMap;
