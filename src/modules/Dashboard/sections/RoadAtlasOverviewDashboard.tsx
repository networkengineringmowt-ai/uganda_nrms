/**
 * RoadAtlasOverviewDashboard - RMS "Dashboard" tab, Road Atlas section.
 * Official Uganda road atlas reference: classified inventory, road-number
 * index, chainage references, atlas plates (map sheets), and district-level
 * statistics. Anchored to the platform's canonical network figures: total
 * classified network 21,302 km; 6 regions (Central, Northern, Eastern,
 * Western, Southern, North Eastern); Class A Trunk 4,200 km / Class B
 * Regional 5,800 km / Class C District 11,302 km; ~135 districts nationwide.
 * All other atlas-specific figures (road-number counts, plate coverage,
 * chainage/cross-reference completeness, district rankings, edition history)
 * are illustrative but internally consistent with those anchors. No tables
 * here - tabular breakdowns live under Exhaustive Tables / Deep Analytics.
 */
import {
  DASH_C, REGION_COLORS, DASHBOARD_COND_COLORS, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  DonutChart, PieChartTile, BarV, BarH, LineMulti, ScatterBubble, HeatGrid, TreemapC, GaugeC,
  FunnelC, RadarTile, BoxPlotApprox, WaterfallC,
} from '../../../shared/dashboardKit';

// ─── Data model ───────────────────────────────────────────────────────────
// Canonical anchors (must match NetworkOverviewDashboard):
const REG_LBL = ['Central', 'Northern', 'Eastern', 'Western', 'Southern', 'North Eastern'];
const CLASS_LBL = ['Class A Trunk', 'Class B Regional', 'Class C District'];
const CLASS_KM = [4200, 5800, 11302];
const TOTAL_DISTRICTS = 135;

// Canonical 5-stop completeness/risk scale (matches src/utils/helpers.ts RISK_SCALE_STOPS):
// 0.00 Complete/Best #22c55e · 0.25 #84cc16 · 0.50 #eab308 · 0.75 #f97316 · 1.00 Missing/Worst #ef4444
const SCALE5 = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];

// Road-number index: numbered routes by class (A-series trunk roads down to
// numbered district roads); sums to the atlas-wide numbered-road total.
const CLASS_NUMBERED = [62, 214, 574]; // A, B, C - sum 850
const TOTAL_NUMBERED = CLASS_NUMBERED.reduce((a, b) => a + b, 0);

// Numbered roads by region × class (matrix rows=REG_LBL, cols=[A,B,C]) - sums to TOTAL_NUMBERED.
const REG_CLASS_NUMBERED = [
  [15, 44, 130], [9, 36, 95], [11, 38, 105],
  [9, 28, 78], [10, 32, 88], [8, 36, 78],
];

// Atlas plates (1:50,000 map-sheet grid) - count & coverage % by region.
const REG_PLATES = [38, 52, 44, 36, 30, 46]; // sum 246
const TOTAL_PLATES = REG_PLATES.reduce((a, b) => a + b, 0);
const REG_PLATE_COVERAGE = [99, 91, 97, 95, 98, 88]; // %
const PLATE_COVERAGE_PCT = 96;

// Atlas plate publication status (ordered current → draft; 4-band, matches DASHBOARD_COND_COLORS).
const PLATE_STATUS_LBL = ['Current Edition', 'Needs Revision', 'Superseded', 'In Draft'];
const PLATE_STATUS_N = [178, 42, 19, 7]; // sum 246

// Chainage-reference completeness by class (%).
const CHAINAGE_COMPLETE_CLASS = [99, 93, 71]; // A, B, C
const CHAINAGE_COMPLETE_AVG = 88; // network-wide weighted average

// Chainage-reference completeness - 5-band distribution of the 850 numbered roads.
const CHAINAGE_BAND_LBL = ['Complete (100%)', 'High (90–99%)', 'Moderate (70–89%)', 'Low (40–69%)', 'Minimal (<40%)'];
const CHAINAGE_BAND_N = [412, 268, 110, 44, 16]; // sum 850

// Road-numbering scheme compliance - 5-band distribution of the 850 numbered roads.
const COMPLIANCE_BAND_LBL = ['Fully Compliant', 'Minor Variance', 'Non-Standard Format', 'Duplicate / Conflict', 'Unassigned'];
const COMPLIANCE_BAND_N = [598, 156, 62, 21, 13]; // sum 850
const COMPLIANCE_PCT = Math.round((COMPLIANCE_BAND_N[0] + COMPLIANCE_BAND_N[1]) / TOTAL_NUMBERED * 100); // 89%

