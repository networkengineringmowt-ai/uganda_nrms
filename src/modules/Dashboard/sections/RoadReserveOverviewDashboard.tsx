/**
 * RoadReserveOverviewDashboard - RMS "Dashboard" tab, Road Reserve Management view.
 * Covers surveyed road-reserve boundaries, gazette status, encroachment
 * detection/enforcement, and reserve-width compliance monitoring for Uganda's
 * classified road network. Anchored to the platform's canonical network figures
 * (matches NetworkOverviewDashboard.tsx): total classified network 21,302 km
 * across 6 regions (Central, Northern, Eastern, Western, Southern, North
 * Eastern) and 3 road classes - Class A Trunk 4,200 km, Class B Regional
 * 5,800 km, Class C District 11,302 km - each carrying a standard road-reserve
 * corridor width (50 m / 30 m / 15–20 m respectively, per Uganda practice).
 * All reserve/encroachment figures below are an internally-consistent
 * illustrative data model (not live survey data), sized like the other
 * flagship section dashboards. No tables here - tabular breakdowns live under
 * Exhaustive Tables / Deep Analytics.
 */
import {
  DASH_C, REGION_COLORS, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  SunburstApprox, HeatGrid, BarH, BarV, LineMulti, ScatterBubble, TreemapC, GaugeC,
  DonutChart, PieChartTile, FunnelC, RadarTile, BoxPlotApprox, WaterfallC,
} from '../../../shared/dashboardKit';

// Canonical 5-stop severity/risk scale (best → worst) - matches src/utils/helpers.ts RISK_SCALE_STOPS.
const RISK5 = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];

// ─── Data model ──────────────────────────────────────────────────────────────
const NET_TOTAL = 21302; // canonical classified network total (matches NetworkOverviewDashboard)
const REG_LBL = ['Central', 'Northern', 'Eastern', 'Western', 'Southern', 'North Eastern'];
const REG_KM = [4436, 3920, 4290, 3000, 3300, 2356]; // canonical per-region network km

const CLASS_LBL = ['Class A Trunk', 'Class B Regional', 'Class C District'];
const CLASS_KM = [4200, 5800, 11302];
const STD_WIDTH_M = [50, 30, 20]; // gazetted reserve-width standard per class (m)

// Reserve boundary survey / gazette pipeline (km) - sums verified below.
const RESERVE_SURVEYED_KM = 15860; // 74% of network
const RESERVE_GAZETTED_KM = 11240; // 53% of network, 71% of surveyed
const RESERVE_PUBLISHED_KM = 9080; // 43% of network - gazette notice published
const NOT_SURVEYED_KM = NET_TOTAL - RESERVE_SURVEYED_KM; // 5,442 km
const NOT_GAZETTED_KM = RESERVE_SURVEYED_KM - RESERVE_GAZETTED_KM; // 4,620 km
const AWAITING_PUBLICATION_KM = RESERVE_GAZETTED_KM - RESERVE_PUBLISHED_KM; // 2,160 km

// Surveyed / gazetted km per region - rows sum to RESERVE_SURVEYED_KM / RESERVE_GAZETTED_KM.
const REG_SURVEYED_KM = [3630, 2660, 3040, 2370, 2470, 1690];
const REG_GAZETTED_KM = [2580, 1780, 2140, 1720, 1780, 1240];

// Surveyed / gazetted km per road class - sums to the same totals.
const CLASS_SURVEYED_KM = [3780, 4640, 7440];
const CLASS_GAZETTED_KM = [3230, 3480, 4530];

// Reserve-width compliance - average surveyed width vs the gazetted standard, by class.
const AVG_WIDTH_M = [46, 26.4, 15.8];
const WIDTH_COMPLIANCE_PCT = AVG_WIDTH_M.map((w, i) => Math.round((w / STD_WIDTH_M[i]) * 100)); // [92, 88, 79]
const OVERALL_COMPLIANCE_PCT = Math.round(
  CLASS_KM.reduce((s, km, i) => s + km * WIDTH_COMPLIANCE_PCT[i], 0) / NET_TOTAL,
); // 84

// Reserve-width compliance % matrix, region × class - illustrative spread around the class averages.
const COMPLIANCE_MATRIX = [
  [94, 90, 82], [88, 84, 74], [90, 86, 78],
  [92, 87, 80], [91, 85, 77], [85, 80, 70],
];

// Encroachment case counts - total 2,148 active cases.
const TOTAL_CASES = 2148;
const SEVERITY_LBL = ['Low', 'Minor', 'Moderate', 'Major', 'Severe'];
const SEVERITY_COUNT = [512, 610, 580, 320, 126]; // sums to TOTAL_CASES

