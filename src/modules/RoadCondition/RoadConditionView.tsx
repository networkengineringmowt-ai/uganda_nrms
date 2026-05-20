import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell, ReferenceLine,
  PieChart, Pie, Legend,
} from 'recharts';
import { Activity, CheckCircle2, AlertTriangle, Camera, Filter } from 'lucide-react';
import { loadPlatformAnalytics, type PlatformAnalytics } from '../../data/platformData';
import { NEON, REGION_NEON, Bar3D, GlowDefs, Chart3DWrap, AreaGradDefs, TT_NEON, TICK, AX_LINE } from '../../lib/chart3d';

const BASE = import.meta.env.BASE_URL;

// ── Image defect types ────────────────────────────────────────────────────────
interface ImageDefectSummary {
  model: string;
  images_processed: number;
  defect_distribution: Record<string, number>;
  severity_distribution: Record<string, number>;
  top_damaged_links: Array<{
    link_id: string;
    dominant_defect: string;
    image_count: number;
    avg_severity: string;
  }>;
}

interface PavementImage {
  image_path: string;
  filename: string;
  folder: string;
  link_id: string | null;
  defect_type: string;
  confidence: number;
  severity: string;
  area_pct: number;
}

// ── Defect colour map ─────────────────────────────────────────────────────────
const DEFECT_COLOR: Record<string, string> = {
  pothole:            '#ff2d78',
  alligator_crack:    '#ff6b35',
  longitudinal_crack: '#ffd23f',
  transverse_crack:   '#ffd23f',
  rutting:            '#ff9500',
  raveling:           '#94a3b8',
  good:               '#00ff88',
};

const DEFECT_LABEL: Record<string, string> = {
  pothole:            'Pothole',
  alligator_crack:    'Alligator Crack',
  longitudinal_crack: 'Long. Crack',
  transverse_crack:   'Trans. Crack',
  rutting:            'Rutting',
  raveling:           'Raveling',
  good:               'Good',
};

type FilterKey = 'all' | 'pothole' | 'crack' | 'rutting' | 'raveling' | 'good';

const FILTER_PILLS: Array<{ key: FilterKey; label: string; color: string }> = [
  { key: 'all',      label: 'All',     color: '#00f5ff' },
  { key: 'pothole',  label: 'Pothole', color: '#ff2d78' },
  { key: 'crack',    label: 'Crack',   color: '#ffd23f' },
  { key: 'rutting',  label: 'Rutting', color: '#ff9500' },
  { key: 'raveling', label: 'Raveling',color: '#94a3b8' },
  { key: 'good',     label: 'Good',    color: '#00ff88' },
];

function matchesFilter(defect: string, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  if (filter === 'crack') return defect.endsWith('_crack');
  return defect === filter;
}

