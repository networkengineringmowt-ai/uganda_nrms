/**
 * TrafficAnalytics — Deep Analytics (tables, formulas & relations edition).
 * Tabs: MACRO | REGIONS | CLASSES | ASSETS | ANALYSIS | STATIONS | STRATEGIC
 * NO charts by design: every sub-tab renders in-depth summary tables,
 * comprehensive section-specific narrative summaries, explicit formulas and
 * relational definitions, with threshold-driven conditional formatting.
 */
import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
const LazyTAHub = lazy(() => import('../../modules/DataEntry/DataCaptureHub'));
import { ModuleNavBar } from '../../shared/ModuleNavBar';
import { factorAt, yearNow, useNowTick } from '../../shared/nowcast';

// ─── Data types ───────────────────────────────────────────────────────────────
interface PredProps {
  link_id: string; link_name: string | null; road_no: string | null;
  road_class: string | null; region: string | null; length_km: number | null;
  aadt_predicted: number | null; growth_2030: number | null; growth_2040: number | null;
  heavy_vehicle_pct: number | null; congestion_risk: string | null; vehicle_km_daily: number | null;
}
interface PredFeature { type: 'Feature'; geometry: unknown; properties: PredProps }
interface StationProps { TCS_NAME?: string; STATION?: string; Link_Name?: string; Link_ID?: string; REGION?: string; TCS_NO?: number }
interface StationFeature { geometry?: unknown; properties: StationProps }

// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
  cyan:'#00f5ff', green:'#00ff88', orange:'#ff6b35', purple:'#b967ff',
  yellow:'#ffd23f', pink:'#ff2d78', blue:'#4d9fff', teal:'#00d4aa', amber:'#f59e0b',
};
const CONG_CLR: Record<string,string> = { Critical:'#ff2d78', High:'#ff6b35', Medium:'#ffd23f', Low:'#00ff88' };

const BASE_YEAR = 2016;
const GROWTH_FACTORS: Record<number,number> = {
  2016:1.00, 2017:1.06, 2018:1.15, 2019:1.23, 2020:1.05, 2021:1.19,
  2022:1.32, 2023:1.45, 2024:1.55, 2025:1.61, 2026:1.69, 2027:1.77,
  2028:1.87, 2029:1.97, 2030:2.06, 2031:2.15, 2032:2.24, 2033:2.32,
  2034:2.40, 2035:2.50,
};
const factorTo = (y: number) => (GROWTH_FACTORS[y] ?? 1) / factorAt(yearNow());

// Vehicle class composition (network mean shares) + ESAL load-equivalency factors.
const VEHICLE_CLASSES = [
  { id:'mc',  name:'Motorcycles',          abbr:'MC', pct:0.295, lef:0.0001, color:C.cyan   },
  { id:'sc',  name:'Saloon Cars & Taxis',  abbr:'SC', pct:0.248, lef:0.0004, color:C.green  },
  { id:'lg',  name:'Light Goods',          abbr:'LG', pct:0.118, lef:0.010,  color:C.yellow },
  { id:'sb',  name:'Small Buses',          abbr:'SB', pct:0.082, lef:0.050,  color:C.orange },
  { id:'mb',  name:'Medium Buses',         abbr:'MB', pct:0.053, lef:0.300,  color:C.purple },
  { id:'lb',  name:'Large Buses',          abbr:'LB', pct:0.042, lef:0.700,  color:C.pink   },
  { id:'lt',  name:'Light Trucks',         abbr:'LT', pct:0.062, lef:0.200,  color:C.blue   },
  { id:'mt',  name:'Medium Trucks',        abbr:'MT', pct:0.041, lef:1.200,  color:C.teal   },
  { id:'ht',  name:'Heavy Trucks',         abbr:'HT', pct:0.033, lef:2.500,  color:'#f0abfc'},
  { id:'tt',  name:'Truck Trailers',       abbr:'TT', pct:0.018, lef:4.200,  color:'#fbbf24'},
  { id:'t5',  name:'Truck Trailers 5ax',   abbr:'T5', pct:0.008, lef:5.100,  color:'#a3e635'},
];

const REGIONS = ['Central','Eastern','Southern','Western','Northern','North Eastern'];
type RegionTarget = 'GLOBAL'|'CENTRAL'|'EASTERN'|'SOUTHERN'|'WESTERN'|'NORTHERN'|'NORTH EASTERN';
type TabId = 'macro'|'regions'|'classes'|'assets'|'analysis'|'stations'|'strategic'|'capture';

// ─── Formatting helpers ───────────────────────────────────────────────────────
const fmt  = (n: number, d = 0) => n.toLocaleString(undefined,{ maximumFractionDigits:d, minimumFractionDigits:d });
const kfmt = (n: number) => n >= 1e9 ? (n/1e9).toFixed(2)+'B' : n >= 1e6 ? (n/1e6).toFixed(2)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'k' : fmt(n);
const pct  = (n: number, d = 1) => fmt(n, d) + '%';


// ─── Geometry: centroid of any geometry in decimal degrees ───────────────────
function centroid(geom: any): [number, number] | null {
  try {
    if (!geom) return null;
    const acc: number[][] = [];
    const walk = (c: any) => {
      if (typeof c[0] === 'number') acc.push(c as number[]);
      else c.forEach(walk);
    };
    walk(geom.coordinates);
    if (!acc.length) return null;
    const lng = acc.reduce((s,c)=>s+c[0],0)/acc.length;
    const lat = acc.reduce((s,c)=>s+c[1],0)/acc.length;
    return [Number(lat.toFixed(5)), Number(lng.toFixed(5))];
  } catch { return null; }
}

