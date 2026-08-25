/**
 * AdminOverviewDashboard - RMS "Dashboard" tab flagship view for the
 * Administration section (sectionId 'admin').
 *
 * Scope: user accounts & access control, audit-log activity, the data
 * submission approval pipeline, module/section usage, and the platform's
 * GitHub Actions CI/CD + data-integrity operations. This is the only tab
 * built here - the section's separate "Interactive Map" tab already renders
 * the platform-architecture mind map from src/modules/MindMap/MindMapSection
 * and is untouched by this file.
 *
 * Real anchors this illustrative data model is built around:
 *  - The repo ships a live `audit-log/` folder of daily JSON reports
 *    (2026-08-20 … 2026-08-24 as of writing), written by
 *    .github/workflows/daily-audit.yml on a 06:00 UTC cron - the "Daily
 *    Site Audit" trend below is framed on that real, still-growing feed.
 *  - .github/workflows/deploy.yml auto-builds & publishes on every push to
 *    main (GitHub Pages); backup.yml snapshots a backup branch on the same
 *    trigger; uptime.yml / uptime-check.yml poll the live URL on a
 *    schedule; sync.yml runs a separate scheduled data-sync job. The
 *    CI/CD deploy-frequency and success-rate panels below are modelled on
 *    that always-on-push pipeline.
 *  - Module/section usage frequency ranks the ~20 real sidebar sections
 *    (RMS, PMS, BMS, TIS, DUCAR, Budget, Projects, PIM, GIS, Registry,
 *    Condition, Inspections, Data Entry, Analytics, Road Atlas, Documents,
 *    Socio-Economic, Admin, Downloads, MindMap) that live under
 *    src/modules/ in this codebase.
 *  - User roles (Administrator / Network Engineer / Field Surveyor / Data
 *    Analyst / Viewer / Contractor) mirror the platform's real RBAC tiers.
 *
 * Absolute counts, rates and timestamps are illustrative placeholders,
 * internally consistent with one another, standing in for the live
 * Supabase-backed figures until an `admin_*` telemetry schema exists.
 */
import {
  DASH_C, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  DonutChart, PieChartTile, BarV, BarH, LineMulti, ScatterBubble, HeatGrid,
  TreemapC, GaugeC, FunnelC, RadarTile, BoxPlotApprox, WaterfallC,
} from '../../../shared/dashboardKit';

// ─── Canonical 5-stop risk/condition scale (best → worst) ───────────────────
const RISK = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];
const [R_GOOD, R_FAIR, R_AMBER, R_POOR, R_CRIT] = RISK;

// ─── Users & access control ──────────────────────────────────────────────────
const ROLE_LBL = ['Administrator', 'Network Engineer', 'Field Surveyor', 'Data Analyst', 'Viewer', 'Contractor (Read-Only)'];
const ROLE_CNT = [7, 32, 58, 19, 84, 14];
const TOTAL_USERS = ROLE_CNT.reduce((a, b) => a + b, 0); // 214
const ROLE_CLR = [DASH_C.cyan, DASH_C.green, DASH_C.yellow, DASH_C.purple, DASH_C.blue, DASH_C.pink];

const ACCESS_EVT = [
  { name: 'Permission Grant', value: 26 }, { name: 'Password Reset', value: 41 },
  { name: 'MFA Enrolled', value: 18 }, { name: 'Role Change', value: 14 },
  { name: 'Permission Revoke', value: 9 }, { name: 'Account Disabled', value: 6 },
];

const LOGIN_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LOGIN_HOURS = ['06-09', '09-12', '12-15', '15-18', '18-21', '21-00'];
const LOGIN_MATRIX = [
  [8, 22, 26, 19, 6, 1], [9, 24, 28, 21, 7, 2], [10, 25, 29, 22, 8, 1],
  [9, 23, 27, 20, 7, 2], [11, 21, 24, 17, 9, 3], [3, 6, 8, 7, 5, 2], [1, 3, 4, 3, 2, 1],
];

// ─── Audit log activity (anchored on real audit-log/*.json daily feed) ──────
const AUDIT_DAYS = ['08-11', '08-12', '08-13', '08-14', '08-15', '08-16', '08-17', '08-18', '08-19', '08-20', '08-21', '08-22', '08-23', '08-24'];
const AUDIT_SYSTEM = [12, 13, 11, 14, 12, 6, 5, 13, 14, 22, 19, 21, 18, 20]; // daily-audit.yml + uptime pings; step-up from 08-20 (audit-log/ commits begin)
const AUDIT_USER = [74, 81, 68, 88, 79, 31, 24, 85, 91, 96, 88, 94, 90, 99]; // manual logins, edits, exports, reviews

