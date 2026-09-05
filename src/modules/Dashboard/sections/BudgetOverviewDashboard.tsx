/**
 * BudgetOverviewDashboard - RMS "Dashboard" tab, Budget & Finance view.
 * Port of public/dashboard.html Tab 5 (BUDGET & FINANCE, charts c61–c74) into
 * live React/Recharts, extended to 23 chart tiles. Real FY25/26 budget figures
 * (matches the platform's official 1,842bn UGX allocation) plus a handful of
 * straightforward derivations (regional backlog split, utilisation trend,
 * approval pipeline) clearly noted in their subtitles. No tables here -
 * tabular breakdowns live under Exhaustive Tables / Deep Analytics.
 */
import {
  DASH_C, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  DonutChart, PieChartTile, GaugeC, WaterfallC, BarV, BarH, LineMulti,
  ScatterBubble, HeatGrid, TreemapC, RadarTile, FunnelC,
} from '../../../shared/dashboardKit';

// ─── Data model (matches public/dashboard.html's single source of truth `D`) ─
const TOTAL_BUDGET = 1842, MAINTENANCE = 892, DEVELOPMENT = 640, EMERGENCY = 180;
const UTILISATION = 68, BACKLOG = 2840;

const BUD_CAT = ['Routine Maint', 'Periodic Maint', 'Development', 'Emergency', 'Admin'];
const BUD_CAT_SHORT = ['Routine', 'Periodic', 'Development', 'Emergency', 'Admin'];
const BUD_BN = [420, 472, 640, 180, 130]; // sums to 1,842
const BUD_CAT_COLORS = [DASH_C.green, DASH_C.cyan, DASH_C.purple, DASH_C.orange, DASH_C.gray];

const BUD_YRS = ['FY22/23', 'FY23/24', 'FY24/25', 'FY25/26'];
const BUD_ALLOC = [1420, 1580, 1710, 1842];
const BUD_SPENT = [1380, 1520, 1640, 1253];
const MAINT_NEED = [2840, 3100, 3350, 3620];

const COST_TREAT = ['Routine', 'Resealing', 'Overlay', 'Rehab', 'Reconstruct'];
const COST_PER_KM = [4.5, 118, 320, 780, 1450]; // mn UGX/km

const REG_LBL = ['Central', 'Northern', 'Eastern', 'Western', 'Southern', 'North Eastern'];
const REG_COL = ['#64d2ff', '#30d158', '#ffd60a', '#bf5af2', '#ff375f', '#ff9f0a'];
const BUD_REG = [470, 360, 420, 240, 230, 122]; // sums to 1,842
const BUD_REG_SPENT = [320, 245, 286, 163, 156, 83];
const REG_UNPAVED = [2586, 3020, 3430, 1720, 2160, 1981]; // network unpaved km, used to derive regional backlog split
const REG_COND_GAIN = [4.2, 3.8, 4.6, 4.4, 4.0, 3.2]; // condition improvement, score pts

const TREAT_LBL = ['Routine', 'Resealing', 'Overlay', 'Rehab', 'Reconstruction'];
const TREAT_NEEDS = [8420, 1240, 890, 640, 215];
const TREAT_FUNDED = [6800, 840, 520, 215, 50];

// region × category budget matrix (bn UGX) - rows sum to BUD_REG
const REG_CAT_BUDGET = [
  [118, 144, 152, 34, 22], // Central
  [90, 108, 116, 28, 18],  // Northern
  [104, 124, 140, 32, 20], // Eastern
  [60, 72, 84, 18, 6],     // Western
  [58, 70, 80, 16, 6],     // Southern
  [40, 44, 32, 4, 2],      // North Eastern
];

const FUNDING_SRC_LBL = ['GoU (UNRA)', 'World Bank/IDA', 'AfDB/AfDF', 'Other Donors'];
const FUNDING_SRC_BN = [820, 480, 340, 202]; // sums to 1,842
const FUNDING_SRC_COLORS = [DASH_C.cyan, DASH_C.green, DASH_C.yellow, DASH_C.orange];

const OPRC_LOT = ['Lot 1 (A109N)', 'Lot 2 (A109W)', 'Lot 3 (A104)', 'Lot 4 (B23)', 'Lot 5 (A109E)', 'Lot 6 (A101)', 'Lot 7 (B30)'];
const OPRC_VALUE = [248, 210, 186, 142, 168, 130, 290]; // bn UGX
const OPRC_SCORE = [84, 76, 58, 91, 72, 65, 88]; // performance score