// Geometry cross-reference (road number ↔ GIS alignment) completeness by class (%).
const XREF_COMPLETE_CLASS = [100, 96, 74]; // A, B, C
const XREF_COMPLETE_AVG = Math.round(
  (XREF_COMPLETE_CLASS[0] * CLASS_KM[0] + XREF_COMPLETE_CLASS[1] * CLASS_KM[1] + XREF_COMPLETE_CLASS[2] * CLASS_KM[2])
  / (CLASS_KM[0] + CLASS_KM[1] + CLASS_KM[2])
); // ≈85%

// Chainage completeness % by region × class (magnitude heat, not a discrete band chart).
const REG_CLASS_CHAINAGE_PCT = [
  [100, 97, 82], [98, 92, 68], [99, 94, 72],
  [97, 90, 65], [100, 95, 78], [95, 85, 55],
];

// District-level statistics - top districts by classified network length (of ~135 nationwide).
const TOP_DISTRICTS = [
  { name: 'Kiryandongo', km: 612 }, { name: 'Nakaseke', km: 578 }, { name: 'Moroto', km: 545 },
  { name: 'Nwoya', km: 520 }, { name: 'Kaabong', km: 498 }, { name: 'Kasese', km: 470 },
  { name: 'Amuru', km: 452 }, { name: 'Kotido', km: 438 }, { name: 'Mubende', km: 415 },
  { name: 'Kibaale', km: 398 }, { name: 'Kamuli', km: 380 }, { name: 'Rakai', km: 365 },
];

// Atlas edition / revision history.
const EDITIONS = [
  { edition: '1st', year: 1962, km: 9200 }, { edition: '2nd', year: 1975, km: 11400 },
  { edition: '3rd', year: 1988, km: 13800 }, { edition: '4th', year: 1998, km: 16200 },
  { edition: '5th', year: 2008, km: 18600 }, { edition: '6th', year: 2015, km: 20100 },
  { edition: '7th', year: 2025, km: 21302 },
];
const EDITION_GAP_LBL = ['1st→2nd', '2nd→3rd', '3rd→4th', '4th→5th', '5th→6th', '6th→7th'];
const EDITION_GAP_YRS = [13, 13, 10, 10, 7, 10];

// Numbered-route length samples (km, sorted ascending) for box-plot distributions by class.
const ROUTE_LEN_A = [15, 28, 42, 55, 62, 68, 74, 88, 120, 218];
const ROUTE_LEN_B = [6, 10, 14, 18, 22, 26, 31, 38, 48, 70];
const ROUTE_LEN_C = [3, 5, 7, 9, 12, 15, 19, 24, 32, 48];

function boxStats(sorted: number[], color: string, name: string) {
  return { name, min: sorted[0], q1: sorted[2], median: (sorted[4] + sorted[5]) / 2, q3: sorted[7], max: sorted[9], color };
}

// Deterministic "numbered route" sample points (length vs districts crossed, size=AADT) - stable across renders.
const ROUTES = Array.from({ length: 40 }, (_, i) => {
  const len = 12 + ((i * 53) % 180);
  const districts = 1 + ((i * 13) % 9);
  const aadt = 300 + ((i * 271) % 9800);
  return { x: len, y: districts, z: aadt };
});

// Regional atlas data-quality profile (best vs weakest region, 0–100 scale).
const RADAR_DATA = [
  { axis: 'Plate Coverage', Central: 99, NorthEastern: 88 },
  { axis: 'Chainage Complete', Central: 96, NorthEastern: 71 },
  { axis: 'GIS X-Ref', Central: 94, NorthEastern: 68 },
  { axis: 'Numbering Compliance', Central: 95, NorthEastern: 74 },
];

