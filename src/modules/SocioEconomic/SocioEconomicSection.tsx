import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
  Globe, GraduationCap, Heart, Mountain, Tractor, Factory, Users,
  TrendingUp, MapPin, DollarSign, Activity, Zap, Droplets, Building2,
  BookOpen, Layers, AlertCircle, CheckCircle, Clock
} from 'lucide-react';

/* ─────────────── STATIC DATA ─────────────── */

const UGANDA_CENTER: [number, number] = [1.3733, 32.2903];
const UGANDA_ZOOM = 7;

const STATS = {
  population: 45741007,
  area: 241551,
  districts: 146,
  gdpUSD: 49.27e9,
  gdpPerCapita: 1076,
  literacyRate: 79,
  hdi: 0.544,
  povertyRate: 20.3,
  ruralPop: 76,
  urbanPop: 24,
  avgGrowth: 6.1,
  roadLength: 20544,
};

const MINERALS: Array<{ name: string; type: string; lat: number; lng: number; quantity: string; color: string; status: string; value: string }> = [
  { name: 'Oil – Kingfisher Field', type: 'oil', lat: 1.65, lng: 31.10, quantity: '6.5 bn barrels (proved)', color: '#1a1a2e', status: 'Under development', value: '$~20B' },
  { name: 'Oil – Jobi Rii Field', type: 'oil', lat: 2.12, lng: 31.41, quantity: 'Significant reserves', color: '#1a1a2e', status: 'Development', value: 'Est. $B+' },
  { name: 'Copper / Cobalt – Kilembe', type: 'copper', lat: 0.18, lng: 30.07, quantity: '>4 million tonnes Cu', color: '#b87333', status: 'Suspended (rehab)', value: '$8B est.' },
  { name: 'Limestone – Tororo', type: 'limestone', lat: 0.71, lng: 34.17, quantity: '300 million tonnes', color: '#d4c5a9', status: 'Active – cement', value: 'Commercial' },
  { name: 'Iron Ore / Phosphates – Sukulu', type: 'iron', lat: 0.79, lng: 34.15, quantity: '200M t iron + 230M t phosphate', color: '#8B4513', status: 'Pre-development', value: '$2B+' },
  { name: 'Gold – Murchison Belt', type: 'gold', lat: 2.25, lng: 31.78, quantity: 'Large, ongoing exploration', color: '#FFD700', status: 'Active artisanal & industrial', value: 'High' },
  { name: 'Rock Salt – Lake Katwe', type: 'salt', lat: -0.022, lng: 29.91, quantity: '30 million tonnes', color: '#E0F2FE', status: 'Active', value: 'Commercial' },
  { name: 'Limestone – Hima', type: 'limestone', lat: 0.31, lng: 30.05, quantity: 'Large deposit', color: '#d4c5a9', status: 'Active – cement', value: 'Commercial' },
  { name: 'Gold / Tungsten – Buhweju', type: 'gold', lat: -0.38, lng: 30.34, quantity: 'Significant deposits', color: '#FFD700', status: 'Exploration', value: 'Est. high' },
  { name: 'Nickel – Kabale', type: 'nickel', lat: -1.25, lng: 29.99, quantity: 'Identified deposits', color: '#A8A9AD', status: 'Exploration', value: 'TBD' },
  { name: 'Marble – Moroto', type: 'marble', lat: 2.54, lng: 34.67, quantity: 'Large ornamental deposits', color: '#F8F8F0', status: 'Active', value: 'Commercial' },
  { name: 'Vermiculite – Namekara', type: 'vermiculite', lat: 1.20, lng: 34.25, quantity: 'Known deposits', color: '#CD853F', status: 'Exploration', value: 'TBD' },
  { name: 'Tin / Coltan – Kigezi', type: 'coltan', lat: -1.10, lng: 29.80, quantity: 'Artisanal deposits', color: '#708090', status: 'Artisanal mining', value: 'Moderate' },
];

