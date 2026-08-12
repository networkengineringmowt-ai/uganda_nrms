import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';

// ── Constants ──────────────────────────────────────────────────
const TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATTR = '&copy; OpenStreetMap contributors &copy; <a href="https://carto.com">CARTO</a>';
const UGA: [number, number] = [1.3733, 32.2903];
const ZOOM = 7;
const CC = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

// ── Types ──────────────────────────────────────────────────────
interface Pt { name:string; lat:number; lng:number; type?:string; value?:string; color?:string; detail?:string; size?:number; }
interface Rgn { name:string; lat:number; lng:number; pop:number; hdi:number; gdp:number; area:number; color:string; }

// ── Mineral Deposits (25 — USGS & DGSM Uganda data) ────────────
const MINERALS: Pt[] = [
  {name:'Kilembe Copper Mine',lat:0.2033,lng:30.0733,type:'Copper/Cobalt',value:'4.5 MT ore reserves',color:'#f59e0b',size:12},
  {name:'Tororo Phosphate',lat:0.6921,lng:34.1814,type:'Phosphate Rock',value:'235 MT reserves',color:'#22c55e',size:14},
  {name:'Hima Limestone Quarry',lat:0.3100,lng:30.1400,type:'Limestone/Cement',value:'50 MT active',color:'#94a3b8',size:10},
  {name:'Muko Iron Ore',lat:-1.1500,lng:29.7200,type:'Iron Ore',value:'200 MT reserves',color:'#b45309',size:12},
  {name:'Lake Katwe Salt/Potash',lat:0.0000,lng:29.9000,type:'Salt/Potassium',value:'3.5 MT reserves',color:'#e2e8f0',size:10},
  {name:'Busia Gold Fields',lat:0.4594,lng:34.0908,type:'Gold',value:'1.2 Moz estimated',color:'#fbbf24',size:12},
  {name:'Mubende Gold Project',lat:0.5533,lng:31.3667,type:'Gold',value:'800 koz estimated',color:'#fbbf24',size:10},
  {name:'Buhweju Gold',lat:-0.5500,lng:30.3000,type:'Gold',value:'600 koz estimated',color:'#fbbf24',size:10},
  {name:'Namayingo Gold',lat:-0.1667,lng:33.9167,type:'Gold',value:'Exploration stage',color:'#fbbf24',size:8},
  {name:'Kyenjojo Gold',lat:0.6333,lng:30.6333,type:'Gold',value:'Exploration stage',color:'#fbbf24',size:8},
  {name:'Kasanda Cobalt/Nickel',lat:0.5167,lng:31.5000,type:'Cobalt/Nickel',value:'Active exploration',color:'#60a5fa',size:9},
  {name:'Kabale Tungsten/Wolfram',lat:-1.2500,lng:30.0000,type:'Tungsten',value:'Historical production',color:'#a78bfa',size:9},
  {name:'Ntungamo Coltan',lat:-0.8833,lng:30.2667,type:'Coltan/Tantalum',value:'Artisanal mining',color:'#f43f5e',size:8},
  {name:'Namekara Vermiculite',lat:1.0333,lng:34.2333,type:'Vermiculite',value:'Active quarry',color:'#34d399',size:9},
  {name:'Bugiri Cassiterite (Tin)',lat:0.5667,lng:33.7333,type:'Tin Ore',value:'Artisanal mining',color:'#fb923c',size:8},
  {name:'Sukulu Phosphate/Iron',lat:0.7800,lng:34.1300,type:'Phosphate/Iron',value:'Processing planned',color:'#22c55e',size:10},
  {name:'Moroto Marble',lat:2.5338,lng:34.6544,type:'Marble/Limestone',value:'Active quarry',color:'#94a3b8',size:9},
  {name:'Butebo Iron Ore',lat:1.2000,lng:33.9333,type:'Iron Ore',value:'Exploration stage',color:'#b45309',size:8},
  {name:'Soroti Kaolin Clay',lat:1.7167,lng:33.6167,type:'Kaolin Clay',value:'Industrial use',color:'#e2e8f0',size:8},
  {name:'Kasese Cobalt',lat:0.1833,lng:30.0833,type:'Cobalt',value:'Processing ongoing',color:'#60a5fa',size:9},
  {name:'Lira Graphite',lat:2.2500,lng:32.9000,type:'Graphite',value:'Exploration stage',color:'#475569',size:8},
  {name:'Kapchorwa Nickel',lat:1.3500,lng:34.4500,type:'Nickel',value:'Exploration',color:'#60a5fa',size:8},
  {name:'Amuria Silica Sand',lat:2.0333,lng:33.6500,type:'Silica Sand',value:'Construction use',color:'#fde68a',size:8},
  {name:'Kabale Cassiterite',lat:-1.3000,lng:29.9000,type:'Tin/Cassiterite',value:'Small-scale',color:'#fb923c',size:7},
  {name:'Moyo Feldspar',lat:3.6500,lng:31.7200,type:'Feldspar',value:'Ceramics industry',color:'#818cf8',size:7},
];

// ── Hydropower Dams ────────────────────────────────────────────
const DAMS: Pt[] = [
  {name:'Karuma Hydropower',lat:2.2486,lng:32.2683,type:'Hydropower',value:'600 MW',detail:"Uganda's largest; 4,373 GWh/yr, 2024",color:'#06b6d4',size:16},
  {name:'Bujagali Hydropower',lat:0.4983,lng:33.1375,type:'Hydropower',value:'250 MW',detail:'1,100 GWh/yr; commissioned 2012',color:'#06b6d4',size:13},
  {name:'Isimba Hydropower',lat:0.7717,lng:33.0422,type:'Hydropower',value:'183.2 MW',detail:'1,039 GWh/yr; commissioned 2019',color:'#06b6d4',size:12},
  {name:'Nalubale — Owen Falls I',lat:0.4503,lng:33.1928,type:'Hydropower',value:'180 MW',detail:"Uganda's first dam, 1954",color:'#0891b2',size:12},
  {name:'Kiira — Owen Falls II',lat:0.4636,lng:33.1756,type:'Hydropower',value:'200 MW',detail:'Expansion of Owen Falls, 2003',color:'#0891b2',size:12},
  {name:'Muzizi Hydropower',lat:0.9667,lng:30.5333,type:'Hydropower',value:'44 MW',detail:'Commissioned 2024, Kyenjojo',color:'#06b6d4',size:10},
  {name:'Bugoye Hydropower',lat:0.5167,lng:30.1500,type:'Hydropower',value:'13 MW',detail:'Mubuku River, Kasese',color:'#0891b2',size:8},
  {name:'Nyamwamba Hydro',lat:0.2833,lng:30.0833,type:'Hydropower',value:'9.2 MW',detail:'Kasese sub-region',color:'#0891b2',size:7},
  {name:'Kikagati Hydropower',lat:-0.9833,lng:29.9833,type:'Hydropower',value:'16 MW',detail:'Kagera River, Isingiro',color:'#06b6d4',size:9},
  {name:'Muvumbe Hydropower',lat:-0.9000,lng:30.0333,type:'Hydropower',value:'6.5 MW',detail:'SW Uganda',color:'#0891b2',size:7},
  {name:'Ishasha Hydropower',lat:-0.5500,lng:29.7667,type:'Hydropower',value:'6.5 MW',detail:'Kigezi, Rukungiri',color:'#0891b2',size:7},
  {name:'Nshungyezi Hydropower',lat:0.0833,lng:30.1167,type:'Hydropower',value:'2.5 MW',detail:'Kasese area',color:'#0891b2',size:6},
];

