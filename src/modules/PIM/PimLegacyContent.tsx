import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
const BudgetSection = lazy(() => import('../Budget/BudgetSection'));
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { DollarSign, Globe, Building2, TrendingUp, FileText, LayoutDashboard, Landmark } from 'lucide-react';
import { ModuleNavBar } from '../../shared/ModuleNavBar';
import SectionDashboard from '../Dashboard/SectionDashboard';
import { renderSliceLabel } from '../../shared/dashboardKit';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';
import { NULL_ZERO_STYLE } from '../../shared/tableFormatting';

const C = {
  cyan: '#00f5ff', green: '#00ff88', yellow: '#ffd23f',
  orange: '#ff6b35', purple: '#b967ff', blue: '#4d9fff',
  pink: '#ff2d78', teal: '#00d4aa', red: '#ff3366',
};
function hexRgb(h: string) {
  const c = h.replace('#','');
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}
const card = (a: string) => ({
  background: 'rgba(15,15,15,0.7)',
  border: `1px solid rgba(${hexRgb(a)},0.2)`,
  borderRadius: 12, padding: '18px 20px',
  boxShadow: `0 0 20px rgba(${hexRgb(a)},0.05)`,
});
const TK = { fontSize: 9, fill: 'rgba(148,163,184,0.6)' };

// ── Data ─────────────────────────────────────────────────────────────────────
const DONOR_BREAKDOWN = [
  { name: 'World Bank / IDA',     value: 28, color: C.blue   },
  { name: 'AfDB',                 value: 22, color: C.green  },
  { name: 'JICA (Japan)',         value: 15, color: C.cyan   },
  { name: 'China EXIM Bank',      value: 18, color: C.red    },
  { name: 'GoU (Own Revenue)',    value: 12, color: C.yellow },
  { name: 'OPEC Fund',            value:  3, color: C.orange },
  { name: 'KfW / EU',             value:  2, color: C.purple },
];

const PPP_PROJECTS = [
  {
    name: 'Kampala–Jinja Expressway',
    status: 'Financial Close Stage',
    length_km: 95,
    value_usd_m: 1200,
    model: 'DBFOT (30-year concession)',
    funder: 'PPP - GoU + Private consortium',
    notes: 'First major PPP expressway; toll-based; linking Kampala to Jinja SEZ',
    color: C.cyan,
  },
  {
    name: 'Kampala–Entebbe Expressway',
    status: 'Operational (since 2018)',
    length_km: 51,
    value_usd_m: 476,
    model: 'EPC + Govt O&M (China EXIM)',
    funder: 'China EXIM + GoU',
    notes: 'Toll road; 22km dual carriageway + 29km approach; Department of National Roads operated',
    color: C.green,
  },
  {
    name: 'Kampala Northern Bypass',
    status: 'Operational (2009/2018 phases)',
    length_km: 21,
    value_usd_m: 145,
    model: 'EPC (AfDB grant)',
    funder: 'AfDB + GoU',
    notes: 'Phase II (Bweyogerere–Kigowa) completed 2018; critical urban bypass',
    color: C.blue,
  },
  {
    name: 'Tirinyi–Mbale–Soroti',
    status: 'Under Procurement',
    length_km: 272,
    value_usd_m: 780,
    model: 'EPC (World Bank)',
    funder: 'IDA Credit + GoU',
    notes: 'Eastern Corridor upgrade; OPRC maintenance component',
    color: C.yellow,
  },
  {
    name: 'Gulu–Atiak Highway',
    status: 'Under Construction',
    length_km: 74,
    value_usd_m: 210,
    model: 'EPC (AfDB)',
    funder: 'AfDB + GoU',
    notes: 'Northern Uganda connectivity; bituminous standard',
    color: C.orange,
  },
  {
    name: 'Kyotera–Mutukula',
    status: 'Completed 2022',
    length_km: 76,
    value_usd_m: 95,
    model: 'EPC (JICA)',
    funder: 'JICA ODA loan + GoU',
    notes: 'Tanzania border connectivity; bituminous; part of Northern Corridor',
    color: C.teal,
  },
];

