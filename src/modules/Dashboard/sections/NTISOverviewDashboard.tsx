/**
 * NTISOverviewDashboard - "National Traffic Information System" flagship view.
 * AADT trends, growth forecasting, axle-load monitoring, and road safety
 * analysis for Uganda's national corridors - the national-level rollup of
 * traffic intelligence, extended to 27 chart tiles.
 *
 * Anchored to the platform's already-established canonical figures:
 *  - 21,302 km total classified network, across 6 regions (Central, Northern,
 *    Eastern, Western, Southern, North Eastern) - see NetworkOverviewDashboard.
 *  - National avg AADT 3,847 veh/day (2025, simple mean across counted ATC/
 *    manual stations - NOT the same metric as the network-weighted average
 *    AADT shown on Network Story/Platform Overview, which is length-weighted
 *    across the whole mapped network and lands lower; both are real, see
 *    TrafficOverviewDashboard's header for the full explanation), 4.2%/yr
 *    growth, 23% HGV share, peak AADT 18,400 (Kla-Entebbe), and the
 *    10-corridor AADT/growth dataset - see TrafficOverviewDashboard (same
 *    corridor list & figures reused here for cross-dashboard consistency).
 *  - 25 ATC (Automatic Traffic Counter) stations (15 legacy + 10 new).
 * Axle-load, weighbridge, blackspot and fatality figures are new, internally
 * consistent illustrative additions built on top of that base. No tables -
 * tabular breakdowns live under Exhaustive Tables / Deep Analytics.
 */
import {
  DASH_C, REGION_COLORS, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  BarH, BarV, LineMulti, DonutChart, PieChartTile, ScatterBubble, HeatGrid,
  BoxPlotApprox, TreemapC, RadarTile, FunnelC, GaugeC, WaterfallC,
} from '../../../shared/dashboardKit';

// Canonical 5-stop risk/severity scale (Good → Critical) - used for every
// fatality / accident / overload / blackspot-severity dimension below.
const RISK_5 = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];

// ─── AADT, growth & corridors (matches TrafficOverviewDashboard's dataset) ──
const CORRIDORS = ['Kla-Entebbe', 'Kla-Jinja', 'Kla-Gulu', 'Kla-Mbarara', 'Jinja-Tororo', 'Masaka-Mba', 'Mba-Kabale', 'Gulu-Nimule', 'Hoima-Kafu', 'FP-Kasese'];
const CORR_AADT = [18400, 6480, 4820, 3820, 2180, 2620, 1670, 1240, 1840, 2140];
const CORR_GROWTH = [4.2, 4.0, 3.8, 3.5, 3.1, 3.2, 2.9, 3.3, 5.1, 3.7];
const CORR_CONGESTION = [92, 68, 51, 58, 44, 47, 35, 28, 39, 41]; // volume/capacity index (bubble size)

const NAT_YRS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const NAT_AADT = [2890, 3006, 3126, 3251, 3141, 3267, 3397, 3533, 3675, 3847];
const KLA_EBB_TREND = [14200, 14800, 15400, 16100, 15200, 16000, 16800, 17400, 18000, 18400];

const REG_LBL = ['Central', 'Northern', 'Eastern', 'Western', 'Southern', 'North Eastern'];
const REG_AADT_2025 = [2670, 2240, 2060, 2310, 1830, 1210]; // = 2025 column of TrafficOverviewDashboard's REG_AADT_TREND

const VEH_LBL = ['Cars/SUV', 'Buses', 'Trucks (LGV+HGV)', 'Motorcycles', 'NMT'];
const VEH_COMP = [45, 7, 30, 15, 3]; // Trucks = Light Comm.(18)+HGV(12) from the Traffic Overview vehicle mix

// Forecast to 2030 - Normal 4.2%/yr (matches national growth KPI), Optimistic 6%/yr, Pessimistic 2%/yr.
const FC_YRS = [2025, 2026, 2027, 2028, 2029, 2030];
const FC_NORM = [3847, 4009, 4177, 4352, 4535, 4726];
const FC_OPT = [3847, 4078, 4323, 4582, 4857, 5148];
const FC_PESS = [3847, 3924, 4002, 4082, 4164, 4247];

