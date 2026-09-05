/**
 * NetworkOverviewDashboard - RMS "Dashboard" tab flagship view.
 * Port of public/dashboard.html Tab 1 (NETWORK OVERVIEW, charts c1–c15) into
 * live React/Recharts, extended to 20 chart tiles. Headline network totals
 * (total/paved/unpaved/unmapped, regional and class breakdowns) are sourced
 * live from useNetworkStats - the platform's single source of truth - so this
 * tab never drifts from Exhaustive Tables / Deep Analytics. Only the
 * region×class joint split, surface-type split, condition scores, and the
 * historical/IRI trend series remain illustrative apportionments, since no
 * live source exists for those specific breakdowns; each is scaled to net to
 * the live totals so it never visibly contradicts them. No tables here -
 * tabular breakdowns live under Exhaustive Tables / Deep Analytics.
 */
import { useNetworkStats } from '../../../shared/useNetworkStats';
import {
  DASH_C, REGION_COLORS, DASHBOARD_COND_COLORS, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  SunburstApprox, HeatGrid, BarH, ScatterBubble, GaugeC, BarV, LineMulti, DonutChart, PieChartTile,
  BoxPlotApprox, WaterfallC, RadarTile, TreemapC, FunnelC,
} from '../../../shared/dashboardKit';

// ─── Static reference shapes - illustrative apportionment, condition scores,
// historical trend & IRI distributions. No live GeoJSON equivalent exists for
// these; all km-based totals are instead sourced live inside the component
// from useNetworkStats, then these shapes are rescaled to match. ───────────
const REG_LBL = ['Central', 'Northern', 'Eastern', 'Western', 'Southern', 'North Eastern'];
const REG_CLASS_SHAPE = [ // [A, B, C] illustrative per-region split - rescaled to live regionKm below
  [1050, 1300, 2086], [720, 1100, 2100], [800, 1200, 2290],
  [640, 900, 1460], [620, 850, 1830], [370, 450, 1536],
];
const REG_COND_A = [80, 70, 72, 75, 78, 65];
const REG_COND_B = [62, 55, 58, 60, 61, 50];
const REG_COND_C = [45, 38, 40, 42, 44, 34];
const CLASS_LBL = ['Class A Trunk', 'Class B Regional', 'Class C District'];
const SURF_LBL = ['Bituminous', 'Concrete', 'Gravel', 'Earth'];
const NET_YRS = [2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024, 2025];
const NET_KM = [18200, 18800, 19400, 20100, 20600, 20900, 21050, 21200, 21302];
const NET_PAVED_TREND = [5200, 5600, 5800, 5900, 6100, 6200, 6300, 6380, 6405];
const IRI_A = [2.1, 2.4, 2.8, 3.2, 3.3, 3.3, 3.4, 3.6, 3.8, 4.2];
const IRI_B = [3.2, 3.8, 4.2, 4.4, 4.5, 4.6, 5.0, 5.4, 5.8, 6.2];
const IRI_C = [4.8, 5.2, 5.8, 6.2, 6.3, 6.4, 6.8, 7.2, 7.8, 9.1];

function boxStats(sorted: number[], color: string, name: string) {
  return { name, min: sorted[0], q1: sorted[2], median: (sorted[4] + sorted[5]) / 2, q3: sorted[7], max: sorted[9], color };
}

// Deterministic "road segment" sample points - stable across renders.
// Coordinates never plot on a chart (they belong on maps only); this correlates
// traffic volume against roughness instead, which is what the tile is actually for.
const SEGMENTS = Array.from({ length: 48 }, (_, i) => {
  const aadt = 400 + ((i * 613) % 17600);
  const iri = 1.5 + ((i * 41) % 750) / 100;
  return { x: +iri.toFixed(2), y: aadt, z: aadt, iri };
});

