import React, { useState, useEffect, useCallback } from 'react';
const LazySEHub = React.lazy(() => import('../DataEntry/DataCaptureHub'));
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON, useMap } from 'react-leaflet';
import { AreaChart, BarChart, PieChart, Pie, Cell, Bar, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ADM1_URL = 'https://raw.githubusercontent.com/wmgeolab/geoBoundaries/main/releaseData/gbOpen/UGA/ADM1/geoBoundaries-UGA-ADM1.geojson';
const OVP_MIRRORS = ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
const UGA: [number,number] = [1.3733,32.2903];
const ZOOM = 7;
const BBOX = '[bbox:-1.5,29.5,4.3,35.1]';
const ATTRIBUTION = '© CARTO © OSM contributors';
const PIE_C = ['#3b82f6','#22c55e','#f97316','#a855f7','#eab308','#06b6d4','#ef4444','#84cc16'];

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S: Record<string,React.CSSProperties> = {
  card: { background:'#1e293b', borderRadius:10, padding:'14px 16px', marginBottom:16 },
  kpiWrap: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))', gap:12, marginBottom:20 },
  mapWrap: { borderRadius:8, overflow:'hidden', height:400 },
};

// ─── STATIC DATASETS ──────────────────────────────────────────────────────────
const CITIES = [
  {n:'Kampala',lat:0.3476,lng:32.5825,pop:3600000,reg:'Central',type:'Capital'},
  {n:'Gulu',lat:2.7809,lng:32.2994,pop:200000,reg:'Northern',type:'City'},
  {n:'Lira',lat:2.2499,lng:32.9003,pop:150000,reg:'Northern',type:'City'},
  {n:'Mbarara',lat:-0.6072,lng:30.6545,pop:200000,reg:'Western',type:'City'},
  {n:'Jinja',lat:0.4478,lng:33.2026,pop:120000,reg:'Eastern',type:'City'},
  {n:'Entebbe',lat:0.0611,lng:32.4600,pop:76000,reg:'Central',type:'City'},
  {n:'Masaka',lat:-0.3462,lng:31.7364,pop:88000,reg:'Central',type:'City'},
  {n:'Kasese',lat:0.1825,lng:30.0827,pop:75000,reg:'Western',type:'Town'},
  {n:'Arua',lat:3.0200,lng:30.9109,pop:95000,reg:'West Nile',type:'City'},
  {n:'Fort Portal',lat:0.6710,lng:30.2750,pop:55000,reg:'Western',type:'City'},
  {n:'Mbale',lat:1.0796,lng:34.1753,pop:100000,reg:'Eastern',type:'City'},
  {n:'Soroti',lat:1.7148,lng:33.6108,pop:65000,reg:'Eastern',type:'City'},
  {n:'Kabale',lat:-1.2508,lng:29.9891,pop:48000,reg:'Western',type:'Town'},
  {n:'Hoima',lat:1.4360,lng:31.3538,pop:55000,reg:'Western',type:'City'},
  {n:'Tororo',lat:0.6921,lng:34.1813,pop:52000,reg:'Eastern',type:'Town'},
];

const MINERALS = [
  {n:'Kilembe Mine',lat:0.2100,lng:30.0100,type:'Copper/Cobalt',status:'Explored',dist:'Kasese',res:'4.5Mt ore',grade:'1.8% Cu',val_usd_m:320},
  {n:'Muko Iron Ore',lat:-1.0800,lng:29.7000,type:'Iron Ore',status:'Explored',dist:'Kabale',res:'162Mt',grade:'42% Fe',val_usd_m:2100},
  {n:'Sukulu Phosphates',lat:0.6000,lng:34.0800,type:'Phosphate',status:'Active',dist:'Tororo',res:'230Mt',grade:'12% P2O5',val_usd_m:890},
  {n:'Busia Gold',lat:0.4600,lng:34.0900,type:'Gold',status:'Active',dist:'Busia',res:'1.2Mt ore',grade:'3.5g/t Au',val_usd_m:180},
  {n:'Hima Limestone',lat:0.3300,lng:30.2200,type:'Limestone',status:'Active',dist:'Kasese',res:'500Mt',grade:'CaCO3 90%',val_usd_m:95},
  {n:'Lake Katwe Salt',lat:-0.0600,lng:29.9000,type:'Salt/Evaporites',status:'Active',dist:'Kasese',res:'Perennial',grade:'NaCl 85%',val_usd_m:12},
  {n:'Moroto Marble',lat:2.5400,lng:34.6700,type:'Marble',status:'Explored',dist:'Moroto',res:'80Mt',grade:'High purity',val_usd_m:55},
  {n:'Tororo Rock Phosphate',lat:0.6800,lng:34.1700,type:'Phosphate',status:'Active',dist:'Tororo',res:'280Mt',grade:'14% P2O5',val_usd_m:1100},
  {n:'Kitgum Vermiculite',lat:3.2700,lng:32.8800,type:'Vermiculite',status:'Explored',dist:'Kitgum',res:'2.5Mt',grade:'High grade',val_usd_m:35},
  {n:'Mubende Gold',lat:0.5700,lng:31.3700,type:'Gold',status:'Active',dist:'Mubende',res:'0.8Mt ore',grade:'2.8g/t Au',val_usd_m:120},
  {n:'Kigezi Wolfram',lat:-1.1000,lng:29.8500,type:'Tungsten',status:'Explored',dist:'Kabale',res:'0.5Mt',grade:'0.3% WO3',val_usd_m:28},
  {n:'Rwimi Beryllium',lat:0.4300,lng:30.4200,type:'Beryllium',status:'Explored',dist:'Kabarole',res:'Artisanal',grade:'Moderate',val_usd_m:15},
  {n:'Tiira Nickel',lat:0.5200,lng:34.1000,type:'Nickel',status:'Explored',dist:'Tororo',res:'4Mt ore',grade:'0.6% Ni',val_usd_m:85},
  {n:'Kabale Tin',lat:-1.2200,lng:29.9700,type:'Tin/Tantalum',status:'Active',dist:'Kabale',res:'Artisanal',grade:'Mixed',val_usd_m:22},
  {n:'Luwero Cobalt',lat:0.8300,lng:32.5000,type:'Cobalt',status:'Explored',dist:'Luwero',res:'2Mt ore',grade:'0.3% Co',val_usd_m:65},
  {n:'Agago Rare Earths',lat:3.0000,lng:33.1000,type:'REE',status:'Explored',dist:'Agago',res:'1.8Mt ore',grade:'1.2% TREO',val_usd_m:210},
  {n:'Buhweju Diatomite',lat:-0.5000,lng:30.2200,type:'Diatomite',status:'Explored',dist:'Buhweju',res:'15Mt',grade:'High silica',val_usd_m:18},
  {n:'Namanve Clay',lat:0.3200,lng:32.7000,type:'Clay/Ceramics',status:'Active',dist:'Mukono',res:'Abundant',grade:'Ceramic grade',val_usd_m:8},
  {n:'Kibuku Graphite',lat:1.0300,lng:33.6500,type:'Graphite',status:'Explored',dist:'Kibuku',res:'3Mt ore',grade:'8% Cg',val_usd_m:42},
  {n:'Karamoja Gemstones',lat:3.5000,lng:34.5000,type:'Gemstones',status:'Active',dist:'Moroto',res:'Artisanal',grade:'Mixed',val_usd_m:30},
];

const OIL_BLOCKS = [
  {n:'EA1 Kingfisher',lat:1.1000,lng:31.1000,op:'CNOOC Uganda',status:'Development',field:'Kingfisher',res:'600M bbl recoverable',first_oil:'2025'},
  {n:'EA2 Tilenga',lat:2.1000,lng:31.5000,op:'TotalEnergies EP Uganda',status:'Development',field:'Tilenga (Jobi-Rii + 5 fields)',res:'1.2B bbl',first_oil:'2026'},
  {n:'EA1A Jobi-Rii',lat:1.5000,lng:31.2000,op:'TotalEnergies EP Uganda',status:'Development',field:'Jobi-Rii',res:'200M bbl',first_oil:'2026'},
  {n:'EA3A Mputa',lat:1.8000,lng:31.0000,op:'TotalEnergies EP Uganda',status:'Appraisal',field:'Mputa-Waraga',res:'100M bbl',first_oil:'2027'},
  {n:'EA3B Avivi',lat:2.3000,lng:31.7000,op:'TotalEnergies EP Uganda',status:'Exploration',field:'Avivi',res:'TBD',first_oil:'2028+'},
  {n:'EACOP Terminal',lat:0.3200,lng:32.6000,op:'EACOP Ltd Consortium',status:'Under Construction',field:'Pipeline to Tanga',res:'N/A — export corridor',first_oil:'2026'},
];

const POWER_PLANTS = [
  {n:'Karuma HPP',lat:2.2300,lng:32.2600,cap_mw:600,type:'Hydro',status:'Commissioning',river:'Victoria Nile',yr:2024},
  {n:'Bujagali HPP',lat:0.4500,lng:33.1500,cap_mw:250,type:'Hydro',status:'Operational',river:'Victoria Nile',yr:2012},
  {n:'Nalubaale HPP',lat:0.4800,lng:33.1900,cap_mw:180,type:'Hydro',status:'Operational',river:'Victoria Nile',yr:1954},
  {n:'Kiira HPP',lat:0.4700,lng:33.2000,cap_mw:200,type:'Hydro',status:'Operational',river:'Victoria Nile',yr:2003},
  {n:'Isimba HPP',lat:0.5600,lng:33.0000,cap_mw:183,type:'Hydro',status:'Operational',river:'Victoria Nile',yr:2019},
  {n:'Muzizi HPP',lat:0.8600,lng:30.9500,cap_mw:44,type:'Hydro',status:'Under Dev',river:'Muzizi',yr:2025},
  {n:'Kikagati HPP',lat:-1.0200,lng:30.6700,cap_mw:16,type:'Hydro',status:'Operational',river:'Kagera',yr:2020},
  {n:'Nyagak HPP',lat:3.0500,lng:30.8200,cap_mw:3.5,type:'Hydro',status:'Operational',river:'Nyagak',yr:2012},
  {n:'Agago HPP',lat:3.1000,lng:33.3000,cap_mw:84,type:'Hydro',status:'Under Dev',river:'Agago',yr:2026},
  {n:'Kiba HPP',lat:0.6500,lng:30.5000,cap_mw:380,type:'Hydro',status:'Planned',river:'Muzizi',yr:2028},
  {n:'Kabale Solar Farm',lat:-1.2600,lng:30.0000,cap_mw:10,type:'Solar',status:'Operational',river:'N/A',yr:2021},
  {n:'Soroti Solar Farm',lat:1.7100,lng:33.6200,cap_mw:10,type:'Solar',status:'Operational',river:'N/A',yr:2021},
  {n:'Tororo Thermal',lat:0.6900,lng:34.1800,cap_mw:50,type:'Thermal',status:'Operational',river:'N/A',yr:2007},
  {n:'Namanve Thermal',lat:0.3100,lng:32.7200,cap_mw:50,type:'Thermal',status:'Standby',river:'N/A',yr:2009},
  {n:'Ayago HPP',lat:2.5500,lng:31.9000,cap_mw:840,type:'Hydro',status:'Planned',river:'Victoria Nile',yr:2030},
];

const PROTECTED_AREAS = [
  {n:'Murchison Falls NP',lat:2.2700,lng:31.6500,area_km2:3840,type:'National Park',animals:'Elephant, Lion, Buffalo, Nile Croc, Shoebill',established:1952,whs:false},
  {n:'Queen Elizabeth NP',lat:-0.1000,lng:30.0000,area_km2:1978,type:'National Park',animals:'Hippo, Elephant, Tree-climbing Lion, Chimpanzee',established:1954,whs:false},
  {n:'Kibale NP',lat:0.4900,lng:30.3500,area_km2:766,type:'National Park',animals:'Chimpanzee (1,500+), Red Colobus, Forest Elephant',established:1993,whs:false},
  {n:'Bwindi Impenetrable NP',lat:-1.0500,lng:29.7000,area_km2:321,type:'National Park',animals:'Mountain Gorilla (459+), L\'Hoest Monkey',established:1991,whs:true},
  {n:'Kidepo Valley NP',lat:3.8200,lng:33.8600,area_km2:1442,type:'National Park',animals:'Lion, Cheetah, Ostrich, Eland, Rotschild Giraffe',established:1962,whs:false},
  {n:'Lake Mburo NP',lat:-0.6300,lng:30.9500,area_km2:370,type:'National Park',animals:'Zebra, Hippo, Impala, Eland, Waterbuck',established:1983,whs:false},
  {n:'Mt Rwenzori NP',lat:0.3700,lng:29.9200,area_km2:996,type:'National Park',animals:'Chimpanzee, L\'Hoest, Forest Elephant, Afropavo',established:1991,whs:true},
  {n:'Mgahinga Gorilla NP',lat:-1.3700,lng:29.6400,area_km2:33.7,type:'National Park',animals:'Mountain Gorilla, Golden Monkey',established:1991,whs:false},
  {n:'Semuliki NP',lat:0.9000,lng:30.1500,area_km2:220,type:'National Park',animals:'Chimpanzee, Pygmy Hippo, Forest species',established:1993,whs:false},
  {n:'Mt Elgon NP',lat:1.1200,lng:34.5500,area_km2:1279,type:'National Park',animals:'Elephant, Buffalo, Forest Hog, Sitatunga',established:1993,whs:false},
  {n:'Ajai Wildlife Reserve',lat:3.1600,lng:31.8000,area_km2:166,type:'Game Reserve',animals:'White Rhino (reintroduced), Hippo, Buffalo',established:1956,whs:false},
  {n:'Katonga Wildlife Reserve',lat:0.1500,lng:31.4800,area_km2:207,type:'Game Reserve',animals:'Sitatunga, Uganda Kob, Oribi',established:1964,whs:false},
];

