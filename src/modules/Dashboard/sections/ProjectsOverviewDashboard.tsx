/**
 * ProjectsOverviewDashboard — RMS "Dashboard" tab, Projects & Works view.
 * Port of public/dashboard.html Tab 6 (PROJECTS, CONTRACTS & OPRC, charts
 * c75–c87) into live React/Recharts, extended to 21 chart tiles. Real project
 * portfolio, OPRC lot and contract figures straight from the mockup's shared
 * data object `D`. No tables here — tabular breakdowns live under Exhaustive
 * Tables / Deep Analytics.
 */
import {
  DASH_C, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  BarH, BarV, DonutChart, ScatterBubble, FunnelC, LineMulti, HeatGrid,
  TreemapC, RadarTile, GaugeC, BoxPlotApprox, WaterfallC,
} from '../../../shared/dashboardKit';

// ─── Data model (matches public/dashboard.html's `D` — PROJECTS/OPRC slice) ──
const PROJ_NAME = ['Gulu-Acholibur', 'Mbarara-Bypass', 'Ntungamo-Mirama', 'Soroti-Lira', 'Kampala Distr.', 'Masaka-Mbarara', 'Tororo-Mbale', 'Hoima-Kafu'];
const PROJ_PCT = [88, 62, 45, 71, 34, 56, 82, 28];
const PROJ_BN = [248, 142, 186, 124, 380, 210, 168, 290]; // budget, bn UGX
const PROJ_STATUS = ['On Track', 'Minor Delay', 'Behind', 'On Track', 'Behind', 'Minor Delay', 'On Track', 'Behind'];
const PROJ_LEN_KM = [186, 62, 124, 248, 380, 210, 154, 290]; // length, km (per dashboard.html c79)
const PROJ_START = [2022, 2023, 2024, 2023, 2021, 2022, 2023, 2024];
const PROJ_END = [2026, 2027, 2027, 2026, 2027, 2026, 2026, 2028];

const OPRC_LOT = ['Lot 1 (A109N)', 'Lot 2 (A109W)', 'Lot 3 (A104)', 'Lot 4 (B23)', 'Lot 5 (A109E)', 'Lot 6 (A101)', 'Lot 7 (B30)'];
const OPRC_SCORE = [84, 76, 58, 91, 72, 65, 88];
const OPRC_GOOD = [78, 68, 52, 86, 64, 58, 82];
const OPRC_FAIR = [12, 18, 28, 8, 22, 26, 12];
const OPRC_POOR = [10, 14, 20, 6, 14, 16, 6];

const REG_LBL = ['Central', 'Northern', 'Eastern', 'Western', 'Southern', 'North Eastern'];
const DENSITY_MATRIX = [[3, 2, 1, 1], [2, 1, 2, 0], [1, 1, 1, 1], [2, 1, 1, 0], [1, 1, 1, 0], [1, 0, 1, 0]];
const CONTRACT_TYPE_LBL = ['OPRC', 'Periodic', 'Emergency', 'Development'];

const CONTRACT_YRS = ['FY22/23', 'FY23/24', 'FY24/25', 'FY25/26'];
const KM_UNDER_CONTRACT = [820, 980, 1120, 1240];

const CONTRACTOR_LBL = ['CICO Grp', 'China Cmm', 'Stirling', 'Roko', 'Dott Svcs', 'Others'];
const CONTRACTOR_SCORE = [88, 74, 82, 91, 78, 68];

const PIPELINE_STAGES = ['Identified', 'Feasibility', 'Appraisal', 'Design', 'Tender', 'Implementation', 'Completed'];
const PIPELINE_VALUES = [42, 28, 20, 16, 14, 14, 8];

const COMPLETION_YRS = ['FY20/21', 'FY21/22', 'FY22/23', 'FY23/24', 'FY24/25', 'FY25/26'];
const COMPLETION_KM = [180, 240, 320, 420, 520, 428];

// Derived stats (straightforward roll-ups of the arrays above)
const AVG_COMPLETION = Math.round(PROJ_PCT.reduce((a, b) => a + b, 0) / PROJ_PCT.length); // 58
const AVG_OPRC_SCORE = Math.round(OPRC_SCORE.reduce((a, b) => a + b, 0) / OPRC_SCORE.length); // 76
const OPRC_BAND_COUNTS = [
  { name: 'Excellent (≥80)', value: OPRC_SCORE.filter(v => v >= 80).length, color: DASH_C.green },
  { name: 'Good (65–79)', value: OPRC_SCORE.filter(v => v >= 65 && v < 80).length, color: DASH_C.yellow },
  { name: 'Needs Improvement (<65)', value: OPRC_SCORE.filter(v => v < 65).length, color: DASH_C.orange },
];

