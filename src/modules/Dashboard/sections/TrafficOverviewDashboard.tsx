/**
 * TrafficOverviewDashboard — RMS "Dashboard" tab traffic-intelligence view.
 * Port of public/dashboard.html Tab 3 (TRAFFIC INTELLIGENCE, charts c31–c45) into
 * live React/Recharts, extended to 21 chart tiles. Real corridor AADT counts,
 * ATC station network, vehicle composition, and 3-scenario forecast figures
 * (matches the platform's official 3,847 avg AADT / 18,400 Kla-Entebbe peak).
 * No tables here — tabular breakdowns live under Exhaustive Tables / Deep Analytics.
 */
import {
  DASH_C, REGION_COLORS, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  BarH, BarV, LineMulti, DonutChart, PieChartTile, ScatterBubble, HeatGrid,
  BoxPlotApprox, TreemapC, RadarTile, FunnelC, GaugeC,
} from '../../../shared/dashboardKit';

// ─── Data model (matches public/dashboard.html's single source of truth `D`) ─
const CORRIDORS = ['Kla-Entebbe', 'Kla-Jinja', 'Kla-Gulu', 'Kla-Mbarara', 'Jinja-Tororo', 'Masaka-Mba', 'Mba-Kabale', 'Gulu-Nimule', 'Hoima-Kafu', 'FP-Kasese'];
const CORR_AADT = [18400, 6480, 4820, 3820, 2180, 2620, 1670, 1240, 1840, 2140];
const CORR_GROWTH = [4.2, 4.0, 3.8, 3.5, 3.1, 3.2, 2.9, 3.3, 5.1, 3.7];
const CORR_HGV = [12, 18, 22, 28, 28, 26, 24, 22, 20, 18];
const CORR_IRI = [2.8, 3.1, 4.8, 5.9, 4.2, 5.4, 5.6, 6.1, 4.4, 4.8];

const VEH_LBL = ['Cars/SUV', 'Motorcycle', 'Light Comm.', 'HGV', 'Buses', 'NMT'];
const VEH_COMP = [45, 15, 18, 12, 7, 3];

const NAT_YRS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const NAT_AADT = [2890, 3006, 3126, 3251, 3141, 3267, 3397, 3533, 3675, 3847];
const KLA_EBB_TREND = [14200, 14800, 15400, 16100, 15200, 16000, 16800, 17400, 18000, 18400];

const FC_YRS = [2016, 2018, 2020, 2022, 2024, 2026, 2028, 2030, 2032, 2034, 2035];
const FC_NORM = [2890, 3126, 3141, 3397, 3675, 3975, 4299, 4650, 5029, 5439, 5656];
const FC_OPT = [2890, 3247, 3460, 3814, 4230, 4704, 5200, 5700, 6200, 6800, 7100];
const FC_PESS = [2890, 3006, 2821, 2935, 3054, 3177, 3306, 3439, 3578, 3723, 3797];

const HOUR_HR = ['00', '02', '04', '06', '07', '08', '09', '10', '12', '14', '16', '17', '18', '20', '22'];
const HOUR_PCT = [8, 5, 4, 18, 42, 88, 74, 62, 68, 72, 84, 100, 92, 45, 18];

const DAY_LBL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_PCT = [82, 85, 88, 86, 100, 74, 42];

const MONTH_LBL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_PCT = [88, 92, 96, 94, 100, 98, 95, 97, 100, 96, 92, 84];

// ATC (Automatic Traffic Counter) station network — 25 stations, location & volume.
const ST_LAT = [0.42, 0.85, 1.62, 2.78, 3.02, 0.31, -0.33, -0.61, -0.54, 0.33, 0.44, 0.61, 0.70, 0.30, 0.06, -0.36, -1.25, -0.62, 0.94, 0.62, 3.60, -1.24, 1.43, 0.65, 2.25];
const ST_LNG = [32.58, 32.49, 31.98, 32.30, 32.38, 32.55, 31.74, 30.64, 30.18, 32.65, 33.20, 33.49, 34.18, 32.58, 32.46, 31.62, 29.99, 30.70, 33.12, 33.50, 32.08, 29.98, 31.36, 30.27, 32.23];
const ST_AADT = [4820, 3140, 2860, 2140, 1480, 5210, 3820, 2940, 1840, 6480, 4210, 2840, 2180, 18400, 9840, 2620, 1670, 2180, 1420, 1680, 1240, 1180, 1840, 2140, 2480];
const ATC_STATIONS = ST_LAT.map((lat, i) => ({ x: ST_LNG[i], y: lat, z: ST_AADT[i] }));