// ── Oil & Gas Fields (Albertine Graben) ────────────────────────
const OIL_FIELDS: Pt[] = [
  {name:'Tilenga Oil Field',lat:2.1000,lng:31.5000,type:'Oil Field',value:'836 Mbbl reserves',detail:'TotalEnergies; 31 well pads; first oil 2026',color:'#f97316',size:16},
  {name:'Kingfisher Oil Field',lat:1.1000,lng:31.2000,type:'Oil Field',value:'214 Mbbl reserves',detail:'CNOOC; 31 wells; first oil 2026',color:'#f97316',size:14},
  {name:'Jobi-Rii Block',lat:1.9000,lng:31.4000,type:'Oil Block',value:'Exploration',detail:'Albertine Graben, EA-1B',color:'#fb923c',size:10},
  {name:'Mputa/Nzizi Field',lat:1.8500,lng:31.5500,type:'Oil Field',value:'Development pending',detail:'Albertine Graben',color:'#fb923c',size:10},
  {name:'Lyec Block',lat:2.4000,lng:31.6000,type:'Oil Block',value:'Exploration',detail:'Northern Albertine Graben',color:'#fdba74',size:9},
  {name:'Waraga Field',lat:1.9500,lng:31.3500,type:'Oil Field',value:'Exploration',detail:'Albertine Graben',color:'#fdba74',size:9},
  {name:'Ngege Block',lat:2.0500,lng:31.3000,type:'Oil Block',value:'Exploration',detail:'Albertine Graben',color:'#fdba74',size:8},
  {name:'Kasemene Field',lat:2.3000,lng:31.7000,type:'Oil Field',value:'Exploration',detail:'Near Murchison Falls',color:'#fdba74',size:8},
];

// ── Protected Areas ────────────────────────────────────────────
const PROTECTED: Pt[] = [
  {name:'Murchison Falls NP',lat:2.2833,lng:31.7667,type:'National Park',value:'3,840 km²',detail:'Largest NP; lions, elephants, hippos, Nile',color:'#16a34a',size:18},
  {name:'Queen Elizabeth NP',lat:-0.1000,lng:30.0000,type:'National Park',value:'1,978 km²',detail:'Tree-climbing lions, chimpanzees, hippos',color:'#16a34a',size:16},
  {name:'Kidepo Valley NP',lat:3.8667,lng:33.7500,type:'National Park',value:'1,442 km²',detail:'Cheetahs, lions; most biodiverse NP',color:'#16a34a',size:15},
  {name:'Kibale NP',lat:0.5167,lng:30.3667,type:'National Park',value:'766 km²',detail:'Highest chimp density in Africa',color:'#16a34a',size:14},
  {name:'Bwindi Impenetrable NP',lat:-1.0333,lng:29.6833,type:'National Park',value:'331 km²',detail:'400+ mountain gorillas; UNESCO World Heritage Site',color:'#16a34a',size:14},
  {name:'Rwenzori Mountains NP',lat:0.3167,lng:29.9667,type:'National Park',value:'998 km²',detail:'Margherita Peak 5,109 m; UNESCO WHS',color:'#166534',size:14},
  {name:'Mount Elgon NP',lat:1.1333,lng:34.3000,type:'National Park',value:'1,279 km²',detail:'Ancient caldera; hot springs',color:'#16a34a',size:13},
  {name:'Lake Mburo NP',lat:-0.6167,lng:30.9667,type:'National Park',value:'370 km²',detail:'Zebras, impalas, hippos; closest to Kampala',color:'#16a34a',size:12},
  {name:'Semuliki NP',lat:0.8500,lng:30.2667,type:'National Park',value:'220 km²',detail:'Congo basin species; hot springs',color:'#16a34a',size:11},
  {name:'Mgahinga Gorilla NP',lat:-1.3167,lng:29.6333,type:'National Park',value:'33.7 km²',detail:'Gorillas, golden monkeys, 3 volcanoes',color:'#16a34a',size:10},
  {name:'Pian Upe WR',lat:2.0500,lng:34.2000,type:'Wildlife Reserve',value:'2,043 km²',detail:'Cheetahs, ostriches, eland; Karamoja',color:'#4ade80',size:13},
  {name:'Matheniko WR',lat:2.9167,lng:34.5000,type:'Wildlife Reserve',value:'1,520 km²',detail:'Semi-arid savanna; Karamoja',color:'#4ade80',size:12},
  {name:'Bugungu WR',lat:2.2000,lng:31.8000,type:'Wildlife Reserve',value:'473 km²',detail:'Adjacent to Murchison Falls',color:'#4ade80',size:11},
  {name:'Toro-Semuliki WR',lat:0.7000,lng:30.2000,type:'Wildlife Reserve',value:'548 km²',detail:'Near Rwenzori range',color:'#4ade80',size:11},
  {name:'Katonga WR',lat:0.0000,lng:31.0000,type:'Wildlife Reserve',value:'208 km²',detail:'Sitatunga antelope habitat',color:'#4ade80',size:10},
  {name:'Kigezi WR',lat:-0.5000,lng:29.8333,type:'Wildlife Reserve',value:'265 km²',detail:'SW Uganda highlands',color:'#4ade80',size:10},
  {name:'Kyambura GR',lat:-0.1500,lng:30.0833,type:'Game Reserve',value:'155 km²',detail:'The "Valley of Apes"; chimpanzees',color:'#4ade80',size:10},
];

// ── Agricultural Zones ─────────────────────────────────────────
const AGRI: Pt[] = [
  {name:'Arabica Coffee — Kabale',lat:-1.25,lng:30.0,type:'Coffee Arabica',value:'15,000 MT/yr',color:'#92400e',size:12},
  {name:'Arabica Coffee — Kisoro',lat:-1.33,lng:29.68,type:'Coffee Arabica',value:'8,000 MT/yr',color:'#92400e',size:10},
  {name:'Arabica Coffee — Kapchorwa',lat:1.35,lng:34.45,type:'Coffee Arabica',value:'12,000 MT/yr',color:'#92400e',size:11},
  {name:'Arabica Coffee — Mbale',lat:1.07,lng:34.18,type:'Coffee Arabica',value:'10,000 MT/yr',color:'#92400e',size:10},
  {name:'Robusta Coffee — Mukono',lat:0.35,lng:32.75,type:'Coffee Robusta',value:'25,000 MT/yr',color:'#d97706',size:13},
  {name:'Robusta Coffee — Masaka',lat:-0.33,lng:31.73,type:'Coffee Robusta',value:'20,000 MT/yr',color:'#d97706',size:12},
  {name:'Robusta Coffee — Luwero',lat:0.83,lng:32.47,type:'Coffee Robusta',value:'18,000 MT/yr',color:'#d97706',size:11},
  {name:'Tea — Ntungamo',lat:-0.88,lng:30.27,type:'Tea',value:'15,000 MT/yr',color:'#166534',size:11},
  {name:'Tea — Kyenjojo',lat:0.63,lng:30.63,type:'Tea',value:'12,000 MT/yr',color:'#166534',size:10},
  {name:'Tea — Kapchorwa',lat:1.35,lng:34.45,type:'Tea',value:'5,000 MT/yr',color:'#166534',size:9},
  {name:'Kakira Sugar Works',lat:0.53,lng:33.33,type:'Sugar Cane',value:'230,000 MT/yr',color:'#fbbf24',size:14},
  {name:'Lugazi Sugar Estates',lat:0.37,lng:32.90,type:'Sugar Cane',value:'60,000 MT/yr',color:'#fbbf24',size:11},
  {name:'Kinyara Sugar — Masindi',lat:1.68,lng:31.72,type:'Sugar Cane',value:'90,000 MT/yr',color:'#fbbf24',size:12},
  {name:'Cotton Belt — Soroti',lat:1.72,lng:33.62,type:'Cotton',value:'30,000 MT/yr',color:'#e2e8f0',size:11},
  {name:'Cotton Belt — Lira',lat:2.25,lng:32.90,type:'Cotton',value:'25,000 MT/yr',color:'#e2e8f0',size:10},
  {name:'Cotton Belt — Gulu',lat:2.78,lng:32.30,type:'Cotton',value:'20,000 MT/yr',color:'#e2e8f0',size:10},
  {name:'Matooke Belt — Masaka',lat:-0.33,lng:31.73,type:'Bananas/Matooke',value:'800,000 MT/yr',color:'#84cc16',size:13},
  {name:'Matooke Belt — Mbarara',lat:-0.62,lng:30.65,type:'Bananas/Matooke',value:'600,000 MT/yr',color:'#84cc16',size:12},
  {name:'Fishing — Entebbe/L.Victoria',lat:0.06,lng:32.46,type:'Fishing',value:'200,000 MT/yr',color:'#38bdf8',size:12},
  {name:'Fishing — Jinja/L.Victoria',lat:0.43,lng:33.20,type:'Fishing',value:'80,000 MT/yr',color:'#38bdf8',size:10},
  {name:'Fishing — L. Albert (Buliisa)',lat:1.82,lng:31.48,type:'Fishing',value:'50,000 MT/yr',color:'#38bdf8',size:10},
  {name:'Vanilla — Mukono/Iganga',lat:0.35,lng:32.75,type:'Vanilla',value:'2,000 MT/yr',color:'#c4b5fd',size:9},
  {name:'Tobacco — Arua (West Nile)',lat:3.02,lng:30.91,type:'Tobacco',value:'8,000 MT/yr',color:'#a8a29e',size:9},
];