const TYPE_LBL = ['Illegal Structures', 'Cultivation/Farming', 'Commercial/Trading', 'Informal Settlement', 'Fencing/Walls'];
const TYPE_COUNT = [780, 640, 340, 260, 128]; // sums to TOTAL_CASES
const TYPE_COLORS = [DASH_C.orange, DASH_C.green, DASH_C.blue, DASH_C.pink, DASH_C.purple];

const REG_CASES = [640, 310, 480, 290, 280, 148]; // sums to TOTAL_CASES

// Region × severity matrix - every row sums to REG_CASES, every column sums to SEVERITY_COUNT.
const REG_SEVERITY = [
  [152, 182, 173, 95, 38], [74, 88, 84, 46, 18], [114, 136, 130, 71, 29],
  [69, 82, 78, 43, 18], [67, 80, 76, 42, 15], [36, 42, 39, 23, 8],
];

// Case resolution split.
const CASES_RESOLVED = 860;
const CASES_PENDING_COMPLIANCE = 780;
const CASES_ESCALATED_LEGAL = 508; // Resolved + Pending + Escalated sums to TOTAL_CASES

// New-case trend + cumulative resolution, 2021–2025.
const TREND_YRS = [2021, 2022, 2023, 2024, 2025];
const NEW_CASES = [320, 380, 410, 460, 578]; // sums to TOTAL_CASES
let cum = 0;
const CUM_CASES = NEW_CASES.map(n => (cum += n)); // running total → 2,148
const CUM_RESOLVED = [140, 320, 520, 710, 860]; // running total → CASES_RESOLVED

// Enforcement / removal-notice funnel.
const ENFORCEMENT_FUNNEL = [
  { name: 'Cases Identified', value: TOTAL_CASES }, { name: 'Field-Investigated', value: 1960 },
  { name: 'Removal Notices Issued', value: 1640 }, { name: 'Voluntary Compliance', value: 980 },
  { name: 'Case Closed', value: CASES_RESOLVED },
];

// Top encroached districts (illustrative subset, not exhaustive of REG_CASES).
const DISTRICT_LBL = ['Wakiso', 'Mukono', 'Kampala', 'Jinja', 'Mbarara', 'Mbale', 'Masaka', 'Gulu', 'Lira', 'Arua'];
const DISTRICT_COUNT = [214, 178, 165, 142, 128, 112, 96, 88, 76, 62];

// Case age (months open) vs severity score (0–100) - older unresolved cases skew more severe.
const CASE_AGE_VS_SEVERITY = [
  { x: 2, y: 22 }, { x: 4, y: 28 }, { x: 6, y: 35 }, { x: 8, y: 30 }, { x: 10, y: 42 },
  { x: 12, y: 48 }, { x: 14, y: 55 }, { x: 18, y: 50 }, { x: 21, y: 62 }, { x: 24, y: 68 },
  { x: 30, y: 72 }, { x: 36, y: 80 }, { x: 42, y: 85 }, { x: 48, y: 90 },
];

// Encroachment case severity (deterministic 42-case sample). Case coordinates
// were dropped from this tile (coords belong on maps only, never charts) -
// ranked by severity score instead.
const CASE_HOTSPOTS = Array.from({ length: 42 }, (_, i) => 20 + ((i * 613) % 80))
  .sort((a, b) => b - a).map((severity, i) => ({ x: i + 1, y: severity, z: severity }));

// Reserve width sample points (m) per class, used for the box-plot.
const WIDTH_A = [38, 41, 43, 45, 46, 47, 48, 49, 51, 53];
const WIDTH_B = [19, 22, 24, 25, 26, 27, 28, 29, 31, 34];
const WIDTH_C = [9, 11, 13, 14, 15, 16, 17, 18, 20, 23];

function boxStats(sorted: number[], color: string, name: string) {
  return { name, min: sorted[0], q1: sorted[2], median: (sorted[4] + sorted[5]) / 2, q3: sorted[7], max: sorted[9], color };
}