const PIM_FRAMEWORK = [
  { stage: 'Strategic Planning',   body: 'MoWT / NPA',       tools: 'NDP IV, Vision 2040, Transport Master Plan', color: C.purple },
  { stage: 'Project Identification', body: 'Department of National Roads / MoWT',    tools: 'Pre-feasibility, network gap analysis',       color: C.blue   },
  { stage: 'Project Appraisal',    body: 'Department of National Roads + MFPED',     tools: 'HDM-4 NPV/BCR, economic CBA, ESIA',           color: C.cyan   },
  { stage: 'Approval & Budget',    body: 'MFPED / Parliament', tools: 'MTEF, BFP, Appropriation Act',              color: C.yellow },
  { stage: 'Procurement',          body: 'Department of National Roads PDU',         tools: 'PPDA Act, FIDIC contracts',                   color: C.orange },
  { stage: 'Implementation',       body: 'Department of National Roads + Contractor', tools: 'Contract management, site supervision',      color: C.green  },
  { stage: 'Monitoring & Eval.',   body: 'Department of National Roads / OAG / NPA', tools: 'Physical & financial progress, VFM audits',  color: C.teal   },
];

const TABS = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: <LayoutDashboard size={13}/> },
  { id: 'budget', label: 'Budget & Maintenance Trends', icon: <DollarSign size={13}/> },
  { id: 'pim',    label: 'PIM Framework', icon: <FileText size={13}/> },
  { id: 'ppp',    label: 'PPP Projects',  icon: <Building2 size={13}/> },
  { id: 'donor',  label: 'Donor Funding', icon: <Globe size={13}/> },
  { id: 'ndpiv',  label: 'NDP IV Targets', icon: <TrendingUp size={13}/> },
  { id: 'ibp',    label: 'IBP Project Register', icon: <Landmark size={13}/> },
] as const;
type TabId = typeof TABS[number]['id'];

// ── IBP (Integrated Bank of Projects) - Ministry of Finance, Planning &
// Economic Development national investment-planning register, pulled from
// the real public IBP portfolio API (ibp-api.finance.go.ug). Covers every
// UNRA + Ministry of Works and Transport vote-level project registered in
// IBP - not a roads-only filter, since a handful of MoWT entries are
// multi-modal (airports, rail, port); those stay visible via the Vote/
// Department columns rather than being silently dropped. `fy` is the real
// Ugandan fiscal year (Jul-Jun) each project's last IBP submission falls
// in, derived from `last_submission_date` - IBP's public API has no
// separate multi-year funding-projection field, so this is the one real,
// non-fabricated per-project year signal it exposes.
interface IbpProject extends Record<string, unknown> {
  code: string; name: string; vote: string; department: string;
  phase: string; status: string; cost_ugx_bn: number; last_submission_date: string; fy: string;
}
const IBP_STATUS_COLOR: Record<string, string> = {
  APPROVED: C.green, CONDITIONALLY_APPROVED: '#84cc16', ASSIGNED: C.blue,
  SUBMITTED: C.teal, REVISED: C.yellow, DRAFT: '#64748b', REJECTED: C.red,
};
const IBP_STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Approved', CONDITIONALLY_APPROVED: 'Conditionally Approved', ASSIGNED: 'Assigned',
  SUBMITTED: 'Submitted', REVISED: 'Revised', DRAFT: 'Draft', REJECTED: 'Rejected',
};
function IbpStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span style={NULL_ZERO_STYLE}>No data</span>;
  const color = IBP_STATUS_COLOR[status] ?? '#64748b';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999,
      background: `${color}1f`, border: `1px solid ${color}55`, color, fontSize: 10, fontWeight: 800,
    }}>{IBP_STATUS_LABEL[status] ?? status}</span>
  );
}
// Sort key: most recent FY first (FY2025/26 -> 2025).
function fySortKey(fy: string): number {
  const m = /FY(\d{4})/.exec(fy);
  return m ? Number(m[1]) : 0;
}

