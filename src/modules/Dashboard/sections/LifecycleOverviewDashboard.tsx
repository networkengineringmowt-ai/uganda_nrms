/**
 * LifecycleOverviewDashboard — RMS "Dashboard" tab, Lifecycle Cost Analysis view.
 * HDM-4 (Highway Development and Management model) based life-cycle costing,
 * NPV/BCR computation, and optimal maintenance strategy selection over a
 * 20-year analysis horizon. Anchored to the platform's canonical figures:
 * total classified network 21,302 km (Class A Trunk 4,200 km / Class B
 * Regional 5,800 km / Class C District 11,302 km — matches
 * NetworkOverviewDashboard.tsx), total budget 1,842bn UGX/yr (Routine Maint
 * 420bn, Periodic Maint 472bn, Development 640bn, Emergency 180bn, Admin
 * 130bn — matches BudgetOverviewDashboard.tsx), and maintenance backlog
 * 2,840bn UGX. Treatment unit costs (mn UGX/km) reuse BudgetOverviewDashboard's
 * COST_PER_KM figures for cross-section consistency. The five treatment/
 * intervention types (Routine → Reseal → Overlay → Rehabilitation →
 * Reconstruction) use the platform's canonical 5-stop severity scale colours,
 * exactly matching INT_COLORS in src/modules/Lifecycle/LifecycleSection.tsx.
 * The 20-year "do-nothing vs reactive vs optimal" cost trajectory is expressed
 * as a relative cost index (Year 1 = 1.0×) rather than absolute bn UGX, since
 * it illustrates HDM-4's classic "1:4:20 deferral rule" (delaying maintenance
 * by a year can cost ~4x more to fix reactively, ~20x more once full
 * reconstruction is required) — the same underlying concept as the unit-cost
 * ladder, expressed as a relative multiplier over time rather than a second
 * absolute-cost total. NPV/BCR/backlog figures elsewhere on this page are
 * absolute bn UGX and stay within the scale set by the 1,842bn/yr budget and
 * 2,840bn backlog. No tables here — tabular breakdowns live under Exhaustive
 * Tables / Deep Analytics.
 */
import {
  DASH_C, REGION_COLORS, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  DonutChart, PieChartTile, BarV, BarH, LineMulti, ScatterBubble, HeatGrid,
  TreemapC, GaugeC, FunnelC, RadarTile, BoxPlotApprox, WaterfallC,
} from '../../../shared/dashboardKit';

// ─── Canonical cross-section anchors ─────────────────────────────────────────
const TOTAL_NETWORK = 21302;
const CLASS_LBL = ['Class A Trunk', 'Class B Regional', 'Class C District'];
const CLASS_KM = [4200, 5800, 11302];
const BACKLOG = 2840; // bn UGX, matches BudgetOverviewDashboard
const HORIZON_YRS = 20;

// Ordered by intervention severity — canonical risk/condition scale
// (matches src/modules/Lifecycle/LifecycleSection.tsx INT_COLORS exactly)
const TREAT_TYPES = ['Routine', 'Reseal', 'Overlay', 'Rehabilitation', 'Reconstruction'];
const INT_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];

// Treatment unit costs, mn UGX/km — matches BudgetOverviewDashboard's COST_PER_KM
const TREAT_UNIT_COST = [4.5, 118, 320, 780, 1450];
// HDM-4 treatment trigger thresholds (network-average IRI, m/km)
const TREAT_TRIGGER_IRI = [3.0, 5.0, 7.0, 9.5, 12.5];
// km currently identified by HDM-4 as candidates for each treatment
const TREAT_KM_NEEDED = [9200, 1450, 980, 720, 260];

// ─── 20-year strategy divergence (relative cost index, Year 1 = 1.0×) ────────
// Illustrates the HDM-4 "1:4:20 rule": optimal preventive maintenance stays
// near-flat, reactive worst-first maintenance compounds ~4-5x, and deferring
// entirely to do-nothing compounds toward the textbook ~20x by year 20.
const LC_YEARS = Array.from({ length: HORIZON_YRS }, (_, i) => 2026 + i);
const LC_YEAR_LBL = LC_YEARS.map(y => `'${String(y).slice(2)}`);
const COST_INDEX_OPTIMAL = LC_YEARS.map((_, i) => +(1 + 0.018 * (i + 1)).toFixed(2));
const COST_INDEX_REACTIVE = LC_YEARS.map((_, i) => +(1 + 0.10 * (i + 1) + 0.0035 * (i + 1) ** 2).toFixed(2));
const COST_INDEX_DONOTHING = LC_YEARS.map((_, i) => +(1 + 0.06 * (i + 1) + 0.045 * (i + 1) ** 2).toFixed(2));

