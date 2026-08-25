/**
 * PavementOverviewDashboard — RMS "Dashboard" tab, Pavement section.
 * Port of public/dashboard.html Tab 2 (PAVEMENT MANAGEMENT, charts c16–c30)
 * into live React/Recharts, extended to 23 chart tiles. Real figures from the
 * mockup's shared `D` data object (pavCond/unpavCond/treatLbl/costPerKm/etc).
 * No tables here — tabular breakdowns live under Exhaustive Tables / Deep Analytics.
 */
import {
  DASH_C, REGION_COLORS, DASHBOARD_COND_COLORS, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  DonutChart, PieChartTile, BarV, BarH, LineMulti, ScatterBubble, HeatGrid, TreemapC, GaugeC,
  FunnelC, RadarTile, BoxPlotApprox, WaterfallC,
} from '../../../shared/dashboardKit';

// ─── Data model (matches public/dashboard.html's single source of truth `D`) ─
const REG_LBL = ['Central', 'Northern', 'Eastern', 'Western', 'Southern', 'North Eastern'];
const REG_KM = [4436, 3920, 4290, 3000, 3300, 2356];

const COND_LBL = ['Good', 'Fair', 'Poor', 'Critical'];
const PAV_COND = [2242, 2242, 1281, 640]; // sums to PAVED=6405
const UNPAV_COND = [1490, 4469, 5959, 2979];
const TOTAL_COND = [3732, 6711, 7240, 3619]; // = PAV_COND + UNPAV_COND element-wise
const PAVED_TOTAL = PAV_COND.reduce((a, b) => a + b, 0); // 6405

const REG_GOOD = [780, 620, 700, 660, 640, 332];
const REG_FAIR = [1400, 1250, 1350, 1050, 1100, 561];
const REG_POOR = [1500, 1400, 1500, 900, 1100, 840];
const REG_CRIT = [756, 650, 740, 390, 460, 623];

const CLASS_LBL = ['Class A Trunk', 'Class B Regional', 'Class C District'];
const CLASS_KM = [4200, 5800, 11302];

const IRI_YRS = [2020, 2021, 2022, 2023, 2024, 2025];
const IRI_A = [3.2, 3.4, 3.3, 3.5, 3.4, 3.3];
const IRI_B = [4.1, 4.3, 4.5, 4.8, 4.6, 4.4];
const IRI_C = [5.8, 6.1, 6.3, 6.5, 6.4, 6.2];

const TREAT_LBL = ['Routine', 'Resealing', 'Overlay', 'Rehab', 'Reconstruction'];
const TREAT_KM = [8420, 1240, 890, 640, 215];
const TREAT_COST_BN = [38, 142, 280, 680, 1240]; // bn UGX, total program cost by treatment
const TREAT_COLORS = [DASH_C.green, DASH_C.yellow, '#ffa63f', '#ff5330', DASH_C.pink];

const COST_TREAT_LBL = ['Routine', 'Resealing', 'Overlay', 'Rehab', 'Reconstruct'];
const COST_PER_KM = [4.5, 118, 320, 780, 1450]; // mn UGX / km

// Evolution of paved condition mix 2020–2025 (% of paved network)
const EVOL_GOOD = [39, 38, 37, 36, 36, 35];
const EVOL_FAIR = [34, 34, 35, 35, 35, 35];
const EVOL_POOR = [18, 19, 19, 20, 20, 20];
const EVOL_CRIT = [9, 9, 9, 9, 9, 10];

// IRI heatmap: region × year
const IRI_HEAT_YEAR = [
  [3.1, 3.2, 3.3, 3.4, 3.3, 3.2],
  [3.8, 4.0, 4.3, 4.5, 4.4, 4.2],
  [4.2, 4.5, 4.8, 5.0, 4.9, 4.7],
  [3.9, 4.1, 4.4, 4.6, 4.5, 4.3],
  [3.5, 3.6, 3.8, 3.9, 3.8, 3.6],
  [4.4, 4.6, 4.9, 5.2, 5.1, 4.9],
];

