/**
 * RoadVideoOverviewDashboard — RMS "Dashboard" tab, Road Video Survey section
 * (sectionId 'roadvideo'). Continuous video log survey footage referenced to
 * road chainage, used for remote visual condition assessment — a ROMDAS-style
 * continuous video/condition survey system (see src/modules/RoadVideoView).
 *
 * Anchored to the platform's canonical NDPIV network figures: total classified
 * network 21,302 km; 6 regions (Central 4,436 km, Northern 3,920 km,
 * Eastern 4,290 km, Western 3,000 km, Southern 3,300 km, North Eastern 2,356 km);
 * road classes Class A Trunk (4,200 km) / Class B Regional (5,800 km) /
 * Class C District (11,302 km) — matches NetworkOverviewDashboard.tsx and
 * PavementOverviewDashboard.tsx. Video-survey coverage, fleet, distress-flag
 * and footage-volume figures below are illustrative but internally consistent
 * (surveyed km + never-surveyed backlog reconcile to the class/region totals;
 * survey-recency buckets sum to each class's km; distress-flag density is
 * derived from flag counts over surveyed km, not assumed).
 * No tables here — tabular breakdowns live under Exhaustive Tables / Deep Analytics.
 */
import {
  DASH_C, DASHBOARD_COND_COLORS, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  DonutChart, PieChartTile, BarV, BarH, LineMulti, ScatterBubble, HeatGrid, TreemapC, GaugeC,
  FunnelC, RadarTile, BoxPlotApprox, WaterfallC,
} from '../../../shared/dashboardKit';

// ─── Canonical network anchors ────────────────────────────────────────────────
const TOTAL = 21302;
const REG_LBL = ['Central', 'Northern', 'Eastern', 'Western', 'Southern', 'North Eastern'];
const REG_KM = [4436, 3920, 4290, 3000, 3300, 2356];
const CLASS_LBL = ['Class A Trunk', 'Class B Regional', 'Class C District'];
const CLASS_KM = [4200, 5800, 11302];

// ─── Video survey coverage (by class, reconciles to CLASS_KM) ────────────────
const CLASS_SURVEYED = [4100, 4800, 5960]; // km with at least one video pass
const CLASS_NOT_SURVEYED = CLASS_KM.map((k, i) => k - CLASS_SURVEYED[i]); // [100, 1000, 5342]
const SURVEYED_KM = CLASS_SURVEYED.reduce((a, b) => a + b, 0); // 14,860
const NOT_SURVEYED_KM = TOTAL - SURVEYED_KM; // 6,442
const CLASS_COVERAGE_PCT = CLASS_KM.map((k, i) => +(CLASS_SURVEYED[i] / k * 100).toFixed(1));

// Backlog / surveyed split by region (reconciles to REG_KM)
const REG_BACKLOG = [620, 1450, 1380, 780, 850, 1362]; // sums to 6,442
const REG_SURVEYED = REG_KM.map((k, i) => k - REG_BACKLOG[i]); // sums to 14,860

// Survey recency — 5-stop staleness scale, km by road class (each row sums to CLASS_KM)
const RISK5 = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];
const RECENCY_LBL = ['<1yr', '1-2yr', '2-3yr', '3yr+', 'Never'];
const RECENCY_A = [2400, 1200, 400, 100, 100];
const RECENCY_B = [1800, 1600, 1000, 400, 1000];
const RECENCY_C = [1800, 1800, 1400, 960, 5342];
const STALE_3YR_PLUS = RECENCY_A[3] + RECENCY_B[3] + RECENCY_C[3]; // 1,460 km surveyed but stale

// Survey vehicle fleet (ROMDAS-equipped)
const VEH_LBL = ['RV-01 · Central', 'RV-02 · Central', 'RV-03 · Eastern', 'RV-04 · Northern', 'RV-05 · Western', 'RVL-06 · Mobile/NE'];
const VEH_UTIL = [88, 81, 92, 76, 85, 69]; // % of available survey days active

// Survey pass volume & footage storage, 2019–2025
const SVY_YRS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
const PASS_KM = [980, 1450, 2050, 2600, 3100, 3600, 4020]; // fresh km surveyed that year
const RAW_TB = [8, 16, 29, 47, 74, 109, 152];
const PROCESSED_TB = [6, 12, 22, 36, 58, 86, 122];

// Visual distress flags detected from footage, by type
const DIST_LBL = ['Potholes', 'Cracking', 'Edge Break', 'Rutting'];
const DIST_COUNT = [18420, 41200, 9850, 13760];
const DIST_COLORS = [DASH_C.orange, DASH_C.purple, DASH_C.pink, DASH_C.blue];
const TOTAL_FLAGS = DIST_COUNT.reduce((a, b) => a + b, 0); // 83,230