// ── Industrial Parks ───────────────────────────────────────────
const INDUSTRY: Pt[] = [
  {name:'Namanve Industrial Park',lat:0.3167,lng:32.7167,type:'Industrial Park',value:'2,200 Ha',detail:'Largest; 100+ firms, Wakiso',color:'#6366f1',size:14},
  {name:'Luzira Industrial Area',lat:0.2667,lng:32.6833,type:'Industrial Area',value:'Mixed industries',detail:'Beer, beverages, plastics, Kampala',color:'#6366f1',size:11},
  {name:'Jinja Industrial Area',lat:0.4317,lng:33.2028,type:'Industrial Area',value:'Steel/Sugar/Textiles',detail:'Nile Special; SCOUL; Kakira',color:'#6366f1',size:12},
  {name:'Mbale Industrial Park',lat:1.0667,lng:34.1833,type:'Industrial Park',value:'Eastern Uganda hub',detail:'Food processing, textiles',color:'#818cf8',size:11},
  {name:'Arua Industrial Park',lat:3.0167,lng:30.9000,type:'Industrial Park',value:'West Nile hub',detail:'Agriculture processing, trade',color:'#818cf8',size:10},
  {name:'Mbarara Industrial Park',lat:-0.6167,lng:30.6500,type:'Industrial Park',value:'SW Uganda hub',detail:'Dairy, beverages, plastics',color:'#818cf8',size:10},
  {name:'Fort Portal Industrial Zone',lat:0.6500,lng:30.2833,type:'Industrial Zone',value:'Tooro Kingdom',detail:'Tea processing, tourism services',color:'#818cf8',size:9},
  {name:'Kasese Industrial Area',lat:0.2167,lng:30.0833,type:'Industrial Area',value:'Mineral processing',detail:'Cobalt, cement, fish processing',color:'#818cf8',size:10},
  {name:'Bweyogerere Industrial',lat:0.3500,lng:32.6833,type:'Industrial Area',value:'Wakiso District',detail:'Roofing sheets, textiles',color:'#818cf8',size:10},
  {name:'Iganga Economic Zone',lat:0.6000,lng:33.4833,type:'Economic Zone',value:'Eastern Uganda',detail:'Agriculture processing hub',color:'#818cf8',size:9},
];

// ── Universities ───────────────────────────────────────────────
const UNIVERSITIES: Pt[] = [
  {name:'Makerere University',lat:0.3361,lng:32.5722,type:'Public',value:'40,000+ students',detail:"East Africa's oldest, 1922",color:'#f59e0b'},
  {name:'Kyambogo University',lat:0.3486,lng:32.6344,type:'Public',value:'30,000+ students',detail:'Technical & Vocational',color:'#f59e0b'},
  {name:'Gulu University',lat:2.7700,lng:32.3000,type:'Public',value:'8,000+ students',detail:'Northern Uganda',color:'#fbbf24'},
  {name:'MUST — Mbarara',lat:-0.6094,lng:30.6583,type:'Public',value:'5,000+ students',detail:'Science & Technology',color:'#f59e0b'},
  {name:'Busitema University',lat:0.5667,lng:34.1167,type:'Public',value:'6,000+ students',detail:'Engineering focus, Tororo',color:'#fbbf24'},
  {name:'Kabale University',lat:-1.2500,lng:30.0000,type:'Public',value:'3,000+ students',detail:'SW Uganda',color:'#fbbf24'},
  {name:'Mountains of Moon (MMU)',lat:0.6500,lng:30.2833,type:'Public',value:'4,000+ students',detail:'Fort Portal campus',color:'#fbbf24'},
  {name:'IUIU — Mbale',lat:0.6000,lng:33.4833,type:'Private',value:'15,000+ students',detail:'Islamic University in Uganda',color:'#a78bfa'},
  {name:'Uganda Martyrs University',lat:0.2667,lng:31.8833,type:'Private',value:'5,000+ students',detail:'Nkozi campus',color:'#a78bfa'},
  {name:'KIU — Ishaka',lat:-0.6500,lng:30.2167,type:'Private',value:'20,000+ students',detail:'Kampala International Univ.',color:'#a78bfa'},
  {name:'Cavendish University',lat:0.3167,lng:32.5833,type:'Private',value:'6,000+ students',detail:'Business & Law, Kampala',color:'#a78bfa'},
  {name:'Lira University',lat:2.2500,lng:32.8900,type:'Public',value:'3,000+ students',detail:'Northern Uganda hub',color:'#fbbf24'},
];

// ── Referral Hospitals ─────────────────────────────────────────
const HOSPITALS: Pt[] = [
  {name:'Mulago National Referral',lat:0.3414,lng:32.5761,type:'National',value:'1,500 beds',detail:"Uganda's largest hospital",color:'#ef4444'},
  {name:'Mbarara RRH',lat:-0.6200,lng:30.6500,type:'Regional',value:'600 beds',detail:'SW Uganda regional hub',color:'#f87171'},
  {name:'Gulu RRH',lat:2.7800,lng:32.3100,type:'Regional',value:'400 beds',detail:'Northern Uganda hub',color:'#f87171'},
  {name:'Mbale RRH',lat:1.0747,lng:34.1750,type:'Regional',value:'350 beds',detail:'Eastern Uganda hub',color:'#f87171'},
  {name:'Arua RRH',lat:3.0167,lng:30.9100,type:'Regional',value:'300 beds',detail:'West Nile hub',color:'#f87171'},
  {name:'Soroti RRH',lat:1.7167,lng:33.6100,type:'Regional',value:'250 beds',detail:'Teso sub-region',color:'#f87171'},
  {name:'Lira RRH',lat:2.2500,lng:32.8900,type:'Regional',value:'280 beds',detail:'Lango sub-region',color:'#f87171'},
  {name:'Fort Portal RRH',lat:0.6500,lng:30.2833,type:'Regional',value:'300 beds',detail:'Tooro Kingdom',color:'#f87171'},
  {name:'Kabale RRH',lat:-1.2500,lng:29.9900,type:'Regional',value:'250 beds',detail:'Kigezi region',color:'#f87171'},
  {name:'Jinja RRH',lat:0.4300,lng:33.2000,type:'Regional',value:'350 beds',detail:'Busoga region',color:'#f87171'},
  {name:'Masaka RRH',lat:-0.3300,lng:31.7300,type:'Regional',value:'290 beds',detail:'Southern Buganda',color:'#f87171'},
  {name:'Hoima RRH',lat:1.4333,lng:31.3500,type:'Regional',value:'250 beds',detail:'Bunyoro region',color:'#f87171'},
];

