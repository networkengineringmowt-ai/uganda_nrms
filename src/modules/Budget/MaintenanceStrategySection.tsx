import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { Wrench, Landmark, GitBranch, Milestone, ClipboardList, TrendingUp } from 'lucide-react';
import { Chart3DWrap, Bar3D, TT_NEON, TICK, NEON, hexRgb } from '../../lib/chart3d';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';

/* ── Neon palette (matches the platform-wide bright-neon theme) ─────────────── */
const C = {
  cyan: '#00f5ff', green: '#00ff88', yellow: '#ffd23f',
  orange: '#ff6b35', purple: '#b967ff', blue: '#4d9fff',
  pink: '#ff2d78', teal: '#00d4aa', red: '#ff3366',
};
const card = (a: string) => ({
  background: 'rgba(15,23,42,0.7)',
  border: `1px solid rgba(${hexRgb(a)},0.2)`,
  borderRadius: 12, padding: '18px 20px',
});
const CONDITION_COLOR: Record<string, string> = {
  Good: C.green, Excellent: C.green, 'Very Good': C.green,
  Satisfactory: C.cyan, Fair: C.cyan,
  Marginal: C.yellow,
  Poor: C.orange, 'Poor / Very Poor': C.orange, 'Very Poor': C.red,
  Critical: C.red,
};
function conditionColor(rating?: string | null) {
  return (rating && CONDITION_COLOR[rating]) || 'rgba(148,163,184,0.6)';
}
function ConditionPill({ value }: { value?: string | null }) {
  if (!value) return <span style={{ color: 'rgba(148,163,184,0.4)' }}>—</span>;
  const c = conditionColor(value);
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '2px 9px', borderRadius: 999,
      background: `rgba(${hexRgb(c)},0.12)`, border: `1px solid rgba(${hexRgb(c)},0.35)`, color: c,
    }}>{value}</span>
  );
}

const CT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(8,14,28,0.95)', border: '1px solid rgba(255,255,255,0.1)',
      padding: '8px 12px', borderRadius: 7, fontSize: 10 }}>
      <div style={{ color: '#94a3b8', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, fontWeight: 700 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </div>
      ))}
    </div>
  );
};

/* ── Dataset shape (public/data/maintenance_strategy.json) ──────────────────── */
interface AssetRow { fy: string; lengthKm: number | null; unitRateMnUsdPerKm: number | null; crcMnUsd: number | null; conditionFactor: number | null; cdrcMnUsd: number | null; }
interface StructureSummary { count: number; assetValueMnUsd: number; crcMnUsd: number; pavedCount: number; unpavedCount: number; }
interface ConditionDistRow { rating: string; count: number; pct: number; }
interface Bridge { bridgeNumber: string; coordinates: { e: number | null; s: number | null }; dateModified: string | null; bridgeName: string | null; typeCrossing: string | null; roadNumberPrincipal: string | null; condition: string | null; remarks: string | null; }
interface Culvert { culvertNumber: string; condition: string | null; dateModified: string | null; sectionOrLinkNo: string | null; river: string | null; road: string | null; coordinates: { e: number | null; s: number | null }; }
interface InterventionRate { surface: string; intervention: string; rateBasis: string | null; rateBnUgxPerKm: number | null; rateUsdPerKm: number | null; note: string | null; }
interface AnnualPlanRow { fy: string; links: number | null; programmeCostBnUgx: number | null; assetValueAtRiskBnUgx: number | null; fundingGapBnUgx: number | null; }
interface InterventionMixRow { intervention: string; links: number | null; lengthKm: number | null; costBnUgx: number | null; }
interface PriorityLink { rank: number; linkId: string; linkName: string | null; region: string | null; lengthKm: number | null; intervention: string | null; scheduledFy: string | null; costBnUgx: number | null; priorityBand: string | null; }
interface PavedConditionRow { roadNo: string; roadName: string | null; lengthKm: number | null; ageYears: number | null; vciPct: number | null; vciRating: string | null; }

