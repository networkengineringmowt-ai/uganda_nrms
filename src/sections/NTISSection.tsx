import { useState, useEffect, useRef } from 'react';
import { RoadsAPI } from '../lib/roadsAPI';
import SectionDashboard from '../modules/Dashboard/SectionDashboard';
import { supabase } from '../lib/supabase';

// ─── DATA ────────────────────────────────────────────────────────────────────

const ATC_STATIONS = [
  { id:'ATC-01', road:'A109N', km:0,   name:'Kampala North Gate',   region:'Central',  aadt:4820, cars:2890, mc:482, lcv:724, hgv:482, bus:193, nmt:49,  lat:0.420, lng:32.580 },
  { id:'ATC-02', road:'A109N', km:48,  name:'Luwero Station',       region:'Central',  aadt:3140, cars:1884, mc:314, lcv:471, hgv:314, bus:126, nmt:31,  lat:0.850, lng:32.490 },
  { id:'ATC-03', road:'A109N', km:96,  name:'Kafu Junction',        region:'Northern', aadt:2860, cars:1716, mc:286, lcv:429, hgv:286, bus:115, nmt:28,  lat:1.620, lng:31.980 },
  { id:'ATC-04', road:'A109N', km:160, name:'Gulu Town',            region:'Northern', aadt:2140, cars:1284, mc:214, lcv:321, hgv:214, bus:86,  nmt:21,  lat:2.780, lng:32.299 },
  { id:'ATC-05', road:'A109N', km:218, name:'Awere Station',        region:'Northern', aadt:1480, cars:888,  mc:148, lcv:222, hgv:148, bus:59,  nmt:15,  lat:3.020, lng:32.380 },
  { id:'ATC-06', road:'A109W', km:0,   name:'Kampala West Gate',    region:'Central',  aadt:5210, cars:3126, mc:521, lcv:782, hgv:521, bus:208, nmt:52,  lat:0.310, lng:32.550 },
  { id:'ATC-07', road:'A109W', km:78,  name:'Masaka Station',       region:'Central',  aadt:3820, cars:2292, mc:382, lcv:573, hgv:382, bus:153, nmt:38,  lat:-0.330,lng:31.740 },
  { id:'ATC-08', road:'A109W', km:148, name:'Mbarara Station',      region:'Western',  aadt:2940, cars:1764, mc:294, lcv:441, hgv:294, bus:118, nmt:29,  lat:-0.610,lng:30.640 },
  { id:'ATC-09', road:'A109W', km:200, name:'Bushenyi Station',     region:'Western',  aadt:1840, cars:1104, mc:184, lcv:276, hgv:184, bus:74,  nmt:18,  lat:-0.540,lng:30.180 },
  { id:'ATC-10', road:'A109E', km:0,   name:'Kampala East Gate',    region:'Central',  aadt:6480, cars:3888, mc:648, lcv:972, hgv:648, bus:259, nmt:65,  lat:0.330, lng:32.650 },
  { id:'ATC-11', road:'A109E', km:82,  name:'Nile Bridge Jinja',    region:'Eastern',  aadt:4210, cars:2526, mc:421, lcv:632, hgv:421, bus:168, nmt:42,  lat:0.440, lng:33.200 },
  { id:'ATC-12', road:'A109E', km:140, name:'Iganga Station',       region:'Eastern',  aadt:2840, cars:1704, mc:284, lcv:426, hgv:284, bus:114, nmt:28,  lat:0.610, lng:33.490 },
  { id:'ATC-13', road:'A109E', km:206, name:'Tororo Station',       region:'Eastern',  aadt:2180, cars:1308, mc:218, lcv:327, hgv:218, bus:87,  nmt:22,  lat:0.700, lng:34.180 },
  { id:'ATC-14', road:'A104E', km:0,   name:'Kampala–Entebbe',      region:'Central',  aadt:18400,cars:11040,mc:1840,lcv:2760,hgv:1840,bus:736, nmt:184, lat:0.300, lng:32.580 },
  { id:'ATC-15', road:'A104E', km:42,  name:'Entebbe Airport',      region:'Central',  aadt:9840, cars:5904, mc:984, lcv:1476,hgv:984, bus:394, nmt:98,  lat:0.060, lng:32.460 },
  { id:'ATC-16', road:'A104',  km:130, name:'Masaka–Mbarara',       region:'Central',  aadt:2620, cars:1572, mc:262, lcv:393, hgv:262, bus:105, nmt:26,  lat:-0.360,lng:31.620 },
  { id:'ATC-17', road:'A104',  km:280, name:'Kabale Station',       region:'Western',  aadt:1670, cars:1002, mc:167, lcv:251, hgv:167, bus:67,  nmt:16,  lat:-1.250,lng:29.990 },
  { id:'ATC-18', road:'B23',   km:45,  name:'Mbarara Bypass',       region:'Western',  aadt:2180, cars:1308, mc:218, lcv:327, hgv:218, bus:87,  nmt:22,  lat:-0.620,lng:30.700 },
  { id:'ATC-19', road:'B27',   km:12,  name:'Kamuli Station',       region:'Eastern',  aadt:1420, cars:852,  mc:142, lcv:213, hgv:142, bus:57,  nmt:14,  lat:0.940, lng:33.120 },
  { id:'ATC-20', road:'B33',   km:24,  name:'Iganga Bypass',        region:'Eastern',  aadt:1680, cars:1008, mc:168, lcv:252, hgv:168, bus:67,  nmt:17,  lat:0.620, lng:33.500 },
  { id:'ATC-21', road:'A109N', km:290, name:'Nimule Border',        region:'Northern', aadt:1240, cars:744,  mc:124, lcv:186, hgv:124, bus:50,  nmt:12,  lat:3.600, lng:32.080 },
  { id:'ATC-22', road:'A109W', km:250, name:'Kabale Bypass',        region:'Western',  aadt:1180, cars:708,  mc:118, lcv:177, hgv:118, bus:47,  nmt:12,  lat:-1.240,lng:29.980 },
  { id:'ATC-23', road:'A101',  km:18,  name:'Hoima Station',        region:'Western',  aadt:1840, cars:1104, mc:184, lcv:276, hgv:184, bus:74,  nmt:18,  lat:1.430, lng:31.360 },
  { id:'ATC-24', road:'B30',   km:8,   name:'Fort Portal Station',  region:'Western',  aadt:2140, cars:1284, mc:214, lcv:321, hgv:214, bus:86,  nmt:21,  lat:0.650, lng:30.270 },
  { id:'ATC-25', road:'A109N', km:120, name:'Karuma Bridge',        region:'Northern', aadt:2480, cars:1488, mc:248, lcv:372, hgv:248, bus:99,  nmt:25,  lat:2.250, lng:32.228 },
];