const AGRI_ZONES = [
  { name: 'Arabica Coffee', region: 'Mt. Elgon / Bugisu', lat: 1.07, lng: 34.47, color: '#6F4E37', pct: 12, export: '$600M/yr' },
  { name: 'Robusta Coffee', region: 'Rwenzori / Central', lat: 0.40, lng: 30.20, color: '#7B4B2A', pct: 18, export: '$600M/yr' },
  { name: 'Tea', region: 'Kigezi (Kabale)', lat: -1.25, lng: 29.99, color: '#228B22', pct: 4, export: '$90M/yr' },
  { name: 'Tea', region: 'Kayonza Forest', lat: -0.85, lng: 29.75, color: '#228B22', pct: 3, export: 'Incl. above' },
  { name: 'Sugarcane', region: 'Busoga (Jinja)', lat: 0.43, lng: 33.20, color: '#90EE90', pct: 6, export: '$100M/yr' },
  { name: 'Cotton', region: 'Northern Uganda', lat: 2.50, lng: 32.50, color: '#F5F5DC', pct: 8, export: '$40M/yr' },
  { name: 'Vanilla', region: 'Bundibugyo', lat: 0.72, lng: 30.07, color: '#F3E5AB', pct: 2, export: '$60M/yr' },
  { name: 'Tobacco', region: 'West Nile', lat: 3.10, lng: 31.10, color: '#C8A165', pct: 3, export: '$30M/yr' },
  { name: 'Rice', region: 'Eastern Uganda', lat: 1.30, lng: 33.80, color: '#FFF8DC', pct: 5, export: 'Domestic' },
  { name: 'Nile Perch (Fish)', region: 'Lake Victoria', lat: -0.10, lng: 32.90, color: '#4169E1', pct: 6, export: '$150M/yr' },
  { name: 'Maize', region: 'Central / Eastern', lat: 0.35, lng: 32.20, color: '#FFE135', pct: 14, export: 'Regional' },
  { name: 'Banana / Matoke', region: 'Central / Western', lat: 0.00, lng: 31.00, color: '#FFFF00', pct: 10, export: 'Domestic' },
];

const CITIES = [
  { name: 'Kampala', lat: 0.347, lng: 32.582, pop: 1650800, capital: true, role: 'Capital & commercial hub' },
  { name: 'Gulu', lat: 2.774, lng: 32.298, pop: 170183, capital: false, role: 'Northern regional capital' },
  { name: 'Mbarara', lat: -0.607, lng: 30.656, pop: 195000, capital: false, role: 'Western regional capital' },
  { name: 'Jinja', lat: 0.425, lng: 33.205, pop: 300000, capital: false, role: 'Industrial & sugar hub' },
  { name: 'Mbale', lat: 1.068, lng: 34.175, pop: 108778, capital: false, role: 'Eastern gateway / coffee' },
  { name: 'Fort Portal', lat: 0.671, lng: 30.275, pop: 69400, capital: false, role: 'Tourism & tea' },
  { name: 'Masaka', lat: -0.333, lng: 31.734, pop: 103400, capital: false, role: 'Agriculture & trade' },
  { name: 'Entebbe', lat: 0.047, lng: 32.461, pop: 69958, capital: false, role: 'International gateway' },
  { name: 'Hoima', lat: 1.433, lng: 31.350, pop: 98163, capital: false, role: 'Oil industry hub' },
  { name: 'Lira', lat: 2.250, lng: 32.900, pop: 119323, capital: false, role: 'Northern commercial centre' },
  { name: 'Arua', lat: 3.020, lng: 30.912, pop: 121000, capital: false, role: 'West Nile trade hub' },
  { name: 'Soroti', lat: 1.714, lng: 33.611, pop: 62900, capital: false, role: 'Teso agri centre' },
  { name: 'Kasese', lat: 0.184, lng: 30.081, pop: 101000, capital: false, role: 'Minerals & tourism' },
  { name: 'Tororo', lat: 0.695, lng: 34.176, pop: 77000, capital: false, role: 'Cement & industry' },
];

const GDP_DATA = [
  { year: '2018', gdp: 34.38, growth: 6.2 },
  { year: '2019', gdp: 37.06, growth: 7.9 },
  { year: '2020', gdp: 37.74, growth: 2.9 },
  { year: '2021', gdp: 40.37, growth: 6.7 },
  { year: '2022', gdp: 45.06, growth: 4.9 },
  { year: '2023', gdp: 48.28, growth: 5.3 },
];