// Completion % grouped by status — quartiles approximated for small samples
function groupBoxStats(idxs: number[], name: string, color: string) {
  const vals = idxs.map(i => PROJ_PCT[i]).sort((a, b) => a - b);
  const min = vals[0], max = vals[vals.length - 1];
  const median = vals.length % 2 === 0
    ? (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2
    : vals[(vals.length - 1) / 2];
  return { name, min, q1: (min + median) / 2, median, q3: (median + max) / 2, max, color };
}
const ON_TRACK_IDX = PROJ_STATUS.map((s, i) => (s === 'On Track' ? i : -1)).filter(i => i >= 0);
const MINOR_DELAY_IDX = PROJ_STATUS.map((s, i) => (s === 'Minor Delay' ? i : -1)).filter(i => i >= 0);
const BEHIND_IDX = PROJ_STATUS.map((s, i) => (s === 'Behind' ? i : -1)).filter(i => i >= 0);

// km-under-contract waterfall (year-over-year deltas)
const CONTRACT_DELTAS = KM_UNDER_CONTRACT.slice(1).map((v, i) => v - KM_UNDER_CONTRACT[i]);

export default function ProjectsOverviewDashboard() {
  return (
    <div>
      <KpiStrip>
        <StatMini value="14" label="Active Projects" color={DASH_C.cyan} />
        <StatMini value="6" label="On Schedule" color={DASH_C.green} />
        <StatMini value="5" label="Minor Delay" color={DASH_C.yellow} />
        <StatMini value="3" label="Behind Schedule" color={DASH_C.pink} />
        <StatMini value="1,240 km" label="km Under Contract" color={DASH_C.orange} />
        <StatMini value="7" label="OPRC Lots Active" color={DASH_C.purple} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.cyan}>Projects, Contracts &amp; OPRC · 21 Views</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="Project Completion Progress (%)" accent={DASH_C.cyan} height={220}>
          <BarH data={PROJ_NAME.map((n, i) => ({ name: n, pct: PROJ_PCT[i] }))} yKey="name"
            series={[{ key: 'pct', name: '% Complete', color: DASH_C.cyan }]} unit="%" />
        </ChartBox>
        <ChartBox title="OPRC Contract Performance Scores" accent={DASH_C.purple} height={220}>
          <BarV data={OPRC_LOT.map((n, i) => ({ name: n.split(' (')[0], score: OPRC_SCORE[i] }))} xKey="name"
            series={[{ key: 'score', name: 'Score /100', color: DASH_C.purple }]} />
        </ChartBox>
        <ChartBox title="Project Status Distribution" subtitle="14 projects" accent={DASH_C.green} height={220}>
          <DonutChart data={[
            { name: 'On Schedule (6)', value: 6, color: DASH_C.green },
            { name: 'Minor Delay (5)', value: 5, color: DASH_C.yellow },
            { name: 'Behind (3)', value: 3, color: DASH_C.pink },
          ]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="12">
        <ChartBox title="Project Timeline" subtitle="start vs end year — size = % complete" accent={DASH_C.cyan} height={260}>
          <ScatterBubble
            data={PROJ_NAME.map((n, i) => ({ x: PROJ_START[i], y: PROJ_END[i], z: PROJ_PCT[i], label: n }))}
            xLabel="Start Year" yLabel="End Year" color={DASH_C.cyan}
          />
        </ChartBox>
        <ChartBox title="Projects · Budget vs Length" subtitle="size = % complete" accent={DASH_C.teal} height={260}>
          <ScatterBubble
            data={PROJ_NAME.map((n, i) => ({ x: PROJ_BN[i], y: PROJ_LEN_KM[i], z: PROJ_PCT[i], label: n }))}
            xLabel="Budget (bn UGX)" yLabel="Length (km)" color={DASH_C.teal}
          />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="Active Contracts by Type" accent={DASH_C.cyan} height={190}>
          <DonutChart data={[
            { name: 'OPRC (7)', value: 7, color: DASH_C.cyan },
            { name: 'Periodic Maint (4)', value: 4, color: DASH_C.yellow },
            { name: 'Emergency Works (3)', value: 3, color: DASH_C.orange },
          ]} innerRadius={36} />
        </ChartBox>
        <ChartBox title="km Under Contract by Year" accent={DASH_C.purple} height={190}>
          <BarV data={CONTRACT_YRS.map((y, i) => ({ year: y, km: KM_UNDER_CONTRACT[i] }))} xKey="year"
            series={[{ key: 'km', name: 'km', color: DASH_C.purple }]} unit="km" />
        </ChartBox>
        <ChartBox title="Top Contractor Performance" accent={DASH_C.green} height={190}>
          <BarV data={CONTRACTOR_LBL.map((n, i) => ({ name: n, score: CONTRACTOR_SCORE[i] }))} xKey="name"
            series={[{ key: 'score', name: 'Score /100', color: DASH_C.green }]} />
        </ChartBox>
        <ChartBox title="Project Pipeline Stages" accent={DASH_C.blue} height={190}>
          <FunnelC data={PIPELINE_STAGES.map((n, i) => ({ name: n, value: PIPELINE_VALUES[i] }))}
            colors={[DASH_C.blue, DASH_C.teal, DASH_C.cyan, '#00aacc', DASH_C.yellow, DASH_C.orange, DASH_C.green]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Budget vs Expenditure" subtitle="bn UGX, top 6 projects" accent={DASH_C.cyan} height={220}>
          <BarV data={PROJ_NAME.slice(0, 6).map((n, i) => ({
            name: n.split('-')[0].split(' ')[0], Budget: PROJ_BN[i], Spent: Math.round(PROJ_BN[i] * PROJ_PCT[i] / 100),
          }))} xKey="name" series={[{ key: 'Budget', name: 'Budget bn', color: DASH_C.cyan }, { key: 'Spent', name: 'Spent bn', color: DASH_C.green }]} unit="bn" />
        </ChartBox>
        <ChartBox title="Annual Works Completion Trend" subtitle="km completed / yr" accent={DASH_C.green} height={220}>
          <LineMulti data={COMPLETION_YRS.map((y, i) => ({ year: y, km: COMPLETION_KM[i] }))} xKey="year"
            series={[{ key: 'km', name: 'km Completed', color: DASH_C.green }]} area unit="km" />
        </ChartBox>
        <ChartBox title="Project Density" subtitle="region × contract type" accent={DASH_C.cyan} height={220}>
          <HeatGrid matrix={DENSITY_MATRIX} xLabels={CONTRACT_TYPE_LBL} yLabels={REG_LBL} accent={DASH_C.cyan} unit=" projects" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="OPRC Road Condition Achievement" subtitle="% of network per lot" accent={DASH_C.green} height={210}>
          <BarV data={OPRC_LOT.map((n, i) => ({
            name: n.split(' (')[0], Good: OPRC_GOOD[i], Fair: OPRC_FAIR[i], 'Poor+Crit': OPRC_POOR[i],
          }))} xKey="name" series={[
            { key: 'Good', name: 'Good %', color: DASH_C.green }, { key: 'Fair', name: 'Fair %', color: DASH_C.yellow },
            { key: 'Poor+Crit', name: 'Poor+Crit %', color: DASH_C.pink },
          ]} stacked unit="%" />
        </ChartBox>
        <ChartBox title="OPRC Lots" subtitle="performance score vs good-condition %" accent={DASH_C.purple} height={210}>
          <RadarTile
            data={OPRC_LOT.map((n, i) => ({ axis: n.split(' (')[0], score: OPRC_SCORE[i], goodPct: OPRC_GOOD[i] }))}
            series={[{ key: 'score', name: 'Score /100', color: DASH_C.purple }, { key: 'goodPct', name: 'Good %', color: DASH_C.green }]}
          />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Budget by Project" subtitle="treemap, bn UGX" accent={DASH_C.cyan} height={210}>
          <TreemapC data={PROJ_NAME.map((n, i) => ({ name: n, size: PROJ_BN[i] }))} />
        </ChartBox>
        <ChartBox title="Portfolio Avg Completion" subtitle="target 75%" accent={DASH_C.cyan} height={210}>
          <GaugeC value={AVG_COMPLETION} target={75} color={DASH_C.cyan} label="Across 8 tracked projects" />
        </ChartBox>
        <ChartBox title="OPRC Avg Performance" subtitle="target 80" accent={DASH_C.yellow} height={210}>
          <GaugeC value={AVG_OPRC_SCORE} max={100} target={80} color={DASH_C.yellow} suffix="" label="Across 7 active lots" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="OPRC Lots by Performance Band" accent={DASH_C.green} height={190}>
          <DonutChart data={OPRC_BAND_COUNTS} innerRadius={36} />
        </ChartBox>
        <ChartBox title="Project Length by Project" accent={DASH_C.teal} height={190}>
          <BarH data={PROJ_NAME.map((n, i) => ({ name: n, km: PROJ_LEN_KM[i] }))} yKey="name"
            series={[{ key: 'km', name: 'Length', color: DASH_C.teal }]} unit="km" />
        </ChartBox>
        <ChartBox title="Completion % by Status" subtitle="on track / minor delay / behind" accent={DASH_C.orange} height={190}>
          <BoxPlotApprox data={[
            groupBoxStats(ON_TRACK_IDX, 'On Track', DASH_C.green),
            groupBoxStats(MINOR_DELAY_IDX, 'Minor Delay', DASH_C.yellow),
            groupBoxStats(BEHIND_IDX, 'Behind', DASH_C.pink),
          ]} unit="%" />
        </ChartBox>
        <ChartBox title="km Under Contract Growth" subtitle="waterfall, FY22/23 → FY25/26" accent={DASH_C.purple} height={190}>
          <WaterfallC steps={[
            { name: 'FY22/23', delta: KM_UNDER_CONTRACT[0], isTotal: true },
            { name: '+FY23/24', delta: CONTRACT_DELTAS[0] },
            { name: '+FY24/25', delta: CONTRACT_DELTAS[1] },
            { name: '+FY25/26', delta: CONTRACT_DELTAS[2] },
            { name: 'FY25/26', delta: KM_UNDER_CONTRACT[3], isTotal: true },
          ]} unit="km" />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