const FORECAST = [
  { yr:2016,normal:2890,  opt:2890,  pess:2890 },
  { yr:2017,normal:3006,  opt:3063,  pess:2947 },
  { yr:2018,normal:3126,  opt:3247,  pess:3006 },
  { yr:2019,normal:3251,  opt:3441,  pess:3066 },
  { yr:2020,normal:3141,  opt:3647,  pess:2821 },
  { yr:2021,normal:3267,  opt:3866,  pess:2877 },
  { yr:2022,normal:3397,  opt:4098,  pess:2935 },
  { yr:2023,normal:3533,  opt:4344,  pess:2994 },
  { yr:2024,normal:3675,  opt:4604,  pess:3054 },
  { yr:2025,normal:3822,  opt:4881,  pess:3115 },
  { yr:2026,normal:3975,  opt:5173,  pess:3177 },
  { yr:2027,normal:4134,  opt:5484,  pess:3241 },
  { yr:2028,normal:4299,  opt:5813,  pess:3306 },
  { yr:2029,normal:4471,  opt:6162,  pess:3372 },
  { yr:2030,normal:4650,  opt:6532,  pess:3439 },
  { yr:2031,normal:4836,  opt:6924,  pess:3508 },
  { yr:2032,normal:5029,  opt:7340,  pess:3578 },
  { yr:2033,normal:5230,  opt:7781,  pess:3650 },
  { yr:2034,normal:5439,  opt:8248,  pess:3723 },
  { yr:2035,normal:5656,  opt:8743,  pess:3797 },
];

const CORRIDORS = [
  { name:'Kampala–Gulu',    road:'A109 N', km:336, aadt:2140, cond:'Fair',   iri:4.8, fatalities:84, trucks:22 },
  { name:'Kampala–Mbarara', road:'A109 W', km:266, aadt:3820, cond:'Poor',   iri:5.9, fatalities:112,trucks:28 },
  { name:'Kampala–Tororo',  road:'A109 E', km:212, aadt:4210, cond:'Good',   iri:3.1, fatalities:68, trucks:18 },
  { name:'Kampala–Kabale',  road:'A104',   km:414, aadt:1670, cond:'Poor',   iri:5.4, fatalities:94, trucks:24 },
  { name:'Kampala–Entebbe', road:'A104 E', km:42,  aadt:18400,cond:'Good',   iri:2.8, fatalities:32, trucks:12 },
];

const COND_COLOR: Record<string,string> = { Good:'#22c55e', Fair:'#eab308', Poor:'#f97316', Critical:'#ef4444' };

// ─── Road safety: flexible field access ────────────────────────────────────
// road_accidents / road_blackspots column names aren't fixed in this codebase
// yet, so each value is read from the first matching candidate key present on
// the row rather than a single hardcoded name.
function pick<T = any>(row: any, keys: string[], fallback: T): T {
  if (!row) return fallback;
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
  }
  return fallback;
}
const SEVERITY_KEYS  = ['severity','severity_level','accident_severity','crash_severity','injury_severity','risk_level'];
const FATALITY_KEYS  = ['fatalities','fatality_count','deaths','num_fatalities'];
const INJURY_KEYS     = ['injuries','injury_count','num_injuries'];
const NAME_KEYS       = ['name','location_name','blackspot_name','spot_name','site_name','location','junction_name'];
const ACCIDENT_CT_KEYS= ['accident_count','accidents','total_accidents','crash_count','num_accidents'];
const LAT_KEYS         = ['latitude','lat'];
const LNG_KEYS         = ['longitude','lng','lon'];
const REGION_KEYS      = ['region','district'];
const ROAD_KEYS        = ['road_name','link_name','road','link_id'];
const SEVERITY_COLOR: Record<string,string> = {
  critical:'#ff0040', high:'#ff6600', severe:'#ff0040', fatal:'#ff0040',
  moderate:'#ffee00', medium:'#ffee00', minor:'#00ff88', low:'#00ff88',
};
const severityColor = (sev: string) => SEVERITY_COLOR[String(sev).toLowerCase()] ?? '#4d9fff';

type Subtab = 'dashboard'|'counts'|'forecast'|'axle'|'safety'|'corridors'|'reports';
type Scenario = 'normal'|'opt'|'pess';

