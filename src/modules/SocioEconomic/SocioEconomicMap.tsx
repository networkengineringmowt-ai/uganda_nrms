/**
 * SocioEconomicMap - Socio-Economic Analysis "Interactive Map" tab.
 * Recovered from the pre-deletion SocioEconomicSection.tsx (commit 5f049e5^).
 * The generic SectionMap the hub renders for every section only themes the
 * road network - it carries none of the district / resource / energy /
 * environment / economic-zone geography this section is actually about, so
 * a bespoke Leaflet map earns its place here. Layers are toggled with plain
 * checkboxes (not a tab-switcher); every lat/lng value below is plotted only
 * as a map marker, never as a chart axis.
 */
import { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS } from '../../shared/mapSymbols';

const UGA: [number, number] = [1.3733, 32.2903];
const ZOOM = 7;

interface District { n: string; reg: string; pop: number; area_km2: number; gdp_m: number; poverty: number; literacy: number; lat: number; lng: number }
const DISTRICTS: District[] = [
  { n: 'Kampala', reg: 'Central', pop: 3600000, area_km2: 189, gdp_m: 12400, poverty: 8, literacy: 90, lat: 0.3476, lng: 32.5825 },
  { n: 'Wakiso', reg: 'Central', pop: 2200000, area_km2: 2807, gdp_m: 3200, poverty: 12, literacy: 87, lat: 0.4040, lng: 32.4600 },
  { n: 'Mukono', reg: 'Central', pop: 950000, area_km2: 4958, gdp_m: 850, poverty: 21, literacy: 82, lat: 0.3542, lng: 32.7558 },
  { n: 'Mbarara', reg: 'Western', pop: 700000, area_km2: 1846, gdp_m: 680, poverty: 24, literacy: 78, lat: -0.6072, lng: 30.6545 },
  { n: 'Gulu', reg: 'Northern', pop: 580000, area_km2: 3446, gdp_m: 420, poverty: 41, literacy: 70, lat: 2.7809, lng: 32.2994 },
  { n: 'Lira', reg: 'Northern', pop: 620000, area_km2: 2988, gdp_m: 380, poverty: 45, literacy: 67, lat: 2.2499, lng: 32.9003 },
  { n: 'Mbale', reg: 'Eastern', pop: 530000, area_km2: 249, gdp_m: 350, poverty: 32, literacy: 74, lat: 1.0796, lng: 34.1753 },
  { n: 'Jinja', reg: 'Eastern', pop: 490000, area_km2: 2534, gdp_m: 620, poverty: 26, literacy: 80, lat: 0.4478, lng: 33.2026 },
  { n: 'Kasese', reg: 'Western', pop: 890000, area_km2: 3044, gdp_m: 310, poverty: 38, literacy: 68, lat: 0.1825, lng: 30.0827 },
  { n: 'Arua', reg: 'West Nile', pop: 980000, area_km2: 3439, gdp_m: 290, poverty: 52, literacy: 62, lat: 3.0200, lng: 30.9109 },
  { n: 'Soroti', reg: 'Eastern', pop: 430000, area_km2: 4229, gdp_m: 220, poverty: 39, literacy: 71, lat: 1.7148, lng: 33.6108 },
  { n: 'Kabale', reg: 'Western', pop: 550000, area_km2: 1937, gdp_m: 280, poverty: 30, literacy: 76, lat: -1.2508, lng: 29.9891 },
  { n: 'Hoima', reg: 'Western', pop: 580000, area_km2: 3609, gdp_m: 890, poverty: 29, literacy: 73, lat: 1.4360, lng: 31.3538 },
  { n: 'Tororo', reg: 'Eastern', pop: 520000, area_km2: 1783, gdp_m: 340, poverty: 28, literacy: 75, lat: 0.6921, lng: 34.1813 },
  { n: 'Moroto', reg: 'Karamoja', pop: 210000, area_km2: 3571, gdp_m: 82, poverty: 78, literacy: 38, lat: 2.5345, lng: 34.6680 },
  { n: 'Kitgum', reg: 'Northern', pop: 370000, area_km2: 7200, gdp_m: 140, poverty: 55, literacy: 58, lat: 3.2783, lng: 32.8868 },
  { n: 'Iganga', reg: 'Eastern', pop: 680000, area_km2: 1731, gdp_m: 260, poverty: 35, literacy: 72, lat: 0.6090, lng: 33.4687 },
  { n: 'Fort Portal', reg: 'Western', pop: 410000, area_km2: 1593, gdp_m: 310, poverty: 27, literacy: 77, lat: 0.6710, lng: 30.2750 },
  { n: 'Masaka', reg: 'Central', pop: 760000, area_km2: 2721, gdp_m: 490, poverty: 22, literacy: 83, lat: -0.3462, lng: 31.7364 },
  { n: 'Nebbi', reg: 'West Nile', pop: 460000, area_km2: 2067, gdp_m: 165, poverty: 49, literacy: 60, lat: 2.4762, lng: 31.0893 },
];