const DISTRICTS = [
  {n:'Kampala',reg:'Central',pop:3600000,area_km2:189,gdp_m:12400,poverty:8,literacy:90,lat:0.3476,lng:32.5825},
  {n:'Wakiso',reg:'Central',pop:2200000,area_km2:2807,gdp_m:3200,poverty:12,literacy:87,lat:0.4040,lng:32.4600},
  {n:'Mukono',reg:'Central',pop:950000,area_km2:4958,gdp_m:850,poverty:21,literacy:82,lat:0.3542,lng:32.7558},
  {n:'Mbarara',reg:'Western',pop:700000,area_km2:1846,gdp_m:680,poverty:24,literacy:78,lat:-0.6072,lng:30.6545},
  {n:'Gulu',reg:'Northern',pop:580000,area_km2:3446,gdp_m:420,poverty:41,literacy:70,lat:2.7809,lng:32.2994},
  {n:'Lira',reg:'Northern',pop:620000,area_km2:2988,gdp_m:380,poverty:45,literacy:67,lat:2.2499,lng:32.9003},
  {n:'Mbale',reg:'Eastern',pop:530000,area_km2:249,gdp_m:350,poverty:32,literacy:74,lat:1.0796,lng:34.1753},
  {n:'Jinja',reg:'Eastern',pop:490000,area_km2:2534,gdp_m:620,poverty:26,literacy:80,lat:0.4478,lng:33.2026},
  {n:'Kasese',reg:'Western',pop:890000,area_km2:3044,gdp_m:310,poverty:38,literacy:68,lat:0.1825,lng:30.0827},
  {n:'Arua',reg:'West Nile',pop:980000,area_km2:3439,gdp_m:290,poverty:52,literacy:62,lat:3.0200,lng:30.9109},
  {n:'Soroti',reg:'Eastern',pop:430000,area_km2:4229,gdp_m:220,poverty:39,literacy:71,lat:1.7148,lng:33.6108},
  {n:'Kabale',reg:'Western',pop:550000,area_km2:1937,gdp_m:280,poverty:30,literacy:76,lat:-1.2508,lng:29.9891},
  {n:'Hoima',reg:'Western',pop:580000,area_km2:3609,gdp_m:890,poverty:29,literacy:73,lat:1.4360,lng:31.3538},
  {n:'Tororo',reg:'Eastern',pop:520000,area_km2:1783,gdp_m:340,poverty:28,literacy:75,lat:0.6921,lng:34.1813},
  {n:'Moroto',reg:'Karamoja',pop:210000,area_km2:3571,gdp_m:82,poverty:78,literacy:38,lat:2.5345,lng:34.6680},
  {n:'Kitgum',reg:'Northern',pop:370000,area_km2:7200,gdp_m:140,poverty:55,literacy:58,lat:3.2783,lng:32.8868},
  {n:'Iganga',reg:'Eastern',pop:680000,area_km2:1731,gdp_m:260,poverty:35,literacy:72,lat:0.6090,lng:33.4687},
  {n:'Fort Portal',reg:'Western',pop:410000,area_km2:1593,gdp_m:310,poverty:27,literacy:77,lat:0.6710,lng:30.2750},
  {n:'Masaka',reg:'Central',pop:760000,area_km2:2721,gdp_m:490,poverty:22,literacy:83,lat:-0.3462,lng:31.7364},
  {n:'Nebbi',reg:'West Nile',pop:460000,area_km2:2067,gdp_m:165,poverty:49,literacy:60,lat:2.4762,lng:31.0893},
];

const WETLANDS = [
  {n:'Lake Victoria (UGA portion)',lat:-0.2800,lng:32.9000,area_km2:31093,type:'Lake',depth_m:83,sh:'Kenya/Tanzania'},
  {n:'Lake Albert',lat:1.6800,lng:30.9200,area_km2:5347,type:'Lake',depth_m:51,sh:'DRC'},
  {n:'Lake Edward',lat:-0.3000,lng:29.6000,area_km2:2325,type:'Lake',depth_m:112,sh:'DRC'},
  {n:'Lake Kyoga',lat:1.5000,lng:33.0000,area_km2:2700,type:'Lake/Swamp',depth_m:6,sh:'Uganda only'},
  {n:'Lake George',lat:0.0200,lng:30.2000,area_km2:250,type:'Lake',depth_m:3,sh:'Uganda only'},
  {n:'Lake Wamala',lat:0.3900,lng:31.6300,area_km2:250,type:'Lake',depth_m:4,sh:'Uganda only'},
  {n:'Lutembe Wetland',lat:0.1000,lng:32.5500,area_km2:11,type:'Ramsar Wetland',depth_m:2,sh:'Uganda only'},
  {n:'Mabamba Wetland',lat:0.1200,lng:32.2100,area_km2:64,type:'Ramsar Wetland',depth_m:2,sh:'Uganda only'},
  {n:'Nakivubo Wetland',lat:0.3100,lng:32.6200,area_km2:5,type:'Urban Wetland',depth_m:1,sh:'Uganda only'},
  {n:'Opeta-Bisina Wetland',lat:1.7500,lng:33.9200,area_km2:900,type:'Ramsar Wetland',depth_m:3,sh:'Uganda only'},
];

const ECONOMIC_ZONES = [
  {n:'Namanve Industrial & Business Park',lat:0.3100,lng:32.7000,area_ha:1000,invest_m:850,jobs:28000,type:'Industrial Park',status:'Operational',sectors:'Manufacturing, Logistics, Assembly'},
  {n:'Kampala Industrial & Business Park (KIBP)',lat:0.3200,lng:32.5600,area_ha:120,invest_m:320,jobs:8500,type:'Industrial Park',status:'Operational',sectors:'Light manufacturing, Garments, Food processing'},
  {n:'Jinja Industrial & Business Park',lat:0.4500,lng:33.2200,area_ha:250,invest_m:180,jobs:6200,type:'Industrial Park',status:'Operational',sectors:'Steel, Textiles, Chemicals, Cement'},
  {n:'Luzira Free Zone',lat:0.2900,lng:32.6800,area_ha:40,invest_m:95,jobs:2400,type:'Free Zone',status:'Operational',sectors:'Warehousing, Re-export, Electronics assembly'},
  {n:'Kasese Industrial Park',lat:0.1900,lng:30.0900,area_ha:80,invest_m:45,jobs:1800,type:'Industrial Park',status:'Operational',sectors:'Copper processing, Mining services, Cement'},
  {n:'Gulu Industrial Park',lat:2.7900,lng:32.3100,area_ha:65,invest_m:38,jobs:1200,type:'Industrial Park',status:'Developing',sectors:'Agro-processing, Food, Textiles'},
  {n:'Mbale Industrial Park',lat:1.0800,lng:34.1900,area_ha:75,invest_m:42,jobs:1500,type:'Industrial Park',status:'Developing',sectors:'Coffee processing, Textiles, Packaging'},
  {n:'Mbarara Industrial Park',lat:-0.5900,lng:30.6700,area_ha:60,invest_m:35,jobs:1100,type:'Industrial Park',status:'Developing',sectors:'Dairy, Agro-processing, Light manufacturing'},
  {n:'Arua Industrial Park',lat:3.0300,lng:30.9200,area_ha:50,invest_m:28,jobs:900,type:'Industrial Park',status:'Planned',sectors:'Border trade, Agro-processing, Retail'},
  {n:'Buikwe SEZ',lat:0.3600,lng:33.0100,area_ha:200,invest_m:120,jobs:4500,type:'SEZ',status:'Developing',sectors:'Sugar, Textiles, Chemical inputs'},
  {n:'Soroti Fruit Factory Zone',lat:1.7200,lng:33.6300,area_ha:30,invest_m:22,jobs:600,type:'Industrial Park',status:'Operational',sectors:'Fruit processing, Juices, Packaging'},
  {n:'Masindi Petroleum Zone',lat:1.6800,lng:31.7200,area_ha:150,invest_m:240,jobs:3200,type:'SEZ',status:'Planned',sectors:'Oil services, Refinery inputs, Gas processing'},
];

const AGRI_ZONES = [
  {n:'Buganda Basin',lat:0.2000,lng:32.0000,area_ha:3800000,prod_t:9800000,rain_mm:1200,soil:'Ferralsol/Nitisol',export_crop:'Coffee (Robusta)',farmhh:820000,crops:'Banana, Coffee, Maize, Beans'},
  {n:'Ankole Highlands',lat:-0.6000,lng:30.5000,area_ha:1800000,prod_t:3200000,rain_mm:1050,soil:'Andosol/Nitisol',export_crop:'Coffee (Arabica)',farmhh:380000,crops:'Coffee, Sorghum, Maize, Dairy'},
  {n:'Nile Valley North',lat:2.5000,lng:31.8000,area_ha:2200000,prod_t:3800000,rain_mm:980,soil:'Vertisol/Arenosol',export_crop:'Sesame/Sunflower',farmhh:420000,crops:'Sesame, Maize, Millet, Cotton'},
  {n:'Karamoja Arid Zone',lat:3.2000,lng:34.3000,area_ha:1900000,prod_t:620000,rain_mm:480,soil:'Lixisol/Arenosol',export_crop:'Livestock',farmhh:95000,crops:'Sorghum, Millet, Livestock'},
  {n:'Busoga Sugarbelt',lat:0.5500,lng:33.5000,area_ha:1400000,prod_t:5800000,rain_mm:1150,soil:'Ferralsol/Gleysol',export_crop:'Sugar/Fish',farmhh:310000,crops:'Sugarcane, Maize, Beans, Cassava'},
  {n:'Rwenzori Slopes',lat:0.3500,lng:30.1000,area_ha:800000,prod_t:1200000,rain_mm:1400,soil:'Andosol/Histosol',export_crop:'Tea/Vanilla',farmhh:190000,crops:'Tea, Vanilla, Arabica Coffee, Banana'},
  {n:'West Nile Corridor',lat:3.0000,lng:31.0000,area_ha:1100000,prod_t:2100000,rain_mm:1100,soil:'Ferralsol/Luvisol',export_crop:'Tobacco/Sesame',farmhh:240000,crops:'Tobacco, Maize, Cassava, Sesame'},
  {n:'Teso Cotton Belt',lat:1.8000,lng:34.0000,area_ha:1600000,prod_t:2900000,rain_mm:1050,soil:'Vertisol/Ferralsol',export_crop:'Cotton/Sunflower',farmhh:350000,crops:'Cotton, Millet, Sorghum, Groundnuts'},
];
// ─── HOOKS ────────────────────────────────────────────────────────────────────
function useOverpass(query: string) {
  const [data, setData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string|null>(null);
  React.useEffect(() => {
    if (!query) { setLoading(false); return; }
    let cancelled = false;
    async function fetchOvp() {
      for (let mi = 0; mi < OVP_MIRRORS.length; mi++) {
        try {
          const r = await fetch(OVP_MIRRORS[mi], { method:'POST', body:'data='+encodeURIComponent(query), headers:{'Content-Type':'application/x-www-form-urlencoded'} });
          if (!r.ok) continue;
          const j = await r.json();
          if (!cancelled && j.elements) { setData(j.elements); setLoading(false); return; }
        } catch (_) {}
        await new Promise(res => setTimeout(res, 800));
      }
      if (!cancelled) { setError('Overpass unavailable'); setLoading(false); }
    }
    fetchOvp();
    return () => { cancelled = true; };
  }, [query]);
  return { data, loading, error };
}

function useGeoJSON(url: string) {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    fetch(url).then(r => r.json()).then(j => { setData(j); setLoading(false); }).catch(() => setLoading(false));
  }, [url]);
  return { data, loading };
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, color, icon }: { label:string; value:string; sub:string; color:string; icon:string }) {
  return (
    <div style={{ background:'#1e293b', borderRadius:10, padding:'14px 16px', borderLeft:'3px solid '+color }}>
      <div style={{ fontSize:22, marginBottom:4 }}>{icon}</div>
      <div style={{ fontSize:20, fontWeight:700, color, lineHeight:1.1 }}>{value}</div>
      <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>{label}</div>
      <div style={{ fontSize:10, color:'#64748b', marginTop:2 }}>{sub}</div>
    </div>
  );
}

function SectionHdr({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:12, fontWeight:700, color:'#94a3b8', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:10 }}>{children}</div>;
}

