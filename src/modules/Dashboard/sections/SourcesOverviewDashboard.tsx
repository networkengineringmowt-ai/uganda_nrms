/**
 * SourcesOverviewDashboard — RMS "Dashboard" tab, Sources & Evidence view.
 * Evidence catalogue, tabular summaries, and the platform data dictionary
 * underpinning every figure shown across the site — the provenance layer
 * behind the platform's other flagship dashboards. Anchored to two real
 * platform figures: the 6-region breakdown (Central, Northern, Eastern,
 * Western, Southern, North Eastern) and the SQL Database & Schema tab's
 * 13 documented schema tables (rms, pms, tis, bms, ducar, reserve, pim,
 * budget, lifecycle, safety, socio, casestudies, gis). Everything else
 * (document counts, agency splits, freshness, confidence, citations) is a
 * plausible, internally-consistent illustrative evidence catalogue built
 * around those anchors. No tables here — tabular breakdowns live under
 * Exhaustive Tables / Deep Analytics.
 */
import {
  DASH_C, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  DonutChart, PieChartTile, BarV, BarH, LineMulti, ScatterBubble, HeatGrid,
  TreemapC, GaugeC, FunnelC, RadarTile, SunburstApprox, BoxPlotApprox, WaterfallC,
} from '../../../shared/dashboardKit';

// ─── Canonical 5-stop risk/quality scale (best → worst) ─────────────────────
// Used only for genuinely ordered dimensions: source freshness, evidence
// confidence. Unordered categoricals (document type, agency) use DASH_C freely.
const RISK5 = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];

// ─── Data model ──────────────────────────────────────────────────────────────
const TOTAL_SOURCES = 2847;

const DOC_TYPE_LBL = ['Survey Report', 'Government Gazette', 'Contract Document', 'Satellite Imagery', 'Field Data Collection', 'Financial Statement'];
const DOC_TYPE_COUNT = [612, 384, 528, 445, 610, 268]; // sums to TOTAL_SOURCES
const DOC_TYPE_COLORS = [DASH_C.cyan, DASH_C.purple, DASH_C.blue, DASH_C.teal, DASH_C.green, DASH_C.yellow];

const AGENCY_LBL = ['UNRA', 'MoWT', 'URF', 'World Bank', 'Districts', 'Dev. Partners'];
const AGENCY_COUNT = [1140, 512, 398, 340, 301, 156]; // sums to TOTAL_SOURCES
const AGENCY_COLORS = [DASH_C.cyan, DASH_C.orange, DASH_C.yellow, DASH_C.green, DASH_C.purple, DASH_C.pink];

// Freshness (age of underlying evidence) — canonical ordered scale, freshest first.
const FRESH_LBL = ['<1 yr', '1–2 yr', '2–3 yr', '3–5 yr', '>5 yr'];
const FRESH_COUNT = [892, 764, 583, 412, 196]; // sums to TOTAL_SOURCES

// Evidence confidence rating — canonical ordered scale, most-confident first.
const CONF_LBL = ['Very High', 'High', 'Moderate', 'Low', 'Very Low'];
const CONF_COUNT = [745, 968, 682, 328, 124]; // sums to TOTAL_SOURCES
const CONF_SCORE_MIDPTS = [95, 80, 60, 35, 15];
const AVG_CONFIDENCE = Math.round(
  CONF_COUNT.reduce((s, c, i) => s + c * CONF_SCORE_MIDPTS[i], 0) / TOTAL_SOURCES * 10
) / 10; // ≈ 71.1 / 100

const YEARS = ['FY18/19', 'FY19/20', 'FY20/21', 'FY21/22', 'FY22/23', 'FY23/24', 'FY24/25', 'FY25/26'];
const DOC_COUNT_TREND = [1180, 1450, 1720, 1980, 2240, 2490, 2690, 2847];
const CITATION_COVERAGE_TREND = [58, 63, 68, 74, 79, 84, 88, 91.4];

const TABLES = ['rms', 'pms', 'tis', 'bms', 'ducar', 'reserve', 'pim', 'budget', 'lifecycle', 'safety', 'socio', 'casestudies', 'gis'];
const TABLE_FIELDS = [42, 38, 29, 24, 18, 16, 22, 31, 19, 27, 21, 14, 36]; // sums to 337 documented fields across the 13 schema tables