const REG_LBL = ['Central', 'Northern', 'Eastern', 'Western', 'Southern', 'North Eastern'];
const REG_YRS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const REG_AADT_TREND = [
  [2200, 2280, 2180, 2270, 2360, 2460, 2560, 2670], // Central
  [1840, 1910, 1830, 1910, 1990, 2070, 2160, 2240], // Northern
  [1680, 1750, 1680, 1750, 1820, 1900, 1980, 2060], // Eastern
  [1900, 1970, 1890, 1970, 2050, 2130, 2220, 2310], // Western
  [1500, 1560, 1490, 1560, 1620, 1690, 1760, 1830], // Southern
  [980, 1020, 990, 1030, 1080, 1120, 1170, 1210],  // North Eastern
];

const CLASS_A_AADT = [4200, 6480, 8200, 12000, 18400, 3820, 5200, 9400];
const CLASS_B_AADT = [1200, 1840, 2180, 2620, 3140, 3820, 1670, 2140];
const CLASS_C_AADT = [280, 450, 640, 820, 1100, 1380, 900, 620, 740];

// Generic quartile helper (linear interpolation), works for any sample size.
function boxStats(values: number[], color: string, name: string) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const q = (p: number) => {
    const idx = p * (n - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  return { name, min: sorted[0], q1: q(0.25), median: q(0.5), q3: q(0.75), max: sorted[n - 1], color };
}

// AADT seasonality by corridor × month — same seasonal curve used in the reference mockup.
const SEASON_MATRIX = CORRIDORS.map((_, ci) =>
  MONTH_LBL.map((_, mi) => Math.round(CORR_AADT[ci] * (0.85 + 0.15 * Math.sin((mi / 6) * Math.PI))))
);

// Top 5 corridors by AADT (Kla-Entebbe, Kla-Jinja, Kla-Gulu, Kla-Mbarara, Masaka-Mba).
const TOP5_IDX = [0, 1, 2, 3, 5];
const TOTAL_AADT_SUM = CORR_AADT.reduce((a, b) => a + b, 0);
const TOP5_AADT_SUM = TOP5_IDX.reduce((s, i) => s + CORR_AADT[i], 0);
const REST_AADT_SUM = TOTAL_AADT_SUM - TOP5_AADT_SUM;

export default function TrafficOverviewDashboard() {
  return (
    <div>
      <KpiStrip>
        <StatMini value="3,847" label="Avg AADT (National)" color={DASH_C.yellow} />
        <StatMini value="18,400" label="Peak AADT (Kla-Ebb)" color={DASH_C.cyan} />
        <StatMini value="4.2%" label="Growth Rate/yr" color={DASH_C.green} />
        <StatMini value="23%" label="Heavy Vehicle %" color={DASH_C.orange} />
        <StatMini value="25" label="ATC Stations" color={DASH_C.purple} />
        <StatMini value="5,656" label="AADT Forecast 2035" color={DASH_C.pink} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.cyan}>Traffic Counts &amp; Forecasting · 21 Views</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="AADT by Major Corridor" accent={DASH_C.pink} height={210}>
          <BarH data={CORRIDORS.map((c, i) => ({ corridor: c, aadt: CORR_AADT[i] }))} yKey="corridor"
            series={[{ key: 'aadt', name: 'AADT (veh/day)', color: DASH_C.pink }]} />
        </ChartBox>
        <ChartBox title="National AADT Trend" subtitle="2016–2025" accent={DASH_C.yellow} height={210}>
          <LineMulti data={NAT_YRS.map((y, i) => ({ year: y, National: NAT_AADT[i], 'Kla-Entebbe': KLA_EBB_TREND[i] }))} xKey="year"
            series={[{ key: 'National', name: 'National Avg AADT', color: DASH_C.yellow }, { key: 'Kla-Entebbe', name: 'Kla-Entebbe', color: DASH_C.pink }]} />
        </ChartBox>
        <ChartBox title="Vehicle Class Composition" subtitle="% of AADT" accent={DASH_C.cyan} height={210}>
          <DonutChart data={VEH_LBL.map((n, i) => ({ name: n, value: VEH_COMP[i] }))}
            colors={[DASH_C.cyan, DASH_C.green, DASH_C.yellow, DASH_C.orange, DASH_C.purple, DASH_C.gray]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="12">
        <ChartBox title="ATC Station Network" subtitle="location & volume — size=AADT" accent={DASH_C.purple} height={260}>
          <ScatterBubble data={ATC_STATIONS} xLabel="Longitude" yLabel="Latitude" color={DASH_C.purple} />
        </ChartBox>
        <ChartBox title="AADT Forecast 2016–2035" subtitle="3 scenarios" accent={DASH_C.cyan} height={260}>
          <LineMulti data={FC_YRS.map((y, i) => ({ year: y, Normal: FC_NORM[i], Optimistic: FC_OPT[i], Pessimistic: FC_PESS[i] }))} xKey="year"
            series={[
              { key: 'Normal', name: 'Normal (4%/yr)', color: DASH_C.cyan },
              { key: 'Optimistic', name: 'Optimistic (6%/yr)', color: DASH_C.green },
              { key: 'Pessimistic', name: 'Pessimistic (2%/yr)', color: DASH_C.orange },
            ]} area />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="Hourly Traffic Pattern" subtitle="% of peak" accent={DASH_C.green} height={190}>
          <BarV data={HOUR_HR.map((h, i) => ({ hr: h, pct: HOUR_PCT[i] }))} xKey="hr" series={[{ key: 'pct', name: '% Peak', color: DASH_C.green }]} unit="%" />
        </ChartBox>
        <ChartBox title="Weekly Traffic Pattern" subtitle="% of Friday peak" accent={DASH_C.cyan} height={190}>
          <BarV data={DAY_LBL.map((d, i) => ({ day: d, pct: DAY_PCT[i] }))} xKey="day" series={[{ key: 'pct', name: '%', color: DASH_C.cyan }]} unit="%" />
        </ChartBox>
        <ChartBox title="Monthly Traffic Variation" subtitle="% of peak" accent={DASH_C.purple} height={190}>
          <BarV data={MONTH_LBL.map((m, i) => ({ mo: m, pct: MONTH_PCT[i] }))} xKey="mo" series={[{ key: 'pct', name: '% of Peak', color: DASH_C.purple }]} unit="%" />
        </ChartBox>
        <ChartBox title="Traffic Volume vs Pavement Condition" accent={DASH_C.orange} height={190}>
          <ScatterBubble data={CORRIDORS.map((c, i) => ({ x: CORR_AADT[i], y: CORR_IRI[i], label: c }))} xLabel="AADT" yLabel="IRI m/km" color={DASH_C.orange} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="21">
        <ChartBox title="AADT Seasonality" subtitle="corridor × month" accent={DASH_C.pink} height={260}>
          <HeatGrid matrix={SEASON_MATRIX} xLabels={MONTH_LBL} yLabels={CORRIDORS} accent={DASH_C.pink} unit=" veh/day" />
        </ChartBox>
        <ChartBox title="Heavy Vehicle % by Corridor" accent={DASH_C.orange} height={260}>
          <BarV data={CORRIDORS.map((c, i) => ({ corridor: c, hgv: CORR_HGV[i] }))} xKey="corridor" series={[{ key: 'hgv', name: 'HGV %', color: DASH_C.orange }]} unit="%" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Traffic Growth Rate by Corridor" subtitle="%/yr" accent={DASH_C.green} height={210}>
          <BarV data={CORRIDORS.map((c, i) => ({ corridor: c, growth: CORR_GROWTH[i] }))} xKey="corridor" series={[{ key: 'growth', name: 'Growth %/yr', color: DASH_C.green }]} unit="%" />
        </ChartBox>
        <ChartBox title="AADT Trend by Region" subtitle="2018–2025" accent={DASH_C.cyan} height={210}>
          <LineMulti
            data={REG_YRS.map((y, yi) => {
              const row: any = { year: y };
              REG_LBL.forEach((r, ri) => { row[r] = REG_AADT_TREND[ri][yi]; });
              return row;
            })}
            xKey="year"
            series={REG_LBL.map((r, i) => ({ key: r, name: r, color: REGION_COLORS[i] }))}
          />
        </ChartBox>
        <ChartBox title="AADT Distribution by Road Class" accent={DASH_C.blue} height={210}>
          <BoxPlotApprox data={[
            boxStats(CLASS_A_AADT, DASH_C.cyan, 'Class A'),
            boxStats(CLASS_B_AADT, DASH_C.yellow, 'Class B'),
            boxStats(CLASS_C_AADT, DASH_C.orange, 'Class C'),
          ]} unit=" v/d" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Corridors · AADT vs Growth" subtitle="bubble = IRI" accent={DASH_C.pink} height={220}>
          <ScatterBubble data={CORRIDORS.map((c, i) => ({ x: CORR_AADT[i], y: CORR_GROWTH[i], z: CORR_IRI[i], label: c }))}
            xLabel="AADT" yLabel="Growth %/yr" color={DASH_C.pink} />
        </ChartBox>
        <ChartBox title="AADT Share by Corridor" subtitle="treemap, sized by AADT" accent={DASH_C.teal} height={220}>
          <TreemapC data={CORRIDORS.map((c, i) => ({ name: c, size: CORR_AADT[i] }))} colors={REGION_COLORS} />
        </ChartBox>
        <ChartBox title="Top 5 Corridors" subtitle="growth vs HGV %" accent={DASH_C.purple} height={220}>
          <RadarTile
            data={TOP5_IDX.map(i => ({ axis: CORRIDORS[i].replace('Kla-', 'K.'), growthPct: CORR_GROWTH[i], hgvPct: CORR_HGV[i] }))}
            series={[{ key: 'growthPct', name: 'Growth %/yr', color: DASH_C.green }, { key: 'hgvPct', name: 'HGV %', color: DASH_C.orange }]}
            maxValue={30}
          />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="Traffic Data Pipeline" accent={DASH_C.blue} height={190}>
          <FunnelC data={[
            { name: 'ATC Stations Deployed', value: 25 }, { name: 'Stations Reporting Live', value: 22 },
            { name: 'Corridors with AADT Baseline', value: 10 }, { name: 'Corridors with Growth Model', value: 10 },
            { name: '2035 Forecast Scenarios', value: 3 },
          ]} colors={[DASH_C.cyan, DASH_C.teal, DASH_C.blue, DASH_C.yellow, DASH_C.green]} />
        </ChartBox>
        <ChartBox title="National Avg Growth" subtitle="target 5%/yr" accent={DASH_C.green} height={190}>
          <GaugeC value={4.2} max={8} target={5} color={DASH_C.green} suffix="%" label="AADT growth /yr" />
        </ChartBox>
        <ChartBox title="National HGV Share" subtitle="target 20%" accent={DASH_C.orange} height={190}>
          <GaugeC value={23} max={40} target={20} color={DASH_C.orange} suffix="%" label="of AADT" />
        </ChartBox>
        <ChartBox title="AADT Share: Top 5 vs Rest" accent={DASH_C.cyan} height={190}>
          <PieChartTile data={[{ name: 'Top 5 Corridors', value: TOP5_AADT_SUM }, { name: 'Other 5 Corridors', value: REST_AADT_SUM }]}
            colors={[DASH_C.cyan, DASH_C.gray]} />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
