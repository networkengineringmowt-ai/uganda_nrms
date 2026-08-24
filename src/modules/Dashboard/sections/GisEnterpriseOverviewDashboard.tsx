/**
 * GisEnterpriseOverviewDashboard — RMS "Dashboard" tab, GIS Enterprise Platform view.
 * Spatial data infrastructure overview: the layer catalogue, WMS/WFS service usage,
 * aerial imagery coverage, data quality/completeness, geoprocessing throughput, CRS
 * usage, storage footprint and API access for the enterprise GIS that underpins road
 * asset management. Illustrative but internally consistent, anchored to the same
 * canonical platform figures used elsewhere: 21,302 km classified network across 6
 * regions (Central, Northern, Eastern, Western, Southern, North Eastern) and 546
 * structures (312 bridges, 142 box culverts, 68 culverts, 24 drifts/causeways) —
 * every road/structure layer's feature count below is built to match those totals.
 * No tables here — tabular breakdowns live under Exhaustive Tables / Deep Analytics.
 */
import {
  DASH_C, REGION_COLORS, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  DonutChart, PieChartTile, BarV, BarH, LineMulti, ScatterBubble, HeatGrid, TreemapC,
  GaugeC, FunnelC, RadarTile, SunburstApprox, BoxPlotApprox, WaterfallC,
} from '../../../shared/dashboardKit';

// Canonical 5-stop risk/quality scale — used ONLY for ordered/severity dimensions.
const QUALITY_SCALE = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];

// ─── Data model ──────────────────────────────────────────────────────────────
const TOTAL_LAYERS = 214;
const TOTAL_NETWORK_KM = 21302;
const TOTAL_STRUCTURES = 546;
const REG_LBL = ['Central', 'Northern', 'Eastern', 'Western', 'Southern', 'North Eastern'];

// Layer catalogue by category
const LAYER_CAT_LBL = ['Roads', 'Structures', 'Administrative', 'Imagery', 'Hydrology', 'Land Use'];
const LAYER_CAT_COUNT = [42, 28, 24, 36, 46, 38];
const LAYER_CAT_COLORS = [DASH_C.cyan, DASH_C.purple, DASH_C.yellow, DASH_C.orange, DASH_C.blue, DASH_C.green];

// Layer status breakdown (sums to TOTAL_LAYERS)
const LAYER_STATUS = [148, 41, 25];
const LAYER_STATUS_LBL = ['Published', 'Draft', 'Archived'];
const LAYER_STATUS_COLORS = [DASH_C.green, DASH_C.yellow, 'rgba(148,163,184,0.55)'];

// Layer status by category (Published / Draft / Archived) — rows sum to LAYER_CAT_COUNT
const CAT_STATUS_MATRIX = [
  [30, 8, 4],   // Roads
  [20, 6, 2],   // Structures
  [17, 5, 2],   // Administrative
  [24, 8, 4],   // Imagery
  [32, 8, 6],   // Hydrology
  [25, 6, 7],   // Land Use
];

// Aerial imagery coverage % of network by region (recent high-res <= 2yr)
const IMG_COVERAGE_PCT = [88, 61, 74, 79, 70, 42];

// Imagery age/recency distribution (% of network area by capture recency)
const IMG_AGE_LBL = ['<1yr', '1-2yr', '2-3yr', '3-5yr', '>5yr'];
const IMG_AGE_PCT = [24, 33, 21, 14, 8];

// Geoprocessing / analysis job volume trend (monthly, last 8 months)
const JOB_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
const JOB_COMPLETED = [1240, 1310, 1180, 1460, 1580, 1690, 1620, 1780];
const JOB_FAILED = [58, 46, 62, 40, 35, 38, 30, 26];

// Data completeness score by layer (0-100, ordered good->bad via QUALITY_SCALE bucket)
const COMPLETENESS_LAYERS = ['Road Centerlines', 'Bridge Inventory', 'District Boundaries', 'Aerial Ortho Mosaic', 'River Network', 'Land Parcels', 'Culvert Inventory', 'Drainage Basins'];
const COMPLETENESS_SCORE = [96, 91, 99, 83, 88, 62, 85, 71];

