/**
 * NetworkOverviewDashboard — RMS "Dashboard" tab flagship view.
 * Port of public/dashboard.html Tab 1 (NETWORK OVERVIEW, charts c1–c15) into
 * live React/Recharts, extended to 20 chart tiles. Real FY25/26 NDPIV network
 * figures (matches the platform's official 21,302 km total). No tables here —
 * tabular breakdowns live under Exhaustive Tables / Deep Analytics.
 */
import {
  DASH_C, REGION_COLORS, CONDITION_COLORS, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  SunburstApprox, HeatGrid, BarH, ScatterBubble, GaugeC, BarV, LineMulti, DonutChart, PieChartTile,
  BoxPlotApprox, WaterfallC, RadarTile, TreemapC, FunnelC,
} from '../../../shared/dashboardKit';

// ─── Data model (matches public/dashboard.html's single source of truth `D`) ─
const TOTAL = 21302, PAVED = 6405, UNPAVED = 14897, UNMAPPED = 165;
const REG_LBL = ['Central', 'Northern', 'Eastern', 'Western', 'Southern', 'North Eastern'];
const REG_KM = [4436, 3920, 4290, 3000, 3300, 2356];
const REG_PAVED = [1850, 900, 860, 1280, 1140, 375];
const REG_UNPAVED = [2586, 3020, 3430, 1720, 2160, 1981];
const REG_CLASS = [ // [A, B, C] per region — sums to REG_KM
  [1050, 1300, 2086], [720, 1100, 2100], [800, 1200, 2290],
  [640, 900, 1460], [620, 850, 1830], [370, 450, 1536],
];
const REG_COND_A = [80, 70, 72, 75, 78, 65];
const REG_COND_B = [62, 55, 58, 60, 61, 50];
const REG_COND_C = [45, 38, 40, 42, 44, 34];
const CLASS_LBL = ['Class A Trunk', 'Class B Regional', 'Class C District'];
const CLASS_KM = [4200, 5800, 11302];
const CLASS_PAVED = [3360, 2146, 899];
const SURF_LBL = ['Bituminous', 'Concrete', 'Gravel', 'Earth'];
const SURF_KM = [5840, 565, 10240, 4657];
const NET_YRS = [2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024, 2025];
const NET_KM = [18200, 18800, 19400, 20100, 20600, 20900, 21050, 21200, 21302];
const NET_PAVED_TREND = [5200, 5600, 5800, 5900, 6100, 6200, 6300, 6380, 6405];
const IRI_A = [2.1, 2.4, 2.8, 3.2, 3.3, 3.3, 3.4, 3.6, 3.8, 4.2];
const IRI_B = [3.2, 3.8, 4.2, 4.4, 4.5, 4.6, 5.0, 5.4, 5.8, 6.2];
const IRI_C = [4.8, 5.2, 5.8, 6.2, 6.3, 6.4, 6.8, 7.2, 7.8, 9.1];

function boxStats(sorted: number[], color: string, name: string) {
  return { name, min: sorted[0], q1: sorted[2], median: (sorted[4] + sorted[5]) / 2, q3: sorted[7], max: sorted[9], color };
}

// Deterministic "road segment" sample points (Uganda bounds) — stable across renders.
const SEGMENTS = Array.from({ length: 48 }, (_, i) => {
  const seed = i * 37.13;
  const lat = -1.4 + ((seed * 9301 + 49297) % 233280) / 233280 * 5.4;
  const lng = 29.6 + ((seed * 4103 + 12345) % 199999) / 199999 * 5.2;
  const aadt = 400 + ((i * 613) % 17600);
  const iri = 1.5 + ((i * 41) % 750) / 100;
  return { x: +lng.toFixed(2), y: +lat.toFixed(2), z: aadt, iri };
});

const REG_CLASS_ROWS = REG_LBL.map((r, i) => ({ name: r, A: REG_CLASS[i][0], B: REG_CLASS[i][1], C: REG_CLASS[i][2] }));

export default function NetworkOverviewDashboard() {
  return (
    <div>
      <KpiStrip>
        <StatMini value={`${TOTAL.toLocaleString()} km`} label="Total Network" color={DASH_C.cyan} />
        <StatMini value={`${PAVED.toLocaleString()} km`} label={`Paved (${Math.round(PAVED / TOTAL * 100)}%)`} color={DASH_C.green} />
        <StatMini value={`${UNPAVED.toLocaleString()} km`} label={`Unpaved (${Math.round(UNPAVED / TOTAL * 100)}%)`} color={DASH_C.orange} />
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
              { name: 'Bitumen', value: 5840, color: '#00ccdd' }, { name: 'Concrete', value: 565, color: '#00aa66' },
              { name: 'Gravel', value: 10240, color: '#c25e2a' }, { name: 'Earth', value: 4657, color: '#8a4a26' },
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
        <ChartBox title="Road Segments" subtitle="location & traffic — size=AADT" accent={DASH_C.purple} height={260}>
          <ScatterBubble data={SEGMENTS} xLabel="Longitude" yLabel="Latitude" color={DASH_C.purple} />
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
          <GaugeC value={Math.round(PAVED / TOTAL * 100)} target={40} color={DASH_C.cyan} />
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
            { name: 'Total', delta: TOTAL, isTotal: true }, { name: '−Class C', delta: -11302 }, { name: '−Class B', delta: -5800 },
            { name: '=Class A', delta: 4200, isTotal: true }, { name: '−Earth', delta: -4657 }, { name: '−Gravel', delta: -10240 },
            { name: '=Paved', delta: 6405, isTotal: true },
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
          <BarV data={REG_LBL.map((r, i) => ({ name: r, km: Math.round(UNMAPPED * (REG_KM[i] / TOTAL)) }))} xKey="name"
            series={[{ key: 'km', name: 'Unmapped km', color: DASH_C.pink }]} unit="km" />
        </ChartBox>
        <ChartBox title="Class Distribution" accent={DASH_C.purple} height={190}>
          <DonutChart data={CLASS_LBL.map((n, i) => ({ name: n, value: CLASS_KM[i] }))} colors={[DASH_C.cyan, '#00aacc', '#006688']} innerRadius={38} />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
