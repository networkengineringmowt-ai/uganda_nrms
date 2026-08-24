/**
 * DownloadsOverviewDashboard — RMS "Dashboard" tab, Downloads & Bulk Data
 * Exports view (sectionId 'downloads'). Covers the platform's open-data /
 * bulk-export facility — structures, road network, traffic, condition-survey
 * and reserve datasets served as CSV, KML, GeoJSON and Shapefile downloads —
 * as illustrated in src/modules/Downloads/DownloadsView.tsx and built by
 * src/utils/downloads.ts.
 *
 * Anchored to already-canonical platform figures so this view stays
 * consistent with the rest of the app:
 *  - 546 structures (312 bridges, 142 box culverts, 68 culverts,
 *    24 drifts/causeways) — the same population behind structures_all.geojson.
 *  - 21,302 km classified road network (6 regions: Central, Northern,
 *    Eastern, Western, Southern, North Eastern).
 *  - Real per-file sizes already quoted in DownloadsView.tsx are reused here
 *    as the "Structures" dataset's per-format footprint: ~683 KB (static
 *    GeoJSON), ~186 KB (CSV), ~68 KB (Shapefile ZIP).
 * Everything else (monthly volumes, requester mix, freshness, success rate)
 * is an illustrative-but-internally-consistent data model — every breakdown
 * below sums back to the same 18,460-export YTD total.
 */
import {
  DASH_C, REGION_COLORS, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  DonutChart, PieChartTile, BarV, BarH, LineMulti, ScatterBubble, HeatGrid, TreemapC,
  GaugeC, FunnelC, RadarTile, BoxPlotApprox, WaterfallC,
} from '../../../shared/dashboardKit';

// ─── Canonical 5-stop risk/severity scale (good → bad) — for ordered dims only ─
const RISK5 = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];
function freshColor(days: number): string {
  if (days <= 3) return RISK5[0];
  if (days <= 10) return RISK5[1];
  if (days <= 20) return RISK5[2];
  if (days <= 35) return RISK5[3];
  return RISK5[4];
}

// ─── Data model ───────────────────────────────────────────────────────────────
const TOTAL_EXPORTS = 18460; // YTD Jan–Aug 2026, sum of every breakdown below

const DATASETS = ['Structures', 'Road Network', 'Traffic Counts', 'Condition Survey', 'Reserves'];
const DATASET_COUNTS = [6870, 5240, 2860, 2380, 1110]; // sums to TOTAL_EXPORTS
const DATASET_COLORS = [DASH_C.cyan, DASH_C.green, DASH_C.orange, DASH_C.yellow, DASH_C.purple];
const AVG_SIZE_KB = [683, 4200, 1450, 980, 310]; // Structures matches the real static GeoJSON (~683 KB)
const FRESHNESS_DAYS = [2, 6, 21, 14, 45]; // days since dataset last regenerated — Structures freshest, Reserves stalest

const FORMATS = ['CSV', 'KML', 'GeoJSON', 'Shapefile'];
const FORMAT_COUNTS = [9040, 2950, 5320, 1150]; // sums to TOTAL_EXPORTS
const FORMAT_COLORS = [DASH_C.yellow, DASH_C.green, DASH_C.cyan, DASH_C.purple]; // matches DownloadsView.tsx badge colours

// dataset × format matrix — every row sums to DATASET_COUNTS, every column sums to FORMAT_COUNTS
const DATASET_FORMAT_MATRIX = [
  [2600, 1450, 2400, 420],  // Structures
  [2900, 380, 1720, 240],   // Road Network
  [1800, 260, 700, 100],    // Traffic Counts
  [1500, 220, 480, 180],    // Condition Survey
  [240, 640, 20, 210],      // Reserves
];

const REQUESTER_TYPES = ['Government', 'Contractor', 'Researcher', 'Public'];
const REQUESTER_COUNTS = [7930, 5030, 3560, 1940]; // sums to TOTAL_EXPORTS
const REQUESTER_SHARE = REQUESTER_COUNTS.map(c => c / TOTAL_EXPORTS);
const REQUESTER_COLORS = [DASH_C.blue, DASH_C.orange, DASH_C.teal, DASH_C.pink];

const REG_LBL = ['Central', 'Northern', 'Eastern', 'Western', 'Southern', 'North Eastern'];
const REGION_DOWNLOADS = [3843, 3397, 3712, 2603, 2861, 2044]; // sums to TOTAL_EXPORTS

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
const MONTHLY_DOWNLOADS = [1780, 1920, 2050, 2240, 2410, 2530, 2600, 2930]; // sums to TOTAL_EXPORTS
const API_PCT_TREND = [52, 55, 58, 60, 63, 65, 68, 70]; // rising API adoption, Jan–Aug 2026
const API_SHARE_PCT = 62; // headline API-vs-manual split