// Storage volume (GB) by layer type
const STORAGE_LBL = ['Imagery', 'Hydrology', 'Land Use', 'Roads', 'Structures', 'Administrative'];
const STORAGE_GB = [48600, 9200, 7400, 3100, 1450, 620];
const STORAGE_COLORS = [DASH_C.orange, DASH_C.blue, DASH_C.green, DASH_C.cyan, DASH_C.purple, DASH_C.yellow];

// CRS / projection usage across the catalogue (layer count)
const CRS_LBL = ['UTM 36N (EPSG:32636)', 'Arc 1960 / UTM 36N', 'WGS84 Geographic', 'UTM 35N (EPSG:32635)', 'Other/Legacy'];
const CRS_COUNT = [126, 44, 28, 11, 5];

// API / service request volume trend (weekly, last 10 weeks, thousands of requests)
const API_WEEKS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10'];
const API_WMS = [186, 194, 201, 210, 198, 224, 236, 241, 252, 268];
const API_WFS = [64, 68, 72, 70, 75, 81, 84, 88, 92, 96];

// Spatial data quality issues by severity (ordered, worst last) — QUALITY_SCALE order
const QUALITY_ISSUE_LBL = ['Minor', 'Low', 'Moderate', 'Elevated', 'Critical'];
const QUALITY_ISSUE_COUNT = [312, 184, 96, 41, 14];

// Top-used layers (API requests, last 30 days, thousands)
const TOP_LAYERS_LBL = ['Road Network', 'Aerial Imagery 2024', 'District Boundaries', 'Bridge Locations', 'AADT Points', 'Land Parcels'];
const TOP_LAYERS_REQ = [412, 386, 298, 254, 201, 176];

// Feature count by layer (log-scale-ish spread, ties back to canonical totals)
const FEATURE_LAYERS = ['Road Segments', 'Structures', 'District Boundaries', 'Culvert Points', 'Imagery Tiles', 'Land Parcels', 'River Reaches', 'AADT Stations'];
const FEATURE_COUNT = [8460, TOTAL_STRUCTURES, 176, 3120, 24800, 41600, 2140, 640];

// Users / API access by client type
const CLIENT_LBL = ['Web Dashboard', 'Field Mobile App', 'Desktop GIS (QGIS/ArcGIS)', 'Third-Party Integration'];
const CLIENT_COUNT = [186, 240, 58, 22];

// Geoprocessing job types (funnel-ish pipeline of a spatial QA run)
const PIPELINE = [
  { name: 'Layers Ingested', value: TOTAL_LAYERS },
  { name: 'Topology Validated', value: 189 },
  { name: 'CRS Normalized', value: 176 },
  { name: 'QA Passed', value: 161 },
  { name: 'Published to Services', value: LAYER_STATUS[0] },
];

// Data freshness by layer (days since last update) — box-plot style spread per category
const FRESH_ROADS = [1, 3, 5, 8, 12, 15, 20, 28, 35, 60];
const FRESH_IMAGERY = [30, 90, 180, 240, 300, 365, 420, 540, 700, 900];
const FRESH_ADMIN = [5, 20, 45, 60, 90, 120, 150, 200, 260, 400];

function boxStats(sorted: number[], color: string, name: string) {
  return { name, min: sorted[0], q1: sorted[2], median: (sorted[4] + sorted[5]) / 2, q3: sorted[7], max: sorted[9], color };
}

// Deterministic imagery tile sample points (Uganda bounds) — resolution (cm/px) vs age (months)
const TILE_SAMPLES = Array.from({ length: 42 }, (_, i) => {
  const seed = i * 29.71;
  const lat = -1.4 + ((seed * 9301 + 49297) % 233280) / 233280 * 5.4;
  const lng = 29.6 + ((seed * 4103 + 12345) % 199999) / 199999 * 5.2;
  const resCm = 5 + ((i * 37) % 45);
  const ageMo = 1 + ((i * 53) % 60);
  return { x: +lng.toFixed(2), y: +lat.toFixed(2), z: resCm, ageMo };
});
const RES_VS_AGE = TILE_SAMPLES.map(t => ({ x: t.ageMo, y: t.z }));

const CAT_STATUS_ROWS = LAYER_CAT_LBL.map((c, i) => ({
  name: c, Published: CAT_STATUS_MATRIX[i][0], Draft: CAT_STATUS_MATRIX[i][1], Archived: CAT_STATUS_MATRIX[i][2],
}));