const CLASS_A_AADT = [18400, 6480, 4820, 3820, 2180, 2620, 1840, 2140];
const CLASS_B_AADT = [980, 1120, 860, 1340, 760, 1050, 890, 1200];
const CLASS_C_AADT = [180, 240, 150, 310, 90, 260, 140, 200];

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

// ─── Axle-load & weighbridge compliance ─────────────────────────────────────
const WB_STATIONS = ['Malaba', 'Busia', 'Elegu', 'Mutukula', 'Katuna', 'Mirama Hills', 'Kafu', 'Mubende'];
const WB_AADT = [5240, 3120, 1320, 1980, 1450, 980, 2050, 3438];
const WB_OVERLOAD = [14.2, 11.8, 9.4, 8.6, 6.2, 5.1, 7.8, 4.3]; // avg = 8.4% = national KPI

const COMPLY_YRS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const COMPLY_PCT = [68, 70, 72, 74, 76, 77, 78, 79];

// ─── Road safety ─────────────────────────────────────────────────────────────
// Matches RoadSafetyOverviewDashboard's official 3,247 2025-fatality / 847-blackspot
// count (the same national figures, not a separate NTIS-only series).
// Fatalities dip in 2020 mirrors the COVID-era AADT dip in NAT_AADT above.
const FATALITIES = [2817, 2921, 3013, 3104, 2739, 3078, 3234, 3299, 3365, 3247];
const FATAL_BY_REGION = [835, 743, 626, 561, 339, 143]; // sums to 3,247 (2025)
const FATAL_RATE_10K = [3.2, 4.8, 3.6, 2.9, 2.2, 3.1]; // per 10,000 vehicles, by region

const BLACKSPOT_BY_REGION = [236, 208, 154, 127, 81, 41]; // sums to 847

const ACCIDENT_TYPE_LBL = ['Pedestrian', 'Rear-end', 'Head-on', 'Rollover', 'Motorcycle', 'Other'];
const ACCIDENT_TYPE_PCT = [28, 22, 18, 14, 12, 6];

const CORR_SAFETY = [
  { axis: 'Kla-Entebbe', fatalityRate: 3.8, blackspotDensity: 8.2, overloadPct: 6.5 },
  { axis: 'Kla-Jinja', fatalityRate: 4.1, blackspotDensity: 8.8, overloadPct: 7.4 },
  { axis: 'Kla-Gulu (N. Corr.)', fatalityRate: 5.4, blackspotDensity: 11.5, overloadPct: 9.8 },
  { axis: 'Kla-Mbarara', fatalityRate: 3.2, blackspotDensity: 6.4, overloadPct: 5.8 },
  { axis: 'Jinja-Tororo', fatalityRate: 4.6, blackspotDensity: 9.0, overloadPct: 8.9 },
  { axis: 'Masaka-Mba', fatalityRate: 2.9, blackspotDensity: 5.8, overloadPct: 6.0 },
  { axis: 'Mba-Kabale', fatalityRate: 3.5, blackspotDensity: 7.1, overloadPct: 5.2 },
  { axis: 'Gulu-Nimule', fatalityRate: 4.9, blackspotDensity: 10.2, overloadPct: 8.1 },
  { axis: 'Hoima-Kafu', fatalityRate: 3.0, blackspotDensity: 6.0, overloadPct: 4.9 },
  { axis: 'FP-Kasese', fatalityRate: 3.6, blackspotDensity: 7.6, overloadPct: 6.2 },
];

// ─── ATC station network (25 stations: 15 legacy + 10 new) ──────────────────
// Deterministic per-station AADT sample, stable across renders. Station
// coordinates were dropped from this tile (coords belong on maps only, never
// charts) - ranked by traffic volume instead.
const ATC_ALL = Array.from({ length: 25 }, (_, i) => {
  const aadt = 900 + ((i * 733) % 9200) + (i < 3 ? 8000 : 0);
  return { aadt };
}).sort((a, b) => b.aadt - a.aadt).map((s, i) => ({ x: i + 1, y: s.aadt, z: s.aadt }));