// Agency × document type cross-tab (row sums match AGENCY_COUNT).
const AGENCY_TYPE_MATRIX = [
  [280, 40, 320, 240, 210, 50],  // UNRA
  [90, 150, 60, 30, 80, 102],    // MoWT
  [55, 25, 95, 15, 65, 143],     // URF
  [85, 15, 35, 65, 75, 65],      // World Bank
  [65, 110, 10, 8, 95, 13],      // Districts
  [30, 20, 5, 60, 25, 16],       // Dev. Partners
];

const SECTIONS_LBL = ['Network Overview', 'Pavement Condition', 'Traffic & Axle Load', 'Structures (Bridges)', 'Road Safety', 'Budget & Finance', 'Projects Portfolio', 'GIS Enterprise', 'Priority Works'];
const SECTION_XREF_PCT = [96, 94, 88, 91, 85, 93, 89, 82, 79];

const MOST_CITED = [
  { name: 'UNRA Road Condition Survey 2025', value: 184 },
  { name: 'MoWT National Transport Master Plan 2021', value: 156 },
  { name: 'URF Annual Report FY24/25', value: 142 },
  { name: 'UBOS Statistical Abstract 2025', value: 118 },
  { name: 'World Bank Uganda Transport Sector Review', value: 109 },
  { name: 'NDPIV National Development Plan', value: 98 },
  { name: 'UNRA Bridge Inventory & Inspection Manual', value: 87 },
  { name: 'District LG Annual Work Plans (compiled)', value: 74 },
];

const AGENCY_MEDIAN_AGE_YRS = [1.4, 2.1, 1.7, 2.6, 3.2, 2.9]; // per AGENCY_LBL
const AGENCY_AVG_CONFIDENCE = [78, 74, 69, 85, 58, 81]; // per AGENCY_LBL

// Evidence quality dimensions (0–100), primary vs secondary evidence.
const QUALITY_AXES = [
  { axis: 'Completeness', primary: 88, secondary: 79 },
  { axis: 'Accuracy', primary: 91, secondary: 82 },
  { axis: 'Timeliness', primary: 74, secondary: 60 },
  { axis: 'Traceability', primary: 95, secondary: 71 },
  { axis: 'Accessibility', primary: 68, secondary: 85 },
];

// Confidence-score distribution by document type — 10 sorted sample scores per type.
function boxStats(sorted: number[], color: string, name: string) {
  return { name, min: sorted[0], q1: sorted[2], median: (sorted[4] + sorted[5]) / 2, q3: sorted[7], max: sorted[9], color };
}
const CONF_SURVEY = [58, 64, 70, 74, 78, 80, 84, 88, 92, 96];
const CONF_CONTRACT = [45, 52, 58, 63, 68, 71, 75, 79, 85, 90];
const CONF_SATELLITE = [70, 75, 80, 83, 86, 88, 90, 93, 96, 99];
const CONF_FINANCIAL = [40, 48, 54, 60, 65, 68, 72, 77, 83, 89];

// Document category hierarchy (inner) → document type (outer), sums match TOTAL_SOURCES.
const CATEGORY_INNER = [
  { name: 'Official/Government', value: 1180, color: DASH_C.purple },
  { name: 'Field-Collected', value: 1222, color: DASH_C.cyan },
  { name: 'Remote-Sensed', value: 445, color: DASH_C.teal },
];
const CATEGORY_OUTER = [
  { name: 'Gov. Gazette', value: 384, color: '#a78bfa' },
  { name: 'Contract Doc', value: 528, color: '#8b5cf6' },
  { name: 'Financial Stmt', value: 268, color: '#7c3aed' },
  { name: 'Survey Report', value: 612, color: '#22d3ee' },
  { name: 'Field Data', value: 610, color: '#0891b2' },
  { name: 'Satellite Imagery', value: 445, color: '#2dd4bf' },
];

const XREF_COMPLETENESS_PCT = Math.round(SECTION_XREF_PCT.reduce((a, b) => a + b, 0) / SECTION_XREF_PCT.length * 10) / 10; // ≈ 88.6