// ── Maintenance Strategy (network-wide priority register + URF funding) ──
// Pulled from her 2026 Maintenance Strategy source workbooks
// (maintenance_backlog_oprc_ppp_workbook_v9_strategy.xlsx for the 5-year
// FY26/27-FY30/31 forward strategy and 338-link priority register; Budgets/
// Consolidated.xlsx for real URF annual work plans FY2024/25 & FY2025/26 and
// regional disbursement FY2023/24). Scope: Uganda Road Fund routine/periodic
// MAINTENANCE funding only - not the full capital budget (donor-funded new
// construction/upgrading/PPP projects are tracked separately in the IBP
// register above).
interface MaintenanceLink extends Record<string, unknown> {
  link_id: string; road_no: string; road_class: string; link_name: string;
  surface_type: string; length_km: number; maintenance_station: string | null;
  region: string; vci_pct: number | null; vci_rating: string | null;
  recommended_intervention: string | null; priority_score: number | null;
  priority_rank: number | null; scheduled_fy: string | null;
  indicative_base_cost_ugx_bn: number | null; asset_value_at_risk_ugx_bn: number | null;
  priority_band: string | null;
}
interface AnnualProgrammeRow { fy: string; links: number; programme_cost_bn: number; asset_value_at_risk_bn: number; funding_gap_bn: number; }
interface WorkplanRow { fy: string; category: string; planned_exp_ugx_bn: number; }
interface RegionalDisbursementSummary { fy: string; region: string; disbursed_ugx_bn: number; }
interface MaintenanceStrategyData {
  kpis: { total_links: number; total_programme_cost_bn: number; asset_value_at_risk_bn: number; links_with_existing_path: number; reconstruction_links: number };
  annual_programme: AnnualProgrammeRow[];
  annual_maintenance_workplan: WorkplanRow[];
  regional_disbursement_2023_24_summary: RegionalDisbursementSummary[];
  links: MaintenanceLink[];
  meta: { sources: string[]; note: string };
}
const PRIORITY_BAND_COLOR: Record<string, string> = {
  'Priority 1': C.red, 'Priority 2': C.orange, 'Priority 3': C.yellow, 'Priority 4': C.green,
};
function PriorityBandBadge({ band }: { band: string | null | undefined }) {
  if (!band) return <span style={NULL_ZERO_STYLE}>No data</span>;
  const color = PRIORITY_BAND_COLOR[band] ?? '#64748b';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999,
      background: `${color}1f`, border: `1px solid ${color}55`, color, fontSize: 10, fontWeight: 800,
    }}>{band}</span>
  );
}

const CT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(8,8,8,0.95)', border: '1px solid rgba(255,255,255,0.1)',
      padding: '8px 12px', borderRadius: 7, fontSize: 10 }}>
      <div style={{ color: '#94a3b8', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, fontWeight: 700 }}>{p.name}: {p.value?.toLocaleString()}</div>
      ))}
    </div>
  );
};