const DQ_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const DQ_MATRIX = [
  [98, 99, 97, 99], // Kla-Entebbe
  [96, 95, 97, 96], // Kla-Jinja
  [91, 89, 93, 92], // Kla-Gulu
  [94, 95, 93, 96], // Kla-Mbarara
  [88, 90, 87, 91], // Jinja-Tororo
  [93, 92, 94, 95], // Masaka-Mba
  [85, 87, 84, 88], // Mba-Kabale
  [82, 80, 85, 83], // Gulu-Nimule
  [90, 88, 91, 92], // Hoima-Kafu
  [86, 84, 88, 87], // FP-Kasese
];

export default function NTISOverviewDashboard() {
  return (
    <div>
      <KpiStrip>
        <StatMini value="3,847" label="Avg AADT, Counted Stations (veh/day)" color={DASH_C.cyan} />
        <StatMini value="4.2%/yr" label="AADT Growth Rate" color={DASH_C.green} />
        <StatMini value="25" label="ATC Stations (15 legacy + 10 new)" color={DASH_C.purple} />
        <StatMini value="8.4%" label="Axle Overload Rate" color={DASH_C.orange} />
        <StatMini value="3,247" label="Road Fatalities (2025)" color={RISK_5[4]} />
        <StatMini value="4,726" label="AADT Forecast 2030 (Normal)" color={DASH_C.yellow} />
        <StatMini value="0.92" label="Congestion Index (Kla-Entebbe)" color={DASH_C.pink} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.cyan}>AADT, Axle-Load &amp; Road Safety Intelligence · 27 Views</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="National AADT Trend" subtitle="2016–2025" accent={DASH_C.cyan} height={210}>
          <LineMulti data={NAT_YRS.map((y, i) => ({ year: y, National: NAT_AADT[i], 'Kla-Entebbe': KLA_EBB_TREND[i] }))} xKey="year"
            series={[{ key: 'National', name: 'National Avg AADT', color: DASH_C.cyan }, { key: 'Kla-Entebbe', name: 'Kla-Entebbe (peak)', color: DASH_C.pink }]} area />
        </ChartBox>
        <ChartBox title="AADT by Region" subtitle="2025" accent={DASH_C.teal} height={210}>
          <BarH data={REG_LBL.map((r, i) => ({ region: r, aadt: REG_AADT_2025[i] }))} yKey="region"
            series={[{ key: 'aadt', name: 'AADT (veh/day)', color: DASH_C.teal }]} />
        </ChartBox>
        <ChartBox title="Vehicle Classification Mix" subtitle="% of AADT" accent={DASH_C.green} height={210}>
          <DonutChart data={VEH_LBL.map((n, i) => ({ name: n, value: VEH_COMP[i] }))}
            colors={[DASH_C.cyan, DASH_C.purple, DASH_C.orange, DASH_C.green, DASH_C.gray]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="12">
        <ChartBox title="Top Corridors by AADT" subtitle="national rollup" accent={DASH_C.yellow} height={250}>
          <BarH data={CORRIDORS.map((c, i) => ({ corridor: c, aadt: CORR_AADT[i] }))} yKey="corridor"
            series={[{ key: 'aadt', name: 'AADT (veh/day)', color: DASH_C.yellow }]} />
        </ChartBox>
        <ChartBox title="AADT Growth Forecast to 2030" subtitle="3 scenarios" accent={DASH_C.cyan} height={250}>
          <LineMulti data={FC_YRS.map((y, i) => ({ year: y, Normal: FC_NORM[i], Optimistic: FC_OPT[i], Pessimistic: FC_PESS[i] }))} xKey="year"
            series={[
              { key: 'Normal', name: 'Normal (4.2%/yr)', color: DASH_C.cyan },
              { key: 'Optimistic', name: 'Optimistic (6%/yr)', color: DASH_C.green },
              { key: 'Pessimistic', name: 'Pessimistic (2%/yr)', color: DASH_C.orange },
            ]} area />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Corridors · AADT vs Growth" subtitle="bubble = congestion index" accent={DASH_C.purple} height={210}>
          <ScatterBubble data={CORRIDORS.map((c, i) => ({ x: CORR_AADT[i], y: CORR_GROWTH[i], z: CORR_CONGESTION[i], label: c }))}
            xLabel="AADT" yLabel="Growth %/yr" color={DASH_C.purple} />
        </ChartBox>
        <ChartBox title="Corridor AADT Share" subtitle="treemap, sized by AADT" accent={DASH_C.blue} height={210}>
          <TreemapC data={CORRIDORS.map((c, i) => ({ name: c, size: CORR_AADT[i] }))} colors={REGION_COLORS} />
        </ChartBox>
        <ChartBox title="AADT Distribution by Road Class" accent={DASH_C.yellow} height={210}>
          <BoxPlotApprox data={[
            boxStats(CLASS_A_AADT, DASH_C.cyan, 'Class A'),
            boxStats(CLASS_B_AADT, DASH_C.yellow, 'Class B'),
            boxStats(CLASS_C_AADT, DASH_C.orange, 'Class C'),
          ]} unit=" v/d" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Axle Load Compliance" subtitle="weighbridge checks, 2025" accent={DASH_C.orange} height={210}>
          <DonutChart data={[
            { name: 'Compliant', value: 79, color: RISK_5[0] },
            { name: 'Marginally Overloaded', value: 12, color: RISK_5[2] },
            { name: 'Overloaded', value: 9, color: RISK_5[4] },
          ]} />
        </ChartBox>
        <ChartBox title="Overload % by Weighbridge Station" accent={DASH_C.orange} height={210}>
          <BarH data={WB_STATIONS.map((s, i) => ({ station: s, overload: WB_OVERLOAD[i] }))} yKey="station"
            series={[{ key: 'overload', name: 'Overload %', color: DASH_C.orange }]} unit="%" />
        </ChartBox>
        <ChartBox title="Compliance Rate Trend" subtitle="2018–2025" accent={DASH_C.green} height={210}>
          <LineMulti data={COMPLY_YRS.map((y, i) => ({ year: y, compliant: COMPLY_PCT[i] }))} xKey="year"
            series={[{ key: 'compliant', name: 'Compliant Loads %', color: DASH_C.green }]} unit="%" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Overload Severity Mix" subtitle="among overloaded HGVs" accent={DASH_C.orange} height={200}>
          <DonutChart data={[
            { name: 'Low (0–10% over)', value: 55, color: RISK_5[0] },
            { name: 'Moderate (10–25% over)', value: 28, color: RISK_5[2] },
            { name: 'High (25–50% over)', value: 12, color: RISK_5[3] },
            { name: 'Severe (>50% over)', value: 5, color: RISK_5[4] },
          ]} />
        </ChartBox>
        <ChartBox title="Axle Compliance Rate" subtitle="target 85%" accent={DASH_C.green} height={200}>
          <GaugeC value={79} max={100} target={85} color={DASH_C.green} suffix="%" label="Compliant loads" />
        </ChartBox>
        <ChartBox title="Weighbridge AADT vs Overload %" accent={DASH_C.orange} height={200}>
          <ScatterBubble data={WB_STATIONS.map((s, i) => ({ x: WB_AADT[i], y: WB_OVERLOAD[i], label: s }))}
            xLabel="AADT (veh/day)" yLabel="Overload %" color={DASH_C.orange} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Road Fatalities Trend" subtitle="national corridors, 2016–2025" accent={RISK_5[4]} height={210}>
          <LineMulti data={NAT_YRS.map((y, i) => ({ year: y, fatalities: FATALITIES[i] }))} xKey="year"
            series={[{ key: 'fatalities', name: 'Fatalities', color: RISK_5[4] }]} />
        </ChartBox>
        <ChartBox title="Fatalities by Region" subtitle="2025" accent={RISK_5[4]} height={210}>
          <BarH data={REG_LBL.map((r, i) => ({ region: r, fatalities: FATAL_BY_REGION[i] }))} yKey="region"
            series={[{ key: 'fatalities', name: 'Fatalities', color: RISK_5[4] }]} />
        </ChartBox>
        <ChartBox title="Blackspot Severity Breakdown" subtitle="847 identified blackspots" accent={DASH_C.orange} height={210}>
          <DonutChart data={[
            { name: 'Low', value: 281, color: RISK_5[0] },
            { name: 'Fair', value: 204, color: RISK_5[1] },
            { name: 'Moderate', value: 172, color: RISK_5[2] },
            { name: 'High', value: 127, color: RISK_5[3] },
            { name: 'Critical', value: 63, color: RISK_5[4] },
          ]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="Accident Type Breakdown" accent={DASH_C.cyan} height={190}>
          <PieChartTile data={ACCIDENT_TYPE_LBL.map((n, i) => ({ name: n, value: ACCIDENT_TYPE_PCT[i] }))}
            colors={[DASH_C.cyan, DASH_C.green, DASH_C.yellow, DASH_C.purple, DASH_C.pink, DASH_C.gray]} />
        </ChartBox>
        <ChartBox title="Corridor Safety Profile" subtitle="all 10 corridors" accent={DASH_C.pink} height={230}>
          <RadarTile data={CORR_SAFETY} maxValue={15}
            series={[
              { key: 'fatalityRate', name: 'Fatality Rate /10k veh', color: RISK_5[4] },
              { key: 'blackspotDensity', name: 'Blackspots /100km', color: RISK_5[3] },
              { key: 'overloadPct', name: 'Overload %', color: RISK_5[2] },
            ]} />
        </ChartBox>
        <ChartBox title="Fatality Rate by Region" subtitle="per 10,000 vehicles" accent={DASH_C.orange} height={190}>
          <BarH data={REG_LBL.map((r, i) => ({ region: r, rate: FATAL_RATE_10K[i] }))} yKey="region"
            series={[{ key: 'rate', name: 'Rate /10k veh', color: DASH_C.orange }]} />
        </ChartBox>
        <ChartBox title="Blackspot Count by Region" accent={RISK_5[4]} height={190}>
          <BarV data={REG_LBL.map((r, i) => ({ region: r, blackspots: BLACKSPOT_BY_REGION[i] }))} xKey="region"
            series={[{ key: 'blackspots', name: 'Blackspots', color: RISK_5[4] }]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="ATC Station AADT Ranking" subtitle="25 stations - size = AADT" accent={DASH_C.purple} height={210}>
          <ScatterBubble data={ATC_ALL} xLabel="Rank" yLabel="AADT (veh/day)" color={DASH_C.purple} />
        </ChartBox>
        <ChartBox title="Legacy vs New Stations" subtitle="25 ATC stations" accent={DASH_C.purple} height={210}>
          <DonutChart data={[{ name: 'Legacy Stations', value: 15, color: DASH_C.purple }, { name: 'New Stations (2023–25)', value: 10, color: DASH_C.cyan }]} />
        </ChartBox>
        <ChartBox title="ATC Network Uptime" subtitle="target 95%" accent={DASH_C.cyan} height={210}>
          <GaugeC value={91.4} max={100} target={95} color={DASH_C.cyan} suffix="%" label="Network uptime" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="ATC Data Completeness" subtitle="% by quarter, 2025 - all 10 corridors" accent={DASH_C.cyan} height={260}>
          <HeatGrid matrix={DQ_MATRIX} xLabels={DQ_QUARTERS} yLabels={CORRIDORS} accent={DASH_C.cyan} unit="%" />
        </ChartBox>
        <ChartBox title="NTIS Data Pipeline" accent={DASH_C.blue} height={220}>
          <FunnelC data={[
            { name: 'ATC Stations Deployed', value: 25 }, { name: 'Stations Reporting Live', value: 23 },
            { name: 'Data QA Validated', value: 21 }, { name: 'Integrated into AADT Model', value: 20 },
            { name: 'Published in Annual Traffic Report', value: 20 },
          ]} colors={[DASH_C.cyan, DASH_C.teal, DASH_C.blue, DASH_C.yellow, DASH_C.green]} />
        </ChartBox>
        <ChartBox title="AADT Growth Decomposition to 2030" subtitle="Normal scenario" accent={DASH_C.green} height={220}>
          <WaterfallC steps={[
            { name: '2025 Base', delta: 3847, isTotal: true },
            { name: 'Population Growth', delta: 320 },
            { name: 'Economic Growth', delta: 280 },
            { name: 'Urbanization', delta: 150 },
            { name: 'Regional Trade', delta: 129 },
            { name: '2030 Forecast', delta: 4726, isTotal: true },
          ]} unit=" v/d" />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