// IRI heatmap: region × treatment need (deterministic, increases with severity)
const IRI_HEAT_TREAT = REG_LBL.map((_, i) => TREAT_LBL.map((_, j) => +(2 + i * 0.7 + j * 1.1).toFixed(1)));

// Pavement Condition Rating (PCR) raw sample distributions by region — matches dashboard.html's violin data
const PCR_RAW: Record<string, number[]> = {
  Central: [72, 68, 75, 80, 55, 62, 48, 85, 71, 66, 78, 58],
  Northern: [55, 48, 62, 58, 45, 70, 52, 40, 65, 50, 47, 60],
  Eastern: [60, 65, 58, 70, 55, 75, 68, 62, 72, 48, 55, 80],
  Western: [58, 64, 70, 75, 60, 68, 55, 72, 65, 58, 62, 78],
  Southern: [75, 80, 68, 85, 72, 78, 66, 82, 74, 70, 76, 84],
  'North Eastern': [52, 45, 58, 50, 42, 62, 48, 38, 56, 44, 46, 54],
};

function quantile(sorted: number[], q: number): number {
  const pos = q * (sorted.length - 1);
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

function boxStats(name: string, raw: number[], color: string) {
  const sorted = [...raw].sort((a, b) => a - b);
  return {
    name, min: sorted[0], q1: quantile(sorted, 0.25), median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75), max: sorted[sorted.length - 1], color,
  };
}

// Deterministic "segment sample" points — stable across renders (no Math.random()).
const AGE_IRI_POINTS = Array.from({ length: 42 }, (_, i) => {
  const seed = i * 53.7;
  const age = ((seed * 131 + 17) % 3000) / 100; // 0–30 yrs
  const iri = 1 + ((seed * 271 + 53) % 800) / 100; // 1–9 m/km
  const aadt = 200 + ((i * 613) % 10000);
  return { x: +age.toFixed(1), y: +iri.toFixed(2), z: aadt };
});

const IRI_AADT_POINTS = Array.from({ length: 40 }, (_, i) => {
  const seed = i * 41.3;
  const iri = 1 + ((seed * 97 + 13) % 900) / 100; // 1–10 m/km
  const aadt = 200 + Math.round((seed * 311 + 29) % 18000);
  return { x: +iri.toFixed(2), y: aadt };
});