function MapLoadingOverlay({ loading, error }: { loading?: boolean; error?: string|null }) {
  if (!loading && !error) return null;
  return (
    <div style={{ position:'absolute', top:8, right:8, zIndex:9999, background:'rgba(15,23,42,0.88)', borderRadius:6, padding:'4px 10px', fontSize:11, color: error?'#f87171':'#94a3b8' }}>
      {error ? ' '+error : '⟳ Loading geodata…'}
    </div>
  );
}

function DataTable({ title, cols, rows }: { title:string; cols:string[]; rows:string[][] }) {
  const [page, setPage] = React.useState(0);
  const PER = 25;
  const pages = Math.ceil(rows.length / PER);
  const visible = rows.slice(page*PER, page*PER+PER);
  return (
    <div style={S.card}>
      <SectionHdr>{title} ({rows.length} records)</SectionHdr>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
          <thead>
            <tr>{cols.map((c,i)=><th key={i} style={{ padding:'6px 10px', background:'#0f172a', color:'#64748b', textAlign:'left', fontWeight:600, whiteSpace:'nowrap' }}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {visible.map((row,ri)=>(
              <tr key={ri} style={{ borderBottom:'1px solid #1e293b' }}>
                {row.map((cell,ci)=><td key={ci} style={{ padding:'5px 10px', color:'#cbd5e1', whiteSpace:'nowrap' }}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div style={{ display:'flex', gap:6, marginTop:8, alignItems:'center', fontSize:11 }}>
          <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{ padding:'3px 10px', background:'#334155', border:'none', borderRadius:4, color:'#cbd5e1', cursor:'pointer' }}>‹</button>
          <span style={{ color:'#64748b' }}>Page {page+1}/{pages}</span>
          <button onClick={()=>setPage(p=>Math.min(pages-1,p+1))} disabled={page===pages-1} style={{ padding:'3px 10px', background:'#334155', border:'none', borderRadius:4, color:'#cbd5e1', cursor:'pointer' }}>›</button>
        </div>
      )}
    </div>
  );
}

function AnalysisTable({ title, cols, rows }: { title:string; cols:string[]; rows:string[][] }) {
  return (
    <div style={S.card}>
      <SectionHdr>{title}</SectionHdr>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
          <thead>
            <tr>{cols.map((c,i)=><th key={i} style={{ padding:'7px 12px', background:'#0f172a', color:'#64748b', textAlign:'left', fontWeight:600 }}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row,ri)=>(
              <tr key={ri} style={{ borderBottom:'1px solid #1e293b', background: ri%2===0?'transparent':'rgba(255,255,255,0.02)' }}>
                {row.map((cell,ci)=><td key={ci} style={{ padding:'6px 12px', color: ci===0?'#e2e8f0':'#94a3b8', lineHeight:1.5 }}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SQLPanel({ title, sql }: { title:string; sql:string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={S.card}>
      <button onClick={()=>setOpen(o=>!o)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:12, fontWeight:600, padding:0, display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:14 }}>{open?'▼':'▶'}</span> SQL Schema & Queries — {title}
      </button>
      {open && (
        <pre style={{ marginTop:12, background:'#0f172a', borderRadius:6, padding:'12px 14px', fontSize:11, color:'#4ade80', overflowX:'auto', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
          {sql}
        </pre>
      )}
    </div>
  );
}

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const C = { cyan:'#00f5ff', blue:'#4d9fff', purple:'#b967ff', green:'#00ff88', yellow:'#ffd23f', pink:'#ff6b9d', red:'#ff4757' };
  const kpis = [
    { label:'Population', value:'48.5M', sub:'Proj 2024 · UBOS', color:C.cyan, icon:'👥' },
    { label:'GDP Growth', value:'5.8%', sub:'FY 2023/24 · MoFPED', color:C.green, icon:'📈' },
    { label:'Poverty Rate', value:'21.4%', sub:'Below $2.15/day · WB', color:C.red, icon:'🏘️' },
    { label:'Rural Population', value:'76%', sub:'Majority rural · UNHS', color:C.yellow, icon:'🌾' },
    { label:'Admin Districts', value:'146', sub:'Admin units · UBOS', color:C.blue, icon:'📍' },
    { label:'Electrification', value:'26%', sub:'National access · MoE', color:C.purple, icon:'⚡' },
  ];
  const sectors = [
    { name:'Services', value:46, color:C.blue },
    { name:'Agriculture', value:24, color:C.green },
    { name:'Industry', value:19, color:C.purple },
    { name:'Other', value:11, color:C.yellow },
  ];
  const regions = [
    { region:'Central', poverty:14, elec:42 },
    { region:'Eastern', poverty:26, elec:18 },
    { region:'Northern', poverty:32, elec:14 },
    { region:'Western', poverty:19, elec:22 },
  ];
  return (
    <div style={{ padding:'16px 20px', overflowY:'auto', height:'100%', display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ background:'rgba(0,245,255,0.04)', border:'1px solid rgba(0,245,255,0.14)', borderRadius:12, padding:'14px 18px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
          <span style={{ fontSize:26 }}>🏘️</span>
          <div>
            <div style={{ fontSize:15, fontWeight:900, color:'#e2e8f0', letterSpacing:'-0.02em' }}>Socio-Economic Analysis</div>
            <div style={{ fontSize:10, color:'rgba(148,163,184,0.55)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>Uganda · NDPIV · 146 Districts</div>
          </div>
        </div>
        <p style={{ fontSize:11, color:'rgba(148,163,184,0.72)', lineHeight:1.6, margin:0 }}>
          Uganda's socio-economic development indicators across 146 districts — natural resources, energy access, agriculture productivity, environment, education &amp; health, and demographic trends aligned with NDPIV goals and World Bank frameworks.
        </p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
          {['UBOS 2024','NDPIV Aligned','146 Districts','World Bank Data','UNHS Sourced'].map(b=>(
            <span key={b} style={{ fontSize:9, fontWeight:700, color:'#00f5ff', background:'rgba(0,245,255,0.07)', border:'1px solid rgba(0,245,255,0.18)', borderRadius:20, padding:'2px 8px', textTransform:'uppercase', letterSpacing:'0.07em' }}>{b}</span>
          ))}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8, flexShrink:0 }}>
        {kpis.map(k=><KPICard key={k.label} label={k.label} value={k.value} sub={k.sub} color={k.color} icon={k.icon} />)}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:2 }}>
        <div style={{ flex:1, height:1, background:'rgba(0,245,255,0.10)' }} />
        <span style={{ fontSize:9, fontWeight:800, color:'rgba(0,245,255,0.45)', letterSpacing:'0.14em', textTransform:'uppercase', whiteSpace:'nowrap' }}>ECONOMIC COMPOSITION · 9 VIEWS</span>
        <div style={{ flex:1, height:1, background:'rgba(0,245,255,0.10)' }} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:12, flex:1, minHeight:220 }}>
        <div style={{ background:'rgba(4,9,18,0.7)', border:'1px solid rgba(0,245,255,0.09)', borderRadius:10, padding:'12px 14px', display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(148,163,184,0.45)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>GDP Sector Share</div>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={sectors} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value">
                {sectors.map((_,i)=><Cell key={i} fill={sectors[i].color} />)}
              </Pie>
              <Tooltip contentStyle={{ background:'#0a0f1a', border:'1px solid rgba(0,245,255,0.18)', borderRadius:8, fontSize:11 }} formatter={(v:any)=>[`${v}%`,'Share']} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'3px 8px', justifyContent:'center', marginTop:6 }}>
            {sectors.map(s=><span key={s.name} style={{ fontSize:9, color:s.color, fontWeight:600 }}>● {s.name} {s.value}%</span>)}
          </div>
        </div>
        <div style={{ background:'rgba(4,9,18,0.7)', border:'1px solid rgba(0,245,255,0.09)', borderRadius:10, padding:'12px 14px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(148,163,184,0.45)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Regional Development Indicators (%)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={regions} layout="vertical" margin={{ top:0, right:20, left:10, bottom:0 }}>
              <XAxis type="number" domain={[0,100]} tick={{ fill:'#64748b', fontSize:9 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="region" tick={{ fill:'#94a3b8', fontSize:9 }} axisLine={false} tickLine={false} width={55} />
              <Tooltip contentStyle={{ background:'#0a0f1a', border:'1px solid rgba(0,245,255,0.18)', borderRadius:8, fontSize:11 }} />
              <Bar dataKey="poverty" name="Poverty %" fill="#ff4757" radius={[0,3,3,0]} barSize={9} />
              <Bar dataKey="elec" name="Electrification %" fill="#b967ff" radius={[0,3,3,0]} barSize={9} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── RESOURCES TAB ────────────────────────────────────────────────────────────
function ResourcesTab() {
  const ovpQ = '[out:json][timeout:30]'+BBOX+';(node["landuse"="quarry"];node["man_made"="mineshaft"];way["landuse"="quarry"];node["industrial"="mine"];);out center;';
  const { data: osmMines, loading, error } = useOverpass(ovpQ);
  const mineralTypes = [
    {name:'Phosphate',v:3},{name:'Iron Ore',v:2},{name:'Gold',v:3},{name:'Copper/Co',v:1},
    {name:'Limestone',v:2},{name:'REE',v:1},{name:'Nickel',v:1},{name:'Other',v:7},
  ];
  const reservesVal = [
    {name:'Phosphate',v:1990},{name:'Iron Ore',v:2100},{name:'Gold',v:300},
    {name:'Copper',v:320},{name:'REE',v:210},{name:'Nickel',v:85},
  ];
  const exportTrend = [
    {yr:'2019',v:680},{yr:'2020',v:520},{yr:'2021',v:890},{yr:'2022',v:1240},
    {yr:'2023',v:1380},{yr:'2024',v:1520},
  ];
  return (
    <div>
      <div style={S.kpiWrap}>
        <KPICard label="Mineral Sites" value="20+" sub="Documented deposits; 100+ artisanal" color="#eab308" icon=""/>
        <KPICard label="Active Mines" value="8" sub="Licensed & operational (2024)" color="#22c55e" icon=""/>
        <KPICard label="Oil Reserves" value="6.5B bbl" sub="In-place; ~1.4B recoverable (Albertine)" color="#3b82f6" icon=""/>
        <KPICard label="Mining GDP %" value="2.1%" sub="USD 800M direct contribution (2024)" color="#a855f7" icon=""/>
        <KPICard label="Mineral Exports" value="USD 1.52B" sub="Gold 75%, other minerals 25%" color="#f97316" icon=""/>
        <KPICard label="Oil Blocks Total" value="6" sub="EA1, EA2, EA1A, EA3A, EA3B, EACOP" color="#06b6d4" icon=""/>
        <KPICard label="Phosphate Reserves" value="230Mt" sub="Sukulu + Tororo; world-class deposit" color="#ef4444" icon=""/>
        <KPICard label="Iron Ore Reserves" value="162Mt" sub="Muko (Kabale); 42% Fe grade" color="#84cc16" icon=""/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>
        <div style={S.card}>
          <SectionHdr>Mineral Types (# sites)</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart><Pie data={mineralTypes} dataKey="v" nameKey="name" cx="50%" cy="50%" innerRadius={28} outerRadius={58} label={({name})=>name}>{mineralTypes.map((_,i)=><Cell key={i} fill={PIE_C[i]}/>)}</Pie><Tooltip/></PieChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <SectionHdr>Estimated Reserves Value (USD M)</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={reservesVal}><XAxis dataKey="name" tick={{fill:'#64748b',fontSize:9}}/><YAxis tick={{fill:'#64748b',fontSize:9}}/><Tooltip contentStyle={{background:'#1e293b',border:'none',borderRadius:6}}/><Bar dataKey="v" fill="#eab308" radius={[3,3,0,0]}/></BarChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <SectionHdr>Mineral Export Revenue Trend (USD M)</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={exportTrend}><XAxis dataKey="yr" tick={{fill:'#64748b',fontSize:10}}/><YAxis tick={{fill:'#64748b',fontSize:10}}/><Tooltip contentStyle={{background:'#1e293b',border:'none',borderRadius:6}}/><Area type="monotone" dataKey="v" stroke="#eab308" fill="rgba(234,179,8,0.1)"/></AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={S.card}>
        <SectionHdr> Mineral Deposits + Oil Blocks + Live OSM Quarries/Mines</SectionHdr>
        <div style={{ ...S.mapWrap, position:'relative', height:480 }}>
          <MapLoadingOverlay loading={loading} error={error}/>
          <MapContainer center={UGA} zoom={ZOOM} style={{ height:'100%', width:'100%', background:'#0d1117' }} scrollWheelZoom>
            <TileLayer url={TILES} attribution={ATTRIBUTION}/>
            {MINERALS.map((m,i) => (
              <CircleMarker key={'min'+i} center={[m.lat,m.lng]} radius={Math.max(5, Math.sqrt(m.val_usd_m/20))}
                pathOptions={{ color: m.status==='Active'?'#eab308':'#64748b', fillColor: m.status==='Active'?'#92400e':'#374151', fillOpacity:0.85, weight:1.5 }}>
                <Popup>
                  <b style={{color:'#fcd34d'}}>{m.n}</b><br/>
                  <span style={{fontSize:11}}>Type: {m.type}<br/>Status: {m.status}<br/>District: {m.dist}<br/>Reserves: {m.res}<br/>Grade: {m.grade}<br/>Est. Value: {'USD '+m.val_usd_m+'M'}</span>
                </Popup>
              </CircleMarker>
            ))}
            {OIL_BLOCKS.map((o,i) => (
              <CircleMarker key={'oil'+i} center={[o.lat,o.lng]} radius={12}
                pathOptions={{ color:'#3b82f6', fillColor:'#1e3a5f', fillOpacity:0.7, weight:2 }}>
                <Popup>
                  <b style={{color:'#60a5fa'}}>{o.n}</b><br/>
                  <span style={{fontSize:11}}>Operator: {o.op}<br/>Status: {o.status}<br/>Field: {o.field}<br/>Reserves: {o.res}<br/>First Oil: {o.first_oil}</span>
                </Popup>
              </CircleMarker>
            ))}
            {osmMines.filter((e:any)=>e.lat||e.center?.lat).map((e:any,i:number) => (
              <CircleMarker key={'om'+i} center={[e.lat||e.center?.lat,e.lon||e.center?.lon]} radius={4}
                pathOptions={{ color:'#a855f7', fillColor:'#6b21a8', fillOpacity:0.65, weight:1 }}>
                <Popup><span style={{fontSize:11}}>OSM: {e.tags?.name||e.tags?.landuse||'Quarry/Mine'}</span></Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        <div style={{fontSize:11,color:'#64748b',marginTop:8}}> Active Mine (size=est. value) &nbsp; Explored &nbsp; Oil Block &nbsp; OSM quarries ({osmMines.length} features)</div>
      </div>
      <DataTable title="Mineral Deposits — Complete Registry"
        cols={['Name','Type','Status','District','Reserves','Grade','Est. Value (USD M)']}
        rows={MINERALS.map(m=>[m.n,m.type,m.status,m.dist,m.res,m.grade,String(m.val_usd_m)])}/>
      <DataTable title="Oil & Gas Blocks — Albertine Rift"
        cols={['Block Name','Operator','Status','Field(s)','Reserves','First Oil/Gas']}
        rows={OIL_BLOCKS.map(o=>[o.n,o.op,o.status,o.field,o.res,o.first_oil])}/>
      <AnalysisTable title="Extractive Sector Investment Priority Matrix"
        cols={['Commodity','Reserves Size','Current Dev. Stage','Barriers to Dev.','Strategic Value','Investment Priority','Recommended Action']}
        rows={[
          ['Oil (Albertine)','6.5B bbl in-place','Development/FEED','EACOP financing; land acquisition; ESG risk','Transformational — 40% export rev by 2029','CRITICAL','Accelerate EACOP; local content; refinery feasibility'],
          ['Phosphate (Sukulu/Tororo)','510Mt combined','Early production','Processing plant capex; market access','Food security — fertiliser self-sufficiency','HIGH','Phosphate fertiliser complex; SSP/DAP plant'],
          ['Iron Ore (Muko)','162Mt @ 42% Fe','Exploration complete','No smelter; power cost; rail required','Steel for construction boom; import substitution','HIGH','DRI-EAF mini-mill; Muko-Kabale rail spur'],
          ['Gold (Busia, Mubende)','Artisanal + 2Mt ore','Active artisanal + small','Formalisation; mercury pollution; smuggling','USD 300M+ revenue; community wealth','MEDIUM','ASM formalisation; assay labs; export licensing'],
          ['Copper/Cobalt (Kilembe)','4.5Mt @ 1.8% Cu','Mothballed since 1979','Rehabilitation cost USD 400M; tailings','EV battery value chain; regional refining','MEDIUM','PPP rehabilitation; cobalt refinery; ESG framework'],
          ['Rare Earth Elements (Agago)','1.8Mt @ 1.2% TREO','Early exploration','Processing complexity; tech transfer','Strategic minerals — EV + defence supply chain','MEDIUM','Strategic partnership; exploration programme'],
          ['Limestone (Hima)','500Mt','Active — cement','Market demand ceiling; dust/air quality','Cement self-sufficiency; EACOP demand','LOW-MED','Environmental management; capacity expansion'],
          ['Nickel (Tiira)','4Mt @ 0.6% Ni','Exploration','Low nickel price; laterite processing','EV batteries; stainless steel','LOW','Feasibility study; await nickel price recovery'],
        ]}/>
      <SQLPanel title="Mineral Deposits & Oil Blocks" sql={"CREATE TABLE mineral_deposits (\n  id          SERIAL PRIMARY KEY,\n  site_name   VARCHAR(200) NOT NULL,\n  mineral_type VARCHAR(100),\n  status      VARCHAR(50),\n  district    VARCHAR(100),\n  reserves    VARCHAR(200),\n  grade       VARCHAR(100),\n  est_value_usd_m NUMERIC(10,2),\n  lat         NUMERIC(9,6),\n  lng         NUMERIC(9,6)\n);\n\nCREATE TABLE oil_gas_blocks (\n  id          SERIAL PRIMARY KEY,\n  block_name  VARCHAR(200) NOT NULL,\n  operator    VARCHAR(200),\n  status      VARCHAR(100),\n  field_name  VARCHAR(200),\n  reserves_bbl VARCHAR(200),\n  first_oil_yr INTEGER,\n  lat         NUMERIC(9,6),\n  lng         NUMERIC(9,6)\n);\n\n-- Total estimated mineral value by type\nSELECT mineral_type,\n       COUNT(*) AS sites,\n       SUM(est_value_usd_m) AS total_value_m,\n       STRING_AGG(site_name, ', ') AS sites_list\nFROM mineral_deposits\nGROUP BY mineral_type\nORDER BY total_value_m DESC;"}/>
    </div>
  );
}

// ─── ENERGY TAB ───────────────────────────────────────────────────────────────
function EnergyTab() {
  const ovpQ = '[out:json][timeout:30]'+BBOX+';(node["power"="plant"];way["power"="plant"];node["waterway"="dam"];way["waterway"="dam"];);out center;';
  const { data: osmPwr, loading, error } = useOverpass(ovpQ);
  const energyMix = [{name:'Hydropower',v:94},{name:'Solar',v:3},{name:'Biomass',v:2},{name:'Thermal',v:1}];
  const capTrend = [{yr:'2015',mw:856},{yr:'2016',mw:862},{yr:'2017',mw:1006},{yr:'2018',mw:1010},{yr:'2019',mw:1804},{yr:'2020',mw:1820},{yr:'2021',mw:1960},{yr:'2022',mw:2050},{yr:'2023',mw:2180},{yr:'2024',mw:2320}];
  const accessByReg = [{reg:'Central',pct:72},{reg:'Eastern',pct:38},{reg:'Western',pct:32},{reg:'Northern',pct:21},{reg:'West Nile',pct:18},{reg:'Karamoja',pct:9}];
  const totalCap = POWER_PLANTS.reduce((s:number,p:any)=>s+p.cap_mw,0);
  return (
    <div>
      <div style={S.kpiWrap}>
        <KPICard label="Installed Capacity" value={totalCap.toFixed(0)+' MW'} sub="Operational + under development" color="#3b82f6" icon=""/>
        <KPICard label="Electrification Rate" value="48.4%" sub="Urban 72% / Rural 22%" color="#22c55e" icon=""/>
        <KPICard label="Hydropower Share" value="94%" sub="Nile-based generation dominance" color="#06b6d4" icon=""/>
        <KPICard label="Power Plants" value={String(POWER_PLANTS.length)} sub="Hydro + Solar + Thermal sites" color="#eab308" icon=""/>
        <KPICard label="Energy Access Gap" value="26M people" sub="Without grid electricity (2024)" color="#ef4444" icon=""/>
        <KPICard label="Peak Demand" value="760 MW" sub="System peak (2024), growing 8%/yr" color="#a855f7" icon=""/>
        <KPICard label="Off-grid Solar" value="1.2M HH" sub="Solar home systems deployed" color="#f97316" icon=""/>
        <KPICard label="NERP Target" value="4,000 MW" sub="National electrification by 2030" color="#14b8a6" icon=""/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>
        <div style={S.card}>
          <SectionHdr>Generation Mix (%)</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart><Pie data={energyMix} dataKey="v" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={60} label={({name,v}:{name:string,v:number})=>name+' '+v+'%'}>{energyMix.map((_,i)=><Cell key={i} fill={PIE_C[i]}/>)}</Pie><Tooltip/></PieChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <SectionHdr>Installed Capacity Trend (MW)</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={capTrend}><XAxis dataKey="yr" tick={{fill:'#64748b',fontSize:9}}/><YAxis tick={{fill:'#64748b',fontSize:9}}/><Tooltip contentStyle={{background:'#1e293b',border:'none',borderRadius:6}}/><Area type="monotone" dataKey="mw" stroke="#3b82f6" fill="rgba(59,130,246,0.1)"/></AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <SectionHdr>Electrification Rate by Region (%)</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={accessByReg}><XAxis dataKey="reg" tick={{fill:'#64748b',fontSize:9}}/><YAxis tick={{fill:'#64748b',fontSize:9}}/><Tooltip contentStyle={{background:'#1e293b',border:'none',borderRadius:6}}/><Bar dataKey="pct" name="Access %" fill="#22c55e" radius={[3,3,0,0]}/></BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={S.card}>
        <SectionHdr> Power Plants — Operational & Under Development + Live OSM Infrastructure</SectionHdr>
        <div style={{ ...S.mapWrap, position:'relative', height:480 }}>
          <MapLoadingOverlay loading={loading} error={error}/>
          <MapContainer center={UGA} zoom={ZOOM} style={{ height:'100%', width:'100%', background:'#0d1117' }} scrollWheelZoom>
            <TileLayer url={TILES} attribution={ATTRIBUTION}/>
            {POWER_PLANTS.map((p:any,i:number) => (
              <CircleMarker key={'pp'+i} center={[p.lat,p.lng]} radius={Math.max(5, Math.sqrt(p.cap_mw/6))}
                pathOptions={{color:p.type==='Hydro'?'#3b82f6':p.type==='Solar'?'#eab308':'#ef4444',fillColor:p.status==='Operational'?p.type==='Hydro'?'#1d4ed8':'#ca8a04':'#374151',fillOpacity:0.85,weight:1.5}}>
                <Popup>
                  <b style={{color:'#60a5fa'}}>{p.n}</b><br/>
                  <span style={{fontSize:11}}>Type: {p.type}<br/>Capacity: {p.cap_mw} MW<br/>Status: {p.status}<br/>River: {p.river}<br/>Year: {p.yr}</span>
                </Popup>
              </CircleMarker>
            ))}
            {osmPwr.filter((e:any)=>e.lat||e.center?.lat).map((e:any,i:number) => (
              <CircleMarker key={'op'+i} center={[e.lat||e.center?.lat,e.lon||e.center?.lon]} radius={4}
                pathOptions={{color:'#a855f7',fillColor:'#7c3aed',fillOpacity:0.65,weight:1}}>
                <Popup><span style={{fontSize:11}}>OSM: {e.tags?.name||e.tags?.power||'Power facility'}</span></Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        <div style={{fontSize:11,color:'#64748b',marginTop:8}}> Hydro (size=capacity MW) &nbsp; Solar &nbsp; Thermal &nbsp; Planned &nbsp; OSM features ({osmPwr.length})</div>
      </div>
      <DataTable title="Power Plants — Complete Registry"
        cols={['Plant Name','Type','Capacity (MW)','Status','River/Source','Year Commissioned']}
        rows={POWER_PLANTS.map((p:any)=>[p.n,p.type,String(p.cap_mw),p.status,p.river,String(p.yr)])}/>
      <AnalysisTable title="Energy Sector Gap & Investment Analysis"
        cols={['Category','Current Status','Target 2030','Gap','Investment Needed','Key Actions']}
        rows={[
          ['Generation Capacity','2,320 MW','4,000 MW','1,680 MW','USD 3.2B','Karuma comm.; Ayago 840MW; Kiba 380MW; Isimba optimization'],
          ['Grid Electrification','48.4% HH','80% HH','31.6% HH','USD 2.8B','Rural electrification programme; last-mile connections; mini-grids'],
          ['Transmission Lines','~3,100 km','5,500 km','2,400 km','USD 1.4B','400kV backbone; East African Power Pool interconnectors'],
          ['Industrial Park Power','840 MW allocated','2,000 MW','1,160 MW','USD 1.1B','Dedicated industrial feeders; SEZ substations; captive power'],
          ['Solar PV (commercial)','15 MW grid-tied','500 MW','485 MW','USD 450M','Net metering regulation; Feed-in Tariff for solar; rooftop programme'],
          ['Cooking Energy','12% clean HH','60% clean HH','48% HH','USD 180M','LPG subsidies; improved biomass cookstove national programme'],
          ['Energy Poverty','26M without power','<5M without','21M people','USD 2.1B','Grid densification + off-grid solar home systems + mini-hydro'],
          ['Energy Exports','180 MW to neighbours','800 MW','620 MW','USD 600M','Expand EAC interconnectors; SAPP membership; surplus sales to DRC'],
        ]}/>
      <SQLPanel title="Power Infrastructure" sql={"CREATE TABLE power_plants (\n  id            SERIAL PRIMARY KEY,\n  plant_name    VARCHAR(200) NOT NULL,\n  plant_type    VARCHAR(50),   -- Hydro/Solar/Thermal/Wind\n  capacity_mw   NUMERIC(8,2),\n  status        VARCHAR(50),   -- Operational/Under Dev/Planned\n  river_source  VARCHAR(100),\n  year_commissioned INTEGER,\n  operator      VARCHAR(200),\n  lat           NUMERIC(9,6),\n  lng           NUMERIC(9,6)\n);\n\nCREATE TABLE electricity_access (\n  id          SERIAL PRIMARY KEY,\n  district    VARCHAR(100),\n  region      VARCHAR(100),\n  access_pct  NUMERIC(5,2),\n  grid_pct    NUMERIC(5,2),\n  solar_pct   NUMERIC(5,2),\n  survey_year INTEGER\n);\n\n-- Capacity by type and status\nSELECT plant_type, status,\n       COUNT(*) AS plants,\n       SUM(capacity_mw) AS total_mw,\n       ROUND(AVG(capacity_mw),1) AS avg_mw\nFROM power_plants\nGROUP BY plant_type, status\nORDER BY total_mw DESC;"}/>
    </div>
  );
}

// ─── AGRICULTURE TAB ──────────────────────────────────────────────────────────
function AgriTab() {
  const ovpQ = '[out:json][timeout:30]'+BBOX+';(node["amenity"="marketplace"];node["shop"="agrarian"];way["landuse"="farmland"];);out center;';
  const { data: osmAgri, loading, error } = useOverpass(ovpQ);
  const cropRev = [{crop:'Coffee',rev:610},{crop:'Gold',rev:1140},{crop:'Fish',rev:420},{crop:'Maize',rev:380},{crop:'Tea',rev:210},{crop:'Sugar',rev:195},{crop:'Vanilla',rev:145},{crop:'Cotton',rev:95}];
  const agriGdp = [{yr:'2019',v:22.8},{yr:'2020',v:23.5},{yr:'2021',v:23.9},{yr:'2022',v:24.1},{yr:'2023',v:24.4},{yr:'2024',v:24.0}];
  const cropProd = [{crop:'Plantain',prod:9800},{crop:'Cassava',prod:7400},{crop:'Maize',prod:3800},{crop:'Sweet Pot.',prod:3200},{crop:'Sugarcane',prod:2900},{crop:'Beans',prod:1800},{crop:'Coffee',prod:960},{crop:'Millet',prod:820}];
  return (
    <div>
      <div style={S.kpiWrap}>
        <KPICard label="Agricultural Area" value="10.4M ha" sub="43% of total land area (cultivated)" color="#22c55e" icon=""/>
        <KPICard label="Total Crop Production" value="31.5M t" sub="All crops combined (2024 estimate)" color="#84cc16" icon=""/>
        <KPICard label="Coffee Exports" value="USD 610M" sub="#1 agricultural export commodity" color="#eab308" icon=""/>
        <KPICard label="Agricultural GDP" value="24.0%" sub="USD 9.1B contribution (2024)" color="#f97316" icon=""/>
        <KPICard label="Farming Households" value="4.0M" sub="77% of population subsistence-dependent" color="#a855f7" icon=""/>
        <KPICard label="Irrigated Area" value="145,000 ha" sub="3% of arable land; NAIP target 700k ha by 2030" color="#06b6d4" icon=""/>
        <KPICard label="Fish Exports" value="USD 420M" sub="2024; Lake Victoria + Kyoga + Albert" color="#3b82f6" icon=""/>
        <KPICard label="Vanilla Export Value" value="USD 145M" sub="Uganda = 2nd largest global vanilla exporter" color="#ef4444" icon=""/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>
        <div style={S.card}>
          <SectionHdr>Top Export Commodity Revenue (USD M)</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={cropRev}><XAxis dataKey="crop" tick={{fill:'#64748b',fontSize:9}}/><YAxis tick={{fill:'#64748b',fontSize:9}}/><Tooltip contentStyle={{background:'#1e293b',border:'none',borderRadius:6}}/><Bar dataKey="rev" fill="#22c55e" radius={[3,3,0,0]}/></BarChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <SectionHdr>Agricultural GDP Share Trend (%)</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={agriGdp}><XAxis dataKey="yr" tick={{fill:'#64748b',fontSize:10}}/><YAxis domain={[20,28]} tick={{fill:'#64748b',fontSize:10}}/><Tooltip contentStyle={{background:'#1e293b',border:'none',borderRadius:6}}/><Area type="monotone" dataKey="v" stroke="#22c55e" fill="rgba(34,197,94,0.1)"/></AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <SectionHdr>Top Crops by Production (000 t)</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={cropProd} layout="vertical"><XAxis type="number" tick={{fill:'#64748b',fontSize:9}}/><YAxis dataKey="crop" type="category" tick={{fill:'#64748b',fontSize:9}} width={70}/><Tooltip contentStyle={{background:'#1e293b',border:'none',borderRadius:6}}/><Bar dataKey="prod" fill="#84cc16" radius={[0,3,3,0]}/></BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={S.card}>
        <SectionHdr> Agricultural Zones, Agro-Markets & Live OSM Farm Data</SectionHdr>
        <div style={{ ...S.mapWrap, position:'relative', height:480 }}>
          <MapLoadingOverlay loading={loading} error={error}/>
          <MapContainer center={UGA} zoom={ZOOM} style={{ height:'100%', width:'100%', background:'#0d1117' }} scrollWheelZoom>
            <TileLayer url={TILES} attribution={ATTRIBUTION}/>
            {AGRI_ZONES.map((a:any,i:number) => (
              <CircleMarker key={'az'+i} center={[a.lat,a.lng]} radius={Math.max(10, Math.sqrt(a.area_ha/35000))}
                pathOptions={{color:'#22c55e',fillColor:'#166534',fillOpacity:0.6,weight:1.5}}>
                <Popup>
                  <b style={{color:'#4ade80'}}>{a.n}</b><br/>
                  <span style={{fontSize:11}}>Main Crops: {a.crops}<br/>Area: {(a.area_ha/1000).toFixed(0)}k ha<br/>Production: {(a.prod_t/1000).toFixed(0)}k t/yr<br/>Rainfall: {a.rain_mm} mm/yr<br/>Soil: {a.soil}<br/>Export Crop: {a.export_crop}<br/>Farm HH: {a.farmhh.toLocaleString()}</span>
                </Popup>
              </CircleMarker>
            ))}
            {osmAgri.filter((e:any)=>e.lat||e.center?.lat).map((e:any,i:number) => (
              <CircleMarker key={'om'+i} center={[e.lat||e.center?.lat,e.lon||e.center?.lon]} radius={3}
                pathOptions={{color:'#84cc16',fillColor:'#4d7c0f',fillOpacity:0.7,weight:1}}>
                <Popup><span style={{fontSize:11}}>OSM: {e.tags?.name||e.tags?.amenity||e.tags?.landuse||'Agri feature'}</span></Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        <div style={{fontSize:11,color:'#64748b',marginTop:8}}> Agricultural Zone (size=area) &nbsp; OSM Markets/Farmland ({osmAgri.length} features loaded)</div>
      </div>
      <DataTable title="Agricultural Zones — Detailed Production Data"
        cols={['Zone','Main Crops','Area (ha)','Production (t/yr)','Rainfall (mm)','Soil Type','Export Crop','Farm Households']}
        rows={AGRI_ZONES.map((a:any)=>[a.n,a.crops,a.area_ha.toLocaleString(),a.prod_t.toLocaleString(),String(a.rain_mm),a.soil,a.export_crop,a.farmhh.toLocaleString()])}/>
      <AnalysisTable title="Agricultural Productivity & Food Security Analysis"
        cols={['Zone','Yield t/ha','Nat. Avg t/ha','Yield Gap','Water Access','Market Score','Food Security','Priority Intervention']}
        rows={[
          ['Buganda Basin','3.75','2.40','+56%','Rain-fed bimodal + irrigation','8.2/10','Food Secure','Coffee value chain upgrading; post-harvest loss reduction from 35%'],
          ['Ankole Highlands','3.50','2.40','+46%','Bimodal rain-fed; adequate','6.8/10','Moderately Secure','Arabica certification; dairy + beef value chain development'],
          ['Nile Valley North','2.21','1.80','+23%','Uni-modal; periodic drought risk','5.1/10','Food Insecure','Drought-tolerant varieties (NARO); small-scale irrigation units'],
          ['Karamoja Arid Zone','0.90','0.80','+13%','Highly variable; severe dry spells','2.8/10','Severely Insecure','Emergency irrigation; livelihood diversification; livestock insurance'],
          ['Busoga Sugarbelt','4.57','3.50','+31%','Bimodal; adequate — some waterlog','7.9/10','Food Secure','Sugar processing upgrade; maize + cassava diversification; storage'],
          ['Rwenzori Slopes','1.68','1.40','+20%','High rainfall; waterlogging risk','5.5/10','Moderately Secure','Tea extension + vanilla premium; terracing; drainage improvement'],
          ['West Nile Corridor','2.33','1.90','+23%','Uni-modal; adequate','5.8/10','Borderline Insecure','Tobacco crop alternatives; sunflower oil value chain; cooperatives'],
          ['Teso Cotton Belt','2.18','1.75','+25%','Bi-modal with dry spells','5.4/10','Borderline Insecure','Cotton revival programme; sunflower + groundnuts diversification'],
        ]}/>
      <SQLPanel title="Agricultural Zones & Markets" sql={"CREATE TABLE agri_zones (\n  id            SERIAL PRIMARY KEY,\n  zone_name     VARCHAR(200),\n  main_crops    TEXT,\n  area_ha       BIGINT,\n  production_t  BIGINT,\n  rainfall_mm   INTEGER,\n  soil_type     VARCHAR(100),\n  export_crop   VARCHAR(100),\n  farm_hh       INTEGER,\n  lat           NUMERIC(9,6),\n  lng           NUMERIC(9,6)\n);\n\nCREATE TABLE agri_markets (\n  id          SERIAL PRIMARY KEY,\n  market_name VARCHAR(200),\n  district    VARCHAR(100),\n  market_type VARCHAR(50),  -- wholesale/retail/border\n  traders_n   INTEGER,\n  weekly_turnover_m NUMERIC(10,2),\n  lat         NUMERIC(9,6),\n  lng         NUMERIC(9,6)\n);\n\n-- Zone productivity ranking\nSELECT zone_name, main_crops,\n       area_ha, production_t,\n       ROUND(production_t::NUMERIC/area_ha,2) AS yield_t_ha,\n       farm_hh,\n       ROUND(production_t::NUMERIC/farm_hh,1) AS prod_per_hh_t\nFROM agri_zones\nORDER BY yield_t_ha DESC;"}/>
    </div>
  );
}

// ─── ENVIRONMENT TAB ──────────────────────────────────────────────────────────
function EnvironmentTab() {
  const ovpQ = '[out:json][timeout:30]'+BBOX+';(way["leisure"="nature_reserve"];relation["boundary"="protected_area"];node["natural"="water"];);out center;';
  const { data: osmEnv, loading, error } = useOverpass(ovpQ);
  const paTypes = [{name:'National Parks',v:10},{name:'Forest Reserves',v:506},{name:'Game Reserves',v:12},{name:'Wildlife Sanctuaries',v:9},{name:'Ramsar Wetlands',v:12}];
  const forestTrend = [{yr:'2000',v:4.9},{yr:'2005',v:4.3},{yr:'2010',v:3.8},{yr:'2015',v:3.4},{yr:'2020',v:3.2},{yr:'2024',v:3.1}];
  const waterArea = [{name:'L. Victoria',v:31093},{name:'L. Albert',v:5347},{name:'L. Kyoga',v:2700},{name:'L. Edward',v:2325},{name:'Others',v:2763}];
  return (
    <div>
      <div style={S.kpiWrap}>
        <KPICard label="Protected Areas" value="37,000 km²" sub="15.3% of Uganda total area" color="#22c55e" icon=""/>
        <KPICard label="National Parks" value="10" sub="~4,903 km² gazetted area" color="#84cc16" icon=""/>
        <KPICard label="Forest Cover" value="3.1M ha" sub="Down from 4.9M ha in 2000 (-37%)" color="#ef4444" icon=""/>
        <KPICard label="Wetland Cover" value="13.1%" sub="3.16M ha; declining ~2%/yr" color="#06b6d4" icon=""/>
        <KPICard label="Freshwater Area" value="44,228 km²" sub="18% of Uganda is water surface" color="#3b82f6" icon=""/>
        <KPICard label="Carbon Stock" value="580 Mt CO₂e" sub="Forests + wetlands combined (est.)" color="#a855f7" icon=""/>
        <KPICard label="Endangered Species" value="70+" sub="IUCN Red List CR + EN (flora + fauna)" color="#f97316" icon=""/>
        <KPICard label="UNESCO World Heritage" value="3 sites" sub="Bwindi, Rwenzori Mountains, Kasubi Tombs" color="#eab308" icon=""/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>
        <div style={S.card}>
          <SectionHdr>Protected Areas by Category</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart><Pie data={paTypes} dataKey="v" nameKey="name" cx="50%" cy="50%" innerRadius={28} outerRadius={58} label={({name}:{name:string})=>name}>{paTypes.map((_,i)=><Cell key={i} fill={PIE_C[i]}/>)}</Pie><Tooltip/></PieChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <SectionHdr>Forest Cover Loss 2000-2024 (M ha)</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={forestTrend}><XAxis dataKey="yr" tick={{fill:'#64748b',fontSize:10}}/><YAxis domain={[2,6]} tick={{fill:'#64748b',fontSize:10}}/><Tooltip contentStyle={{background:'#1e293b',border:'none',borderRadius:6}}/><Area type="monotone" dataKey="v" stroke="#ef4444" fill="rgba(239,68,68,0.1)"/></AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <SectionHdr>Major Lakes Area (km²)</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={waterArea}><XAxis dataKey="name" tick={{fill:'#64748b',fontSize:9}}/><YAxis tick={{fill:'#64748b',fontSize:9}}/><Tooltip contentStyle={{background:'#1e293b',border:'none',borderRadius:6}}/><Bar dataKey="v" fill="#06b6d4" radius={[3,3,0,0]}/></BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={S.card}>
        <SectionHdr> Protected Areas, Lakes & Wetlands + Live OSM Environmental Features</SectionHdr>
        <div style={{ ...S.mapWrap, position:'relative', height:480 }}>
          <MapLoadingOverlay loading={loading} error={error}/>
          <MapContainer center={UGA} zoom={ZOOM} style={{ height:'100%', width:'100%', background:'#0d1117' }} scrollWheelZoom>
            <TileLayer url={TILES} attribution={ATTRIBUTION}/>
            {PROTECTED_AREAS.map((p:any,i:number) => (
              <CircleMarker key={'pa'+i} center={[p.lat,p.lng]} radius={Math.max(7, Math.sqrt(p.area_km2/35))}
                pathOptions={{color:p.type==='National Park'?'#22c55e':'#84cc16',fillColor:p.type==='National Park'?'#166534':'#3f6212',fillOpacity:0.7,weight:p.whs?2.5:1.5}}>
                <Popup>
                  <b style={{color:'#4ade80'}}>{p.n}{p.whs?' ':''}</b><br/>
                  <span style={{fontSize:11}}>Type: {p.type}<br/>Area: {p.area_km2.toLocaleString()} km²<br/>Key Animals: {p.animals}<br/>Established: {p.established}<br/>UNESCO WHS: {p.whs?'Yes':'No'}</span>
                </Popup>
              </CircleMarker>
            ))}
            {WETLANDS.map((w:any,i:number) => (
              <CircleMarker key={'wl'+i} center={[w.lat,w.lng]} radius={Math.max(6, Math.sqrt(w.area_km2/200))}
                pathOptions={{color:'#06b6d4',fillColor:'#0e7490',fillOpacity:0.6,weight:1.5}}>
                <Popup>
                  <b style={{color:'#67e8f9'}}>{w.n}</b><br/>
                  <span style={{fontSize:11}}>Type: {w.type}<br/>Area: {w.area_km2.toLocaleString()} km²<br/>Depth: {w.depth_m}m<br/>Shared with: {w.sh}</span>
                </Popup>
              </CircleMarker>
            ))}
            {osmEnv.filter((e:any)=>e.lat||e.center?.lat).map((e:any,i:number) => (
              <CircleMarker key={'oe'+i} center={[e.lat||e.center?.lat,e.lon||e.center?.lon]} radius={3}
                pathOptions={{color:'#a855f7',fillColor:'#6b21a8',fillOpacity:0.6,weight:1}}>
                <Popup><span style={{fontSize:11}}>OSM: {e.tags?.name||e.tags?.leisure||'Protected area'}</span></Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        <div style={{fontSize:11,color:'#64748b',marginTop:8}}> National Park &nbsp; Game/Wildlife Reserve &nbsp; Lake/Wetland (size=area) &nbsp; OSM env. features &nbsp; UNESCO WHS</div>
      </div>
      <DataTable title="Protected Areas — Complete Registry"
        cols={['Name','Type','Area (km²)','Key Wildlife','Established','UNESCO WHS']}
        rows={PROTECTED_AREAS.map((p:any)=>[p.n,p.type,p.area_km2.toLocaleString(),p.animals,String(p.established),p.whs?'Yes ':'No'])}/>
      <DataTable title="Major Water Bodies & Wetlands"
        cols={['Name','Type','Area (km²)','Max Depth (m)','Shared With']}
        rows={WETLANDS.map((w:any)=>[w.n,w.type,w.area_km2.toLocaleString(),String(w.depth_m),w.sh])}/>
      <AnalysisTable title="Environmental Threat Assessment & Conservation Priorities"
        cols={['Ecosystem','Threat Level','Primary Threats','Area Lost/yr','Carbon Impact','Priority Actions','Est. Cost (USD M)']}
        rows={[
          ['Tropical Forests','CRITICAL','Charcoal/firewood, agriculture encroachment','18,000 ha','22 Mt CO2/yr','REDD+ implementation; community forest management; LPG subsidy','180'],
          ['Murchison Falls NP','HIGH','Oil development impact, poaching, buffer farming','—','Intact stock','EIA enforcement; wildlife corridor; community benefit sharing','45'],
          ['Queen Elizabeth NP','HIGH','Human-wildlife conflict, charcoal production','—','Intact stock','Electric fence extension; METT monitoring; tourism reinvestment','38'],
          ['Bwindi/Rwenzori WHS','MEDIUM','Gorilla disease, climate shift, edge encroachment','—','Critical','Gorilla health screening; climate adaptation; benefit-sharing','25'],
          ['Lake Victoria','HIGH','Eutrophication, invasive water hyacinth, overfishing','N/A','Critical fishery','Hyacinth harvesting; waste water treatment; landing site upgrade','95'],
          ['Wetlands (national)','HIGH','Drainage for agriculture, urban expansion','30,000 ha','58 Mt CO2 stored','Wetland demarcation and enforcement; smart agricultural subsidies','65'],
          ['River Nile Catchment','MEDIUM','Hydropower dams, sedimentation, watershed deforestation','N/A','—','Environmental flow requirements; riparian reforestation programme','40'],
          ['Albertine Rift','HIGH','Oil exploration, deforestation, road infrastructure','~8,000 ha','High biodiversity','Strict EIA for oil; transboundary conservation with DRC/Rwanda','55'],
        ]}/>
      <SQLPanel title="Protected Areas & Environment" sql={"CREATE TABLE protected_areas (\n  id            SERIAL PRIMARY KEY,\n  pa_name       VARCHAR(200) NOT NULL,\n  pa_type       VARCHAR(100),\n  area_km2      NUMERIC(10,2),\n  key_wildlife  TEXT,\n  established_yr INTEGER,\n  is_whs        BOOLEAN DEFAULT FALSE,\n  iucn_category VARCHAR(10),\n  lat           NUMERIC(9,6),\n  lng           NUMERIC(9,6)\n);\n\nCREATE TABLE water_bodies (\n  id            SERIAL PRIMARY KEY,\n  water_name    VARCHAR(200),\n  water_type    VARCHAR(50),\n  area_km2      NUMERIC(10,2),\n  max_depth_m   NUMERIC(6,1),\n  shared_with   VARCHAR(100),\n  ramsar        BOOLEAN DEFAULT FALSE,\n  lat           NUMERIC(9,6),\n  lng           NUMERIC(9,6)\n);\n\n-- PA coverage summary\nSELECT pa_type, COUNT(*) AS sites,\n       SUM(area_km2) AS total_km2,\n       ROUND(100.0*SUM(area_km2)/241551,2) AS pct_of_uganda,\n       COUNT(*) FILTER (WHERE is_whs) AS whs_sites\nFROM protected_areas\nGROUP BY pa_type\nORDER BY total_km2 DESC;"}/>
    </div>
  );
}

// ─── EDUCATION & HEALTH TAB ──────────────────────────────────────────────────
function EduHealthTab() {
  const ovpSchool = '[out:json][timeout:30]'+BBOX+';(node["amenity"="school"];node["amenity"="college"];node["amenity"="university"];);out center;';
  const ovpHealth = '[out:json][timeout:30]'+BBOX+';(node["amenity"="hospital"];node["amenity"="clinic"];node["amenity"="health_post"];);out center;';
  const { data: osmSchools, loading: sl } = useOverpass(ovpSchool);
  const { data: osmHospitals, loading: hl } = useOverpass(ovpHealth);
  const loading = sl || hl;
  const eduLvl = [{name:'Pre-Primary',v:12842},{name:'Primary',v:17000},{name:'Secondary',v:3500},{name:'Vocational',v:780},{name:'University',v:53}];
  const healthTrend = [{yr:'2005',imr:70},{yr:'2010',imr:60},{yr:'2015',imr:54},{yr:'2019',imr:45},{yr:'2022',imr:41},{yr:'2024',imr:37}];
  const healthFac = [{type:'HC II',n:2640},{type:'HC III',n:1250},{type:'HC IV',n:190},{type:'Gen. Hospital',n:82},{type:'Regional Hosp.',n:14},{type:'Natl. Referral',n:4}];
  return (
    <div>
      <div style={S.kpiWrap}>
        <KPICard label="Literacy Rate" value="79.0%" sub="Adult 15+; Male 83% / Female 75% (2024)" color="#3b82f6" icon=""/>
        <KPICard label="Primary Schools" value="17,000+" sub="Government + private + PNFP (2024)" color="#22c55e" icon=""/>
        <KPICard label="Universities" value="53" sub="Public (10) + Private (43) accredited" color="#a855f7" icon=""/>
        <KPICard label="Primary Net Enrolment" value="96.1%" sub="UPE driven; completion rate only 53%" color="#eab308" icon=""/>
        <KPICard label="Infant Mortality Rate" value="37/1,000" sub="Live births (down from 70 in 2005) — improving" color="#ef4444" icon=""/>
        <KPICard label="Life Expectancy" value="67.4 yr" sub="Male 65.6 / Female 69.2 (2024 est.)" color="#06b6d4" icon=""/>
        <KPICard label="Health Facilities" value="4,180+" sub="NRI + Regional + HC I–IV nationwide" color="#f97316" icon=""/>
        <KPICard label="Doctor:Patient" value="1 : 24,725" sub="Far below WHO target of 1:1,000" color="#84cc16" icon=""/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>
        <div style={S.card}>
          <SectionHdr>Schools by Education Level</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={eduLvl}><XAxis dataKey="name" tick={{fill:'#64748b',fontSize:8}}/><YAxis tick={{fill:'#64748b',fontSize:9}}/><Tooltip contentStyle={{background:'#1e293b',border:'none',borderRadius:6}}/><Bar dataKey="v" fill="#3b82f6" radius={[3,3,0,0]}/></BarChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <SectionHdr>Infant Mortality Rate Trend (per 1,000 LB)</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={healthTrend}><XAxis dataKey="yr" tick={{fill:'#64748b',fontSize:10}}/><YAxis tick={{fill:'#64748b',fontSize:10}}/><Tooltip contentStyle={{background:'#1e293b',border:'none',borderRadius:6}}/><Area type="monotone" dataKey="imr" stroke="#ef4444" fill="rgba(239,68,68,0.1)"/></AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <SectionHdr>Health Facilities by Level</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={healthFac} layout="vertical"><XAxis type="number" tick={{fill:'#64748b',fontSize:9}}/><YAxis dataKey="type" type="category" tick={{fill:'#64748b',fontSize:8}} width={90}/><Tooltip contentStyle={{background:'#1e293b',border:'none',borderRadius:6}}/><Bar dataKey="n" fill="#06b6d4" radius={[0,3,3,0]}/></BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={S.card}>
        <SectionHdr> Live OSM Schools & Health Facilities Across Uganda</SectionHdr>
        <div style={{ ...S.mapWrap, position:'relative', height:480 }}>
          <MapLoadingOverlay loading={loading}/>
          <MapContainer center={UGA} zoom={ZOOM} style={{ height:'100%', width:'100%', background:'#0d1117' }} scrollWheelZoom>
            <TileLayer url={TILES} attribution={ATTRIBUTION}/>
            {osmSchools.filter((e:any)=>e.lat).slice(0,400).map((e:any,i:number) => (
              <CircleMarker key={'sc'+i} center={[e.lat,e.lon]} radius={3}
                pathOptions={{color:'#3b82f6',fillColor:'#1d4ed8',fillOpacity:0.7,weight:0.8}}>
                <Popup><span style={{fontSize:11}}> {e.tags?.name||'School'}<br/>{e.tags?.amenity}</span></Popup>
              </CircleMarker>
            ))}
            {osmHospitals.filter((e:any)=>e.lat).map((e:any,i:number) => (
              <CircleMarker key={'hp'+i} center={[e.lat,e.lon]} radius={e.tags?.amenity==='hospital'?8:4}
                pathOptions={{color:'#ef4444',fillColor:'#b91c1c',fillOpacity:0.8,weight:1}}>
                <Popup><span style={{fontSize:11}}> {e.tags?.name||'Health Facility'}<br/>{e.tags?.amenity}</span></Popup>
              </CircleMarker>
            ))}
            {CITIES.map((c:any,i:number) => (
              <CircleMarker key={'cc'+i} center={[c.lat,c.lng]} radius={4}
                pathOptions={{color:'#fbbf24',fillColor:'#92400e',fillOpacity:0.6,weight:1}}>
                <Popup><span style={{fontSize:11}}>{c.n}</span></Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        <div style={{fontSize:11,color:'#64748b',marginTop:8}}> Schools ({osmSchools.length} OSM, showing 400) &nbsp; Health Facilities ({osmHospitals.length} OSM) &nbsp; City reference points</div>
      </div>
      <AnalysisTable title="District Education & Health Access Analysis"
        cols={['District','Literacy %','Schools est.','Primary NER','Hospitals est.','Pop/Doctor','IMR (est.)','Development Tier']}
        rows={DISTRICTS.map((d:any)=>[
          d.n,
          String(d.literacy)+'%',
          String(Math.round(d.pop/8000+12)),
          d.literacy>80?'94%':d.literacy>70?'87%':'78%',
          String(Math.round(d.pop/55000)),
          (Math.round(d.pop/Math.max(1,Math.round(d.pop/25000)))).toLocaleString(),
          String(Math.round(48-d.literacy*0.13)),
          d.gdp_m>2000?'Tier 1':d.gdp_m>400?'Tier 2':d.gdp_m>200?'Tier 3':'Tier 4'
        ])}/>
      <AnalysisTable title="Key Education & Health Policy Gaps"
        cols={['Indicator','Current Value','SDG / NDP Target','Gap','Root Cause','Recommended Intervention']}
        rows={[
          ['Primary Completion Rate','53%','≥85%','32pp','Poverty, child labour, distance to school >5km','School Meals Programme; conditional cash transfers; rural school construction'],
          ['Secondary Enrolment (NER)','34%','60%','26pp','USE cost barriers; pregnancy; early marriage','USE bursary expansion; girl-child protection; boarding subsidies'],
          ['University Gross Enrolment','9%','20%','11pp','Cost; limited STEM capacity; urban-rural divide','Student loan scheme; STEM infrastructure; distance learning'],
          ['Skilled Birth Attendance','74%','≥95%','21pp','HC II/III staffing gaps; distance in rural areas','Midwifery training scale-up; maternity waiting homes; MoH incentives'],
          ['Under-5 Mortality','49/1,000','<25/1,000','24 per 1k','Malaria 30%, diarrhoea 18%, pneumonia 14%','LLIN scale-up; ORS distribution; community health worker (VHT) programme'],
          ['HIV Prevalence','5.1%','<2%','3.1pp','Behaviour, GBV, low male circumcision coverage','PrEP scale-up; VMMC; PMTCT 100% coverage; stigma reduction'],
          ['Doctor:Patient Ratio','1:24,725','1:1,000 (WHO)','96% deficit','Emigration; low production; unattractive rural posting','Medical school expansion; rural retention bonuses; task-shifting to nurses'],
          ['Malnutrition (stunting)','29%','<10%','19pp','Food insecurity, poor WASH, inadequate feeding','SUN multi-sector nutrition; school feeding; fortification'],
        ]}/>
      <SQLPanel title="Education & Health Infrastructure" sql={"CREATE TABLE schools (\n  id            SERIAL PRIMARY KEY,\n  school_name   VARCHAR(200),\n  school_level  VARCHAR(50),   -- Pre-primary/Primary/Secondary/Tertiary\n  ownership     VARCHAR(50),   -- Government/Private/PNFP\n  district      VARCHAR(100),\n  enrolment     INTEGER,\n  teachers      INTEGER,\n  classrooms    INTEGER,\n  lat           NUMERIC(9,6),\n  lng           NUMERIC(9,6)\n);\n\nCREATE TABLE health_facilities (\n  id              SERIAL PRIMARY KEY,\n  facility_name   VARCHAR(200),\n  facility_level  VARCHAR(50),  -- HC II / HC III / HC IV / Hospital\n  ownership       VARCHAR(50),  -- Government/Private/PNFP\n  district        VARCHAR(100),\n  beds            INTEGER,\n  doctors         INTEGER,\n  nurses          INTEGER,\n  functional_24h  BOOLEAN,\n  lat             NUMERIC(9,6),\n  lng             NUMERIC(9,6)\n);\n\n-- District facility coverage ratio\nSELECT d.district_name,\n       COUNT(DISTINCT s.id) FILTER (WHERE s.school_level='Primary') AS primary_schools,\n       COUNT(DISTINCT h.id) AS health_facilities,\n       ROUND(d.population::NUMERIC/NULLIF(COUNT(DISTINCT h.id),0)) AS pop_per_facility,\n       SUM(h.beds) AS total_beds,\n       ROUND(1000.0*SUM(h.beds)/d.population,2) AS beds_per_1000\nFROM uga_districts d\nLEFT JOIN schools s ON s.district=d.district_name\nLEFT JOIN health_facilities h ON h.district=d.district_name\nGROUP BY d.district_name, d.population\nORDER BY pop_per_facility DESC NULLS LAST;"}/>
    </div>
  );
}

// ─── DEMOGRAPHICS TAB ─────────────────────────────────────────────────────────
function DemoTab() {
  const popByAge = [{age:'0-4',v:17.2},{age:'5-14',v:26.1},{age:'15-24',v:21.3},{age:'25-34',v:14.9},{age:'35-44',v:9.8},{age:'45-54',v:5.9},{age:'55-64',v:3.2},{age:'65+',v:1.6}];
  const popGrowth = [{yr:'2000',v:23.3},{yr:'2005',v:27.8},{yr:'2010',v:33.8},{yr:'2015',v:39.6},{yr:'2020',v:45.7},{yr:'2024',v:49.9},{yr:'2030',v:56.8},{yr:'2035',v:65.0},{yr:'2040',v:74.2}];
  const urbanRural = [{name:'Rural',v:76},{name:'Urban',v:24}];
  const ethnicGroups = [{name:'Baganda',v:16.5},{name:'Banyankole',v:9.6},{name:'Basoga',v:8.8},{name:'Bakiga',v:7.1},{name:'Iteso',v:7.0},{name:'Langi',v:6.3},{name:'Acholi',v:4.7},{name:'Others',v:40.0}];
  return (
    <div>
      <div style={S.kpiWrap}>
        <KPICard label="Total Population" value="49.9M" sub="2024 estimate; 3rd most populous EAC state" color="#3b82f6" icon=""/>
        <KPICard label="Population Density" value="207/km²" sub="Ranges 11 (Kaabong) to 6,700 (Kampala)" color="#a855f7" icon=""/>
        <KPICard label="Annual Growth Rate" value="3.0%/yr" sub="Among highest globally; doubling every 23yr" color="#ef4444" icon=""/>
        <KPICard label="Median Age" value="16.7 yr" sub="One of the youngest populations worldwide" color="#22c55e" icon=""/>
        <KPICard label="Urban Population" value="24%" sub="10.9M urban; Kampala Metro ~4.5M" color="#eab308" icon=""/>
        <KPICard label="Total Fertility Rate" value="4.6 TFR" sub="Down from 7.1 in 1990; declining slowly" color="#f97316" icon=""/>
        <KPICard label="Working-Age Pop." value="51%" sub="25.4M aged 15–64; youth dividend opening" color="#06b6d4" icon=""/>
        <KPICard label="Languages" value="65+" sub="Bantu, Nilotic, Central Sudanic language groups" color="#84cc16" icon=""/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={S.card}>
            <SectionHdr>Population by Age Group (%)</SectionHdr>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={popByAge}><XAxis dataKey="age" tick={{fill:'#64748b',fontSize:8}}/><YAxis tick={{fill:'#64748b',fontSize:8}}/><Tooltip contentStyle={{background:'#1e293b',border:'none',borderRadius:6}}/><Bar dataKey="v" fill="#3b82f6" radius={[3,3,0,0]}/></BarChart>
            </ResponsiveContainer>
          </div>
          <div style={S.card}>
            <SectionHdr>Urban vs Rural Split</SectionHdr>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart><Pie data={urbanRural} dataKey="v" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={60} label={({name,v}:{name:string,v:number})=>name+' '+v+'%'}>{urbanRural.map((_,i)=><Cell key={i} fill={PIE_C[i]}/>)}</Pie><Tooltip/></PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={S.card}>
          <SectionHdr>Population Growth Projection (M)</SectionHdr>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={popGrowth}><XAxis dataKey="yr" tick={{fill:'#64748b',fontSize:10}}/><YAxis tick={{fill:'#64748b',fontSize:10}}/><Tooltip contentStyle={{background:'#1e293b',border:'none',borderRadius:6}}/><Area type="monotone" dataKey="v" stroke="#a855f7" fill="rgba(168,85,247,0.1)"/></AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={S.card}>
        <SectionHdr>Largest Ethnic Groups by Population Share (%)</SectionHdr>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={ethnicGroups}><XAxis dataKey="name" tick={{fill:'#64748b',fontSize:9}}/><YAxis tick={{fill:'#64748b',fontSize:9}}/><Tooltip contentStyle={{background:'#1e293b',border:'none',borderRadius:6}}/><Bar dataKey="v" fill="#f97316" radius={[3,3,0,0]}/></BarChart>
        </ResponsiveContainer>
      </div>
      <div style={S.card}>
        <SectionHdr> District Population Density Map (colour = density, size = population)</SectionHdr>
        <div style={{ ...S.mapWrap, position:'relative', height:480 }}>
          <MapContainer center={UGA} zoom={ZOOM} style={{ height:'100%', width:'100%', background:'#0d1117' }} scrollWheelZoom>
            <TileLayer url={TILES} attribution={ATTRIBUTION}/>
            {DISTRICTS.map((d:any,i:number) => {
              const density = Math.round(d.pop/d.area_km2);
              const intensity = Math.min(1, density/500);
              const r = Math.round(255*intensity);
              const b = Math.round(255*(1-intensity));
              const col = 'rgba('+r+',40,'+b+',0.82)';
              return (
                <CircleMarker key={'dm'+i} center={[d.lat,d.lng]} radius={Math.max(8, Math.sqrt(d.pop/80000))}
                  pathOptions={{color:'#fff',fillColor:col,fillOpacity:0.85,weight:0.8}}>
                  <Popup>
                    <b style={{color:'#a5b4fc'}}>{d.n} District</b><br/>
                    <span style={{fontSize:11}}>Population: {d.pop.toLocaleString()}<br/>Area: {d.area_km2.toLocaleString()} km²<br/>Density: {density}/km²<br/>Region: {d.reg}<br/>GDP: USD {d.gdp_m}M<br/>Poverty: {d.poverty}%<br/>Literacy: {d.literacy}%</span>
                  </Popup>
                </CircleMarker>
              );
            })}
            {CITIES.map((c:any,i:number) => (
              <CircleMarker key={'ct'+i} center={[c.lat,c.lng]} radius={Math.max(4, Math.sqrt(c.pop/200000))}
                pathOptions={{color:'#fbbf24',fillColor:'#92400e',fillOpacity:0.9,weight:1.5}}>
                <Popup><b style={{color:'#fcd34d'}}>{c.n}</b><br/><span style={{fontSize:11}}>Pop: {c.pop.toLocaleString()}<br/>{c.type} | {c.reg}</span></Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        <div style={{fontSize:11,color:'#64748b',marginTop:8}}> District (size=population, blue=sparse → red=dense) &nbsp; Cities</div>
      </div>
      <DataTable title="District-Level Demographics — Full Data (20 sample districts)"
        cols={['District','Region','Population','Area (km²)','Density/km²','GDP (USD M)','Poverty %','Literacy %']}
        rows={DISTRICTS.map((d:any)=>[d.n,d.reg,d.pop.toLocaleString(),d.area_km2.toLocaleString(),Math.round(d.pop/d.area_km2).toString(),String(d.gdp_m),String(d.poverty)+'%',String(d.literacy)+'%'])}/>
      <AnalysisTable title="Regional Demographic Vulnerability & Development Priority Index"
        cols={['Region','Pop (M est.)','Density/km²','Youth Bulge %','Urban %','Poverty Rate','Food Insecurity','Conflict Risk','Development Priority']}
        rows={[
          ['Central','12.8M','820','52%','55%','14%','Low','Low','Consolidate urban services; address inequality; affordable housing'],
          ['Eastern','11.5M','240','56%','18%','33%','Moderate','Low-Medium','Agricultural productivity; road corridor; flood management'],
          ['Western','10.8M','170','54%','16%','27%','Low-Moderate','Low','Tourism economy; oil value chain; highlands value chains'],
          ['Northern','8.9M','80','58%','14%','44%','Moderate','Medium','Post-conflict recovery; infrastructure investment; youth employment'],
          ['West Nile','3.8M','135','61%','12%','50%','High','Medium','Refugee integration; market access roads; basic services'],
          ['Karamoja','1.1M','18','63%','6%','77%','Severe','High','Emergency services; climate adaptation; mineral formalisation; peace'],
        ]}/>
      <SQLPanel title="Demographics" sql={"-- Population projections table\nCREATE TABLE population_projections (\n  id          SERIAL PRIMARY KEY,\n  year        INTEGER,\n  total_pop   BIGINT,\n  urban_pop   BIGINT,\n  rural_pop   BIGINT,\n  growth_rate NUMERIC(5,3),\n  tfr         NUMERIC(4,2),\n  median_age  NUMERIC(4,1)\n);\n\nCREATE TABLE demographics_district (\n  id          SERIAL PRIMARY KEY,\n  district    VARCHAR(100),\n  region      VARCHAR(100),\n  population  BIGINT,\n  area_km2    NUMERIC(10,2),\n  pop_density NUMERIC(8,2),\n  urban_pct   NUMERIC(5,2),\n  youth_pct   NUMERIC(5,2),   -- 15-35\n  female_pct  NUMERIC(5,2),\n  census_year INTEGER\n);\n\n-- Identify fastest-growing districts\nSELECT d.district, d.region,\n       d.population,\n       ROUND(d.population::NUMERIC/d.area_km2,1) AS density,\n       d.urban_pct, d.youth_pct\nFROM demographics_district d\nORDER BY d.population DESC\nLIMIT 15;"}/>
    </div>
  );
}

// ─── ECONOMY TAB ──────────────────────────────────────────────────────────────
function EconomyTab() {
  const ovpQ = '[out:json][timeout:30]'+BBOX+';(way["landuse"="industrial"];node["office"="company"];node["shop"="bank"];way["office"="financial"];);out center;';
  const { data: osmEcon, loading, error } = useOverpass(ovpQ);
  const gdpSectors = [{name:'Services',v:46},{name:'Industry',v:27},{name:'Agriculture',v:24},{name:'Taxes',v:3}];
  const exports = [{yr:'2018',v:3.3},{yr:'2019',v:3.6},{yr:'2020',v:3.2},{yr:'2021',v:3.9},{yr:'2022',v:4.5},{yr:'2023',v:5.1},{yr:'2024',v:5.8}];
  const ezInvest = ECONOMIC_ZONES.slice(0,8).map((z:any)=>({name:z.n.replace(' Industrial Park','').replace(' Industrial & Business Park','').replace(/ SEZ$/,'').substring(0,14),invest:z.invest_m}));
  return (
    <div>
      <div style={S.kpiWrap}>
        <KPICard label="GDP (2024)" value="USD 38.1B" sub="Growth 6.3%; NDP target 6.5%/yr" color="#22c55e" icon=""/>
        <KPICard label="GDP per Capita" value="USD 963" sub="PPP USD 2,870 (2024 WB estimate)" color="#3b82f6" icon=""/>
        <KPICard label="Export Revenue" value="USD 5.8B" sub="Coffee 10.5%; Gold 19.6%; Fish 7.2%" color="#eab308" icon=""/>
        <KPICard label="FDI Inflow" value="USD 1.28B" sub="2024; mainly oil sector + manufacturing" color="#a855f7" icon=""/>
        <KPICard label="Industrial Parks" value="22" sub="Operational + pipeline (UIA data 2024)" color="#f97316" icon=""/>
        <KPICard label="Tax-to-GDP Ratio" value="14.2%" sub="URA target 16% by 2026" color="#06b6d4" icon=""/>
        <KPICard label="Inflation (CPI)" value="4.1%" sub="Annual avg 2024; food component 5.2%" color="#ef4444" icon=""/>
        <KPICard label="Unemployment" value="12.4%" sub="ILO definition; youth 15-24 = 18.3%" color="#84cc16" icon=""/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>
        <div style={S.card}>
          <SectionHdr>GDP by Sector (%)</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart><Pie data={gdpSectors} dataKey="v" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={58} label={({name,v}:{name:string,v:number})=>name+' '+v+'%'}>{gdpSectors.map((_,i)=><Cell key={i} fill={PIE_C[i]}/>)}</Pie><Tooltip/></PieChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <SectionHdr>Total Export Revenue Trend (USD B)</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={exports}><XAxis dataKey="yr" tick={{fill:'#64748b',fontSize:10}}/><YAxis tick={{fill:'#64748b',fontSize:10}}/><Tooltip contentStyle={{background:'#1e293b',border:'none',borderRadius:6}}/><Area type="monotone" dataKey="v" stroke="#22c55e" fill="rgba(34,197,94,0.1)"/></AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <SectionHdr>Top Economic Zones — Investment (USD M)</SectionHdr>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={ezInvest}><XAxis dataKey="name" tick={{fill:'#64748b',fontSize:8}}/><YAxis tick={{fill:'#64748b',fontSize:9}}/><Tooltip contentStyle={{background:'#1e293b',border:'none',borderRadius:6}}/><Bar dataKey="invest" fill="#f97316" radius={[3,3,0,0]}/></BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={S.card}>
        <SectionHdr> Economic Zones, Industrial Parks & Live OSM Economic Features</SectionHdr>
        <div style={{ ...S.mapWrap, position:'relative', height:480 }}>
          <MapLoadingOverlay loading={loading} error={error}/>
          <MapContainer center={UGA} zoom={ZOOM} style={{ height:'100%', width:'100%', background:'#0d1117' }} scrollWheelZoom>
            <TileLayer url={TILES} attribution={ATTRIBUTION}/>
            {ECONOMIC_ZONES.map((z:any,i:number) => (
              <CircleMarker key={'ez'+i} center={[z.lat,z.lng]} radius={Math.max(7, Math.sqrt(z.area_ha/25))}
                pathOptions={{color:z.status==='Operational'?'#f97316':'#eab308',fillColor:z.status==='Operational'?'#c2410c':'#92400e',fillOpacity:0.82,weight:1.5}}>
                <Popup>
                  <b style={{color:'#fb923c'}}>{z.n}</b><br/>
                  <span style={{fontSize:11}}>Type: {z.type}<br/>Status: {z.status}<br/>Area: {z.area_ha.toLocaleString()} ha<br/>Investment: USD {z.invest_m}M<br/>Jobs: {z.jobs.toLocaleString()}<br/>Sectors: {z.sectors}</span>
                </Popup>
              </CircleMarker>
            ))}
            {osmEcon.filter((e:any)=>e.lat||e.center?.lat).slice(0,250).map((e:any,i:number) => (
              <CircleMarker key={'oe'+i} center={[e.lat||e.center?.lat,e.lon||e.center?.lon]} radius={3}
                pathOptions={{color:'#a855f7',fillColor:'#6b21a8',fillOpacity:0.6,weight:1}}>
                <Popup><span style={{fontSize:11}}>OSM: {e.tags?.name||e.tags?.landuse||'Economic feature'}</span></Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        <div style={{fontSize:11,color:'#64748b',marginTop:8}}> Operational Park/Zone &nbsp; Under Development &nbsp; OSM economic features ({osmEcon.length} loaded)</div>
      </div>
      <DataTable title="Economic Zones & Industrial Parks — Full Registry"
        cols={['Name','Type','Status','Area (ha)','Investment (USD M)','Jobs Created','Key Sectors']}
        rows={ECONOMIC_ZONES.map((z:any)=>[z.n,z.type,z.status,z.area_ha.toLocaleString(),String(z.invest_m),z.jobs.toLocaleString(),z.sectors])}/>
      <AnalysisTable title="Macroeconomic Sector Competitiveness Assessment"
        cols={['Sector','GDP Share','Growth Rate','Employment','Export Share','Competitiveness','Bottlenecks','Strategic Priority']}
        rows={[
          ['Agriculture','24% / USD 9.1B','3.8%/yr','8.2M HH','36% (coffee,fish,vanilla)','Medium','Low mechanisation; PHLs 30-40%; weak cooperatives','HIGH — food security; export diversification; agro-processing'],
          ['Oil & Gas','Pre-production (0%)','—','12,000 (construction)','Expected ~40% by 2029','High potential','EACOP financing delay; ESG scrutiny; local content','HIGH — transformational USD 1.5B/yr revenue from 2026+'],
          ['Manufacturing','10% / USD 3.8B','6.2%/yr','0.8M','12% (processed goods)','Low-Medium','Power cost USD 0.17/kWh; skills gap; import competition','HIGH — import substitution; SEZ expansion; light industry'],
          ['ICT & Digital','8% / USD 3.0B','12.1%/yr','0.4M','5%','Growing fast','Broadband 18% penetration; digital skills gap; regulation','HIGH — youth employment; digital economy; fintech'],
          ['Tourism','4% / USD 1.5B','8.4%/yr','0.5M','8% (services)','Medium','Limited air access; marketing budget; accommodation quality','MEDIUM — wildlife; Nile; gorilla permits (USD 700/visit)'],
          ['Mining & Quarrying','2% / USD 760M','4.5%/yr','0.1M formal','6% (gold, minerals)','Low-Medium','Artisanal dominance; formalisation; smuggling','MEDIUM — Muko iron ore; Sukulu phosphate; gold formalization'],
          ['Financial Services','6% / USD 2.3B','9.1%/yr','0.15M','—','Medium','Financial inclusion 58%; MoMo growing; capital markets thin','MEDIUM — capital markets; fintech regulation; pension reform'],
          ['Construction','5% / USD 1.9B','7.0%/yr','0.5M','—','Medium','Skills gap; imported materials 60%; housing deficit 2.4M units','MEDIUM — housing programme; infra PPPs; local materials'],
        ]}/>
      <SQLPanel title="Economic Zones & Macro Data" sql={"CREATE TABLE economic_zones (\n  id            SERIAL PRIMARY KEY,\n  zone_name     VARCHAR(200) NOT NULL,\n  zone_type     VARCHAR(100),  -- Industrial Park / SEZ / Free Zone\n  status        VARCHAR(50),   -- Operational / Developing / Planned\n  area_ha       NUMERIC(10,2),\n  investment_usd_m NUMERIC(10,2),\n  jobs_created  INTEGER,\n  key_sectors   TEXT,\n  operator      VARCHAR(200),\n  lat           NUMERIC(9,6),\n  lng           NUMERIC(9,6)\n);\n\nCREATE TABLE gdp_annual (\n  id            SERIAL PRIMARY KEY,\n  year          INTEGER,\n  gdp_usd_b     NUMERIC(8,2),\n  growth_pct    NUMERIC(5,2),\n  agri_share    NUMERIC(5,2),\n  industry_share NUMERIC(5,2),\n  services_share NUMERIC(5,2),\n  exports_usd_b NUMERIC(8,2),\n  fdi_usd_b     NUMERIC(8,2),\n  inflation_pct NUMERIC(5,2)\n);\n\n-- Zone efficiency: jobs per hectare and cost per job\nSELECT zone_name, zone_type, status,\n       area_ha, investment_usd_m, jobs_created,\n       ROUND(jobs_created::NUMERIC/NULLIF(area_ha,0),2) AS jobs_per_ha,\n       ROUND(investment_usd_m*1e6/NULLIF(jobs_created,0)) AS cost_per_job_usd\nFROM economic_zones\nWHERE status='Operational'\nORDER BY jobs_per_ha DESC;"}/>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const TABS = [
  { id:'overview',      label:' Overview & Districts' },
  { id:'resources',     label:' Natural Resources' },
  { id:'energy',        label:' Energy' },
  { id:'agriculture',   label:' Agriculture' },
  { id:'environment',   label:' Environment' },
  { id:'eduhealth',     label:' Education & Health' },
  { id:'demographics',  label:' Demographics' },
  { id:'economy',       label:' Economy' },
  { id:'capture',       label:' Data Capture' },
];

export default function SocioEconomicSection() {
  const [tab, setTab] = React.useState('overview');
  return (
    <div style={{ background:'#0d1117', minHeight:'100vh', color:'#e2e8f0', fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", padding:'16px 20px' }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'#f1f5f9', margin:0 }}>Uganda — Socio-Economic Analysis</h1>
        <p style={{ fontSize:12, color:'#64748b', margin:'4px 0 0' }}>
          Real-time geodata via Overpass API + geoBoundaries ADM1 &nbsp;|&nbsp; Static curated datasets &nbsp;|&nbsp; Live OSM overlay &nbsp;|&nbsp; Supabase-ready schemas
        </p>
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ padding:'7px 14px', fontSize:12, fontWeight:600, borderRadius:8, border:'none', cursor:'pointer',
              background:tab===t.id?'#3b82f6':'#1e293b',
              color:tab===t.id?'#fff':'#94a3b8',
              transition:'all 0.15s', outline:'none' }}>
            {t.label}
          </button>
        ))}
      </div>
      <div>
        {tab==='overview'      && <OverviewTab/>}
        {tab==='resources'     && <ResourcesTab/>}
        {tab==='energy'        && <EnergyTab/>}
        {tab==='agriculture'   && <AgriTab/>}
        {tab==='environment'   && <EnvironmentTab/>}
        {tab==='eduhealth'     && <EduHealthTab/>}
        {tab==='demographics'  && <DemoTab/>}
        {tab==='economy'       && <EconomyTab/>}
        {tab==='capture'       && <React.Suspense fallback={<div style={{padding:20,color:'#64748b',fontSize:12}}>Loading capture module…</div>}><LazySEHub/></React.Suspense>}
      </div>
    </div>
  );
}