export default function RoadReserveOverviewDashboard() {
  return (
    <div>
      <KpiStrip>
        <StatMini value={`${RESERVE_SURVEYED_KM.toLocaleString()} km`} label={`Reserve Surveyed (${Math.round(RESERVE_SURVEYED_KM / NET_TOTAL * 100)}%)`} color={DASH_C.cyan} />
        <StatMini value={`${RESERVE_GAZETTED_KM.toLocaleString()} km`} label={`Gazetted (${Math.round(RESERVE_GAZETTED_KM / NET_TOTAL * 100)}%)`} color={DASH_C.teal} />
        <StatMini value={`${TOTAL_CASES.toLocaleString()}`} label="Active Encroachment Cases" color={DASH_C.orange} />
        <StatMini value={`${OVERALL_COMPLIANCE_PCT}%`} label="Avg Width Compliance" color={DASH_C.green} />
        <StatMini value={`${SEVERITY_COUNT[4]}`} label="Severe-Risk Cases" color="#ef4444" />
        <StatMini value={`${CASES_RESOLVED.toLocaleString()}`} label={`Cases Resolved (${Math.round(CASES_RESOLVED / TOTAL_CASES * 100)}%)`} color={DASH_C.purple} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.teal}>Road Reserve Management · 20 Views</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="Reserve Boundary Status" subtitle="surveyed → gazetted → published" accent={DASH_C.teal} height={210}>
          <SunburstApprox
            inner={[{ name: 'Gazetted', value: RESERVE_GAZETTED_KM, color: DASH_C.teal }, { name: 'Not Yet Gazetted', value: NOT_GAZETTED_KM, color: DASH_C.orange }]}
            outer={[
              { name: 'Published', value: RESERVE_PUBLISHED_KM, color: '#00ccdd' }, { name: 'Awaiting Publication', value: AWAITING_PUBLICATION_KM, color: '#006688' },
              { name: 'Awaiting Approval', value: 2820, color: DASH_C.yellow }, { name: 'Boundary Disputed', value: 1800, color: '#ef4444' },
            ]}
          />
        </ChartBox>
        <ChartBox title="Reserve Width Compliance" subtitle="region × class (%)" accent={DASH_C.teal} height={210}>
          <HeatGrid matrix={COMPLIANCE_MATRIX} xLabels={['Class A', 'Class B', 'Class C']} yLabels={REG_LBL} accent={DASH_C.teal} unit="%" />
        </ChartBox>
        <ChartBox title="Reserve Surveyed by Region" accent={DASH_C.cyan} height={210}>
          <BarH data={REG_LBL.map((r, i) => ({ region: r, km: REG_SURVEYED_KM[i] }))} yKey="region" series={[{ key: 'km', name: 'Surveyed km', color: DASH_C.cyan }]} unit=" km" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="12">
        <ChartBox title="Encroachment Case Severity" subtitle="42 cases, ranked - size=severity score" accent={DASH_C.purple} height={260}>
          <ScatterBubble data={CASE_HOTSPOTS} xLabel="Rank" yLabel="Severity Score" color={DASH_C.purple} />
        </ChartBox>
        <ChartBox title="Encroachment Severity by Region" subtitle="stacked, canonical 5-stop risk scale" accent={DASH_C.pink} height={260}>
          <BarV data={REG_LBL.map((r, i) => ({ name: r, Low: REG_SEVERITY[i][0], Minor: REG_SEVERITY[i][1], Moderate: REG_SEVERITY[i][2], Major: REG_SEVERITY[i][3], Severe: REG_SEVERITY[i][4] }))}
            xKey="name" series={SEVERITY_LBL.map((s, i) => ({ key: s, name: s, color: RISK5[i] }))} stacked />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="Encroachment Type Breakdown" accent={DASH_C.orange} height={190}>
          <PieChartTile data={TYPE_LBL.map((n, i) => ({ name: n, value: TYPE_COUNT[i], color: TYPE_COLORS[i] }))} />
        </ChartBox>
        <ChartBox title="Boundary Survey Completion" subtitle="target 90% by FY27" accent={DASH_C.cyan} height={190}>
          <GaugeC value={Math.round(RESERVE_SURVEYED_KM / NET_TOTAL * 100)} target={90} color={DASH_C.cyan} />
        </ChartBox>
        <ChartBox title="Gazettement Rate" subtitle="target 75% of network" accent={DASH_C.yellow} height={190}>
          <GaugeC value={Math.round(RESERVE_GAZETTED_KM / NET_TOTAL * 100)} target={75} color={DASH_C.yellow} />
        </ChartBox>
        <ChartBox title="Gazetted vs Ungazetted" subtitle="of surveyed reserve" accent={DASH_C.teal} height={190}>
          <DonutChart data={[{ name: 'Gazetted', value: RESERVE_GAZETTED_KM, color: DASH_C.teal }, { name: 'Not Yet Gazetted', value: NOT_GAZETTED_KM, color: DASH_C.orange }]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Reserve Status by Road Class" subtitle="total / surveyed / gazetted, km" accent={DASH_C.blue} height={230}>
          <BarV data={CLASS_LBL.map((n, i) => ({ name: n.split(' ')[1], Total: CLASS_KM[i], Surveyed: CLASS_SURVEYED_KM[i], Gazetted: CLASS_GAZETTED_KM[i] }))} xKey="name"
            series={[{ key: 'Total', name: 'Total km', color: DASH_C.cyan }, { key: 'Surveyed', name: 'Surveyed km', color: DASH_C.blue }, { key: 'Gazetted', name: 'Gazetted km', color: DASH_C.teal }]} unit="km" />
        </ChartBox>
        <ChartBox title="Encroachment Cases 2021–2025" subtitle="cumulative registered vs resolved" accent={DASH_C.green} height={230}>
          <LineMulti data={TREND_YRS.map((y, i) => ({ year: y, Registered: CUM_CASES[i], Resolved: CUM_RESOLVED[i] }))} xKey="year"
            series={[{ key: 'Registered', name: 'Cumulative Registered', color: DASH_C.orange }, { key: 'Resolved', name: 'Cumulative Resolved', color: DASH_C.green }]} area />
        </ChartBox>
        <ChartBox title="Reserve Corridor by Region" subtitle="treemap, surveyed km" accent={DASH_C.purple} height={230}>
          <TreemapC data={REG_LBL.map((r, i) => ({ name: r, size: REG_SURVEYED_KM[i] }))} colors={REGION_COLORS} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Reserve Width Distribution by Class" subtitle="metres, vs 50/30/20m standard" accent={DASH_C.orange} height={210}>
          <BoxPlotApprox data={[
            boxStats(WIDTH_A, DASH_C.cyan, 'Class A'), boxStats(WIDTH_B, DASH_C.yellow, 'Class B'), boxStats(WIDTH_C, DASH_C.orange, 'Class C'),
          ]} unit="m" />
        </ChartBox>
        <ChartBox title="Reserve Boundary Pipeline" subtitle="waterfall, km" accent={DASH_C.pink} height={210}>
          <WaterfallC steps={[
            { name: 'Network', delta: NET_TOTAL, isTotal: true }, { name: '−Not Surveyed', delta: -NOT_SURVEYED_KM },
            { name: '=Surveyed', delta: RESERVE_SURVEYED_KM, isTotal: true }, { name: '−Not Gazetted', delta: -NOT_GAZETTED_KM },
            { name: '=Gazetted', delta: RESERVE_GAZETTED_KM, isTotal: true }, { name: '−Not Published', delta: -AWAITING_PUBLICATION_KM },
            { name: '=Published', delta: RESERVE_PUBLISHED_KM, isTotal: true },
          ]} unit="km" />
        </ChartBox>
        <ChartBox title="Regional Readiness" subtitle="surveyed % vs gazetted %" accent={DASH_C.teal} height={210}>
          <RadarTile
            data={REG_LBL.map((r, i) => ({ axis: r, surveyedPct: Math.round(REG_SURVEYED_KM[i] / REG_KM[i] * 100), gazettedPct: Math.round(REG_GAZETTED_KM[i] / REG_KM[i] * 100) }))}
            series={[{ key: 'surveyedPct', name: 'Surveyed %', color: DASH_C.cyan }, { key: 'gazettedPct', name: 'Gazetted %', color: DASH_C.teal }]}
            maxValue={100}
          />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Gazette Status by Road Class" subtitle="gazetted vs not-yet, of surveyed" accent={DASH_C.green} height={210}>
          <BarV data={CLASS_LBL.map((n, i) => ({ name: n.split(' ')[1], Gazetted: CLASS_GAZETTED_KM[i], 'Not Yet': CLASS_SURVEYED_KM[i] - CLASS_GAZETTED_KM[i] }))} xKey="name"
            series={[{ key: 'Gazetted', name: 'Gazetted', color: DASH_C.teal }, { key: 'Not Yet', name: 'Not Yet Gazetted', color: DASH_C.orange }]} stacked unit="km" />
        </ChartBox>
        <ChartBox title="Enforcement & Removal Funnel" accent={DASH_C.blue} height={210}>
          <FunnelC data={ENFORCEMENT_FUNNEL} colors={[DASH_C.pink, DASH_C.orange, DASH_C.yellow, DASH_C.cyan, DASH_C.green]} />
        </ChartBox>
        <ChartBox title="Top Encroached Districts" accent={DASH_C.yellow} height={210}>
          <BarH data={DISTRICT_LBL.map((d, i) => ({ district: d, cases: DISTRICT_COUNT[i] }))} yKey="district" series={[{ key: 'cases', name: 'Cases', color: DASH_C.yellow }]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Case Age vs Severity Score" subtitle="months open vs severity (0–100)" accent="#ef4444" height={200}>
          <ScatterBubble data={CASE_AGE_VS_SEVERITY} xLabel="Age (months)" yLabel="Severity Score" color="#ef4444" />
        </ChartBox>
        <ChartBox title="Case Resolution Status" accent={DASH_C.green} height={200}>
          <DonutChart data={[
            { name: 'Resolved', value: CASES_RESOLVED, color: DASH_C.green },
            { name: 'Pending Compliance', value: CASES_PENDING_COMPLIANCE, color: DASH_C.yellow },
            { name: 'Escalated to Legal', value: CASES_ESCALATED_LEGAL, color: '#ef4444' },
          ]} />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