const TOP_FILES = [
  { name: 'structures_all.geojson', count: 3120 },
  { name: 'road_network_classified.csv', count: 2870 },
  { name: 'condition_survey_2026.csv', count: 1930 },
  { name: 'traffic_counts_aadt.geojson', count: 1640 },
  { name: 'structures_bridges.zip', count: 1210 },
  { name: 'reserve_boundaries.shp.zip', count: 640 },
];

// download outcomes — ordered best → worst, sums to TOTAL_EXPORTS, coloured with the canonical 5-stop scale
const OUTCOME_DEFS = [
  { key: 'success1', label: 'Success (first try)', value: 16850, color: RISK5[0] },
  { key: 'success2', label: 'Success (after retry)', value: 1120, color: RISK5[1] },
  { key: 'timeout', label: 'Failed — timeout', value: 310, color: RISK5[2] },
  { key: 'formatErr', label: 'Failed — format error', value: 120, color: RISK5[3] },
  { key: 'serverErr', label: 'Failed — server error', value: 60, color: RISK5[4] },
];
const OUTCOME_SUCCESS = OUTCOME_DEFS[0].value + OUTCOME_DEFS[1].value;
const OUTCOME_ROW = [Object.fromEntries([
  ['cat', 'YTD Exports'],
  ...OUTCOME_DEFS.map(o => [o.key, o.value]),
])];
const OUTCOME_SERIES = OUTCOME_DEFS.map(o => ({ key: o.key, name: o.label, color: o.color }));

// per-format file-size spread across the 5 datasets (KB) — Structures figures match DownloadsView.tsx real sizes
const CSV_SIZES = [120, 186, 980, 1450, 4200];
const KML_SIZES = [260, 310, 410, 540, 1800];
const GEOJSON_SIZES = [90, 560, 683, 1200, 3900];
const SHP_SIZES = [68, 150, 340, 410, 2100];