interface MaintenanceStrategyDataset {
  source: { documents: string[]; publisher: string; retrievedDate: string; scopeNote: string };
  networkOverview: Record<string, number>;
  assetValues: { currency: string; paved: AssetRow[]; unpaved: AssetRow[]; totalAssetValueByFY: { fy: string; totalAssetValueMnUsd: number }[] };
  structuresSummary: { bridges: StructureSummary; majorCulverts: StructureSummary };
  bridgeConditionDistribution: ConditionDistRow[];
  culvertConditionDistribution: ConditionDistRow[];
  bridges: Bridge[];
  majorCulverts: Culvert[];
  interventionRates: { currency: string; rates: InterventionRate[] };
  fiveYearInvestmentPlan: { currency: string; period: string; annual: AnnualPlanRow[]; interventionMix: InterventionMixRow[]; topPriorityLinks: PriorityLink[] };
  pavedRoadCondition: PavedConditionRow[];
  pavedConditionDistributionFY2025: { rating: string; pctOfAssessedNetwork: number; km: number }[];
  unpavedConditionDistribution: { rating: string; pct2024: number; pct2025: number }[];
  strategyNarrative: Record<string, string | null>;
}

const TABS = [
  { id: 'overview',   label: 'Strategy Overview', icon: <TrendingUp size={13}/> },
  { id: 'assets',     label: 'Asset Values', icon: <Landmark size={13}/> },
  { id: 'bridges',    label: 'Bridges', icon: <GitBranch size={13}/> },
  { id: 'culverts',   label: 'Major Culverts', icon: <Milestone size={13}/> },
  { id: 'rates',      label: 'Intervention Rates', icon: <Wrench size={13}/> },
  { id: 'investment', label: '5-Year Investment Plan', icon: <ClipboardList size={13}/> },
  { id: 'condition',  label: 'Paved Road Condition', icon: <TrendingUp size={13}/> },
] as const;
type TabId = typeof TABS[number]['id'];