const SECTORS = [
  { sector: 'Services', pct: 47.0, color: '#3B82F6' },
  { sector: 'Industry', pct: 27.3, color: '#10B981' },
  { sector: 'Agriculture', pct: 24.1, color: '#F59E0B' },
  { sector: 'Other', pct: 1.6, color: '#6B7280' },
];

const REGION_DATA = [
  { region: 'Central', population: 10857179, area: 61403, density: 177, hdi: 0.598, schools: 4820, hospitals: 312 },
  { region: 'Eastern', population: 12225534, area: 39479, density: 310, hdi: 0.501, schools: 5234, hospitals: 289 },
  { region: 'Northern', population: 9018003, area: 85392, density: 106, hdi: 0.472, schools: 3890, hospitals: 198 },
  { region: 'Western', population: 12225534, area: 55311, density: 221, hdi: 0.538, schools: 4670, hospitals: 276 },
];

const INDUSTRY_SITES = [
  { name: 'Kakira Sugar Works', lat: 0.47, lng: 33.28, type: 'Sugar processing', capacity: '170,000 t/yr' },
  { name: 'Uganda Breweries (Nile)', lat: 0.43, lng: 33.22, type: 'Beer / beverages', capacity: 'Major' },
  { name: 'Tororo Cement', lat: 0.69, lng: 34.17, type: 'Cement', capacity: '1.5M t/yr' },
  { name: 'Hima Cement', lat: 0.31, lng: 30.05, type: 'Cement', capacity: '0.75M t/yr' },
  { name: 'Namanve Industrial Park', lat: 0.32, lng: 32.69, type: 'Multi-sector park', capacity: '1,000+ firms' },
  { name: 'Luzira Industrial Area', lat: 0.30, lng: 32.64, type: 'Steel / manufacturing', capacity: 'Major' },
  { name: 'Soroti Fruit Factory', lat: 1.71, lng: 33.61, type: 'Fruit processing', capacity: '50,000 t/yr' },
  { name: 'Luweero Pineapple', lat: 0.85, lng: 32.48, type: 'Agro-processing', capacity: 'Growing' },
  { name: 'Bujagali Hydropower', lat: 0.47, lng: 33.17, type: 'Hydro power', capacity: '250 MW' },
  { name: 'Karuma Hydropower', lat: 2.23, lng: 32.27, type: 'Hydro power', capacity: '600 MW' },
  { name: 'Isimba Hydropower', lat: 0.47, lng: 33.00, type: 'Hydro power', capacity: '183 MW' },
  { name: 'Tilenga Oil Project', lat: 2.28, lng: 31.40, type: 'Oil production', capacity: '190,000 bbl/day' },
  { name: 'Kibiro Salt Works', lat: 1.58, lng: 31.26, type: 'Salt extraction', capacity: 'Artisanal' },
];

