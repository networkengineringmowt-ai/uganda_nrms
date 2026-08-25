/**
 * RoadSafetyOverviewDashboard - RMS "Dashboard" tab, Road Safety section.
 * Port of public/dashboard.html Tab 7 (ROAD SAFETY & BLACKSPOTS, charts c88–c100)
 * into live React/Recharts, extended beyond the original 13 views. Real 2016–2025
 * fatality, blackspot-corridor, enforcement-pipeline and RSE-compliance figures
 * (matches the platform's official 3,247 2025-fatality / 847-blackspot count).
 * No tables here - tabular breakdowns live under Exhaustive Tables / Deep Analytics.
 */
import {
  DASH_C, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  LineMulti, DonutChart, PieChartTile, BarV, BarH, ScatterBubble, HeatGrid,
  TreemapC, GaugeC, FunnelC, RadarTile, SunburstApprox, BoxPlotApprox, WaterfallC,
} from '../../../shared/dashboardKit';

// ─── Data model (matches public/dashboard.html's single source of truth `D`) ─
const SAFETY_YRS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const FATALITIES = [3891, 3744, 3820, 3698, 2940, 3180, 3340, 3480, 3380, 3247];
const UN_TARGET = [2800, 2700, 2750, 2700, 2650, 2600, 2550, 2500, 2450, 2400];

const CAUSE_LBL = ['Speeding', 'Overtaking', 'Drunk Drive', 'Poor Road', 'Pedestrian', 'Mechanical'];
const CAUSE_PCT = [38, 22, 18, 12, 6, 4];
const CAUSE_COLORS = [DASH_C.pink, DASH_C.orange, DASH_C.yellow, DASH_C.cyan, DASH_C.purple, DASH_C.gray];

const ACC_CORRIDOR = ['Busega Jct', 'Namawojjolo', 'Lugazi Town', 'Katosi Cnr', 'Kyambogo', 'Namasuba', 'Wakiso', 'Luwero', 'Mityana', 'Masaka'];
const ACC_COUNT = [420, 380, 340, 312, 290, 268, 240, 214, 198, 182];

const FATAL_USER_LBL = ['Motorcycles', 'Peds', 'Heavy Trucks', 'Minibus/Taxi', 'Private Cars', 'Bicycles', 'Tuk-tuk'];
const FATAL_USER_VAL = [1240, 820, 468, 340, 218, 98, 63];

const TOD_LBL = ['00-03', '03-06', '06-09', '09-12', '12-15', '15-18', '18-21', '21-24'];
const TOD_PCT = [8.2, 4.1, 12.4, 9.8, 11.2, 14.8, 18.4, 21.1];

// Region fatalities 2016–2025 (matches D.regLbl / D.regCol from the network model).
const REG_LBL = ['Central', 'Northern', 'Eastern', 'Western', 'Southern', 'North Eastern'];
const REG_COL = [DASH_C.cyan, DASH_C.green, DASH_C.yellow, DASH_C.purple, DASH_C.pink, DASH_C.orange];
const REG_KM = [4436, 3920, 4290, 3000, 3300, 2356]; // reused from network model for regional-share tiles
const REG_FATAL = [
  [480, 460, 478, 452, 340, 368, 380, 398, 386, 370],
  [380, 366, 372, 358, 268, 292, 302, 316, 308, 294],
  [340, 326, 334, 320, 240, 262, 272, 284, 276, 264],
  [620, 592, 636, 568, 492, 258, 386, 382, 410, 319],
  [300, 290, 296, 284, 214, 232, 242, 252, 246, 236],
  [260, 250, 256, 246, 186, 202, 210, 218, 214, 204],
];

const ENFORCE_LBL = ['Accidents Reported', 'Investigated', 'Charges Filed', 'Prosecuted', 'Fines Paid', 'Convictions'];
const ENFORCE_VAL = [28420, 18640, 9820, 4210, 2840, 1420];

const INVEST_YRS = SAFETY_YRS.slice(-4); // [2022,2023,2024,2025]
const INVEST_BN = [2.8, 4.2, 6.8, 8.4];
const INVEST_BASE_FATAL = [3891, 3698, 2940, 3247]; // as plotted against INVEST_YRS in the source
const FATAL_INDEX = INVEST_BASE_FATAL.map(v => +(v / INVEST_BASE_FATAL[0] * 100).toFixed(1));