const s = {
  wrap:    { padding:'20px', maxWidth:1400, margin:'0 auto' } as React.CSSProperties,
  stabs:   { display:'flex', gap:4, marginBottom:20, flexWrap:'wrap' as const },
  stab:    { padding:'8px 18px', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer', border:'1px solid #00f5ff33', background:'#111', color:'#777', transition:'all .2s' } as React.CSSProperties,
  stabOn:  { background:'#00f5ff22', color:'#00f5ff', border:'1px solid #00f5ff66' } as React.CSSProperties,
  kpiRow:  { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:18 } as React.CSSProperties,
  kpi:     { background:'#111', border:'1px solid #00f5ff1a', borderLeft:'3px solid #00f5ff', borderRadius:8, padding:'14px 16px' } as React.CSSProperties,
  card:    { background:'#111', border:'1px solid #00f5ff1a', borderRadius:8, padding:16, marginBottom:16 } as React.CSSProperties,
  lbl:     { color:'#777', fontSize:10, textTransform:'uppercase' as const, letterSpacing:'.6px' },
  val:     { color:'#00f5ff', fontSize:22, fontWeight:700, margin:'5px 0 2px', fontFamily:'monospace' } as React.CSSProperties,
  sub:     { color:'#555', fontSize:11 } as React.CSSProperties,
  h3:      { color:'#00f5ff', fontSize:13, fontWeight:700, marginBottom:12 } as React.CSSProperties,
  table:   { width:'100%', borderCollapse:'collapse' as const, fontSize:12.5 } as React.CSSProperties,
  th:      { background:'#0d0d0d', color:'#00f5ff', padding:'9px 11px', textAlign:'left' as const, fontSize:10, textTransform:'uppercase' as const, letterSpacing:'.5px', borderBottom:'1px solid #00f5ff22' } as React.CSSProperties,
  td:      { padding:'9px 11px', borderBottom:'1px solid #ffffff07', color:'#bbb', verticalAlign:'middle' as const } as React.CSSProperties,
  badge:   { display:'inline-block', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600 } as React.CSSProperties,
  mapBox:  { height:360, borderRadius:8, border:'1px solid #00f5ff1a' } as React.CSSProperties,
  dl:      { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer', border:'1px solid', margin:4, textDecoration:'none', transition:'all .2s' } as React.CSSProperties,
};

function condBadge(c:string){
  const m:Record<string,{bg:string,col:string}> = {Good:{bg:'#00ff8820',col:'#00ff88'},Fair:{bg:'#ffee0020',col:'#ffee00'},Poor:{bg:'#ff660020',col:'#ff6600'},Critical:{bg:'#ff004020',col:'#ff0040'}};
  const cc=m[c]||{bg:'#ffffff15',col:'#888'};
  return <span style={{...s.badge,background:cc.bg,color:cc.col}}>{c}</span>;
}

export default function NTISSection() {
  const [tab, setTab] = useState<Subtab>('dashboard');
  const [scenario, setScenario] = useState<Scenario>('normal');
  const [regionFilter, setRegionFilter] = useState('all');
  const [sortCol, setSortCol] = useState('aadt');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

  // Road safety — live from Supabase (road_accidents / road_blackspots)
  const [accidents, setAccidents]           = useState<any[]>([]);
  const [blackspots, setBlackspots]         = useState<any[]>([]);
  const [safetyLoading, setSafetyLoading]   = useState(false);
  const [safetyLoaded, setSafetyLoaded]     = useState(false);
  const [safetyError, setSafetyError]       = useState<string | null>(null);

  // Fetch safety data
  useEffect(() => {
    setSafetyLoading(true);
    setSafetyError(null);
    Promise.all([
      supabase.from('road_accidents').select('district,severity_class,accident_year,fatalities'),
      supabase.from('road_blackspots').select('id,location_name,district,road_name,severity_level')
    ]).then(([accRes, bsRes]) => {
      if (accRes.error) throw accRes.error;
      setAccidents(accRes.data ?? []);
      setBlackspots(bsRes.data ?? []);
      setSafetyLoaded(true);
    }).catch(e => {
      setSafetyError(e.message ?? 'Failed to load safety data');
    }).finally(() => {
      setSafetyLoading(false);
    });
  }, []);

  const ovChartRef  = useRef<HTMLCanvasElement>(null);
  const fcChartRef  = useRef<HTMLCanvasElement>(null);
  const ftChartRef  = useRef<HTMLCanvasElement>(null);
  const mapOvRef    = useRef<HTMLDivElement>(null);
  const mapAxleRef  = useRef<HTMLDivElement>(null);
  const mapSafeRef  = useRef<HTMLDivElement>(null);
  const mapOvInst   = useRef<any>(null);
  const mapAxleInst = useRef<any>(null);
  const mapSafeInst = useRef<any>(null);
  const mapSafeMarkersRef = useRef<any>(null);

  const ESRI_BASE   = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const ESRI_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

  function makeMap(ref: React.RefObject<HTMLDivElement>, inst: React.MutableRefObject<any>, center:[number,number], zoom:number) {
    const L=(window as any).L;
    if (!L||!ref.current||inst.current) return null;
    const m=L.map(ref.current).setView(center,zoom);
    L.tileLayer(ESRI_BASE).addTo(m);
    L.tileLayer(ESRI_LABELS,{opacity:.7}).addTo(m);
    inst.current=m;
    return m;
  }

  // Dashboard chart + map (traffic-only: AADT trend + ATC station network)
  useEffect(()=>{
    if(tab!=='dashboard') return;
    const C=(window as any).Chart;
    if(C&&ovChartRef.current){
      const ex=(window as any).__ovChart; if(ex) ex.destroy();
      const ch=new C(ovChartRef.current.getContext('2d'),{
        type:'line',
        data:{labels:[2016,2017,2018,2019,2020,2021,2022,2023,2024,2025],datasets:[{label:'Avg AADT',data:[2890,3010,3126,3251,3141,3267,3397,3533,3675,3847],borderColor:'#00f5ff',backgroundColor:'#00f5ff15',fill:true,tension:.4,pointRadius:3}]},
        options:{responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{color:'#888'}},y:{ticks:{color:'#888'},min:2500}},plugins:{legend:{labels:{color:'#aaa'}}}},
      });
      (window as any).__ovChart=ch;
    }
    const L=(window as any).L;
    if(L&&mapOvRef.current&&!mapOvInst.current){
      const m=makeMap(mapOvRef, mapOvInst, [1.373,32.290],7)!;
      ATC_STATIONS.forEach(st=>{
        const icon=L.divIcon({html:`<div style="width:10px;height:10px;border-radius:50%;background:#00f5ff;border:2px solid #000"></div>`,iconSize:[10,10],iconAnchor:[5,5]});
        L.marker([st.lat,st.lng],{icon}).bindPopup(`<div style="background:#111;padding:8px;color:#ccc;min-width:160px"><b style="color:#00f5ff">${st.id}</b><br>${st.name}<br>${st.road} km ${st.km}<br>AADT: <b style="color:#ffee00">${st.aadt.toLocaleString()}</b></div>`).addTo(m);
      });
    }
  },[tab]);

  // Forecast chart
  useEffect(()=>{
    if(tab!=='forecast') return;
    const C=(window as any).Chart;
    if(!C||!fcChartRef.current) return;
    const ex=(window as any).__fcChart; if(ex) ex.destroy();
    const scenKey=scenario==='normal'?'normal':scenario==='opt'?'opt':'pess';
    const colors={normal:'#00f5ff',opt:'#00ff88',pess:'#ff6600'};
    const ch=new C(fcChartRef.current.getContext('2d'),{
      type:'line',
      data:{
        labels:FORECAST.map(f=>f.yr),
        datasets:[{
          label:`AADT (${scenario})`,
          data:FORECAST.map(f=>f[scenKey as keyof typeof f]),
          borderColor:colors[scenario],backgroundColor:colors[scenario]+'15',fill:true,tension:.4,pointRadius:3,
        }],
      },
      options:{responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{color:'#888'}},y:{ticks:{color:'#888'},min:2000}},plugins:{legend:{labels:{color:'#aaa'}}}},
    });
    (window as any).__fcChart=ch;
  },[tab,scenario]);

  // Axle map
  useEffect(()=>{
    if(tab!=='axle') return;
    const L=(window as any).L;
    if(!L||!mapAxleRef.current||mapAxleInst.current) return;
    const m=makeMap(mapAxleRef, mapAxleInst, [1.0,32.0],7)!;
    const wbs=[
      {name:'Mbarara WB',lat:-0.61,lng:30.64,viol:14,overload:18},{name:'Tororo WB',lat:0.70,lng:34.18,viol:9,overload:12},
      {name:'Gulu WB',lat:2.78,lng:32.30,viol:7,overload:10},{name:'Masaka WB',lat:-0.33,lng:31.74,viol:11,overload:15},
      {name:'Jinja WB',lat:0.44,lng:33.20,viol:8,overload:11},{name:'Iganga WB',lat:0.61,lng:33.49,viol:6,overload:9},
    ];
    wbs.forEach(w=>{
      L.circleMarker([w.lat,w.lng],{radius:12,fillColor:w.viol>10?'#ff0040':'#ff6600',color:'#000',weight:1,fillOpacity:.85})
        .bindPopup(`<div style="background:#111;padding:8px;color:#ccc;min-width:160px"><b style="color:#ff6600">${w.name}</b><br>Violations today: <b style="color:#ff0040">${w.viol}</b><br>Avg overload: <b>${w.overload}%</b></div>`)
        .addTo(m);
    });
  },[tab]);

  // Road safety — fetch real rows from Supabase once, when the tab first opens
  useEffect(()=>{
    if(tab!=='safety' || safetyLoaded) return;
    let cancelled = false;
    setSafetyLoading(true);
    Promise.all([RoadsAPI.getAccidents(), RoadsAPI.getBlackspots()]).then(([acc, bs])=>{
      if (cancelled) return;
      setAccidents(acc ?? []);
      setBlackspots(bs ?? []);
      setSafetyError((acc?.length ?? 0) === 0 && (bs?.length ?? 0) === 0
        ? 'No rows returned from road_accidents / road_blackspots.' : null);
    }).finally(()=>{ if(!cancelled){ setSafetyLoading(false); setSafetyLoaded(true); } });
    return ()=>{ cancelled = true; };
  },[tab, safetyLoaded]);

  // Safety map — blackspot markers from road_blackspots
  useEffect(()=>{
    if(tab!=='safety') return;
    const L=(window as any).L;
    if(!L||!mapSafeRef.current) return;
    const m = mapSafeInst.current ?? makeMap(mapSafeRef, mapSafeInst, [0.8,32.4],8);
    if(!m) return;
    if(mapSafeMarkersRef.current){ m.removeLayer(mapSafeMarkersRef.current); mapSafeMarkersRef.current=null; }
    if(!blackspots.length) return;
    const layer = L.layerGroup();
    blackspots.forEach(b=>{
      const lat = Number(pick(b, LAT_KEYS, NaN));
      const lng = Number(pick(b, LNG_KEYS, NaN));
      if(!isFinite(lat)||!isFinite(lng)) return;
      const sev  = String(pick(b, SEVERITY_KEYS, 'Moderate'));
      const col  = severityColor(sev);
      const name = pick(b, NAME_KEYS, 'Blackspot');
      const accN = pick(b, ACCIDENT_CT_KEYS, 0);
      const fat  = Number(pick(b, FATALITY_KEYS, 0)) || 0;
      L.circleMarker([lat,lng],{radius:Math.min(20, fat+6),fillColor:col,color:'#000',weight:1,fillOpacity:.8})
        .bindPopup(`<div style="background:#111;padding:10px;color:#ccc;min-width:180px"><b style="color:#ff0040">${name}</b><br>Accidents: <b>${accN}</b><br>Fatalities: <b style="color:#ff0040">${fat}</b><br>Severity: <b style="color:${col}">${sev}</b></div>`)
        .addTo(layer);
    });
    layer.addTo(m);
    mapSafeMarkersRef.current = layer;
  },[tab, blackspots]);

  // Accident severity chart — grouped from road_accidents rows
  useEffect(()=>{
    if(tab!=='safety') return;
    const C=(window as any).Chart;
    if(!C||!ftChartRef.current) return;
    const ex=(window as any).__ftChart; if(ex) ex.destroy();
    if(!accidents.length) return;
    const counts: Record<string, number> = {};
    accidents.forEach(a=>{
      const sev = String(pick(a, SEVERITY_KEYS, 'Unknown'));
      counts[sev] = (counts[sev] ?? 0) + 1;
    });
    const labels = Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
    const ch=new C(ftChartRef.current.getContext('2d'),{
      type:'bar',
      data:{labels,datasets:[{label:'Accidents',data:labels.map(l=>counts[l]),backgroundColor:labels.map(severityColor)}]},
      options:{responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{color:'#888'}},y:{ticks:{color:'#888'},beginAtZero:true}},plugins:{legend:{display:false}}},
    });
    (window as any).__ftChart=ch;
  },[tab, accidents]);

  // Sort/filter ATC
  const atcFiltered = ATC_STATIONS
    .filter(s=>regionFilter==='all'||s.region===regionFilter)
    .sort((a,b)=>{
      const av=(a as any)[sortCol]||0, bv=(b as any)[sortCol]||0;
      return sortDir==='desc'?bv-av:av-bv;
    });

  const ST=(id:Subtab)=>({...s.stab,...(tab===id?s.stabOn:{})});

  return (
    <div style={s.wrap}>
      <div style={s.stabs}>
        {([['dashboard','Dashboard'],['counts','Traffic Counts'],['forecast','Forecasting'],['axle','Axle Load'],['safety','Road Safety'],['corridors','Corridors'],['reports','Reports']] as [Subtab,string][]).map(([id,lbl])=>(
          <button onClick={() => setTab('dashboard')} className={tab==='dashboard'?'active':''}>Dashboard</button>
              <button key={id} style={ST(id)} onClick={()=>setTab(id)}>{lbl}</button>
        ))}
      </div>

      {/* DASHBOARD — traffic-only: AADT, ATC stations, station network */}
      {tab==='dashboard' && <>
        <div style={s.kpiRow}>
          <div style={s.kpi}><div style={s.lbl}>ATC Stations</div><div style={s.val}>38</div><div style={s.sub}>automatic traffic counters</div></div>
          <div style={{...s.kpi,borderLeftColor:'#00ff88'}}><div style={s.lbl}>Avg AADT</div><div style={{...s.val,color:'#00ff88'}}>3,847</div><div style={s.sub}>vehicles/day national avg</div></div>
          <div style={{...s.kpi,borderLeftColor:'#ffee00'}}><div style={s.lbl}>Peak Hour Vol</div><div style={{...s.val,color:'#ffee00'}}>15,200</div><div style={s.sub}>Kampala–Entebbe</div></div>
          <div style={{...s.kpi,borderLeftColor:'#ff6600'}}><div style={s.lbl}>Heavy Vehicle %</div><div style={{...s.val,color:'#ff6600'}}>23%</div><div style={s.sub}>HGV + buses</div></div>
          <div style={{...s.kpi,borderLeftColor:'#bf00ff'}}><div style={s.lbl}>Freight AADT</div><div style={{...s.val,color:'#bf00ff'}}>890</div><div style={s.sub}>HGV avg on national roads</div></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
          <div style={s.card}><div style={s.h3}>National AADT Trend 2016–2025</div><div style={{height:240}}><canvas ref={ovChartRef}></canvas></div></div>
          <div style={s.card}><div style={s.h3}>ATC Station Distribution</div>
            <table style={s.table}><thead><tr><th style={s.th}>Region</th><th style={s.th}>Stations</th><th style={s.th}>Avg AADT</th><th style={s.th}>Peak AADT</th></tr></thead><tbody>
              {['Central','Eastern','Northern','Western'].map(r=>{
                const sts=ATC_STATIONS.filter(s=>s.region===r);
                const avg=Math.round(sts.reduce((a,s)=>a+s.aadt,0)/sts.length);
                const pk=Math.max(...sts.map(s=>s.aadt));
                return <tr key={r}><td style={s.td}>{r}</td><td style={s.td}>{sts.length}</td><td style={s.td}><b style={{color:'#00f5ff'}}>{avg.toLocaleString()}</b></td><td style={s.td}>{pk.toLocaleString()}</td></tr>;
              })}
            </tbody></table>
          </div>
        </div>
        <div style={s.card}><div style={s.h3}>ATC Station Network Map</div><div ref={mapOvRef} style={s.mapBox}></div></div>
      </>}

      {/* COUNTS */}
      {tab === 'dashboard' && <SectionDashboard sectionId="ntis" accent="#00f5ff" />}
              {tab==='counts' && <>
        <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
          <span style={{color:'#666',fontSize:12,alignSelf:'center'}}>Region:</span>
          {['all','Central','Eastern','Northern','Western'].map(r=>(
            <button key={r} style={{...s.stab,...(regionFilter===r?s.stabOn:{})}} onClick={()=>setRegionFilter(r)}>{r==='all'?'All Regions':r}</button>
          ))}
        </div>
        <div style={s.card}>
          <div style={s.h3}>Traffic Count Stations — {atcFiltered.length} stations</div>
          <div style={{overflowX:'auto'}}>
            <table style={s.table}><thead><tr>
              {['Station','Road','km','Location','Region','AADT','Cars','Motorcycle','LCV','HGV','Buses','NMT'].map(h=>(
                <th key={h} style={{...s.th,cursor:'pointer'}} onClick={()=>{if(sortCol===h.toLowerCase()){setSortDir(d=>d==='asc'?'desc':'asc')}else{setSortCol(h.toLowerCase());setSortDir('desc');}}}>{h}{sortCol===h.toLowerCase()?(sortDir==='desc'?'↓':'↑'):''}</th>
              ))}</tr></thead><tbody>
              {atcFiltered.slice(0,25).map(st=>(
                <tr key={st.id}>
                  <td style={s.td}><b style={{color:'#00f5ff'}}>{st.id}</b></td>
                  <td style={s.td}>{st.road}</td>
                  <td style={s.td}>{st.km}</td>
                  <td style={s.td}>{st.name}</td>
                  <td style={s.td}>{st.region}</td>
                  <td style={s.td}><b style={{color:'#ffee00'}}>{st.aadt.toLocaleString()}</b></td>
                  <td style={s.td}>{st.cars.toLocaleString()}</td>
                  <td style={s.td}>{st.mc}</td>
                  <td style={s.td}>{st.lcv}</td>
                  <td style={s.td}>{st.hgv}</td>
                  <td style={s.td}>{st.bus}</td>
                  <td style={s.td}>{st.nmt}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      </>}

      {/* FORECAST */}
      {tab==='forecast' && <>
        <div style={{display:'flex',gap:8,marginBottom:14}}>
          {([['normal','Normal (4%/yr)'],['opt','Optimistic (6%/yr)'],['pess','Pessimistic (2%/yr)']] as [Scenario,string][]).map(([sc,lbl])=>(
            <button key={sc} style={{...s.stab,...(scenario===sc?s.stabOn:{})}} onClick={()=>setScenario(sc)}>{lbl}</button>
          ))}
        </div>
        <div style={s.card}><div style={s.h3}>AADT Forecast 2016–2035</div><div style={{height:280}}><canvas ref={fcChartRef}></canvas></div></div>
        <div style={s.card}>
          <div style={s.h3}>Growth Factor Table</div>
          <table style={s.table}><thead><tr>
            {['Year','Normal AADT','Optimistic AADT','Pessimistic AADT','Design Year Factor'].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead><tbody>
            {FORECAST.filter((_,i)=>i%3===0||i===FORECAST.length-1).map(f=>(
              <tr key={f.yr}>
                <td style={s.td}><b style={{color:f.yr===2025||f.yr===2035?'#00f5ff':'#bbb'}}>{f.yr}</b></td>
                <td style={s.td}>{f.normal.toLocaleString()}</td>
                <td style={s.td}><span style={{color:'#00ff88'}}>{f.opt.toLocaleString()}</span></td>
                <td style={s.td}><span style={{color:'#ff6600'}}>{f.pess.toLocaleString()}</span></td>
                <td style={s.td}>{(f.normal/2890).toFixed(2)}×</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </>}

      {/* AXLE LOAD */}
      {tab==='axle' && <>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
          <div style={s.card}><div style={s.h3}>EAC Axle Load Standards</div>
            <table style={s.table}><thead><tr><th style={s.th}>Configuration</th><th style={s.th}>Legal Limit</th><th style={s.th}>80kN ESALs/pass</th></tr></thead><tbody>
              <tr><td style={s.td}>Single Axle</td><td style={s.td}><b style={{color:'#00f5ff'}}>10 tonnes</b></td><td style={s.td}>1.000</td></tr>
              <tr><td style={s.td}>Tandem Axle</td><td style={s.td}><b style={{color:'#00f5ff'}}>16 tonnes</b></td><td style={s.td}>3.160</td></tr>
              <tr><td style={s.td}>Tridem Axle</td><td style={s.td}><b style={{color:'#00f5ff'}}>24 tonnes</b></td><td style={s.td}>5.840</td></tr>
              <tr><td style={s.td}>Gross Vehicle Weight</td><td style={s.td}><b style={{color:'#00f5ff'}}>56 tonnes</b></td><td style={s.td}>18.64</td></tr>
            </tbody></table>
            <div style={{background:'#0d0d0d',border:'1px solid #00f5ff1a',borderRadius:6,padding:12,marginTop:12,fontFamily:'monospace',fontSize:12,color:'#888'}}>
              ESAL = Σ(axle load / std axle)<sup>4</sup><br/>
              Standard axle = 80 kN (8.2 tonnes)
            </div>
          </div>
          <div style={s.card}><div style={s.h3}>Weigh Bridge Network Map</div><div ref={mapAxleRef} style={{...s.mapBox,height:260}}></div></div>
        </div>
        <div style={s.card}><div style={s.h3}>Top Overloaded Routes — Cumulative ESAL Analysis</div>
          <table style={s.table}><thead><tr>
            {['Route','Station','% Overloaded','Avg ESAL/day','Cum ESAL (M)','Pavement Life'].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead><tbody>
            {[
              {route:'Mbarara–Masaka A109W',stn:'Mbarara WB',pct:34,esal:1840,cum:8.4,life:'6 yrs'},
              {route:'Kampala–Jinja A109E',stn:'Jinja WB',pct:28,esal:2840,cum:12.1,life:'8 yrs'},
              {route:'Gulu–Kampala A109N',stn:'Gulu WB',pct:22,esal:1240,cum:5.8,life:'9 yrs'},
              {route:'Tororo–Jinja A109E',stn:'Tororo WB',pct:31,esal:1480,cum:6.4,life:'7 yrs'},
              {route:'Masaka–Kampala A104',stn:'Masaka WB',pct:26,esal:1180,cum:5.2,life:'10 yrs'},
              {route:'Iganga–Jinja B33',stn:'Iganga WB',pct:19,esal:940,cum:4.1,life:'12 yrs'},
            ].map((r,i)=>(
              <tr key={i}>
                <td style={s.td}>{r.route}</td><td style={s.td}>{r.stn}</td>
                <td style={s.td}><span style={{color:r.pct>30?'#ff0040':r.pct>25?'#ff6600':'#ffee00',fontWeight:700}}>{r.pct}%</span></td>
                <td style={s.td}>{r.esal.toLocaleString()}</td>
                <td style={s.td}><b style={{color:'#ff6600'}}>{r.cum}M</b></td>
                <td style={s.td}><span style={{color:parseInt(r.life)<8?'#ff0040':'#ffee00'}}>{r.life}</span></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </>}

      {/* SAFETY — live from road_accidents / road_blackspots */}
      {tab==='safety' && <>
        {safetyLoading && (
          <div style={{...s.card,textAlign:'center',color:'#666'}}>Loading road safety data…</div>
        )}
        {!safetyLoading && safetyError && (
          <div style={{...s.card,borderLeft:'3px solid #ff6600',color:'#ff6600'}}>{safetyError}</div>
        )}
        {!safetyLoading && (() => {
          const totalAccidents  = accidents.length;
          const totalFatalities = accidents.reduce((sum,a)=> sum + (Number(pick(a, FATALITY_KEYS, 0)) || 0), 0);
          const totalInjuries   = accidents.reduce((sum,a)=> sum + (Number(pick(a, INJURY_KEYS, 0)) || 0), 0);
          const totalBlackspots = blackspots.length;
          const criticalCount   = blackspots.filter(b=>{
            const sev = String(pick(b, SEVERITY_KEYS, '')).toLowerCase();
            return sev==='critical'||sev==='high'||sev==='severe';
          }).length;
          const density = [...blackspots].sort((a,b)=>
            (Number(pick(b, ACCIDENT_CT_KEYS, 0))||0) - (Number(pick(a, ACCIDENT_CT_KEYS, 0))||0));
          return (<>
            <div style={s.kpiRow}>
              <div style={{...s.kpi,borderLeftColor:'#ff006e'}}><div style={s.lbl}>Recorded Accidents</div><div style={{...s.val,color:'#ff006e'}}>{totalAccidents.toLocaleString()}</div><div style={s.sub}>road_accidents rows</div></div>
              <div style={{...s.kpi,borderLeftColor:'#ff6600'}}><div style={s.lbl}>Fatalities</div><div style={{...s.val,color:'#ff6600'}}>{totalFatalities.toLocaleString()}</div><div style={s.sub}>{totalInjuries.toLocaleString()} injuries</div></div>
              <div style={{...s.kpi,borderLeftColor:'#ffee00'}}><div style={s.lbl}>Blackspots</div><div style={{...s.val,color:'#ffee00'}}>{totalBlackspots.toLocaleString()}</div><div style={s.sub}>identified locations</div></div>
              <div style={{...s.kpi,borderLeftColor:'#ff0040'}}><div style={s.lbl}>High / Critical</div><div style={{...s.val,color:'#ff0040'}}>{criticalCount.toLocaleString()}</div><div style={s.sub}>of {totalBlackspots} blackspots</div></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
              <div style={s.card}><div style={s.h3}>Accident Severity Distribution</div>
                {totalAccidents>0
                  ? <div style={{height:240}}><canvas ref={ftChartRef}></canvas></div>
                  : <div style={{color:'#555',fontSize:12,padding:'40px 0',textAlign:'center'}}>No accident records to chart.</div>}
              </div>
              <div style={s.card}><div style={s.h3}>Blackspot Density — {totalBlackspots} locations</div>
                {totalBlackspots>0 ? (
                  <div style={{maxHeight:280,overflowY:'auto'}}>
                    <table style={s.table}><thead><tr><th style={s.th}>Location</th><th style={s.th}>Region</th><th style={s.th}>Accidents</th><th style={s.th}>Fatalities</th><th style={s.th}>Severity</th></tr></thead><tbody>
                      {density.map((b,i)=>{
                        const sev = String(pick(b, SEVERITY_KEYS, '—'));
                        return (
                          <tr key={i}>
                            <td style={s.td}>{pick(b, NAME_KEYS, pick(b, ROAD_KEYS, '—'))}</td>
                            <td style={s.td}>{pick(b, REGION_KEYS, '—')}</td>
                            <td style={s.td}>{pick(b, ACCIDENT_CT_KEYS, '—')}</td>
                            <td style={s.td}><b style={{color:'#ff006e'}}>{pick(b, FATALITY_KEYS, '—')}</b></td>
                            <td style={s.td}>{sev!=='—' ? <span style={{...s.badge,background:severityColor(sev)+'20',color:severityColor(sev)}}>{sev}</span> : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody></table>
                  </div>
                ) : <div style={{color:'#555',fontSize:12,padding:'40px 0',textAlign:'center'}}>No blackspots on record.</div>}
              </div>
            </div>
            <div style={s.card}><div style={s.h3}>Blackspot Map — Uganda</div><div ref={mapSafeRef} style={s.mapBox}></div></div>
          </>);
        })()}
      </>}

      {/* CORRIDORS */}
      {tab==='corridors' && <>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:16}}>
          {CORRIDORS.map(c=>(
            <div key={c.name} style={{...s.card,borderLeft:`3px solid ${COND_COLOR[c.cond]}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                <div>
                  <div style={{color:'#e0e0e0',fontWeight:700,fontSize:14}}>{c.name}</div>
                  <div style={{color:'#666',fontSize:11,marginTop:2}}>{c.road} | {c.km} km</div>
                </div>
                {condBadge(c.cond)}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
                <div style={{textAlign:'center',background:'#0d0d0d',borderRadius:6,padding:10}}>
                  <div style={{color:'#ffee00',fontSize:18,fontWeight:700,fontFamily:'monospace'}}>{c.aadt.toLocaleString()}</div>
                  <div style={{color:'#555',fontSize:10,marginTop:2}}>AADT</div>
                </div>
                <div style={{textAlign:'center',background:'#0d0d0d',borderRadius:6,padding:10}}>
                  <div style={{color:'#00f5ff',fontSize:18,fontWeight:700,fontFamily:'monospace'}}>{c.iri}</div>
                  <div style={{color:'#555',fontSize:10,marginTop:2}}>Avg IRI</div>
                </div>
                <div style={{textAlign:'center',background:'#0d0d0d',borderRadius:6,padding:10}}>
                  <div style={{color:'#ff006e',fontSize:18,fontWeight:700,fontFamily:'monospace'}}>{c.fatalities}</div>
                  <div style={{color:'#555',fontSize:10,marginTop:2}}>Deaths/yr</div>
                </div>
              </div>
              <div style={{display:'flex',gap:12,fontSize:12}}>
                <span style={{color:'#888'}}>Trucks: <b style={{color:'#ff6600'}}>{c.trucks}%</b></span>
                <span style={{color:'#888'}}>Length: <b style={{color:'#00f5ff'}}>{c.km} km</b></span>
              </div>
            </div>
          ))}
        </div>
      </>}

      {/* REPORTS */}
      {tab==='reports' && <>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
          {[{label:'38 Stations',sub:'ATC Network',col:'#00f5ff'},{label:'3,847/day',sub:'Avg National AADT',col:'#00ff88'},{label:'2016→2035',sub:'Forecast Period',col:'#ffee00'},{label:'-3.2%',sub:'Fatality Trend YoY',col:'#00ff88'}].map((k,i)=>(
            <div key={i} style={{background:'#0d0d0d',border:'1px solid #00f5ff1a',borderRadius:8,padding:16,textAlign:'center'}}>
              <div style={{color:k.col,fontSize:28,fontWeight:700,fontFamily:'monospace'}}>{k.label}</div>
              <div style={{color:'#555',fontSize:11,marginTop:4}}>{k.sub}</div>
            </div>
          ))}
        </div>
        <div style={s.card}><div style={s.h3}>Download Reports</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
            {[
              {label:'Daily Traffic Summary CSV',style:{borderColor:'#00ff8855',color:'#00ff88',background:'#00ff8811'}},
              {label:'Weekly AADT Report Excel',style:{borderColor:'#00f5ff55',color:'#00f5ff',background:'#00f5ff11'}},
              {label:'Monthly Safety Report PDF',style:{borderColor:'#ff006e55',color:'#ff006e',background:'#ff006e11'}},
              {label:'Quarterly Freight Report PDF',style:{borderColor:'#ff660055',color:'#ff6600',background:'#ff660011'}},
              {label:'Annual Traffic Census PDF',style:{borderColor:'#bf00ff55',color:'#bf00ff',background:'#bf00ff11'}},
            ].map(b=>(
              <a key={b.label} href="#" style={{...s.dl,...b.style}}> {b.label}</a>
            ))}
          </div>
          <table style={s.table}><thead><tr><th style={s.th}>Report Name</th><th style={s.th}>Period</th><th style={s.th}>Size</th><th style={s.th}>Generated</th></tr></thead><tbody>
            {[
              ['NTIS_Daily_Traffic_20260713.csv','Today','1.4 MB','Today 06:00'],
              ['NTIS_Weekly_AADT_W28_2026.xlsx','Jul 7–13','3.2 MB','Today 00:00'],
              ['NTIS_Safety_Report_Jun2026.pdf','June 2026','5.8 MB','Jul 1, 2026'],
              ['NTIS_Freight_Q2_2026.pdf','Q2 2026','4.1 MB','Jul 1, 2026'],
              ['NTIS_Annual_Census_2025.pdf','Full Year 2025','12.4 MB','Jan 15, 2026'],
            ].map(([n,p,sz,d])=>(
              <tr key={n}><td style={s.td}>{n}</td><td style={s.td}>{p}</td><td style={s.td}>{sz}</td><td style={s.td}>{d}</td></tr>
            ))}
          </tbody></table>
        </div>
      </>}
    </div>
  );
}