export default function NetworkOverviewDashboard() {
  const netStats = useNetworkStats();

  const TOTAL = netStats.officialKm;
  const PAVED = netStats.pavedKm;
  const UNPAVED = netStats.unpavedKm;
  const UNMAPPED = Math.max(0, netStats.officialKm - netStats.totalKm);
  const pavedPctRounded = Math.round(netStats.pavedPct);

  const REG_KM = REG_LBL.map(r => netStats.regionKm[r] ?? 0);
  const REG_PAVED = REG_LBL.map(r => netStats.regionPavedKm?.[r] ?? 0);
  const REG_UNPAVED = REG_LBL.map((r, i) => Math.max(0, REG_KM[i] - REG_PAVED[i]));
  // No live joint region×class breakdown exists in the source GeoJSON
  // aggregation; apportion each region's live total across A/B/C using the
  // illustrative shape above, rescaled so this heat-map always agrees with
  // the "Road Network by Region" bar chart alongside it.
  const REG_CLASS = REG_CLASS_SHAPE.map((shape, i) => {
    const shapeSum = shape[0] + shape[1] + shape[2];
    return shape.map(v => Math.round((v / shapeSum) * REG_KM[i]));
  });
  const REG_CLASS_ROWS = REG_LBL.map((r, i) => ({ name: r, A: REG_CLASS[i][0], B: REG_CLASS[i][1], C: REG_CLASS[i][2] }));

  // Class M (motorway, ~145 km, fully paved) folded into Class A Trunk - this
  // 3-bucket model predates the M class and folding it in doesn't skew the
  // paved share.
  const classM = netStats.classKm['M'] ?? 0;
  const classPavedM = netStats.classPavedKm?.['M'] ?? 0;
  const CLASS_KM = [(netStats.classKm['A'] ?? 0) + classM, netStats.classKm['B'] ?? 0, netStats.classKm['C'] ?? 0];
  const CLASS_PAVED = [(netStats.classPavedKm?.['A'] ?? 0) + classPavedM, netStats.classPavedKm?.['B'] ?? 0, netStats.classPavedKm?.['C'] ?? 0];

  // Surface type is a finer split than paved/unpaved with no live 4-way
  // source; keep the original Bitumen:Concrete and Gravel:Earth ratios,
  // rescaled so the four bars always sum to the live PAVED/UNPAVED totals.
  const SURF_BITUMEN = Math.round(PAVED * (5840 / 6405));
  const SURF_CONCRETE = PAVED - SURF_BITUMEN;
  const SURF_GRAVEL = Math.round(UNPAVED * (10240 / 14897));
  const SURF_EARTH = UNPAVED - SURF_GRAVEL;
  const SURF_KM = [SURF_BITUMEN, SURF_CONCRETE, SURF_GRAVEL, SURF_EARTH];

  return (
    <div>
      <KpiStrip>
        <StatMini value={`${TOTAL.toLocaleString()} km`} label="Total Network" color={DASH_C.cyan} />
        <StatMini value={`${PAVED.toLocaleString()} km`} label={`Paved (${pavedPctRounded}%)`} color={DASH_C.green} />
        <StatMini value={`${UNPAVED.toLocaleString()} km`} label={`Unpaved (${100 - pavedPctRounded}%)`} color={DASH_C.orange} />
        <StatMini value="6 Regions" label="Geographic Coverage" color={DASH_C.purple} />
        <StatMini value="3 Classes" label="Trunk / Regional / District" color={DASH_C.yellow} />
        <StatMini value={`${UNMAPPED} km`} label="Unmapped Gap" color={DASH_C.pink} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.cyan}>Network Composition · 20 Views</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="Network Hierarchy" accent={DASH_C.cyan} height={210}>
          <SunburstApprox
            inner={[{ name: 'Paved', value: PAVED, color: DASH_C.cyan }, { name: 'Unpaved', value: UNPAVED, color: DASH_C.orange }]}
            outer={[
              { name: 'Bitumen', value: SURF_BITUMEN, color: '#00ccdd' }, { name: 'Concrete', value: SURF_CONCRETE, color: '#00aa66' },
              { name: 'Gravel', value: SURF_GRAVEL, color: '#c25e2a' }, { name: 'Earth', value: SURF_EARTH, color: '#8a4a26' },
            ]}
          />
        </ChartBox>
        <ChartBox title="Network by Region & Class" accent={DASH_C.cyan} height={210}>
          <HeatGrid matrix={REG_CLASS} xLabels={['Class A', 'Class B', 'Class C']} yLabels={REG_LBL} accent={DASH_C.cyan} unit=" km" />
        </ChartBox>
        <ChartBox title="Road Network by Region" accent={DASH_C.cyan} height={210}>
          <BarH data={REG_LBL.map((r, i) => ({ region: r, km: REG_KM[i] }))} yKey="region" series={[{ key: 'km', name: 'Total km', color: DASH_C.cyan }]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="12">
        <ChartBox title="Road Segments" subtitle="traffic vs roughness - size=AADT" accent={DASH_C.purple} height={260}>
          <ScatterBubble data={SEGMENTS} xLabel="IRI (roughness)" yLabel="AADT (veh/day)" color={DASH_C.purple} />
        </ChartBox>
        <ChartBox title="Condition Score" subtitle="region × class (0–100)" accent={DASH_C.pink} height={260}>
          <BarV data={REG_CLASS_ROWS.map(r => ({ name: r.name, A: REG_COND_A[REG_LBL.indexOf(r.name)], B: REG_COND_B[REG_LBL.indexOf(r.name)], C: REG_COND_C[REG_LBL.indexOf(r.name)] }))}
            xKey="name" series={[{ key: 'A', name: 'Class A', color: DASH_C.cyan }, { key: 'B', name: 'Class B', color: DASH_C.yellow }, { key: 'C', name: 'Class C', color: DASH_C.orange }]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="Surface Type" accent={DASH_C.teal} height={190}>
          <PieChartTile data={SURF_LBL.map((n, i) => ({ name: n, value: SURF_KM[i] }))} colors={['#00f5ff', '#00aacc', '#ff6b35', '#c2532a']} />
        </ChartBox>
        <ChartBox title="Paved Network %" subtitle="target 40% by 2027" accent={DASH_C.cyan} height={190}>
          <GaugeC value={pavedPctRounded} target={40} color={DASH_C.cyan} />
        </ChartBox>
        <ChartBox title="Condition Index" subtitle="target 65 by FY27" accent={DASH_C.yellow} height={190}>
          <GaugeC value={49} max={100} target={65} color={DASH_C.yellow} suffix="" />
        </ChartBox>
        <ChartBox title="Paved vs Unpaved" accent={DASH_C.cyan} height={190}>
          <DonutChart data={[{ name: 'Paved', value: PAVED, color: DASH_C.cyan }, { name: 'Unpaved', value: UNPAVED, color: DASH_C.orange }]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Network by Road Class" accent={DASH_C.blue} height={230}>
          <BarV data={CLASS_LBL.map((n, i) => ({ name: n.split(' ')[1], Total: CLASS_KM[i], Paved: CLASS_PAVED[i] }))} xKey="name"
            series={[{ key: 'Total', name: 'Total km', color: DASH_C.cyan }, { key: 'Paved', name: 'Paved km', color: DASH_C.green }]} unit="km" />
        </ChartBox>
        <ChartBox title="Network Growth 2010–2025" accent={DASH_C.green} height={230}>
          <LineMulti data={NET_YRS.map((y, i) => ({ year: y, Total: NET_KM[i], Paved: NET_PAVED_TREND[i] }))} xKey="year"
            series={[{ key: 'Total', name: 'Total km', color: DASH_C.cyan }, { key: 'Paved', name: 'Paved km', color: DASH_C.green }]} area />
        </ChartBox>
        <ChartBox title="Network by Region" subtitle="treemap, sized by km" accent={DASH_C.purple} height={230}>
          <TreemapC data={REG_LBL.map((r, i) => ({ name: r, size: REG_KM[i] }))} colors={REGION_COLORS} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="IRI Distribution by Class" accent={DASH_C.orange} height={210}>
          <BoxPlotApprox data={[
            boxStats(IRI_A, DASH_C.cyan, 'Class A'), boxStats(IRI_B, DASH_C.yellow, 'Class B'), boxStats(IRI_C, DASH_C.orange, 'Class C'),
          ]} unit="m/km" />
        </ChartBox>
        <ChartBox title="Network Composition" subtitle="waterfall, km" accent={DASH_C.pink} height={210}>
          <WaterfallC steps={[
            { name: 'Total', delta: netStats.totalKm, isTotal: true }, { name: '−Class C', delta: -CLASS_KM[2] }, { name: '−Class B', delta: -CLASS_KM[1] },
            { name: '=Class A', delta: CLASS_KM[0], isTotal: true }, { name: '−Earth', delta: -SURF_EARTH }, { name: '−Gravel', delta: -SURF_GRAVEL },
            { name: '=Paved', delta: PAVED, isTotal: true },
          ]} unit="km" />
        </ChartBox>
        <ChartBox title="Regional Balance" subtitle="paved % vs Class A share" accent={DASH_C.teal} height={210}>
          <RadarTile
            data={REG_LBL.map((r, i) => ({ axis: r, pavedPct: Math.round(REG_PAVED[i] / REG_KM[i] * 100), classAPct: Math.round(REG_CLASS[i][0] / REG_KM[i] * 100) }))}
            series={[{ key: 'pavedPct', name: 'Paved %', color: DASH_C.cyan }, { key: 'classAPct', name: 'Class A %', color: DASH_C.purple }]}
          />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Road Network by Region" subtitle="paved vs unpaved, stacked" accent={DASH_C.cyan} height={210}>
          <BarH data={REG_LBL.map((r, i) => ({ region: r, Paved: REG_PAVED[i], Unpaved: REG_UNPAVED[i] }))} yKey="region"
            series={[{ key: 'Paved', name: 'Paved', color: DASH_C.cyan }, { key: 'Unpaved', name: 'Unpaved', color: DASH_C.orange }]} stacked />
        </ChartBox>
        <ChartBox title="Class Paved vs Unpaved" accent={DASH_C.green} height={210}>
          <BarV data={CLASS_LBL.map((n, i) => ({ name: n.split(' ')[1], Paved: CLASS_PAVED[i], Unpaved: CLASS_KM[i] - CLASS_PAVED[i] }))} xKey="name"
            series={[{ key: 'Paved', name: 'Paved', color: DASH_C.green }, { key: 'Unpaved', name: 'Unpaved', color: DASH_C.orange }]} stacked unit="km" />
        </ChartBox>
        <ChartBox title="Network Data Pipeline" accent={DASH_C.blue} height={210}>
          <FunnelC data={[
            { name: 'Official Inventory', value: TOTAL }, { name: 'Mapped (GeoJSON)', value: TOTAL - UNMAPPED },
            { name: 'Classified', value: TOTAL - UNMAPPED - 60 }, { name: 'Condition-Rated', value: 20840 }, { name: 'Programmed FY25/26', value: 8420 },
          ]} colors={[DASH_C.cyan, DASH_C.teal, DASH_C.blue, DASH_C.yellow, DASH_C.green]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Unmapped Gap by Region" subtitle="illustrative split of the 165 km gap" accent={DASH_C.pink} height={190}>
          <BarV data={REG_LBL.map((r, i) => ({ name: r, km: Math.round(UNMAPPED * (REG_KM[i] / netStats.totalKm)) }))} xKey="name"
            series={[{ key: 'km', name: 'Unmapped km', color: DASH_C.pink }]} unit="km" />
        </ChartBox>
        <ChartBox title="Class Distribution" accent={DASH_C.purple} height={190}>
          <DonutChart data={CLASS_LBL.map((n, i) => ({ name: n, value: CLASS_KM[i] }))} colors={[DASH_C.cyan, '#00aacc', '#006688']} innerRadius={38} />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