// ── Regions ────────────────────────────────────────────────────
const REGIONS: Rgn[] = [
  {name:'Central',lat:0.4,lng:32.5,pop:12.5,hdi:0.572,gdp:42.3,area:61403,color:'#3b82f6'},
  {name:'Eastern',lat:1.4,lng:33.7,pop:11.2,hdi:0.489,gdp:16.8,area:39478,color:'#10b981'},
  {name:'Western',lat:-0.3,lng:30.7,pop:11.8,hdi:0.523,gdp:22.4,area:55263,color:'#f59e0b'},
  {name:'Northern',lat:3.0,lng:32.5,pop:8.9,hdi:0.465,gdp:10.1,area:85392,color:'#ef4444'},
];

// ── Chart Data ─────────────────────────────────────────────────
const GDP_DATA = [
  {y:'2018',gdp:27.5},{y:'2019',gdp:30.2},{y:'2020',gdp:30.1},
  {y:'2021',gdp:33.1},{y:'2022',gdp:37.4},{y:'2023',gdp:42.8},
  {y:'2024',gdp:47.2},{y:'2025',gdp:51.0},
];
const EXPORT_DATA = [
  {name:'Coffee',v:862},{name:'Gold',v:743},{name:'Fish',v:147},
  {name:'Cocoa',v:110},{name:'Tobacco',v:85},{name:'Vanilla',v:72},
  {name:'Tea',v:65},{name:'Flowers',v:55},
];
const ENERGY_MIX = [
  {name:'Hydro',v:78},{name:'Thermal',v:9},{name:'Solar',v:8},
  {name:'Bagasse',v:4},{name:'Other',v:1},
];
const DAM_CAPACITY = DAMS.map(d => ({name:d.name.replace(' Hydropower','').replace(' — Owen Falls I','').replace(' — Owen Falls II',''), mw:parseInt((d.value||'0').replace(' MW',''))||0}));
const MINERAL_TYPES = [
  {name:'Gold',n:7},{name:'Iron Ore',n:3},{name:'Cobalt/Nickel',n:3},
  {name:'Phosphate',n:2},{name:'Limestone',n:3},{name:'Others',n:7},
];
const CROP_REV = [
  {crop:'Coffee',rev:862},{crop:'Sugar',rev:380},{crop:'Matooke',rev:220},
  {crop:'Maize',rev:180},{crop:'Tea',rev:65},{crop:'Cotton',rev:55},
  {crop:'Vanilla',rev:72},{crop:'Tobacco',rev:85},
];
const ENROLL = [
  {level:'Pre-Primary',rate:41},{level:'Primary',rate:95},
  {level:'Secondary',rate:47},{level:'Tertiary',rate:12},
];
const POP_PYMD = [
  {age:'0-14',m:24.3,f:23.8},{age:'15-24',m:11.2,f:11.0},
  {age:'25-34',m:7.8,f:7.9},{age:'35-44',m:5.1,f:5.3},
  {age:'45-54',m:3.2,f:3.4},{age:'55-64',m:2.1,f:2.3},{age:'65+',m:1.4,f:1.8},
];
const SECTOR_GDP = [
  {name:'Services',v:44.5},{name:'Agriculture',v:27.2},{name:'Industry',v:21.3},
  {name:'Taxes',v:7.0},
];

// ── Hooks ──────────────────────────────────────────────────────
function useOverpass(query: string, enabled: boolean) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    setLoading(true); setError('');
    fetch('https://overpass-api.de/api/interpreter', {
      method:'POST',
      body:'data='+encodeURIComponent(query),
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
    })
      .then(r => r.json())
      .then(d => { setData(d.elements||[]); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [enabled]);
  return {data, loading, error};
}

function useBoundaries() {
  const [geo, setGeo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let ok = true;
    setLoading(true);
    (async () => {
      try {
        const meta = await fetch('https://www.geoboundaries.org/api/current/gbOpen/UGA/ADM1/').then(r=>r.json());
        const data = await fetch(meta.gjDownloadURL).then(r=>r.json());
        if (ok) setGeo(data);
      } catch {}
      if (ok) setLoading(false);
    })();
    return () => { ok=false; };
  }, []);
  return {geo, loading};
}

// ── Overpass Queries ───────────────────────────────────────────
const Q_SCHOOLS = `[out:json][timeout:25];(node["amenity"="school"](0.0,29.5,4.2,35.0);way["amenity"="school"](0.0,29.5,4.2,35.0););out center 300;`;
const Q_HOSPITALS = `[out:json][timeout:25];(node["amenity"~"hospital|clinic|health_centre"](0.0,29.5,4.2,35.0);way["amenity"~"hospital|clinic|health_centre"](0.0,29.5,4.2,35.0););out center 300;`;
const Q_MARKETS = `[out:json][timeout:25];(node["amenity"="marketplace"](0.0,29.5,4.2,35.0);way["amenity"="marketplace"](0.0,29.5,4.2,35.0););ut center 200;`;

// ── Map Helpers ─────────────────────────────────────────────────
function FitUga() {
  const map = useMap();
  useEffect(() => { map.setView(UGA zOOM); }, [map]);
  return null;
}

function MapPanel({children,h=420}:{children:React.ReactNode; h?:number}) {
  return (
    <div style={{height:h,borderRadius:10,overflow:'hidden',border:'1px solid rgba(255,255,255,0.08)',marginBottom:14}}>
      <MapContainer center={UGA} zoom={ZOOM} style={{height:'100%',width:'100%'}} scrollWheelZoom>
        <FitUga />
        <TileLayer url={TILES} attribution={ATTR} />
        {children}
      </MapContainer>
    </div>
  );
}

// ── UI Helpers ─────────────────────────────────────────────────
function Card({icon,label,value,sub,col='#3b82f6'}:{icon:string;label:string;value:string;sub?:string;col?:string}) {
  return (
    <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderLeft:`3px solid ${col}`,borderRadius:10,padding:'12px 14px'}}>
      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:6}}>
        <span style={{fontSize:16}}>{icon}</span>
        <span style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1}}>{label}</span>
      </div>
      <div style={{fontSize:21,fontWeight:700,color:'#f1f5f9'}}>{value}</div>
      {sub && <div style={{fontSize:10,color:'#475569',marginTop:3}}>{sub}</div>}
    </div>
  );
}

function Lgd({items}:{items:{color:string;label:string}[]}) {
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:'5px 12px',padding:'7px 10px',background:'rgba(0,0,0,0.3)',borderRadius:6,marginBottom:10}}>
      {items.map(it=>(
        <span key={it.label} style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:'#94a3b8'}}>
          <span style={{width:9,height:9,borderRadius:'50%',background:it.color,display:'inline-block'}}/>
          {it.label}
        </span>
      ))}
    </div>
  );
}

function Row4({children}:{children:React.ReactNode}) {
  return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:10,marginBottom:18}}>{children}</div>;
}