// Cost escalation multiplier by years deferred, per treatment type — same
// deferral-cost concept as above, broken out by treatment severity.
const DEFER_LBL = ['+1yr', '+2yr', '+3yr', '+4yr', '+5yr'];
const DEFER_MATRIX = [
  [1.0, 1.3, 1.8, 2.4, 3.2],   // Routine
  [1.0, 1.6, 2.4, 3.4, 4.6],   // Reseal
  [1.0, 1.9, 3.1, 4.6, 6.5],   // Overlay
  [1.0, 2.3, 4.0, 6.2, 9.0],   // Rehabilitation
  [1.0, 2.8, 5.2, 8.9, 14.0],  // Reconstruction — approaches the "20x" ceiling
];

// Network-average IRI trajectory under do-nothing vs HDM-4 optimal strategy
const IRI_OPTIMAL = LC_YEARS.map((_, i) => +(5.5 - 0.065 * (i + 1)).toFixed(2));
const IRI_DONOTHING = LC_YEARS.map((_, i) => +(5.5 + 0.40 * (i + 1)).toFixed(2));

// ─── Strategy / scenario economic evaluation ────────────────────────────────
const STRATEGIES = ['Do-Nothing', 'Reactive', 'Budget-Constrained', 'Needs-Based', 'HDM-4 Optimal'];
const STRAT_COLORS = [DASH_C.pink, DASH_C.orange, DASH_C.yellow, DASH_C.cyan, DASH_C.green];
const STRAT_NPV_BN = [-820, 340, 1180, 2140, 2860]; // bn UGX, 12% discount rate, 20-yr horizon
const STRAT_BCR = [0.6, 1.4, 2.3, 3.1, 3.8];

const DISCOUNT_LBL = ['8%', '10%', '12%', '14%', '16%'];
const NPV_AT_RATE = [4120, 3480, 2860, 2340, 1890]; // HDM-4 Optimal NPV, bn UGX, by discount rate

// NPV bridge: Do-Minimum baseline through to HDM-4 Optimal, value drivers sum exactly
const NPV_BRIDGE = [
  { name: 'Do-Minimum NPV', delta: -820, isTotal: true },
  { name: '+ Reduced VOC', delta: 640 },
  { name: '+ Avoided Reconstruction', delta: 1450 },
  { name: '+ Reduced Backlog Growth', delta: 980 },
  { name: '+ Preventive Efficiency', delta: 610 },
  { name: 'HDM-4 Optimal NPV', delta: 2860, isTotal: true },
];

// ─── Whole-of-network life-cycle cost ───────────────────────────────────────
const CLASS_LCC_BN = [8400, 6900, 7100]; // 20-yr life-cycle cost by road class, bn UGX
const CLASS_TREAT_MATRIX = [
  [180, 620, 1450, 3200, 2950], // Class A Trunk — sums to 8,400
  [220, 580, 1120, 2480, 2500], // Class B Regional — sums to 6,900
  [340, 720, 980, 2260, 2800],  // Class C District — sums to 7,100
];
const TREAT_LBL_SHORT = ['Routine', 'Reseal', 'Overlay', 'Rehab', 'Reconst'];

// Regional backlog split, proportional to unpaved km share of the 2,840bn total
// (same derivation method as BudgetOverviewDashboard's BACKLOG_REGION)
const REG_LBL = ['Central', 'Northern', 'Eastern', 'Western', 'Southern', 'North Eastern'];
const REG_UNPAVED = [2586, 3020, 3430, 1720, 2160, 1981];
const REG_UNPAVED_TOTAL = REG_UNPAVED.reduce((a, b) => a + b, 0);
const BACKLOG_REGION = REG_UNPAVED.map(km => Math.round((km / REG_UNPAVED_TOTAL) * BACKLOG));

// Budget-constrained (actual programmed) vs needs-based (HDM-4 optimal) annual spend, bn UGX
const NEEDS_BASED_BN = [46, 138, 205, 312, 168];
const BUDGET_CONSTRAINED_BN = [42, 96, 150, 210, 74];

