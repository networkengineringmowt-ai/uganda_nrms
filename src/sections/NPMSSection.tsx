import { useState, useEffect, useRef } from 'react';

// ─── DATA ───────────────────────────────────────────────────────────────────

const REGIONS = [
  { region: 'Central', total: 32180, good: 34, fair: 32, poor: 22, critical: 12, iri: 4.1, paved: 2840 },
  { region: 'Eastern', total: 38420, good: 29, fair: 38, poor: 24, critical: 9,  iri: 4.6, paved: 1920 },
  { region: 'Northern', total: 42600, good: 22, fair: 41, poor: 26, critical: 11, iri: 5.3, paved: 1640 },
  { region: 'Western', total: 46423, good: 24, fair: 39, poor: 25, critical: 12, iri: 5.0, paved: 1800 },
];

const MAINTENANCE_DATA = [
  { id:'A109-001', section:'Kampala–Gayaza km 0–14', length:14, cond:'Poor',    treatment:'Periodic Resealing',  unitCost:180, priority:8.2 },
  { id:'A109-002', section:'Gayaza–Zirobwe km 14–42', length:28, cond:'Poor',    treatment:'Rehabilitation',       unitCost:320, priority:7.8 },
  { id:'A109-003', section:'Zirobwe–Wobulenzi km 42–68', length:26, cond:'Fair',  treatment:'Routine Maintenance',  unitCost:45,  priority:5.1 },
  { id:'A109-004', section:'Wobulenzi–Luwero km 68–96', length:28, cond:'Good',  treatment:'Routine Maintenance',  unitCost:45,  priority:2.4 },
  { id:'B23-001',  section:'Masaka–Mbarara km 0–40', length:40, cond:'Critical', treatment:'Reconstruction',       unitCost:680, priority:9.6 },
  { id:'B23-002',  section:'Mbarara–Bushenyi km 40–90', length:50, cond:'Poor',   treatment:'Rehabilitation',       unitCost:320, priority:7.4 },
  { id:'A104-001', section:'Kampala–Entebbe km 0–42', length:42, cond:'Good',    treatment:'Routine Maintenance',  unitCost:45,  priority:1.8 },
  { id:'A104-002', section:'Masaka–Mbarara km 130–200', length:70, cond:'Critical',treatment:'Reconstruction',      unitCost:680, priority:9.1 },
  { id:'B33-001',  section:'Iganga–Bugiri km 0–38', length:38, cond:'Poor',     treatment:'Rehabilitation',       unitCost:320, priority:7.1 },
  { id:'B33-002',  section:'Bugiri–Busia km 38–64', length:26, cond:'Fair',     treatment:'Periodic Resealing',   unitCost:180, priority:4.8 },
  { id:'A109N-001',section:'Gulu–Kitgum km 0–68', length:68, cond:'Critical',   treatment:'Reconstruction',       unitCost:680, priority:9.8 },
  { id:'A109N-002',section:'Lira–Soroti km 0–84', length:84, cond:'Poor',       treatment:'Rehabilitation',       unitCost:320, priority:7.6 },
  { id:'B10-001',  section:'Fort Portal–Kasese km 0–52', length:52, cond:'Fair', treatment:'Periodic Resealing',  unitCost:180, priority:4.2 },
  { id:'B10-002',  section:'Kasese–Hima km 52–80', length:28, cond:'Good',      treatment:'Routine Maintenance',  unitCost:45,  priority:1.6 },
  { id:'D1080-001',section:'Mityana–Mubende km 0–68', length:68, cond:'Critical',treatment:'Reconstruction',      unitCost:680, priority:9.3 },
];