export default function GisEnterpriseOverviewDashboard() {
  return (
    <div>
      <KpiStrip>
        <StatMini value={`${TOTAL_LAYERS}`} label="GIS Layers Catalogued" color={DASH_C.purple} />
        <StatMini value={`${LAYER_STATUS[0]}`} label={`Published (${Math.round(LAYER_STATUS[0] / TOTAL_LAYERS * 100)}%)`} color={DASH_C.green} />
        <StatMini value="71%" label="Network Imagery <2yr" color={DASH_C.cyan} />
        <StatMini value={`${(STORAGE_GB.reduce((a, b) => a + b, 0) / 1000).toFixed(1)} TB`} label="Spatial Data Storage" color={DASH_C.orange} />
        <StatMini value="26.4K" label="Weekly API Requests" color={DASH_C.yellow} />
        <StatMini value="88%" label="QA Pass Rate" color={DASH_C.teal} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.purple}>GIS Layer Catalogue · Coverage & Currency</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="Layer Catalogue" subtitle="hierarchy: status → category" accent={DASH_C.purple} height={210}>
          <SunburstApprox
            inner={LAYER_STATUS_LBL.map((n, i) => ({ name: n, value: LAYER_STATUS[i], color: LAYER_STATUS_COLORS[i] }))}
            outer={LAYER_CAT_LBL.map((n, i) => ({ name: n, value: LAYER_CAT_COUNT[i], color: LAYER_CAT_COLORS[i] }))}
          />
        </ChartBox>
        <ChartBox title="Layer Status by Category" accent={DASH_C.purple} height={210}>
          <HeatGrid matrix={CAT_STATUS_MATRIX} xLabels={['Publ.', 'Draft', 'Arch.']} yLabels={LAYER_CAT_LBL} accent={DASH_C.purple} unit="" />
        </ChartBox>
        <ChartBox title="Layers by Category" accent={DASH_C.purple} height={210}>
          <BarH data={LAYER_CAT_LBL.map((c, i) => ({ category: c, count: LAYER_CAT_COUNT[i] }))} yKey="category"
            series={[{ key: 'count', name: 'Layers', color: DASH_C.purple }]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="12">
        <ChartBox title="Imagery Tiles" subtitle="location & resolution — size=cm/px" accent={DASH_C.orange} height={260}>
          <ScatterBubble data={TILE_SAMPLES} xLabel="Longitude" yLabel="Latitude" color={DASH_C.orange} />
        </ChartBox>
        <ChartBox title="Layer Status Mix by Category" accent={DASH_C.pink} height={260}>
          <BarV data={CAT_STATUS_ROWS} xKey="name"
            series={[{ key: 'Published', name: 'Published', color: DASH_C.green }, { key: 'Draft', name: 'Draft', color: DASH_C.yellow }, { key: 'Archived', name: 'Archived', color: 'rgba(148,163,184,0.55)' }]} stacked />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="Layer Status" accent={DASH_C.green} height={190}>
          <DonutChart data={LAYER_STATUS_LBL.map((n, i) => ({ name: n, value: LAYER_STATUS[i], color: LAYER_STATUS_COLORS[i] }))} />
        </ChartBox>
        <ChartBox title="Imagery Coverage %" subtitle="network <2yr, target 80%" accent={DASH_C.cyan} height={190}>
          <GaugeC value={71} target={80} color={DASH_C.cyan} />
        </ChartBox>
        <ChartBox title="QA Pass Rate" subtitle="geoprocessing pipeline, target 90%" accent={DASH_C.teal} height={190}>
          <GaugeC value={88} target={90} color={DASH_C.teal} />
        </ChartBox>
        <ChartBox title="Layer Category Mix" accent={DASH_C.blue} height={190}>
          <PieChartTile data={LAYER_CAT_LBL.map((n, i) => ({ name: n, value: LAYER_CAT_COUNT[i], color: LAYER_CAT_COLORS[i] }))} colors={LAYER_CAT_COLORS} />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.cyan}>Aerial Imagery · Freshness & Resolution</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="Imagery Coverage by Region" subtitle="% network with high-res <2yr" accent={DASH_C.cyan} height={220}>
          <BarH data={REG_LBL.map((r, i) => ({ region: r, pct: IMG_COVERAGE_PCT[i] }))} yKey="region" unit="%"
            series={[{ key: 'pct', name: 'Coverage %', color: DASH_C.cyan }]} />
        </ChartBox>
        <ChartBox title="Imagery Capture Recency" subtitle="% of network area" accent={DASH_C.green} height={220}>
          <BarV data={IMG_AGE_LBL.map((n, i) => ({ name: n, pct: IMG_AGE_PCT[i] }))} xKey="name" unit="%"
            series={[{ key: 'pct', name: '% area', color: DASH_C.green }]} />
        </ChartBox>
        <ChartBox title="Resolution vs Age" subtitle="tile resolution (cm/px) vs capture age (mo)" accent={DASH_C.orange} height={220}>
          <ScatterBubble data={RES_VS_AGE} xLabel="Age (months)" yLabel="Resolution (cm/px)" color={DASH_C.orange} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Imagery Coverage" subtitle="treemap, regional km² share (illustrative)" accent={DASH_C.purple} height={200}>
          <TreemapC data={REG_LBL.map((r, i) => ({ name: r, size: IMG_COVERAGE_PCT[i] * 10 }))} colors={REGION_COLORS} />
        </ChartBox>
        <ChartBox title="Imagery Recency Mix" accent={DASH_C.teal} height={200}>
          <DonutChart data={IMG_AGE_LBL.map((n, i) => ({ name: n, value: IMG_AGE_PCT[i] }))} colors={QUALITY_SCALE} innerRadius={38} />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.yellow}>Data Quality, Completeness & Freshness</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="Completeness Score by Layer" subtitle="0-100, canonical quality scale" accent={DASH_C.yellow} height={230}>
          <BarH data={COMPLETENESS_LAYERS.map((n, i) => ({
            layer: n, score: COMPLETENESS_SCORE[i],
            color: COMPLETENESS_SCORE[i] >= 90 ? QUALITY_SCALE[0] : COMPLETENESS_SCORE[i] >= 80 ? QUALITY_SCALE[1] : COMPLETENESS_SCORE[i] >= 70 ? QUALITY_SCALE[2] : COMPLETENESS_SCORE[i] >= 60 ? QUALITY_SCALE[3] : QUALITY_SCALE[4],
          }))} yKey="layer" unit="" series={[{ key: 'score', name: 'Completeness', color: DASH_C.yellow }]} />
        </ChartBox>
        <ChartBox title="Data Quality Issues by Severity" accent={DASH_C.orange} height={230}>
          <BarV data={QUALITY_ISSUE_LBL.map((n, i) => ({ name: n, count: QUALITY_ISSUE_COUNT[i], color: QUALITY_SCALE[i] }))} xKey="name"
            series={[{ key: 'count', name: 'Issues', color: DASH_C.orange }]} />
        </ChartBox>
        <ChartBox title="Data Freshness" subtitle="days since last update, by category" accent={DASH_C.red} height={230}>
          <BoxPlotApprox data={[
            boxStats(FRESH_ROADS, QUALITY_SCALE[0], 'Roads'),
            boxStats(FRESH_ADMIN, QUALITY_SCALE[2], 'Admin'),
            boxStats(FRESH_IMAGERY, QUALITY_SCALE[4], 'Imagery'),
          ]} unit="d" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Quality Issue Severity Mix" accent={DASH_C.pink} height={200}>
          <PieChartTile data={QUALITY_ISSUE_LBL.map((n, i) => ({ name: n, value: QUALITY_ISSUE_COUNT[i], color: QUALITY_SCALE[i] }))} colors={QUALITY_SCALE} />
        </ChartBox>
        <ChartBox title="Geoprocessing QA Pipeline" subtitle="layers ingested → published" accent={DASH_C.blue} height={200}>
          <FunnelC data={PIPELINE} colors={[DASH_C.purple, DASH_C.blue, DASH_C.cyan, DASH_C.teal, DASH_C.green]} />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.orange}>Geoprocessing, Storage & Feature Volume</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="Geoprocessing Job Volume" subtitle="monthly, completed vs failed" accent={DASH_C.orange} height={220}>
          <LineMulti data={JOB_MONTHS.map((m, i) => ({ month: m, Completed: JOB_COMPLETED[i], Failed: JOB_FAILED[i] }))} xKey="month"
            series={[{ key: 'Completed', name: 'Completed', color: DASH_C.green }, { key: 'Failed', name: 'Failed', color: DASH_C.red }]} area />
        </ChartBox>
        <ChartBox title="Storage Volume by Layer Type" subtitle="GB" accent={DASH_C.blue} height={220}>
          <TreemapC data={STORAGE_LBL.map((n, i) => ({ name: n, size: STORAGE_GB[i] }))} colors={STORAGE_COLORS} />
        </ChartBox>
        <ChartBox title="Feature Count by Layer" accent={DASH_C.teal} height={220}>
          <BarH data={FEATURE_LAYERS.map((n, i) => ({ layer: n, count: FEATURE_COUNT[i] }))} yKey="layer"
            series={[{ key: 'count', name: 'Features', color: DASH_C.teal }]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Storage Composition" accent={DASH_C.orange} height={200}>
          <DonutChart data={STORAGE_LBL.map((n, i) => ({ name: n, value: STORAGE_GB[i], color: STORAGE_COLORS[i] }))} innerRadius={38} />
        </ChartBox>
        <ChartBox title="CRS / Projection Usage" accent={DASH_C.purple} height={200}>
          <PieChartTile data={CRS_LBL.map((n, i) => ({ name: n, value: CRS_COUNT[i] }))} colors={REGION_COLORS} />
        </ChartBox>
        <ChartBox title="Storage vs Layer Count" subtitle="quality balance by category" accent={DASH_C.green} height={200}>
          <RadarTile
            data={LAYER_CAT_LBL.map((c, i) => ({ axis: c, layerShare: Math.round(LAYER_CAT_COUNT[i] / TOTAL_LAYERS * 100), publishedShare: Math.round(CAT_STATUS_MATRIX[i][0] / LAYER_CAT_COUNT[i] * 100) }))}
            series={[{ key: 'layerShare', name: 'Layer Share %', color: DASH_C.green }, { key: 'publishedShare', name: 'Published %', color: DASH_C.cyan }]}
          />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.blue}>Service Usage · API Access & Adoption</SectionHdr>

      <ChartGrid cols="12">
        <ChartBox title="WMS / WFS Request Volume" subtitle="weekly, thousands of requests" accent={DASH_C.blue} height={230}>
          <LineMulti data={API_WEEKS.map((w, i) => ({ week: w, WMS: API_WMS[i], WFS: API_WFS[i] }))} xKey="week"
            series={[{ key: 'WMS', name: 'WMS requests (k)', color: DASH_C.blue }, { key: 'WFS', name: 'WFS requests (k)', color: DASH_C.pink }]} />
        </ChartBox>
        <ChartBox title="Top-Used Layers" subtitle="API requests, last 30 days (k)" accent={DASH_C.cyan} height={230}>
          <BarH data={TOP_LAYERS_LBL.map((n, i) => ({ layer: n, req: TOP_LAYERS_REQ[i] }))} yKey="layer"
            series={[{ key: 'req', name: 'Requests (k)', color: DASH_C.cyan }]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Access by Client Type" accent={DASH_C.yellow} height={200}>
          <BarV data={CLIENT_LBL.map((n, i) => ({ name: n, users: CLIENT_COUNT[i] }))} xKey="name"
            series={[{ key: 'users', name: 'Active Users', color: DASH_C.yellow }]} />
        </ChartBox>
        <ChartBox title="Platform Growth" subtitle="waterfall: catalogue build-up (layers)" accent={DASH_C.purple} height={200}>
          <WaterfallC steps={[
            { name: 'Roads', delta: LAYER_CAT_COUNT[0], isTotal: true },
            { name: '+Structures', delta: LAYER_CAT_COUNT[1] },
            { name: '+Admin', delta: LAYER_CAT_COUNT[2] },
            { name: '+Imagery', delta: LAYER_CAT_COUNT[3] },
            { name: '+Hydrology', delta: LAYER_CAT_COUNT[4] },
            { name: '+Land Use', delta: LAYER_CAT_COUNT[5] },
            { name: '=Total Catalogue', delta: TOTAL_LAYERS, isTotal: true },
          ]} unit="" />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
