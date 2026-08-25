/**
 * StructuresOverviewDashboard - RMS "Dashboard" tab, Structures & Bridges view.
 * Port of public/dashboard.html Tab 4 (STRUCTURES & BRIDGES, charts c46–c60) into
 * live React/Recharts, extended to 21 chart tiles. Real structures-inventory
 * figures straight from the mockup's shared `D` data model (546 structures,
 * 312 bridges, 142 box culverts, condition/material/span/age breakdowns, the
 * bridge location scatter, the deficiency and repair-cost data, and the
 * inspection funnel/trend). No tables here - tabular breakdowns live under
 * Exhaustive Tables / Deep Analytics.
 */
import {
  DASH_C, REGION_COLORS, DASHBOARD_COND_COLORS, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  DonutChart, PieChartTile, BarV, BarH, LineMulti, ScatterBubble, HeatGrid, TreemapC, GaugeC,
  FunnelC, RadarTile, BoxPlotApprox, WaterfallC,
} from '../../../shared/dashboardKit';

// ─── Data model (matches public/dashboard.html's shared `D` - STRUCTURES block) ─
const TOTAL_STRUCT = 546;
const STR_TYPE = [312, 142, 68, 24];
const STR_TYPE_LBL = ['Bridges', 'Box Culverts', 'Culverts', 'Drifts/Causeway'];
const STR_TYPE_COLORS = ['#00f5ff', '#00aacc', '#006688', '#003344'];

const STR_COND = [197, 164, 131, 54];
const COND_LBL = ['Good', 'Fair', 'Poor', 'Critical'];

const STR_MAT = [286, 134, 76, 38, 12];
const STR_MAT_LBL = ['Concrete', 'Steel', 'Composite', 'Masonry', 'Timber'];

const STR_SPAN = [183, 164, 126, 57, 16];
const STR_SPAN_LBL = ['<10m', '10-20m', '20-50m', '50-100m', '>100m'];

const STR_AGE = [84, 128, 156, 112, 66];
const STR_AGE_LBL = ['<10yr', '10-20yr', '20-30yr', '30-50yr', '>50yr'];

// region × condition (Good, Fair, Poor, Critical) - sums to 546, critical column sums to 54
const REG_LBL = ['Central', 'Northern', 'Eastern', 'Western', 'Southern', 'North Eastern'];
const STR_REG_COND = [
  [44, 36, 28, 12], [30, 24, 22, 6], [52, 40, 32, 14],
  [41, 38, 27, 12], [20, 16, 14, 6], [10, 10, 8, 4],
];

// Condition score for a 25-bridge sample - coordinates were dropped from this tile
// (coords belong on maps only, never charts); ranked by score instead.
const B_SCORE = [82, 75, 90, 68, 55, 45, 72, 38, 62, 70, 84, 76, 65, 52, 30, 88, 71, 60, 48, 55, 78, 42, 66, 80, 58];
const BRIDGE_SCORE_RANKED = [...B_SCORE].sort((a, b) => b - a).map((score, i) => ({ x: i + 1, y: score, z: score }));

// Repair cost vs condition score (11 points)
const R_COND = [20, 25, 30, 38, 45, 55, 62, 68, 75, 82, 88];
const R_COST = [4800, 3600, 2800, 2200, 1600, 1100, 780, 560, 380, 220, 80];
const REPAIR_VS_COND = R_COND.map((c, i) => ({ x: c, y: R_COST[i] }));

// Deficiency types
const DEFICIENCY_LBL = ['Deck Deterioration', 'Scour/Foundation', 'Expansion Joint', 'Bearing Damage', 'Railing/Parapet', 'Approach Slab', 'Abutment Crack', 'Soffit Crack'];
const DEFICIENCY_COUNT = [142, 84, 128, 96, 180, 72, 56, 64];

// Inspection funnel & trend
const INSPECTION_FUNNEL = [
  { name: 'Total Registered', value: 546 }, { name: 'Principal Insp.', value: 420 },
  { name: 'Routine Insp.', value: 380 }, { name: 'Good Condition', value: 197 },
  { name: 'Maintenance Due', value: 185 }, { name: 'Needs Urgent Works', value: 54 },
];
const TREND_YRS = [2021, 2022, 2023, 2024, 2025];
const INSPECTED_PCT = [74, 79, 84, 87, 89];
const OVERDUE_PCT = [26, 21, 16, 13, 11];

// Span length distribution by structure type (raw sample spans, m)
const BRIDGE_SPANS = [15, 22, 28, 34, 42, 55, 68, 82, 96, 124, 180, 240];
const BOX_CULVERT_SPANS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
const CULVERT_SPANS = [1, 1.2, 1.5, 1.8, 2, 2.4, 3, 3.5];