const MINERALS = [
  { n: 'Kilembe Mine', lat: 0.2100, lng: 30.0100, type: 'Copper/Cobalt', status: 'Explored', val_usd_m: 320 },
  { n: 'Muko Iron Ore', lat: -1.0800, lng: 29.7000, type: 'Iron Ore', status: 'Explored', val_usd_m: 2100 },
  { n: 'Sukulu Phosphates', lat: 0.6000, lng: 34.0800, type: 'Phosphate', status: 'Active', val_usd_m: 890 },
  { n: 'Busia Gold', lat: 0.4600, lng: 34.0900, type: 'Gold', status: 'Active', val_usd_m: 180 },
  { n: 'Hima Limestone', lat: 0.3300, lng: 30.2200, type: 'Limestone', status: 'Active', val_usd_m: 95 },
  { n: 'Mubende Gold', lat: 0.5700, lng: 31.3700, type: 'Gold', status: 'Active', val_usd_m: 120 },
  { n: 'Agago Rare Earths', lat: 3.0000, lng: 33.1000, type: 'REE', status: 'Explored', val_usd_m: 210 },
];

const OIL_BLOCKS = [
  { n: 'EA1 Kingfisher', lat: 1.1000, lng: 31.1000, op: 'CNOOC Uganda', status: 'Development' },
  { n: 'EA2 Tilenga', lat: 2.1000, lng: 31.5000, op: 'TotalEnergies EP Uganda', status: 'Development' },
  { n: 'EA1A Jobi-Rii', lat: 1.5000, lng: 31.2000, op: 'TotalEnergies EP Uganda', status: 'Development' },
  { n: 'EACOP Terminal', lat: 0.3200, lng: 32.6000, op: 'EACOP Ltd Consortium', status: 'Under Construction' },
];

const POWER_PLANTS = [
  { n: 'Karuma HPP', lat: 2.2300, lng: 32.2600, cap_mw: 600, type: 'Hydro', status: 'Commissioning' },
  { n: 'Bujagali HPP', lat: 0.4500, lng: 33.1500, cap_mw: 250, type: 'Hydro', status: 'Operational' },
  { n: 'Isimba HPP', lat: 0.5600, lng: 33.0000, cap_mw: 183, type: 'Hydro', status: 'Operational' },
  { n: 'Kabale Solar Farm', lat: -1.2600, lng: 30.0000, cap_mw: 10, type: 'Solar', status: 'Operational' },
  { n: 'Ayago HPP', lat: 2.5500, lng: 31.9000, cap_mw: 840, type: 'Hydro', status: 'Planned' },
];

const PROTECTED_AREAS = [
  { n: 'Murchison Falls NP', lat: 2.2700, lng: 31.6500, area_km2: 3840 },
  { n: 'Queen Elizabeth NP', lat: -0.1000, lng: 30.0000, area_km2: 1978 },
  { n: 'Kibale NP', lat: 0.4900, lng: 30.3500, area_km2: 766 },
  { n: 'Bwindi Impenetrable NP', lat: -1.0500, lng: 29.7000, area_km2: 321 },
  { n: 'Kidepo Valley NP', lat: 3.8200, lng: 33.8600, area_km2: 1442 },
];

const ECONOMIC_ZONES = [
  { n: 'Namanve Industrial & Business Park', lat: 0.3100, lng: 32.7000, invest_m: 850, status: 'Operational' },
  { n: 'Kampala Industrial & Business Park', lat: 0.3200, lng: 32.5600, invest_m: 320, status: 'Operational' },
  { n: 'Jinja Industrial & Business Park', lat: 0.4500, lng: 33.2200, invest_m: 180, status: 'Operational' },
  { n: 'Buikwe SEZ', lat: 0.3600, lng: 33.0100, invest_m: 120, status: 'Developing' },
];

type LayerId = 'districts' | 'minerals' | 'oil' | 'power' | 'protected' | 'zones';
const LAYERS: { id: LayerId; label: string; color: string }[] = [
  { id: 'districts', label: 'Districts - pop. & poverty', color: '#a5b4fc' },
  { id: 'minerals', label: 'Mineral Deposits', color: '#eab308' },
  { id: 'oil', label: 'Oil & Gas Blocks', color: '#3b82f6' },
  { id: 'power', label: 'Power Plants', color: '#f97316' },
  { id: 'protected', label: 'Protected Areas', color: '#22c55e' },
  { id: 'zones', label: 'Economic Zones', color: '#a855f7' },
];