// Years overdue for treatment (network segment distribution), by type
const OVERDUE_BOX = [
  { name: 'Routine', min: 0, q1: 0.1, median: 0.3, q3: 0.6, max: 1.2, color: INT_COLORS[0] },
  { name: 'Reseal', min: 0.2, q1: 0.8, median: 1.4, q3: 2.1, max: 3.5, color: INT_COLORS[1] },
  { name: 'Overlay', min: 0.5, q1: 1.6, median: 2.6, q3: 3.8, max: 5.4, color: INT_COLORS[2] },
  { name: 'Rehabilitation', min: 1.0, q1: 2.4, median: 3.9, q3: 5.6, max: 7.8, color: INT_COLORS[3] },
  { name: 'Reconstruction', min: 1.5, q1: 3.2, median: 5.1, q3: 7.4, max: 10.2, color: INT_COLORS[4] },
];

// HDM-4 analysis run volume by fiscal year (planning-unit adoption trend)
const HDM_YEARS = ['FY20/21', 'FY21/22', 'FY22/23', 'FY23/24', 'FY24/25', 'FY25/26'];
const HDM_RUNS = [42, 68, 95, 140, 186, 224];

// HDM-4 analysis-to-implementation pipeline (network sections)
const HDM_PIPELINE = [
  { name: 'Sections Modelled', value: 3820 },
  { name: 'Candidates Identified', value: 2140 },
  { name: 'Treatment Recommended', value: 1360 },
  { name: 'Budget Approved', value: 890 },
  { name: 'Implemented', value: 612 },
];

// Candidate road sections — IRI vs AADT, bubble = indicative treatment cost (bn UGX)
const CANDIDATES = Array.from({ length: 36 }, (_, i) => {
  const aadt = 300 + ((i * 517) % 9200);
  const iri = +(3.0 + ((i * 53) % 900) / 100).toFixed(2);
  const costBn = +(2 + ((i * 71) % 1400) / 100).toFixed(1);
  return { x: aadt, y: iri, z: costBn };
});

// Strategy comparison, normalised 0-100 across economic-evaluation metrics
const STRATEGY_RADAR = [
  { axis: 'NPV', doNothing: 10, optimal: 95 },
  { axis: 'BCR', doNothing: 16, optimal: 100 },
  { axis: 'Condition Gain', doNothing: 8, optimal: 88 },
  { axis: 'Backlog Cut', doNothing: 5, optimal: 82 },
  { axis: 'Cost Efficiency', doNothing: 20, optimal: 92 },
];