const SESSION_DEPTH = Array.from({ length: 28 }, (_, i) => {
  const seed = i * 53.7;
  const duration = 3 + ((seed * 9301 + 49297) % 233280) / 233280 * 42;
  const actions = 2 + ((seed * 4103 + 12345) % 199999) / 199999 * 38;
  const users = 1 + Math.round(((i * 613) % 1700) / 100);
  return { x: +duration.toFixed(1), y: +actions.toFixed(0), z: users };
});

// ─── Module / section usage frequency ────────────────────────────────────────
const MODULE_USAGE = [
  { name: 'Network Overview (RMS)', hits: 1840 }, { name: 'Pavement (PMS)', hits: 1420 },
  { name: 'Traffic (TIS)', hits: 1180 }, { name: 'Maintenance (DUCAR)', hits: 1050 },
  { name: 'GIS Map', hits: 980 }, { name: 'Condition', hits: 890 },
  { name: 'Budget', hits: 760 }, { name: 'Structures (BMS)', hits: 705 },
  { name: 'Projects', hits: 640 }, { name: 'Priority (PIM)', hits: 590 },
  { name: 'Data Entry', hits: 520 }, { name: 'Registry', hits: 470 },
  { name: 'Inspections', hits: 430 }, { name: 'Analytics', hits: 390 },
  { name: 'Road Atlas', hits: 340 }, { name: 'Documents', hits: 300 },
  { name: 'Socio-Economic', hits: 260 }, { name: 'Administration', hits: 230 },
  { name: 'Downloads', hits: 190 }, { name: 'MindMap', hits: 140 },
];

const STORAGE_GROUPS = [
  { name: 'GIS Tiles / Map Cache', size: 4120 }, { name: 'Photo Evidence (PhotoTwin)', size: 2860 },
  { name: 'Database (Postgres)', size: 1740 }, { name: 'Documents & Reports', size: 980 },
  { name: 'Audit Logs', size: 210 }, { name: 'Backups', size: 640 },
];

// ─── Submission pipeline & data quality ──────────────────────────────────────
const SUBMISSION_FUNNEL = [
  { name: 'Field Submitted', value: 1260 }, { name: 'Under Review', value: 1180 },
  { name: 'QA Checked', value: 1040 }, { name: 'Approved', value: 912 },
];
const SUBMISSION_OUTCOME = [
  { name: 'Approved', value: 912, color: R_GOOD }, { name: 'Pending', value: 208, color: RISK[1] }, { name: 'Rejected', value: 140, color: R_CRIT },
];

const DQ_CHECKS = [
  { key: 'schema', name: 'Schema Validation', value: 99.8, color: R_GOOD },
  { key: 'geom', name: 'Geometry Validation', value: 98.2, color: R_GOOD },
  { key: 'dup', name: 'Duplicate Detection', value: 95.1, color: R_FAIR },
  { key: 'ref', name: 'Referential Integrity', value: 93.4, color: R_AMBER },
  { key: 'complete', name: 'Completeness', value: 90.6, color: R_POOR },
];
const DQ_ROW = [{ name: 'Pass Rate', ...Object.fromEntries(DQ_CHECKS.map(c => [c.key, c.value])) }];

const AUDIT_SEV = [
  { key: 'info', name: 'Info', value: 142, color: R_GOOD },
  { key: 'low', name: 'Low', value: 58, color: R_FAIR },
  { key: 'medium', name: 'Medium', value: 23, color: R_AMBER },
  { key: 'high', name: 'High', value: 9, color: R_POOR },
  { key: 'critical', name: 'Critical', value: 2, color: R_CRIT },
];
const AUDIT_SEV_ROW = [{ name: 'Last 30 Days', ...Object.fromEntries(AUDIT_SEV.map(s => [s.key, s.value])) }];

// ─── CI/CD deployment pipeline ────────────────────────────────────────────────
const DEPLOY_WEEKS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'];
const DEPLOY_FREQ = [4, 6, 5, 8, 7, 9, 6, 11, 8, 10, 9, 12]; // deploys/week (push-triggered)
const DEPLOY_SUCCESS_RATE = [92, 95, 100, 88, 96, 100, 94, 91, 97, 100, 95, 96]; // %
const DEPLOY_OUTCOMES = [
  { name: 'Success', value: 79, color: R_GOOD }, { name: 'Failed', value: 5, color: RISK[3] }, { name: 'Rolled Back', value: 2, color: R_CRIT },
];

// ─── System health & data growth ──────────────────────────────────────────────
const DB_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
const DB_ROWS_K = [340, 372, 401, 438, 470, 512, 561, 612]; // thousands of rows, all tables