function quartiles(vals: number[], name: string, color: string) {
  const s = [...vals].sort((a, b) => a - b);
  const q = (p: number) => {
    const idx = p * (s.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
  };
  return { name, min: s[0], q1: q(0.25), median: q(0.5), q3: q(0.75), max: s[s.length - 1], color };
}

// Bridge condition surface: age × span class (deterministic derivation of the mockup's formula)
const AGE_SPAN_COND = STR_AGE_LBL.map((_, i) =>
  STR_SPAN_LBL.map((_, j) => Math.min(100, Math.max(10, 90 - i * 15 - j * 5 + ((i + j) % 4) * 3)))
);

// Condition mix by region (Good %, Critical % of each region's structures)
const REGION_COND_MIX = REG_LBL.map((r, i) => {
  const total = STR_REG_COND[i].reduce((a, b) => a + b, 0);
  return { axis: r, goodPct: Math.round((STR_REG_COND[i][0] / total) * 100), criticalPct: Math.round((STR_REG_COND[i][3] / total) * 100) };
});

// Critical structures by region (column 3 of STR_REG_COND - sums to the 54 KPI figure)
const CRITICAL_BY_REGION = REG_LBL.map((r, i) => ({ region: r, count: STR_REG_COND[i][3] }));

export default function StructuresOverviewDashboard() {
  return (
    <div>
      <KpiStrip>
        <StatMini value={`${TOTAL_STRUCT}`} label="Structures (Nat. Roads)" color={DASH_C.purple} />
        <StatMini value={`${Math.round((STR_COND[0] / TOTAL_STRUCT) * 100)}%`} label="Good Condition" color={DASH_C.green} />
        <StatMini value={`${STR_COND[3]}`} label="Critical Structures" color="#ef4444" />
        <StatMini value="312" label="Bridges" color={DASH_C.cyan} />
        <StatMini value="142" label="Box Culverts" color={DASH_C.yellow} />
        <StatMini value="36 m" label="Avg Bridge Span" color={DASH_C.orange} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.purple}>Structures & Bridge Management · 21 Views</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="Structures by Type" subtitle={`${TOTAL_STRUCT} total`} accent={DASH_C.cyan} height={210}>
          <DonutChart data={STR_TYPE_LBL.map((n, i) => ({ name: n, value: STR_TYPE[i], color: STR_TYPE_COLORS[i] }))} />
        </ChartBox>
        <ChartBox title="Structure Condition Distribution" accent={DASH_C.green} height={210}>
          <DonutChart data={COND_LBL.map((n, i) => ({ name: n, value: STR_COND[i], color: DASHBOARD_COND_COLORS[i] }))} />
        </ChartBox>
        <ChartBox title="Structures by Material" accent={DASH_C.blue} height={210}>
          <BarV data={STR_MAT_LBL.map((n, i) => ({ name: n, count: STR_MAT[i] }))} xKey="name" series={[{ key: 'count', name: 'Count', color: DASH_C.blue }]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="12">
        <ChartBox title="Bridge Condition Score" subtitle="25 sampled bridges, ranked - size=score" accent={DASH_C.purple} height={260}>
          <ScatterBubble data={BRIDGE_SCORE_RANKED} xLabel="Rank" yLabel="Condition Score" color={DASH_C.purple} />
        </ChartBox>
        <ChartBox title="Structure Condition by Region" accent={DASH_C.teal} height={260}>
          <HeatGrid matrix={STR_REG_COND} xLabels={COND_LBL} yLabels={REG_LBL} accent={DASH_C.teal} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="Bridges by Span Class" accent={DASH_C.teal} height={190}>
          <BarV data={STR_SPAN_LBL.map((n, i) => ({ name: n, count: STR_SPAN[i] }))} xKey="name" series={[{ key: 'count', name: 'Count', color: DASH_C.teal }]} />
        </ChartBox>
        <ChartBox title="Bridges by Age Class" accent={DASH_C.yellow} height={190}>
          <BarV data={STR_AGE_LBL.map((n, i) => ({ name: n, count: STR_AGE[i] }))} xKey="name" series={[{ key: 'count', name: 'Count', color: DASH_C.yellow }]} />
        </ChartBox>
        <ChartBox title="Inspection Currency" subtitle="inspected < 12 months" accent={DASH_C.green} height={190}>
          <GaugeC value={89} target={70} color={DASH_C.green} label="vs. 70% threshold" />
        </ChartBox>
        <ChartBox title="Structure Inspection Funnel" accent={DASH_C.cyan} height={190}>
          <FunnelC data={INSPECTION_FUNNEL} colors={[DASH_C.cyan, '#00ccdd', '#00aacc', DASH_C.green, DASH_C.yellow, DASH_C.pink]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Structure Deficiency Types" accent={DASH_C.pink} height={220}>
          <BarH data={DEFICIENCY_LBL.map((n, i) => ({ name: n, count: DEFICIENCY_COUNT[i] }))} yKey="name" series={[{ key: 'count', name: 'Count', color: DASH_C.pink }]} />
        </ChartBox>
        <ChartBox title="Repair Cost vs Condition Score" subtitle="mn UGX per structure" accent={DASH_C.orange} height={220}>
          <ScatterBubble data={REPAIR_VS_COND} xLabel="Condition Score" yLabel="Repair Cost (mn UGX)" color={DASH_C.orange} />
        </ChartBox>
        <ChartBox title="Bridge Condition · Age × Span" accent={DASH_C.cyan} height={220}>
          <HeatGrid matrix={AGE_SPAN_COND} xLabels={STR_SPAN_LBL} yLabels={STR_AGE_LBL} accent={DASH_C.cyan} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Span Length Distribution by Type" subtitle="metres" accent={DASH_C.cyan} height={210}>
          <BoxPlotApprox data={[
            quartiles(BRIDGE_SPANS, 'Bridges', DASH_C.cyan),
            quartiles(BOX_CULVERT_SPANS, 'Box Culverts', DASH_C.yellow),
            quartiles(CULVERT_SPANS, 'Culverts', DASH_C.orange),
          ]} unit="m" />
        </ChartBox>
        <ChartBox title="Structure Condition by Region" subtitle="stacked" accent={DASH_C.green} height={210}>
          <BarV data={REG_LBL.map((r, i) => ({ name: r, Good: STR_REG_COND[i][0], Fair: STR_REG_COND[i][1], Poor: STR_REG_COND[i][2], Critical: STR_REG_COND[i][3] }))}
            xKey="name" series={[
              { key: 'Good', name: 'Good', color: DASHBOARD_COND_COLORS[0] }, { key: 'Fair', name: 'Fair', color: DASHBOARD_COND_COLORS[1] },
              { key: 'Poor', name: 'Poor', color: DASHBOARD_COND_COLORS[2] }, { key: 'Critical', name: 'Critical', color: DASHBOARD_COND_COLORS[3] },
            ]} stacked />
        </ChartBox>
        <ChartBox title="Inspection Currency 2021–2025" accent={DASH_C.green} height={210}>
          <LineMulti data={TREND_YRS.map((y, i) => ({ year: y, Inspected: INSPECTED_PCT[i], Overdue: OVERDUE_PCT[i] }))} xKey="year"
            series={[{ key: 'Inspected', name: 'Inspected <12mth %', color: '#22c55e' }, { key: 'Overdue', name: 'Overdue %', color: '#ef4444' }]} area unit="%" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Structure Portfolio by Type" subtitle="treemap, sized by count" accent={DASH_C.purple} height={200}>
          <TreemapC data={STR_TYPE_LBL.map((n, i) => ({ name: n, size: STR_TYPE[i] }))} colors={REGION_COLORS} />
        </ChartBox>
        <ChartBox title="Condition Mix by Region" subtitle="good % vs critical %" accent={DASH_C.teal} height={200}>
          <RadarTile data={REGION_COND_MIX} series={[{ key: 'goodPct', name: 'Good %', color: '#22c55e' }, { key: 'criticalPct', name: 'Critical %', color: '#ef4444' }]} maxValue={100} />
        </ChartBox>
        <ChartBox title="Structure Portfolio Breakdown" subtitle="waterfall, count" accent={DASH_C.blue} height={200}>
          <WaterfallC steps={[
            { name: 'Total', delta: TOTAL_STRUCT, isTotal: true }, { name: '−Box Culverts', delta: -STR_TYPE[1] },
            { name: '−Culverts', delta: -STR_TYPE[2] }, { name: '−Drifts/Causeway', delta: -STR_TYPE[3] },
            { name: '=Bridges', delta: STR_TYPE[0], isTotal: true },
          ]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Good Condition Coverage" subtitle="target 50% by FY27" accent={DASH_C.green} height={190}>
          <GaugeC value={Math.round((STR_COND[0] / TOTAL_STRUCT) * 100)} target={50} color={DASH_C.green} />
        </ChartBox>
        <ChartBox title="Inspection Pipeline Status" accent={DASH_C.cyan} height={190}>
          <PieChartTile data={[
            { name: 'Principal Inspected', value: 420, color: DASH_C.cyan },
            { name: 'Not Yet Inspected', value: TOTAL_STRUCT - 420, color: DASH_C.pink },
          ]} />
        </ChartBox>
        <ChartBox title="Critical Structures by Region" accent="#ef4444" height={190}>
          <BarH data={CRITICAL_BY_REGION} yKey="region" series={[{ key: 'count', name: 'Critical', color: '#ef4444' }]} />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