function ChartWrap({title,children}:{title:string;children:React.ReactNode}) {
  return (
    <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,padding:14}}>
      <div style={{fontSize:12,fontWeight:600,color:'#94a3b8',marginBottom:10}}>{title}</div>
      {children}
    </div>
  );
}

function TwoCol({children}:{children:React.ReactNode}) {
  return <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginTop:12}}>{children}</div>;
}

function Ttip({contentStyle,...p}:any) {
  return <Tooltip contentStyle={{background:'#1e293b',border:'none',fontSize:11,...contentStyle}} {...p}/>;
}

function DataBadge({text}:{text:string}) {
  return <div style={{display:'inline-block',padding:'3px 8px',background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:12,fontSize:10,color:'#34d399',marginBottom:8}}>{text}</div>;
}

// ═══════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════

function OverviewTab() {
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:'#f8fafc',margin:'0 0 4px'}}>Uganda Socio-Economic Overview</h2>
      <p style={{fontSize:12,color:'#64748b',marginBottom:16}}>Comprehensive analysis across all sectors — GDP, demographics, resources, and human development indicators.</p>
      <Row4>
        <Card icon="👥" label="Total Population" value="47.2M" sub="Est. 2024 | 2.9% annual growth" col="#3b82f6"/>
        <Card icon="💰" label="GDP (USD)" value="$47.2B" sub="2024 est. | 5.9% growth rate" col="#10b981"/>
        <Card icon="🗺️" label="Total Area" value="241,038 km²" sub="4 regions · 135 districts" col="#f59e0b"/>
        <Card icon="📊" label="Human Dev. Index" value="0.525" sub="Medium HDI · Rank 166/193" col="#8b5cf6"/>
      </Row4>
      <MapPanel h={380}>
        {REGIONS.map(r=>(
          <CircleMarker key={r.name} center={[r.lat,r.lng]} radius={r.pop*1.6}
            pathOptions={{color:r.color,fillColor:r.color,fillOpacity:0.25,weight:2}}>
            <Popup>
              <b>{r.name} Region</b><br/>
              Pop: {r.pop}M &nbsp;|&nbsp; HDI: {r.hdi}<br/>
              GDP: ${r.gdp}B &nbsp;|&nbsp; Area: {r.area.toLocaleString()} km²
            </Popup>
          </CircleMarker>
        ))}
      </MapPanel>
      <Lgd items={REGIONS.map(r=>({color:r.color,label:`${r.name} (${r.pop}M)`}))}/>
      <TwoCol>
        <ChartWrap title="GDP Growth 2018–2025 (USD Billion)">
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={GDP_DATA}>
              <XAxis dataKey="y" tick={{fill:'#94a3b8',fontSize:10}}/>
              <YAxis tick={{fill:'#94a3b8',fontSize:10}}/>
              <Ttip/>
              <Area type="monotone" dataKey="gdp" stroke="#3b82f6" fill="rgba(59,130,246,0.12)" name="GDP $B"/>
            </AreaChart>
          </ResponsiveContainer>
        </ChartWrap>
        <ChartWrap title="GDP by Sector (% share)">
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={SECTOR_GDP} dataKey="v" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({name,v})=>`${name} ${v}%`} labelLine={false}>
                {SECTOR_GDP.map((_,i)=><Cell key={i} fill={CC[i]}/>)}
              </Pie>
              <Ttip/>
            </PieChart>
          </ResponsiveContainer>
        </ChartWrap>
      </TwoCol>
    </div>
  );
}

function ResourcesTab() {
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:'#f8fafc',margin:'0 0 4px'}}>Mineral Resources & Natural Wealth</h2>
      <p style={{fontSize:12,color:'#64748b',marginBottom:16}}>25 known mineral deposits mapped from USGS Africa Geodatabase and Uganda DGSM data. Uganda holds significant untapped resources.</p>
      <Row4>
        <Card icon="⛏️" label="Known Deposits" value="25+" sub="USGS-verified mineral sites" col="#f59e0b"/>
        <Card icon="🥇" label="Gold Reserves" value="~3.5 Moz" sub="Combined estimated reserves" col="#fbbf24"/>
        <Card icon="☎️" label="Phosphate" value="235 MT" sub="Tororo — largest single deposit" col="#22c55e"/>
        <Card icon="🛢️" label="Oil Reserves" value="~1.4 Bbbl" sub="Albertine Graben combined" col="#f97316"/>
      </Row4>
      <DataBadge text="⚡ Mineral data sourced from USGS African Mineral Geodatabase & Uganda DGSM"/>
      <MapPanel>
        {MINERALS.map(m=>(
          <CircleMarker key={m.name} center={[m.lat,m.lng]} radius={m.size||8}
            pathOptions={{color:m.color||'#fbbf24',fillColor:m.color||'#fbbf24',fillOpacity:0.7,weight:1.5}}>
            <Popup><b>{m.name}</b><br/><em>{m.type}</em><br/>{m.value}</Popup>
          </CircleMarker>
        ))}
        {OIL_FIELDS.map(o=>(
          <CircleMarker key={o.name} center={[o.lat,o.lng]} radius={o.size||9}
            pathOptions={{color:'#f97316',fillColor:'#f97316',fillOpacity:0.6,weight:1.5}}>
            <Popup><b>{o.name}</b><br/><em>{o.type}</em><br/>{o.value}<br/><small>{o.detail}</small></Popup>
          </CircleMarker>
        ))}
      </MapPanel>
      <Lgd items={[
        {color:'#fbbf24',label:'Gold'},{color:'#22c55e',label:'Phosphate'},
        {color:'#b45309',label:'Iron Ore'},{color:'#60a5fa',label:'Cobalt/Nickel'},
        {color:'#f43f5e',label:'Coltan'},{color:'#94a3b8',label:'Limestone/Marble'},
        {color:'#fb923c',label:'Tin/Cassiterite'},{color:'#f97316',label:'Oil/Gas Fields'},
      ]}/>
      <TwoCol>
        <ChartWrap title="Mineral Deposit Types">
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={MINERAL_TYPES} layout="vertical">
              <XAxis type="number" tick={{fill:'#94a3b8',fontSize:10}}/>
              <YAxis dataKey="name" type="category" tick={{fill:'#94a3b8',fontSize:10}} width={90}/>
              <Ttip/>
              <Bar dataKey="n" fill="#f59e0b" name="Deposits"/>
            </BarChart>
          </ResponsiveContainer>
        </ChartWrap>
        <ChartWrap title="Top Export Commodities (USD M, 2024)">
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={EXPORT_DATA}>
              <XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:9}}/>
              <YAxis tick={{fill:'#94a3b8',fontSize:10}}/>
              <Ttip/>
              <Bar dataKey="v" name="USD Million">
                {EXPORT_DATA.map((_,i)=><Cell key={i} fill={CC[i%CC.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartWrap>
      </TwoCol>
    </div>
  );
}

function EnergyTab() {
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:'#f8fafc',margin:'0 0 4px'}}>Energy Infrastructure & Oil Development</h2>
      <p style={{fontSize:12,color:'#64748b',marginBottom:16}}>12 hydropower stations with 1,722 MW total installed capacity. Tilenga & Kingfisher oil fields targeting first oil in 2026.</p>
      <Row4>
        <Card icon="⚡" label="Installed Capacity" value="1,722 MW" sub="Predominantly hydro-electric" col="#06b6d4"/>
        <Card icon="💧" label="Renewable Share" value="87%" sub="Hydro + Solar + Bagasse" col="#10b981"/>
        <Card icon="🛢️" label="Oil Reserves" value="~1.4 Bbbl" sub="Tilenga 836M + Kingfisher 214M" col="#f97316"/>
        <Card icon="🔌" label="Electricity Access" value="~35%" sub="National; 72% urban coverage" col="#8b5cf6"/>
      </Row4>
      <MapPanel>
        {DAMS.map(d=>(
          <CircleMarker key={d.name} center={[d.lat,d.lng]} radius={d.size||8}
            pathOptions={{color:'#06b6d4',fillColor:'#06b6d4',fillOpacity:0.75,weight:2}}>
            <Popup><b>{d.name}</b><br/><b style={{color:'#06b6d4'}}>{d.value}</b><br/><small>{d.detail}</small></Popup>
          </CircleMarker>
        ))}
        {OIL_FIELDS.map(o=>(
          <CircleMarker key={o.name} center={[o.lat,o.lng]} radius={o.size||9}
            pathOptions={{color:'#f97316',fillColor:'#f97316',fillOpacity:0.6,weight:1.5}}>
            <Popup><b>{o.name}</b><br/><em>{o.type}</em><br/>{o.value}<br/><small>{o.detail}</small></Popup>
          </CircleMarker>
        ))}
      </MapPanel>
      <Lgd items={[{color:'#06b6d4',label:'Hydropower Dam'},{color:'#f97316',label:'Oil Field/Block'}]}/>
      <TwoCol>
        <ChartWrap title="Hydropower Capacity (MW) — Top Stations">
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={DAM_CAPACITY.filter(d=>d.mw>5).sort((a,b)=>b.mw-a.mw).slice(0,8)}>
              <XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:8}} angle={-25} textAnchor="end" height={45}/>
              <YAxis tick={{fill:'#94a3b8',fontSize:10}}/>
              <Ttip/>
              <Bar dataKey="mw" fill="#06b6d4" name="MW"/>
            </BarChart>
          </ResponsiveContainer>
        </ChartWrap>
        <ChartWrap title="Generation Mix (% of installed capacity)">
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={ENERGY_MIX} dataKey="v" nameKey="name" cx="50%" cy="50%" outerRadius={65}
                label={({name,v})=>`${name} ${v}%`} labelLine={false}>
                {ENERGY_MIX.map((_,i)=><Cell key={i} fill={CC[i]}/>)}
              </Pie>
              <Ttip/>
            </PieChart>
          </ResponsiveContainer>
        </ChartWrap>
      </TwoCol>
    </div>
  );
}