// Severity mix per distress type (Low/Medium/High/Critical — each row sums to DIST_COUNT)
const SEV_LBL = ['Low', 'Medium', 'High', 'Critical'];
const SEV_BY_TYPE = [
  [7368, 5526, 3684, 1842],   // Potholes
  [20600, 12360, 6180, 2060], // Cracking
  [3450, 2950, 2450, 1000],   // Edge Break
  [4800, 4200, 3200, 1560],   // Rutting
];

// Distress flag density by road class (flags ÷ surveyed km — not assumed)
const FLAGS_BY_CLASS = [12200, 28430, 42600]; // sums to TOTAL_FLAGS
const DENSITY_BY_CLASS = FLAGS_BY_CLASS.map((f, i) => +(f / CLASS_SURVEYED[i]).toFixed(2));
const AVG_DENSITY = +(TOTAL_FLAGS / SURVEYED_KM).toFixed(2);

// Distress flags heatmap: region × type (illustrative, order-of-magnitude consistent with DIST_COUNT)
const DIST_HEAT = [
  [3800, 8200, 1900, 2600], // Central
  [2600, 5300, 1300, 1900], // Northern
  [3100, 6500, 1550, 2200], // Eastern
  [2200, 5100, 1150, 1700], // Western
  [2500, 5600, 1300, 1850], // Southern
  [1900, 4300, 950, 1400],  // North Eastern
];

// GPS chainage-tag accuracy by region (weighted avg reconciles to KPI figure)
const GPS_ACC_PCT = [98, 96, 97, 98, 97, 94];
const GPS_ACC_WEIGHTED = +(
  REG_LBL.reduce((sum, _, i) => sum + GPS_ACC_PCT[i] * REG_SURVEYED[i], 0) / SURVEYED_KM
).toFixed(1); // ≈ 97.0%

const COVERAGE_PCT_BY_REGION = REG_LBL.map((_, i) => Math.round(REG_SURVEYED[i] / REG_KM[i] * 100));

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
// Frames captured per surveyed link, sample by road class (longer/trunk links → more frames)
const FRAMES_A = [420, 380, 510, 460, 395, 440, 505, 375, 450, 430, 395, 470];
const FRAMES_B = [260, 240, 310, 280, 255, 300, 265, 235, 290, 270, 250, 305];
const FRAMES_C = [140, 120, 160, 135, 110, 150, 125, 105, 145, 130, 115, 155];

// Deterministic "segment sample" points — stable across renders (no Math.random()).
const VINTAGE_IRI_POINTS = Array.from({ length: 40 }, (_, i) => {
  const seed = i * 47.9;
  const vintage = ((seed * 131 + 23) % 450) / 100; // 0–4.5 yrs since last video pass
  const iri = 2 + ((seed * 217 + 41) % 700) / 100; // 2–9 m/km
  const aadt = 300 + ((i * 577) % 12000);
  return { x: +vintage.toFixed(1), y: +iri.toFixed(2), z: aadt };
});
const IRI_DENSITY_POINTS = Array.from({ length: 38 }, (_, i) => {
  const seed = i * 53.3;
  const iri = 1 + ((seed * 97 + 19) % 800) / 100; // 1–9 m/km
  const density = 0.5 + ((seed * 331 + 11) % 1450) / 100; // 0.5–15 flags/km
  return { x: +iri.toFixed(2), y: +density.toFixed(2) };
});

