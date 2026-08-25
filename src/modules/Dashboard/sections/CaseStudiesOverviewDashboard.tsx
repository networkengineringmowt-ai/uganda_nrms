/**
 * CaseStudiesOverviewDashboard - RMS "Dashboard" tab, Case Studies view.
 * Documented project outcomes, best-practice engineering interventions, and
 * value-for-money analyses. Anchors to the platform's canonical figures: 6
 * regions (Central, Northern, Eastern, Western, Southern, North Eastern) and
 * the development partners already referenced elsewhere in UNRMS (World Bank,
 * AfDB, JICA, GOU). Extended to 20 chart tiles. No tables here - tabular
 * breakdowns live under Exhaustive Tables / Deep Analytics.
 */
import {
  DASH_C, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  DonutChart, PieChartTile, BarV, BarH, LineMulti, ScatterBubble, HeatGrid,
  TreemapC, GaugeC, FunnelC, RadarTile, SunburstApprox, BoxPlotApprox, WaterfallC,
} from '../../../shared/dashboardKit';

// ─── Data model (illustrative, internally consistent case-study catalogue) ───
const TOTAL_CASE_STUDIES = 96;

const AGENCY_LBL = ['World Bank', 'AfDB', 'JICA', 'GOU', 'EU', 'Others'];
const AGENCY_COUNT = [28, 22, 16, 18, 8, 4]; // sums to 96
const AGENCY_COLORS = [DASH_C.cyan, DASH_C.purple, DASH_C.pink, DASH_C.green, DASH_C.yellow, DASH_C.gray];

const CATEGORY_LBL = ['Pavement Rehab', 'Bridge Construction', 'Safety Intervention', 'Climate Resilience', 'Low-Volume Roads', 'Institutional Reform'];
const CATEGORY_COUNT = [26, 14, 12, 18, 16, 10]; // sums to 96
const CATEGORY_COLORS = [DASH_C.cyan, DASH_C.blue, DASH_C.orange, DASH_C.teal, DASH_C.green, DASH_C.purple];

// Outcome rating - ordered good→bad, canonical risk scale
const OUTCOME_LBL = ['Successful', 'Mixed', 'Lessons-Learned'];
const OUTCOME_COUNT = [58, 27, 11]; // sums to 96
const OUTCOME_COLORS = ['#22c55e', '#eab308', '#ef4444'];

// Value-for-money score distribution - ordered good→bad, canonical 5-stop scale
const VFM_BAND_LBL = ['Excellent (≥85)', 'Good (70–84)', 'Fair (55–69)', 'Weak (40–54)', 'Poor (<40)'];
const VFM_BAND_COUNT = [22, 34, 24, 12, 4]; // sums to 96
const VFM_BAND_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];

// Documentation completeness - ordered good→bad, canonical 5-stop scale
const DOC_BAND_LBL = ['Complete', 'Near-Complete', 'Partial', 'Sparse', 'Draft-Only'];
const DOC_BAND_COUNT = [31, 27, 19, 13, 6]; // sums to 96
const DOC_BAND_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];

const REG_LBL = ['Central', 'Northern', 'Eastern', 'Western', 'Southern', 'North Eastern'];
const REG_COUNT = [24, 14, 18, 16, 15, 9]; // sums to 96

const PUB_YRS = ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
const PUB_COUNT = [3, 5, 6, 8, 10, 13, 15, 18, 18]; // cumulative-feel annual publication trend
const PUB_COMPLETE_PCT = [40, 44, 48, 55, 58, 64, 70, 76, 82]; // documentation-completeness trend over years

// Avg cost-saving / performance-improvement % achieved, by intervention category
const IMPROVE_PCT = [14, 11, 22, 9, 17, 26]; // aligned to CATEGORY_LBL order
const IMPROVE_COST_SAVING = [12, 9, 6, 8, 15, 19]; // avg documented cost saving %, same order

// Citation / reference usage frequency (times cited elsewhere on the platform), by category
const CITATION_COUNT = [142, 68, 96, 74, 58, 44]; // aligned to CATEGORY_LBL order

// Case studies by agency × outcome rating (matrix, rows=agency, cols=outcome)
const AGENCY_OUTCOME_MATRIX = [
  [18, 8, 2], // World Bank
  [14, 6, 2], // AfDB
  [10, 5, 1], // JICA
  [10, 6, 2], // GOU
  [4, 2, 2],  // EU
  [2, 0, 2],  // Others
];

