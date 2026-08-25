import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { logEvent } from './modules/Auth/auditLog';
import { BMSProvider, useBMS } from './store/BMSContext';
import { BotHighlightContext } from './modules/AssetBot/types';
import { AuthProvider, useAuth } from './modules/Auth/AuthContext';
import { LoginPage } from './modules/Auth/LoginPage';
import { AccessPending } from './modules/Auth/AccessPending';
import { canAccessView, isFieldRole } from './modules/Auth/permissions';
import { roleLabel } from './modules/Auth/authTypes';
import CrossLinkChipBar from './shared/CrossLinkChipBar';
import PageToolbar from './shared/PageToolbar';

const RMSFieldShell = lazy(() => import('./modules/RMS/RMSFieldShell'));
import Sidebar from './components/Layout/Sidebar';
import Header  from './components/Layout/Header';

const RoadAssetBot = lazy(() => import('./modules/AssetBot/RoadAssetBot'));

// ── Platform-level modules ────────────────────────────────────────────────────
const NetworkSection    = lazy(() => import('./modules/Network/NetworkSection'));
const PlatformDashboard = lazy(() => import('./modules/PlatformDashboard/PlatformDashboard'));
const NetworkStory      = lazy(() => import('./modules/NetworkStory/NetworkStory'));
const RoadNetworkView   = lazy(() => import('./modules/RoadNetwork/RoadNetworkView'));
const MaintenanceProgrammeView = lazy(() => import('./modules/RoadCondition/MaintenanceProgrammeView'));

// ── BMS sub-modules ───────────────────────────────────────────────────────────
const Dashboard            = lazy(() => import('./modules/Dashboard/Dashboard'));
const StructureRegistry    = lazy(() => import('./modules/Registry/StructureRegistry'));
const GISMapView           = lazy(() => import('./modules/GISMap/GISMapView'));
const InspectionManagement = lazy(() => import('./modules/Inspections/InspectionManagement'));
const ConditionAssessment  = lazy(() => import('./modules/Condition/ConditionAssessment'));
const MaintenanceWorks     = lazy(() => import('./modules/Maintenance/MaintenanceWorks'));
const Analytics            = lazy(() => import('./modules/Analytics/Analytics'));
const PriorityRanking      = lazy(() => import('./modules/Priority/PriorityRanking'));
const PhotoTwin            = lazy(() => import('./modules/PhotoTwin/PhotoTwin'));
const TrafficAnalytics     = lazy(() => import('./components/sections/TrafficAnalytics'));
const TrafficSummary       = lazy(() => import('./components/sections/TrafficSummary'));
const OprcSection          = lazy(() => import('./components/sections/OprcSection'));
const NdpivSection         = lazy(() => import('./components/sections/NdpivSection'));
const GrowthFactorsPanel   = lazy(() => import('./modules/Traffic/GrowthFactorsPanel'));
const OverloadingSection   = lazy(() => import('./modules/Traffic/OverloadingSection'));

// ── New 10-module sections ────────────────────────────────────────────────────
const MLArchitectureDiagram   = lazy(() => import('./modules/MLArchitecture/MLArchitectureDiagram'));
const HDM4Section             = lazy(() => import('./modules/HDM4/HDM4Section'));
const ProjectTracker          = lazy(() => import('./modules/Projects/ProjectTracker'));
const TabularSummaries        = lazy(() => import('./modules/Sources/TabularSummaries'));

// ── Data entry ────────────────────────────────────────────────────────────────
const PendingSubmissions = lazy(() => import('./modules/DataEntry/PendingSubmissions').then(m => ({ default: m.PendingSubmissions })));
const DataCaptureHub     = lazy(() => import('./modules/DataEntry/DataCaptureHub'));

// ── Admin + unified wrappers ──────────────────────────────────────────────────
const DataAuditPanel  = lazy(() => import('./modules/DataAudit/DataAuditPanel'));

// ── Unified 6-tab section hub (Dashboard | Interactive Map | Exhaustive Tables |
// Deep Analytics | SQL Database & Schema | Data Capture) - every sidebar section
// routes through this single component so there is only ever one nav layer.
const SectionDashboard = lazy(() => import('./modules/Dashboard/SectionDashboard'));
const SECTION_ACCENT: Record<string, string> = {
  rms: '#00f5ff', roadcondition: '#ff6b35', bms: '#4d9fff', roadreserve: '#00d4aa',
  traffic: '#00f5ff', projects: '#00ff88', pim: '#ffd23f', budget: '#ff2d78',
  lifecycle: '#00d4aa', casestudies: '#00d4aa', sources: '#94a3b8', admin: '#00f5ff',
  gisenterprise: '#b967ff', atc: '#ff6b35', roadatlas: '#00f5ff', roadvideo: '#00f5ff',
  bridgeworks: '#4d9fff', downloads: '#94a3b8',
  ducar: '#00ff88', socioeconomic: '#ffd23f', documents: '#94a3b8',
};
function SectionHub({ sectionId }: { sectionId: string }) {
  return <SectionDashboard sectionId={sectionId} accent={SECTION_ACCENT[sectionId] ?? '#00f5ff'} />;
}