function AgriTab() {
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:'#f8fafc',margin:'0 0 4px'}}>Agriculture, Food & Fishing</h2>
      <p style={{fontSize:12,color:'#64748b',marginBottom:16}}>Agriculture employs ~70% of the workforce. Uganda is the world's second-largest banana producer and Africa's top vanilla exporter.</p>
      <Row4>
        <Card icon="☕" label="Coffee Export" value="$862M" sub="Top foreign exchange earner" col="#92400e"/>
        <Card icon="🌿" label="Arable Land" value="12.8M Ha" sub="64% of 241,038 km² total area" col="#10b981"/>
        <Card icon="🐟" label="Fish Production" value="600K MT/yr" sub="L. Victoria, Albert, Edward, George" col="#38bdf8"/>
        <Card icon="🌾" label="Agri GDP Share" value="27.2%" sub="Employs 70% of workforce" col="#f59e0b"/>
      </Row4>
      <MapPanel>
        {AGRI.map(a=>(
          <CircleMarker key={a.name} center={[a.lat,a.lng]} radius={a.size||9}
            pathOptions={{color:a.color||'#22c55e',fillColor:a.color||'#22c55e',fillOpacity:0.7,weight:1.5}}>
            <Popup><b>{a.name}</b><br/><em>{a.type}</em><br/>{a.value}</Popup>
          </CircleMarker>
        ))}
      </MapPanel>
      <Lgd items={[
        {color:'#92400e',label:'Coffee Arabica'},{color:'#d97706',label:'Coffee Robusta'},
        {color:'#166534',label:'Tea'},{color:'#fbbf24',label:'Sugar Cane'},
        {color:'#e2e8f0',label:'Cotton'},{color:'#84cc16',label:'Bananas/Matooke'},
        {color:'#38bdf8',label:'Fishing'},{color:'#c4b5fd',label:'Vanilla'},
        {color:'#a8a29e',label:'Tobacco'},
      ]}/>
      <TwoCol>
        <ChartWrap title="Crop Revenue (USD Million, 2024)">
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={CROP_REV}>
              <XAxis dataKey="crop" tick={{fill:'#94a3b8',fontSize:9}}/>
              <YAxis tick={{fill:'#94a3b8',fontSize:10}}/>
              <Ttip/>
              <Bar dataKey="rev" name="USD M">
                {CROP_REV.map((_,i)=><Cell key={i} fill={CC[i%CC.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartWrap>
        <ChartWrap title="Agriculture Production Zones by Crop">
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={[
                {name:'Coffee',v:11},{name:'Sugar',v:3},{name:'Matooke',v:4},
                {name:'Cotton',v:3},{name:'Tea',v:3},{name:'Fishing',v:3},{name:'Other',v:4},
              ]} dataKey="v" nameKey="name" cx="50%" cy="50%" outerRadius={65}
                label={({name})=>name} labelLine={false}>
                {[0,1,2,3,4,5,6].map(i=><Cell key={i} fill={CC[i%CC.length]}/>)}
              </Pie>
              <Ttip/>
            </PieChart>
          </ResponsiveContainer>
        </ChartWrap>
      </TwoCol>
    </div>
  );
}

function EnvironmentTab() {
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:'#f8fafc',margin:'0 0 4px'}}>Protected Areas & Biodiversity</h2>
      <p style={{fontSize:12,color:'#64748b',marginBottom:16}}>10 National Parks + 7 Wildlife/Game Reserves covering 6.3M Ha. Two UNESCO World Heritage Sites. Home to 50% of Africa's mountain gorillas.</p>
      <Row4>
        <Card icon="🦁" label="Protected Areas" value="17" sub="10 NPs + 7 Game Reserves" col="#16a34a"/>
        <Card icon="🦍" label="Mountain Gorillas" value="~450" sub="50% of world's total (Bwindi+Mgahinga)" col="#22c55e"/>
        <Card icon="🌿" label="Protected Coverage" value="6.3M Ha" sub="26% of Uganda's land area" col="#4ade80"/>
        <Card icon="🏔️" label="UNESCO WHS" value="2 Sites" sub="Bwindi + Rwenzori Mountains" col="#a3e635"/>
      </Row4>
      <MapPanel>
        {PROTECTED.map(p=>(
          <CircleMarker key={p.name} center={[p.lat,p.lng]} radius={p.size||10}
            pathOptions={{color:p.color||'#16a34a',fillColor:p.color||'#16a34a',fillOpacity:0.55,weight:2}}>
            <Popup>
              <b>{p.name}</b><br/>
              <em style={{color:'#94a3b8'}}>{p.type}</em><br/>
              <b>{p.value}</b><br/>
              <small>{p.detail}</small>
            </Popup>
          </CircleMarker>
        ))}
      </MapPanel>
      <Lgd items={[{color:'#16a34a',label:'National Park'},{color:'#4ade80',label:'Wildlife Reserve'},{color:'#4ade80',label:'Game Reserve'}]}/>
      <TwoCol>
        <ChartWrap title="Largest Protected Areas (km²)">
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={PROTECTED.slice(0,8).map(p=>({name:p.name.replace(' NP','').replace(' WR','').replace(' GR',''), area:parseInt((p.value||'0').replace(/,/g,''))||0})).sort((a,b)=>b.area-a.area)} layout="vertical">
              <XAxis type="number" tick={{fill:'#94a3b8',fontSize:10}}/>
              <YAxis dataKey="name" type="category" tick={{fill:'#94a3b8',fontSize:9}} width={105}/>
              <Ttip/>
              <Bar dataKey="area" fill="#16a34a" name="km²"/>
            </BarChart>
          </ResponsiveContainer>
        </ChartWrap>
        <ChartWrap title="PA Classification Breakdown">
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={[{name:'National Parks',v:10},{name:'Wildlife Reserves',v:5},{name:'Game Reserves',v:2}]}
                dataKey="v" nameKey="name" cx="50%" cy="50%" outerRadius={65}
                label={({name,v})=>`${name}: ${v}`} labelLine={false}>
                <Cell fill="#16a34a"/><Cell fill="#4ade80"/><Cell fill="#86efac"/>
              </Pie>
              <Ttip/>
            </PieChart>
          </ResponsiveContainer>
        </ChartWrap>
      </TwoCol>
    </div>
  );
}