// VFM score by category (scatter: x = avg cost saving %, y = VFM score /100, size = citation count)
const CATEGORY_VFM_SCORE = [78, 62, 84, 58, 71, 66]; // aligned to CATEGORY_LBL order

// Documentation completeness score by agency (box-plot-style spread, 0-100 scale)
function synthBox(name: string, min: number, q1: number, median: number, q3: number, max: number, color: string) {
  return { name, min, q1, median, q3, max, color };
}

// Case study lifecycle funnel: identified → drafted → peer-reviewed → published → cited elsewhere
const LIFECYCLE_STAGES = ['Identified', 'Field-Verified', 'Drafted', 'Peer-Reviewed', 'Published', 'Cited Elsewhere'];
const LIFECYCLE_VALUES = [140, 122, 108, 96, 96, 71];

// Cumulative published case studies waterfall by funding-agency contribution
const AGENCY_WATERFALL_DELTAS = AGENCY_COUNT;

// Derived stats
const AVG_VFM_SCORE = Math.round(
  (VFM_BAND_COUNT[0] * 92 + VFM_BAND_COUNT[1] * 77 + VFM_BAND_COUNT[2] * 62 + VFM_BAND_COUNT[3] * 47 + VFM_BAND_COUNT[4] * 30)
  / TOTAL_CASE_STUDIES,
); // weighted-avg VFM score /100
const AVG_DOC_COMPLETENESS = Math.round(
  (DOC_BAND_COUNT[0] * 96 + DOC_BAND_COUNT[1] * 80 + DOC_BAND_COUNT[2] * 60 + DOC_BAND_COUNT[3] * 38 + DOC_BAND_COUNT[4] * 15)
  / TOTAL_CASE_STUDIES,
); // weighted-avg documentation completeness %
const SUCCESS_RATE = Math.round((OUTCOME_COUNT[0] / TOTAL_CASE_STUDIES) * 100);
const TOTAL_CITATIONS = CITATION_COUNT.reduce((a, b) => a + b, 0);
const AVG_IMPROVEMENT = Math.round(IMPROVE_PCT.reduce((a, b) => a + b, 0) / IMPROVE_PCT.length);

