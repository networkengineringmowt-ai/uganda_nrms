/**
 * SectionDashboard — matches the RMS Overview visual style.
 * Every section's Dashboard tab shows:
 *   1. A section-specific definition card (same as RMSDashboard in RMSSection)
 *   2. SeamlessDashboardFrame iframe (public/dashboard.html — 7-tab comprehensive view)
 */
import React, { useRef, useEffect } from 'react';
import {
  Shield, Layers, Activity, BarChart2, Map, BookOpen,
  TrendingUp, Settings, Wrench, MapPin, Video,
  Briefcase, Globe, Link2, Network,
} from 'lucide-react';

const A = {
  cyan:   '#00f5ff',
  green:  '#00ff88',
  yellow: '#ffd23f',
  purple: '#b967ff',
  orange: '#ff6b35',
  teal:   '#00d4aa',
  pink:   '#ff2d78',
  blue:   '#4d9fff',
} as const;

function rgb(hex: string): string {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)].join(',');
}

interface Def { title: string; desc: React.ReactNode; chips: string[]; icon: React.ReactNode; accent: string; }

const DEFS: Record<string, Def> = {
  rms: {
    title: 'Road Management System (RMS)',
    desc: (<>The <strong style={{ color: A.cyan }}>DNR Road Management Engine</strong> is Uganda's integrated platform for the <em>planning, programming, budgeting, maintenance, and monitoring</em> of road network assets throughout their life cycle, incorporating Pavement Management (PMS), Bridge Management (BMS), Traffic Information (TIS), Investment Planning (NDPIV), Output-based Contracts (OPRC), Life Cycle Cost Analysis, Budget Optimisation, and Analytics.</>),
    chips: ['ISO 55001 Aligned','HDM-4 Powered','GIS Integrated','ML-Enhanced','AfDB / World Bank Compliant'],
    icon: <Shield size={20} />, accent: A.cyan,
  },
  pms: {
    title: 'Pavement Management System (PMS)',
    desc: (<>Monitors and analyses the condition of all paved and unpaved surfaces on Uganda's national road network. Integrates <strong style={{ color: A.green }}>IRI roughness surveys</strong>, rutting measurements, visual distress data and HDM-4 deterioration models to generate prioritised maintenance and rehabilitation programmes.</>),
    chips: ['IRI Roughness Monitoring','HDM-4 Powered','GIS Integrated','Condition-Based'],
    icon: <Layers size={20} />, accent: A.green,
  },
  roadcondition: {
    title: 'Road Condition Assessment',
    desc: (<>Real-time and historic condition ratings across the national network, integrating ROMDAS survey data, drone inspections and GIS overlays. Supports <strong style={{ color: A.green }}>asset performance benchmarking</strong> and defect-triggered maintenance planning.</>),
    chips: ['ROMDAS Integrated','GIS Overlays','Real-Time Data','Multi-Modal Survey'],
    icon: <Activity size={20} />, accent: A.green,
  },
  bms: {
    title: 'Bridge Management System (BMS)',
    desc: (<>Inventories and inspects all bridges, culverts and drainage structures on the national road network. Tracks <strong style={{ color: A.purple }}>structural health, maintenance history, load ratings</strong> and repair costs, supporting risk-based prioritisation under DNR's bridge lifecycle programme.</>),
    chips: ['Structural Health Monitoring','Load Rating','Photo-Twin Enabled','NBMS Aligned'],
    icon: <Link2 size={20} />, accent: A.purple,
  },
  traffic: {
    title: 'Traffic Information System (TIS)',
    desc: (<>Collects, processes and reports <strong style={{ color: A.yellow }}>traffic volume counts, vehicle classification, axle-load data</strong> and speed profiles from Automatic Traffic Counters and weigh-in-motion stations across key corridors. Feeds ESA computations and road-safety analytics.</>),
    chips: ['ATC Network','WIM Stations','ESA Computation','Corridor Analysis'],
    icon: <Activity size={20} />, accent: A.yellow,
  },
  atc: {
    title: 'Automatic Traffic Counter (ATC)',
    desc: (<>Manages the network of permanent and portable <strong style={{ color: A.yellow }}>Automatic Traffic Counters</strong> deployed on the national road network. Provides classified traffic volumes, seasonal factors, growth trends and vehicle-mix profiles used in pavement and infrastructure design.</>),
    chips: ['Permanent ATC Stations','Portable Units','Seasonal Factors','Growth Modelling'],
    icon: <Activity size={20} />, accent: A.yellow,
  },
  ntis: {
    title: 'National Transport Information System (NTIS)',
    desc: (<>The <strong style={{ color: A.blue }}>geospatial intelligence hub</strong> integrating road network geometry, traffic flows, pavement condition, bridge inventory and infrastructure programme data into a unified GIS-driven view for strategic planning and donor reporting.</>),
    chips: ['Geospatial Hub','Multi-Layer GIS','Donor Reporting','Real-Time Feeds'],
    icon: <Globe size={20} />, accent: A.blue,
  },
  npms: {
    title: 'National Pavement Management System (NPMS)',
    desc: (<>National-level pavement performance monitoring integrating road condition surveys, <strong style={{ color: A.green }}>HDM-4 models</strong> and budget scenarios to produce long-term network performance forecasts and optimal maintenance strategies across all road classes.</>),
    chips: ['Network-Wide','HDM-4 Models','Budget Scenarios','Performance Forecasting'],
    icon: <Layers size={20} />, accent: A.green,
  },
  nbms: {
    title: 'National Bridge Management System (NBMS)',
    desc: (<>Consolidated inventory and inspection platform for all national bridges. Integrates structural assessments, routine inspection records and maintenance histories to support <strong style={{ color: A.purple }}>evidence-based bridge rehabilitation</strong> planning and donor reporting.</>),
    chips: ['National Inventory','Structural Assessment','Inspection Records','Donor Reporting'],
    icon: <Link2 size={20} />, accent: A.purple,
  },
  network: {
    title: 'Network Section',
    desc: (<>Manages the <strong style={{ color: A.cyan }}>classified national road network database</strong> including geometry, administrative boundaries, road hierarchy and historical changes. Provides the authoritative asset register underpinning all RMS modules.</>),
    chips: ['Asset Register','Network Hierarchy','GIS Geometry','Classified Network'],
    icon: <Network size={20} />, accent: A.cyan,
  },
  roadreserve: {
    title: 'Road Reserve Management',
    desc: (<>Monitors and enforces statutory road reserve corridors on national roads. Tracks <strong style={{ color: A.orange }}>encroachments</strong>, records demarcation surveys, manages utility-crossing permits and generates compliance reports for legal enforcement.</>),
    chips: ['Corridor Demarcation','Encroachment Tracking','Utility Permits','Compliance Reporting'],
    icon: <MapPin size={20} />, accent: A.orange,
  },
  gisenterprise: {
    title: 'GIS Enterprise Platform',
    desc: (<>Enterprise spatial data infrastructure underpinning all RMS modules. Maintains <strong style={{ color: A.blue }}>authoritative layers</strong> for roads, bridges, stations, land use and administrative boundaries, with real-time syncing to ArcGIS Online and field data-collection apps.</>),
    chips: ['ArcGIS Enterprise','Real-Time Sync','Field Apps','Authoritative Layers'],
    icon: <Map size={20} />, accent: A.blue,
  },
  bridgeworks: {
    title: 'Bridge Works Programme',
    desc: (<>Tracks design, procurement and construction progress for all national <strong style={{ color: A.purple }}>bridge rehabilitation and new-build projects</strong>. Links physical inspection records with contract status, expenditure and completion milestones.</>),
    chips: ['Project Tracking','Contract Management','Physical Progress','Expenditure Monitoring'],
    icon: <Wrench size={20} />, accent: A.purple,
  },
  pim: {
    title: 'Public Investment Management (PIM)',
    desc: (<>Manages the <strong style={{ color: A.orange }}>NDPIV-aligned capital investment pipeline</strong> for national road infrastructure. Integrates project appraisal, multi-year budget forecasts, donor-funding profiles and output-based contract performance data.</>),
    chips: ['NDPIV Aligned','Capital Investment','Donor Funding','OPRC Performance'],
    icon: <Briefcase size={20} />, accent: A.orange,
  },
  budget: {
    title: 'Budget & Finance Management',
    desc: (<>Tracks annual and multi-year budget allocations, releases and expenditure against maintenance and rehabilitation programmes across all national road <strong style={{ color: A.orange }}>maintenance zones and projects</strong>. Supports IFMS reconciliation and donor reporting.</>),
    chips: ['IFMS Integration','Multi-Year Budget','Zone-Level Tracking','Donor Reporting'],
    icon: <BarChart2 size={20} />, accent: A.orange,
  },
  lifecycle: {
    title: 'Lifecycle Cost Analysis',
    desc: (<>Evaluates the <strong style={{ color: A.teal }}>whole-life cost of road asset interventions</strong> using HDM-4 models and NPV analysis. Supports evidence-based selection between maintenance, rehabilitation and reconstruction options across the network.</>),
    chips: ['HDM-4 Models','NPV Analysis','Whole-Life Cost','Evidence-Based Selection'],
    icon: <TrendingUp size={20} />, accent: A.teal,
  },
  roadatlas: {
    title: 'Road Atlas',
    desc: (<>Interactive digital atlas of Uganda's national road network, providing <strong style={{ color: A.blue }}>classified route sheets, bridge schedules, chainage markers</strong> and administrative mapping for field operations, planning and public communication.</>),
    chips: ['Route Sheets','Bridge Schedules','Chainage Markers','Administrative Maps'],
    icon: <Map size={20} />, accent: A.blue,
  },
  roadvideo: {
    title: 'Road Video Library',
    desc: (<>Archive of pavement condition video collected by ROMDAS survey vehicles and drone flights. Links <strong style={{ color: A.yellow }}>kilometre-referenced video</strong> to condition data, enabling virtual inspection and audit of road surfaces across the national network.</>),
    chips: ['ROMDAS Video','Drone Footage','Km-Referenced','Virtual Inspection'],
    icon: <Video size={20} />, accent: A.yellow,
  },
  projects: {
    title: 'Projects & Works',
    desc: (<>Consolidated view of all active and planned maintenance, rehabilitation and capital-works contracts on the national road network. Tracks <strong style={{ color: A.teal }}>procurement status, contractor performance</strong>, physical progress and financial expenditure.</>),
    chips: ['Contract Management','Procurement Tracking','Physical Progress','Contractor Performance'],
    icon: <Briefcase size={20} />, accent: A.teal,
  },
  casestudies: {
    title: 'Global Case Studies',
    desc: (<>Curated library of <strong style={{ color: A.pink }}>international best-practice case studies</strong> in road asset management, covering pavement performance, bridge maintenance strategies, traffic management and public-investment frameworks from Africa, Asia and OECD countries.</>),
    chips: ['International Best Practice','Asset Management','Policy Frameworks','Benchmarking'],
    icon: <BookOpen size={20} />, accent: A.pink,
  },
  admin: {
    title: 'Admin — Sources & Evidence',
    desc: (<>System administration hub for the Uganda NRMS. Manages <strong style={{ color: A.cyan }}>user roles, data-source configurations, audit logs, SQL schema documentation</strong> and evidence trails for all RMS data submissions and revisions.</>),
    chips: ['Role Management','Audit Logs','SQL Schema','Data Provenance'],
    icon: <Settings size={20} />, accent: A.cyan,
  },
  hdm4: {
    title: 'HDM-4 Analysis',
    desc: (<>Runs <strong style={{ color: A.teal }}>HDM-4 model simulations</strong> to forecast long-term pavement deterioration, compute road user costs and generate optimised multi-year maintenance programme recommendations aligned to Uganda's annual road fund allocations.</>),
    chips: ['HDM-4 Modelling','Deterioration Forecasting','Road User Costs','Programme Optimisation'],
    icon: <TrendingUp size={20} />, accent: A.teal,
  },
};

function Chip({ label, color }: { label: string; color: string }) {
  const r = rgb(color);
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
      color: `rgb(${r})`, background: `rgba(${r},0.12)`,
      border: `1px solid rgba(${r},0.3)`, borderRadius: 6, padding: '3px 9px',
    }}>{label}</span>
  );
}

function DashboardIframe() {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const iv = window.setInterval(() => {
      try {
        const el = ref.current;
        const doc = el?.contentDocument;
        if (el && doc) { const h = doc.body?.scrollHeight; if (h && h > 100) el.style.height = h + 'px'; }
      } catch {}
    }, 700);
    return () => clearInterval(iv);
  }, []);
  return (
    <iframe ref={ref}
      src={`${import.meta.env.BASE_URL}dashboard.html?${'v'}=${Date.now()}`}
      title="NRMS Live Dashboard" scrolling="no"
      style={{ display: 'block', width: '100%', height: '80vh', border: 'none',
        overflow: 'hidden', borderTop: '1px solid rgba(0,245,255,0.15)', background: '#020202' }} />
  );
}

export default function SectionDashboard({ sectionId, accent }: { sectionId: string; accent: string }) {
  const def = DEFS[sectionId] ?? DEFS.rms;
  const acc = def.accent || accent;
  const r = rgb(acc);
  return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{
        background: `rgba(${r},0.04)`, border: `1px solid rgba(${r},0.15)`,
        borderRadius: 14, padding: '16px 22px', marginBottom: 22,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: `linear-gradient(135deg,rgba(${r},0.2),rgba(0,0,0,0))`,
            border: `1px solid rgba(${r},0.3)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: acc,
          }}>{def.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#e2eaf4' }}>{def.title} — Definition</div>
            <div style={{ fontSize: 12, color: 'rgba(203,213,225,0.8)', lineHeight: 1.7, marginTop: 6 }}>{def.desc}</div>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {def.chips.map(t => <Chip key={t} label={t} color={acc} />)}
            </div>
          </div>
        </div>
      </div>
      <DashboardIframe />
    </div>
  );
}