const BUBBLE_LBL = ['Routine', 'Periodic', 'Reconstruct', 'Emergency', 'Admin', 'Overlay', 'Rehab', 'Reseal'];
const BUBBLE_BUDGET = [420, 472, 640, 180, 130, 320, 280, 380];
const BUBBLE_KM = [8420, 1240, 215, 890, 0, 640, 480, 820];
const BUBBLE_Z = [2, 8, 15, 4, 1, 6, 5, 7];

const TREND_YRS = ['FY20/21', 'FY21/22', 'FY22/23', 'FY23/24', 'FY24/25', 'FY25/26', 'FY26/27*', 'FY27/28*'];
const TREND_ALLOC = [980, 1180, 1420, 1580, 1710, 1842, 2050, 2280];
const TREND_SPENT: (number | null)[] = [940, 1120, 1380, 1520, 1640, 1253, null, null];

// ── Derived series (straightforward, clearly labelled in each tile's subtitle) ──
// Regional maintenance backlog split, proportional to each region's unpaved km share of the 2,840bn total.
const REG_UNPAVED_TOTAL = REG_UNPAVED.reduce((a, b) => a + b, 0);
const BACKLOG_REGION = REG_UNPAVED.map(km => Math.round((km / REG_UNPAVED_TOTAL) * BACKLOG));

// Regional budget vs backlog, each normalised to its own max for radar comparison.
const BUD_REG_MAX = Math.max(...BUD_REG);
const BACKLOG_REG_MAX = Math.max(...BACKLOG_REGION);
const RADAR_REGIONS = REG_LBL.map((r, i) => ({
  axis: r,
  budgetPct: Math.round((BUD_REG[i] / BUD_REG_MAX) * 100),
  backlogPct: Math.round((BACKLOG_REGION[i] / BACKLOG_REG_MAX) * 100),
}));

// Regional utilisation % (spent so far / allocation).
const REG_UTIL_PCT = BUD_REG.map((b, i) => Math.round((BUD_REG_SPENT[i] / b) * 100));

// FY-over-FY utilisation rate (spent / allocated).
const UTIL_TREND = BUD_ALLOC.map((a, i) => Math.round((BUD_SPENT[i] / a) * 100));

// Illustrative budget approval pipeline: real endpoints (1,842 approved → 1,253 actually disbursed),
// with typical GoU release/commitment rates for the intermediate stages.
const APPROVAL_PIPELINE = [
  { name: 'Approved Budget', value: 1842 },
  { name: 'Released to Agencies', value: 1658 },
  { name: 'Committed (Contracts)', value: 1474 },
  { name: 'Disbursed / Spent', value: 1253 },
];