export default function CaseStudiesOverviewDashboard() {
  return (
    <div>
      <KpiStrip>
        <StatMini value={`${TOTAL_CASE_STUDIES}`} label="Documented Case Studies" color={DASH_C.teal} />
        <StatMini value={`${SUCCESS_RATE}%`} label="Rated Successful" color="#22c55e" />
        <StatMini value={`${AVG_VFM_SCORE}/100`} label="Avg Value-for-Money" color={DASH_C.yellow} />
        <StatMini value={`${AVG_DOC_COMPLETENESS}%`} label="Avg Doc. Completeness" color={DASH_C.cyan} />
        <StatMini value={`${AVG_IMPROVEMENT}%`} label="Avg Performance Gain" color={DASH_C.orange} />
        <StatMini value={`${TOTAL_CITATIONS}`} label="Platform Citations" color={DASH_C.purple} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.teal}>Case Studies &amp; Value-for-Money · 20 Views</SectionHdr>

      <ChartGrid cols="3">
        <ChartBox title="Case Studies by Funding Agency" subtitle={`${TOTAL_CASE_STUDIES} total`} accent={DASH_C.teal} height={220}>
          <DonutChart data={AGENCY_LBL.map((n, i) => ({ name: `${n} (${AGENCY_COUNT[i]})`, value: AGENCY_COUNT[i], color: AGENCY_COLORS[i] }))} />
        </ChartBox>
        <ChartBox title="Case Studies by Intervention Category" accent={DASH_C.cyan} height={220}>
          <BarH data={CATEGORY_LBL.map((n, i) => ({ name: n, count: CATEGORY_COUNT[i] }))} yKey="name"
            series={[{ key: 'count', name: 'Case Studies', color: DASH_C.cyan }]} />
        </ChartBox>
        <ChartBox title="Outcome Rating Distribution" subtitle="successful / mixed / lessons-learned" accent={DASH_C.green} height={220}>
          <DonutChart data={OUTCOME_LBL.map((n, i) => ({ name: `${n} (${OUTCOME_COUNT[i]})`, value: OUTCOME_COUNT[i], color: OUTCOME_COLORS[i] }))} innerRadius={40} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="12">
        <ChartBox title="Value-for-Money Score Distribution" subtitle="5-band scale, 96 case studies" accent={DASH_C.yellow} height={230}>
          <BarV data={VFM_BAND_LBL.map((n, i) => ({ name: n, count: VFM_BAND_COUNT[i] }))} xKey="name"
            series={[{ key: 'count', name: 'Case Studies', color: DASH_C.yellow }]} />
        </ChartBox>
        <ChartBox title="Category VFM Score vs Cost Saving" subtitle="x = avg cost saving %, y = VFM score, size = citations" accent={DASH_C.teal} height={230}>
          <ScatterBubble
            data={CATEGORY_LBL.map((n, i) => ({ x: IMPROVE_COST_SAVING[i], y: CATEGORY_VFM_SCORE[i], z: CITATION_COUNT[i], label: n }))}
            xLabel="Avg Cost Saving (%)" yLabel="VFM Score /100" color={DASH_C.teal}
          />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="Documentation Completeness" accent={DASH_C.cyan} height={190}>
          <DonutChart data={DOC_BAND_LBL.map((n, i) => ({ name: n, value: DOC_BAND_COUNT[i], color: DOC_BAND_COLORS[i] }))} innerRadius={34} />
        </ChartBox>
        <ChartBox title="Case Studies by Region" accent={DASH_C.purple} height={190}>
          <BarV data={REG_LBL.map((n, i) => ({ name: n, count: REG_COUNT[i] }))} xKey="name"
            series={[{ key: 'count', name: 'Case Studies', color: DASH_C.purple }]} />
        </ChartBox>
        <ChartBox title="Avg Performance Improvement by Category" accent={DASH_C.orange} height={190}>
          <BarH data={CATEGORY_LBL.map((n, i) => ({ name: n, pct: IMPROVE_PCT[i] }))} yKey="name"
            series={[{ key: 'pct', name: 'Improvement %', color: DASH_C.orange }]} unit="%" />
        </ChartBox>
        <ChartBox title="Case Study Lifecycle Funnel" accent={DASH_C.blue} height={190}>
          <FunnelC data={LIFECYCLE_STAGES.map((n, i) => ({ name: n, value: LIFECYCLE_VALUES[i] }))}
            colors={[DASH_C.blue, DASH_C.teal, DASH_C.cyan, '#00aacc', DASH_C.green, DASH_C.purple]} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Publication Trend" subtitle="case studies published per year" accent={DASH_C.green} height={220}>
          <LineMulti data={PUB_YRS.map((y, i) => ({ year: y, published: PUB_COUNT[i] }))} xKey="year"
            series={[{ key: 'published', name: 'Published', color: DASH_C.green }]} area />
        </ChartBox>
        <ChartBox title="Documentation Completeness Trend" subtitle="avg % complete, by publication year" accent={DASH_C.cyan} height={220}>
          <LineMulti data={PUB_YRS.map((y, i) => ({ year: y, pct: PUB_COMPLETE_PCT[i] }))} xKey="year"
            series={[{ key: 'pct', name: 'Avg Completeness', color: DASH_C.cyan }]} unit="%" />
        </ChartBox>
        <ChartBox title="Agency × Outcome Rating" subtitle="case study count" accent={DASH_C.pink} height={220}>
          <HeatGrid matrix={AGENCY_OUTCOME_MATRIX} xLabels={OUTCOME_LBL} yLabels={AGENCY_LBL} accent={DASH_C.pink} unit=" cases" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="Case Studies by Category & Improvement" subtitle="score vs performance-gain profile" accent={DASH_C.purple} height={210}>
          <RadarTile
            data={CATEGORY_LBL.map((n, i) => ({ axis: n, vfm: CATEGORY_VFM_SCORE[i], improvement: IMPROVE_PCT[i] * 3 }))}
            series={[{ key: 'vfm', name: 'VFM Score /100', color: DASH_C.purple }, { key: 'improvement', name: 'Improvement (×3, %)', color: DASH_C.orange }]}
          />
        </ChartBox>
        <ChartBox title="Catalogue Composition" subtitle="agency (inner) → category weighting (outer)" accent={DASH_C.teal} height={210}>
          <SunburstApprox
            inner={AGENCY_LBL.map((n, i) => ({ name: n, value: AGENCY_COUNT[i], color: AGENCY_COLORS[i] }))}
            outer={CATEGORY_LBL.map((n, i) => ({ name: n, value: CATEGORY_COUNT[i], color: CATEGORY_COLORS[i] }))}
          />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="3">
        <ChartBox title="Citation Frequency by Category" subtitle="treemap, times cited platform-wide" accent={DASH_C.cyan} height={210}>
          <TreemapC data={CATEGORY_LBL.map((n, i) => ({ name: n, size: CITATION_COUNT[i] }))} colors={CATEGORY_COLORS} />
        </ChartBox>
        <ChartBox title="Catalogue-Wide VFM Score" subtitle="target 75/100" accent={DASH_C.yellow} height={210}>
          <GaugeC value={AVG_VFM_SCORE} max={100} target={75} color={DASH_C.yellow} suffix="" label="Weighted across 96 case studies" />
        </ChartBox>
        <ChartBox title="Catalogue-Wide Documentation Completeness" subtitle="target 80%" accent={DASH_C.green} height={210}>
          <GaugeC value={AVG_DOC_COMPLETENESS} target={80} color={DASH_C.green} label="Weighted across 96 case studies" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="Documentation Completeness by Agency" subtitle="score spread /100" accent={DASH_C.orange} height={190}>
          <BoxPlotApprox data={[
            synthBox('World Bank', 58, 74, 86, 94, 99, DASH_C.cyan),
            synthBox('AfDB', 50, 66, 78, 88, 96, DASH_C.purple),
            synthBox('JICA', 62, 78, 88, 95, 100, DASH_C.pink),
            synthBox('GOU', 40, 54, 66, 78, 90, DASH_C.green),
          ]} unit="%" />
        </ChartBox>
        <ChartBox title="Case Study Category Share" accent={DASH_C.blue} height={190}>
          <PieChartTile data={CATEGORY_LBL.map((n, i) => ({ name: n, value: CATEGORY_COUNT[i], color: CATEGORY_COLORS[i] }))} />
        </ChartBox>
        <ChartBox title="Published Case Studies by Agency" subtitle="waterfall, cumulative catalogue build-up" accent={DASH_C.teal} height={190}>
          <WaterfallC steps={[
            { name: 'World Bank', delta: AGENCY_WATERFALL_DELTAS[0], isTotal: true },
            { name: '+AfDB', delta: AGENCY_WATERFALL_DELTAS[1] },
            { name: '+JICA', delta: AGENCY_WATERFALL_DELTAS[2] },
            { name: '+GOU', delta: AGENCY_WATERFALL_DELTAS[3] },
            { name: '+EU', delta: AGENCY_WATERFALL_DELTAS[4] },
            { name: '+Others', delta: AGENCY_WATERFALL_DELTAS[5] },
            { name: 'Total', delta: TOTAL_CASE_STUDIES, isTotal: true },
          ]} unit=" cases" />
        </ChartBox>
        <ChartBox title="Outcome Rating by Region" accent={DASH_C.cyan} height={190}>
          <BarV data={REG_LBL.map((n, i) => ({
            name: n,
            Successful: Math.round(REG_COUNT[i] * (OUTCOME_COUNT[0] / TOTAL_CASE_STUDIES)),
            Mixed: Math.round(REG_COUNT[i] * (OUTCOME_COUNT[1] / TOTAL_CASE_STUDIES)),
            'Lessons-Learned': Math.max(0, REG_COUNT[i] - Math.round(REG_COUNT[i] * (OUTCOME_COUNT[0] / TOTAL_CASE_STUDIES)) - Math.round(REG_COUNT[i] * (OUTCOME_COUNT[1] / TOTAL_CASE_STUDIES))),
          }))} xKey="name" series={[
            { key: 'Successful', name: 'Successful', color: '#22c55e' },
            { key: 'Mixed', name: 'Mixed', color: '#eab308' },
            { key: 'Lessons-Learned', name: 'Lessons-Learned', color: '#ef4444' },
          ]} stacked />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