export default function LifecycleOverviewDashboard() {
  return (
    <div>
      <KpiStrip>
        <StatMini value={`${TOTAL_NETWORK.toLocaleString()} km`} label="Network Under HDM-4 Analysis" color={DASH_C.teal} />
        <StatMini value={`${HORIZON_YRS} Years`} label="Analysis Horizon" color={DASH_C.cyan} />
        <StatMini value={`${BACKLOG.toLocaleString()} bn UGX`} label="Maintenance Backlog" color={DASH_C.pink} />
        <StatMini value={`${STRAT_NPV_BN[4].toLocaleString()} bn UGX`} label="HDM-4 Optimal NPV" color={DASH_C.green} />
        <StatMini value={`${STRAT_BCR[4]}×`} label="Benefit-Cost Ratio" color={DASH_C.yellow} />
        <StatMini value="Up to 20×" label="Deferred Reconstruction Cost" color={DASH_C.orange} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.teal}>Lifecycle Cost Analysis · HDM-4 Economic Evaluation · 21 Views</SectionHdr>

      <ChartGrid cols="4">
        <ChartBox title="Treatment Unit Cost by Type" subtitle="mn UGX/km" accent={DASH_C.teal} height={190}>
          <DonutChart data={TREAT_TYPES.map((n, i) => ({ name: n, value: TREAT_UNIT_COST[i], color: INT_COLORS[i] }))} innerRadius={38} />
        </ChartBox>
        <ChartBox title="NPV by Strategy Scenario" subtitle="bn UGX, 12% discount rate" accent={DASH_C.cyan} height={190}>
          <BarH data={STRATEGIES.map((s, i) => ({ strategy: s, npv: STRAT_NPV_BN[i] }))} yKey="strategy"
            series={[{ key: 'npv', name: 'NPV', color: DASH_C.cyan }]} unit="bn" />
        </ChartBox>
        <ChartBox title="HDM-4 Run Volume Trend" subtitle="analysis runs / FY" accent={DASH_C.blue} height={190}>
          <LineMulti data={HDM_YEARS.map((y, i) => ({ year: y, runs: HDM_RUNS[i] }))} xKey="year"
            series={[{ key: 'runs', name: 'HDM-4 Runs', color: DASH_C.blue }]} area />
        </ChartBox>
        <ChartBox title="Optimal Strategy BCR" subtitle="benefit-cost ratio" accent={DASH_C.green} height={190}>
          <GaugeC value={STRAT_BCR[4]} max={5} target={1} color={DASH_C.green} suffix="×" label="HDM-4 Optimal" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="12">
        <ChartBox title="20-Year Cost Trajectory" subtitle="relative cost index, Yr'26=1.0× — HDM-4 '1:4:20' deferral rule" accent={DASH_C.teal} height={250}>
          <LineMulti
            data={LC_YEAR_LBL.map((y, i) => ({ year: y, Optimal: COST_INDEX_OPTIMAL[i], Reactive: COST_INDEX_REACTIVE[i], 'Do-Nothing': COST_INDEX_DONOTHING[i] }))}
            xKey="year"
            series={[
              { key: 'Optimal', name: 'Optimal Preventive', color: DASH_C.green },
              { key: 'Reactive', name: 'Reactive (Worst-First)', color: DASH_C.orange },
              { key: 'Do-Nothing', name: 'Do-Nothing', color: DASH_C.pink },
            ]}
            area
          />
        </ChartBox>
        <ChartBox title="Cost Escalation by Deferral Period" subtitle="multiplier vs on-time treatment" accent={DASH_C.orange} height={250}>
          <HeatGrid matrix={DEFER_MATRIX} xLabels={DEFER_LBL} yLabels={TREAT_LBL_SHORT} accent={DASH_C.orange} unit="×" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="NPV Bridge" subtitle="Do-Minimum → HDM-4 Optimal, bn UGX" accent={DASH_C.purple} height={210}>
          <WaterfallC steps={NPV_BRIDGE} unit="bn" />
        </ChartBox>
        <ChartBox title="Benefit-Cost Ratio by Strategy" accent={DASH_C.yellow} height={210}>
          <BarV data={STRATEGIES.map((s, i) => ({ name: s, bcr: STRAT_BCR[i] }))} xKey="name"
            series={[{ key: 'bcr', name: 'BCR', color: DASH_C.yellow }]} />
        </ChartBox>
        <ChartBox title="NPV Sensitivity to Discount Rate" subtitle="HDM-4 Optimal, bn UGX" accent={DASH_C.pink} height={210}>
          <LineMulti data={DISCOUNT_LBL.map((r, i) => ({ rate: r, npv: NPV_AT_RATE[i] }))} xKey="rate"
            series={[{ key: 'npv', name: 'NPV', color: DASH_C.pink }]} unit="bn" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Life-Cycle Cost by Road Class" subtitle="20-yr horizon, bn UGX" accent={DASH_C.purple} height={200}>
          <BarV data={CLASS_LBL.map((c, i) => ({ name: c, lcc: CLASS_LCC_BN[i], km: CLASS_KM[i] }))} xKey="name"
            series={[{ key: 'lcc', name: 'Life-Cycle Cost', color: DASH_C.purple }]} unit="bn" />
        </ChartBox>
        <ChartBox title="Life-Cycle Cost — Road Class × Treatment" subtitle="bn UGX" accent={DASH_C.cyan} height={200}>
          <HeatGrid matrix={CLASS_TREAT_MATRIX} xLabels={TREAT_LBL_SHORT} yLabels={CLASS_LBL} accent={DASH_C.cyan} unit=" bn" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="Maintenance Backlog Cost by Region" subtitle="bn UGX" accent={DASH_C.pink} height={200}>
          <BarV data={REG_LBL.map((r, i) => ({ name: r, backlog: BACKLOG_REGION[i] }))} xKey="name"
            series={[{ key: 'backlog', name: 'Backlog', color: DASH_C.pink }]} unit="bn" />
        </ChartBox>
        <ChartBox title="Backlog Cost Share by Region" accent={DASH_C.orange} height={200}>
          <PieChartTile data={REG_LBL.map((r, i) => ({ name: r, value: BACKLOG_REGION[i] }))} colors={REGION_COLORS} />
        </ChartBox>
        <ChartBox title="Budget-Constrained vs Needs-Based" subtitle="annual programme, bn UGX" accent={DASH_C.green} height={200}>
          <BarV data={TREAT_TYPES.map((t, i) => ({ name: t, 'Needs-Based': NEEDS_BASED_BN[i], 'Budget-Constrained': BUDGET_CONSTRAINED_BN[i] }))} xKey="name"
            series={[{ key: 'Needs-Based', name: 'Needs-Based', color: DASH_C.green }, { key: 'Budget-Constrained', name: 'Budget-Constrained', color: DASH_C.orange }]} unit="bn" />
        </ChartBox>
        <ChartBox title="Network Treatment Mix Needing Action" subtitle="km" accent={DASH_C.yellow} height={200}>
          <TreemapC data={TREAT_TYPES.map((t, i) => ({ name: t, size: TREAT_KM_NEEDED[i] }))} colors={INT_COLORS} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Maintenance Timing — Years Overdue" subtitle="by treatment type" accent={DASH_C.orange} height={220}>
          <BoxPlotApprox data={OVERDUE_BOX} unit="yr" />
        </ChartBox>
        <ChartBox title="Network Condition Trajectory" subtitle="avg IRI, Do-Nothing vs HDM-4 Optimal" accent={DASH_C.cyan} height={220}>
          <LineMulti data={LC_YEAR_LBL.map((y, i) => ({ year: y, Optimal: IRI_OPTIMAL[i], 'Do-Nothing': IRI_DONOTHING[i] }))} xKey="year"
            series={[{ key: 'Optimal', name: 'HDM-4 Optimal', color: DASH_C.cyan }, { key: 'Do-Nothing', name: 'Do-Nothing', color: DASH_C.pink }]} unit=" IRI" area />
        </ChartBox>
        <ChartBox title="Candidate Sections — IRI vs AADT" subtitle="bubble = indicative treatment cost" accent={DASH_C.purple} height={220}>
          <ScatterBubble data={CANDIDATES} xLabel="AADT (veh/day)" yLabel="IRI (m/km)" color={DASH_C.purple} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Treatment Trigger IRI Thresholds" subtitle="m/km" accent={DASH_C.yellow} height={220}>
          <BarH data={TREAT_TYPES.map((t, i) => ({ type: t, iri: TREAT_TRIGGER_IRI[i] }))} yKey="type"
            series={[{ key: 'iri', name: 'Trigger IRI', color: DASH_C.yellow }]} unit=" IRI" />
        </ChartBox>
        <ChartBox title="HDM-4 Analysis Pipeline" subtitle="network sections" accent={DASH_C.teal} height={220}>
          <FunnelC data={HDM_PIPELINE} colors={[DASH_C.cyan, DASH_C.teal, DASH_C.yellow, DASH_C.orange, DASH_C.green]} />
        </ChartBox>
        <ChartBox title="Strategy Comparison" subtitle="normalised metrics, Do-Nothing vs Optimal" accent={DASH_C.pink} height={220}>
          <RadarTile data={STRATEGY_RADAR}
            series={[{ key: 'doNothing', name: 'Do-Nothing', color: DASH_C.pink }, { key: 'optimal', name: 'HDM-4 Optimal', color: DASH_C.green }]}
            maxValue={100} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Vehicle Operating Cost Savings" subtitle="vs do-nothing baseline" accent={DASH_C.green} height={190}>
          <GaugeC value={34} max={50} target={40} color={DASH_C.green} suffix="%" label="VOC Reduction" />
        </ChartBox>
        <ChartBox title="Deferral Cost Multiplier at Year 20" subtitle="relative cost index by strategy" accent={DASH_C.pink} height={190}>
          <BarV data={[
            { name: 'Optimal', idx: COST_INDEX_OPTIMAL[HORIZON_YRS - 1] },
            { name: 'Reactive', idx: COST_INDEX_REACTIVE[HORIZON_YRS - 1] },
            { name: 'Do-Nothing', idx: COST_INDEX_DONOTHING[HORIZON_YRS - 1] },
          ]} xKey="name" series={[{ key: 'idx', name: 'Cost Index', color: DASH_C.pink }]} unit="×" />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