const FULL_VIEWS      = new Set(['gismap', 'roadnetwork']);
const SELF_SCROLL_VIEWS = new Set(['networkstory']);
// Views whose section component already renders its own CrossLinkChipBar - the
// global bar below skips these to avoid a duplicate "Related Data" strip.
const SELF_CHIP_VIEWS = new Set(['rms', 'bms', 'pms', 'roadcondition', 'traffic', 'budget', 'lifecycle', 'projects', 'oprc', 'ndpiv', 'mlarchitecture', 'roadnetwork']);

// ─────────────────────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-full w-full bg-slate-950">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto shadow-2xl shadow-blue-900/60">
          <svg viewBox="0 0 24 24" className="w-8 h-8 text-white fill-current">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
          </svg>
        </div>
        <div>
          <div className="text-white font-bold text-lg">Uganda National Roads Management Platform</div>
          <div className="text-slate-500 text-sm mt-1">Dept. of National Roads · Ministry of Works &amp; Transport</div>
          <div className="text-slate-600 text-xs mt-0.5">Initializing platform · Fetching network data from unified database · DNR GIS Jun 2025</div>
        </div>
        <div className="flex justify-center gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ModuleSpinner() {
  return (
    <div className="flex items-center justify-center h-full w-full bg-slate-950">
      <div className="w-7 h-7 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function AppShell() {
  const { state, navigate } = useBMS();
  const { activeView, isLoading } = state;
  const { user } = useAuth();
  // Track & trace: every page view goes to the G: Drive audit trail.
  useEffect(() => {
    if (user) logEvent('view', { view: activeView });
  }, [user, activeView]);

  const showHeaderSearch = useMemo(() =>
    ['registry', 'inspections', 'priority', 'sources'].includes(activeView),
    [activeView],
  );

  const isFullView = FULL_VIEWS.has(activeView);

  if (isLoading && state.structures.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {!isFullView && <Header showSearch={showHeaderSearch} />}
        <main className="flex-1 min-h-0 relative overflow-hidden">
          <PageToolbar />
          <Suspense fallback={<ModuleSpinner />}>

            {activeView === 'gismap'      && <GISMapView />}
            {activeView === 'roadnetwork' && <RoadNetworkView />}

            {SELF_SCROLL_VIEWS.has(activeView) && (
              <div id="nrms-content-pane" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                {activeView === 'networkstory' && <NetworkStory />}
              </div>
            )}

            {!isFullView && !SELF_SCROLL_VIEWS.has(activeView) && (
              <div id="nrms-content-pane" style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 12 }}>
                {/* Unified Related-Data chip bar - shown on every section that doesn't render its own */}
                {!import.meta.env.VITE_STANDALONE && !SELF_CHIP_VIEWS.has(activeView) && <CrossLinkChipBar sectionId={activeView} />}
                {activeView === 'network'               && <NetworkSection />}
                {activeView === 'platform'              && <PlatformDashboard />}
                {activeView === 'traffic'               && <SectionHub sectionId="traffic" />}
                {activeView === 'roadcondition'         && <SectionHub sectionId="roadcondition" />}
                {activeView === 'maintenanceprogramme'  && <MaintenanceProgrammeView />}
                {activeView === 'projects'              && <SectionHub sectionId="projects" />}
                {activeView === 'dashboard'        && <Dashboard />}
                {activeView === 'registry'         && <StructureRegistry />}
                {activeView === 'inspections'      && <InspectionManagement />}
                {activeView === 'condition'        && <ConditionAssessment />}
                {activeView === 'maintenance'      && <MaintenanceWorks />}
                {activeView === 'analytics'        && <Analytics />}
                {activeView === 'priority'         && <PriorityRanking />}
                {activeView === 'phototwin'        && <PhotoTwin />}
                {activeView === 'trafficanalytics' && <TrafficAnalytics />}
                {activeView === 'trafficsummary'   && <TrafficSummary />}
                {activeView === 'growthfactors'    && <GrowthFactorsPanel />}
                {activeView === 'overloading'      && <OverloadingSection />}
                {activeView === 'oprc'             && <OprcSection />}
                {activeView === 'ndpiv'            && <NdpivSection />}
                {activeView === 'hdm4'             && <HDM4Section />}
                {activeView === 'tabularsummaries' && <TabularSummaries />}

                {activeView === 'mlarchitecture' && (
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#e2eaf4', marginBottom: 4 }}>
                        Asset Management ML Engine
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.65)' }}>
                        Interactive system architecture - click any node to inspect model details, inputs, and outputs
                      </div>
                    </div>
                    <MLArchitectureDiagram />
                  </div>
                )}

                {activeView === 'projecttracker' && <ProjectTracker />}
                {activeView === 'pim'            && <SectionHub sectionId="pim" />}

                {activeView === 'budget' && <SectionHub sectionId="budget" />}

                {activeView === 'rms'             && <SectionHub sectionId="rms" />}
                {activeView === 'roadreserve'    && <SectionHub sectionId="roadreserve" />}
                {activeView === 'casestudies'    && <SectionHub sectionId="casestudies" />}
                {activeView === 'lifecycle'       && <SectionHub sectionId="lifecycle" />}
                {activeView === 'sources'         && <SectionHub sectionId="sources" />}
                {activeView === 'tabularsummaries' && <TabularSummaries />}
                {activeView === 'gisenterprise'    && <SectionHub sectionId="gisenterprise" />}
                {activeView === 'atc'              && <SectionHub sectionId="atc" />}
                {activeView === 'bridgeworks'      && <SectionHub sectionId="bridgeworks" />}
                {activeView === 'downloads'        && <SectionHub sectionId="downloads" />}
                {activeView === 'roadatlas'        && <SectionHub sectionId="roadatlas" />}
                {activeView === 'roadvideo'        && <SectionHub sectionId="roadvideo" />}
                {activeView === 'ducar'            && <SectionHub sectionId="ducar" />}
                {activeView === 'socioeconomic'    && <SectionHub sectionId="socioeconomic" />}
                {activeView === 'documents'        && <SectionHub sectionId="documents" />}

                {activeView === 'admin' && (
                  <Suspense fallback={<ModuleSpinner />}>
                    <RequireAdmin label="Admin Tools">
                      <SectionHub sectionId="admin" />
                    </RequireAdmin>
                  </Suspense>
                )}

                {activeView === 'pendingsurveys' && (
                  <Suspense fallback={<ModuleSpinner />}>
                    <RequireAdmin label="Pending Submissions">
                      <PendingSubmissions />
                    </RequireAdmin>
                  </Suspense>
                )}

                {activeView === 'dataaudit' && (
                  <Suspense fallback={<ModuleSpinner />}>
                    <RequireAdmin label="Data Audit">
                      <DataAuditPanel />
                    </RequireAdmin>
                  </Suspense>
                )}

                {activeView === 'datacapture' && (
                  <Suspense fallback={<ModuleSpinner />}>
                    <RequireAdmin label="Data Capture">
                      <DataCaptureHub />
                    </RequireAdmin>
                  </Suspense>
                )}

                {activeView === 'bms' && <SectionHub sectionId="bms" />}
                {activeView === 'pms' && <SectionHub sectionId="pms" />}
              </div>
            )}

          </Suspense>
        </main>
      </div>
    </div>
  );
}