function quartiles(vals: number[], name: string, color: string) {
  const s = [...vals].sort((a, b) => a - b);
  const q = (p: number) => {
    const idx = p * (s.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
  };
  return { name, min: s[0], q1: q(0.25), median: q(0.5), q3: q(0.75), max: s[s.length - 1], color };
}

const REQUESTER_PROFILE = [
  { axis: 'Government', volumeShare: 43, successRate: 98, apiAdoption: 74 },
  { axis: 'Contractor', volumeShare: 27, successRate: 97, apiAdoption: 58 },
  { axis: 'Researcher', volumeShare: 19, successRate: 96, apiAdoption: 81 },
  { axis: 'Public', volumeShare: 11, successRate: 95, apiAdoption: 22 },
];

const DATASET_SCATTER = DATASETS.map((name, i) => ({
  x: AVG_SIZE_KB[i], y: DATASET_COUNTS[i], z: FRESHNESS_DAYS[i], label: name,
}));

const FRESH_ROW = [Object.fromEntries([
  ['cat', 'Days Since Regeneration'],
  ...DATASETS.map((n, i) => [n, FRESHNESS_DAYS[i]]),
])];
const FRESH_SERIES = DATASETS.map((n, i) => ({ key: n, name: n, color: freshColor(FRESHNESS_DAYS[i]) }));

export default function DownloadsOverviewDashboard() {
  const successPct = (OUTCOME_SUCCESS / TOTAL_EXPORTS * 100).toFixed(1);
  const topDatasetIdx = DATASET_COUNTS.indexOf(Math.max(...DATASET_COUNTS));
  const topFormatIdx = FORMAT_COUNTS.indexOf(Math.max(...FORMAT_COUNTS));
  const freshestIdx = FRESHNESS_DAYS.indexOf(Math.min(...FRESHNESS_DAYS));

  return (
    <div>
      <KpiStrip>
        <StatMini value={TOTAL_EXPORTS.toLocaleString()} label="Exports Served (YTD)" color={DASH_C.gray} />
        <StatMini value={DATASETS[topDatasetIdx]} label={`Top Dataset · ${Math.round(DATASET_COUNTS[topDatasetIdx] / TOTAL_EXPORTS * 100)}%`} color={DASH_C.cyan} />
        <StatMini value={`${API_SHARE_PCT}%`} label="Served via API" color={DASH_C.blue} />
        <StatMini value={`${successPct}%`} label="Download Success Rate" color={DASH_C.green} />
        <StatMini value={`${FRESHNESS_DAYS[freshestIdx]}d`} label={`Freshest · ${DATASETS[freshestIdx]}`} color="#22c55e" />
        <StatMini value={FORMATS[topFormatIdx]} label={`Top Format · ${Math.round(FORMAT_COUNTS[topFormatIdx] / TOTAL_EXPORTS * 100)}%`} color={DASH_C.yellow} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.gray}>Downloads & Bulk Data Exports · 22 Views</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="Downloads by Dataset" subtitle={`${TOTAL_EXPORTS.toLocaleString()} total`} accent={DASH_C.gray} height={210}>
          <DonutChart data={DATASETS.map((n, i) => ({ name: n, value: DATASET_COUNTS[i], color: DATASET_COLORS[i] }))} />
        </ChartBox>
        <ChartBox title="Downloads by Format" accent={DASH_C.cyan} height={210}>
          <PieChartTile data={FORMATS.map((n, i) => ({ name: n, value: FORMAT_COUNTS[i], color: FORMAT_COLORS[i] }))} />
        </ChartBox>
        <ChartBox title="Downloads by Requester Type" accent={DASH_C.blue} height={210}>
          <BarH data={REQUESTER_TYPES.map((n, i) => ({ name: n, downloads: REQUESTER_COUNTS[i] }))} yKey="name"
            series={[{ key: 'downloads', name: 'Downloads', color: DASH_C.blue }]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="12">
        <ChartBox title="Download Volume Trend" subtitle="monthly, Jan–Aug 2026" accent={DASH_C.green} height={260}>
          <LineMulti data={MONTHS.map((m, i) => ({ month: m, Downloads: MONTHLY_DOWNLOADS[i] }))} xKey="month"
            series={[{ key: 'Downloads', name: 'Downloads', color: DASH_C.green }]} area />
        </ChartBox>
        <ChartBox title="Dataset × Format" subtitle="downloads matrix" accent={DASH_C.purple} height={260}>
          <HeatGrid matrix={DATASET_FORMAT_MATRIX} xLabels={FORMATS} yLabels={DATASETS} accent={DASH_C.purple} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="API Adoption" subtitle="target 75% by FY27" accent={DASH_C.cyan} height={190}>
          <GaugeC value={API_SHARE_PCT} target={75} color={DASH_C.cyan} label="of exports via API" />
        </ChartBox>
        <ChartBox title="Download Success Rate" subtitle="target 99%" accent={DASH_C.green} height={190}>
          <GaugeC value={Math.round(Number(successPct))} target={99} color={DASH_C.green} />
        </ChartBox>
        <ChartBox title="Export Freshness Index" subtitle="weighted regen currency" accent={DASH_C.yellow} height={190}>
          <GaugeC value={78} target={90} color={DASH_C.yellow} suffix="" />
        </ChartBox>
        <ChartBox title="Shapefile Adoption" subtitle="share of GIS shapefile exports" accent={DASH_C.purple} height={190}>
          <GaugeC value={Math.round(FORMAT_COUNTS[3] / TOTAL_EXPORTS * 100)} target={15} color={DASH_C.purple} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Most Downloaded Files" subtitle="top 6, YTD" accent={DASH_C.teal} height={230}>
          <BarH data={TOP_FILES.map(f => ({ name: f.name, count: f.count }))} yKey="name"
            series={[{ key: 'count', name: 'Downloads', color: DASH_C.teal }]} />
        </ChartBox>
        <ChartBox title="Avg Export File Size by Dataset" subtitle="KB" accent={DASH_C.orange} height={230}>
          <BarV data={DATASETS.map((n, i) => ({ name: n.split(' ')[0], kb: AVG_SIZE_KB[i] }))} xKey="name"
            series={[{ key: 'kb', name: 'Avg size', color: DASH_C.orange }]} unit="KB" />
        </ChartBox>
        <ChartBox title="Data Freshness by Dataset" subtitle="days since last regeneration" accent={DASH_C.gray} height={230}>
          <BarH data={FRESH_ROW} yKey="cat" series={FRESH_SERIES} unit="d" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Export Request Pipeline" accent={DASH_C.cyan} height={210}>
          <FunnelC data={[
            { name: 'Export Requested', value: 18980 }, { name: 'File Generated', value: 18760 },
            { name: 'Delivered to User', value: 18620 }, { name: 'Download Completed', value: TOTAL_EXPORTS },
            { name: 'Verified / No Re-request', value: OUTCOME_SUCCESS },
          ]} colors={[DASH_C.cyan, '#00ccdd', '#00aacc', DASH_C.green, DASH_C.yellow]} />
        </ChartBox>
        <ChartBox title="Requester Volume Trend" subtitle="monthly, by type" accent={DASH_C.pink} height={210}>
          <LineMulti data={MONTHS.map((m, i) => {
            const tot = MONTHLY_DOWNLOADS[i];
            return {
              month: m,
              Government: Math.round(tot * REQUESTER_SHARE[0]), Contractor: Math.round(tot * REQUESTER_SHARE[1]),
              Researcher: Math.round(tot * REQUESTER_SHARE[2]), Public: Math.round(tot * REQUESTER_SHARE[3]),
            };
          })} xKey="month" series={[
            { key: 'Government', name: 'Government', color: REQUESTER_COLORS[0] }, { key: 'Contractor', name: 'Contractor', color: REQUESTER_COLORS[1] },
            { key: 'Researcher', name: 'Researcher', color: REQUESTER_COLORS[2] }, { key: 'Public', name: 'Public', color: REQUESTER_COLORS[3] },
          ]} />
        </ChartBox>
        <ChartBox title="Downloads by Region" subtitle="treemap, sized by count" accent={DASH_C.purple} height={210}>
          <TreemapC data={REG_LBL.map((r, i) => ({ name: r, size: REGION_DOWNLOADS[i] }))} colors={REGION_COLORS} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Download Outcomes" subtitle="success vs failure breakdown, YTD" accent={DASH_C.gray} height={220}>
          <BarH data={OUTCOME_ROW} yKey="cat" series={OUTCOME_SERIES} />
        </ChartBox>
        <ChartBox title="Format Popularity Over Time" subtitle="monthly, stacked" accent={DASH_C.cyan} height={220}>
          <BarV data={MONTHS.map((m, i) => {
            const tot = MONTHLY_DOWNLOADS[i];
            return {
              month: m, CSV: Math.round(tot * 0.49), KML: Math.round(tot * 0.16),
              GeoJSON: Math.round(tot * 0.29), Shapefile: Math.round(tot * 0.06),
            };
          })} xKey="month" series={[
            { key: 'CSV', name: 'CSV', color: FORMAT_COLORS[0] }, { key: 'KML', name: 'KML', color: FORMAT_COLORS[1] },
            { key: 'GeoJSON', name: 'GeoJSON', color: FORMAT_COLORS[2] }, { key: 'Shapefile', name: 'Shapefile', color: FORMAT_COLORS[3] },
          ]} stacked />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="API vs Manual Downloads" subtitle="monthly trend" accent={DASH_C.blue} height={210}>
          <LineMulti data={MONTHS.map((m, i) => {
            const api = Math.round(MONTHLY_DOWNLOADS[i] * API_PCT_TREND[i] / 100);
            return { month: m, API: api, Manual: MONTHLY_DOWNLOADS[i] - api };
          })} xKey="month" series={[{ key: 'API', name: 'API', color: DASH_C.blue }, { key: 'Manual', name: 'Manual', color: DASH_C.gray }]} area />
        </ChartBox>
        <ChartBox title="Export File Size Distribution by Format" subtitle="KB" accent={DASH_C.orange} height={210}>
          <BoxPlotApprox data={[
            quartiles(CSV_SIZES, 'CSV', FORMAT_COLORS[0]), quartiles(KML_SIZES, 'KML', FORMAT_COLORS[1]),
            quartiles(GEOJSON_SIZES, 'GeoJSON', FORMAT_COLORS[2]), quartiles(SHP_SIZES, 'Shapefile', FORMAT_COLORS[3]),
          ]} unit="KB" />
        </ChartBox>
        <ChartBox title="Export Volume Breakdown" subtitle="waterfall, downloads" accent={DASH_C.pink} height={210}>
          <WaterfallC steps={[
            { name: 'Total', delta: TOTAL_EXPORTS, isTotal: true }, { name: '−Reserves', delta: -DATASET_COUNTS[4] },
            { name: '−Condition', delta: -DATASET_COUNTS[3] }, { name: '−Traffic', delta: -DATASET_COUNTS[2] },
            { name: '=Struct.+Network', delta: DATASET_COUNTS[0] + DATASET_COUNTS[1], isTotal: true },
            { name: '−Road Network', delta: -DATASET_COUNTS[1] }, { name: '=Structures', delta: DATASET_COUNTS[0], isTotal: true },
          ]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Requester Profile" subtitle="volume share vs reliability vs API use" accent={DASH_C.teal} height={210}>
          <RadarTile data={REQUESTER_PROFILE} maxValue={100} series={[
            { key: 'volumeShare', name: 'Volume Share %', color: DASH_C.blue }, { key: 'successRate', name: 'Success Rate %', color: DASH_C.green },
            { key: 'apiAdoption', name: 'API Adoption %', color: DASH_C.cyan },
          ]} />
        </ChartBox>
        <ChartBox title="File Size vs Download Volume" subtitle="by dataset — size=days since regen" accent={DASH_C.purple} height={210}>
          <ScatterBubble data={DATASET_SCATTER} xLabel="Avg File Size (KB)" yLabel="Downloads (YTD)" color={DASH_C.purple} />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