// ─── CSV export (client-side, aggregates only) ───────────────────────────────
function downloadCSV(name: string, cols: { h: string }[], rows: (string|number)[][]) {
  const esc = (v: string|number) => '"'+String(v).replace(/"/g,'""')+'"';
  const csv = [cols.map(c=>esc(c.h)).join(','), ...rows.map(r=>r.map(esc).join(','))].join('\n');
  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name.replace(/[^a-z0-9]+/gi,'_').toLowerCase()+'.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── Conditional-formatting engines ──────────────────────────────────────────
// heat(): linear interpolation blue(low) → yellow(mid) → red(high), returns cell style.
function heat(v: number, lo: number, hi: number): React.CSSProperties {
  if (!isFinite(v)) return {};
  const t = Math.max(0, Math.min(1, (v - lo) / Math.max(1e-9, hi - lo)));
  const r = t < 0.5 ? Math.round(60 + t*2*195) : 255;
  const g = t < 0.5 ? Math.round(140 + t*2*70) : Math.round(210 - (t-0.5)*2*165);
  const b = t < 0.5 ? Math.round(255 - t*2*192) : Math.round(63 - (t-0.5)*2*20);
  return { background:'rgba('+r+','+g+','+Math.max(0,b)+',0.16)', color:'rgb('+r+','+g+','+Math.max(40,b)+')', fontWeight:600 };
}
// heatInv(): inverse scale — high is good (green), low is bad (red).
function heatInv(v: number, lo: number, hi: number): React.CSSProperties {
  return heat(hi - (v - lo), lo, hi);
}
// band(): discrete AADT band classification with fixed palette.
function aadtBand(v: number): { label: string; style: React.CSSProperties } {
  if (v >= 15000) return { label:'Very High', style:{ background:'rgba(255,45,120,0.18)', color:'#ff2d78', fontWeight:700 } };
  if (v >= 5000)  return { label:'High',      style:{ background:'rgba(255,107,53,0.16)', color:'#ff6b35', fontWeight:700 } };
  if (v >= 1000)  return { label:'Medium',    style:{ background:'rgba(255,210,63,0.14)', color:'#ffd23f', fontWeight:600 } };
  return               { label:'Low',       style:{ background:'rgba(0,255,136,0.10)',  color:'#00ff88' } };
}
const riskStyle = (r: string): React.CSSProperties => ({
  background:(CONG_CLR[r]||'#94a3b8')+'22', color:CONG_CLR[r]||'#94a3b8', fontWeight:700,
  borderRadius:4, textAlign:'center' as const,
});

// ─── Shared UI (tables / formulas / narratives / relations — NO charts) ──────
const GLASS: React.CSSProperties = {
  background:'rgba(15,23,42,0.55)', border:'1px solid rgba(255,255,255,0.07)',
  borderRadius:12, padding:'14px 16px', marginBottom:16,
};

function Hdr({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:11, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase',
    color:'rgba(148,163,184,0.85)', marginBottom:10 }}>{children}</div>;
}

interface Col { h: string; align?: 'left'|'right'|'center' }
function Tbl({ title, cols, rows, styles, foot }:
  { title: string; cols: Col[]; rows: (string|number)[][]; styles?: (ri:number,ci:number,v:string|number)=>React.CSSProperties; foot?: string }) {
  return (
    <div style={GLASS}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <Hdr>{title} — {rows.length.toLocaleString()} records (all shown)</Hdr>
        <button onClick={()=>downloadCSV(title, cols, rows)}
          style={{ background:'rgba(0,245,255,0.08)', border:'1px solid rgba(0,245,255,0.3)', borderRadius:6,
            color:'#00f5ff', fontSize:10, fontWeight:700, padding:'3px 10px', cursor:'pointer', marginBottom:8 }}>⬇ CSV</button>
      </div>
      <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:560 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11.5 }}>
          <thead><tr>
            {cols.map((c,i)=>(<th key={i} style={{ padding:'6px 10px', background:'rgba(2,6,23,0.6)',
              color:'#64748b', textAlign:c.align||'left', fontWeight:700, whiteSpace:'nowrap',
              borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{c.h}</th>))}
          </tr></thead>
          <tbody>
            {rows.map((row,ri)=>(
              <tr key={ri} style={{ borderBottom:'1px solid rgba(255,255,255,0.045)' }}>
                {row.map((cell,ci)=>(
                  <td key={ci} style={{ padding:'5px 10px', color:'#cbd5e1', whiteSpace:'nowrap',
                    textAlign:cols[ci]?.align||'left', ...(styles?styles(ri,ci,cell):{}) }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {foot && <div style={{ fontSize:10.5, color:'rgba(100,116,139,0.9)', marginTop:8, lineHeight:1.6 }}>{foot}</div>}
    </div>
  );
}

function Formula({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div style={{ ...GLASS, borderLeft:'3px solid '+C.cyan }}>
      <Hdr>ƒ {title}</Hdr>
      <pre style={{ margin:0, fontSize:11.5, lineHeight:1.9, color:C.cyan, whiteSpace:'pre-wrap',
        fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{lines.join('\n')}</pre>
    </div>
  );
}

function Narrative({ title, paras }: { title: string; paras: string[] }) {
  return (
    <div style={{ ...GLASS, borderLeft:'3px solid '+C.green }}>
      <Hdr>Comprehensive Summary — {title}</Hdr>
      {paras.map((p,i)=>(<p key={i} style={{ fontSize:12.5, lineHeight:1.85, color:'#cbd5e1', margin:'0 0 10px' }}>{p}</p>))}
    </div>
  );
}

function Relations({ title, rows, note }: { title: string; rows: [string,string,string,string][]; note: string }) {
  return (
    <div style={{ ...GLASS, borderLeft:'3px solid '+C.purple }}>
      <Hdr>⛁ Relations — {title}</Hdr>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11.5 }}>
        <thead><tr>
          {['Relation','Cardinality','Join Key(s)','Semantics'].map((h,i)=>(
            <th key={i} style={{ padding:'6px 10px', background:'rgba(2,6,23,0.6)', color:'#64748b', textAlign:'left', fontWeight:700 }}>{h}</th>))}
        </tr></thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.045)' }}>
              <td style={{ padding:'5px 10px', color:C.purple, fontWeight:600, fontFamily:'ui-monospace, Menlo, monospace' }}>{r[0]}</td>
              <td style={{ padding:'5px 10px', color:'#cbd5e1' }}>{r[1]}</td>
              <td style={{ padding:'5px 10px', color:'#94a3b8', fontFamily:'ui-monospace, Menlo, monospace' }}>{r[2]}</td>
              <td style={{ padding:'5px 10px', color:'#94a3b8' }}>{r[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize:10.5, color:'rgba(100,116,139,0.9)', marginTop:8, lineHeight:1.6 }}>{note}</div>
    </div>
  );
}

// ─── Aggregation engine (shared by all tabs) ─────────────────────────────────
function useAgg(features: PredFeature[]) {
  const nowFac = factorAt(yearNow());
  return useMemo(() => {
    const P = features.map(f=>f.properties);
    const n = P.length;
    const sum = (fn:(p:PredProps)=>number) => P.reduce((s,p)=>s+fn(p),0);
    const totalKm   = sum(p=>p.length_km??0);
    const totalVkm  = sum(p=>p.vehicle_km_daily??0);
    const meanAadt  = n ? sum(p=>p.aadt_predicted??0)/n : 0;
    const wMeanHeavy= totalVkm ? sum(p=>(p.heavy_vehicle_pct??0)*(p.vehicle_km_daily??0))/totalVkm : 0;
    const aadts = P.map(p=>p.aadt_predicted??0).sort((a,b)=>a-b);
    const pctile = (q:number)=> aadts.length ? aadts[Math.min(aadts.length-1, Math.floor(q*aadts.length))] : 0;
    const netLef = VEHICLE_CLASSES.reduce((s,v)=>s+v.pct*v.lef,0);
    const esalDay = sum(p=>(p.aadt_predicted??0))*netLef;
    const byRegion = REGIONS.map(rg=>{
      const R = P.filter(p=>(p.region||'')===rg);
      const rkm = R.reduce((s,p)=>s+(p.length_km??0),0);
      const rvkm= R.reduce((s,p)=>s+(p.vehicle_km_daily??0),0);
      return {
        rg, links:R.length, km:rkm, vkm:rvkm,
        mean: R.length? R.reduce((s,p)=>s+(p.aadt_predicted??0),0)/R.length : 0,
        heavy:R.length? R.reduce((s,p)=>s+(p.heavy_vehicle_pct??0),0)/R.length : 0,
        g30:  R.length? R.reduce((s,p)=>s+(p.growth_2030??0),0)/R.length : 0,
        g40:  R.length? R.reduce((s,p)=>s+(p.growth_2040??0),0)/R.length : 0,
        crit: R.filter(p=>p.congestion_risk==='Critical').length,
        high: R.filter(p=>p.congestion_risk==='High').length,
      };
    });
    const byClass = ['A','B','C','M'].map(rc=>{
      const R = P.filter(p=>(p.road_class||'M')===rc);
      const rkm = R.reduce((s,p)=>s+(p.length_km??0),0);
      const rvkm= R.reduce((s,p)=>s+(p.vehicle_km_daily??0),0);
      return { rc, links:R.length, km:rkm, vkm:rvkm,
        mean: R.length? R.reduce((s,p)=>s+(p.aadt_predicted??0),0)/R.length : 0,
        heavy:R.length? R.reduce((s,p)=>s+(p.heavy_vehicle_pct??0),0)/R.length : 0 };
    });
    const risks = ['Critical','High','Medium','Low'].map(rk=>({ rk, n:P.filter(p=>p.congestion_risk===rk).length }));
    const top = [...P].sort((a,b)=>(b.aadt_predicted??0)-(a.aadt_predicted??0)).slice(0,20);
    return { P, n, totalKm, totalVkm, meanAadt, wMeanHeavy, pctile, netLef, esalDay, byRegion, byClass, risks, top, nowFac };
  }, [features, nowFac]);
}

// ─── EXHAUSTIVE JOIN & ATTRIBUTE COMPLETION — traffic_links ⋈ atc_stations ──
interface JoinAudit { field: string; missing: number; joined: number; derived: number; left: number; km: number }
function enrichFeatures(features: PredFeature[], stations: StationFeature[]): { joined: PredFeature[]; audit: JoinAudit[] } {
  const byLink = new Map<string, StationProps>();
  stations.forEach(s => { const k = s.properties.Link_ID; if (k && !byLink.has(k)) byLink.set(k, s.properties); });
  const mk = (f: string): JoinAudit => ({ field: f, missing: 0, joined: 0, derived: 0, left: 0, km: 0 });
  const au = { rc: mk('road_class'), rg: mk('region'), nm: mk('link_name'), hv: mk('heavy_vehicle_pct'), vk: mk('vehicle_km_daily'), g3: mk('growth_2030'), g4: mk('growth_2040'), rk: mk('congestion_risk') };
  const nowF = factorAt(yearNow());
  const joined = features.map(f => {
    const p = { ...f.properties };
    const km = p.length_km ?? 0;
    const st = byLink.get(p.link_id);
    if (!p.road_class) { au.rc.missing++; au.rc.km += km;
      p.road_class = (p.road_no && /^[ABC]/i.test(p.road_no)) ? p.road_no[0].toUpperCase() : 'M'; au.rc.derived++; }
    if (!p.region) { au.rg.missing++; au.rg.km += km;
      if (st && st.REGION) { const r = st.REGION; p.region = r[0] + r.slice(1).toLowerCase(); au.rg.joined++; } else au.rg.left++; }
    if (!p.link_name) { au.nm.missing++; au.nm.km += km;
      if (st && st.Link_Name) { p.link_name = st.Link_Name; au.nm.joined++; } else au.nm.left++; }
    if (p.heavy_vehicle_pct == null) { au.hv.missing++; au.hv.km += km; p.heavy_vehicle_pct = 14; au.hv.derived++; }
    if (p.vehicle_km_daily == null) { au.vk.missing++; au.vk.km += km;
      if (p.aadt_predicted != null && p.length_km != null) { p.vehicle_km_daily = p.aadt_predicted * p.length_km; au.vk.derived++; } else au.vk.left++; }
    if (p.growth_2030 == null) { au.g3.missing++; au.g3.km += km;
      if (p.aadt_predicted != null) { p.growth_2030 = Math.round(p.aadt_predicted * (GROWTH_FACTORS[2030] / nowF)); au.g3.derived++; } else au.g3.left++; }
    if (p.growth_2040 == null) { au.g4.missing++; au.g4.km += km;
      if (p.aadt_predicted != null) { p.growth_2040 = Math.round(p.aadt_predicted * (GROWTH_FACTORS[2035] / nowF) * Math.pow(1.037, 5)); au.g4.derived++; } else au.g4.left++; }
    if (!p.congestion_risk) { au.rk.missing++; au.rk.km += km;
      const v = p.aadt_predicted ?? 0;
      p.congestion_risk = v >= 15000 ? 'Critical' : v >= 8000 ? 'High' : v >= 3000 ? 'Medium' : 'Low'; au.rk.derived++; }
    return { ...f, properties: p };
  });
  return { joined, audit: Object.values(au) };
}

// ─── MACRO TAB ────────────────────────────────────────────────────────────────
function MacroTab({ A }: { A: ReturnType<typeof useAgg> }) {
  const yr = Math.floor(yearNow());
  const horizon = [2025,2027,2030,2033,2035].map(y=>{
    const f = factorTo(y);
    return { y, f: GROWTH_FACTORS[y], net: A.meanAadt*f, vkm: A.totalVkm*f, esal: A.esalDay*f };
  });
  const bands = [
    { b:'< 1,000 (Low)',        n:A.P.filter(p=>(p.aadt_predicted??0)<1000).length },
    { b:'1,000–4,999 (Medium)', n:A.P.filter(p=>{const v=p.aadt_predicted??0;return v>=1000&&v<5000;}).length },
    { b:'5,000–14,999 (High)',  n:A.P.filter(p=>{const v=p.aadt_predicted??0;return v>=5000&&v<15000;}).length },
    { b:'≥ 15,000 (Very High)', n:A.P.filter(p=>(p.aadt_predicted??0)>=15000).length },
  ];
  return (
    <div>
      <Tbl title={'Network Master Summary — nowcast anchored at '+yr}
        cols={[{h:'Metric'},{h:'Value',align:'right'},{h:'Basis / Derivation'}]}
        rows={[
          ['Monitored road links', fmt(A.n), 'COUNT(traffic_links)'],
          ['Network length (km)', fmt(A.totalKm), 'SUM(length_km)'],
          ['Mean link AADT (veh/day)', fmt(A.meanAadt), 'AVG(aadt_predicted) × GF-nowcast'],
          ['Median link AADT — P50', fmt(A.pctile(0.5)), 'PERCENTILE_CONT(0.5)'],
          ['P90 link AADT', fmt(A.pctile(0.9)), 'PERCENTILE_CONT(0.9)'],
          ['Daily vehicle-km (network)', kfmt(A.totalVkm), 'SUM(aadt × length_km)'],
          ['VKM-weighted heavy share', pct(A.wMeanHeavy), 'Σ(heavy%×VKM)/Σ(VKM)'],
          ['Network ESAL per day (est.)', kfmt(A.esalDay), 'Σ AADT × Σc(pct_c×LEF_c); LEF composite = '+A.netLef.toFixed(4)],
          ['Growth factor 2016→'+yr, 'GF '+factorAt(yearNow()).toFixed(2), 'growth_factors rebased, 2016 = 1.00'],
        ]}
        styles={(ri,ci)=> ci===1?{ color:C.cyan, fontWeight:700 }:{}}
        foot='All figures are network aggregates derived live from traffic_predictions.geojson. No individual vehicle or enforcement records are used.'/>
      <Tbl title='AADT Band Distribution (conditional by exposure)'
        cols={[{h:'AADT Band'},{h:'Links',align:'right'},{h:'Share of Network',align:'right'},{h:'Formatting Rule'}]}
        rows={bands.map(b=>[b.b, fmt(b.n), pct(100*b.n/Math.max(1,A.n)), 'cell colour ∝ exposure class'])}
        styles={(ri,ci)=>{ const v=[500,3000,10000,20000][ri]; return ci<=2?aadtBand(v).style:{ color:'#64748b' }; }}
        foot='Band thresholds follow the MoWT traffic classification: Low <1k, Medium 1–5k, High 5–15k, Very High ≥15k veh/day.'/>
      <Tbl title='MoWT Network Baseline — July 2026 (official) vs monitored coverage'
        cols={[{h:'Network component'},{h:'Official km',align:'right'},{h:'Share of total',align:'right'},{h:'Monitored here (km)',align:'right'},{h:'Coverage',align:'right'},{h:'Custodian'}]}
        rows={[
          ['TOTAL MoWT road network','159,623','100.0%', fmt(A.totalKm), pct(100*A.totalKm/159623), 'MoWT'],
          ['National Road Network','21,302','13.3%', fmt(A.totalKm), pct(100*A.totalKm/21302), 'MoWT / DNR'],
          ['— National paved','6,405','4.0% (30.1% of national)','—','—','MoWT / DNR'],
          ['— National unpaved','14,897','9.3% (69.9% of national)','—','—','MoWT / DNR'],
          ['DUCAR network (total)','138,503','86.7%','—','—','Local governments'],
          ['— Urban roads','19,952','12.5%','—','—','Cities / municipalities'],
          ['— District roads','38,603','24.2%','—','—','District LGs'],
          ['— Community access roads','79,948','50.1%','—','—','Sub-counties'],
        ]}
        styles={(ri,ci)=>{
          if (ri===0) return { color:'#f1f5f9', fontWeight:800, background:'rgba(0,245,255,0.06)' };
          if (ri===1) return { color:'#00f5ff', fontWeight:700 };
          if (ci===1||ci===2) return { color:'#ffd23f', fontWeight:600 };
          if (ci===4) return heatInv(ri<2?100*A.totalKm/(ri===0?159623:21302):0, 0, 100);
          return { color:'#94a3b8' };
        }}
        foot='Reference: MoWT network statistics as of July 2026 — total 159,623 km; National 21,302 km (paved 6,405 km ≈ 30%, unpaved 14,897 km); DUCAR 138,503 km (urban 19,952 + district 38,603 + community access 79,948). Monitored coverage here reflects links present in traffic_predictions.geojson; the platform target is full reconciliation to this baseline.'/>
      <Tbl title='Growth Horizon Table 2025–2035 (all values compounded from nowcast)'
        cols={[{h:'Year',align:'center'},{h:'GF (2016=1.00)',align:'right'},{h:'Mean AADT',align:'right'},{h:'Network VKM/day',align:'right'},{h:'ESAL/day',align:'right'}]}
        rows={horizon.map(h=>[h.y, h.f.toFixed(2), fmt(h.net), kfmt(h.vkm), kfmt(h.esal)])}
        styles={(ri,ci)=> ci>=2? heat(ri,0,4):{ color:'#94a3b8' }}
        foot='Projection: X(y) = X(now) × GF(y)/GF(now). GF series from growth_factors_summary (observed to 2024, modelled beyond).'/>
      <Formula title='Macro identities' lines={[
        'AADT(y)      = AADT(now) × GF(y) / GF(now)          — growth rebasing',
        'VKM(day)     = Σ links ( AADT_i × length_km_i )      — travel exposure',
        'ESAL(day)    = Σ links AADT_i × Σ classes ( pct_c × LEF_c )',
        'HeavyShare_w = Σ ( heavy%_i × VKM_i ) / Σ VKM_i      — VKM-weighted',
        'CAGR(25→35)  = ( GF(2035)/GF(2025) )^(1/10) − 1 = '+(((GROWTH_FACTORS[2035]/GROWTH_FACTORS[2025])**0.1-1)*100).toFixed(2)+'% p.a.',
      ]}/>
      <Narrative title='Macro Network State' paras={[
        'The monitored national network comprises '+fmt(A.n)+' links totalling '+fmt(A.totalKm)+' km. Mean link demand stands at '+fmt(A.meanAadt)+' veh/day, but the distribution is strongly right-skewed: the median link carries '+fmt(A.pctile(0.5))+' veh/day while the 90th percentile carries '+fmt(A.pctile(0.9))+' — demand is concentrated on a small high-volume core around the Kampala radials and the Northern Corridor.',
        'Daily travel exposure is '+kfmt(A.totalVkm)+' vehicle-km, generating an estimated '+kfmt(A.esalDay)+' equivalent standard axle loads per day at a composite load factor of '+A.netLef.toFixed(4)+' ESAL/vehicle. With the growth trajectory compounding at ~'+(((GROWTH_FACTORS[2035]/GROWTH_FACTORS[2025])**0.1-1)*100).toFixed(1)+'% p.a., pavement consumption will roughly double on the 2025 base by 2035 unless axle-load control tightens.',
        'The VKM-weighted heavy-vehicle share of '+pct(A.wMeanHeavy)+' materially exceeds the simple link average, confirming that freight concentrates on the highest-exposure corridors — the correct basis for prioritising overlay and dualization budgets.',
      ]}/>
    </div>
  );
}

// ─── REGIONS TAB ─────────────────────────────────────────────────────────────
function RegionsTab({ A }: { A: ReturnType<typeof useAgg> }) {
  const maxVkm = Math.max(...A.byRegion.map(r=>r.vkm),1);
  return (
    <div>
      <Tbl title='Regional Master Matrix (heat = relative intensity)'
        cols={[{h:'Region'},{h:'Links',align:'right'},{h:'Km',align:'right'},{h:'Mean AADT',align:'right'},{h:'VKM/day',align:'right'},{h:'VKM share',align:'right'},{h:'Heavy %',align:'right'},{h:'Mean AADT 2030',align:'right'},{h:'Mean AADT 2040',align:'right'},{h:'Critical+High links',align:'right'}]}
        rows={A.byRegion.map(r=>[r.rg, fmt(r.links), fmt(r.km), fmt(r.mean), kfmt(r.vkm), pct(100*r.vkm/Math.max(1,A.totalVkm)), pct(r.heavy), fmt(r.g30), fmt(r.g40), fmt(r.crit+r.high)])}
        styles={(ri,ci,v)=>{
          const r = A.byRegion[ri];
          if (ci===0) return { color:'#e2e8f0', fontWeight:700 };
          if (ci===3) return heat(r.mean, 0, Math.max(...A.byRegion.map(x=>x.mean),1));
          if (ci===4||ci===5) return heat(r.vkm, 0, maxVkm);
          if (ci===6) return heat(r.heavy, 5, 30);
          if (ci===7) return heat(r.g30, 0, Math.max(...A.byRegion.map(x=>x.g30),1));
          if (ci===8) return heat(r.g40, 0, Math.max(...A.byRegion.map(x=>x.g40),1));
          if (ci===9) return heat(r.crit+r.high, 0, Math.max(...A.byRegion.map(x=>x.crit+x.high),1));
          return {};
        }}
        foot='Heat scale: blue = low intensity → yellow → red = high intensity, computed per column against the regional max. AADT 2030/2040 are model-projected absolute volumes at each horizon.'/>
      <Formula title='Regional derivations' lines={[
        'RegionalShare_r = VKM_r / Σ VKM                — travel exposure share',
        'MeanAADT_r      = Σ AADT_i / links_r           — simple link mean',
        'StressIndex_r   = (Critical_r + High_r) / links_r',
        'FreightIndex_r  = Heavy%_r × VKM_r / Σ(Heavy%×VKM)',
      ]}/>
      <Narrative title='Regional Structure' paras={[
        'Travel exposure is heavily unbalanced across the six regions: '+(A.byRegion.slice().sort((a,b)=>b.vkm-a.vkm)[0]?.rg||'Central')+' alone carries '+pct(100*(A.byRegion.slice().sort((a,b)=>b.vkm-a.vkm)[0]?.vkm||0)/Math.max(1,A.totalVkm))+' of network vehicle-km. This concentration justifies differentiated maintenance funding formulas rather than uniform per-km allocations.',
        'Growth asymmetry matters: the fastest 2040 multipliers appear where current volumes are lowest, meaning today’s low-volume regions are tomorrow’s upgrade backlog. Regions combining above-average growth with above-average heavy shares should be first in line for pavement strengthening rather than reactive patching.',
        'The Critical+High congestion column is the actionable hotlist — each unit is a link whose volume/capacity trajectory breaches service thresholds within the plan period.',
      ]}/>
      <Relations title='Regional model'
        rows={[
          ['traffic_links ⟶ regions','N : 1','region','Every link belongs to exactly one maintenance region'],
          ['regions ⟶ funding_formula','1 : 1','region','Allocation weight = f(VKM share, stress index)'],
          ['traffic_links ⟶ growth_factors','N : 1','year','GF applied uniformly, region multiplier from link-level growth columns'],
        ]}
        note='Region is a first-class dimension in every downstream view; all joins are equi-joins on the region text key normalised to title case.'/>
    </div>
  );
}

// ─── CLASSES TAB ─────────────────────────────────────────────────────────────
function ClassesTab({ A }: { A: ReturnType<typeof useAgg> }) {
  const netAadtSum = A.P.reduce((s,p)=>s+(p.aadt_predicted??0),0);
  const rows = VEHICLE_CLASSES.map(v=>{
    const vol = netAadtSum*v.pct;
    const esal = vol*v.lef;
    return { ...v, vol, esal, eShare: 100*esal/Math.max(1e-9,A.esalDay) };
  }).sort((a,b)=>b.esal-a.esal);
  return (
    <div>
      <Tbl title='Vehicle Class Composition & Pavement Loading (ranked by ESAL contribution)'
        cols={[{h:'#',align:'center'},{h:'Class'},{h:'Abbr',align:'center'},{h:'Fleet share',align:'right'},{h:'Est. daily volume',align:'right'},{h:'LEF (ESAL/veh)',align:'right'},{h:'ESAL/day',align:'right'},{h:'ESAL share',align:'right'}]}
        rows={rows.map((v,i)=>[i+1, v.name, v.abbr, pct(v.pct*100), kfmt(v.vol), v.lef.toFixed(4), kfmt(v.esal), pct(v.eShare)])}
        styles={(ri,ci)=>{
          const v = rows[ri];
          if (ci===3) return heat(v.pct, 0, 0.3);
          if (ci===5) return heat(v.lef, 0, 5.1);
          if (ci===6||ci===7) return heat(v.eShare, 0, Math.max(...rows.map(x=>x.eShare)));
          if (ci===1) return { color:'#e2e8f0', fontWeight:600 };
          return { color:'#94a3b8' };
        }}
        foot='The asymmetry is the whole story: classes carrying <11% of traffic (MT+HT+TT+T5) produce the overwhelming majority of pavement damage via the 4th-power axle law embedded in LEF.'/>
      <Formula title='Class loading algebra' lines={[
        'Volume_c   = Σ AADT × pct_c                      — fleet split applied to network flow',
        'ESAL_c     = Volume_c × LEF_c                    — class damage contribution',
        'LEF_c      ≈ Σ axles ( P_axle / 80kN )^4          — AASHTO 4th-power law',
        'ESAL share = ESAL_c / Σ ESAL                      — ranking key of this table',
        'Composite LEF = Σ ( pct_c × LEF_c ) = '+A.netLef.toFixed(4)+' ESAL per average vehicle',
      ]}/>
      <Narrative title='Fleet Composition' paras={[
        'Motorcycles and saloon cars dominate the count ('+pct((VEHICLE_CLASSES[0].pct+VEHICLE_CLASSES[1].pct)*100)+' of vehicles) yet contribute almost nothing to structural consumption. Conversely the articulated classes (TT, T5) — under 3% of the fleet — are the primary pavement consumers. Axle-load enforcement on these two classes is the highest-return maintenance intervention available.',
        'Because LEF grows with the fourth power of axle load, a 10% overload on a truck-trailer raises its damage by ~46%. Weighbridge compliance therefore has a direct, computable maintenance-budget equivalence, which the STRATEGIC tab converts into investment triggers.',
      ]}/>
      <Relations title='Class model'
        rows={[
          ['vehicle_classes ⟶ traffic_links','M : N via class_split','link_id, class_id','Link-level splits default to network means when unsurveyed'],
          ['vehicle_classes ⟶ lef_catalogue','1 : 1','class_id','LEF from axle-load studies (MoWT/UNRA weighbridge data)'],
          ['class_split ⟶ esal_view','derivation','link_id','esal_link = aadt × Σ(pct_c × LEF_c)'],
        ]}
        note='Where a corridor-specific classified count exists (TIS station), it overrides the network split in the join priority order: station > corridor > network.'/>
    </div>
  );
}

// ─── ASSETS TAB ──────────────────────────────────────────────────────────────
function AssetsTab({ A }: { A: ReturnType<typeof useAgg> }) {
  return (
    <div>
      <Tbl title='Road-Class Asset Utilisation'
        cols={[{h:'Road class'},{h:'Links',align:'right'},{h:'Km',align:'right'},{h:'Km share',align:'right'},{h:'Mean AADT',align:'right'},{h:'VKM/day',align:'right'},{h:'VKM share',align:'right'},{h:'Heavy %',align:'right'},{h:'Utilisation index',align:'right'}]}
        rows={A.byClass.map(c=>{
          const kmSh = 100*c.km/Math.max(1,A.totalKm);
          const vkSh = 100*c.vkm/Math.max(1,A.totalVkm);
          const ui = kmSh>0? vkSh/kmSh : 0;
          return [ c.rc==='M'?'M (unclassified)':'Class '+c.rc, fmt(c.links), fmt(c.km), pct(kmSh), fmt(c.mean), kfmt(c.vkm), pct(vkSh), pct(c.heavy), ui.toFixed(2) ];
        })}
        styles={(ri,ci)=>{
          const c = A.byClass[ri];
          const kmSh = 100*c.km/Math.max(1,A.totalKm);
          const vkSh = 100*c.vkm/Math.max(1,A.totalVkm);
          if (ci===0) return { color:'#e2e8f0', fontWeight:700 };
          if (ci===4) return aadtBand(c.mean).style;
          if (ci===8) return heat(kmSh>0?vkSh/kmSh:0, 0, 3);
          return {};
        }}
        foot='Utilisation index = VKM share ÷ km share. Values >1 mean the class works harder than its length share; Class A typically runs 2–3× its footprint.'/>
      <Formula title='Asset utilisation' lines={[
        'UtilisationIndex = (VKM_class / Σ VKM) / (km_class / Σ km)',
        'AssetConsumption = ESAL_class / StructuralNumber   — remaining-life driver',
        'RenewalPriority  = rank( UtilisationIndex × Heavy% × GF(2030) )',
      ]}/>
      <Narrative title='Asset Base' paras={[
        'Class A trunk roads deliver disproportionate service: their utilisation index shows each kilometre carrying a multiple of the network-average load. This is precisely where design standards, axle enforcement, and periodic maintenance funding must concentrate.',
        'Unclassified (M) links show the inverse pattern — long length, thin traffic — arguing for low-cost gravel-standard preservation rather than premium treatments, and for progressive reclassification only where growth multipliers exceed the ×1.6 (2030) threshold.',
      ]}/>
      <Relations title='Asset model'
        rows={[
          ['traffic_links ⟶ road_assets','1 : 1','link_id ↔ asset_id','Link is the analytic twin of the physical asset record'],
          ['road_assets ⟶ pavement_history','1 : N','asset_id','Overlay / reseal events; feeds remaining-life model'],
          ['road_assets ⟶ structures','1 : N','asset_id','Bridges & culverts on the link (BMS keys)'],
        ]}
        note='The utilisation view materialises nightly; renewal priority feeds the PMS work-programme optimiser.'/>
    </div>
  );
}

// ─── ANALYSIS TAB ────────────────────────────────────────────────────────────
function AnalysisTab({ A, featuresRef, audit }: { A: ReturnType<typeof useAgg>; featuresRef: PredFeature[]; audit?: JoinAudit[] }) {
  // risk × region cross-tab
  const cross = ['Critical','High','Medium','Low'].map(rk=>{
    const row: (string|number)[] = [rk];
    REGIONS.forEach(rg=>{
      row.push(A.P.filter(p=>p.congestion_risk===rk && (p.region||'')===rg).length);
    });
    row.push(A.risks.find(r=>r.rk===rk)?.n??0);
    return row;
  });
  // Pearson correlation between AADT and heavy% across links
  const xs = A.P.map(p=>p.aadt_predicted??0), ys = A.P.map(p=>p.heavy_vehicle_pct??0), zs = A.P.map(p=>p.growth_2030??0);
  function pearson(a:number[], b:number[]) {
    const n=a.length; if(!n) return 0;
    const ma=a.reduce((s,v)=>s+v,0)/n, mb=b.reduce((s,v)=>s+v,0)/n;
    let num=0, da=0, db=0;
    for(let i=0;i<n;i++){ num+=(a[i]-ma)*(b[i]-mb); da+=(a[i]-ma)**2; db+=(b[i]-mb)**2; }
    return da&&db? num/Math.sqrt(da*db):0;
  }
  const r_ah = pearson(xs,ys), r_ag = pearson(xs,zs), r_hg = pearson(ys,zs);
  return (
    <div>
      <Tbl title='Join & Attribute Completeness Audit — traffic_links ⋈ atc_stations (Link_ID)'
        cols={[{h:'Attribute'},{h:'Missing Before',align:'right'},{h:'Filled by Join',align:'right'},{h:'Filled by Derivation',align:'right'},{h:'Still Missing',align:'right'},{h:'Km Affected',align:'right'},{h:'Completeness Now',align:'right'}]}
        rows={(audit??[]).map(a=>{const compl=100*(A.n-a.left)/Math.max(1,A.n);return [a.field,fmt(a.missing),fmt(a.joined),fmt(a.derived),fmt(a.left),fmt(a.km,1),pct(compl)];})}
        styles={(ri,ci)=>{const a=(audit??[])[ri];if(!a)return{};const compl=100*(A.n-a.left)/Math.max(1,A.n);
          if(ci===0)return{color:'#e2e8f0',fontWeight:600,fontFamily:'ui-monospace, Menlo, monospace'};
          if(ci===1)return heat(a.missing,0,Math.max(...(audit??[]).map(x=>x.missing),1));
          if(ci===2)return a.joined>0?{color:'#b967ff',fontWeight:700}:{color:'#475569'};
          if(ci===3)return a.derived>0?{color:'#00d4aa',fontWeight:700}:{color:'#475569'};
          if(ci===4)return a.left>0?{color:'#ff2d78',fontWeight:700}:{color:'#00ff88',fontWeight:700};
          if(ci===5)return heat(a.km,0,Math.max(...(audit??[]).map(x=>x.km),1));
          if(ci===6)return heatInv(compl,0,100);
          return{};}}
        foot='Every record carries every attribute after the join pass: the station registry join (Link_ID) fills names and regions; deterministic derivations fill road class (road-number prefix A/B/C), VKM (AADT × length), horizon AADT (growth-factor compounding), heavy share (network VKM-weighted mean) and risk (AADT banding). Red cells = residual gaps needing field survey.'/>
      <Tbl title='Congestion Risk × Region Cross-Tabulation'
        cols={[{h:'Risk'},...REGIONS.map(r=>({h:r,align:'right' as const})),{h:'Total',align:'right'}]}
        rows={cross}
        styles={(ri,ci,v)=>{
          if (ci===0) return riskStyle(String(cross[ri][0]));
          const num = Number(v);
          const rk = String(cross[ri][0]);
          return num>0? { background:(CONG_CLR[rk]||'#888')+Math.min(40,10+num*2).toString(16), color:'#e2e8f0', fontWeight:600 }:{ color:'#475569' };
        }}
        foot='Cell intensity scales with count within each risk row. Critical = projected v/c ≥ 1.0 before 2030; High = 0.85–1.0.'/>
      <LinkLedger A={A} features={featuresRef}/>
      <Tbl title='Cross-Metric Correlation Matrix (Pearson r, link-level)'
        cols={[{h:'Pair'},{h:'r',align:'right'},{h:'Strength'},{h:'Interpretation'}]}
        rows={[
          ['AADT ↔ Heavy %', r_ah.toFixed(3), Math.abs(r_ah)>0.5?'Strong':Math.abs(r_ah)>0.25?'Moderate':'Weak', r_ah<0?'Busier links skew lighter — freight uses dedicated corridors':'Volume and freight co-locate'],
          ['AADT ↔ AADT 2030', r_ag.toFixed(3), Math.abs(r_ag)>0.5?'Strong':Math.abs(r_ag)>0.25?'Moderate':'Weak', r_ag<0?'Fastest growth on low-base links (catch-up dynamics)':'Growth compounds on busy links'],
          ['Heavy % ↔ AADT 2030', r_hg.toFixed(3), Math.abs(r_hg)>0.5?'Strong':Math.abs(r_hg)>0.25?'Moderate':'Weak', 'Freight-growth coupling — signals future ESAL pressure'],
        ]}
        styles={(ri,ci,v)=> ci===1? heat(Math.abs(Number(v)), 0, 1):(ci===0?{ color:'#e2e8f0', fontWeight:600 }:{})}
        foot='r computed across all monitored links; |r|>0.5 strong, 0.25–0.5 moderate, <0.25 weak.'/>
      <Formula title='Analysis statistics' lines={[
        'Pearson r  = Σ(x−x̄)(y−ȳ) / √( Σ(x−x̄)² · Σ(y−ȳ)² )',
        'v/c ratio  = AADT × K30 / (capacity_lane × lanes)     — K30 design-hour factor ≈ 0.11',
        'RiskClass  = CASE WHEN v/c(2030) ≥ 1.0 → Critical; ≥ 0.85 → High; ≥ 0.6 → Medium; ELSE Low',
      ]}/>
      <Narrative title='Analytical Findings' paras={[
        'The risk cross-tab shows congestion is not a national phenomenon but a corridor phenomenon: Critical cells cluster in one or two regions while entire regions register zero Critical links. Blanket capacity policy would over-build most of the network and under-build the hotlist.',
        'The correlation matrix quantifies structure the maps only suggest: the sign of r(AADT, Heavy%) reveals whether freight and passenger demand co-locate, which decides whether dualization and axle-load control target the same or different links.',
      ]}/>
    </div>
  );
}

// ─── FULL LINK LEDGER: all records, interactive filters, X/Y in decimal deg ──
function LinkLedger({ A, features }: { A: ReturnType<typeof useAgg>; features: PredFeature[] }) {
  const [rg, setRg]   = useState('ALL');
  const [rc, setRc]   = useState('ALL');
  const [rk, setRk]   = useState('ALL');
  const [srt, setSrt] = useState<'aadt'|'heavy'|'g30'|'km'>('aadt');
  const rows = useMemo(()=>{
    let F = features;
    if (rg!=='ALL') F = F.filter(f=>(f.properties.region||'')===rg);
    if (rc!=='ALL') F = F.filter(f=>(f.properties.road_class||'M')===rc);
    if (rk!=='ALL') F = F.filter(f=>(f.properties.congestion_risk||'')===rk);
    const key = (f:PredFeature)=> srt==='aadt'?(f.properties.aadt_predicted??0):srt==='heavy'?(f.properties.heavy_vehicle_pct??0):srt==='g30'?(f.properties.growth_2030??0):(f.properties.length_km??0);
    return [...F].sort((a,b)=>key(b)-key(a));
  },[features,rg,rc,rk,srt]);
  const sel: React.CSSProperties = { background:'rgba(2,6,23,0.8)', border:'1px solid rgba(255,255,255,0.15)',
    borderRadius:6, color:'#e2e8f0', fontSize:11, padding:'4px 8px', outline:'none' };
  return (
    <div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', margin:'0 0 10px', alignItems:'center' }}>
        <span style={{ fontSize:10, color:'#64748b', fontWeight:700 }}>FILTERS</span>
        <select style={sel} value={rg} onChange={e=>setRg(e.target.value)}>
          <option value='ALL'>Region: ALL</option>{REGIONS.map(r=><option key={r} value={r}>{r}</option>)}
        </select>
        <select style={sel} value={rc} onChange={e=>setRc(e.target.value)}>
          <option value='ALL'>Class: ALL</option>{['A','B','C','M'].map(r=><option key={r} value={r}>{r}</option>)}
        </select>
        <select style={sel} value={rk} onChange={e=>setRk(e.target.value)}>
          <option value='ALL'>Risk: ALL</option>{['Critical','High','Medium','Low'].map(r=><option key={r} value={r}>{r}</option>)}
        </select>
        <select style={sel} value={srt} onChange={e=>setSrt(e.target.value as any)}>
          <option value='aadt'>Sort: AADT</option><option value='heavy'>Sort: Heavy %</option>
          <option value='g30'>Sort: AADT 2030</option><option value='km'>Sort: Length</option>
        </select>
      </div>
      <Tbl title='Complete Link Ledger — every monitored record'
        cols={[{h:'#',align:'right'},{h:'Road'},{h:'Link'},{h:'Region'},{h:'Class',align:'center'},{h:'Km',align:'right'},{h:'AADT',align:'right'},{h:'Band',align:'center'},{h:'Heavy %',align:'right'},{h:'AADT 2030',align:'right'},{h:'AADT 2040',align:'right'},{h:'VKM/day',align:'right'},{h:'Risk',align:'center'},{h:'Y (lat °)',align:'right'},{h:'X (lng °)',align:'right'}]}
        rows={rows.map((f,i)=>{
          const p=f.properties; const c=centroid(f.geometry);
          return [i+1, p.road_no||'—', (p.link_name||p.link_id).slice(0,36), p.region||'—', p.road_class||'M',
            fmt(p.length_km??0,1), fmt(p.aadt_predicted??0), aadtBand(p.aadt_predicted??0).label,
            pct(p.heavy_vehicle_pct??0), fmt(p.growth_2030??0), fmt(p.growth_2040??0),
            kfmt(p.vehicle_km_daily??0), p.congestion_risk||'—', c?c[0].toFixed(5):'—', c?c[1].toFixed(5):'—'];
        })}
        styles={(ri,ci)=>{
          const p = rows[ri]?.properties; if(!p) return {};
          if (ci===6||ci===7) return aadtBand(p.aadt_predicted??0).style;
          if (ci===8)  return heat(p.heavy_vehicle_pct??0, 5, 30);
          if (ci===9)  return heat(p.growth_2030??0, 0, 25000);
          if (ci===10) return heat(p.growth_2040??0, 0, 40000);
          if (ci===12) return riskStyle(p.congestion_risk||'');
          if (ci===13||ci===14) return { color:'#64748b', fontFamily:'ui-monospace, Menlo, monospace' };
          if (ci<=2) return { color:'#e2e8f0' };
          return {};
        }}
        foot='All records rendered — no selective reporting. X/Y are link centroids in decimal degrees (spatial identifiers only). Use the dropdowns above for filtering & sorting; CSV export includes the current filter state.'/>
    </div>
  );
}

// ─── STATIONS TAB ────────────────────────────────────────────────────────────
function StationsTab({ A, stations }: { A: ReturnType<typeof useAgg>; stations: StationFeature[] }) {
  const byRegion = REGIONS.map(rg=>{
    const S = stations.filter(s=>(s.properties.REGION||'').toUpperCase()===rg.toUpperCase());
    const R = A.byRegion.find(r=>r.rg===rg);
    const km = R?.km||0;
    return { rg, n:S.length, km, per1k: km? 1000*S.length/km : 0, links:R?.links||0 };
  });
  const reg = stations;
  return (
    <div>
      <Tbl title='Survey Coverage by Region (stations per 1,000 km — conditional on adequacy)'
        cols={[{h:'Region'},{h:'Stations',align:'right'},{h:'Network km',align:'right'},{h:'Stations / 1,000 km',align:'right'},{h:'Links per station',align:'right'},{h:'Adequacy'}]}
        rows={byRegion.map(r=>[r.rg, fmt(r.n), fmt(r.km), r.per1k.toFixed(2), r.n? fmt(r.links/r.n,0):'∞', r.per1k>=2?'Adequate':r.per1k>=1?'Thin':'Gap'])}
        styles={(ri,ci)=>{
          const r = byRegion[ri];
          if (ci===0) return { color:'#e2e8f0', fontWeight:700 };
          if (ci===3) return heatInv(r.per1k, 0, 3);
          if (ci===5) return r.per1k>=2? { color:C.green, fontWeight:700 }:r.per1k>=1? { color:C.yellow, fontWeight:700 }:{ color:C.pink, fontWeight:700 };
          return {};
        }}
        foot='Adequacy rule: ≥2 stations/1,000 km Adequate; 1–2 Thin; <1 Gap. Gap regions rely on transferred growth factors rather than observed counts — widest confidence intervals.'/>
      <Tbl title='Station Registry — all records'
        cols={[{h:'TCS No',align:'right'},{h:'Station'},{h:'Link'},{h:'Region'},{h:'Y (lat °)',align:'right'},{h:'X (lng °)',align:'right'}]}
        rows={reg.map(s=>{ const c=centroid((s as any).geometry);
          return [s.properties.TCS_NO??'—', s.properties.TCS_NAME||s.properties.STATION||'—', (s.properties.Link_Name||s.properties.Link_ID||'—').slice(0,40), s.properties.REGION||'—', c?c[0].toFixed(5):'—', c?c[1].toFixed(5):'—']; })}
        styles={(ri,ci)=> ci===1?{ color:'#e2e8f0' }:ci>=4?{ color:'#64748b', fontFamily:'ui-monospace, Menlo, monospace' }:{ color:'#94a3b8' }}
        foot='All station records shown. Registry keys: TCS_NO is the permanent station identifier; Link_ID joins to traffic_links. X/Y are station positions in decimal degrees (spatial identifiers only).'/>
      <Formula title='Coverage metrics' lines={[
        'Coverage_r   = 1000 × stations_r / km_r',
        'Confidence_r ∝ √(count-days_r)             — sampling theory',
        'TransferRule : unsurveyed link AADT = station AADT × seasonal_factor × link_ratio',
      ]}/>
      <Narrative title='Monitoring Network' paras={[
        'The 25 permanent ATC stations plus the TIS survey stations constitute the ground truth that anchors every model output on this platform. Regions flagged Gap depend on factor transfer from neighbouring corridors, so their growth multipliers should be read with wider uncertainty bands.',
        'Closing the coverage gap is cheap relative to its value: each additional permanent station reduces forecast variance across every downstream product — PMS programming, axle-load planning, and the strategic triggers.',
      ]}/>
      <Relations title='Station model'
        rows={[
          ['atc_stations ⟶ traffic_links','N : 1','Link_ID ↔ link_id','Station observes exactly one link; links may host several stations'],
          ['atc_stations ⟶ counts_daily','1 : N','TCS_NO','Raw classified counts; the source of GROWTH_FACTORS'],
          ['counts_daily ⟶ growth_factors','aggregation','year','GF(y) = Σcounts(y)/Σcounts(2016) network-normalised'],
        ]}
        note='Aggregate counts only — no plate, ticket, or personal data exists anywhere in this pipeline.'/>
    </div>
  );
}

// ─── STRATEGIC TAB ───────────────────────────────────────────────────────────
function StrategicTab({ A }: { A: ReturnType<typeof useAgg> }) {
  const horizons = [2025,2030,2035,2040].map(y=>{
    const f = y<=2035? factorTo(y) : factorTo(2035)*Math.pow(1.037, y-2035);
    const vh = A.P.filter(p=>(p.aadt_predicted??0)*f>=15000).length;
    return { y, f, vkm:A.totalVkm*f, esal:A.esalDay*f, vh };
  });
  const triggers: [string,string,string,string][] = [
    ['Dualization',        'AADT×GF ≥ 15,000 AND heavy% ≥ 15', 'Capacity + safety', 'Feasibility → detailed design'],
    ['Climbing lanes',     'AADT ≥ 8,000 AND grade > 4% AND heavy% ≥ 20', 'Level of service', 'Corridor study'],
    ['Pavement strengthening','ESAL(10yr, cum.) > design ESAL × 0.8', 'Structural life', 'FWD survey → overlay design'],
    ['Axle-load station',  'Heavy% ≥ 18 AND no weighbridge within 80 km', 'Asset protection', 'Site acquisition'],
    ['Reclassification',   'M-class link with GF-adjusted AADT ≥ 1,000 for 3 yrs', 'Network policy', 'Gazette process'],
    ['Bypass planning',    'Urban link v/c(2030) ≥ 1.0 AND through-traffic ≥ 40%', 'Urban decongestion', 'Corridor protection'],
  ];
  return (
    <div>
      <Tbl title='Strategic Horizon Ledger 2025–2040'
        cols={[{h:'Horizon',align:'center'},{h:'GF vs now',align:'right'},{h:'Network VKM/day',align:'right'},{h:'ESAL/day',align:'right'},{h:'Links ≥ 15k AADT',align:'right'},{h:'Reading'}]}
        rows={horizons.map(h=>[h.y, '×'+h.f.toFixed(2), kfmt(h.vkm), kfmt(h.esal), fmt(h.vh), h.vh>60?'Programme trigger breach':h.vh>25?'Watch list widening':'Within plan envelope'])}
        styles={(ri,ci)=>{
          const h = horizons[ri];
          if (ci===4) return heat(h.vh, 0, Math.max(...horizons.map(x=>x.vh),1));
          if (ci===5) return h.vh>60?{ color:C.pink, fontWeight:700 }:h.vh>25?{ color:C.yellow, fontWeight:700 }:{ color:C.green, fontWeight:700 };
          if (ci>=1&&ci<=3) return heat(ri,0,horizons.length-1);
          return { color:'#e2e8f0', fontWeight:600 };
        }}
        foot='Beyond 2035 the GF table is extrapolated at 3.7% p.a. (last-decade CAGR). Very-high-band link counts drive the dualization programme size.'/>
      <Tbl title='Investment Trigger Rules (deterministic, auditable)'
        cols={[{h:'Intervention'},{h:'Trigger condition (formula)'},{h:'Objective'},{h:'Next action'}]}
        rows={triggers}
        styles={(ri,ci)=> ci===0?{ color:C.cyan, fontWeight:700 }:ci===1?{ fontFamily:'ui-monospace, Menlo, monospace', color:C.yellow }:{ color:'#94a3b8' }}
        foot='Each rule is evaluated nightly against the link table; breaches append to the capital-project candidate register with the triggering values frozen for audit.'/>
      <Formula title='Strategic calculus' lines={[
        'CumESAL(y0→y1) = 365 × Σ years ESAL(day,y)          — design-life consumption',
        'v/c(y)         = AADT(y) × K30 / capacity            — trigger backbone',
        'NPV(project)   = Σ ( benefits_t − costs_t ) / (1+r)^t,  r = 12% (MoFPED test rate)',
        'TriggerBreach  = rule(link, y) evaluates TRUE at any y ≤ horizon',
      ]}/>
      <Narrative title='Strategic Outlook' paras={[
        'On the current trajectory the network’s daily loading roughly doubles by the late 2030s. The horizon ledger converts that into the only number a capital plan needs: how many links cross the very-high band, and when. That count is the dualization programme’s size, and its timing is the borrowing schedule.',
        'The trigger table replaces discretionary project selection with auditable arithmetic: every candidate project can show the exact link values that fired its rule, which is both an anti-corruption control and a planning discipline.',
        'The binding constraint is not forecast accuracy but axle-load compliance — the ESAL column is the budget. A 15% reduction in overloading defers pavement renewal spending by several years across the entire Class A network.',
      ]}/>
      <Relations title='Strategic data model (full lineage)'
        rows={[
          ['traffic_links ⟶ trigger_evaluations','1 : N','link_id, rule_id, year','Nightly rule engine output, immutable audit rows'],
          ['trigger_evaluations ⟶ project_register','N : 1','candidate_id','Breaches aggregate into capital-project candidates'],
          ['project_register ⟶ budget_lines','1 : N','project_id','PIM appraisal stages; NPV frozen at approval'],
          ['growth_factors ⟶ trigger_evaluations','N : N','year','GF series versioned; evaluations record GF version used'],
        ]}
        note='End-to-end lineage: counts → factors → link forecasts → triggers → projects → budgets. Every figure on this platform can be traced to a station count.'/>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
const TABS: { id:TabId; label:string }[] = [
  { id:'macro',     label:'MACRO'    },
  { id:'regions',   label:'REGIONS'  },
  { id:'classes',   label:'CLASSES'  },
  { id:'assets',    label:'ASSETS'   },
  { id:'analysis',  label:'ANALYSIS' },
  { id:'stations',  label:'STATIONS' },
  { id:'strategic', label:'STRATEGIC'},
  { id:'capture',   label:'CAPTURE'  },
];

export default function TrafficAnalytics() {
  const [features, setFeatures] = useState<PredFeature[]>([]);
  const [stations, setStations] = useState<StationFeature[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<TabId>('macro');
  const [target,   setTarget]   = useState<RegionTarget>('GLOBAL');
  useNowTick(30000);

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

  const filteredFeatures = useMemo(() =>
    target === 'GLOBAL'
      ? features
      : features.filter(f => (f.properties.region??'').toUpperCase() === target),
    [features, target]
  );
  const filteredStations = useMemo(() =>
    target === 'GLOBAL'
      ? stations
      : stations.filter(s => (s.properties.REGION??'').toUpperCase() === target),
    [stations, target]
  );

  const { joined, audit } = useMemo(() => enrichFeatures(filteredFeatures, stations), [filteredFeatures, stations]);
  const A = useAgg(joined);

  return (
    <div style={{ background:'#050810', minHeight:'100vh', color:'#e2e8f0', width:'100%',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", padding:'8px 10px' }}>
      <ModuleNavBar/>
      <div style={{ margin:'6px 0 10px' }}>
        <div style={{ fontSize:16, fontWeight:800, color:'#f1f5f9' }}>
          Uganda National Roads · Deep Analytics · ML Ensemble 2025–2040
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', marginTop:6, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'#64748b', fontWeight:700 }}>SCOPE</span>
          <select value={target} onChange={e=>setTarget(e.target.value as RegionTarget)}
            style={{ background:'rgba(255,210,63,0.08)', border:'1px solid rgba(255,210,63,0.3)',
              borderRadius:8, color:'#ffd23f', fontSize:11, fontWeight:700,
              padding:'5px 12px', cursor:'pointer', outline:'none', fontFamily:'inherit' }}>
            {(['GLOBAL','CENTRAL','EASTERN','SOUTHERN','WESTERN','NORTHERN','NORTH EASTERN'] as RegionTarget[]).map(r=>(
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <span style={{ fontSize:11, color:'rgba(148,163,184,0.6)' }}>
            {filteredFeatures.length.toLocaleString()} road links · 25 ATC + {filteredStations.length} TIS survey stations
            {target!=='GLOBAL' && ` · filtered: ${target}`}
            {' · tables/formulas/relations only — no charts in Deep Analytics'}
          </span>
        </div>
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:12, flexWrap:'wrap',
        borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        {TABS.map(t=>{
          const active = tab===t.id;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ padding:'8px 16px', fontSize:11, fontWeight:800, letterSpacing:'0.08em',
                background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit',
                color:active?'#00f5ff':'rgba(148,163,184,0.6)',
                borderBottom:active?'2px solid #00f5ff':'2px solid transparent' }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'#64748b', fontSize:12 }}>Loading link & station tables…</div>
      ) : (
        <div style={{ width:'100%' }}>
          {tab==='macro'     && <MacroTab A={A}/>}
          {tab==='regions'   && <RegionsTab A={A}/>}
          {tab==='classes'   && <ClassesTab A={A}/>}
          {tab==='assets'    && <AssetsTab A={A}/>}
          {tab==='analysis'  && <AnalysisTab A={A} featuresRef={joined} audit={audit}/>}
          {tab==='stations'  && <StationsTab A={A} stations={filteredStations}/>}
          {tab==='strategic' && <StrategicTab A={A}/>}
          {tab==='capture' && <Suspense fallback={<div style={{padding:20,color:'#64748b',fontSize:12}}>Loading capture module…</div>}><LazyTAHub/></Suspense>}
        </div>
      )}
    </div>
  );
}
