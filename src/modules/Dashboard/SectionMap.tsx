/**
 * SectionMap - interactive, section-specific Leaflet map for every dashboard.
 * Renders the national link network from the platform geojson, themed per
 * section (class / risk / AADT band / region), with stations where relevant,
 * a colour legend, and a right-hand slide-in detail pane on click (instead of
 * plain Leaflet popups) for fast, high-interactivity inspection.
 */
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker } from 'react-leaflet';
import { X, Radio, Route as RouteIcon } from 'lucide-react';
import MapGISControls, { UGANDA_BOUNDS } from '../../shared/MapGISControls';

const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ATTR = 'Esri, Maxar';
const LABEL_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
const UGA: [number, number] = [1.3733, 32.2903];

type ThemeId = 'class' | 'risk' | 'aadt' | 'region';
const THEME_FOR: Record<string, ThemeId> = {
  rms: 'class', pms: 'risk', tis: 'aadt', bms: 'class',
  ducar: 'region', projects: 'region', reserve: 'risk', pim: 'aadt',
};
// Canonical risk/condition scale (matches src/utils/helpers.ts RISK_SCALE_STOPS)
const RISK_CLR: Record<string, string> = { Critical: '#ef4444', High: '#f97316', Medium: '#84cc16', Low: '#22c55e' };
const CLASS_CLR: Record<string, string> = { A: '#00f5ff', B: '#00ff88', C: '#ffd23f', M: '#94a3b8' };
const REGION_CLR: Record<string, string> = { Central: '#00f5ff', Eastern: '#ff6b35', Southern: '#ffd23f', Western: '#00ff88', Northern: '#b967ff', 'North Eastern': '#ff2d78' };
const aadtClr = (v: number) => v >= 15000 ? '#ef4444' : v >= 5000 ? '#f97316' : v >= 1000 ? '#84cc16' : '#22c55e';

function colorFor(theme: ThemeId, p: Record<string, unknown>): string {
  if (theme === 'class') return CLASS_CLR[String(p.road_class ?? 'M')] ?? '#94a3b8';
  if (theme === 'risk') return RISK_CLR[String(p.congestion_risk ?? '')] ?? '#94a3b8';
  if (theme === 'region') return REGION_CLR[String(p.region ?? '')] ?? '#94a3b8';
  return aadtClr(Number(p.aadt_predicted ?? 0));
}
const LEGEND_ITEMS: Record<ThemeId, [string, string][]> = {
  class: [['Class A', '#00f5ff'], ['Class B', '#00ff88'], ['Class C', '#ffd23f'], ['Unclassified', '#94a3b8']],
  risk: [['Critical', '#ef4444'], ['High', '#f97316'], ['Medium', '#84cc16'], ['Low', '#22c55e']],
  aadt: [['15k+ AADT', '#ef4444'], ['5k-15k', '#f97316'], ['1k-5k', '#84cc16'], ['under 1k', '#22c55e']],
  region: [['Central', '#00f5ff'], ['Eastern', '#ff6b35'], ['Southern', '#ffd23f'], ['Western', '#00ff88'], ['Northern', '#b967ff'], ['North Eastern', '#ff2d78']],
};
const TITLE_FOR: Record<string, string> = {
  rms: 'Network by Road Class', pms: 'Network by Condition Risk', tis: 'Network by Traffic Band + Stations',
  bms: 'Structures Corridor Context by Class', ducar: 'Works Network by Region', projects: 'Project Corridors by Region',
  reserve: 'Reserve Pressure by Risk', pim: 'Investment Priority by Traffic Band',
};

interface LinkSelection { kind: 'link'; props: Record<string, unknown> }
interface StationSelection { kind: 'station'; props: Record<string, unknown> }
type Selection = LinkSelection | StationSelection | null;

function Field({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
      <div style={{ fontSize: 12, color: '#e2eaf4', fontWeight: 700, marginTop: 2 }}>{v}</div>
    </div>
  );
}