export default function RoadAtlasOverviewDashboard() {
  return (
    <div>
      <KpiStrip>
        <StatMini value={TOTAL_NUMBERED.toLocaleString()} label="Numbered Roads in Atlas" color={DASH_C.cyan} />
        <StatMini value={TOTAL_PLATES.toString()} label="Atlas Plates (1:50,000)" color={DASH_C.teal} />
        <StatMini value={`${PLATE_COVERAGE_PCT}%`} label="Plate Coverage" color={DASH_C.green} />
        <StatMini value={TOTAL_DISTRICTS.toString()} label="Districts Indexed" color={DASH_C.purple} />
        <StatMini value={`${CHAINAGE_COMPLETE_AVG}%`} label="Chainage-Ref Completeness" color={DASH_C.yellow} />
        <StatMini value="7th Edition · 2025" label="Current Atlas Edition" color={DASH_C.pink} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.cyan}>Road Number Index & Atlas Plates</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="Numbered Roads by Class" accent={DASH_C.cyan} height={210}>
          <DonutChart
            data={CLASS_LBL.map((n, i) => ({ name: n, value: CLASS_NUMBERED[i] }))}
            colors={[DASH_C.cyan, DASH_C.blue, DASH_C.teal]}
          />
        </ChartBox>
        <ChartBox title="Numbered Roads by Region & Class" accent={DASH_C.cyan} height={210}>
          <HeatGrid matrix={REG_CLASS_NUMBERED} xLabels={['Class A', 'Class B', 'Class C']} yLabels={REG_LBL} accent={DASH_C.cyan} unit=" rds" />
        </ChartBox>
        <ChartBox title="Numbered Roads by Region" subtitle="treemap, sized by route count" accent={DASH_C.purple} height={210}>
          <TreemapC data={REG_LBL.map((r, i) => ({ name: r, size: REG_CLASS_NUMBERED[i].reduce((a, b) => a + b, 0) }))} colors={REGION_COLORS} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="12">
        <ChartBox title="Numbered Route Profile" subtitle="length vs. districts crossed - size=AADT" accent={DASH_C.purple} height={260}>
          <ScatterBubble data={ROUTES} xLabel="Route Length (km)" yLabel="Districts Crossed" color={DASH_C.purple} />
        </ChartBox>
        <ChartBox title="Chainage-Reference Completeness" subtitle="by road class (%)" accent={DASH_C.pink} height={260}>
          <BarV data={CLASS_LBL.map((n, i) => ({ name: n.split(' ')[1], pct: CHAINAGE_COMPLETE_CLASS[i] }))} xKey="name"
            series={[{ key: 'pct', name: 'Chainage Complete %', color: DASH_C.pink }]} unit="%" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="Atlas Plate Status" accent={DASH_C.teal} height={190}>
          <PieChartTile data={PLATE_STATUS_LBL.map((n, i) => ({ name: n, value: PLATE_STATUS_N[i] }))} colors={DASHBOARD_COND_COLORS} />
        </ChartBox>
        <ChartBox title="Plate Coverage" subtitle="target 100% by FY27" accent={DASH_C.green} height={190}>
          <GaugeC value={PLATE_COVERAGE_PCT} target={100} color={DASH_C.green} />
        </ChartBox>
        <ChartBox title="Numbering Scheme Compliance" subtitle="target 95%" accent={DASH_C.yellow} height={190}>
          <GaugeC value={COMPLIANCE_PCT} target={95} color={DASH_C.yellow} />
        </ChartBox>
        <ChartBox title="Geometry Cross-Reference" subtitle="number ↔ GIS alignment" accent={DASH_C.cyan} height={190}>
          <DonutChart data={[
            { name: 'Linked', value: XREF_COMPLETE_AVG, color: '#22c55e' },
            { name: 'Pending', value: 100 - XREF_COMPLETE_AVG, color: '#ef4444' },
          ]} />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.teal}>District & Edition Reference</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="Top Districts by Network Length" subtitle={`of ${TOTAL_DISTRICTS} districts nationwide`} accent={DASH_C.blue} height={230}>
          <BarH data={TOP_DISTRICTS} yKey="name" series={[{ key: 'km', name: 'Network Length', color: DASH_C.blue }]} unit=" km" />
        </ChartBox>
        <ChartBox title="Atlas Coverage Growth by Edition" accent={DASH_C.green} height={230}>
          <LineMulti data={EDITIONS.map(e => ({ edition: e.edition, km: e.km }))} xKey="edition"
            series={[{ key: 'km', name: 'Network Covered', color: DASH_C.green }]} unit="km" area />
        </ChartBox>
        <ChartBox title="Atlas Revision Cadence" subtitle="years between editions" accent={DASH_C.orange} height={230}>
          <BarV data={EDITION_GAP_LBL.map((n, i) => ({ name: n, years: EDITION_GAP_YRS[i] }))} xKey="name"
            series={[{ key: 'years', name: 'Years', color: DASH_C.orange }]} unit="y" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Route Length Distribution" subtitle="by road class" accent={DASH_C.orange} height={210}>
          <BoxPlotApprox data={[
            boxStats(ROUTE_LEN_A, DASH_C.cyan, 'Class A'), boxStats(ROUTE_LEN_B, DASH_C.yellow, 'Class B'), boxStats(ROUTE_LEN_C, DASH_C.orange, 'Class C'),
          ]} unit="km" />
        </ChartBox>
        <ChartBox title="Numbered Road Index Build-Up" subtitle="waterfall, route count" accent={DASH_C.pink} height={210}>
          <WaterfallC steps={[
            { name: 'Class A', delta: CLASS_NUMBERED[0], isTotal: true }, { name: '+Class B', delta: CLASS_NUMBERED[1] },
            { name: '+Class C', delta: CLASS_NUMBERED[2] }, { name: '=Total Numbered', delta: TOTAL_NUMBERED, isTotal: true },
            { name: '−Pending Chainage', delta: -98 }, { name: '−Pending GIS X-ref', delta: -142 },
            { name: '=Fully Cross-Ref\'d', delta: 610, isTotal: true },
          ]} unit=" rds" />
        </ChartBox>
        <ChartBox title="Regional Atlas Data Quality" subtitle="best vs. weakest region" accent={DASH_C.teal} height={210}>
          <RadarTile data={RADAR_DATA} series={[
            { key: 'Central', name: 'Central (Best)', color: DASH_C.cyan }, { key: 'NorthEastern', name: 'North Eastern (Weakest)', color: DASH_C.orange },
          ]} />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.yellow}>Completeness, Compliance & Regional Detail</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="Chainage-Reference Completeness" subtitle="5-band distribution, 850 numbered roads" accent={DASH_C.yellow} height={210}>
          <DonutChart data={CHAINAGE_BAND_LBL.map((n, i) => ({ name: n, value: CHAINAGE_BAND_N[i], color: SCALE5[i] }))} innerRadius={38} />
        </ChartBox>
        <ChartBox title="Numbering Scheme Compliance" subtitle="5-band distribution, 850 numbered roads" accent={DASH_C.orange} height={210}>
          <PieChartTile data={COMPLIANCE_BAND_LBL.map((n, i) => ({ name: n, value: COMPLIANCE_BAND_N[i], color: SCALE5[i] }))} />
        </ChartBox>
        <ChartBox title="Atlas Data Pipeline" subtitle="classified → plate-indexed, km" accent={DASH_C.blue} height={210}>
          <FunnelC data={[
            { name: 'Classified Network', value: 21302 }, { name: 'Road Number Assigned', value: 19850 },
            { name: 'Chainage Referenced', value: 18760 }, { name: 'GIS Geometry Cross-Ref', value: 16920 },
            { name: 'Atlas Plate Indexed', value: 15480 },
          ]} colors={[DASH_C.cyan, DASH_C.teal, DASH_C.blue, DASH_C.yellow, DASH_C.green]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Atlas Plates by Region" accent={DASH_C.purple} height={190}>
          <BarV data={REG_LBL.map((r, i) => ({ name: r, plates: REG_PLATES[i] }))} xKey="name"
            series={[{ key: 'plates', name: 'Plates', color: DASH_C.purple }]} />
        </ChartBox>
        <ChartBox title="Plate Coverage by Region" accent={DASH_C.green} height={190}>
          <BarH data={REG_LBL.map((r, i) => ({ region: r, pct: REG_PLATE_COVERAGE[i] }))} yKey="region"
            series={[{ key: 'pct', name: 'Coverage %', color: DASH_C.green }]} unit="%" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Chainage Completeness" subtitle="by region × class (%)" accent={DASH_C.cyan} height={200}>
          <HeatGrid matrix={REG_CLASS_CHAINAGE_PCT} xLabels={['Class A', 'Class B', 'Class C']} yLabels={REG_LBL} accent={DASH_C.cyan} unit="%" />
        </ChartBox>
        <ChartBox title="Districts Fully Cross-Referenced" subtitle="road number ↔ GIS geometry, target 90%" accent={DASH_C.pink} height={200}>
          <GaugeC value={79} target={90} color={DASH_C.pink} label="of 135 districts" />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