const ROAD_LINKS = [
  { id:'A109N', name:'Kampala–Gulu', cond:'Fair',     coords:[[0.317,32.616],[0.8,32.5],[1.5,32.4],[2.78,32.299]] },
  { id:'A109W', name:'Kampala–Mbarara', cond:'Poor',  coords:[[0.317,32.616],[0.1,32.3],[-0.2,31.8],[-0.61,30.64]] },
  { id:'A109E', name:'Kampala–Tororo', cond:'Good',   coords:[[0.317,32.616],[0.45,33.2],[0.68,34.18]] },
  { id:'A104',  name:'Kampala–Kabale', cond:'Poor',   coords:[[0.317,32.616],[0.1,31.8],[-0.5,30.9],[-1.25,29.99]] },
  { id:'A104E', name:'Kampala–Entebbe', cond:'Good',  coords:[[0.317,32.616],[0.2,32.51],[0.06,32.46]] },
  { id:'B23',   name:'Masaka–Mbarara', cond:'Critical',coords:[[-0.33,31.74],[-0.6,31.15],[-0.61,30.64]] },
  { id:'B33',   name:'Iganga–Busia', cond:'Poor',     coords:[[0.61,33.49],[0.68,34.18]] },
  { id:'B10',   name:'Fort Portal–Kasese', cond:'Fair',coords:[[0.65,30.27],[0.18,30.08]] },
];

const COND_COLOR: Record<string,string> = { Good:'#00ff88', Fair:'#ffee00', Poor:'#ff6600', Critical:'#ff0040' };

// ─── TYPES ───────────────────────────────────────────────────────────────────
type Subtab = 'kpis' | 'iri' | 'heatmap' | 'maintenance' | 'budget';
type TreatmentType = 'all' | 'Routine Maintenance' | 'Periodic Resealing' | 'Rehabilitation' | 'Reconstruction';