// Strip "public/" prefix to get the app-relative path
function toAppPath(imagePath: string): string {
  return BASE + imagePath.replace(/^public\//, '');
}

export default function RoadConditionView() {
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [defectSummary, setDefectSummary] = useState<ImageDefectSummary | null>(null);
  const [pavementImages, setPavementImages] = useState<PavementImage[]>([]);
  const [defectFilter, setDefectFilter] = useState<FilterKey>('all');
  const [imgError, setImgError] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPlatformAnalytics().then(setAnalytics).catch(() => {});
    fetch(BASE + 'data/image_defects_summary.json')
      .then(r => r.json()).then(setDefectSummary).catch(() => {});
    fetch(BASE + 'data/pavement_images.json')
      .then(r => r.json()).then(setPavementImages).catch(() => {});
  }, []);

  const a = analytics;

  // ── Derived defect chart data ──────────────────────────────────────────────
  const defectBarData = defectSummary
    ? Object.entries(defectSummary.defect_distribution)
        .map(([type, count]) => ({
          name: DEFECT_LABEL[type] ?? type,
          count,
          fill: DEFECT_COLOR[type] ?? '#4d9fff',
        }))
        .sort((a, b) => b.count - a.count)
    : [];

  const severityPieData = defectSummary
    ? [
        { name: 'High',   value: defectSummary.severity_distribution['High']   ?? 0, fill: '#ff2d78' },
        { name: 'Medium', value: defectSummary.severity_distribution['Medium'] ?? 0, fill: '#ffd23f' },
        { name: 'Low',    value: defectSummary.severity_distribution['Low']    ?? 0, fill: '#00ff88' },
      ]
    : [];

  const filteredImages = pavementImages
    .filter(img => matchesFilter(img.defect_type, defectFilter))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 24);

  function handleImgError(path: string) {
    setImgError(prev => new Set(prev).add(path));
  }

  const wtssData = a?.wtssTimeline.map(w => ({
    year:    w.financial_year,
    km:      w.stock_of_paved_roads_km,
    added:   w.annual_increase_km,
    pct:     w.percent_paved_network,
    ndp:     w.ndp,
  })) ?? [];

  const regionPaved = a
    ? Object.entries(a.regionPavedKm)
        .map(([region, km]) => ({ region, km: Math.round(km) }))
        .sort((a, b) => b.km - a.km)
    : [];

  const conditionSummary = [
    { label:'Paved — Excellent/Good', pct: a?.pavedFairToGoodPct ?? 94.2, color:'#00ff88', bg:'bg-green-500/10', border:'border-green-500/20' },
    { label:'Paved — Poor/Bad',       pct: 100 - (a?.pavedFairToGoodPct ?? 94.2), color:'#ff2d78', bg:'bg-red-500/10', border:'border-red-500/20' },
    { label:'Unpaved — Fair/Good',    pct: a?.unpavedFairToGoodPct ?? 62, color:'#ffd23f', bg:'bg-amber-500/10', border:'border-amber-500/20' },
    { label:'Unpaved — Poor',         pct: 100 - (a?.unpavedFairToGoodPct ?? 62), color:'#ff2d78', bg:'bg-red-900/20', border:'border-red-800/30' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
          <Activity size={20} className="text-green-400"/>
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Road Condition</h1>
          <p className="text-xs text-slate-400">Pavement stock, condition indices, and NDP-period growth</p>
        </div>
      </div>

      {/* ── Condition KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bms-card border-l-4 border-green-500">
          <div className="text-2xl font-black text-green-400">{a?.pavedFairToGoodPct ?? 94.2}%</div>
          <div className="text-xs font-semibold text-slate-300 mt-1">Paved Roads — Fair to Good</div>
          <div className="text-[10px] text-slate-500">FY 2023/24 condition survey</div>
        </div>
        <div className="bms-card border-l-4 border-amber-500">
          <div className="text-2xl font-black text-amber-400">{a?.unpavedFairToGoodPct ?? 62}%</div>
          <div className="text-xs font-semibold text-slate-300 mt-1">Unpaved Roads — Fair to Good</div>
          <div className="text-[10px] text-slate-500">FY 2023/24 condition survey</div>
        </div>
        <div className="bms-card border-l-4" style={{ borderColor: '#00f5ff' }}>
          <div className="text-2xl font-black" style={{ color: '#00f5ff' }}>{a ? `${a.pavedKm.toLocaleString(undefined,{maximumFractionDigits:0})} km` : '6,312 km'}</div>
          <div className="text-xs font-semibold text-slate-300 mt-1">Paved Network Length</div>
          <div className="text-[10px] text-slate-500">July 2025 inventory</div>
        </div>
        <div className="bms-card border-l-4" style={{ borderColor: '#b967ff' }}>
          <div className="text-2xl font-black" style={{ color: '#b967ff' }}>{a ? `${a.percentPaved.toFixed(1)}%` : '29.6%'}</div>
          <div className="text-xs font-semibold text-slate-300 mt-1">Paved Share of Network</div>
          <div className="text-[10px] text-slate-500">21,292 km total national network</div>
        </div>
      </div>

      {/* ── Condition bars ── */}
      <div className="bms-card">
        <div className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-400"/> Condition Overview (FY 2023/24)
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {conditionSummary.map(c => (
            <div key={c.label} className={`rounded-xl p-4 border ${c.bg} ${c.border}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-slate-300">{c.label}</span>
                <span className="text-xl font-black" style={{ color: c.color }}>{c.pct.toFixed(1)}%</span>
              </div>
              <div className="bg-slate-700/60 rounded-full h-3">
                <div className="rounded-full h-3 transition-all" style={{ width:`${c.pct}%`, background: c.color }}/>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-[10px] text-slate-600">
          Source: OPM Infrastructure Development Cluster NAPR 2023/24
        </div>
      </div>

      {/* ── Paved stock growth ── */}
      <div className="bms-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-bold text-white">Paved Road Stock Growth (NDP II & III)</div>
            <div className="text-[10px] text-slate-500">Annual additions to the paved national road network</div>
          </div>
        </div>
        <Chart3DWrap>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={wtssData} margin={{ top: 8, right: 20, left: 8, bottom: 0 }}>
              <AreaGradDefs id="rcGreen" color="#00ff88" />
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/>
              <XAxis dataKey="year" tick={TICK} axisLine={false} tickLine={false}/>
              <YAxis tick={TICK} axisLine={false} tickLine={false} width={52}
                tickFormatter={(v:number) => `${v.toLocaleString()}`}/>
              <Tooltip {...TT_NEON}
                formatter={(v: number, name: string) => [
                  name === 'km' ? `${v.toLocaleString()} km total paved` : `+${v.toLocaleString()} km added`,
                  name === 'km' ? 'Paved stock' : 'Annual addition',
                ]}
              />
              <ReferenceLine y={5000} stroke="#475569" strokeDasharray="4 4" label={{ value:'5,000 km', fill:'#64748b', fontSize:9 }}/>
              <Area
                type="monotone"
                dataKey="km"
                stroke="#00ff88"
                strokeWidth={2.5}
                fill="url(#rcGreen)"
                dot={{ fill: '#00ff88', r: 4 }}
                animationDuration={1100}
                filter="url(#rcGreenglow)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Chart3DWrap>

        {/* NDP period chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {['NDP II', 'NDP III'].map(ndp => {
            const items = wtssData.filter(w => w.ndp === ndp);
            const total = items.reduce((sum, w) => sum + (w.added || 0), 0);
            return (
              <div key={ndp} className="bg-slate-700/60 rounded-lg px-3 py-2 text-center">
                <div className="text-sm font-black text-white">{total.toFixed(0)} km</div>
                <div className="text-[9px] text-slate-400">{ndp} additions</div>
                <div className="text-[9px] text-slate-500">{items[0]?.year} – {items[items.length-1]?.year}</div>
              </div>
            );
          })}
          <div className="bg-slate-700/60 rounded-lg px-3 py-2 text-center">
            <div className="text-sm font-black text-white">
              {a ? `${a.percentPaved.toFixed(1)}%` : '29.6%'}
            </div>
            <div className="text-[9px] text-slate-400">of network paved</div>
            <div className="text-[9px] text-slate-500">July 2025</div>
          </div>
        </div>
      </div>

      {/* ── Annual additions bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bms-card">
          <div className="text-sm font-bold text-white mb-4">Annual Paving Additions (km)</div>
          <Chart3DWrap>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={wtssData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/>
                <XAxis dataKey="year" tick={TICK} axisLine={false} tickLine={false}/>
                <YAxis tick={TICK} axisLine={false} tickLine={false} width={40}/>
                <Tooltip {...TT_NEON} formatter={(v:number) => [`+${v.toLocaleString()} km`, 'Paved added']}/>
                <Bar dataKey="added" radius={[4,4,0,0]} animationDuration={1000} shape={<Bar3D />}>
                  {wtssData.map(w => (
                    <Cell key={w.year}
                      fill={w.ndp === 'NDP II' ? '#4d9fff' : '#00ff88'}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Chart3DWrap>
          <div className="mt-2 flex gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded inline-block" style={{ background: '#4d9fff' }}/> NDP II
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded inline-block" style={{ background: '#00ff88' }}/> NDP III
            </span>
          </div>
        </div>

        {/* Region paved breakdown */}
        <div className="bms-card">
          <div className="text-sm font-bold text-white mb-4">Paved km by Region (July 2025)</div>
          <div className="space-y-2">
            {regionPaved.map(r => (
              <div key={r.region}>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: REGION_NEON[r.region] ?? '#4d9fff'}}/>
                    {r.region}
                  </span>
                  <span className="text-slate-400">{r.km.toLocaleString()} km</span>
                </div>
                <div className="bg-slate-700 rounded-full h-2">
                  <div className="rounded-full h-2 transition-all" style={{
                    width: `${(r.km / (regionPaved[0]?.km || 1)) * 100}%`,
                    background: REGION_NEON[r.region] ?? '#4d9fff',
                  }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Image Defect Analysis ── */}
      {defectSummary && (
        <div className="space-y-4">

          {/* Section header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Camera size={20} className="text-purple-400"/>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Image Defect Analysis</h2>
              <p className="text-[10px] text-slate-400">
                {defectSummary.images_processed.toLocaleString()} pavement images · {defectSummary.model}
              </p>
            </div>
          </div>

          {/* Charts row: frequency bar + severity donut */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Defect frequency bar chart */}
            <div className="bms-card">
              <div className="text-xs font-bold text-white mb-3">Defect Frequency</div>
              <Chart3DWrap>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={defectBarData}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" horizontal={false}/>
                    <XAxis type="number" tick={TICK} axisLine={false} tickLine={false}/>
                    <YAxis type="category" dataKey="name" tick={TICK} axisLine={false} tickLine={false} width={96}/>
                    <Tooltip
                      {...TT_NEON}
                      formatter={(v: number) => [v.toLocaleString(), 'Images']}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} animationDuration={900} shape={<Bar3D />}>
                      {defectBarData.map(d => (
                        <Cell key={d.name} fill={d.fill}/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Chart3DWrap>
            </div>

            {/* Severity donut */}
            <div className="bms-card flex flex-col">
              <div className="text-xs font-bold text-white mb-3">Severity Distribution</div>
              <div className="flex-1 flex flex-col items-center justify-center">
                <PieChart width={200} height={160}>
                  <Pie
                    data={severityPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                    animationDuration={900}
                  >
                    {severityPieData.map(s => (
                      <Cell key={s.name} fill={s.fill}/>
                    ))}
                  </Pie>
                  <Tooltip {...TT_NEON} formatter={(v: number) => [v.toLocaleString(), 'Images']}/>
                </PieChart>
                <div className="flex gap-4 mt-1">
                  {severityPieData.map(s => (
                    <div key={s.name} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.fill }}/>
                      <span className="text-[10px] text-slate-300">{s.name}</span>
                      <span className="text-[10px] font-bold text-white">{s.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Filter pills + photo grid */}
          <div className="bms-card">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Filter size={12} className="text-slate-400"/>
              {FILTER_PILLS.map(pill => (
                <button
                  key={pill.key}
                  onClick={() => setDefectFilter(pill.key)}
                  className="px-3 py-1 rounded-full text-[10px] font-semibold transition-all border"
                  style={{
                    background:   defectFilter === pill.key ? pill.color + '33' : 'rgba(30,41,59,0.8)',
                    borderColor:  defectFilter === pill.key ? pill.color       : 'rgba(148,163,184,0.15)',
                    color:        defectFilter === pill.key ? pill.color       : '#94a3b8',
                  }}
                >
                  {pill.label}
                  {defectFilter === pill.key && defectSummary && (
                    <span className="ml-1 opacity-70">
                      ({pill.key === 'all'
                        ? defectSummary.images_processed
                        : pill.key === 'crack'
                          ? (defectSummary.defect_distribution['alligator_crack'] ?? 0) +
                            (defectSummary.defect_distribution['longitudinal_crack'] ?? 0) +
                            (defectSummary.defect_distribution['transverse_crack'] ?? 0)
                          : defectSummary.defect_distribution[pill.key] ?? 0
                      })
                    </span>
                  )}
                </button>
              ))}
            </div>

            {filteredImages.length === 0 ? (
              <div className="text-center text-slate-500 py-8 text-xs">No images for this filter</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {filteredImages.map(img => {
                  const appPath = toAppPath(img.image_path);
                  const color   = DEFECT_COLOR[img.defect_type] ?? '#4d9fff';
                  const label   = DEFECT_LABEL[img.defect_type] ?? img.defect_type;
                  const pct     = Math.round(img.confidence * 100);
                  const errored = imgError.has(img.image_path);
                  return (
                    <div
                      key={img.image_path}
                      className="rounded-xl overflow-hidden bg-slate-800/60 border border-slate-700/40 group relative"
                    >
                      {/* Image */}
                      <div className="relative aspect-video bg-slate-900">
                        {errored ? (
                          <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                            <Camera size={20}/>
                          </div>
                        ) : (
                          <img
                            src={appPath}
                            alt={label}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={() => handleImgError(img.image_path)}
                            loading="lazy"
                          />
                        )}
                        {/* Defect badge */}
                        <span
                          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold leading-tight"
                          style={{ background: color + 'dd', color: '#fff' }}
                        >
                          {label}
                        </span>
                        {/* Severity badge */}
                        <span
                          className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-semibold leading-tight"
                          style={{
                            background: img.severity === 'High' ? '#ff2d78aa'
                              : img.severity === 'Medium' ? '#ffd23faa' : '#00ff88aa',
                            color: '#fff',
                          }}
                        >
                          {img.severity}
                        </span>
                      </div>

                      {/* Card footer */}
                      <div className="px-2 pt-1.5 pb-2">
                        <div className="text-[9px] text-slate-400 truncate">
                          {img.link_id ?? img.folder}
                        </div>
                        {/* Confidence gauge */}
                        <div className="mt-1 flex items-center gap-1.5">
                          <div className="flex-1 bg-slate-700 rounded-full h-1">
                            <div
                              className="h-1 rounded-full transition-all"
                              style={{ width: `${pct}%`, background: color }}
                            />
                          </div>
                          <span className="text-[8px] text-slate-400 w-6 text-right">{pct}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-3 text-[9px] text-slate-600">
              Showing top {filteredImages.length} of {
                defectFilter === 'all' ? pavementImages.length
                : pavementImages.filter(img => matchesFilter(img.defect_type, defectFilter)).length
              } images · Roads and media folders only
            </div>
          </div>

          {/* Top damaged links */}
          {defectSummary.top_damaged_links.length > 0 && (
            <div className="bms-card">
              <div className="text-xs font-bold text-white mb-3">Top Damaged Road Links</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {defectSummary.top_damaged_links.slice(0, 12).map(link => {
                  const color = DEFECT_COLOR[link.dominant_defect] ?? '#4d9fff';
                  return (
                    <div
                      key={link.link_id}
                      className="rounded-lg p-2.5 border"
                      style={{ background: color + '11', borderColor: color + '33' }}
                    >
                      <div className="text-[10px] font-bold text-white truncate">{link.link_id}</div>
                      <div className="text-[9px] mt-0.5" style={{ color }}>
                        {DEFECT_LABEL[link.dominant_defect] ?? link.dominant_defect}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[8px] text-slate-400">{link.image_count} images</span>
                        <span
                          className="text-[8px] font-semibold px-1 rounded"
                          style={{
                            background: link.avg_severity === 'High' ? '#ff2d7833'
                              : link.avg_severity === 'Medium' ? '#ffd23f33' : '#00ff8833',
                            color: link.avg_severity === 'High' ? '#ff2d78'
                              : link.avg_severity === 'Medium' ? '#ffd23f' : '#00ff88',
                          }}
                        >
                          {link.avg_severity}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Data note ── */}
      <div className="bms-card bg-slate-800/40 border-slate-700/50">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5"/>
          <div className="text-[10px] text-slate-400 leading-relaxed">
            <strong className="text-slate-300">Data sources:</strong> Paved stock timeline from the Uganda national roads inventory (2015–2023).
            Condition percentages from the national roads assessment survey, FY 2023/24.
            Network lengths from the MoWT National Road Network inventory (July 2025).
            IRI and rutting assessment records are available in the Road Condition Data archive
            for detailed link-level condition analysis.
          </div>
        </div>
      </div>
    </div>
  );
}