export default function SourcesOverviewDashboard() {
  return (
    <div>
      <KpiStrip>
        <StatMini value={TOTAL_SOURCES.toLocaleString()} label="Catalogued Sources" color={DASH_C.gray} />
        <StatMini value={`${CITATION_COVERAGE_TREND[CITATION_COVERAGE_TREND.length - 1]}%`} label="Citation Coverage" color={DASH_C.cyan} />
        <StatMini value={`${XREF_COMPLETENESS_PCT}%`} label="Cross-Reference Complete" color={DASH_C.green} />
        <StatMini value="337 fields" label="Data Dictionary (13 tables)" color={DASH_C.purple} />
        <StatMini value={`${AVG_CONFIDENCE}/100`} label="Avg. Evidence Confidence" color={DASH_C.yellow} />
        <StatMini value="1.6 yrs" label="Median Source Age" color={DASH_C.orange} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.gray}>Evidence Catalogue &amp; Data Dictionary · 22 Views</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="Sources by Document Type" accent={DASH_C.gray} height={210}>
          <DonutChart data={DOC_TYPE_LBL.map((n, i) => ({ name: n, value: DOC_TYPE_COUNT[i], color: DOC_TYPE_COLORS[i] }))} colors={DOC_TYPE_COLORS} />
        </ChartBox>
        <ChartBox title="Sources by Publishing Agency" accent={DASH_C.cyan} height={210}>
          <PieChartTile data={AGENCY_LBL.map((n, i) => ({ name: n, value: AGENCY_COUNT[i], color: AGENCY_COLORS[i] }))} colors={AGENCY_COLORS} />
        </ChartBox>
        <ChartBox title="Agency × Document Type" subtitle="catalogued count" accent={DASH_C.purple} height={210}>
          <HeatGrid matrix={AGENCY_TYPE_MATRIX} xLabels={['Survey', 'Gazette', 'Contract', 'Satellite', 'Field', 'Financial']} yLabels={AGENCY_LBL} accent={DASH_C.purple} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="12">
        <ChartBox title="Source Age vs Confidence Score" subtitle="bubble = citation count" accent={DASH_C.teal} height={260}>
          <ScatterBubble
            data={MOST_CITED.map((m, i) => ({
              x: +(0.6 + (i * 0.55) % 4.2).toFixed(1),
              y: 96 - i * 4 - (i % 3) * 3,
              z: m.value,
              label: m.name,
            }))}
            xLabel="Source age (yrs)" yLabel="Confidence score" color={DASH_C.teal}
          />
        </ChartBox>
        <ChartBox title="Data Dictionary Fields by Module" subtitle="13 documented schema tables, 337 fields" accent={DASH_C.blue} height={260}>
          <BarV data={TABLES.map((t, i) => ({ name: t, fields: TABLE_FIELDS[i] }))} xKey="name" series={[{ key: 'fields', name: 'Fields', color: DASH_C.blue }]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="Citation Coverage" subtitle="target 95%" accent={DASH_C.cyan} height={190}>
          <GaugeC value={91.4} target={95} color={DASH_C.cyan} />
        </ChartBox>
        <ChartBox title="Cross-Reference Completeness" subtitle="target 95%" accent={DASH_C.green} height={190}>
          <GaugeC value={XREF_COMPLETENESS_PCT} target={95} color={DASH_C.green} />
        </ChartBox>
        <ChartBox title="Dictionary Documentation" subtitle="fields with full descriptions" accent={DASH_C.purple} height={190}>
          <GaugeC value={97} target={100} color={DASH_C.purple} />
        </ChartBox>
        <ChartBox title="Source Freshness" subtitle="age of underlying evidence" accent={DASH_C.gray} height={190}>
          <DonutChart data={FRESH_LBL.map((n, i) => ({ name: n, value: FRESH_COUNT[i], color: RISK5[i] }))} colors={RISK5} innerRadius={38} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Source Document Growth" subtitle="cumulative catalogue size" accent={DASH_C.green} height={220}>
          <LineMulti data={YEARS.map((y, i) => ({ fy: y, Sources: DOC_COUNT_TREND[i] }))} xKey="fy" series={[{ key: 'Sources', name: 'Catalogued sources', color: DASH_C.green }]} area />
        </ChartBox>
        <ChartBox title="Citation Coverage Trend" subtitle="% of platform figures with a traceable source" accent={DASH_C.cyan} height={220}>
          <LineMulti data={YEARS.map((y, i) => ({ fy: y, Coverage: CITATION_COVERAGE_TREND[i] }))} xKey="fy" series={[{ key: 'Coverage', name: 'Citation coverage', color: DASH_C.cyan }]} unit="%" area />
        </ChartBox>
        <ChartBox title="Sources by Agency" subtitle="treemap, sized by count" accent={DASH_C.purple} height={220}>
          <TreemapC data={AGENCY_LBL.map((n, i) => ({ name: n, size: AGENCY_COUNT[i] }))} colors={AGENCY_COLORS} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Evidence Confidence Rating" subtitle="canonical 5-stop scale, sized by count" accent={DASH_C.gray} height={210}>
          <TreemapC data={CONF_LBL.map((n, i) => ({ name: n, size: CONF_COUNT[i] }))} colors={RISK5} />
        </ChartBox>
        <ChartBox title="Source Verification Pipeline" accent={DASH_C.blue} height={210}>
          <FunnelC data={[
            { name: 'Catalogued', value: 2847 }, { name: 'Metadata Tagged', value: 2712 },
            { name: 'QA / Verified', value: 2489 }, { name: 'Cross-Referenced', value: 2260 }, { name: 'Publicly Citable', value: 2050 },
          ]} colors={[DASH_C.cyan, DASH_C.teal, DASH_C.blue, DASH_C.yellow, DASH_C.green]} />
        </ChartBox>
        <ChartBox title="Evidence Quality Dimensions" subtitle="primary vs secondary sources" accent={DASH_C.teal} height={210}>
          <RadarTile data={QUALITY_AXES} series={[{ key: 'primary', name: 'Primary sources', color: DASH_C.cyan }, { key: 'secondary', name: 'Secondary sources', color: DASH_C.orange }]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Confidence Score Distribution" subtitle="by document type (0–100)" accent={DASH_C.orange} height={210}>
          <BoxPlotApprox data={[
            boxStats(CONF_SURVEY, DASH_C.cyan, 'Survey'), boxStats(CONF_CONTRACT, DASH_C.orange, 'Contract'),
            boxStats(CONF_SATELLITE, DASH_C.teal, 'Satellite'), boxStats(CONF_FINANCIAL, DASH_C.pink, 'Financial'),
          ]} />
        </ChartBox>
        <ChartBox title="Catalogue Growth Build-up" subtitle="waterfall, sources added per FY" accent={DASH_C.pink} height={210}>
          <WaterfallC steps={[
            { name: 'FY18/19', delta: 1180, isTotal: true }, { name: '+FY19/20', delta: 270 }, { name: '+FY20/21', delta: 270 },
            { name: '+FY21/22', delta: 260 }, { name: '+FY22/23', delta: 260 }, { name: '+FY23/24', delta: 250 },
            { name: '+FY24/25', delta: 200 }, { name: '+FY25/26', delta: 157 }, { name: '=FY25/26 Total', delta: 2847, isTotal: true },
          ]} />
        </ChartBox>
        <ChartBox title="Document Type Hierarchy" subtitle="category → document type" accent={DASH_C.purple} height={210}>
          <SunburstApprox inner={CATEGORY_INNER} outer={CATEGORY_OUTER} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Cross-Reference Completeness by Section" subtitle="% of displayed figures traced to source" accent={DASH_C.green} height={260}>
          <BarH data={SECTIONS_LBL.map((s, i) => ({ section: s, pct: SECTION_XREF_PCT[i] }))} yKey="section" series={[{ key: 'pct', name: 'Completeness', color: DASH_C.green }]} unit="%" />
        </ChartBox>
        <ChartBox title="Most-Cited Sources" subtitle="citations across the platform" accent={DASH_C.yellow} height={260}>
          <BarH data={MOST_CITED.map(m => ({ source: m.name, citations: m.value }))} yKey="source" series={[{ key: 'citations', name: 'Citations', color: DASH_C.yellow }]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Source Freshness by Agency" subtitle="illustrative median age, yrs" accent={DASH_C.orange} height={200}>
          <BarH data={AGENCY_LBL.map((n, i) => ({ agency: n, age: AGENCY_MEDIAN_AGE_YRS[i] }))} yKey="agency" series={[{ key: 'age', name: 'Median age (yrs)', color: DASH_C.orange }]} unit=" yr" />
        </ChartBox>
        <ChartBox title="Evidence Confidence by Agency" subtitle="illustrative average score (0–100)" accent={DASH_C.pink} height={200}>
          <BarV data={AGENCY_LBL.map((n, i) => ({ name: n, score: AGENCY_AVG_CONFIDENCE[i] }))} xKey="name" series={[{ key: 'score', name: 'Avg. confidence', color: DASH_C.pink }]} />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