export default function PimLegacyContent({ initialTab, hideTabBar }: { initialTab?: TabId; hideTabBar?: boolean } = {}) {
  const [tab, setTab] = useState<TabId>(initialTab || 'dashboard');
  const [ibpProjects, setIbpProjects] = useState<IbpProject[]>([]);
  const [ibpFY, setIbpFY] = useState<string>('all');
  const [maint, setMaint] = useState<MaintenanceStrategyData | null>(null);
  const [maintFY, setMaintFY] = useState<string>('all');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}ibp_projects.json`)
      .then(r => r.json())
      .then(setIbpProjects)
      .catch(() => {/* IBP register optional */});
    fetch(`${import.meta.env.BASE_URL}maintenance_strategy.json`)
      .then(r => r.json())
      .then(setMaint)
      .catch(() => {/* Maintenance strategy register optional */});
  }, []);

  const ibpFYs = useMemo(
    () => [...new Set(ibpProjects.map(p => p.fy))].sort((a, b) => fySortKey(b) - fySortKey(a)),
    [ibpProjects],
  );
  const ibpRows = useMemo(
    () => ibpFY === 'all' ? ibpProjects : ibpProjects.filter(p => p.fy === ibpFY),
    [ibpProjects, ibpFY],
  );
  const ibpColumns: STColumn<IbpProject>[] = useMemo(() => [
    { key: 'code', label: 'IBP Code' },
    { key: 'name', label: 'Project Name' },
    { key: 'vote', label: 'Vote' },
    { key: 'department', label: 'Department' },
    { key: 'fy', label: 'Financial Year' },
    { key: 'phase', label: 'Phase' },
    { key: 'status', label: 'Status', render: r => <IbpStatusBadge status={r.status} /> },
    {
      key: 'cost_ugx_bn', label: 'Cost (UGX Bn)', numeric: true,
      render: r => typeof r.cost_ugx_bn === 'number'
        ? r.cost_ugx_bn.toLocaleString(undefined, { maximumFractionDigits: 1 })
        : <span style={NULL_ZERO_STYLE}>No data</span>,
    },
    { key: 'last_submission_date', label: 'Last Submitted' },
  ], []);

  const maintLinks = maint?.links ?? [];
  const maintFYs = useMemo(
    () => [...new Set(maintLinks.map(l => l.scheduled_fy).filter((v): v is string => !!v))].sort(),
    [maintLinks],
  );
  const maintRows = useMemo(
    () => maintFY === 'all' ? maintLinks : maintLinks.filter(l => l.scheduled_fy === maintFY),
    [maintLinks, maintFY],
  );
  const maintColumns: STColumn<MaintenanceLink>[] = useMemo(() => [
    { key: 'road_no', label: 'Road No' },
    { key: 'link_name', label: 'Link Name' },
    { key: 'region', label: 'Region' },
    { key: 'surface_type', label: 'Surface' },
    { key: 'length_km', label: 'Length (km)', numeric: true, render: r => r.length_km?.toLocaleString(undefined, { maximumFractionDigits: 1 }) },
    {
      key: 'vci_pct', label: 'VCI (%)', numeric: true,
      render: r => typeof r.vci_pct === 'number'
        ? `${r.vci_pct.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${r.vci_rating ?? '—'})`
        : <span style={NULL_ZERO_STYLE}>No data</span>,
    },
    { key: 'recommended_intervention', label: 'Recommended Intervention' },
    { key: 'priority_band', label: 'Priority Band', render: r => <PriorityBandBadge band={r.priority_band} /> },
    { key: 'priority_score', label: 'Priority Score', numeric: true, render: r => typeof r.priority_score === 'number' ? r.priority_score.toLocaleString(undefined, { maximumFractionDigits: 1 }) : <span style={NULL_ZERO_STYLE}>No data</span> },
    { key: 'scheduled_fy', label: 'Scheduled FY' },
    {
      key: 'indicative_base_cost_ugx_bn', label: 'Cost (UGX Bn)', numeric: true,
      render: r => typeof r.indicative_base_cost_ugx_bn === 'number'
        ? r.indicative_base_cost_ugx_bn.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : <span style={NULL_ZERO_STYLE}>No data</span>,
    },
    {
      key: 'asset_value_at_risk_ugx_bn', label: 'Asset Value at Risk (UGX Bn)', numeric: true,
      render: r => typeof r.asset_value_at_risk_ugx_bn === 'number'
        ? r.asset_value_at_risk_ugx_bn.toLocaleString(undefined, { maximumFractionDigits: 1 })
        : <span style={NULL_ZERO_STYLE}>No data</span>,
    },
  ], []);

  const workplanByFY = useMemo(() => {
    const rows = maint?.annual_maintenance_workplan ?? [];
    const fys = [...new Set(rows.map(r => r.fy))];
    const cats = [...new Set(rows.filter(r => r.category !== 'TOTAL').map(r => r.category))];
    return cats.map(cat => {
      const rec: Record<string, string | number> = { category: cat };
      for (const fy of fys) {
        rec[fy] = rows.find(r => r.fy === fy && r.category === cat)?.planned_exp_ugx_bn ?? 0;
      }
      return rec;
    });
  }, [maint]);
  const workplanFYs = useMemo(
    () => [...new Set((maint?.annual_maintenance_workplan ?? []).map(r => r.fy))],
    [maint],
  );

  return (
    <div style={{ padding: '20px 18px', minHeight: '100%' }}>
      <ModuleNavBar module="PIM" />
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10,
            background: `linear-gradient(135deg, rgba(${hexRgb(C.yellow)},0.25), rgba(${hexRgb(C.orange)},0.1))`,
            border: `1px solid rgba(${hexRgb(C.yellow)},0.4)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={16} style={{ color: C.yellow }}/>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#e2eaf4' }}>Public Investment Management</div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.65)', marginTop: 1 }}>
              Uganda national roads financing · PPPs · donor frameworks · NDP IV investment plan
            </div>
          </div>
        </div>
        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 14 }}>
          {[
            { label: 'FY24/25 Budget', value: 'UGX 3.2T', sub: 'Roads & Bridges', color: C.yellow },
            { label: 'Donor Share', value: '50%', sub: 'of capital budget', color: C.blue },
            { label: 'Active PPPs', value: '2', sub: '+ 3 in pipeline', color: C.green },
            // Reconciled to the DNR GIS Jun 2025 official network figure (6,405 km paved /
            // 21,302 km total, 30.1% paved) used throughout the app - see TabularSummaries.tsx
            // netStats and Projects > NDP IV card. The prior "12,000km" value didn't match this
            // table's own baseline (5,400km 2020/21) or ~240km/yr paving rate, and coincided
            // exactly with DUCAR's unrelated "12,000 km community roads" figure - almost
            // certainly a copy/paste mix-up between two different road classes.
            { label: 'NDP IV Target', value: '6,405km', sub: 'paved by 2025/26 (30.1% of network)', color: C.cyan },
          ].map(k => (
            <div key={k.label} style={{ background: `rgba(${hexRgb(k.color)},0.06)`,
              border: `1px solid rgba(${hexRgb(k.color)},0.2)`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.5)', marginTop: 4, textTransform: 'uppercase' }}>{k.label}</div>
              <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.5)' }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BMS-style tab bar ── */}
      {!hideTabBar && (
        <div style={{
        display: 'flex', gap: 2, marginBottom: 18, flexShrink: 0,
        borderBottom: '1px solid rgba(77, 159, 255,0.15)',
        background: 'rgba(8,8,8,0.85)', marginLeft: -20, marginRight: -20, paddingLeft: 14,
      }}>
        {TABS.map(t => {
          const isA = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px 11px', fontSize: 11, fontWeight: isA ? 800 : 500,
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              color: isA ? '#4d9fff' : 'rgba(148,163,184,0.70)',
              borderBottom: isA ? '2px solid #4d9fff' : '2px solid transparent',
              transition: 'all 0.13s',
            }}>{t.icon} {t.label}</button>
          );
        })}
      </div>
      )}

      {tab === 'dashboard' && <SectionDashboard sectionId="pim" accent={C.yellow} />}

      {/* PIM Framework */}
      {tab === 'pim' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={card(C.yellow)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.yellow, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Uganda Public Investment Management Cycle - Roads Sector
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PIM_FRAMEWORK.map((s, i) => (
                <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 14,
                  background: `rgba(${hexRgb(s.color)},0.05)`,
                  border: `1px solid rgba(${hexRgb(s.color)},0.18)`, borderRadius: 9, padding: '10px 14px' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: `rgba(${hexRgb(s.color)},0.15)`,
                    border: `1px solid rgba(${hexRgb(s.color)},0.3)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 900, color: s.color }}>{i+1}</div>
                  <div style={{ minWidth: 160, fontWeight: 800, fontSize: 11, color: s.color }}>{s.stage}</div>
                  <div style={{ minWidth: 140, fontSize: 10, color: 'rgba(148,163,184,0.65)' }}>{s.body}</div>
                  <div style={{ fontSize: 10, color: 'rgba(196,210,225,0.75)', flex: 1 }}>{s.tools}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={card(C.blue)}>
              <div style={{ fontSize: 10, fontWeight: 900, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Key Legal Framework</div>
              {[
                'Public Finance Management Act, 2015 (as amended)',
                'PPDA Act, 2003 (amended 2014) - Procurement',
                'National Roads Act, 2017 - Department of National Roads mandate',
                'Roads Act, Cap 358 - road classification',
                'PPP Act, 2015 - private finance framework',
                'National Environment Act, 2019 - ESIA requirements',
                'National Development Plan IV (2020/21–2025/26)',
                'Uganda Vision 2040 - long-term strategic goals',
              ].map(l => (
                <div key={l} style={{ fontSize: 10, color: 'rgba(196,210,225,0.75)', padding: '4px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)' }}>• {l}</div>
              ))}
            </div>
            <div style={card(C.green)}>
              <div style={{ fontSize: 10, fontWeight: 900, color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Key Institutions</div>
              {[
                { name: 'Department of National Roads', role: 'Implementing agency - national roads' },
                { name: 'MoWT', role: 'Policy, standards, district roads oversight' },
                { name: 'MFPED', role: 'Budget allocation, MTEF, donor coordination' },
                { name: 'NPA', role: 'National development plan formulation' },
                { name: 'PPDA', role: 'Procurement oversight and regulation' },
                { name: 'OAG', role: 'Value-for-money and performance audits' },
                { name: 'Parliament', role: 'Appropriation, oversight (Infrastructure Ctte)' },
              ].map(r => (
                <div key={r.name} style={{ display: 'flex', gap: 10, padding: '5px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: C.green, minWidth: 52 }}>{r.name}</span>
                  <span style={{ fontSize: 10, color: 'rgba(196,210,225,0.75)' }}>{r.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Budget & Maintenance Trends (merged: PIM budget trends + Budget & Maintenance module) */}
      {tab === 'budget' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Suspense fallback={<div style={{ padding: 24, color: 'rgba(148,163,184,0.7)', fontSize: 12 }}>Loading budget &amp; maintenance…</div>}>
            <BudgetSection embedded />
          </Suspense>

          <div style={{ fontSize: 13, fontWeight: 900, color: '#e2eaf4', marginTop: 4 }}>
            National Roads Maintenance Strategy (2026)
          </div>
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)', maxWidth: 900, marginTop: -8 }}>
            Uganda Road Fund (URF) routine/periodic maintenance funding and the network-wide maintenance priority register - not
            the full national roads capital budget (donor-funded new construction, upgrading and PPP expressway projects are
            tracked separately in the IBP Project Register tab above). Source: her 2026 Maintenance Strategy workbooks - the
            5-year FY26/27–FY30/31 forward strategy and 338-link priority register, plus real URF annual work plans (FY2024/25,
            FY2025/26) and regional disbursement (FY2023/24).
          </div>

          {maint && (
            <>
              {/* KPI strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  { label: 'Links Needing Intervention', value: maint.kpis.total_links.toLocaleString(), sub: 'Network-wide, FY26/27–FY30/31', color: C.yellow },
                  { label: '5-Year Programme Cost', value: `UGX ${maint.kpis.total_programme_cost_bn.toLocaleString(undefined, { maximumFractionDigits: 0 })} Bn`, sub: 'Indicative base cost', color: C.cyan },
                  { label: 'Asset Value at Risk', value: `UGX ${maint.kpis.asset_value_at_risk_bn.toLocaleString(undefined, { maximumFractionDigits: 0 })} Bn`, sub: 'If unaddressed', color: C.red },
                  { label: 'Reconstruction-Level Links', value: maint.kpis.reconstruction_links.toLocaleString(), sub: 'Most severe intervention tier', color: C.orange },
                ].map(k => (
                  <div key={k.label} style={{ background: `rgba(${hexRgb(k.color)},0.06)`,
                    border: `1px solid rgba(${hexRgb(k.color)},0.2)`, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.5)', marginTop: 4, textTransform: 'uppercase' }}>{k.label}</div>
                    <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.5)' }}>{k.sub}</div>
                  </div>
                ))}
              </div>

              <div style={card(C.cyan)}>
                <div style={{ fontSize: 11, fontWeight: 900, color: C.cyan, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                  5-Year Forward Maintenance Programme (FY26/27–FY30/31, UGX Bn)
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={maint.annual_programme} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3"/>
                    <XAxis dataKey="fy" tick={TK}/>
                    <YAxis tick={TK} label={{ value: 'UGX Bn', angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: 'rgba(148,163,184,0.5)' } }}/>
                    <Tooltip content={<CT/>}/>
                    <Legend wrapperStyle={{ fontSize: 10, color: 'rgba(148,163,184,0.7)' }}/>
                    <Bar dataKey="programme_cost_bn" name="Programme Cost" fill={C.cyan} radius={[4,4,0,0]}/>
                    <Bar dataKey="funding_gap_bn" name="Funding Gap" fill={C.red} radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={card(C.yellow)}>
                <div style={{ fontSize: 11, fontWeight: 900, color: C.yellow, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                  URF Annual Maintenance Work Plan by Category (UGX Bn)
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={workplanByFY} layout="vertical" margin={{ top: 8, right: 20, left: 10, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3"/>
                    <XAxis type="number" tick={TK}/>
                    <YAxis type="category" dataKey="category" tick={{ ...TK, fontSize: 9 }} width={190}/>
                    <Tooltip content={<CT/>}/>
                    <Legend wrapperStyle={{ fontSize: 10, color: 'rgba(148,163,184,0.7)' }}/>
                    {workplanFYs.map((fy, i) => (
                      <Bar key={fy} dataKey={fy} name={fy} fill={[C.yellow, C.blue, C.green][i % 3]} radius={[0,4,4,0]}/>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={card(C.green)}>
                <div style={{ fontSize: 11, fontWeight: 900, color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                  Regional Maintenance Disbursement, FY2023/24 (UGX Bn)
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={maint.regional_disbursement_2023_24_summary} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3"/>
                    <XAxis dataKey="region" tick={{ ...TK, fontSize: 8 }} angle={-20} textAnchor="end"/>
                    <YAxis tick={TK}/>
                    <Tooltip content={<CT/>}/>
                    <Bar dataKey="disbursed_ugx_bn" name="Disbursed" fill={C.green} radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ fontSize: 13, fontWeight: 900, color: '#e2eaf4', marginTop: 4 }}>
                Network-Wide Maintenance Priority Register ({maint.kpis.total_links} links)
              </div>

              {/* Scheduled-FY buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(['all', ...maintFYs]).map(fy => {
                  const isActive = fy === maintFY;
                  const n = fy === 'all' ? maintLinks.length : maintLinks.filter(l => l.scheduled_fy === fy).length;
                  return (
                    <button key={fy} onClick={() => setMaintFY(fy)} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 13px', fontSize: 11, fontWeight: isActive ? 800 : 600,
                      borderRadius: 999, cursor: 'pointer',
                      background: isActive ? `rgba(${hexRgb(C.cyan)},0.18)` : 'rgba(255,255,255,0.04)',
                      border: isActive ? `1px solid rgba(${hexRgb(C.cyan)},0.55)` : '1px solid rgba(255,255,255,0.08)',
                      color: isActive ? C.cyan : 'rgba(148,163,184,0.75)',
                      transition: 'all 0.13s',
                    }}>
                      {fy === 'all' ? 'All Years' : fy}
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999,
                        background: isActive ? `rgba(${hexRgb(C.cyan)},0.25)` : 'rgba(255,255,255,0.06)',
                        color: isActive ? C.cyan : 'rgba(148,163,184,0.6)',
                      }}>{n}</span>
                    </button>
                  );
                })}
              </div>

              <SortableFilterableTable
                accent={C.cyan}
                exportName={`maintenance-priority-register${maintFY === 'all' ? '' : `-${maintFY.replace('/', '-')}`}`}
                columns={maintColumns}
                rows={maintRows}
                emptyText="No links scheduled in this financial year."
              />
            </>
          )}
        </div>
      )}

      {/* PPP Projects */}
      {tab === 'ppp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PPP_PROJECTS.map(p => (
            <div key={p.name} style={{ background: `rgba(${hexRgb(p.color)},0.05)`,
              border: `1px solid rgba(${hexRgb(p.color)},0.2)`, borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: p.color, marginBottom: 3 }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.65)' }}>{p.funder}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, padding: '3px 10px', borderRadius: 5, fontWeight: 800,
                    background: `rgba(${hexRgb(p.color)},0.12)`, color: p.color }}>{p.status}</span>
                  <span style={{ fontSize: 9, padding: '3px 10px', borderRadius: 5, fontWeight: 800,
                    background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>{p.length_km} km</span>
                  <span style={{ fontSize: 9, padding: '3px 10px', borderRadius: 5, fontWeight: 800,
                    background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>USD {p.value_usd_m}M</span>
                </div>
              </div>
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)' }}>Model: <span style={{ color: '#d4dde8', fontWeight: 600 }}>{p.model}</span></div>
                <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)' }}>{p.notes}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Donor Funding */}
      {tab === 'donor' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={card(C.blue)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Capital Budget Share by Funding Source (FY2024/25)
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={DONOR_BREAKDOWN} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={renderSliceLabel} labelLine={{ stroke: 'rgba(148,163,184,0.4)' }}>
                  {DONOR_BREAKDOWN.map((d, i) => <Cell key={i} fill={d.color}/>)}
                </Pie>
                <Tooltip content={<CT/>}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={card(C.green)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Donor Profiles - National Roads
            </div>
            {[
              { donor: 'World Bank / IDA', share: '28%', focus: 'Rehabilitation, connectivity, OPRC maintenance', active: '4 operations' },
              { donor: 'African Dev. Bank', share: '22%', focus: 'Northern Uganda, border roads, bridges', active: '3 operations' },
              { donor: 'JICA (Japan)',      share: '15%', focus: 'Northern corridor, Tanzania links', active: '2 operations' },
              { donor: 'China EXIM Bank',   share: '18%', focus: 'Expressways, urban roads, financing package', active: '2 operations' },
              { donor: 'OPEC Fund',         share: '3%',  focus: 'Rural roads complementary finance', active: '1 operation' },
              { donor: 'KfW / EU',          share: '2%',  focus: 'Climate adaptation, rural access', active: '1 operation' },
            ].map(d => (
              <div key={d.donor} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#d4dde8' }}>{d.donor}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: C.yellow }}>{d.share}</span>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)' }}>{d.focus} · {d.active}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NDP IV Targets */}
      {tab === 'ndpiv' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={card(C.green)}>
            <div style={{ fontSize: 11, fontWeight: 900, color: C.green, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              NDP IV National Roads Targets (2020/21–2025/26)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 18 }}>
              {[
                // See KPI strip comment above: reconciled to the official 6,405km paved figure
                // (DNR GIS Jun 2025 / TabularSummaries netStats), matching ProjectsView's NDP IV
                // card ("Current baseline: ~30.3% / 6,405 km") for the same FY2025/26 milestone.
                { target: '6,405 km', desc: 'Paved national roads by 2025/26', base: '5,400 km (2020/21)', color: C.cyan },
                { target: '95%',       desc: 'National roads in good/fair condition', base: '72% (2020/21)', color: C.green },
                { target: '2,500 km',  desc: 'New roads to be paved', base: 'Upgrading from gravel', color: C.yellow },
                { target: '240 km/yr', desc: 'Annual paving programme', base: 'Average delivery target', color: C.orange },
                { target: '50%',       desc: 'Roads in good condition (IRI <4)', base: '38% (2020/21)', color: C.blue },
                { target: '100%',      desc: 'Structures inspected annually', base: 'BMS target', color: C.purple },
              ].map(t => (
                <div key={t.target} style={{ background: `rgba(${hexRgb(t.color)},0.06)`,
                  border: `1px solid rgba(${hexRgb(t.color)},0.2)`, borderRadius: 9, padding: '12px 14px' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: t.color, lineHeight: 1 }}>{t.target}</div>
                  <div style={{ fontSize: 10, color: '#d4dde8', fontWeight: 600, marginTop: 4 }}>{t.desc}</div>
                  <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.6)', marginTop: 2 }}>Baseline: {t.base}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
              Source: Uganda NDP IV (2020/21–2025/26) Chapter 5 - Infrastructure. Department of National Roads Performance Contract 2024/25.
              Vision 2040 long-term target: 17,000 km paved national road network.
            </div>
          </div>
        </div>
      )}

      {/* IBP Project Register */}
      {tab === 'ibp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#e2eaf4' }}>Integrated Bank of Projects (IBP) - National Portfolio</div>
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)', maxWidth: 900 }}>
            Every Uganda National Roads Authority and Ministry of Works and Transport vote-level project registered in IBP, matched by
            government Vote rather than by keyword - so a small number of non-road MoWT entries (airports, rail, port and aviation-training
            projects) remain visible via the Vote/Department columns rather than being silently filtered out. Source: Integrated Bank of
            Projects, Ministry of Finance, Planning &amp; Economic Development (ibp.finance.go.ug). Financial Year = the real Ugandan FY
            (Jul–Jun) each project's most recent IBP submission falls in.
          </div>

          {/* Financial-year buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(['all', ...ibpFYs]).map(fy => {
              const isActive = fy === ibpFY;
              const n = fy === 'all' ? ibpProjects.length : ibpProjects.filter(p => p.fy === fy).length;
              return (
                <button key={fy} onClick={() => setIbpFY(fy)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 13px', fontSize: 11, fontWeight: isActive ? 800 : 600,
                  borderRadius: 999, cursor: 'pointer',
                  background: isActive ? `rgba(${hexRgb(C.yellow)},0.18)` : 'rgba(255,255,255,0.04)',
                  border: isActive ? `1px solid rgba(${hexRgb(C.yellow)},0.55)` : '1px solid rgba(255,255,255,0.08)',
                  color: isActive ? C.yellow : 'rgba(148,163,184,0.75)',
                  transition: 'all 0.13s',
                }}>
                  {fy === 'all' ? 'All Years' : fy}
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999,
                    background: isActive ? `rgba(${hexRgb(C.yellow)},0.25)` : 'rgba(255,255,255,0.06)',
                    color: isActive ? C.yellow : 'rgba(148,163,184,0.6)',
                  }}>{n}</span>
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)' }}>
            {ibpRows.length} project{ibpRows.length === 1 ? '' : 's'} ·{' '}
            {ibpRows.reduce((s, p) => s + (p.cost_ugx_bn || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} UGX Bn total appraised cost
            {ibpFY !== 'all' ? ` · ${ibpFY}` : ' · all years on record'}
          </div>

          <SortableFilterableTable
            accent={C.yellow}
            exportName={`ibp-portfolio${ibpFY === 'all' ? '' : `-${ibpFY.replace('/', '-')}`}`}
            columns={ibpColumns}
            rows={ibpRows}
            emptyText="No IBP projects submitted in this financial year."
          />
        </div>
      )}
    </div>
  );
}