const IRI_CORRIDOR = [2.1, 2.8, 4.2, 3.6, 2.4, 5.8, 3.9, 7.2, 1.8, 4.4];
const ACC_RATE_CORRIDOR = [42, 68, 148, 88, 54, 240, 102, 380, 38, 120];
const IRI_SCATTER = ACC_CORRIDOR.map((name, i) => ({ x: IRI_CORRIDOR[i], y: ACC_RATE_CORRIDOR[i], z: ACC_RATE_CORRIDOR[i], label: name.split('-')[0] }));

const RSE_LBL = ['Speed Humps', 'Guardrails', 'Road Signs', 'Line Marking', 'Lighting', 'Rumble Strips', 'Barrier Posts'];
const RSE_PCT = [82, 64, 71, 58, 42, 76, 68];
const RSE_AVG = Math.round(RSE_PCT.reduce((a, b) => a + b, 0) / RSE_PCT.length);

// "Worst blackspot" year-over-year accident & fatality count - matches the 42/yr KPI.
const WORST_ACC_PER_YR = [42, 38, 31, 28, 26, 24, 22, 19, 18, 17];
const WORST_ACC_FATAL = [8, 6, 5, 4, 3, 4, 3, 2, 3, 2];

// Accident risk heatmap: speed limit × roughness (IRI) - deterministic formula from the source.
const SPEED_LBL = ['50', '60', '80', '100', '110'];
const SPEED = [50, 60, 80, 100, 110];
const IRI_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8];
const RISK_Z = IRI_LEVELS.map(r => SPEED.map(s => Math.round(5 + r * 8 + (s / 50) * 12 + r * (s / 50) * 4)));

// Accident heatmap: month × time-of-day - deterministic seasonal/diurnal pattern (no live incident feed yet).
const MONTH_LBL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_HR_MATRIX = MONTH_LBL.map((_, m) =>
  TOD_LBL.map((_, h) => Math.round(50 + Math.sin((h - 2) * 0.8) * 30 + Math.cos(m * 0.5) * 20))
);

// Blackspot severity buckets from the top-10 corridor accident counts (matches c90's colour thresholds).
const SEVERITY_BUCKETS = [
  { name: 'High (≥350/yr)', value: ACC_COUNT.filter(v => v >= 350).reduce((a, b) => a + b, 0), color: DASH_C.pink },
  { name: 'Medium (250–349/yr)', value: ACC_COUNT.filter(v => v >= 250 && v < 350).reduce((a, b) => a + b, 0), color: DASH_C.orange },
  { name: 'Low (<250/yr)', value: ACC_COUNT.filter(v => v < 250).reduce((a, b) => a + b, 0), color: DASH_C.yellow },
];
const severityColor = (v: number) => (v >= 350 ? DASH_C.pink : v >= 250 ? DASH_C.orange : DASH_C.yellow);
const CORRIDOR_SEVERITY = ACC_CORRIDOR.map((name, i) => ({ name: name.split(' ')[0], value: ACC_COUNT[i], color: severityColor(ACC_COUNT[i]) }));

// Estimated accident count by cause (causePct applied to the 2025 "Accidents Reported" base).
const CAUSE_COUNT = CAUSE_PCT.map(p => Math.round(p / 100 * ENFORCE_VAL[0]));

function boxStats(sorted: number[], color: string, name: string) {
  return { name, min: sorted[0], q1: sorted[2], median: (sorted[4] + sorted[5]) / 2, q3: sorted[7], max: sorted[9], color };
}
const FATAL_SORTED = [...FATALITIES].sort((a, b) => a - b);

