import { lazy, Suspense, useState } from 'react';
const BudgetSection = lazy(() => import('../Budget/BudgetSection'));
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { DollarSign, Globe, Building2, TrendingUp, FileText, LayoutDashboard } from 'lucide-react';
import { ModuleNavBar } from '../../shared/ModuleNavBar';
import SectionDashboard from '../Dashboard/SectionDashboard';

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
const BUDGET_BY_YEAR = [
  { fy: '2015/16', roads: 1420, bridges: 180, total: 1600, donor: 680, gou: 920 },
  { fy: '2016/17', roads: 1580, bridges: 210, total: 1790, donor: 820, gou: 970 },
  { fy: '2017/18', roads: 1750, bridges: 240, total: 1990, donor: 980, gou: 1010 },
  { fy: '2018/19', roads: 1890, bridges: 260, total: 2150, donor: 1050, gou: 1100 },
  { fy: '2019/20', roads: 2020, bridges: 290, total: 2310, donor: 1200, gou: 1110 },
  { fy: '2020/21', roads: 1680, bridges: 220, total: 1900, donor: 850, gou: 1050 },
  { fy: '2021/22', roads: 2100, bridges: 310, total: 2410, donor: 1250, gou: 1160 },
  { fy: '2022/23', roads: 2380, bridges: 340, total: 2720, donor: 1380, gou: 1340 },
  { fy: '2023/24', roads: 2560, bridges: 380, total: 2940, donor: 1490, gou: 1450 },
  { fy: '2024/25', roads: 2780, bridges: 420, total: 3200, donor: 1600, gou: 1600 },
];

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
    funder: 'PPP — GoU + Private consortium',
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
] as const;
type TabId = typeof TABS[number]['id'];

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

export default function PublicInvestmentSection() {
  const [tab, setTab] = useState<TabId>('dashboard');

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
            { label: 'NDP IV Target', value: '12,000km', sub: 'paved by 2025/26', color: C.cyan },
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

      {/* Single navigation layer: Dashboard | Interactive Map | Exhaustive Tables | Deep Analytics | SQL Database & Schema | Data Capture (rendered inside SectionDashboard) */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <SectionDashboard sectionId="pim" accent={C.yellow} />
      </div>

    </div>
  );
}