export default function RoadVideoOverviewDashboard() {
  return (
    <div>
      <KpiStrip>
        <StatMini value={`${SURVEYED_KM.toLocaleString()} km`} label={`Video-Surveyed (${Math.round(SURVEYED_KM / TOTAL * 100)}%)`} color={DASH_C.cyan} />
        <StatMini value={`${NOT_SURVEYED_KM.toLocaleString()} km`} label="Never Surveyed (Backlog)" color={DASH_C.red} />
        <StatMini value={`${VEH_LBL.length}`} label="Active Survey Vehicles" color={DASH_C.teal} />
        <StatMini value={`${GPS_ACC_WEIGHTED}%`} label="GPS Chainage-Tag Accuracy" color={DASH_C.green} />
        <StatMini value={`${RAW_TB[RAW_TB.length - 1]} TB`} label="Footage Archived (Raw)" color={DASH_C.blue} />
        <StatMini value={`${AVG_DENSITY} /km`} label="Avg Distress Flag Density" color={DASH_C.yellow} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.cyan}>Video Survey Coverage &amp; Condition Intelligence · 22 Views</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="Video Survey Coverage" subtitle="km" accent={DASH_C.cyan} height={200}>
          <DonutChart data={[{ name: 'Surveyed', value: SURVEYED_KM, color: '#22c55e' }, { name: 'Never Surveyed', value: NOT_SURVEYED_KM, color: '#ef4444' }]} />
        </ChartBox>
        <ChartBox title="Survey Coverage %" subtitle="target 85% by FY27" accent={DASH_C.cyan} height={200}>
          <GaugeC value={Math.round(SURVEYED_KM / TOTAL * 100)} target={85} color={DASH_C.cyan} />
        </ChartBox>
        <ChartBox title="GPS Chainage-Tag Accuracy" subtitle="target 99%" accent={DASH_C.green} height={200}>
          <GaugeC value={GPS_ACC_WEIGHTED} target={99} color={DASH_C.green} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="12">
        <ChartBox title="Survey Recency by Road Class" subtitle="km since last video pass, stacked" accent={DASH_C.cyan} height={250}>
          <BarV data={CLASS_LBL.map((n, i) => ({
            name: n.split(' ')[1], '<1yr': [RECENCY_A, RECENCY_B, RECENCY_C][i][0], '1-2yr': [RECENCY_A, RECENCY_B, RECENCY_C][i][1],
            '2-3yr': [RECENCY_A, RECENCY_B, RECENCY_C][i][2], '3yr+': [RECENCY_A, RECENCY_B, RECENCY_C][i][3], 'Never': [RECENCY_A, RECENCY_B, RECENCY_C][i][4],
          }))} xKey="name" series={RECENCY_LBL.map((l, i) => ({ key: l, name: l, color: RISK5[i] }))} unit="km" stacked />
        </ChartBox>
        <ChartBox title="Survey Vintage vs Roughness" subtitle="yrs since last pass vs IRI — size=AADT" accent={DASH_C.purple} height={250}>
          <ScatterBubble data={VINTAGE_IRI_POINTS} xLabel="Yrs Since Survey" yLabel="IRI (m/km)" color={DASH_C.purple} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Video Survey Passes" subtitle="fresh km surveyed / yr, 2019-2025" accent={DASH_C.cyan} height={210}>
          <LineMulti data={SVY_YRS.map((y, i) => ({ year: y, km: PASS_KM[i] }))} xKey="year"
            series={[{ key: 'km', name: 'km surveyed', color: DASH_C.cyan }]} unit="km" area />
        </ChartBox>
        <ChartBox title="Footage Storage Volume" subtitle="TB, raw vs processed" accent={DASH_C.blue} height={210}>
          <LineMulti data={SVY_YRS.map((y, i) => ({ year: y, Raw: RAW_TB[i], Processed: PROCESSED_TB[i] }))} xKey="year"
            series={[{ key: 'Raw', name: 'Raw TB', color: DASH_C.blue }, { key: 'Processed', name: 'Processed TB', color: DASH_C.teal }]} unit=" TB" area />
        </ChartBox>
        <ChartBox title="Survey Fleet Utilization" subtitle="% of available survey days" accent={DASH_C.teal} height={210}>
          <BarH data={VEH_LBL.map((n, i) => ({ name: n, util: VEH_UTIL[i] }))} yKey="name"
            series={[{ key: 'util', name: 'Utilization %', color: DASH_C.teal }]} unit="%" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Distress Flags by Type" subtitle="AI-flagged from footage" accent={DASH_C.orange} height={210}>
          <PieChartTile data={DIST_LBL.map((n, i) => ({ name: n, value: DIST_COUNT[i] }))} colors={DIST_COLORS} />
        </ChartBox>
        <ChartBox title="Distress Severity Mix" subtitle="by type, stacked" accent={DASH_C.pink} height={210}>
          <BarV data={DIST_LBL.map((n, i) => ({ name: n, Low: SEV_BY_TYPE[i][0], Medium: SEV_BY_TYPE[i][1], High: SEV_BY_TYPE[i][2], Critical: SEV_BY_TYPE[i][3] }))}
            xKey="name" series={SEV_LBL.map((l, i) => ({ key: l, name: l, color: DASHBOARD_COND_COLORS[i] }))} stacked />
        </ChartBox>
        <ChartBox title="Distress Flag Density" subtitle="flags / surveyed km, by class" accent={DASH_C.yellow} height={210}>
          <BarV data={CLASS_LBL.map((n, i) => ({ name: n.split(' ')[1], density: DENSITY_BY_CLASS[i] }))} xKey="name"
            series={[{ key: 'density', name: 'flags/km', color: DASH_C.yellow }]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Distress Flags Heatmap" subtitle="region × type" accent={DASH_C.red} height={210}>
          <HeatGrid matrix={DIST_HEAT} xLabels={['Potholes', 'Cracking', 'Edge Br.', 'Rutting']} yLabels={REG_LBL} accent={DASH_C.red} />
        </ChartBox>
        <ChartBox title="Roughness vs Distress Density" subtitle="IRI vs flags/km" accent={DASH_C.pink} height={210}>
          <ScatterBubble data={IRI_DENSITY_POINTS} xLabel="IRI (m/km)" yLabel="Flags/km" color={DASH_C.pink} />
        </ChartBox>
        <ChartBox title="Survey Coverage by Region" subtitle="km, surveyed vs backlog" accent={DASH_C.cyan} height={210}>
          <BarH data={REG_LBL.map((r, i) => ({ region: r, Surveyed: REG_SURVEYED[i], Backlog: REG_BACKLOG[i] }))} yKey="region"
            series={[{ key: 'Surveyed', name: 'Surveyed', color: DASH_C.green }, { key: 'Backlog', name: 'Backlog', color: DASH_C.red }]} stacked />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Never-Surveyed Backlog" subtitle="km by region" accent={DASH_C.red} height={210}>
          <BarV data={REG_LBL.map((r, i) => ({ name: r, km: REG_BACKLOG[i] }))} xKey="name"
            series={[{ key: 'km', name: 'Backlog km', color: '#ef4444' }]} unit="km" />
        </ChartBox>
        <ChartBox title="Distress Flags" subtitle="treemap, sized by count" accent={DASH_C.teal} height={210}>
          <TreemapC data={DIST_LBL.map((n, i) => ({ name: n, size: DIST_COUNT[i] }))} colors={DIST_COLORS} />
        </ChartBox>
        <ChartBox title="Video Survey Data Pipeline" subtitle="frames processed" accent={DASH_C.blue} height={210}>
          <FunnelC data={[
            { name: 'Captured Frames', value: 2840000 }, { name: 'GPS-Tagged', value: 2768000 },
            { name: 'Indexed by Chainage', value: 2690000 }, { name: 'AI Defect-Scanned', value: 2610000 },
            { name: 'QA Verified', value: 2340000 },
          ]} colors={[DASH_C.cyan, DASH_C.teal, DASH_C.blue, DASH_C.yellow, DASH_C.green]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Regional Survey Completeness" subtitle="coverage % vs GPS-tag accuracy %" accent={DASH_C.purple} height={210}>
          <RadarTile
            data={REG_LBL.map((r, i) => ({ axis: r, coveragePct: COVERAGE_PCT_BY_REGION[i], gpsAccPct: GPS_ACC_PCT[i] }))}
            series={[{ key: 'coveragePct', name: 'Coverage %', color: DASH_C.cyan }, { key: 'gpsAccPct', name: 'GPS Accuracy %', color: DASH_C.purple }]}
          />
        </ChartBox>
        <ChartBox title="Network Survey Status" subtitle="waterfall, km" accent={DASH_C.pink} height={210}>
          <WaterfallC steps={[
            { name: 'Total', delta: TOTAL, isTotal: true }, { name: '−Never Surveyed', delta: -NOT_SURVEYED_KM },
            { name: '=Surveyed', delta: SURVEYED_KM, isTotal: true }, { name: '−Stale (3yr+)', delta: -STALE_3YR_PLUS },
            { name: '=Current (<3yr)', delta: SURVEYED_KM - STALE_3YR_PLUS, isTotal: true },
          ]} unit="km" />
        </ChartBox>
        <ChartBox title="Frame Count Distribution" subtitle="frames/link, by road class" accent={DASH_C.cyan} height={210}>
          <BoxPlotApprox data={[
            boxStats('Class A', FRAMES_A, DASH_C.cyan), boxStats('Class B', FRAMES_B, DASH_C.yellow), boxStats('Class C', FRAMES_C, DASH_C.orange),
          ]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Frame / Chainage Indexing" subtitle="completeness, target 100%" accent={DASH_C.teal} height={190}>
          <GaugeC value={94.2} max={100} target={100} color={DASH_C.teal} />
        </ChartBox>
        <ChartBox title="Avg Survey Pass Interval" subtitle="months between passes, target 12" accent={DASH_C.orange} height={190}>
          <GaugeC value={14} max={24} target={12} color={DASH_C.orange} suffix=" mo" />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