export default function SocioEconomicMap() {
  const [on, setOn] = useState<Record<LayerId, boolean>>({
    districts: true, minerals: true, oil: true, power: true, protected: false, zones: false,
  });
  const toggle = (id: LayerId) => setOn(o => ({ ...o, [id]: !o[id] }));

  return (
    <div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 10, padding: '8px 12px',
        background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
      }}>
        {LAYERS.map(l => (
          <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#cbd5e1', cursor: 'pointer' }}>
            <input type="checkbox" checked={on[l.id]} onChange={() => toggle(l.id)} />
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
            {l.label}
          </label>
        ))}
      </div>

      <div style={{ borderRadius: 10, overflow: 'hidden', height: 560, border: '1px solid rgba(255,255,255,0.07)' }}>
        <MapContainer center={UGA} zoom={ZOOM} style={{ height: '100%', width: '100%', background: '#0d1117' }} scrollWheelZoom>
          <TileLayer url={ESRI_TILE_URLS.imagery} attribution={ESRI_ATTRIBUTIONS.imagery} />
          <TileLayer url={ESRI_TILE_URLS.labels} attribution={ESRI_ATTRIBUTIONS.labels} opacity={0.7} />

          {on.districts && DISTRICTS.map((d, i) => {
            const density = Math.round(d.pop / d.area_km2);
            const intensity = Math.min(1, density / 500);
            const r = Math.round(255 * intensity);
            const b = Math.round(255 * (1 - intensity));
            return (
              <CircleMarker key={'d' + i} center={[d.lat, d.lng]} radius={Math.max(7, Math.sqrt(d.pop / 80000))}
                pathOptions={{ color: '#fff', fillColor: `rgba(${r},40,${b},0.82)`, fillOpacity: 0.85, weight: 0.8 }}>
                <Popup>
                  <b>{d.n} District</b><br />
                  <span style={{ fontSize: 11 }}>
                    Population: {d.pop.toLocaleString()}<br />
                    Area: {d.area_km2.toLocaleString()} km²<br />
                    Density: {density}/km²<br />
                    Region: {d.reg}<br />
                    GDP: USD {d.gdp_m}M<br />
                    Poverty: {d.poverty}%<br />
                    Literacy: {d.literacy}%
                  </span>
                </Popup>
              </CircleMarker>
            );
          })}

          {on.minerals && MINERALS.map((m, i) => (
            <CircleMarker key={'m' + i} center={[m.lat, m.lng]} radius={Math.max(5, Math.sqrt(m.val_usd_m / 20))}
              pathOptions={{ color: m.status === 'Active' ? '#eab308' : '#64748b', fillColor: m.status === 'Active' ? '#92400e' : '#374151', fillOpacity: 0.85, weight: 1.5 }}>
              <Popup><b>{m.n}</b><br /><span style={{ fontSize: 11 }}>Type: {m.type}<br />Status: {m.status}<br />Est. Value: USD {m.val_usd_m}M</span></Popup>
            </CircleMarker>
          ))}

          {on.oil && OIL_BLOCKS.map((o, i) => (
            <CircleMarker key={'o' + i} center={[o.lat, o.lng]} radius={12}
              pathOptions={{ color: '#3b82f6', fillColor: '#1e3a5f', fillOpacity: 0.7, weight: 2 }}>
              <Popup><b>{o.n}</b><br /><span style={{ fontSize: 11 }}>Operator: {o.op}<br />Status: {o.status}</span></Popup>
            </CircleMarker>
          ))}

          {on.power && POWER_PLANTS.map((p, i) => (
            <CircleMarker key={'p' + i} center={[p.lat, p.lng]} radius={Math.max(5, Math.sqrt(p.cap_mw / 6))}
              pathOptions={{ color: p.type === 'Hydro' ? '#3b82f6' : '#eab308', fillColor: p.status === 'Operational' ? '#ca8a04' : '#374151', fillOpacity: 0.85, weight: 1.5 }}>
              <Popup><b>{p.n}</b><br /><span style={{ fontSize: 11 }}>Type: {p.type}<br />Capacity: {p.cap_mw} MW<br />Status: {p.status}</span></Popup>
            </CircleMarker>
          ))}

          {on.protected && PROTECTED_AREAS.map((p, i) => (
            <CircleMarker key={'pa' + i} center={[p.lat, p.lng]} radius={Math.max(7, Math.sqrt(p.area_km2 / 35))}
              pathOptions={{ color: '#22c55e', fillColor: '#166534', fillOpacity: 0.7, weight: 1.5 }}>
              <Popup><b>{p.n}</b><br /><span style={{ fontSize: 11 }}>Area: {p.area_km2.toLocaleString()} km²</span></Popup>
            </CircleMarker>
          ))}

          {on.zones && ECONOMIC_ZONES.map((z, i) => (
            <CircleMarker key={'z' + i} center={[z.lat, z.lng]} radius={9}
              pathOptions={{ color: '#a855f7', fillColor: '#6b21a8', fillOpacity: 0.75, weight: 1.5 }}>
              <Popup><b>{z.n}</b><br /><span style={{ fontSize: 11 }}>Investment: USD {z.invest_m}M<br />Status: {z.status}</span></Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 8 }}>
        Toggle layers above. District circles are coloured blue (sparse) to red (dense) and sized by population.
      </div>
    </div>
  );
}