// ── Admin-only gate for input/audit/admin sections ────────────────────────────
function RequireAdmin({ label, children }: { label: string; children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && canAccessView(user.role, 'admin')) return <>{children}</>;
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(148,163,184,0.85)' }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>🔒</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#e2eaf4' }}>{label} is admin-only</div>
      <div style={{ fontSize: 12, marginTop: 6 }}>
        Your access level (<strong style={{ color: '#fbbf24' }}>{roleLabel(user?.role)}</strong>) is
        view-and-reports only. Sign in with an admin account to use input, audit or admin tools.
      </div>
    </div>
  );
}

// ── Level gate - three logins, three interfaces ───────────────────────────────
//  rms   → mobile-first field capture shell (inputs only)
//  super → full dashboards & reports, no input/audit/admin
//  admin → everything
function AppGate() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) return <LoginPage />;

  // Identity Manager: new users await admin approval; revoked users are blocked.
  if (user.access === 'pending' || user.access === 'revoked') return <AccessPending />;

  if (isFieldRole(user.role)) {
    return (
      <Suspense fallback={<ModuleSpinner />}>
        <RMSFieldShell />
      </Suspense>
    );
  }

  return (
    <>
      <AppShell />
      <Suspense fallback={null}>
        <RoadAssetBot />
      </Suspense>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [highlightedLinks, setHighlightedLinks] = useState<string[]>([]);

  return (
    <AuthProvider>
      <BotHighlightContext.Provider value={{ highlightedLinks, setHighlightedLinks }}>
        <BMSProvider>
          <AppGate />
        </BMSProvider>
      </BotHighlightContext.Provider>
    </AuthProvider>
  );
}