export default function RoadSafetyOverviewDashboard() {
  return (
    <div>
      <KpiStrip>
        <StatMini value={FATALITIES[9].toLocaleString()} label="2025 Fatalities" color={DASH_C.red} />
        <StatMini value="4.2" label="Rate/10k Vehicles" color={DASH_C.orange} />
        <StatMini value="847" label="Blackspots National" color={DASH_C.yellow} />
        <StatMini value="-3.2%" label="YoY Fatality Trend" color={DASH_C.green} />
        <StatMini value={String(WORST_ACC_PER_YR[0])} label="Worst Blackspot/yr" color={DASH_C.purple} />
        <StatMini value="18,400" label="Highest AADT Corridor" color={DASH_C.cyan} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.red}>Road Safety &amp; Blackspots · 22 Views</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="Road Fatalities Trend (2016–2025)" subtitle="vs UN Decade Target" accent={DASH_C.red} height={210}>
          <LineMulti
            data={SAFETY_YRS.map((y, i) => ({ year: y, Fatalities: FATALITIES[i], 'UN Target': UN_TARGET[i] }))}
            xKey="year"
            series={[{ key: 'Fatalities', name: 'Fatalities/yr', color: DASH_C.red }, { key: 'UN Target', name: 'UN Target', color: DASH_C.yellow }]}
            area
          />
        </ChartBox>
        <ChartBox title="Road Accident Causes (%)" accent={DASH_C.orange} height={210}>
          <DonutChart data={CAUSE_LBL.map((n, i) => ({ name: n, value: CAUSE_PCT[i], color: CAUSE_COLORS[i] }))} innerRadius={40} />
        </ChartBox>
        <ChartBox title="Top 10 Accident Blackspot Corridors" subtitle="accidents/yr" accent={DASH_C.pink} height={210}>
          <BarH data={ACC_CORRIDOR.map((n, i) => ({ corridor: n, acc: ACC_COUNT[i] }))} yKey="corridor" series={[{ key: 'acc', name: 'Accidents/yr', color: DASH_C.pink }]} />
        </ChartBox>
      </ChartGrid>

      {/* Blackspot Locations (lng/lat scatter) removed per platform rule: coordinates
          belong on maps only, never charts. Corridor accident counts are already
          covered above by "Top 10 Accident Blackspot Corridors". */}
      <ChartGrid cols="1">
        <ChartBox title="Fatalities by Region 2016–2025" accent={DASH_C.cyan} height={260}>
          <LineMulti data={SAFETY_YRS.map((y, i) => {
            const row: any = { year: y };
            REG_LBL.forEach((r, ri) => { row[r] = REG_FATAL[ri][i]; });
            return row;
          })} xKey="year" series={REG_LBL.map((r, i) => ({ key: r, name: r, color: REG_COL[i] }))} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="Fatalities by Road User Type" subtitle="2025" accent={DASH_C.red} height={200}>
          <BarV data={FATAL_USER_LBL.map((n, i) => ({ name: n, deaths: FATAL_USER_VAL[i] }))} xKey="name" series={[{ key: 'deaths', name: 'Deaths', color: DASH_C.red }]} />
        </ChartBox>
        <ChartBox title="Accidents by Time of Day" subtitle="% of all accidents" accent={DASH_C.orange} height={200}>
          <BarV data={TOD_LBL.map((n, i) => ({ name: n, pct: TOD_PCT[i] }))} xKey="name" series={[{ key: 'pct', name: '% of accidents', color: DASH_C.orange }]} unit="%" />
        </ChartBox>
        <ChartBox title="RSE Compliance by Measure" subtitle="% of network" accent={DASH_C.teal} height={200}>
          <BarV data={RSE_LBL.map((n, i) => ({ name: n, pct: RSE_PCT[i] }))} xKey="name" series={[{ key: 'pct', name: '% compliant', color: DASH_C.teal }]} unit="%" />
        </ChartBox>
        <ChartBox title="Overall RSE Compliance" subtitle="target 80% of network" accent={DASH_C.green} height={200}>
          <GaugeC value={RSE_AVG} target={80} color={DASH_C.green} label="avg across 7 measures" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Accident Heatmap" subtitle="month × time of day" accent={DASH_C.pink} height={300}>
          <HeatGrid matrix={MONTH_HR_MATRIX} xLabels={TOD_LBL} yLabels={MONTH_LBL} accent={DASH_C.pink} unit=" acc." />
        </ChartBox>
        <ChartBox title="Accident Risk Heatmap" subtitle="speed limit (km/h) × roughness (IRI m/km)" accent={DASH_C.orange} height={300}>
          <HeatGrid matrix={RISK_Z} xLabels={SPEED_LBL} yLabels={IRI_LEVELS.map(String)} accent={DASH_C.orange} unit=" acc/yr" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Road Safety Enforcement Pipeline" subtitle="2025" accent={DASH_C.blue} height={220}>
          <FunnelC data={ENFORCE_LBL.map((n, i) => ({ name: n, value: ENFORCE_VAL[i] }))} colors={[DASH_C.pink, DASH_C.orange, DASH_C.yellow, DASH_C.cyan, DASH_C.teal, DASH_C.green]} />
        </ChartBox>
        <ChartBox title="Safety Investment vs Fatality Index" subtitle="bn UGX / index, base 2022" accent={DASH_C.red} height={220}>
          <BarV
            data={INVEST_YRS.map((y, i) => ({ name: String(y), Investment: INVEST_BN[i], Index: FATAL_INDEX[i] }))}
            xKey="name"
            series={[{ key: 'Investment', name: 'Investment (bn UGX)', color: DASH_C.pink }, { key: 'Index', name: 'Fatality Index', color: DASH_C.orange }]}
          />
        </ChartBox>
        <ChartBox title="IRI vs Accident Rate by Corridor" accent={DASH_C.purple} height={220}>
          <ScatterBubble data={IRI_SCATTER} xLabel="IRI (m/km)" yLabel="Accidents/yr" color={DASH_C.purple} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Accidents by Corridor" subtitle="treemap, sized by accidents/yr" accent={DASH_C.orange} height={210}>
          <TreemapC data={ACC_CORRIDOR.map((n, i) => ({ name: n.split(' ')[0], size: ACC_COUNT[i] }))} colors={[DASH_C.pink, DASH_C.orange, DASH_C.yellow, DASH_C.cyan, DASH_C.purple, DASH_C.green, DASH_C.teal, DASH_C.blue, DASH_C.pink, DASH_C.orange]} />
        </ChartBox>
        <ChartBox title="Regional Safety Profile" subtitle="fatality share % vs network-km share %" accent={DASH_C.cyan} height={210}>
          <RadarTile
            data={REG_LBL.map((r, i) => {
              const fatalSum = REG_FATAL.reduce((s, row) => s + row[9], 0);
              const kmSum = REG_KM.reduce((s, v) => s + v, 0);
              return { axis: r, fatalShare: Math.round(REG_FATAL[i][9] / fatalSum * 100), kmShare: Math.round(REG_KM[i] / kmSum * 100) };
            })}
            series={[{ key: 'fatalShare', name: 'Fatality Share %', color: DASH_C.red }, { key: 'kmShare', name: 'Network Share %', color: DASH_C.cyan }]}
          />
        </ChartBox>
        <ChartBox title="Worst Blackspot Trend" subtitle="Busega Jct, accidents vs fatalities/yr" accent={DASH_C.purple} height={210}>
          <LineMulti
            data={SAFETY_YRS.map((y, i) => ({ year: y, Accidents: WORST_ACC_PER_YR[i], Fatalities: WORST_ACC_FATAL[i] }))}
            xKey="year"
            series={[{ key: 'Accidents', name: 'Accidents/yr', color: DASH_C.purple }, { key: 'Fatalities', name: 'Fatalities/yr', color: DASH_C.red }]}
          />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Accident Causes - Estimated Count" subtitle="2025, from cause share × accidents reported" accent={DASH_C.yellow} height={210}>
          <BarH data={CAUSE_LBL.map((n, i) => ({ cause: n, count: CAUSE_COUNT[i] }))} yKey="cause" series={[{ key: 'count', name: 'Est. accidents', color: DASH_C.yellow }]} />
        </ChartBox>
        <ChartBox title="Annual Fatalities Distribution" subtitle="2016–2025" accent={DASH_C.red} height={210}>
          <BoxPlotApprox data={[boxStats(FATAL_SORTED, DASH_C.red, '2016–2025')]} unit=" deaths" />
        </ChartBox>
        <ChartBox title="Blackspot Severity Mix" subtitle="inner = severity band, outer = corridor" accent={DASH_C.pink} height={210}>
          <SunburstApprox inner={SEVERITY_BUCKETS} outer={CORRIDOR_SEVERITY} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Fatality Trend Waterfall" subtitle="2016 → 2025, year-over-year change" accent={DASH_C.green} height={220}>
          <WaterfallC steps={[
            { name: '2016', delta: FATALITIES[0], isTotal: true },
            ...SAFETY_YRS.slice(1).map((y, i) => ({ name: String(y), delta: FATALITIES[i + 1] - FATALITIES[i] })),
            { name: '2025', delta: FATALITIES[9], isTotal: true },
          ]} unit=" deaths" />
        </ChartBox>
        <ChartBox title="Blackspot Severity Share" subtitle="top-10 corridors, by accidents/yr" accent={DASH_C.orange} height={220}>
          <PieChartTile data={SEVERITY_BUCKETS} />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