function EduHealthTab() {
  const [showSchools, setShowSchools] = useState(false);
  const [showHosp, setShowHosp] = useState(false);
  const {data:schools, loading:sl} = useOverpass(Q_SCHOOLS, showSchools);
  const {data:liveHosp, loading:hl} = useOverpass(Q_HOSPITALS, showHosp);

  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:'#f8fafc',margin:'0 0 4px'}}>Education & Health Infrastructure</h2>
      <p style={{fontSize:12,color:'#64748b',marginBottom:16}}>12 universities, 14 regional/national referral hospitals. Primary school enrollment at 95%. Literacy rate 76.5%.</p>
      <Row4>
        <Card icon="🎓" label="Universities" value="12+" sub="7 public · 5+ private" col="#f59e0b"/>
        <Card icon="🏥" label="Referral Hospitals" value="14" sub="1 national + 13 regional" col="#ef4444"/>
        <Card icon="📚" label="Literacy Rate" value="76.5%" sub="Adult literacy, est. 2024" col="#8b5cf6"/>
        <Card icon="👶" label="Primary Enrollment" value="95%" sub="Net enrollment rate" col="#10b981"/>
      </Row4>
      <div style={{display:'flex',gap:10,marginBottom:10}}>
        <button onClick={()=>setShowSchools(p=>!p)}
          style={{padding:'7px 14px',borderRadius:8,border:'1px solid rgba(245,158,11,0.4)',background:showSchools?'rgba(245,158,11,0.15)':'transparent',color:'#f59e0b',cursor:'pointer',fontSize:12}}>
          {sl?'Loading schools…':showSchools?'✓ OSM Schools Active':'📚 Load OSM Schools'}
        </button>
        <button onClick={()=>setShowHosp(p=>!p)}
          style={{padding:'7px 14px',borderRadius:8,border:'1px solid rgba(239,68,68,0.4)',background:showHosp?'rgba(239,68,68,0.15)':'transparent',color:'#ef4444',cursor:'pointer',fontSize:12}}>
          {hl?'Loading health…':showHosp?'✓ OSM Health Active':'🏥 Load OSM Health'}
        </button>
      </div>
      <MapPanel>
        {UNIVERSITIES.map(u=>(
          <CircleMarker key={u.name} center={[u.lat,u.lng]} radius={8}
            pathOptions={{color:'#f59e0b',fillColor:'#f59e0b',fillOpacity:0.7,weight:2}}>
            <Popup><b>{u.name}</b><br/><em>{u.type} university</em><br/>{u.value}<br/><small>{u.detail}</small></Popup>
          </CircleMarker>
        ))}
        {HOSPITALS.map(h=>(
          <CircleMarker key={h.name} center={[h.lat,h.lng]} radius={h.type==='National'?11:7}
            pathOptions={{color:'#ef4444',fillColor:'#ef4444',fillOpacity:0.7,weight:2}}>
            <Popup><b>{h.name}</b><br/><em>{h.type} Referral</em><br/>{h.value}<br/><small>{h.detail}</small></Popup>
          </CircleMarker>
        ))}
        {showSchools && schools.filter(s=>s.lat||s.center?.lat).map((s,i)=>(
          <CircleMarker key={`sch-${i}`} center={[s.lat||s.center?.lat,s.lon||s.center?.lon]} radius={3}
            pathOptions={{color:'#fbbf24',fillColor:'#fbbf24',fillOpacity:0.5,weight:1}}>
            <Popup>{s.tags?.name||'School'}</Popup>
          </CircleMarker>
        ))}
        {showHosp && liveHosp.filter(h=>h.lat||h.center?.lat).map((h,i)=>(
          <CircleMarker key={`hp-${i}`} center={[h.lat||h.center?.lat,h.lon||h.center?.lon]} radius={3}
            pathOptions={{color:'#f87171',fillColor:'#f87171',fillOpacity:0.5,weight:1}}>
            <Popup>{h.tags?.name||h.tags?.amenity||'Health facility'}</Popup>
          </CircleMarker>
        ))}
      </MapPanel>
      <Lgd items={[
        {color:'#f59e0b',label:'University'},{color:'#ef4444',label:'Referral Hospital'},
        {color:'#fbbf24',label:'OSM Schools (live)'},{color:'#f87171',label:'OSM Health (live)'},
      ]}/>
      <TwoCol>
        <ChartWrap title="School Enrollment by Level (%)">
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={ENROLL}>
              <XAxis dataKey="level" tick={{fill:'#94a3b8',fontSize:10}}/>
              <YAxis domain={[0,100]} tick={{fill:'#94a3b8',fontSize:10}}/>
              <Ttip/>
              <Bar dataKey="rate" fill="#f59e0b" name="Enrollment %">
                {ENROLL.map((_,i)=><Cell key={i} fill={CC[i%CC.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartWrap>
        <ChartWrap title="Regional HDI Comparison">
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={REGIONS} layout="vertical">
              <XAxis type="number" domain={[0.4,0.65]} tick={{fill:'#94a3b8',fontSize:10}}/>
              <YAxis dataKey="name" type="category" tick={{fill:'#94a3b8',fontSize:10}} width={60}/>
              <Ttip/>
              <Bar dataKey="hdi" name="HDI Score">
                {REGIONS.map((r,i)=><Cell key={i} fill={r.color}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartWrap>
      </TwoCol>
    </div>
  );
}

function DemoTab() {
  const {geo, loading} = useBoundaries();

  const geoStyle = (feature: any) => {
    const n = (feature?.properties?.shapeName||'').toLowerCase();
    const region = REGIONS.find(r=>n.includes(r.name.toLowerCase()));
    return {
      fillColor: region?.color||'#334155',
      weight: 1, opacity: 0.8, color:'#475569', fillOpacity: 0.35,
    };
  };

  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:'#f8fafc',margin:'0 0 4px'}}>Demographics & Population</h2>
      <p style={{fontSize:12,color:'#64748b',marginBottom:16}}>47.2M people across 4 regions and 135 districts. Uganda has one of the world's youngest populations (median age 16.7 years).</p>
      <Row4>
        <Card icon="👥" label="Total Population" value="47.2M" sub="2024 estimate (UBOS)" col="#3b82f6"/>
        <Card icon="📈" label="Growth Rate" value="2.9%/yr" sub="One of Africa's fastest" col="#ef4444"/>
        <Card icon="🏙️" label="Urbanisation" value="~27%" sub="Rising from 18% in 2014" col="#8b5cf6"/>
        <Card icon="👶" label="Median Age" value="16.7 yrs" sub="Youth-dominated demography" col="#10b981"/>
      </Row4>
      {loading && <div style={{textAlign:'center',padding:20,color:'#64748b',fontSize:12}}>Loading region boundaries…</div>}
      <MapPanel>
        {geo && <GeoJSON key="uga-adm1" data={geo} style={geoStyle}/>}
        {REGIONS.map(r=>(
          <CircleMarker key={r.name} center={[r.lat,r.lng]} radius={r.pop*1.8}
            pathOptions={{color:r.color,fillColor:r.color,fillOpacity:0.2,weight:2}}>
            <Popup>
              <b>{r.name} Region</b><br/>
              Population: <b>{r.pop}M</b><br/>
              HDI: {r.hdi} &nbsp;|&nbsp; GDP: ${r.gdp}B<br/>
              Area: {r.area.toLocaleString()} km²
            </Popup>
          </CircleMarker>
        ))}
      </MapPanel>
      <Lgd items={REGIONS.map(r=>({color:r.color,label:`${r.name}: ${r.pop}M`}))}/>
      <TwoCol>
        <ChartWrap title="Population Age Structure (%)">
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={POP_PYMD}>
              <XAxis dataKey="age" tick={{fill:'#94a3b8',fontSize:9}}/>
              <YAxis tick={{fill:'#94a3b8',fontSize:10}}/>
              <Ttip/>
              <Bar dataKey="m" fill="#3b82f6" name="Male %" stackId="a"/>
              <Bar dataKey="f" fill="#ec4899" name="Female %" stackId="a"/>
            </BarChart>
          </ResponsiveContainer>
        </ChartWrap>
        <ChartWrap title="Regional Population (Million)">
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={REGIONS}>
              <XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:10}}/>
              <YAxis tick={{fill:'#94a3b8',fontSize:10}}/>
              <Ttip/>
              <Bar dataKey="pop" name="Million">
                {REGIONS.map((r,i)=><Cell key={i} fill={r.color}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartWrap>
      </TwoCol>
    </div>
  );
}

function EconomyTab() {
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:700,color:'#f8fafc',margin:'0 0 4px'}}>Economy, Industry & Trade</h2>
      <p style={{fontSize:12,color:'#64748b',marginBottom:16}}>GDP $47.2B in 2024. Services dominate at 44.5%. Namanve Industrial Park is East Africa's largest industrial zone at 2,200 Ha.</p>
      <Row4>
        <Card icon="💰" label="GDP (2024)" value="$47.2B" sub="5.9% real growth rate" col="#10b981"/>
        <Card icon="👤" label="GDP per Capita" value="~$934" sub="Based on 47.2M population" col="#3b82f6"/>
        <Card icon="🏭" label="Industrial Parks" value="10+" sub="Namanve 2,200 Ha flagship" col="#6366f1"/>
        <Card icon="📦" label="Total Exports" value="$2.1B" sub="Coffee + Gold as top 2" col="#f59e0b"/>
      </Row4>
      <MapPanel>
        {INDUSTRY.map(ind=>(
          <CircleMarker key={ind.name} center={[ind.lat,ind.lng]} radius={ind.size||9}
            pathOptions={{color:'#6366f1',fillColor:'#6366f1',fillOpacity:0.7,weight:2}}>
            <Popup><b>{ind.name}</b><br/><em>{ind.type}</em><br/>{ind.value}<br/><small>{ind.detail}</small></Popup>
          </CircleMarker>
        ))}
        {MINERALS.filter(m=>m.type==='Copper/Cobalt'||m.type?.includes('Phosphate')).map(m=>(
          <CircleMarker key={`im-${m.name}`} center={[m.lat,m.lng]} radius={8}
            pathOptions={{color:'#f59e0b',fillColor:'#f59e0b',fillOpacity:0.5,weight:1}}>
            <Popup><b>{m.name}</b><br/>{m.type}</Popup>
          </CircleMarker>
        ))}
      </MapPanel>
      <Lgd items={[{color:'#6366f1',label:'Industrial Park/Zone'},{color:'#f59e0b',label:'Key Mineral Processing'}]}/>
      <TwoCol>
        <ChartWrap title="Top Exports by Value (USD M, 2024)">
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={EXPORT_DATA} layout="vertical">
              <XAxis type="number" tick={{fill:'#94a3b8',fontSize:10}}/>
              <YAxis dataKey="name" type="category" tick={{fill:'#94a3b8',fontSize:9}} width={65}/>
              <Ttip/>
              <Bar dataKey="v" name="USD M">
                {EXPORT_DATA.map((_,i)=><Cell key={i} fill={CC[i%CC.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartWrap>
        <ChartWrap title="GDP by Sector (%)">
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={SECTOR_GDP} dataKey="v" nameKey="name" cx="50%" cy="50%" outerRadius={65}
                label={({name,v})=>`${name} ${v}%`} labelLine={false}>
                {SECTOR_GDP.map((_,i)=><Cell key={i} fill={CC[i]}/>)}
              </Pie>
              <Ttip/>
            </PieChart>
          </ResponsiveContainer>
        </ChartWrap>
      </TwoCol>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const TABS = [
  {id:'overview',label:'🇺🇬 Overview'},
  {id:'resources',label:'⛏️ Resources'},
  {id:'energy',label:'⚡ Energy'},
  {id:'agriculture',label:'🌿 Agriculture'},
  {id:'environment',label:'🦁 Environment'},
  {id:'eduheath',label:'🏥 Edu & Health'},
  {id:'demographics',label:'👥 Demographics'},
  {id:'economy',label:'💰 Economy'},
];

export default function SocioEconomicSection() {
  const [tab, setTab] = useState('overview');

  return (
    <div style={{padding:'24px 28px',minHeight:'100vh',background:'transparent',fontFamily:'system-ui,sans-serif'}}>
      {/* Header */}
      <div style={{marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
          <div style={{width:4,height:28,background:'linear-gradient(180deg,#3b82f6,#8b5cf6)',borderRadius:2}}/>
          <h1 style={{fontSize:26,fontWeight:800,color:'#f8fafc',margin:0}}>Socio-Economic Analysis</h1>
          <span style={{padding:'3px 10px',background:'rgba(59,130,246,0.15)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:20,fontSize:11,color:'#60a5fa'}}>Uganda · 2024</span>
        </div>
        <p style={{fontSize:13,color:'#475569',margin:0,paddingLeft:16}}>
          Geospatial analysis of minerals, energy, agriculture, environment, health, education, demographics and economy.
        </p>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:22,borderBottom:'1px solid rgba(255,255,255,0.07)',paddingBottom:12}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:'7px 14px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12,fontWeight:500,transition:'all 0.15s',
              background: tab===t.id ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
              color: tab===t.id ? '#60a5fa' : '#94a3b8',
              outline: tab===t.id ? '1px solid rgba(59,130,246,0.35)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {tab==='overview'     && <OverviewTab/>}
        {tab==='resources'    && <ResourcesTab/>}
        {tab==='energy'       && <EnergyTab/>}
        {tab==='agriculture'  && <AgriTab/>}
        {tab==='environment'  && <EnvironmentTab/>}
        {tab==='eduheath'     && <EduHealthTab/>}
        {tab==='demographics' && <DemoTab/>}
        {tab==='economy'      && <EconomyTab/>}
      </div>

      {/* Footer */}
      <div style={{marginTop:32,paddingTop:16,borderTop:'1px solid rgba(255,255,255,0.06)',fontSize:10,color:'#334155',textAlign:'center'}}>
        Data sources: USGS African Mineral Geodatabase · Uganda DGSM · UBOS Census 2024 · World Bank · geoBoundaries (ADM1) · OpenStreetMap Overpass API · TotalEnergies/CNOOC project data
      </div>
    </div>
  );
}