export default function MaintenanceStrategySection() {
  const [data, setData] = useState<MaintenanceStrategyDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('overview');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/maintenance_strategy.json`)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(setData)
      .catch(() => setError('Maintenance strategy dataset could not be loaded.'));
  }, []);

  // Hooks must run unconditionally on every render (including while data is
  // still loading/errored) - a previous version called useMemo AFTER the
  // early returns below, which changed the hook count between renders and
  // crashed the whole app with React error #310 once the data fetch started
  // succeeding. Keep every hook above any conditional return.
  const assetSeries = useMemo(() => {
    if (!data) return [];
    const byFy: Record<string, any> = {};
    data.assetValues.paved.forEach(r => { byFy[r.fy] = { ...(byFy[r.fy] || {}), fy: r.fy, pavedCdrc: r.cdrcMnUsd }; });
    data.assetValues.unpaved.forEach(r => { byFy[r.fy] = { ...(byFy[r.fy] || {}), fy: r.fy, unpavedCdrc: r.cdrcMnUsd }; });
    return Object.values(byFy);
  }, [data]);

  if (error) return <div style={{ padding: 20, color: C.orange, fontSize: 12 }}>{error}</div>;
  if (!data) return <div style={{ padding: 20, color: 'rgba(148,163,184,0.6)', fontSize: 12 }}>Loading maintenance strategy data…</div>;

  const no = data.networkOverview;
  const bridgeRows = data.bridges.map(b => ({ ...b, e: b.coordinates.e, s: b.coordinates.s }));
  const culvertRows = data.majorCulverts.map(c => ({ ...c, e: c.coordinates.e, s: c.coordinates.s }));

  const bridgeCols: STColumn<typeof bridgeRows[number]>[] = [
    { key: 'bridgeNumber', label: 'Bridge No.' },
    { key: 'bridgeName', label: 'Bridge Name' },
    { key: 'roadNumberPrincipal', label: 'Road / Link' },
    { key: 'typeCrossing', label: 'Type of Crossing' },
    { key: 'condition', label: 'Condition', render: r => <ConditionPill value={r.condition} /> },
    { key: 'dateModified', label: 'Last Inspected', date: true },
    { key: 'remarks', label: 'Remarks' },
  ];
  const culvertCols: STColumn<typeof culvertRows[number]>[] = [
    { key: 'culvertNumber', label: 'Culvert No.' },
    { key: 'road', label: 'Road' },
    { key: 'river', label: 'River' },
    { key: 'sectionOrLinkNo', label: 'Section / Link' },
    { key: 'condition', label: 'Condition', render: r => <ConditionPill value={r.condition} /> },
    { key: 'dateModified', label: 'Last Inspected', date: true },
  ];
  const rateCols: STColumn<InterventionRate>[] = [
    { key: 'surface', label: 'Surface' },
    { key: 'intervention', label: 'Intervention' },
    { key: 'rateBnUgxPerKm', label: 'Rate (UGX bn/km)', numeric: true },
    { key: 'rateUsdPerKm', label: 'Rate (USD/km)', numeric: true },
    { key: 'rateBasis', label: 'Basis' },
  ];
  const priorityCols: STColumn<PriorityLink>[] = [
    { key: 'rank', label: 'Rank', numeric: true },
    { key: 'linkId', label: 'Link ID' },
    { key: 'linkName', label: 'Link Name' },
    { key: 'region', label: 'Region' },
    { key: 'lengthKm', label: 'Length (km)', numeric: true },
    { key: 'intervention', label: 'Intervention' },
    { key: 'scheduledFy', label: 'Scheduled FY' },
    { key: 'costBnUgx', label: 'Cost (UGX bn)', numeric: true },
    { key: 'priorityBand', label: 'Priority', render: r => <ConditionPill value={r.priorityBand?.replace('Priority ', 'P')} /> },
  ];
  const conditionCols: STColumn<PavedConditionRow>[] = [
    { key: 'roadNo', label: 'Road No.' },
    { key: 'roadName', label: 'Road Name' },
    { key: 'lengthKm', label: 'Length (km)', numeric: true },
    { key: 'ageYears', label: 'Age (yrs)', numeric: true },
    { key: 'vciPct', label: 'VCI (%)', numeric: true },
    { key: 'vciRating', label: 'VCI Rating', render: r => <ConditionPill value={r.vciRating} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ padding: '8px 14px', flex: 1 }}>
        {/* Definition card */}
        <div style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: 14, padding: '14px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg, rgba(0,255,136,0.2), rgba(0,212,170,0.1))', border: '1px solid rgba(0,255,136,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wrench size={20} style={{ color: C.green }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#e2eaf4', marginBottom: 5 }}>Maintenance Strategy for Roads &amp; Bridges</div>
              <div style={{ fontSize: 11, color: 'rgba(203,213,225,0.8)', lineHeight: 1.6 }}>
                {data.source.scopeNote}
              </div>
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {['MoWT National Roads Dept', 'Asset Values 2026', 'Bridge & Culvert Condition Survey 2026', '5-Year Investment Plan', `Retrieved ${data.source.retrievedDate}`].map(tag => (
                  <span key={tag} style={{ fontSize: 8, padding: '2px 8px', borderRadius: 4, fontWeight: 700, background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.25)', color: C.green }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* KPI tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Total Network', value: `${no.totalNetworkKm?.toLocaleString()} km`, color: C.blue, tip: `${no.pavedKm?.toLocaleString()} km paved, ${no.unpavedKm?.toLocaleString()} km unpaved` },
            { label: 'Current Asset Value', value: `US$ ${(no.currentAssetValueMnUsdJul2024 / 1000).toFixed(1)}Bn`, color: C.green, tip: 'Depreciated replacement cost, July 2024' },
            { label: 'Bridges', value: `${data.structuresSummary.bridges.count}`, color: C.cyan, tip: `${data.structuresSummary.bridges.pavedCount} on paved, ${data.structuresSummary.bridges.unpavedCount} on unpaved roads — reported separately from culverts` },
            { label: 'Major Culverts', value: `${data.structuresSummary.majorCulverts.count}`, color: C.purple, tip: `${data.structuresSummary.majorCulverts.pavedCount} on paved, ${data.structuresSummary.majorCulverts.unpavedCount} on unpaved roads — reported separately from bridges` },
            { label: '5-Yr Investment Need', value: `UGX ${data.fiveYearInvestmentPlan.annual.find(a => a.fy === 'Total / Avg')?.programmeCostBnUgx?.toLocaleString()}Bn`, color: C.pink, tip: `${data.fiveYearInvestmentPlan.period}` },
          ].map(k => (
            <div key={k.label} title={k.tip} style={{ background: `rgba(${hexRgb(k.color)},0.06)`, border: `1px solid rgba(${hexRgb(k.color)},0.2)`, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(148,163,184,0.5)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.09em' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 2, marginBottom: 10, flexShrink: 0, flexWrap: 'wrap',
          borderBottom: '1px solid rgba(0,255,136,0.15)',
          background: 'rgba(4,9,18,0.85)', marginLeft: -14, marginRight: -14, paddingLeft: 14,
        }}>
          {TABS.map(t => {
            const isA = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 14px 11px', fontSize: 11, fontWeight: isA ? 800 : 500,
                background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
                color: isA ? C.green : 'rgba(148,163,184,0.70)',
                borderBottom: isA ? `2px solid ${C.green}` : '2px solid transparent',
                transition: 'all 0.13s',
              }}>{t.icon}{t.label}</button>
            );
          })}
        </div>

        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={card(C.green)}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                Road Asset Depreciated Value (CDRC), Paved vs Unpaved (US$ Mn)
              </div>
              <Chart3DWrap>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={assetSeries} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3"/>
                    <XAxis dataKey="fy" tick={{ ...TICK, fontSize: 9 }}/>
                    <YAxis tick={TICK} label={{ value: 'US$ Mn', angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: 'rgba(148,163,184,0.5)' } }}/>
                    <Tooltip content={<CT/>}/>
                    <Legend wrapperStyle={{ fontSize: 10, color: 'rgba(148,163,184,0.7)' }}/>
                    <Bar dataKey="pavedCdrc" name="Paved" fill={C.cyan} radius={[4,4,0,0]} shape={<Bar3D/>}/>
                    <Bar dataKey="unpavedCdrc" name="Unpaved" fill={C.orange} radius={[4,4,0,0]} shape={<Bar3D/>}/>
                  </BarChart>
                </ResponsiveContainer>
              </Chart3DWrap>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={card(C.blue)}>
                <div style={{ fontSize: 11, fontWeight: 900, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                  Paved Road Condition, FY2025/26 (% of Assessed Network)
                </div>
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={data.pavedConditionDistributionFY2025} dataKey="pctOfAssessedNetwork" nameKey="rating" outerRadius={85} label={(e: any) => `${e.rating} ${e.pctOfAssessedNetwork}%`}>
                      {data.pavedConditionDistributionFY2025.map((d, i) => <Cell key={d.rating} fill={conditionColor(d.rating) !== 'rgba(148,163,184,0.6)' ? conditionColor(d.rating) : NEON[i % NEON.length]} />)}
                    </Pie>
                    <Tooltip {...TT_NEON}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={card(C.purple)}>
                <div style={{ fontSize: 11, fontWeight: 900, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                  Unpaved Road Condition — 2024 vs 2025 (%)
                </div>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={data.unpavedConditionDistribution} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3"/>
                    <XAxis dataKey="rating" tick={{ ...TICK, fontSize: 9 }}/>
                    <YAxis tick={TICK}/>
                    <Tooltip content={<CT/>}/>
                    <Legend wrapperStyle={{ fontSize: 10, color: 'rgba(148,163,184,0.7)' }}/>
                    <Bar dataKey="pct2024" name="2024" fill={C.yellow} radius={[4,4,0,0]} shape={<Bar3D/>}/>
                    <Bar dataKey="pct2025" name="2025" fill={C.pink} radius={[4,4,0,0]} shape={<Bar3D/>}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {[
              ['Introduction', data.strategyNarrative.introduction],
              ['Paved Road Condition Assessment', data.strategyNarrative.pavedConditionAssessment],
              ['Unpaved Road Condition Assessment', data.strategyNarrative.unpavedConditionAssessment],
              ['Strategy', data.strategyNarrative.strategyApproach],
              ['Budget for Adequate Maintenance', data.strategyNarrative.budgetForAdequateMaintenance],
            ].map(([title, text]) => text ? (
              <div key={title as string} style={card(C.teal)}>
                <div style={{ fontSize: 11, fontWeight: 900, color: C.teal, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>{title}</div>
                <div style={{ fontSize: 11.5, color: 'rgba(203,213,225,0.85)', lineHeight: 1.75, whiteSpace: 'pre-line' }}>{text}</div>
              </div>
            ) : null)}
          </div>
        )}

        {tab === 'assets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={card(C.green)}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                Total Road Network Asset Value by Financial Year (US$ Mn)
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.assetValues.totalAssetValueByFY} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3"/>
                  <XAxis dataKey="fy" tick={{ ...TICK, fontSize: 9 }}/>
                  <YAxis tick={TICK}/>
                  <Tooltip content={<CT/>}/>
                  <Area type="monotone" dataKey="totalAssetValueMnUsd" name="Total Asset Value" stroke={C.green} fill={`rgba(${hexRgb(C.green)},0.18)`} strokeWidth={2.5}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={card(C.cyan)}>
                <div style={{ fontSize: 11, fontWeight: 900, color: C.cyan, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Paved Roads — Asset Value Series (US$ Mn)</div>
                <SortableFilterableTable
                  accent={C.cyan}
                  exportName="paved-asset-values"
                  columns={[
                    { key: 'fy', label: 'FY' }, { key: 'lengthKm', label: 'Length (km)', numeric: true },
                    { key: 'crcMnUsd', label: 'CRC (US$ Mn)', numeric: true }, { key: 'cdrcMnUsd', label: 'Asset Value / CDRC (US$ Mn)', numeric: true },
                  ] as STColumn<AssetRow>[]}
                  rows={data.assetValues.paved}
                />
              </div>
              <div style={card(C.orange)}>
                <div style={{ fontSize: 11, fontWeight: 900, color: C.orange, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Unpaved Roads — Asset Value Series (US$ Mn)</div>
                <SortableFilterableTable
                  accent={C.orange}
                  exportName="unpaved-asset-values"
                  columns={[
                    { key: 'fy', label: 'FY' }, { key: 'lengthKm', label: 'Length (km)', numeric: true },
                    { key: 'crcMnUsd', label: 'CRC (US$ Mn)', numeric: true }, { key: 'cdrcMnUsd', label: 'Asset Value / CDRC (US$ Mn)', numeric: true },
                  ] as STColumn<AssetRow>[]}
                  rows={data.assetValues.unpaved}
                />
              </div>
            </div>
          </div>
        )}

        {/* Bridges and Major Culverts are always kept on separate tabs with separate
            tables/charts/totals — never merged into one figure or one table. */}
        {tab === 'bridges' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
              <div style={card(C.cyan)}>
                <div style={{ fontSize: 11, fontWeight: 900, color: C.cyan, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Bridge Condition Distribution</div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data.bridgeConditionDistribution.filter(d => d.rating !== 'Total')} dataKey="count" nameKey="rating" outerRadius={78} label={(e: any) => `${e.rating} ${e.count}`}>
                      {data.bridgeConditionDistribution.filter(d => d.rating !== 'Total').map(d => <Cell key={d.rating} fill={conditionColor(d.rating)} />)}
                    </Pie>
                    <Tooltip {...TT_NEON}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={card(C.cyan)}>
                <div style={{ fontSize: 11, fontWeight: 900, color: C.cyan, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                  Bridge Stock — {data.structuresSummary.bridges.count} Structures (US$ {data.structuresSummary.bridges.assetValueMnUsd}Mn asset value)
                </div>
                <div style={{ fontSize: 11, color: 'rgba(203,213,225,0.8)', lineHeight: 1.8 }}>
                  {data.structuresSummary.bridges.pavedCount} on paved roads · {data.structuresSummary.bridges.unpavedCount} on unpaved roads.
                  Reported here as a figure and table separate from major culverts, per standing convention.
                </div>
              </div>
            </div>
            <div style={card(C.cyan)}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.cyan, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Bridge Register ({bridgeRows.length})</div>
              <SortableFilterableTable accent={C.cyan} exportName="bridge-register" columns={bridgeCols} rows={bridgeRows}/>
            </div>
          </div>
        )}

        {tab === 'culverts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
              <div style={card(C.purple)}>
                <div style={{ fontSize: 11, fontWeight: 900, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Major Culvert Condition Distribution</div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data.culvertConditionDistribution.filter(d => d.rating !== 'Total')} dataKey="count" nameKey="rating" outerRadius={78} label={(e: any) => `${e.rating} ${e.count}`}>
                      {data.culvertConditionDistribution.filter(d => d.rating !== 'Total').map(d => <Cell key={d.rating} fill={conditionColor(d.rating)} />)}
                    </Pie>
                    <Tooltip {...TT_NEON}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={card(C.purple)}>
                <div style={{ fontSize: 11, fontWeight: 900, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                  Major Culvert Stock — {data.structuresSummary.majorCulverts.count} Structures (US$ {data.structuresSummary.majorCulverts.assetValueMnUsd}Mn asset value)
                </div>
                <div style={{ fontSize: 11, color: 'rgba(203,213,225,0.8)', lineHeight: 1.8 }}>
                  {data.structuresSummary.majorCulverts.pavedCount} on paved roads · {data.structuresSummary.majorCulverts.unpavedCount} on unpaved roads.
                  Reported here as a figure and table separate from bridges, per standing convention.
                </div>
              </div>
            </div>
            <div style={card(C.purple)}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Major Culvert Register ({culvertRows.length})</div>
              <SortableFilterableTable accent={C.purple} exportName="major-culvert-register" columns={culvertCols} rows={culvertRows}/>
            </div>
          </div>
        )}

        {tab === 'rates' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={card(C.yellow)}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.yellow, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                Maintenance Intervention Unit Rates by Surface Type
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.interventionRates.rates} margin={{ top: 8, right: 12, left: 0, bottom: 60 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3"/>
                  <XAxis dataKey="intervention" tick={{ ...TICK, fontSize: 8 }} angle={-30} textAnchor="end" interval={0}/>
                  <YAxis tick={TICK} label={{ value: 'UGX bn/km', angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: 'rgba(148,163,184,0.5)' } }}/>
                  <Tooltip content={<CT/>}/>
                  <Legend wrapperStyle={{ fontSize: 10, color: 'rgba(148,163,184,0.7)' }}/>
                  <Bar dataKey="rateBnUgxPerKm" name="Rate (UGX bn/km)" fill={C.yellow} radius={[4,4,0,0]} shape={<Bar3D/>}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={card(C.yellow)}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.yellow, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Intervention Rate Schedule</div>
              <SortableFilterableTable accent={C.yellow} exportName="maintenance-intervention-rates" columns={rateCols} rows={data.interventionRates.rates}/>
            </div>
          </div>
        )}

        {tab === 'investment' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={card(C.pink)}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.pink, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                5-Year Investment Plan, {data.fiveYearInvestmentPlan.period} (UGX Bn)
              </div>
              <Chart3DWrap>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.fiveYearInvestmentPlan.annual.filter(a => a.fy !== 'Total / Avg')} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3"/>
                    <XAxis dataKey="fy" tick={{ ...TICK, fontSize: 9 }}/>
                    <YAxis tick={TICK} label={{ value: 'UGX Bn', angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: 'rgba(148,163,184,0.5)' } }}/>
                    <Tooltip content={<CT/>}/>
                    <Legend wrapperStyle={{ fontSize: 10, color: 'rgba(148,163,184,0.7)' }}/>
                    <Bar dataKey="programmeCostBnUgx" name="Programme Cost" fill={C.pink} radius={[4,4,0,0]} shape={<Bar3D/>}/>
                    <Bar dataKey="fundingGapBnUgx" name="Funding Gap vs Baseline" fill={C.red} radius={[4,4,0,0]} shape={<Bar3D/>}/>
                  </BarChart>
                </ResponsiveContainer>
              </Chart3DWrap>
            </div>
            <div style={card(C.blue)}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                Intervention Mix — Links, Length &amp; Cost (5-Year Programme)
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.fiveYearInvestmentPlan.interventionMix} margin={{ top: 8, right: 12, left: 0, bottom: 60 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3"/>
                  <XAxis dataKey="intervention" tick={{ ...TICK, fontSize: 8 }} angle={-30} textAnchor="end" interval={0}/>
                  <YAxis tick={TICK}/>
                  <Tooltip content={<CT/>}/>
                  <Legend wrapperStyle={{ fontSize: 10, color: 'rgba(148,163,184,0.7)' }}/>
                  <Bar dataKey="lengthKm" name="Length (km)" fill={C.blue} radius={[4,4,0,0]} shape={<Bar3D/>}/>
                  <Bar dataKey="costBnUgx" name="Cost (UGX bn)" fill={C.teal} radius={[4,4,0,0]} shape={<Bar3D/>}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={card(C.pink)}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.pink, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Top Priority Links for FY26/27</div>
              <SortableFilterableTable accent={C.pink} exportName="top-priority-links" columns={priorityCols} rows={data.fiveYearInvestmentPlan.topPriorityLinks}/>
            </div>
          </div>
        )}

        {tab === 'condition' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={card(C.teal)}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.teal, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                Paved Road VCI Condition Register ({data.pavedRoadCondition.length} roads)
              </div>
              <SortableFilterableTable accent={C.teal} exportName="paved-road-vci-condition" columns={conditionCols} rows={data.pavedRoadCondition}/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
