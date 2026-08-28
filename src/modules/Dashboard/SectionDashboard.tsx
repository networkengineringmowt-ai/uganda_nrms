import { useState, useEffect, lazy, Suspense } from 'react';
import { setActiveSubTab } from '../../shared/activeSubTabStore';

/* ── Section metadata ─────────────────────────────────────────────────────── */
const DEFS: Record<string, { title: string; body: string; icon: string }> = {
  rms:          { icon: '🔧', title: 'RMS - Road Mgmt System',              body: 'Tracks maintenance activities, work orders, and road condition improvement across the national road network.' },
  pms:          { icon: '📐', title: 'Pavement Management System',          body: 'IRI-based pavement condition surveys, roughness analysis, and treatment recommendations for Uganda\'s classified roads.' },
  roadcondition:{ icon: '🛣',  title: 'Pavement Management',                 body: 'Visual and instrumental road condition data including cracking, rutting, potholing, and surface distress indices.' },
  bms:          { icon: '🌉', title: 'Bridge Management System',             body: 'Inventory, structural inspection reports, load ratings, and maintenance prioritisation for bridges and culverts.' },
  traffic:      { icon: '🚦', title: 'Traffic Information',                  body: 'Automatic Traffic Counter data, AADT computation, vehicle classification, and seasonal adjustment factors.' },
  atc:          { icon: '📡', title: 'ATC Traffic Counters',                 body: '25 Automatic Traffic Counters (15 legacy + 10 new) providing real-time classified volume data across the national road network.' },
  ntis:         { icon: '📈', title: 'National Traffic Information System',  body: 'AADT trends, growth forecasting, axle-load monitoring, and road safety analysis for Uganda\'s national corridors.' },
  npms:         { icon: '🗺',  title: 'National PMS',                         body: 'Strategic-level pavement performance indicators and network-wide condition distribution across all road classes.' },
  nbms:         { icon: '🗂',  title: 'National BMS',                         body: 'Consolidated bridge and structure data across all road agencies - UNRA, URF, district, and urban authorities.' },
  network:      { icon: '🌐', title: 'Network Overview',                     body: 'The classified road network: national, district, urban, and community access roads, total extent and agency responsibilities.' },
  roadreserve:  { icon: '📏', title: 'Road Reserve Management',              body: 'Surveyed road reserve boundaries, encroachment detection, gazette status, and reserve width compliance monitoring.' },
  gisenterprise:{ icon: '🗺',  title: 'GIS Enterprise',                      body: 'Spatial data infrastructure, GIS layers, aerial imagery, and geospatial analysis tools for road asset management.' },
  bridgeworks:  { icon: '🏗',  title: 'Bridge Works Programme',               body: 'Active and completed bridge construction and rehabilitation contracts, progress tracking, and financial performance.' },
  pim:          { icon: '📋', title: 'Public Investment',                    body: 'Capital investment project register, milestone tracking, contractor performance, and disbursement records.' },
  budget:       { icon: '💰', title: 'Budget & Maintenance',                 body: 'MTEF budget allocations, approved estimates, actual expenditure, and funding gap analysis by programme and road agency.' },
  lifecycle:    { icon: '♻',  title: 'Life Cycle Management',                body: 'HDM-4 based life-cycle costing, NPV/BCR computation, and optimal maintenance strategy selection over a 20-year horizon.' },
  roadatlas:    { icon: '📖', title: 'Road Atlas',                           body: 'Official Uganda road atlas with classified inventory, road numbers, chainage references, and district-level statistics.' },
  roadvideo:    { icon: '🎥', title: 'Road Video Survey',                    body: 'Continuous video log survey footage referenced to road chainage, used for remote visual condition assessment.' },
  projects:     { icon: '🏛',  title: 'Projects & Works',                     body: 'Capital, maintenance, and safety programmes funded by GOU, World Bank, AfDB, JICA, and other development partners.' },
  casestudies:  { icon: '📝', title: 'Global Case Studies',                  body: 'Documented project outcomes, best-practice engineering interventions, and value-for-money analyses.' },
  admin:        { icon: '⚙',  title: 'Admin Tools',                          body: 'User management, access control, audit logs, system configuration, and the platform architecture mind map.' },
  hdm4:         { icon: '🔬', title: 'HDM-4 Analysis',                       body: 'Highway Development and Management model runs for road investment planning and budget optimisation.' },
  ducar:        { icon: '🌿', title: 'DUCAR Roads',                          body: 'District, Urban, Community Access Road network data - condition, coverage, and maintenance funding by local government.' },
  sources:      { icon: '📚', title: 'Sources & Evidence',                   body: 'Evidence catalogue, tabular summaries, and the platform data dictionary underpinning every figure shown across the site.' },
  downloads:    { icon: '⬇',  title: 'Downloads',                            body: 'Bulk exports of structures, road network, and survey data in CSV, KML, and GeoJSON formats.' },
  documents:    { icon: '📁', title: 'Document Store',                       body: 'Central repository of engineering drawings, survey reports, contracts, and reference documents across all road agencies.' },
  socioeconomic:{ icon: '🌍', title: 'Socio-Economic Analysis',              body: 'Population, land use, agriculture, and economic indicators mapped against the road network to inform investment prioritisation.' },

  // Restored standalone legacy tabs (see the Sidebar.tsx SECTIONS comment) -
  // each now gets its own definition card so it renders through the exact
  // same Dashboard | Interactive Map | Exhaustive Tables | Deep Analytics |
  // SQL Database & Schema | Data Capture shell as every other section,
  // instead of the bespoke one-off page it used to be rendered as directly
  // in App.tsx. No exceptions - full UI cohesion across the sidebar.
  networkstory:  { icon: '📖', title: 'Network Story 1986–',       body: 'The Uganda road network\'s historical narrative from 1986 to present - policy eras, network growth, and paving milestones.' },
  roadnetwork:   { icon: '🗺',  title: 'Road Network Map',           body: 'The full classified road network on an interactive map - all 1,017 links, searchable and filterable by class, region, and surface.' },
  registry:      { icon: '📋', title: 'Structure Registry',         body: 'The complete bridge and culvert inventory register - physical properties, condition, and location for every structure.' },
  inspections:   { icon: '✅', title: 'Inspection Management',      body: 'Scheduling, recording, and tracking of routine, principal, special, and emergency structure inspections.' },
  gismap:        { icon: '📍', title: 'Structure GIS Map',          body: 'Bridges and culverts plotted on an interactive map, coloured by condition rating and filterable by structure type.' },
  priority:      { icon: '📊', title: 'Priority Ranking',           body: 'Structures ranked by a composite priority score - condition, traffic level, strategic importance, and cost.' },
  phototwin:     { icon: '📷', title: 'Photo & Digital Twin',       body: 'Photographic records and digital-twin visualisations for structures, used for remote condition review.' },
  trafficanalytics:{ icon: '📈', title: 'Traffic Analytics',         body: 'AADT trends, vehicle classification mix, and seasonal/growth-adjusted traffic analytics across counted stations.' },
  trafficsummary:{ icon: '📄', title: 'Traffic Summary',            body: 'Summary tables of road links and traffic-counting stations, aggregated for quick reference.' },
  growthfactors: { icon: '📈', title: 'Growth Factors',              body: 'Monthly, seasonal, and annual traffic growth factors used to project AADT forward from count-year data.' },
  overloading:   { icon: '⚠',  title: 'Overloading Analytics',       body: 'ESAL-based overloading risk index and axle-load hotspot mapping across the classified network.' },
  oprc:          { icon: '🚧', title: 'OPRC Contracts',              body: 'Output & Performance-based Road Contracts - the roads selected for OPRC contracting, scoped by region, not yet awarded.' },
  ndpiv:         { icon: '🎯', title: 'NDP IV Investments',          body: 'National Development Plan IV / Uganda Vision 2040 road infrastructure investment components and their network scope.' },
  mlarchitecture:{ icon: '🧠', title: 'ML System Architecture',      body: 'Interactive system architecture for the platform\'s asset-management ML engine - model inputs, outputs, and data flow.' },
  projecttracker:{ icon: '✔',  title: 'Project Tracker',             body: 'Gantt/Kanban tracking of ongoing road development projects - progress, milestones, and schedule status.' },
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
// 'atc' and 'bridgeworks' used to alias onto 'tis'/'bms' here, which made
// their entire Dashboard/Map/Tables/Analytics/SQL content byte-identical to
// the Traffic and BMS sections despite having their own distinct DEFS text -
// a real sidebar-visible duplication bug. Both now have their own dedicated
// content (see SECTION_EXTRAS below: 'atc' -> PredictionsPanel, 'bridgeworks'
// -> BridgeWorksSection) so they stay un-aliased.
const SECTION_ALIAS: Record<string, string> = {
  traffic: 'tis', condition: 'pms', roadcondition: 'pms', npms: 'pms',
  nbms: 'bms',
  maintenance: 'ducar',
  roadreserve: 'reserve',
  gisenterprise: 'gis',
  // registry / inspections used to alias onto 'bms' (their content is a
  // subset of the Bridge Management hub), but now that both have been
  // restored as their own standalone sidebar tabs they keep their own
  // sectionId so their own DEFS card and SECTION_EXTRAS.dashboard entry
  // (above) are what actually renders, instead of silently showing the
  // full BMS hub under a "Structure Registry" / "Inspection Management"
  // heading.
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

// - ATC legacy content -------------------- (previously orphaned - never
// imported anywhere in the app before this fix)
const ATC_Predictions = lazy(() => import('../ATC/PredictionsPanel'));

// - RMS legacy content --------------------
const LazyRoadNetworkMap = lazy(() => import('../RoadNetwork/RoadNetworkView'));
const LazyNetworkStory = lazy(() => import('../NetworkStory/NetworkStory'));
const LazyRoadInventoryTbl = lazy(() => import('../RMS/RoadInventory'));
// NetworkStory's own root is `position: absolute; inset: 0`, built for the
// old full-bleed FULL_VIEWS treatment - inside the dashboard slot's plain
// `overflow/maxHeight` wrapper (no explicit height) that collapses to 0px
// and makes the whole embed invisible. Give it a real height here so it
// renders instead of vanishing.
function NetworkStoryEmbed() {
  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 230px)', minHeight: 620 }}>
      <LazyNetworkStory />
    </div>
  );
}

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
// LiteratureMatrixTab (initialTab="matrix") has the same `position: absolute;
// inset: 0` root as NetworkStory/WorldMapTab, built for a full-bleed parent -
// inside the analytics slot's plain `overflow/maxHeight` wrapper (no explicit
// height) it collapses to 0px and vanishes. Same fix as NetworkStoryEmbed
// below: give it a real height here so it actually renders.
function CaseStudiesMatrixLegacy() {
  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 230px)', minHeight: 620 }}>
      <LazyCaseStudiesLegacy initialTab="matrix" hideTabBar />
    </div>
  );
}
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