function DetailPane({ selection, accent, onClose }: { selection: Selection; accent: string; onClose: () => void }) {
  if (!selection) {
    return (
      <div style={{
        width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 10, color: 'rgba(148,163,184,0.45)', padding: 20, textAlign: 'center',
      }}>
        <RouteIcon size={26} style={{ opacity: 0.4 }} />
        <div style={{ fontSize: 11 }}>Click a road link or station on the map to inspect its attributes here.</div>
      </div>
    );
  }
  const p = selection.props;
  const isLink = selection.kind === 'link';
  return (
    <div style={{
      width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      animation: 'sm-slide-in 0.22s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', borderBottom: `1px solid ${accent}33` }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${accent}22`, color: accent,
        }}>
          {isLink ? <RouteIcon size={14} /> : <Radio size={14} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 900, color: '#e2eaf4', lineHeight: 1.3 }}>
            {isLink ? String(p.link_name ?? p.link_id ?? 'Road Link') : String(p.TCS_NAME ?? p.STATION ?? 'Station')}
          </div>
          <div style={{ fontSize: 9.5, color: accent, fontWeight: 700, marginTop: 1 }}>
            {isLink ? 'ROAD LINK' : 'TRAFFIC COUNT STATION'}
          </div>
        </div>
        <button onClick={onClose} style={{
          width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.06)', color: 'rgba(226,234,244,0.7)', cursor: 'pointer',
        }}><X size={12} /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {isLink ? (
          <>
            <Field l="Road No." v={String(p.road_no ?? '-')} />
            <Field l="Class" v={String(p.road_class ?? '-')} />
            <Field l="Region" v={String(p.region ?? '-')} />
            <Field l="Length" v={`${p.length_km ?? '-'} km`} />
            <Field l="AADT" v={Number(p.aadt_predicted ?? 0).toLocaleString()} />
            <Field l="Heavy Vehicle %" v={`${p.heavy_vehicle_pct ?? '-'}%`} />
            <div style={{ gridColumn: '1 / -1' }}>
              <Field l="Congestion Risk" v={String(p.congestion_risk ?? '-')} />
            </div>
          </>
        ) : (
          <>
            <Field l="TCS No." v={String(p.TCS_NO ?? '-')} />
            <Field l="Region" v={String(p.REGION ?? '-')} />
            <div style={{ gridColumn: '1 / -1' }}>
              <Field l="Road No." v={String(p.ROAD_NO ?? p.road_no ?? '-')} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SectionMap({ sectionId, accent = '#00f5ff', fill = false }: { sectionId: string; accent?: string; fill?: boolean }) {
  const [gj, setGj] = useState<any>(null);
  const [st, setSt] = useState<any[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
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

  const mapEl = (
    <MapContainer center={UGA} zoom={7} zoomControl={false} style={{ height: '100%', width: '100%', background: '#0d1117' }} scrollWheelZoom>
      <TileLayer url={TILES} attribution={ATTR}/>
      <TileLayer url={LABEL_TILES} opacity={0.85} attribution="Esri"/>
      <MapGISControls bounds={UGANDA_BOUNDS} accent={accent} position="bottomright" />
      {gj && (
        <GeoJSON data={gj} style={styleFn}
          onEachFeature={(f: any, l: any) => {
            l.on({ click: () => setSelection({ kind: 'link', props: f.properties ?? {} }) });
          }}/>
      )}
      {st.map((s: any, i: number) => {
        const c = centroid(s.geometry); if (!c) return null;
        return (
          <CircleMarker key={'st' + i} center={c} radius={5}
            pathOptions={{ color: accent, fillColor: accent, fillOpacity: 0.85, weight: 1.5 }}
            eventHandlers={{ click: () => setSelection({ kind: 'station', props: s.properties ?? {} }) }}
          />
        );
      })}
    </MapContainer>
  );

  const legend = (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
      background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
      padding: '5px 12px', marginBottom: 8, fontSize: 10, color: '#94a3b8' }}>
      <span style={{ fontWeight: 800, color: '#cbd5e1' }}>LEGEND</span>
      {LEGEND_ITEMS[theme].map(([label, c]) => (
        <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 14, height: 4, borderRadius: 2, background: c, display: 'inline-block' }}/>{label}
        </span>
      ))}
      {st.length > 0 && <span>● Stations ({st.length})</span>}
      <span style={{ marginLeft: 'auto', color: '#475569' }}>click any link or station to inspect →</span>
    </div>
  );

  if (fill) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <style>{`@keyframes sm-slide-in { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }`}</style>
        <div style={{ padding: '10px 12px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: accent, marginBottom: 6 }}>
            INTERACTIVE SECTION MAP - {(TITLE_FOR[sectionId] ?? 'National Network').toUpperCase()}
          </div>
          {legend}
        </div>
        <div style={{ flex: 1, display: 'flex', minHeight: 0, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>{mapEl}</div>
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,14,28,0.6)' }}>
            <DetailPane selection={selection} accent={accent} onClose={() => setSelection(null)} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', margin: '14px 0 10px' }}>
      <style>{`@keyframes sm-slide-in { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }`}</style>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: accent, marginBottom: 6 }}>
        INTERACTIVE SECTION MAP - {(TITLE_FOR[sectionId] ?? 'National Network').toUpperCase()}
      </div>
      {legend}
      <div style={{ borderRadius: 10, overflow: 'hidden', height: 430, border: '1px solid rgba(255,255,255,0.07)', display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>{mapEl}</div>
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,14,28,0.6)' }}>
          <DetailPane selection={selection} accent={accent} onClose={() => setSelection(null)} />
        </div>
      </div>
    </div>
  );
}

export default SectionMap;