/* ─────────────── HELPERS ─────────────── */

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ background: color + '22', color, borderRadius: 10, padding: 10, display: 'flex' }}>{icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f5f5f7' }}>{value}</div>
        <div style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

const MINERAL_COLORS: Record<string, string> = {
  oil: '#1a1a2e', copper: '#b87333', limestone: '#d4c5a9', iron: '#8B4513',
  gold: '#FFD700', salt: '#ADD8E6', nickel: '#A8A9AD', marble: '#F8F8F0',
  vermiculite: '#CD853F', coltan: '#708090', phosphate: '#90EE90',
};

/* ─────────────── MAP FIT ─────────────── */

function FitUganda() {
  const map = useMap();
  useEffect(() => { map.setView(UGANDA_CENTER, UGANDA_ZOOM); }, [map]);
  return null;
}

/* ─────────────── TABS ─────────────── */

const TABS = [
  { id: 'dashboard', label: 'Overview', icon: <Globe size={14} /> },
  { id: 'minerals', label: 'Minerals & Resources', icon: <Mountain size={14} /> },
  { id: 'agriculture', label: 'Agriculture', icon: <Tractor size={14} /> },
  { id: 'industry', label: 'Industry & Energy', icon: <Factory size={14} /> },
  { id: 'education', label: 'Education', icon: <GraduationCap size={14} /> },
  { id: 'health', label: 'Health', icon: <Heart size={14} /> },
  { id: 'demographics', label: 'Demographics', icon: <Users size={14} /> },
  { id: 'economy', label: 'Economy', icon: <TrendingUp size={14} /> },
];

/* ─────────────── MAP PANEL (reusable) ─────────────── */

function MapPanel({ children, height = 500 }: { children: React.ReactNode; height?: number }) {
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', height }}>
      <MapContainer
        center={UGANDA_CENTER}
        zoom={UGANDA_ZOOM}
        style={{ height: '100%', width: '100%', background: '#1a1a2e' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        />
        <FitUganda />
        {children}
      </MapContainer>
    </div>
  );
}

/* ─────────────── OVERPASS HOOK ─────────────── */

type OSMFeature = { lat: number; lng: number; name: string; tags: Record<string, string> };

function useOverpass(query: string, enabled: boolean) {
  const [data, setData] = useState<OSMFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    const url = 'https://overpass-api.de/api/interpreter';
    fetch(url, {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
      .then(r => r.json())
      .then(json => {
        const features: OSMFeature[] = (json.elements || [])
          .filter((el: any) => el.lat || (el.center && el.center.lat))
          .map((el: any) => ({
            lat: el.lat ?? el.center.lat,
            lng: el.lon ?? el.center.lon,
            name: el.tags?.name || el.tags?.amenity || 'Unknown',
            tags: el.tags || {},
          }));
        setData(features);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load live data. Showing static summary only.');
        setLoading(false);
      });
  }, [query, enabled]);

  return { data, loading, error };
}

/* ─────────────── OVERPASS QUERIES ─────────────── */

const SCHOOLS_QUERY = `[out:json][timeout:30];
area["ISO3166-1"="UG"]->.a;
nwr["amenity"="school"](area.a);
out center 300;`;

const HOSPITALS_QUERY = `[out:json][timeout:30];
area["ISO3166-1"="UG"]->.a;
nwr["amenity"~"hospital|clinic|health_centre|doctors"](area.a);
out center 400;`;

/* ─────────────── SUB-SECTIONS ─────────────── */

function DashboardTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        <StatCard icon={<Users size={20} />} label="Population (2024 Census)" value="45.7M" sub="Growth rate 3.0% p.a." color="#3B82F6" />
        <StatCard icon={<DollarSign size={20} />} label="GDP (USD)" value="$49.3B" sub="GDP per capita $1,076" color="#10B981" />
        <StatCard icon={<TrendingUp size={20} />} label="Avg. GDP Growth" value="6.1%" sub="2015–2023 average" color="#F59E0B" />
        <StatCard icon={<BookOpen size={20} />} label="Literacy Rate" value="79%" sub="Adult (15+), UBOS 2022" color="#8B5CF6" />
        <StatCard icon={<Activity size={20} />} label="HDI" value="0.544" sub="Low–medium (2023)" color="#EC4899" />
        <StatCard icon={<MapPin size={20} />} label="Districts" value="146" sub="Covering 241,551 km²" color="#14B8A6" />
        <StatCard icon={<Factory size={20} />} label="Industry Share of GDP" value="27.3%" sub="Incl. construction" color="#F97316" />
        <StatCard icon={<Tractor size={20} />} label="Agriculture Share" value="24.1%" sub="75% of labour force" color="#84CC16" />
      </div>

      {/* Map with cities */}
      <div>
        <h3 style={{ color: '#f5f5f7', fontWeight: 600, marginBottom: 10, fontSize: 15 }}>Urban Centres & Economic Geography</h3>
        <MapPanel height={460}>
          {CITIES.map(c => (
            <CircleMarker
              key={c.name}
              center={[c.lat, c.lng]}
              radius={c.capital ? 14 : Math.max(5, Math.log(c.pop / 10000) * 3)}
              pathOptions={{ color: c.capital ? '#FFD700' : '#3B82F6', fillColor: c.capital ? '#FFD700' : '#60A5FA', fillOpacity: 0.8, weight: 2 }}
            >
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <strong style={{ fontSize: 13 }}>{c.name}</strong>
                  {c.capital && <span style={{ color: '#FFD700', fontSize: 11 }}> ★ Capital</span>}
                  <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                    <div>Population: <strong>{c.pop.toLocaleString()}</strong></div>
                    <div>Role: {c.role}</div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapPanel>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ color: '#a1a1aa', fontSize: 11 }}><span style={{ color: '#FFD700' }}>★</span> Capital city (size = population)</span>
          <span style={{ color: '#a1a1aa', fontSize: 11 }}><span style={{ color: '#60A5FA' }}>●</span> Urban centre (size ∝ population)</span>
        </div>
      </div>

      {/* Regional breakdown */}
      <div>
        <h3 style={{ color: '#f5f5f7', fontWeight: 600, marginBottom: 10, fontSize: 15 }}>Regional Socio-Economic Comparison</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}>
                {['Region','Population','Area (km²)','Density (p/km²)','HDI','Schools','Health Facilities'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {REGION_DATA.map((r, i) => (
                <tr key={r.region} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '10px 14px', color: '#f5f5f7', fontWeight: 600 }}>{r.region}</td>
                  <td style={{ padding: '10px 14px', color: '#d1d5db' }}>{r.population.toLocaleString()}</td>
                  <td style={{ padding: '10px 14px', color: '#d1d5db' }}>{r.area.toLocaleString()}</td>
                  <td style={{ padding: '10px 14px', color: '#d1d5db' }}>{r.density}</td>
                  <td style={{ padding: '10px 14px', color: r.hdi >= 0.55 ? '#10B981' : r.hdi >= 0.51 ? '#F59E0B' : '#EF4444' }}>{r.hdi}</td>
                  <td style={{ padding: '10px 14px', color: '#d1d5db' }}>{r.schools.toLocaleString()}</td>
                  <td style={{ padding: '10px 14px', color: '#d1d5db' }}>{r.hospitals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MineralsTab() {
  const [selected, setSelected] = useState<(typeof MINERALS)[0] | null>(null);
  const typeCounts: Record<string, number> = {};
  MINERALS.forEach(m => { typeCounts[m.type] = (typeCounts[m.type] || 0) + 1; });
  const typeData = Object.entries(typeCounts).map(([type, count]) => ({ type, count, color: MINERAL_COLORS[type] || '#888' }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <StatCard icon={<Mountain size={20} />} label="Known Mineral Types" value="30+" sub="Oil, gold, copper, limestone…" color="#F59E0B" />
        <StatCard icon={<DollarSign size={20} />} label="Oil Reserves (proved)" value="6.5B bbls" sub="Albertine Graben – EACOP route" color="#1a1a2e" />
        <StatCard icon={<Building2 size={20} />} label="Mining Licenses Active" value="1,200+" sub="DGSM Portal 2024" color="#10B981" />
      </div>

      <MapPanel height={520}>
        {MINERALS.map(m => (
          <CircleMarker
            key={m.name}
            center={[m.lat, m.lng]}
            radius={m.type === 'oil' ? 14 : 9}
            pathOptions={{ color: MINERAL_COLORS[m.type] || '#888', fillColor: MINERAL_COLORS[m.type] || '#888', fillOpacity: 0.85, weight: 2 }}
            eventHandlers={{ click: () => setSelected(m) }}
          >
            <Popup>
              <div style={{ minWidth: 200 }}>
                <strong style={{ fontSize: 13 }}>{m.name}</strong>
                <div style={{ fontSize: 11, color: '#555', marginTop: 6, lineHeight: 1.6 }}>
                  <div><strong>Type:</strong> {m.type.charAt(0).toUpperCase() + m.type.slice(1)}</div>
                  <div><strong>Quantity:</strong> {m.quantity}</div>
                  <div><strong>Status:</strong> {m.status}</div>
                  <div><strong>Est. Value:</strong> {m.value}</div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapPanel>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {Object.entries(MINERAL_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#d1d5db' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, border: '1px solid rgba(255,255,255,0.3)' }} />
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </div>
        ))}
      </div>

      {/* Table */}
      <div>
        <h3 style={{ color: '#f5f5f7', fontWeight: 600, marginBottom: 10, fontSize: 15 }}>Mineral Deposits Catalogue</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}>
                {['Deposit','Type','Quantity','Status','Est. Value'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MINERALS.map((m, i) => (
                <tr key={m.name} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '9px 12px', color: '#f5f5f7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: MINERAL_COLORS[m.type] || '#888', display: 'inline-block', flexShrink: 0 }} />
                    {m.name}
                  </td>
                  <td style={{ padding: '9px 12px', color: '#d1d5db' }}>{m.type}</td>
                  <td style={{ padding: '9px 12px', color: '#d1d5db' }}>{m.quantity}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ background: m.status.includes('Active') ? '#10B98122' : m.status.includes('Explor') ? '#F59E0B22' : '#6B728022', color: m.status.includes('Active') ? '#10B981' : m.status.includes('Explor') ? '#F59E0B' : '#a1a1aa', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                      {m.status}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', color: '#d1d5db' }}>{m.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AgricultureTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        <StatCard icon={<Tractor size={20} />} label="Agriculture Share of GDP" value="24.1%" sub="Employs 72% of workforce" color="#84CC16" />
        <StatCard icon={<DollarSign size={20} />} label="Coffee Export Value" value="$600M+" sub="No.1 export commodity" color="#6F4E37" />
        <StatCard icon={<Globe size={20} />} label="Arable Land" value="34%" sub="of total land area" color="#10B981" />
        <StatCard icon={<Activity size={20} />} label="Agri Growth Rate" value="3.8%" sub="2022/23 (UBOS)" color="#F59E0B" />
      </div>

      <MapPanel height={500}>
        {AGRI_ZONES.map((z, i) => (
          <CircleMarker
            key={z.name + i}
            center={[z.lat, z.lng]}
            radius={10}
            pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.75, weight: 2 }}
          >
            <Popup>
              <div style={{ minWidth: 170 }}>
                <strong style={{ fontSize: 13 }}>{z.name}</strong>
                <div style={{ fontSize: 11, color: '#555', marginTop: 4, lineHeight: 1.6 }}>
                  <div><strong>Zone:</strong> {z.region}</div>
                  <div><strong>Export value:</strong> {z.export}</div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapPanel>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <h3 style={{ color: '#f5f5f7', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Agricultural Products by Share of Output</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={AGRI_ZONES.slice(0, 8)} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#d1d5db', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f5f5f7' }} />
              <Bar dataKey="pct" name="% of output" radius={[0, 4, 4, 0]}>
                {AGRI_ZONES.slice(0, 8).map((z, i) => <Cell key={i} fill={z.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3 style={{ color: '#f5f5f7', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Key Agricultural Zones</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {AGRI_ZONES.slice(0, 8).map((z, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: z.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#f5f5f7', fontSize: 13, fontWeight: 600 }}>{z.name}</div>
                  <div style={{ color: '#71717a', fontSize: 11 }}>{z.region}</div>
                </div>
                <div style={{ color: '#10B981', fontSize: 12, fontWeight: 600 }}>{z.export}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function IndustryTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        <StatCard icon={<Factory size={20} />} label="Industry Share of GDP" value="27.3%" sub="Incl. construction" color="#3B82F6" />
        <StatCard icon={<Zap size={20} />} label="Installed Power Capacity" value="1,244 MW" sub="Hydro dominant" color="#F59E0B" />
        <StatCard icon={<Building2 size={20} />} label="Industrial Parks" value="22" sub="UIA designated zones" color="#10B981" />
        <StatCard icon={<Activity size={20} />} label="Oil Production (est.)" value="2025+" sub="EACOP pipeline route" color="#EF4444" />
      </div>

      <MapPanel height={500}>
        {INDUSTRY_SITES.map((s, i) => (
          <CircleMarker
            key={s.name}
            center={[s.lat, s.lng]}
            radius={s.type.includes('Hydro') ? 10 : s.type.includes('Oil') ? 12 : 8}
            pathOptions={{
              color: s.type.includes('Hydro') ? '#60A5FA' : s.type.includes('Oil') ? '#1a1a2e' : s.type.includes('Cement') ? '#D4C5A9' : s.type.includes('Sugar') ? '#90EE90' : '#F59E0B',
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <strong style={{ fontSize: 13 }}>{s.name}</strong>
                <div style={{ fontSize: 11, color: '#555', marginTop: 4, lineHeight: 1.6 }}>
                  <div><strong>Type:</strong> {s.type}</div>
                  <div><strong>Capacity:</strong> {s.capacity}</div>
                  <div>Coords: {s.lat.toFixed(3)}°N, {s.lng.toFixed(3)}°E</div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapPanel>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <h3 style={{ color: '#f5f5f7', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>GDP Sector Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={SECTORS} cx="50%" cy="50%" outerRadius={80} dataKey="pct" label={({ sector, pct }) => `${sector} ${pct}%`} labelLine={{ stroke: '#6b7280' }} fontSize={11}>
                {SECTORS.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3 style={{ color: '#f5f5f7', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Key Industrial Sites</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {INDUSTRY_SITES.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#f5f5f7', fontSize: 12, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ color: '#71717a', fontSize: 11 }}>{s.type} — {s.capacity}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveDataTab({ query, color, label, icon }: { query: string; color: string; label: string; icon: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const { data, loading, error } = useOverpass(query, enabled);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {!enabled ? (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <div style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 16 }}>
            Live {label} locations are fetched from OpenStreetMap (Overpass API).<br />
            Click to load live data — may take 10–20 seconds.
          </div>
          <button
            onClick={() => setEnabled(true)}
            style={{ background: color, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            Load Live {label} Data
          </button>
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#a1a1aa', fontSize: 14 }}>
          <div style={{ marginBottom: 8 }}>Querying OpenStreetMap…</div>
          <div style={{ fontSize: 12, color: '#71717a' }}>Fetching up to 400 {label.toLowerCase()} locations across Uganda</div>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#EF4444', fontSize: 13 }}>
          <AlertCircle size={20} style={{ marginBottom: 8 }} /><br />{error}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: color + '22', color, borderRadius: 8, padding: '6px 12px', fontWeight: 600, fontSize: 13 }}>
              {icon} {data.length.toLocaleString()} {label} mapped
            </div>
            <span style={{ color: '#71717a', fontSize: 12 }}>from OpenStreetMap — live data</span>
          </div>
          <MapPanel height={500}>
            {data.map((f, i) => (
              <CircleMarker key={i} center={[f.lat, f.lng]} radius={5}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.65, weight: 1 }}>
                <Popup>
                  <div>
                    <strong style={{ fontSize: 12 }}>{f.name}</strong>
                    {f.tags.operator && <div style={{ fontSize: 11, color: '#666' }}>Operator: {f.tags.operator}</div>}
                    {f.tags.capacity && <div style={{ fontSize: 11, color: '#666' }}>Capacity: {f.tags.capacity}</div>}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapPanel>
        </>
      )}
    </div>
  );
}

function DemographicsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        <StatCard icon={<Users size={20} />} label="Total Population" value="45.7M" sub="2024 preliminary census" color="#3B82F6" />
        <StatCard icon={<Activity size={20} />} label="Population Growth" value="3.0%" sub="p.a. — one of world's highest" color="#EF4444" />
        <StatCard icon={<MapPin size={20} />} label="Population Density" value="189/km²" sub="National average" color="#F59E0B" />
        <StatCard icon={<Globe size={20} />} label="Median Age" value="15.7 yrs" sub="Very young population" color="#10B981" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <h3 style={{ color: '#f5f5f7', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Population by Region</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={REGION_DATA} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="region" tick={{ fill: '#d1d5db', fontSize: 12 }} />
              <YAxis tickFormatter={v => (v / 1e6).toFixed(1) + 'M'} tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f5f5f7' }} formatter={(v: any) => [Number(v).toLocaleString(), 'Population']} />
              <Bar dataKey="population" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3 style={{ color: '#f5f5f7', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Population Density by Region (p/km²)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={REGION_DATA} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="region" tick={{ fill: '#d1d5db', fontSize: 12 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f5f5f7' }} formatter={(v: any) => [v + ' p/km²', 'Density']} />
              <Bar dataKey="density" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 style={{ color: '#f5f5f7', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Human Development Index by Region</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {REGION_DATA.map(r => (
            <div key={r.region} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '16px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: r.hdi >= 0.55 ? '#10B981' : r.hdi >= 0.51 ? '#F59E0B' : '#EF4444' }}>{r.hdi}</div>
              <div style={{ color: '#f5f5f7', fontWeight: 600, fontSize: 13, marginTop: 4 }}>{r.region}</div>
              <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>HDI Score</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EconomyTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        <StatCard icon={<DollarSign size={20} />} label="GDP (2023)" value="$48.3B" sub="Current USD" color="#10B981" />
        <StatCard icon={<TrendingUp size={20} />} label="GDP Growth (2023)" value="5.3%" sub="World Bank estimate" color="#3B82F6" />
        <StatCard icon={<Globe size={20} />} label="Exports (2023)" value="$6.8B" sub="Coffee, gold, fish top 3" color="#F59E0B" />
        <StatCard icon={<Activity size={20} />} label="FDI Inflows" value="$1.2B" sub="2022 — oil sector major driver" color="#8B5CF6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
        <div>
          <h3 style={{ color: '#f5f5f7', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>GDP Trend (USD Billion)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={GDP_DATA}>
              <defs>
                <linearGradient id="gdpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="year" tick={{ fill: '#d1d5db', fontSize: 12 }} />
              <YAxis tickFormatter={v => '$' + v + 'B'} tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f5f5f7' }} formatter={(v: any) => ['$' + Number(v).toFixed(2) + 'B', 'GDP']} />
              <Area type="monotone" dataKey="gdp" stroke="#10B981" strokeWidth={2} fill="url(#gdpGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3 style={{ color: '#f5f5f7', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>GDP Growth Rate (%)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={GDP_DATA} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="year" tick={{ fill: '#d1d5db', fontSize: 12 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f5f5f7' }} formatter={(v: any) => [v + '%', 'Growth']} />
              <Bar dataKey="growth" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 style={{ color: '#f5f5f7', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Top Export Commodities (2023 estimates)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {[
            { item: 'Coffee', value: '$852M', share: '12.5%', color: '#6F4E37' },
            { item: 'Gold', value: '$2.1B', share: '30.9%', color: '#FFD700' },
            { item: 'Fish Products', value: '$180M', share: '2.6%', color: '#4169E1' },
            { item: 'Tea', value: '$92M', share: '1.4%', color: '#228B22' },
            { item: 'Tobacco', value: '$55M', share: '0.8%', color: '#C8A165' },
            { item: 'Vanilla', value: '$62M', share: '0.9%', color: '#F3E5AB' },
          ].map(e => (
            <div key={e.item} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: e.color }} />
                <span style={{ color: '#f5f5f7', fontWeight: 600, fontSize: 13 }}>{e.item}</span>
              </div>
              <div style={{ color: '#10B981', fontSize: 20, fontWeight: 700, marginTop: 6 }}>{e.value}</div>
              <div style={{ color: '#71717a', fontSize: 11 }}>{e.share} of total exports</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── MAIN COMPONENT ─────────────── */

export default function SocioEconomicSection() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab />;
      case 'minerals': return <MineralsTab />;
      case 'agriculture': return <AgricultureTab />;
      case 'industry': return <IndustryTab />;
      case 'education': return <LiveDataTab query={SCHOOLS_QUERY} color="#8B5CF6" label="Schools" icon={<GraduationCap size={14} style={{ display: 'inline', marginRight: 4 }} />} />;
      case 'health': return <LiveDataTab query={HOSPITALS_QUERY} color="#EF4444" label="Health Facilities" icon={<Heart size={14} style={{ display: 'inline', marginRight: 4 }} />} />;
      case 'demographics': return <DemographicsTab />;
      case 'economy': return <EconomyTab />;
      default: return <DashboardTab />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', padding: '0 0 40px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', padding: '28px 32px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <div style={{ background: '#3B82F622', color: '#60A5FA', borderRadius: 12, padding: 10 }}>
            <Globe size={24} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f5f5f7', letterSpacing: -0.3 }}>Socio-Economic Analysis</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#71717a', marginTop: 2 }}>Uganda national data — minerals, agriculture, industry, education, health, demographics & economy</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                background: activeTab === t.id ? '#3B82F6' : 'rgba(255,255,255,0.07)',
                color: activeTab === t.id ? '#fff' : '#a1a1aa',
                transition: 'all 0.15s ease',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '28px 32px' }}>
        {renderContent()}
      </div>

      {/* Footer */}
      <div style={{ padding: '0 32px', marginTop: 16 }}>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14, color: '#52525b', fontSize: 11, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>Sources: UBOS 2024 Census (preliminary) · World Bank Open Data · Uganda DGSM Mining Cadastre · OpenStreetMap (Overpass API) · FAO FAOSTAT · UIA Industrial Parks</span>
        </div>
      </div>
    </div>
  );
}