// - Restored standalone legacy tabs - own dedicated dashboard content -------
const LazyPriorityRanking     = lazy(() => import('../Priority/PriorityRanking'));
const LazyTrafficAnalyticsPg  = lazy(() => import('../../components/sections/TrafficAnalytics'));
const LazyTrafficSummaryPg    = lazy(() => import('../../components/sections/TrafficSummary'));
const LazyHDM4Section         = lazy(() => import('../HDM4/HDM4Section'));
const LazyMLArchitecture      = lazy(() => import('../MLArchitecture/MLArchitectureDiagram'));
const LazyProjectTracker      = lazy(() => import('../Projects/ProjectTracker'));

// Placement rule across every hub below: chart/KPI-overview components live
// on the Dashboard tab; summary-table/registry/list components and mixed
// chart+table analysis pages live on the Deep Analytics tab, alongside
// DeepAnalysisTables. The Exhaustive Tables tab is left to do exactly what
// its name says - ExhaustiveTables.tsx's own generated grid - plus any pure
// media/viewer content (video, photo, digital-twin) that isn't a chart or a
// table. Nothing was deleted to make this consistent - every component that
// used to render somewhere still renders, just in the slot that matches
// what it actually shows.
type ExtraSlot = 'dashboard' | 'map' | 'tables' | 'analytics' | 'capture';
const SECTION_EXTRAS: Record<string, Partial<Record<ExtraSlot, React.ComponentType<any>[]>>> = {
  rms: {
    // NetworkStory and RoadNetworkMap now each have their own dedicated
    // standalone sidebar section (networkstory / roadnetwork) - keeping
    // them here too made RMS's own hub show byte-identical content to two
    // other sidebar entries. RMS's Dashboard/Map tabs fall back to the
    // shared InsightGrid/SectionMap treatment like any other section.
    // Road Inventory is a records table, so it sits on Deep Analytics.
    analytics: [LazyRoadInventoryTbl],
  },
  tis: {
    // ntis / trafficanalytics / trafficsummary / growthfactors / overloading
    // were each their own standalone sidebar row showing one facet of the
    // same traffic dataset Traffic Information already covers - folded in
    // here (nav decluttering) rather than kept as five near-duplicate rows.
    // NTIS overview, the AADT trend/KPI page, and the Road Safety overview
    // are all pure chart panels, so all three sit on Dashboard; the counts/
    // stations/summary tables and the mixed analysis pages sit on Deep
    // Analytics.
    dashboard: [LazyNTISOverview, TrafficTrendsLegacy, LazyRoadSafetyOverview],
    map: [TrafficMapLegacy],
    analytics: [TrafficCountsLegacy, TrafficStationsLegacy, LazyTrafficSummaryPg, LazyTrafficAnalyticsPg, LazyGrowthFactors, LazyOverloading],
  },
  pms: {
    // Cross-Section Analytics is pure charts, so it sits on Dashboard; the
    // inventory table and every table-bearing/mixed analysis view sit on
    // Deep Analytics. AI Vision and Digital Twin are media viewers (not a
    // chart or a table), so they stay put where they already were.
    dashboard: [PMS_CrossSectionAnalytics],
    map: [PmsConditionMapLegacy],
    tables: [PMS_RoadVideoView],
    analytics: [PmsInventoryLegacy, PmsAnalyticsViewLegacy, PmsAgeLegacy, PmsFwdLegacy, PMS_LifecycleView, PMS_PavementCatalogue, PMS_AIVisionDashboard, PMS_DigitalTwin],
  },
  bms: {
    // GISMap, Registry, Inspections, BridgeWorks and PhotoTwin were each
    // their own standalone sidebar row for content that's really a facet of
    // Bridge Management - folded back in here (nav decluttering) so Bridge
    // Management is the one place to find all of it, instead of six rows.
    // BridgeWorks and the Analytics module are both chart/KPI panels, so
    // both sit on Dashboard; Registry/Inspections/Maintenance are records
    // tables and Condition/Critical/Priority are table-led analysis, so all
    // five sit on Deep Analytics. PhotoTwin is a photo viewer, not a chart
    // or table, so it stays on Exhaustive Tables where it already was.
    dashboard: [BMS_BridgeWorks, BMS_Analytics],
    map: [BMS_GISMap],
    tables: [BMS_PhotoTwin],
    analytics: [BMS_Maintenance, BMS_Registry, BMS_Inspections, BMS_Condition, BMS_Critical, LazyPriorityRanking],
  },
  ducar: {
    dashboard: [LazyDucarOverview],
  },
  pim: {
    // Socio-Economic Analysis was its own standalone row - the population/
    // land-use/economic indicators it maps directly feed investment
    // prioritisation (see DEFS above), so it's folded onto Public
    // Investment's tabs instead of sitting as a separate row. NDP IV's own
    // tab here is a pure KPI/target grid, so it joins Dashboard; the PPP/
    // donor/budget tables and pages sit on Deep Analytics.
    dashboard: [PimFrameworkLegacy, SE_Dashboard, PimNdpivLegacy],
    map: [SE_Map],
    analytics: [PimBudgetLegacy, SE_Analytics, PimPppLegacy, PimDonorLegacy, SE_Tables],
  },
  gis: {
    map: [GisMapLegacy],
  },
  reserve: {
    dashboard: [ReserveOverviewLegacy],
    map: [ReserveMapLegacy],
    // Register/Gazette/Permits are all records tables (or table-led), so
    // all three sit on Deep Analytics rather than Exhaustive Tables.
    analytics: [ReserveRegisterLegacy, ReserveGazetteLegacy, ReservePermitsLegacy],
  },
  casestudies: {
    dashboard: [CaseStudiesNarrativeLegacy],
    map: [CaseStudiesWorldMapLegacy],
    // Comparison/Matrix/Lessons are all table-based (comparison table,
    // literature-review matrix, lessons registry), so all three sit on Deep
    // Analytics.
    analytics: [CaseStudiesComparisonLegacy, CaseStudiesMatrixLegacy, CaseStudiesLessonsLegacy],
  },
  admin: {
    // Interactive Map = the platform mind map (unchanged). Identity/Activity
    // are records tables and Data Audit is a table-led audit log, so all
    // three join ML System Architecture (folded in here - it was its own
    // standalone row for a platform-level diagram) on Deep Analytics.
    map: [ADMIN_MindMap],
    analytics: [ADMIN_Identity, ADMIN_Activity, ADMIN_DataAudit, LazyMLArchitecture],
    capture: [ADMIN_PendingSubmissions],
  },
  sources: {
    // Catalogue, Dictionary and Tabular Summaries are all records
    // tables/glossaries, so all three sit on Deep Analytics.
    analytics: [SRC_Tabular, SRC_Catalogue, SRC_Dictionary],
  },
  downloads: {
    dashboard: [DL_View],
  },
  documents: {
    analytics: [DOC_Store],
  },
  socioeconomic: {
    dashboard: [SE_Dashboard],
    map: [SE_Map],
    analytics: [SE_Analytics, SE_Tables],
  },
  roadatlas: {
    map: [RA_View],
  },
  roadvideo: {
    tables: [RV_View],
  },
  bridgeworks: {
    // Its own dedicated component (KPI cards + searchable works list) - was
    // dead code before the alias fix above since 'bridgeworks' resolved to
    // 'bms' first and this entry was never reached.
    dashboard: [BMS_BridgeWorks],
  },
  atc: {
    // Real-time congestion/AADT forecasting for the 25-station ATC network -
    // was a fully-built, never-imported orphan component before this fix.
    dashboard: [ATC_Predictions],
  },
  budget: {
    analytics: [BUD_Section],
  },
  lifecycle: {
    // HDM-4 was its own standalone row for the model that literally powers
    // this section's life-cycle costing (see DEFS above) - folded in here.
    analytics: [LC_Section, LazyHDM4Section],
  },
  projects: {
    // Project Tracker is a pure chart/progress-card dashboard (no table at
    // all), so it moves to Dashboard; the Works/NDPIV register (table-led,
    // with its own embedded map) sits on Deep Analytics. OPRC and NDP IV
    // each keep their own dedicated standalone sidebar section - OPRC is
    // "roads selected for OPRC contracting", not a generic Projects
    // sub-view - so they stay off Projects' tabs.
    dashboard: [LazyProjectTracker],
    analytics: [PROJ_View],
  },

  // Restored standalone legacy tabs - each keeps its own un-aliased sectionId
  // (see DEFS above) so it gets its own title/body card, with its existing
  // bespoke component slotted into Dashboard. Map/Tables/Analytics/SQL fall
  // back to InsightGrid/ExhaustiveTables/etc.'s honest "not wired" empty
  // state for these ids, same as any other unwired section - not a crash,
  // just no duplicate database table for content that's really local/static.
  //
  // gismap / registry / inspections / priority / phototwin / trafficanalytics
  // / trafficsummary / growthfactors / overloading / hdm4 / mlarchitecture /
  // projecttracker no longer have their own row in the sidebar (folded onto
  // bms / tis / lifecycle / admin / projects above to cut nav clutter) but
  // keep their entry here unchanged - the many "Related Data" cross-link
  // pills across the app (see useCrossLinks.ts) still deep-link straight to
  // these ids for a single-purpose focused view, and App.tsx's own
  // activeView branches still render them, so removing the entry would turn
  // a working pill into a blank page rather than actually removing anything.
  networkstory:   { dashboard: [NetworkStoryEmbed] },
  roadnetwork:    { map: [LazyRoadNetworkMap] },
  gismap:         { map: [BMS_GISMap] },
  registry:       { dashboard: [BMS_Registry] },
  inspections:    { dashboard: [BMS_Inspections] },
  priority:       { dashboard: [LazyPriorityRanking] },
  phototwin:      { dashboard: [BMS_PhotoTwin] },
  trafficanalytics:{ dashboard: [LazyTrafficAnalyticsPg] },
  trafficsummary: { dashboard: [LazyTrafficSummaryPg] },
  growthfactors:  { dashboard: [LazyGrowthFactors] },
  overloading:    { dashboard: [LazyOverloading] },
  oprc:           { dashboard: [LazyOprc] },
  ndpiv:          { dashboard: [LazyNdpiv] },
  hdm4:           { dashboard: [LazyHDM4Section] },
  mlarchitecture: { dashboard: [LazyMLArchitecture] },
  projecttracker: { dashboard: [LazyProjectTracker] },
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