export default function BudgetOverviewDashboard() {
  return (
    <div>
      <KpiStrip>
        <StatMini value={`${TOTAL_BUDGET.toLocaleString()} bn UGX`} label="Total FY25/26" color={DASH_C.orange} />
        <StatMini value={`${MAINTENANCE.toLocaleString()} bn UGX`} label="Maintenance" color={DASH_C.green} />
        <StatMini value={`${DEVELOPMENT.toLocaleString()} bn UGX`} label="Development" color={DASH_C.cyan} />
        <StatMini value={`${EMERGENCY.toLocaleString()} bn UGX`} label="Emergency" color={DASH_C.pink} />
        <StatMini value={`${UTILISATION}%`} label="Budget Utilisation" color={DASH_C.yellow} />
        <StatMini value={`${BACKLOG.toLocaleString()} bn UGX`} label="Maintenance Backlog" color={DASH_C.purple} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.orange}>Budget, Finance &amp; Investment · 23 Views</SectionHdr>

      <ChartGrid cols="4">
        <ChartBox title="Budget FY25/26 by Category" accent={DASH_C.green} height={190}>
          <DonutChart data={BUD_CAT.map((n, i) => ({ name: n, value: BUD_BN[i], color: BUD_CAT_COLORS[i] }))} innerRadius={38} />
        </ChartBox>
        <ChartBox title="Budget Utilisation FY25/26" subtitle="1,253bn of 1,842bn spent" accent={DASH_C.orange} height={190}>
          <GaugeC value={UTILISATION} target={72} color={DASH_C.orange} suffix="%" />
        </ChartBox>
        <ChartBox title="Budget Allocation Waterfall" subtitle="bn UGX" accent={DASH_C.cyan} height={190}>
          <WaterfallC steps={[
            { name: 'Total Budget', delta: 1842, isTotal: true }, { name: 'Routine', delta: -420 },
            { name: 'Periodic', delta: -472 }, { name: 'Development', delta: -640 },
            { name: 'Emergency', delta: -180 }, { name: 'Admin', delta: -130 },
            { name: 'Remaining', delta: 0, isTotal: true },
          ]} unit="bn" />
        </ChartBox>
        <ChartBox title="Budget vs Actuals FY22–26" subtitle="bn UGX" accent={DASH_C.cyan} height={190}>
          <BarV data={BUD_YRS.map((y, i) => ({ year: y, Allocated: BUD_ALLOC[i], Spent: BUD_SPENT[i] }))} xKey="year"
            series={[{ key: 'Allocated', name: 'Allocated', color: DASH_C.cyan }, { key: 'Spent', name: 'Spent', color: DASH_C.green }]} unit="bn" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Budget Trend 2020–2028" subtitle="*projected, bn UGX" accent={DASH_C.cyan} height={210}>
          <LineMulti data={TREND_YRS.map((y, i) => ({ year: y, Allocated: TREND_ALLOC[i], Spent: TREND_SPENT[i] }))} xKey="year"
            series={[{ key: 'Allocated', name: 'Allocated', color: DASH_C.cyan }, { key: 'Spent', name: 'Spent', color: DASH_C.green }]} unit="bn" area />
        </ChartBox>
        <ChartBox title="Unit Cost by Treatment Type" subtitle="mn UGX/km" accent={DASH_C.orange} height={210}>
          <BarV data={COST_TREAT.map((t, i) => ({ name: t, costPerKm: COST_PER_KM[i] }))} xKey="name"
            series={[{ key: 'costPerKm', name: 'Cost/km', color: DASH_C.orange }]} unit=" mn/km" />
        </ChartBox>
        <ChartBox title="Budget by Region FY25/26" subtitle="bn UGX" accent={DASH_C.purple} height={210}>
          <BarV data={REG_LBL.map((r, i) => ({ name: r, Allocation: BUD_REG[i], Spent: BUD_REG_SPENT[i] }))} xKey="name"
            series={[{ key: 'Allocation', name: 'Allocation', color: DASH_C.purple }, { key: 'Spent', name: 'Spent', color: DASH_C.green }]} unit="bn" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="12">
        <ChartBox title="Budget vs km Treated" subtitle="bubble = relative programme size" accent={DASH_C.cyan} height={250}>
          <ScatterBubble
            data={BUBBLE_LBL.map((label, i) => ({ x: BUBBLE_BUDGET[i], y: BUBBLE_KM[i], z: BUBBLE_Z[i], label }))}
            xLabel="Budget (bn UGX)" yLabel="km Treated" color={DASH_C.cyan}
          />
        </ChartBox>
        <ChartBox title="Investment Gap" subtitle="budget vs maintenance need, bn UGX" accent={DASH_C.pink} height={250}>
          <LineMulti data={BUD_YRS.map((y, i) => ({ year: y, Budget: BUD_ALLOC[i], Need: MAINT_NEED[i] }))} xKey="year"
            series={[{ key: 'Budget', name: 'Available Budget', color: DASH_C.cyan }, { key: 'Need', name: 'Maintenance Need', color: DASH_C.pink }]} unit="bn" area />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="OPRC Contract Values" subtitle="bn UGX" accent={DASH_C.cyan} height={200}>
          <BarH data={OPRC_LOT.map((l, i) => ({ lot: l, value: OPRC_VALUE[i] }))} yKey="lot"
            series={[{ key: 'value', name: 'Contract Value', color: DASH_C.cyan }]} unit="bn" />
        </ChartBox>
        <ChartBox title="Treatment Needs vs Funded" subtitle="km" accent={DASH_C.orange} height={200}>
          <BarV data={TREAT_LBL.map((t, i) => ({ name: t, Needs: TREAT_NEEDS[i], Funded: TREAT_FUNDED[i] }))} xKey="name"
            series={[{ key: 'Needs', name: 'Needs', color: DASH_C.orange }, { key: 'Funded', name: 'Funded', color: DASH_C.green }]} unit="km" />
        </ChartBox>
        <ChartBox title="Budget Allocation" subtitle="region × category, bn UGX" accent={DASH_C.cyan} height={200}>
          <HeatGrid matrix={REG_CAT_BUDGET} xLabels={BUD_CAT_SHORT} yLabels={REG_LBL} accent={DASH_C.cyan} unit=" bn" />
        </ChartBox>
        <ChartBox title="Budget Funding Sources" subtitle="bn UGX" accent={DASH_C.green} height={200}>
          <DonutChart data={FUNDING_SRC_LBL.map((n, i) => ({ name: n, value: FUNDING_SRC_BN[i], color: FUNDING_SRC_COLORS[i] }))} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Investment vs Condition Improvement" subtitle="by region" accent={DASH_C.purple} height={200}>
          <ScatterBubble
            data={REG_LBL.map((r, i) => ({ x: BUD_REG[i], y: REG_COND_GAIN[i], label: r }))}
            xLabel="Investment (bn UGX)" yLabel="Condition Improvement (pts)" color={DASH_C.purple}
          />
        </ChartBox>
        <ChartBox title="Budget by Category" subtitle="treemap, bn UGX" accent={DASH_C.green} height={200}>
          <TreemapC data={BUD_CAT.map((n, i) => ({ name: n, size: BUD_BN[i] }))} colors={BUD_CAT_COLORS} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Regional Balance" subtitle="budget vs backlog, normalised %" accent={DASH_C.pink} height={220}>
          <RadarTile
            data={RADAR_REGIONS}
            series={[{ key: 'budgetPct', name: 'Budget Share', color: DASH_C.cyan }, { key: 'backlogPct', name: 'Backlog Share', color: DASH_C.pink }]}
          />
        </ChartBox>
        <ChartBox title="Budget Approval Pipeline" subtitle="bn UGX, illustrative stages" accent={DASH_C.yellow} height={220}>
          <FunnelC data={APPROVAL_PIPELINE} colors={[DASH_C.cyan, DASH_C.teal, DASH_C.yellow, DASH_C.green]} />
        </ChartBox>
        <ChartBox title="OPRC Lot Contract Value Share" subtitle="bn UGX" accent={DASH_C.cyan} height={220}>
          <PieChartTile data={OPRC_LOT.map((l, i) => ({ name: l, value: OPRC_VALUE[i] }))} colors={REG_COL.concat(['#00aacc'])} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Regional Budget Utilisation" subtitle="spent so far / allocation, %" accent={DASH_C.yellow} height={200}>
          <BarH data={REG_LBL.map((r, i) => ({ region: r, utilPct: REG_UTIL_PCT[i] }))} yKey="region"
            series={[{ key: 'utilPct', name: 'Utilisation %', color: DASH_C.yellow }]} unit="%" />
        </ChartBox>
        <ChartBox title="Contract Value vs Performance" subtitle="OPRC lots" accent={DASH_C.teal} height={200}>
          <ScatterBubble
            data={OPRC_LOT.map((l, i) => ({ x: OPRC_VALUE[i], y: OPRC_SCORE[i], label: l }))}
            xLabel="Contract Value (bn UGX)" yLabel="Performance Score" color={DASH_C.teal}
          />
        </ChartBox>
        <ChartBox title="Maintenance Backlog by Region" subtitle="derived from unpaved km share, bn UGX" accent={DASH_C.pink} height={200}>
          <BarV data={REG_LBL.map((r, i) => ({ name: r, backlog: BACKLOG_REGION[i] }))} xKey="name"
            series={[{ key: 'backlog', name: 'Backlog', color: DASH_C.pink }]} unit="bn" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Budget Utilisation Rate" subtitle="spent / allocated, FY22–26, %" accent={DASH_C.orange} height={190}>
          <LineMulti data={BUD_YRS.map((y, i) => ({ year: y, util: UTIL_TREND[i] }))} xKey="year"
            series={[{ key: 'util', name: 'Utilisation %', color: DASH_C.orange }]} unit="%" />
        </ChartBox>
        <ChartBox title="Maintenance Backlog Share by Region" accent={DASH_C.purple} height={190}>
          <DonutChart data={REG_LBL.map((r, i) => ({ name: r, value: BACKLOG_REGION[i], color: REG_COL[i] }))} innerRadius={38} />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
