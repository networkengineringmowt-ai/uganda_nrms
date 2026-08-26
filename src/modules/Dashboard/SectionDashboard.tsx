import { useState, useEffect, lazy, Suspense } from 'react';
import { setActiveSubTab } from '../../shared/activeSubTabStore';

/* ── Section metadata ─────────────────────────────────────────────────────── */
const DEFS: Record<string, { title: string; body: string; icon: string }> = {
  rms:          { icon: '🔧', title: 'Road Maintenance System',             body: 'Tracks maintenance activities, work orders, and road condition improvement across the national road network.' },
  pms:          { icon: '📐', title: 'Pavement Management System',          body: 'IRI-based pavement condition surveys, roughness analysis, and treatment recommendations for Uganda\'s classified roads.' },
  roadcondition:{ icon: '🛣',  title: 'Road Condition Assessment',           body: 'Visual and instrumental road condition data including cracking, rutting, potholing, and surface distress indices.' },
  bms:          { icon: '🌉', title: 'Bridge Management System',             body: 'Inventory, structural inspection reports, load ratings, and maintenance prioritisation for bridges and culverts.' },
  traffic:      { icon: '🚦', title: 'Traffic Information System',           body: 'Automatic Traffic Counter data, AADT computation, vehicle classification, and seasonal adjustment factors.' },
  atc:          { icon: '📡', title: 'ATC Station Network',                  body: '25 Automatic Traffic Counters (15 legacy + 10 new) providing real-time classified volume data across the national road network.' },
  ntis:         { icon: '📈', title: 'National Traffic Information System',  body: 'AADT trends, growth forecasting, axle-load monitoring, and road safety analysis for Uganda\'s national corridors.' },
  npms:         { icon: '🗺',  title: 'National PMS',                         body: 'Strategic-level pavement performance indicators and network-wide condition distribution across all road classes.' },
  nbms:         { icon: '🗂',  title: 'National BMS',                         body: 'Consolidated bridge and structure data across all road agencies - UNRA, URF, district, and urban authorities.' },
  network:      { icon: '🌐', title: 'Road Network Overview',                body: 'The classified road network: national, district, urban, and community access roads, total extent and agency responsibilities.' },
  roadreserve:  { icon: '📏', title: 'Road Reserve Management',              body: 'Surveyed road reserve boundaries, encroachment detection, gazette status, and reserve width compliance monitoring.' },
  gisenterprise:{ icon: '🗺',  title: 'GIS Enterprise Platform',             body: 'Spatial data infrastructure, GIS layers, aerial imagery, and geospatial analysis tools for road asset management.' },
  bridgeworks:  { icon: '🏗',  title: 'Bridge Works Contracts',               body: 'Active and completed bridge construction and rehabilitation contracts, progress tracking, and financial performance.' },
  pim:          { icon: '📋', title: 'Project Information Management',       body: 'Capital investment project register, milestone tracking, contractor performance, and disbursement records.' },
  budget:       { icon: '💰', title: 'Budget Management',                    body: 'MTEF budget allocations, approved estimates, actual expenditure, and funding gap analysis by programme and road agency.' },
  lifecycle:    { icon: '♻',  title: 'Lifecycle Cost Analysis',              body: 'HDM-4 based life-cycle costing, NPV/BCR computation, and optimal maintenance strategy selection over a 20-year horizon.' },
  roadatlas:    { icon: '📖', title: 'Road Atlas',                           body: 'Official Uganda road atlas with classified inventory, road numbers, chainage references, and district-level statistics.' },
  roadvideo:    { icon: '🎥', title: 'Road Video Survey',                    body: 'Continuous video log survey footage referenced to road chainage, used for remote visual condition assessment.' },
  projects:     { icon: '🏛',  title: 'Projects & Programmes',                body: 'Capital, maintenance, and safety programmes funded by GOU, World Bank, AfDB, JICA, and other development partners.' },
  casestudies:  { icon: '📝', title: 'Case Studies',                         body: 'Documented project outcomes, best-practice engineering interventions, and value-for-money analyses.' },
  admin:        { icon: '⚙',  title: 'Administration',                       body: 'User management, access control, audit logs, system configuration, and the platform architecture mind map.' },
  hdm4:         { icon: '🔬', title: 'HDM-4 Analysis',                       body: 'Highway Development and Management model runs for road investment planning and budget optimisation.' },
  ducar:        { icon: '🌿', title: 'DUCAR Roads',                          body: 'District, Urban, Community Access Road network data - condition, coverage, and maintenance funding by local government.' },
  sources:      { icon: '📚', title: 'Sources & Evidence',                   body: 'Evidence catalogue, tabular summaries, and the platform data dictionary underpinning every figure shown across the site.' },
  downloads:    { icon: '⬇',  title: 'Downloads',                            body: 'Bulk exports of structures, road network, and survey data in CSV, KML, and GeoJSON formats.' },
  documents:    { icon: '📁', title: 'Document Store',                       body: 'Central repository of engineering drawings, survey reports, contracts, and reference documents across all road agencies.' },
  socioeconomic:{ icon: '🌍', title: 'Socio-Economic Analysis',              body: 'Population, land use, agriculture, and economic indicators mapped against the road network to inform investment prioritisation.' },
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── Signature block - the rich, chart-heavy per-section dashboards that     */
/* ── already live under ./sections (Recharts, definition cards, no tables)   */
/* ─────────────────────────────────────────────────────────────────────────── */
const LazyMaintenance = lazy(() => import('./sections/MaintenanceDashboard'));
const LazyPriority    = lazy(() => import('./sections/PriorityDashboard'));
const LazyDrainage    = lazy(() => import('./sections/DrainageDashboard'));
const LazyNetworkOverview    = lazy(() => import('./sections/NetworkOverviewDashboard'));
const LazyPavementOverview   = lazy(() => import('./sections/PavementOverviewDashboard'));
const LazyTrafficOverview    = lazy(() => import('./sections/TrafficOverviewDashboard'));
const LazyStructuresOverview = lazy(() => import('./sections/StructuresOverviewDashboard'));
const LazyBudgetOverview     = lazy(() => import('./sections/BudgetOverviewDashboard'));
const LazyProjectsOverview   = lazy(() => import('./sections/ProjectsOverviewDashboard'));
const LazyRoadSafetyOverview = lazy(() => import('./sections/RoadSafetyOverviewDashboard'));
const LazyRoadReserveOverview  = lazy(() => import('./sections/RoadReserveOverviewDashboard'));
const LazyNTISOverview         = lazy(() => import('./sections/NTISOverviewDashboard'));
const LazyGisEnterpriseOverview = lazy(() => import('./sections/GisEnterpriseOverviewDashboard'));
const LazyLifecycleOverview    = lazy(() => import('./sections/LifecycleOverviewDashboard'));
const LazyRoadAtlasOverview    = lazy(() => import('./sections/RoadAtlasOverviewDashboard'));
const LazyRoadVideoOverview    = lazy(() => import('./sections/RoadVideoOverviewDashboard'));
const LazyCaseStudiesOverview  = lazy(() => import('./sections/CaseStudiesOverviewDashboard'));
const LazyAdminOverview        = lazy(() => import('./sections/AdminOverviewDashboard'));
const LazySourcesOverview      = lazy(() => import('./sections/SourcesOverviewDashboard'));
const LazyDownloadsOverview    = lazy(() => import('./sections/DownloadsOverviewDashboard'));

function SectionSignatureBlock({ sectionId, accent }: { sectionId: string; accent: string }) {
  const C = sectionId === 'tis' ? LazyTrafficOverview
    : sectionId === 'pms' ? LazyPavementOverview
    : sectionId === 'bms' ? LazyStructuresOverview
    : sectionId === 'ducar' ? LazyMaintenance
    : sectionId === 'projects' ? LazyProjectsOverview
    : sectionId === 'rms' ? LazyNetworkOverview
    : sectionId === 'pim' ? LazyPriority
    : sectionId === 'budget' ? LazyBudgetOverview
    : sectionId === 'reserve' ? LazyRoadReserveOverview
    : sectionId === 'ntis' ? LazyNTISOverview
    : sectionId === 'gis' ? LazyGisEnterpriseOverview
    : sectionId === 'lifecycle' ? LazyLifecycleOverview
    : sectionId === 'roadatlas' ? LazyRoadAtlasOverview
    : sectionId === 'roadvideo' ? LazyRoadVideoOverview
    : sectionId === 'casestudies' ? LazyCaseStudiesOverview
    : sectionId === 'admin' ? LazyAdminOverview
    : sectionId === 'sources' ? LazySourcesOverview
    : sectionId === 'downloads' ? LazyDownloadsOverview
    : null;

  if (!C) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      <Suspense fallback={<div style={{ padding: 16, color: '#64748b', fontSize: 12 }}>Loading section dashboard…</div>}>
        <C />
        {sectionId === 'bms' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#38bdf8', margin: '10px 0 8px' }}>DRAINAGE STRUCTURES</div>
            <LazyDrainage />
          </>
        )}
      </Suspense>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── Section sub-tabs: Dashboard | Interactive Map | Exhaustive Tables |      */
/* ── Deep Analytics | SQL Database & Schema | Data Capture                   */
/* ─────────────────────────────────────────────────────────────────────────── */
import { InsightGrid } from './InsightGrid';
import { SchemaExplorer } from './SchemaExplorer';
import { SectionMap } from './SectionMap';
import { ExhaustiveTables } from './ExhaustiveTables';
import { DeepAnalysisTables } from './DeepAnalysisTables';

// Normalises a sidebar sectionId to the id used by ExhaustiveTables / DeepAnalysisTables
// / SchemaExplorer's underlying table specs, where the two differ.
const SECTION_ALIAS: Record<string, string> = {
  traffic: 'tis', atc: 'tis', condition: 'pms', roadcondition: 'pms', npms: 'pms',
  registry: 'bms', inspections: 'bms', bridgeworks: 'bms', nbms: 'bms',
  maintenance: 'ducar',
  roadreserve: 'reserve',
  gisenterprise: 'gis',
};

const SUBTABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'map', label: 'Interactive Map' },
  { id: 'tables', label: 'Exhaustive Tables' },
  { id: 'analytics', label: 'Deep Analytics' },
  { id: 'sql', label: 'SQL Database & Schema' },
  { id: 'capture', label: 'Data Capture' },
];
function SectionSubTabs({ sectionId, accent }: { sectionId: string; accent: string }) {
  const [tab, setTab] = useState('dashboard');
  const sid = SECTION_ALIAS[sectionId] ?? sectionId;
  // Every section uses the exact same six-tab bar, same order, no exceptions -
  // section-specific content (e.g. TIS Road Safety) lives inside one of these
  // fixed slots via SECTION_EXTRAS instead of adding its own tab.
  const tabs = SUBTABS;

  // Publish the visible tab (and which section it belongs to) so the
  // platform-wide Export menu in PageToolbar can offer formats relevant to
  // what's actually on screen - re-published on every tab click and whenever
  // the section itself changes (sidebar navigation resets to 'dashboard').
  useEffect(() => {
    const label = tabs.find(t => t.id === tab)?.label ?? 'Dashboard';
    setActiveSubTab({ tabId: tab, tabLabel: label, sectionId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sectionId]);
  return (
    <div style={{ width: '100%' }}>
      <style>{`@keyframes sd-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 10, position: 'sticky', top: 0, zIndex: 20, background: 'rgba(2,6,23,0.92)', backdropFilter: 'blur(8px)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '9px 16px', fontSize: 11, fontWeight: 800, letterSpacing: '0.07em',
              background: tab === t.id ? 'rgba(0,245,255,0.06)' : 'transparent',
              border: 'none', borderBottom: tab === t.id ? '2px solid ' + accent : '2px solid transparent',
              cursor: 'pointer', fontFamily: 'inherit',
              color: tab === t.id ? accent : 'rgba(148,163,184,0.7)', borderRadius: '8px 8px 0 0' }}>
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>
      {tab === 'dashboard' && (<><SectionSignatureBlock sectionId={sid} accent={accent} /><InsightGrid sectionId={sid} accent={accent} /><SectionExtra sectionId={sid} slot="dashboard" /></>)}
      {tab === 'map' && (
        hasMapExtra(sid)
          ? <SectionExtra sectionId={sid} slot="map" />
          : <div style={{
              marginTop: 12, height: MAP_TAB_HEIGHT, minHeight: MAP_TAB_MIN_HEIGHT,
              borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)',
            }}><SectionMap sectionId={sid} accent={accent} fill /></div>
      )}
      {tab === 'tables' && (<><ExhaustiveTables sectionId={sid} accent={accent} /><SectionExtra sectionId={sid} slot="tables" /></>)}
      {tab === 'analytics' && (<><DeepAnalysisTables sectionId={sid} accent={accent} /><SectionExtra sectionId={sid} slot="analytics" /></>)}
      {tab === 'sql' && <SchemaExplorer sectionId={sid} accent={accent} />}
      {tab === 'capture' && (
        <>
          <SectionExtra sectionId={sid} slot="capture" />
          <Suspense fallback={<div style={{ padding: 20, color: '#64748b', fontSize: 12 }}>Loading data capture module…</div>}>
            <LazyDataCaptureHub />
          </Suspense>
        </>
      )}
    </div>
  );
}

const LazyDataCaptureHub = lazy(() => import('../DataEntry/DataCaptureHub'));

// - Traffic legacy content --------------------
const LazyTrafficLegacy = lazy(() => import('../Traffic/TrafficLegacyContent'));
function TrafficMapLegacy() { return <LazyTrafficLegacy initialTab="map" hideTabBar />; }
function TrafficCountsLegacy() { return <LazyTrafficLegacy initialTab="counts" hideTabBar />; }
function TrafficStationsLegacy() { return <LazyTrafficLegacy initialTab="stations" hideTabBar />; }
function TrafficTrendsLegacy() { return <LazyTrafficLegacy initialTab="trends" hideTabBar />; }
function TrafficRoadSafetyLegacy() { return <LazyTrafficLegacy initialTab="roadsafety" hideTabBar />; }
const LazyGrowthFactors = lazy(() => import('../Traffic/GrowthFactorsPanel'));
const LazyOverloading = lazy(() => import('../Traffic/OverloadingSection'));
const LazyOprc = lazy(() => import('../../components/sections/OprcSection'));
const LazyNdpiv = lazy(() => import('../../components/sections/NdpivSection'));

// - RMS legacy content --------------------
const LazyRoadNetworkMap = lazy(() => import('../RoadNetwork/RoadNetworkView'));
const LazyNetworkStory = lazy(() => import('../NetworkStory/NetworkStory'));
const LazyRoadInventoryTbl = lazy(() => import('../RMS/RoadInventory'));

// - PMS legacy content --------------------
const PMS_CrossSectionAnalytics = lazy(() => import('../PMS/CrossSectionAnalytics'));
const PMS_RoadConditionView = lazy(() => import('../RoadCondition/RoadConditionView'));
const PMS_PavementCatalogue = lazy(() => import('../PMS/PavementCatalogue'));
const PMS_AIVisionDashboard = lazy(() => import('../PMS/AIVisionDashboard'));
const PMS_DigitalTwin = lazy(() => import('../PMS/DigitalTwin'));
const PMS_LifecycleView = lazy(() => import('../Lifecycle/LifecycleView'));
const PMS_RoadVideoView = lazy(() => import('../RoadVideoView/RoadVideoView'));
function PmsConditionMapLegacy() { return <PMS_RoadConditionView activeTab={'conditionmap' as any} embedded />; }
function PmsInventoryLegacy() { return <PMS_RoadConditionView activeTab={'inventory' as any} embedded />; }
function PmsAnalyticsViewLegacy() { return <PMS_RoadConditionView activeTab={'analytics' as any} embedded />; }
function PmsAgeLegacy() { return <PMS_RoadConditionView activeTab={'age' as any} embedded />; }
function PmsFwdLegacy() { return <PMS_RoadConditionView activeTab={'fwd' as any} embedded />; }

// - BMS legacy content --------------------
const BMS_GISMap = lazy(() => import('../GISMap/GISMapView'));
const BMS_Registry = lazy(() => import('../Registry/StructureRegistry'));
const BMS_Inspections = lazy(() => import('../Inspections/InspectionManagement'));
const BMS_Condition = lazy(() => import('../Condition/ConditionAssessment'));
const BMS_Maintenance = lazy(() => import('../Maintenance/MaintenanceWorks'));
const BMS_Analytics = lazy(() => import('../Analytics/Analytics'));
const BMS_PhotoTwin = lazy(() => import('../PhotoTwin/PhotoTwin'));
const BMS_BridgeWorks = lazy(() => import('../BridgeWorks/BridgeWorksSection'));
const BMS_Critical = lazy(() => import('../Condition/CriticalStructures'));

// - DUCAR legacy content --------------------
const LazyDucarOverview = lazy(() => import('../DUCAR/DucarOverviewPanel'));

// - PIM legacy content --------------------
const LazyPimLegacy = lazy(() => import('../PIM/PimLegacyContent'));
function PimBudgetLegacy() { return <LazyPimLegacy initialTab="budget" hideTabBar />; }
function PimFrameworkLegacy() { return <LazyPimLegacy initialTab="pim" hideTabBar />; }
function PimPppLegacy() { return <LazyPimLegacy initialTab="ppp" hideTabBar />; }
function PimDonorLegacy() { return <LazyPimLegacy initialTab="donor" hideTabBar />; }
function PimNdpivLegacy() { return <LazyPimLegacy initialTab="ndpiv" hideTabBar />; }

// - GIS Enterprise legacy content --------------------
const LazyGisLegacy = lazy(() => import('../GisEnterprise/GisEnterpriseLegacyContent'));
function GisMapLegacy() { return <LazyGisLegacy hideTabBar />; }

// - Road Reserve legacy content --------------------
const LazyReserveLegacy = lazy(() => import('../RoadReserve/RoadReserveLegacyContent'));
function ReserveOverviewLegacy() { return <LazyReserveLegacy initialTab="overview" hideTabBar />; }
function ReserveMapLegacy() { return <LazyReserveLegacy initialTab="map" hideTabBar />; }
function ReserveRegisterLegacy() { return <LazyReserveLegacy initialTab="register" hideTabBar />; }
function ReserveGazetteLegacy() { return <LazyReserveLegacy initialTab="gazette" hideTabBar />; }
function ReservePermitsLegacy() { return <LazyReserveLegacy initialTab="permits" hideTabBar />; }

// - Global Case Studies legacy content --------------------
const LazyCaseStudiesLegacy = lazy(() => import('../GlobalCaseStudies/GlobalCaseStudiesLegacyContent'));
function CaseStudiesWorldMapLegacy() { return <LazyCaseStudiesLegacy initialTab="worldmap" hideTabBar />; }
function CaseStudiesComparisonLegacy() { return <LazyCaseStudiesLegacy initialTab="analytics" hideTabBar />; }
function CaseStudiesMatrixLegacy() { return <LazyCaseStudiesLegacy initialTab="matrix" hideTabBar />; }
function CaseStudiesNarrativeLegacy() { return <LazyCaseStudiesLegacy initialTab="casestudies" hideTabBar />; }
function CaseStudiesLessonsLegacy() { return <LazyCaseStudiesLegacy initialTab="lessons" hideTabBar />; }

// - Admin: Interactive Map = the Platform Mind Map --------------------
const ADMIN_MindMap = lazy(() => import('../MindMap/MindMapSection'));
const ADMIN_Identity = lazy(() => import('../Admin/IdentityManager'));
const ADMIN_Activity = lazy(() => import('../Admin/ActivityLog'));
const ADMIN_DataAudit = lazy(() => import('../DataAudit/DataAuditPanel'));
const ADMIN_PendingSubmissions = lazy(() => import('../DataEntry/PendingSubmissions').then(m => ({ default: m.PendingSubmissions })));

// - Sources & Evidence --------------------
const SRC_Catalogue = lazy(() => import('../Sources/SourcesCatalogueSection'));
const SRC_Tabular = lazy(() => import('../Sources/TabularSummaries'));
const SRC_Dictionary = lazy(() => import('../Sources/DataDictionary'));

// - Downloads / Road Atlas / Road Video / Bridge Works / Budget / Lifecycle -
const DL_View = lazy(() => import('../Downloads/DownloadsView'));
const DOC_Store = lazy(() => import('../Documents/DocumentStore'));

// - Socio-Economic Analysis --------------------
const SE_Dashboard = lazy(() => import('../SocioEconomic/SocioEconomicDashboard'));
const SE_Tables = lazy(() => import('../SocioEconomic/SocioEconomicTables'));
const SE_Analytics = lazy(() => import('../SocioEconomic/SocioEconomicAnalytics'));
const SE_Map = lazy(() => import('../SocioEconomic/SocioEconomicMap'));
const RA_View = lazy(() => import('../RoadAtlas/RoadAtlasView'));
const RV_View = lazy(() => import('../RoadVideoView/RoadVideoView'));
const BUD_Section = lazy(() => import('../Budget/BudgetSection'));
const LC_Section = lazy(() => import('../Lifecycle/LifecycleSection'));
const PROJ_View = lazy(() => import('../Projects/ProjectsView'));

type ExtraSlot = 'dashboard' | 'map' | 'tables' | 'analytics' | 'capture';
const SECTION_EXTRAS: Record<string, Partial<Record<ExtraSlot, React.ComponentType<any>[]>>> = {
  rms: {
    dashboard: [LazyNetworkStory],
    map: [LazyRoadNetworkMap],
    tables: [LazyRoadInventoryTbl],
  },
  tis: {
    map: [TrafficMapLegacy],
    tables: [TrafficCountsLegacy, TrafficStationsLegacy],
    analytics: [TrafficTrendsLegacy, LazyGrowthFactors, LazyOverloading, LazyRoadSafetyOverview],
  },
  pms: {
    map: [PmsConditionMapLegacy],
    tables: [PmsInventoryLegacy, PMS_RoadVideoView],
    analytics: [PMS_CrossSectionAnalytics, PmsAnalyticsViewLegacy, PmsAgeLegacy, PmsFwdLegacy, PMS_LifecycleView, PMS_PavementCatalogue, PMS_AIVisionDashboard, PMS_DigitalTwin],
  },
  bms: {
    map: [BMS_GISMap],
    tables: [BMS_Registry, BMS_Inspections, BMS_BridgeWorks, BMS_Maintenance],
    analytics: [BMS_Condition, BMS_Critical, BMS_Analytics, BMS_PhotoTwin],
  },
  ducar: {
    dashboard: [LazyDucarOverview],
  },
  pim: {
    dashboard: [PimFrameworkLegacy],
    tables: [PimPppLegacy, PimDonorLegacy],
    analytics: [PimBudgetLegacy, PimNdpivLegacy],
  },
  gis: {
    map: [GisMapLegacy],
  },
  reserve: {
    dashboard: [ReserveOverviewLegacy],
    map: [ReserveMapLegacy],
    tables: [ReserveRegisterLegacy, ReserveGazetteLegacy, ReservePermitsLegacy],
  },
  casestudies: {
    dashboard: [CaseStudiesNarrativeLegacy],
    map: [CaseStudiesWorldMapLegacy],
    tables: [CaseStudiesComparisonLegacy],
    analytics: [CaseStudiesMatrixLegacy, CaseStudiesLessonsLegacy],
  },
  admin: {
    map: [ADMIN_MindMap],
    tables: [ADMIN_Identity, ADMIN_Activity],
    analytics: [ADMIN_DataAudit],
    capture: [ADMIN_PendingSubmissions],
  },
  sources: {
    tables: [SRC_Catalogue, SRC_Dictionary],
    analytics: [SRC_Tabular],
  },
  downloads: {
    dashboard: [DL_View],
  },
  documents: {
    tables: [DOC_Store],
  },
  socioeconomic: {
    dashboard: [SE_Dashboard],
    map: [SE_Map],
    tables: [SE_Tables],
    analytics: [SE_Analytics],
  },
  roadatlas: {
    map: [RA_View],
  },
  roadvideo: {
    tables: [RV_View],
  },
  bridgeworks: {
    tables: [BMS_BridgeWorks],
  },
  budget: {
    analytics: [BUD_Section],
  },
  lifecycle: {
    analytics: [LC_Section],
  },
  projects: {
    tables: [PROJ_View],
  },
};

// Full-page treatment for the Interactive Map tab - the map should dominate
// the viewport, not sit cramped in a small embedded box.
const MAP_TAB_HEIGHT = 'calc(100vh - 230px)';
const MAP_TAB_MIN_HEIGHT = 620;

function hasMapExtra(sectionId: string): boolean {
  const list = SECTION_EXTRAS[sectionId]?.map;
  return !!list && list.length > 0;
}

function SectionExtra({ sectionId, slot }: { sectionId: string; slot: ExtraSlot }) {
  const list = SECTION_EXTRAS[sectionId]?.[slot];
  if (!list || !list.length) return null;
  const isMap = slot === 'map';
  return (
    <>
      {list.map((Comp, i) => (
        <Suspense key={i} fallback={null}>
          <div style={isMap ? {
            marginTop: 12, position: 'relative', isolation: 'isolate',
            contain: 'layout paint style', overflow: 'hidden',
            height: MAP_TAB_HEIGHT, minHeight: MAP_TAB_MIN_HEIGHT,
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
          } : {
            marginTop: 18, position: 'relative', isolation: 'isolate',
            contain: 'layout paint style', overflow: 'hidden auto', maxHeight: '90vh',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
          }}><Comp /></div>
        </Suspense>
      ))}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ── Main Export ──────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────── */
export default function SectionDashboard({ sectionId, accent }: { sectionId: string; accent: string }) {
  const def = DEFS[sectionId] ?? DEFS.rms;

  return (
    <div style={{ padding: '6px 8px', width: '100%' }}>
      {/* Compact definition strip - always visible above the 6-tab bar */}
      <div style={{
        background: `rgba(255,255,255,0.02)`, border: `1px solid ${accent}26`,
        borderRadius: 10, padding: '10px 14px', marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0, fontSize: 13,
            background: `linear-gradient(135deg,${accent}33,rgba(0,0,0,0))`,
            border: `1px solid ${accent}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent,
          }}>{def.icon}</div>
          <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minWidth: 0, rowGap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#e2eaf4', flexShrink: 0 }}>{def.title}</span>
            <span style={{ fontSize: 11.5, color: 'rgba(203,213,225,0.85)', lineHeight: 1.5, flex: '1 1 320px', minWidth: 260 }}>{def.body}</span>
          </div>
        </div>
      </div>

      {/* Section Sub-Tabs: Dashboard | Interactive Map | Exhaustive Tables | Deep Analytics | SQL Database & Schema | Data Capture */}
      <SectionSubTabs sectionId={sectionId} accent={accent} />
    </div>
  );
}