const DQ_RADAR = [
  { axis: 'Completeness', value: 96, target: 98 }, { axis: 'Accuracy', value: 94, target: 97 },
  { axis: 'Consistency', value: 91, target: 95 }, { axis: 'Timeliness', value: 88, target: 95 },
  { axis: 'Uniqueness', value: 97, target: 99 },
];

const RESP_TIME = [
  { name: 'API', min: 40, q1: 78, median: 112, q3: 168, max: 340, color: DASH_C.cyan },
  { name: 'Database', min: 8, q1: 18, median: 29, q3: 52, max: 140, color: DASH_C.green },
  { name: 'Auth', min: 60, q1: 95, median: 130, q3: 190, max: 410, color: DASH_C.purple },
  { name: 'GIS Tiles', min: 90, q1: 150, median: 220, q3: 340, max: 680, color: DASH_C.orange },
  { name: 'Storage', min: 30, q1: 60, median: 90, q3: 150, max: 320, color: DASH_C.blue },
];

export default function AdminOverviewDashboard() {
  return (
    <div>
      <KpiStrip>
        <StatMini value={`${TOTAL_USERS}`} label="Registered Users" color={DASH_C.cyan} />
        <StatMini value="37" label="Active Sessions Today" color={DASH_C.green} />
        <StatMini value="119" label="Audit Events (24h)" color={DASH_C.teal} />
        <StatMini value="208" label="Pending Submissions" color={DASH_C.yellow} />
        <StatMini value="96%" label="Deploy Success Rate (12wk)" color={DASH_C.blue} />
        <StatMini value="99.4%" label="Data-Integrity Pass Rate" color={DASH_C.purple} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.cyan}>User Accounts & Access Control</SectionHdr>
      <ChartGrid cols="3">
        <ChartBox title="Users by Role" subtitle={`${TOTAL_USERS} registered`} accent={DASH_C.cyan} height={210}>
          <DonutChart data={ROLE_LBL.map((n, i) => ({ name: n, value: ROLE_CNT[i], color: ROLE_CLR[i] }))} colors={ROLE_CLR} />
        </ChartBox>
        <ChartBox title="Access-Control Events" subtitle="by type, trailing 30d" accent={DASH_C.purple} height={210}>
          <BarH data={ACCESS_EVT} yKey="name" series={[{ key: 'value', name: 'Events', color: DASH_C.purple }]} />
        </ChartBox>
        <ChartBox title="Login Activity" subtitle="sessions by day × time-of-day" accent={DASH_C.teal} height={210}>
          <HeatGrid matrix={LOGIN_MATRIX} xLabels={LOGIN_HOURS} yLabels={LOGIN_DAYS} accent={DASH_C.teal} unit=" sessions" />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.green}>Audit Log & Session Activity</SectionHdr>
      <ChartGrid cols="21">
        <ChartBox title="Daily Audit Log Volume" subtitle="automated (daily-audit.yml) + user actions, 14d" accent={DASH_C.green} height={250}>
          <LineMulti
            data={AUDIT_DAYS.map((d, i) => ({ day: d, System: AUDIT_SYSTEM[i], User: AUDIT_USER[i] }))}
            xKey="day" series={[{ key: 'System', name: 'System-generated', color: DASH_C.green }, { key: 'User', name: 'User actions', color: DASH_C.cyan }]}
            area
          />
        </ChartBox>
        <ChartBox title="Session Depth" subtitle="duration vs actions, size = concurrent users" accent={DASH_C.purple} height={250}>
          <ScatterBubble data={SESSION_DEPTH} xLabel="Duration (min)" yLabel="Actions" color={DASH_C.purple} />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="4">
        <ChartBox title="CI/CD Deploy Success Rate" subtitle="trailing 12 weeks" accent={R_GOOD} height={190}>
          <GaugeC value={96} target={98} color={R_GOOD} />
        </ChartBox>
        <ChartBox title="Data-Integrity Pass Rate" subtitle="overall, all checks" accent={R_GOOD} height={190}>
          <GaugeC value={99.4} target={99.5} color={R_GOOD} />
        </ChartBox>
        <ChartBox title="Platform Uptime" subtitle="30d, via uptime.yml" accent={R_GOOD} height={190}>
          <GaugeC value={99.95} target={99.9} color={R_GOOD} />
        </ChartBox>
        <ChartBox title="Storage Utilization" subtitle="of provisioned capacity" accent={DASH_C.blue} height={190}>
          <GaugeC value={61} target={80} color={DASH_C.blue} />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.yellow}>Module Usage & Platform Traffic</SectionHdr>
      <ChartGrid cols="21">
        <ChartBox title="Section Usage Frequency" subtitle="relative traffic across 20 platform sections" accent={DASH_C.cyan} height={400}>
          <BarH data={MODULE_USAGE} yKey="name" series={[{ key: 'hits', name: 'Relative hits', color: DASH_C.cyan }]} />
        </ChartBox>
        <ChartBox title="Storage by Module Group" subtitle="treemap, relative MB" accent={DASH_C.teal} height={400}>
          <TreemapC data={STORAGE_GROUPS} />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.orange}>Data Submission Pipeline & Data Quality</SectionHdr>
      <ChartGrid cols="3">
        <ChartBox title="Submission Approval Pipeline" subtitle="field data, 30d" accent={DASH_C.blue} height={220}>
          <FunnelC data={SUBMISSION_FUNNEL} colors={[DASH_C.cyan, DASH_C.teal, DASH_C.blue, DASH_C.green]} />
        </ChartBox>
        <ChartBox title="Submission Outcomes" subtitle="approved / pending / rejected" accent={DASH_C.yellow} height={220}>
          <PieChartTile data={SUBMISSION_OUTCOME} colors={SUBMISSION_OUTCOME.map(d => d.color)} />
        </ChartBox>
        <ChartBox title="Data-Integrity Checks by Type" subtitle="pass rate %, risk-colored" accent={R_AMBER} height={220}>
          <BarV data={DQ_ROW} xKey="name" series={DQ_CHECKS.map(c => ({ key: c.key, name: c.name, color: c.color }))} unit="%" />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.pink}>CI/CD Deployment Pipeline</SectionHdr>
      <ChartGrid cols="3">
        <ChartBox title="Deploy Frequency" subtitle="deploys/week, GitHub Actions on push" accent={DASH_C.blue} height={210}>
          <LineMulti data={DEPLOY_WEEKS.map((w, i) => ({ week: w, deploys: DEPLOY_FREQ[i] }))} xKey="week" series={[{ key: 'deploys', name: 'Deploys', color: DASH_C.blue }]} />
        </ChartBox>
        <ChartBox title="Deploy Success Rate" subtitle="% of runs green, per week" accent={R_GOOD} height={210}>
          <LineMulti data={DEPLOY_WEEKS.map((w, i) => ({ week: w, rate: DEPLOY_SUCCESS_RATE[i] }))} xKey="week" series={[{ key: 'rate', name: 'Success %', color: R_GOOD }]} unit="%" />
        </ChartBox>
        <ChartBox title="Deploy Outcomes" subtitle="last 90 days, 86 runs" accent={DASH_C.orange} height={210}>
          <PieChartTile data={DEPLOY_OUTCOMES} colors={DEPLOY_OUTCOMES.map(d => d.color)} />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.purple}>System Health & Data Growth</SectionHdr>
      <ChartGrid cols="3">
        <ChartBox title="Database Row-Count Growth" subtitle="all tables, thousands of rows" accent={DASH_C.cyan} height={210}>
          <LineMulti data={DB_MONTHS.map((m, i) => ({ month: m, rows: DB_ROWS_K[i] }))} xKey="month" series={[{ key: 'rows', name: 'Rows (k)', color: DASH_C.cyan }]} area />
        </ChartBox>
        <ChartBox title="Data Quality Dimensions" subtitle="current vs target" accent={DASH_C.purple} height={210}>
          <RadarTile data={DQ_RADAR.map(d => ({ axis: d.axis, Current: d.value, Target: d.target }))} maxValue={100}
            series={[{ key: 'Current', name: 'Current', color: DASH_C.purple }, { key: 'Target', name: 'Target', color: DASH_C.pink }]} />
        </ChartBox>
        <ChartBox title="Response Time Distribution" subtitle="by subsystem, ms" accent={DASH_C.orange} height={210}>
          <BoxPlotApprox data={RESP_TIME} unit="ms" />
        </ChartBox>
      </ChartGrid>

      <ChartGrid cols="2">
        <ChartBox title="User Account Growth" subtitle="Jan → Aug 2026, waterfall" accent={DASH_C.pink} height={200}>
          <WaterfallC steps={[
            { name: 'Jan 2026', delta: 148, isTotal: true }, { name: '+Registered', delta: 79 },
            { name: '−Deactivated', delta: -13 }, { name: 'Aug 2026', delta: TOTAL_USERS, isTotal: true },
          ]} unit=" users" />
        </ChartBox>
        <ChartBox title="Audit Findings by Severity" subtitle="trailing 30 days, risk-colored" accent={R_AMBER} height={200}>
          <BarV data={AUDIT_SEV_ROW} xKey="name" series={AUDIT_SEV.map(s => ({ key: s.key, name: s.name, color: s.color }))} />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