// ─── STYLES ──────────────────────────────────────────────────────────────────
const s = {
  wrap:     { padding: '20px', maxWidth: 1400, margin: '0 auto' } as React.CSSProperties,
  subtabs:  { display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' as const },
  stab:     { padding: '8px 18px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid #00f5ff33', background: '#111', color: '#777', transition: 'all .2s' } as React.CSSProperties,
  stabOn:   { background: '#00f5ff22', color: '#00f5ff', border: '1px solid #00f5ff66' } as React.CSSProperties,
  kpiRow:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 18 } as React.CSSProperties,
  kpi:      { background: '#111', border: '1px solid #00f5ff1a', borderLeft: '3px solid #00f5ff', borderRadius: 8, padding: '14px 16px' } as React.CSSProperties,
  kpiGreen: { borderLeftColor: '#00ff88' } as React.CSSProperties,
  kpiOrange:{ borderLeftColor: '#ff6600' } as React.CSSProperties,
  kpiPink:  { borderLeftColor: '#ff006e' } as React.CSSProperties,
  card:     { background: '#111', border: '1px solid #00f5ff1a', borderRadius: 8, padding: 16, marginBottom: 16 } as React.CSSProperties,
  lbl:      { color: '#777', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.6px' },
  val:      { color: '#00f5ff', fontSize: 22, fontWeight: 700, margin: '5px 0 2px', fontFamily: 'monospace' } as React.CSSProperties,
  sub:      { color: '#555', fontSize: 11 } as React.CSSProperties,
  h3:       { color: '#00f5ff', fontSize: 13, fontWeight: 700, marginBottom: 12, letterSpacing: '.3px' } as React.CSSProperties,
  table:    { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12.5 } as React.CSSProperties,
  th:       { background: '#0d0d0d', color: '#00f5ff', padding: '9px 11px', textAlign: 'left' as const, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.5px', borderBottom: '1px solid #00f5ff22' } as React.CSSProperties,
  td:       { padding: '9px 11px', borderBottom: '1px solid #ffffff07', color: '#bbb', verticalAlign: 'middle' as const } as React.CSSProperties,
  badge:    { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 } as React.CSSProperties,
  mapBox:   { height: 380, borderRadius: 8, border: '1px solid #00f5ff1a' } as React.CSSProperties,
};

function condBadge(c: string) {
  const colors: Record<string,{bg:string,col:string}> = {
    Good:     {bg:'#00ff8820',col:'#00ff88'},
    Fair:     {bg:'#ffee0020',col:'#ffee00'},
    Poor:     {bg:'#ff660020',col:'#ff6600'},
    Critical: {bg:'#ff004020',col:'#ff0040'},
  };
  const cc = colors[c] || {bg:'#ffffff15',col:'#888'};
  return <span style={{...s.badge, background:cc.bg, color:cc.col}}>{c}</span>;
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function NPMSSection() {
  const [tab, setTab] = useState<Subtab>('kpis');
  const [treatFilter, setTreatFilter] = useState<TreatmentType>('all');
  const [budget, setBudget] = useState(200);
  const iriRef  = useRef<HTMLCanvasElement>(null);
  const mapRef1 = useRef<HTMLDivElement>(null);
  const mapRef3 = useRef<HTMLDivElement>(null);
  const mapInst1 = useRef<any>(null);
  const mapInst3 = useRef<any>(null);

  // IRI chart
  useEffect(() => {
    if (tab !== 'iri' || !iriRef.current) return;
    const L = (window as any).Chart;
    if (!L) return;
    const ctx = iriRef.current.getContext('2d');
    const existing = (window as any).__iriChart;
    if (existing) existing.destroy();
    const ch = new L(ctx, {
      type: 'bar',
      data: {
        labels: ['0–2 Very Good','2–4 Good','4–6 Fair','6–8 Poor','8–10 Critical','10+ Failed'],
        datasets: [{
          label: '% of Network',
          data: [5, 26, 31, 22, 11, 5],
          backgroundColor: ['#00ff88','#00f5ff','#ffee00','#ff6600','#ff0040','#bf00ff'],
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#888', callback: (v:any) => v+'%' }, grid: { color: '#ffffff08' } },
          y: { ticks: { color: '#aaa', font: { size: 11 } } },
        },
      },
    });
    (window as any).__iriChart = ch;
  }, [tab]);

  // Map 1 (KPIs)
  useEffect(() => {
    if (tab !== 'kpis') return;
    const L = (window as any).L;
    if (!L || !mapRef1.current || mapInst1.current) return;
    const m = L.map(mapRef1.current).setView([1.373, 32.290], 7);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}').addTo(m);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{opacity:.7}).addTo(m);
    ROAD_LINKS.forEach(r => {
      L.polyline(r.coords, { color: COND_COLOR[r.cond] || '#888', weight: 4, opacity: .85 })
        .bindPopup(`<div style="background:#111;padding:8px;color:#ccc;min-width:140px"><b style="color:#00f5ff">${r.id}</b><br>${r.name}<br>Condition: <b style="color:${COND_COLOR[r.cond]}">${r.cond}</b></div>`)
        .addTo(m);
    });
    mapInst1.current = m;
  }, [tab]);

  // Map 3 (heatmap)
  useEffect(() => {
    if (tab !== 'heatmap') return;
    const L = (window as any).L;
    if (!L || !mapRef3.current || mapInst3.current) return;
    const m = L.map(mapRef3.current).setView([1.373, 32.290], 7);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}').addTo(m);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{opacity:.7}).addTo(m);
    ROAD_LINKS.forEach(r => {
      L.polyline(r.coords, { color: COND_COLOR[r.cond] || '#888', weight: 5, opacity: .9 })
        .bindPopup(`<b style="color:#00f5ff">${r.name}</b> — <span style="color:${COND_COLOR[r.cond]}">${r.cond}</span>`)
        .addTo(m);
    });
    mapInst3.current = m;
  }, [tab]);

  // Budget allocations
  const unitCosts = { 'Routine Maintenance':45, 'Periodic Resealing':180, 'Rehabilitation':320, 'Reconstruction':680 };
  const priorities = [
    { type:'Reconstruction',      km: Math.round((budget * 0.12 * 1e9) / (680 * 1e6)) },
    { type:'Rehabilitation',      km: Math.round((budget * 0.30 * 1e9) / (320 * 1e6)) },
    { type:'Periodic Resealing',  km: Math.round((budget * 0.28 * 1e9) / (180 * 1e6)) },
    { type:'Routine Maintenance', km: Math.round((budget * 0.30 * 1e9) / (45  * 1e6)) },
  ];

  const filteredMaint = treatFilter === 'all' ? MAINTENANCE_DATA
    : MAINTENANCE_DATA.filter(r => r.treatment === treatFilter);

  const totalCost = MAINTENANCE_DATA.reduce((s,r)=>s+r.length*r.unitCost,0);

  const ST = (id: Subtab) => ({...s.stab, ...(tab===id ? s.stabOn : {})});

  return (
    <div style={s.wrap}>
      {/* Subtabs */}
      <div style={s.subtabs}>
        <button style={ST('kpis')}       onClick={()=>setTab('kpis')}>📊 KPIs by Region</button>
        <button style={ST('iri')}        onClick={()=>setTab('iri')}>📉 IRI Distribution</button>
        <button style={ST('heatmap')}    onClick={()=>setTab('heatmap')}>🗺 Condition Map</button>
        <button style={ST('maintenance')} onClick={()=>setTab('maintenance')}>🔧 Maintenance Needs</button>
        <button style={ST('budget')}     onClick={()=>setTab('budget')}>💰 Budget Allocation</button>
      </div>

      {/* KPIs */}
      {tab === 'kpis' && <>
        <div style={s.kpiRow}>
          <div style={s.kpi}><div style={s.lbl}>Total Paved Roads</div><div style={s.val}>12,547</div><div style={s.sub}>km surveyed with ROMDAS</div></div>
          <div style={{...s.kpi,...s.kpiGreen}}><div style={s.lbl}>National Avg IRI</div><div style={{...s.val,color:'#00ff88'}}>4.2 m/km</div><div style={s.sub}>target 3.5 by 2028</div></div>
          <div style={{...s.kpi,...s.kpiOrange}}><div style={s.lbl}>Good Condition</div><div style={{...s.val,color:'#ff6600'}}>27%</div><div style={s.sub}>of surveyed network</div></div>
          <div style={{...s.kpi,...s.kpiPink}}><div style={s.lbl}>Needing Treatment</div><div style={{...s.val,color:'#ff006e'}}>68%</div><div style={s.sub}>fair, poor or critical</div></div>
        </div>
        <div style={s.card}>
          <div style={s.h3}>Region Summary</div>
          <table style={s.table}><thead><tr>
            {['Region','Total (km)','Paved (km)','Good %','Fair %','Poor %','Critical %','Avg IRI'].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead><tbody>
            {REGIONS.map(r=><tr key={r.region}>
              <td style={s.td}><b style={{color:'#e0e0e0'}}>{r.region}</b></td>
              <td style={s.td}>{r.total.toLocaleString()}</td>
              <td style={s.td}>{r.paved.toLocaleString()}</td>
              <td style={s.td}><span style={{color:'#00ff88'}}>{r.good}%</span></td>
              <td style={s.td}><span style={{color:'#ffee00'}}>{r.fair}%</span></td>
              <td style={s.td}><span style={{color:'#ff6600'}}>{r.poor}%</span></td>
              <td style={s.td}><span style={{color:'#ff0040'}}>{r.critical}%</span></td>
              <td style={s.td}><b style={{color:'#00f5ff'}}>{r.iri}</b></td>
            </tr>)}
          </tbody></table>
        </div>
        <div style={{...s.card}}>
          <div style={s.h3}>Condition Map — Road Network by Region</div>
          <div ref={mapRef1} style={s.mapBox}></div>
          <div style={{display:'flex',gap:16,marginTop:10,fontSize:12}}>
            {Object.entries(COND_COLOR).map(([k,c])=><span key={k} style={{color:c}}>■ {k}</span>)}
          </div>
        </div>
      </>}

      {/* IRI Distribution */}
      {tab === 'iri' && <>
        <div style={s.kpiRow}>
          <div style={s.kpi}><div style={s.lbl}>National Avg IRI</div><div style={s.val}>4.2 m/km</div><div style={s.sub}>FY 2025/26 baseline</div></div>
          <div style={{...s.kpi,...s.kpiGreen}}><div style={s.lbl}>Target IRI 2028</div><div style={{...s.val,color:'#00ff88'}}>3.5 m/km</div><div style={s.sub}>NDP IV objective</div></div>
          <div style={{...s.kpi,...s.kpiOrange}}><div style={s.lbl}>Surveyed Network</div><div style={{...s.val,color:'#ff6600'}}>12,547 km</div><div style={s.sub}>ROMDAS & HDM-4</div></div>
        </div>
        <div style={s.card}>
          <div style={s.h3}>IRI Distribution — National Road Network</div>
          <div style={{height:320}}><canvas ref={iriRef}></canvas></div>
          <div style={{marginTop:12,fontSize:12,color:'#666'}}>
            IRI = International Roughness Index (m/km) | Good ≤ 4 | Fair 4–6 | Poor 6–8 | Critical &gt; 8
          </div>
        </div>
        <div style={s.card}>
          <div style={s.h3}>IRI by Road Class</div>
          <table style={s.table}><thead><tr>
            {['Road Class','Length Surveyed','Very Good (0–2)','Good (2–4)','Fair (4–6)','Poor (6–8)','Critical (8+)','Avg IRI'].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead><tbody>
            <tr><td style={s.td}>National</td><td style={s.td}>5,200 km</td><td style={s.td}>8%</td><td style={s.td}>30%</td><td style={s.td}>28%</td><td style={s.td}>20%</td><td style={s.td}>14%</td><td style={s.td}><b style={{color:'#00f5ff'}}>3.8</b></td></tr>
            <tr><td style={s.td}>Urban</td><td style={s.td}>3,100 km</td><td style={s.td}>4%</td><td style={s.td}>22%</td><td style={s.td}>34%</td><td style={s.td}>26%</td><td style={s.td}>14%</td><td style={s.td}><b style={{color:'#00f5ff'}}>4.5</b></td></tr>
            <tr><td style={s.td}>District</td><td style={s.td}>3,640 km</td><td style={s.td}>2%</td><td style={s.td}>18%</td><td style={s.td}>32%</td><td style={s.td}>26%</td><td style={s.td}>22%</td><td style={s.td}><b style={{color:'#ff6600'}}>5.2</b></td></tr>
            <tr><td style={s.td}>Community</td><td style={s.td}>607 km</td><td style={s.td}>1%</td><td style={s.td}>10%</td><td style={s.td}>28%</td><td style={s.td}>34%</td><td style={s.td}>27%</td><td style={s.td}><b style={{color:'#ff0040'}}>6.4</b></td></tr>
          </tbody></table>
        </div>
      </>}

      {/* Heatmap */}
      {tab === 'heatmap' && <>
        <div style={s.card}>
          <div style={s.h3}>Road Condition Heatmap — Uganda National Network</div>
          <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
            {Object.entries(COND_COLOR).map(([k,c])=>(
              <span key={k} style={{padding:'4px 12px',borderRadius:4,background:c+'20',color:c,fontSize:12,fontWeight:700,border:`1px solid ${c}44`}}>■ {k}</span>
            ))}
          </div>
          <div ref={mapRef3} style={s.mapBox}></div>
          <div style={{marginTop:8,fontSize:11,color:'#555'}}>Click any road link for condition details</div>
        </div>
      </>}

      {/* Maintenance */}
      {tab === 'maintenance' && <>
        <div style={s.kpiRow}>
          <div style={s.kpi}><div style={s.lbl}>Total Need FY25/26</div><div style={s.val}>UGX 847B</div><div style={s.sub}>all treatment types</div></div>
          <div style={{...s.kpi,...s.kpiPink}}><div style={s.lbl}>Reconstruction</div><div style={{...s.val,color:'#ff006e'}}>UGX 312B</div><div style={s.sub}>critical roads</div></div>
          <div style={{...s.kpi,...s.kpiOrange}}><div style={s.lbl}>Rehabilitation</div><div style={{...s.val,color:'#ff6600'}}>UGX 284B</div><div style={s.sub}>poor roads</div></div>
          <div style={{...s.kpi,...s.kpiGreen}}><div style={s.lbl}>Resealing</div><div style={{...s.val,color:'#00ff88'}}>UGX 158B</div><div style={s.sub}>fair roads</div></div>
        </div>
        <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
          {(['all','Routine Maintenance','Periodic Resealing','Rehabilitation','Reconstruction'] as TreatmentType[]).map(t=>(
            <button key={t} onClick={()=>setTreatFilter(t)} style={{...s.stab,...(treatFilter===t?s.stabOn:{})}}>
              {t==='all'?'All':t}
            </button>
          ))}
        </div>
        <div style={s.card}>
          <div style={s.h3}>Maintenance Needs Register — {filteredMaint.length} sections | Total: UGX {Math.round(filteredMaint.reduce((a,r)=>a+r.length*r.unitCost,0)/1000)}B</div>
          <table style={s.table}><thead><tr>
            {['Road ID','Section','Length (km)','Condition','Treatment','Unit Cost (M/km)','Total Cost (M)','Priority'].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead><tbody>
            {filteredMaint.sort((a,b)=>b.priority-a.priority).map(r=>(
              <tr key={r.id}>
                <td style={s.td}><b style={{color:'#00f5ff'}}>{r.id}</b></td>
                <td style={s.td}>{r.section}</td>
                <td style={s.td}>{r.length}</td>
                <td style={s.td}>{condBadge(r.cond)}</td>
                <td style={s.td}><span style={{color:'#e0e0e0',fontSize:12}}>{r.treatment}</span></td>
                <td style={s.td}>UGX {r.unitCost}M</td>
                <td style={s.td}><b style={{color:'#ffee00'}}>UGX {(r.length*r.unitCost).toLocaleString()}M</b></td>
                <td style={s.td}><span style={{color:r.priority>9?'#ff006e':r.priority>7?'#ff6600':'#00ff88',fontWeight:700}}>{r.priority.toFixed(1)}</span></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </>}

      {/* Budget */}
      {tab === 'budget' && <>
        <div style={s.card}>
          <div style={s.h3}>Budget Allocation Tool — FY 2025/26</div>
          <div style={{marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:12}}>
              <span style={{color:'#aaa',fontSize:13,minWidth:120}}>Budget: UGX</span>
              <input type="range" min={0} max={500} value={budget} onChange={e=>setBudget(Number(e.target.value))}
                style={{flex:1,accentColor:'#00f5ff'}} />
              <span style={{color:'#00f5ff',fontSize:22,fontWeight:700,fontFamily:'monospace',minWidth:80}}>{budget}B</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
              {priorities.map(p=>(
                <div key={p.type} style={{background:'#0d0d0d',border:'1px solid #00f5ff1a',borderRadius:8,padding:14,textAlign:'center'}}>
                  <div style={{color:'#666',fontSize:11,marginBottom:6}}>{p.type}</div>
                  <div style={{color:'#00f5ff',fontSize:28,fontWeight:700,fontFamily:'monospace'}}>{p.km}</div>
                  <div style={{color:'#555',fontSize:11}}>km can be funded</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={s.card}>
          <div style={s.h3}>Priority Score — Top Roads for Investment</div>
          <table style={s.table}><thead><tr>
            {['Road ID','Section','Length','Condition','Treatment','Priority Score','Action'].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead><tbody>
            {MAINTENANCE_DATA.sort((a,b)=>b.priority-a.priority).slice(0,10).map(r=>(
              <tr key={r.id}>
                <td style={s.td}><b style={{color:'#00f5ff'}}>{r.id}</b></td>
                <td style={s.td}>{r.section}</td>
                <td style={s.td}>{r.length} km</td>
                <td style={s.td}>{condBadge(r.cond)}</td>
                <td style={{...s.td,fontSize:11}}>{r.treatment}</td>
                <td style={s.td}>
                  <div style={{background:'#0d0d0d',borderRadius:4,height:6,width:'100%',marginBottom:4}}>
                    <div style={{background:r.priority>9?'#ff006e':r.priority>7?'#ff6600':'#ffee00',height:'100%',width:`${r.priority*10}%`,borderRadius:4}}></div>
                  </div>
                  <span style={{color:r.priority>9?'#ff006e':r.priority>7?'#ff6600':'#ffee00',fontWeight:700}}>{r.priority.toFixed(1)}/10</span>
                </td>
                <td style={s.td}><span style={{...s.badge,background:'#00f5ff15',color:'#00f5ff',cursor:'pointer'}}>Include</span></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </>}
    </div>
  );
}