export default function PavementOverviewDashboard() {
  return (
    <div>
      <KpiStrip>
        <StatMini value="35%" label="Paved Good" color={DASH_C.green} />
        <StatMini value="35%" label="Paved Fair" color={DASH_C.yellow} />
        <StatMini value="20%" label="Paved Poor" color={DASH_C.orange} />
        <StatMini value="10%" label="Paved Critical" color={DASH_C.red} />
        <StatMini value="3.8 m/km" label="Avg IRI (Paved)" color={DASH_C.cyan} />
        <StatMini value="58" label="PCI Score (0-100)" color={DASH_C.purple} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.cyan}>Pavement Condition &amp; Management · 23 Views</SectionHdr>

      <ChartGrid cols="4">
        <ChartBox title="Paved Road Condition" accent={DASH_C.green} height={190}>
          <DonutChart data={COND_LBL.map((n, i) => ({ name: n, value: PAV_COND[i] }))} colors={DASHBOARD_COND_COLORS} />
        </ChartBox>
        <ChartBox title="Unpaved Road Condition" accent={DASH_C.orange} height={190}>
          <DonutChart data={COND_LBL.map((n, i) => ({ name: n, value: UNPAV_COND[i] }))} colors={DASHBOARD_COND_COLORS} />
        </ChartBox>
        <ChartBox title="Overall Condition" subtitle="km" accent={DASH_C.pink} height={190}>
          <BarV data={COND_LBL.map((n, i) => ({ name: n, km: TOTAL_COND[i] }))} xKey="name"
            series={[{ key: 'km', name: 'Total km', color: DASH_C.pink }]} unit="km" />
        </ChartBox>
        <ChartBox title="Pavement Condition Index" subtitle="target 65 · network-weighted" accent={DASH_C.yellow} height={190}>
          <GaugeC value={58} max={100} target={65} color={DASH_C.yellow} suffix="" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="12">
        <ChartBox title="Condition by Region" subtitle="km, stacked" accent={DASH_C.cyan} height={250}>
          <BarV data={REG_LBL.map((r, i) => ({ name: r, Good: REG_GOOD[i], Fair: REG_FAIR[i], Poor: REG_POOR[i], Critical: REG_CRIT[i] }))}
            xKey="name" series={[
              { key: 'Good', name: 'Good', color: DASH_C.green }, { key: 'Fair', name: 'Fair', color: DASH_C.yellow },
              { key: 'Poor', name: 'Poor', color: DASH_C.orange }, { key: 'Critical', name: 'Critical', color: DASH_C.pink },
            ]} unit="km" stacked />
        </ChartBox>
        <ChartBox title="Segment Condition" subtitle="age vs IRI — size = AADT" accent={DASH_C.purple} height={250}>
          <ScatterBubble data={AGE_IRI_POINTS} xLabel="Age (yrs)" yLabel="IRI (m/km)" color={DASH_C.purple} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="IRI Trend by Road Class" subtitle="2020–2025" accent={DASH_C.cyan} height={210}>
          <LineMulti data={IRI_YRS.map((y, i) => ({ year: y, ClassA: IRI_A[i], ClassB: IRI_B[i], ClassC: IRI_C[i] }))} xKey="year"
            series={[
              { key: 'ClassA', name: 'Class A Trunk', color: DASH_C.cyan }, { key: 'ClassB', name: 'Class B Regional', color: DASH_C.yellow },
              { key: 'ClassC', name: 'Class C District', color: DASH_C.orange },
            ]} unit=" m/km" area />
        </ChartBox>
        <ChartBox title="IRI Heatmap" subtitle="region × year" accent={DASH_C.orange} height={210}>
          <HeatGrid matrix={IRI_HEAT_YEAR} xLabels={IRI_YRS.map(String)} yLabels={REG_LBL} accent={DASH_C.orange} unit=" m/km" />
        </ChartBox>
        <ChartBox title="Treatment Needs by Type" subtitle="km" accent={DASH_C.teal} height={210}>
          <BarH data={TREAT_LBL.map((n, i) => ({ name: n, km: TREAT_KM[i] }))} yKey="name"
            series={[{ key: 'km', name: 'km', color: DASH_C.teal }]} unit="km" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="IRI vs Traffic Volume" accent={DASH_C.pink} height={210}>
          <ScatterBubble data={IRI_AADT_POINTS} xLabel="IRI (m/km)" yLabel="AADT (veh/day)" color={DASH_C.pink} />
        </ChartBox>
        <ChartBox title="Condition Evolution" subtitle="% of paved network, 2020–2025" accent={DASH_C.green} height={210}>
          <LineMulti data={IRI_YRS.map((y, i) => ({ year: y, Good: EVOL_GOOD[i], Fair: EVOL_FAIR[i], Poor: EVOL_POOR[i], Critical: EVOL_CRIT[i] }))}
            xKey="year" series={[
              { key: 'Good', name: 'Good %', color: DASH_C.green }, { key: 'Fair', name: 'Fair %', color: DASH_C.yellow },
              { key: 'Poor', name: 'Poor %', color: DASH_C.orange }, { key: 'Critical', name: 'Critical %', color: DASH_C.pink },
            ]} unit="%" area />
        </ChartBox>
        <ChartBox title="Cost per km by Treatment" subtitle="mn UGX/km" accent={DASH_C.yellow} height={210}>
          <BarV data={COST_TREAT_LBL.map((n, i) => ({ name: n, cost: COST_PER_KM[i] }))} xKey="name"
            series={[{ key: 'cost', name: 'mn UGX/km', color: DASH_C.yellow }]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="IRI Heatmap" subtitle="region × treatment need" accent={DASH_C.red} height={210}>
          <HeatGrid matrix={IRI_HEAT_TREAT} xLabels={TREAT_LBL} yLabels={REG_LBL} accent={DASH_C.red} unit=" m/km" />
        </ChartBox>
        <ChartBox title="PCR Distribution by Region" subtitle="0–100, box approximation of violin" accent={DASH_C.cyan} height={210}>
          <BoxPlotApprox data={REG_LBL.map(r => boxStats(r, PCR_RAW[r], REGION_COLORS[REG_LBL.indexOf(r)]))} />
        </ChartBox>
        <ChartBox title="Treatment Pipeline" subtitle="FY25/26" accent={DASH_C.blue} height={210}>
          <FunnelC data={[
            { name: 'Surveyed Links', value: 21302 }, { name: 'Condition Assessed', value: 20840 },
            { name: 'Treatment Planned', value: 8420 }, { name: 'Budgeted', value: 4200 },
            { name: 'Under Contract', value: 1240 }, { name: 'Completed FY25', value: 428 },
          ]} colors={[DASH_C.cyan, '#00ccdd', '#00aacc', DASH_C.yellow, DASH_C.orange, DASH_C.green]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Treatment Needs" subtitle="treemap, sized by km" accent={DASH_C.teal} height={210}>
          <TreemapC data={TREAT_LBL.map((n, i) => ({ name: n, size: TREAT_KM[i] }))} colors={TREAT_COLORS} />
        </ChartBox>
        <ChartBox title="Regional Condition Comparison" subtitle="good % vs critical %" accent={DASH_C.purple} height={210}>
          <RadarTile
            data={REG_LBL.map((r, i) => ({ axis: r, goodPct: Math.round(REG_GOOD[i] / REG_KM[i] * 100), critPct: Math.round(REG_CRIT[i] / REG_KM[i] * 100) }))}
            series={[{ key: 'goodPct', name: 'Good %', color: DASH_C.green }, { key: 'critPct', name: 'Critical %', color: DASH_C.pink }]}
          />
        </ChartBox>
        <ChartBox title="Waterfall — Paved Condition Breakdown" subtitle="km" accent={DASH_C.pink} height={210}>
          <WaterfallC steps={[
            { name: 'Paved Total', delta: PAVED_TOTAL, isTotal: true }, { name: '−Critical', delta: -PAV_COND[3] },
            { name: '−Poor', delta: -PAV_COND[2] }, { name: '−Fair', delta: -PAV_COND[1] }, { name: '=Good', delta: PAV_COND[0], isTotal: true },
          ]} unit="km" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Road Class Distribution" accent={DASH_C.blue} height={190}>
          <PieChartTile data={CLASS_LBL.map((n, i) => ({ name: n, value: CLASS_KM[i] }))} colors={[DASH_C.cyan, '#00aacc', '#006688']} />
        </ChartBox>
        <ChartBox title="Treatment Program Cost" subtitle="bn UGX by type" accent={DASH_C.orange} height={190}>
          <BarH data={TREAT_LBL.map((n, i) => ({ name: n, cost: TREAT_COST_BN[i] }))} yKey="name"
            series={[{ key: 'cost', name: 'bn UGX', color: DASH_C.orange }]} />
        </ChartBox>
        <ChartBox title="Treatment Mix" subtitle="km, by type" accent={DASH_C.green} height={190}>
          <DonutChart data={TREAT_LBL.map((n, i) => ({ name: n, value: TREAT_KM[i] }))} colors={TREAT_COLORS} innerRadius={36} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Avg IRI (Paved)" subtitle="target 3.0 m/km" accent={DASH_C.orange} height={190}>
          <GaugeC value={3.8} max={10} target={3.0} color={DASH_C.orange} suffix=" m/km" />
        </ChartBox>
        <ChartBox title="Paved vs Unpaved Condition" subtitle="km, grouped" accent={DASH_C.cyan} height={190}>
          <BarV data={COND_LBL.map((n, i) => ({ name: n, Paved: PAV_COND[i], Unpaved: UNPAV_COND[i] }))} xKey="name"
            series={[{ key: 'Paved', name: 'Paved', color: DASH_C.cyan }, { key: 'Unpaved', name: 'Unpaved', color: DASH_C.orange }]} unit="km" />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
