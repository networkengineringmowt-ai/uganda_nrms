import { lazy, Suspense, useState } from 'react';
import CrossLinkChipBar from '../../shared/CrossLinkChipBar';
import type { RoadConditionTabId } from '../RoadCondition/RoadConditionView';

const CrossSectionAnalytics = lazy(() => import('./CrossSectionAnalytics'));
const RoadConditionView = lazy(() => import('../RoadCondition/RoadConditionView'));
const PavementCatalogue = lazy(() => import('./PavementCatalogue'));
const AIVisionDashboard = lazy(() => import('./AIVisionDashboard'));
const DigitalTwin = lazy(() => import('./DigitalTwin'));

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '2px solid rgba(77,159,255,0.35)', borderTopColor: '#4d9fff',
        animation: 'pms-spin 0.8s linear infinite',
      }} />
    </div>
  );
}

type MainTab = 'dashboard' | RoadConditionTabId | 'catalogue' | 'ai_vision' | 'digital_twin';

const MAIN_TABS: Array<{ id: MainTab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'conditionmap', label: 'Condition Map' },
  { id: 'inventory', label: 'Inventory & Surveys' },
  { id: 'analytics', label: 'Analytics & Deterioration' },
  { id: 'age', label: 'Pavement Age' },
  { id: 'fwd', label: 'FWD & Structural' },
  { id: 'catalogue', label: 'Design Catalogue' },
  { id: 'ai_vision', label: 'AI Defect Vision' },
  { id: 'digital_twin', label: '3D Digital Twin' },
];

const ROAD_CONDITION_TABS = new Set<MainTab>([
  'conditionmap', 'inventory', 'analytics', 'age', 'fwd',
]);

export default function PMSSection() {
  const [mainTab, setMainTab] = useState<MainTab>('dashboard');

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#070b16', fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      <style>{`
        @keyframes pms-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .npms-workspace-tab:hover { color: #a7b4c7 !important; }
      `}</style>

      {!import.meta.env.VITE_STANDALONE && <CrossLinkChipBar sectionId="pms" />}

      <nav aria-label="NPMS workspaces" style={{
        display: 'flex', gap: 30, padding: '0 18px',
        borderBottom: '1px solid #1b2433', background: '#05070b', flexShrink: 0,
        overflowX: 'auto', scrollbarWidth: 'thin', whiteSpace: 'nowrap',
      }}>
        {MAIN_TABS.map(tab => {
          const isActive = tab.id === mainTab;
          return (
            <button
              className="npms-workspace-tab"
              key={tab.id}
              type="button"
              onClick={() => setMainTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'flex', alignItems: 'center', padding: '12px 0 11px',
                fontSize: 11, fontWeight: isActive ? 800 : 600,
                background: 'none', border: 'none', cursor: 'pointer',
                color: isActive ? '#5da7ff' : '#747d8d',
                borderBottom: isActive ? '2px solid #5da7ff' : '2px solid transparent',
                transition: 'color 0.13s', flexShrink: 0,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <main style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Suspense fallback={<Spinner />}>
          {mainTab === 'dashboard' && <CrossSectionAnalytics />}
          {ROAD_CONDITION_TABS.has(mainTab) && (
            <RoadConditionView activeTab={mainTab as RoadConditionTabId} embedded />
          )}
          {mainTab === 'catalogue' && <PavementCatalogue />}
          {mainTab === 'ai_vision' && <AIVisionDashboard />}
          {mainTab === 'digital_twin' && <DigitalTwin />}
        </Suspense>
      </main>
    </div>
  );
}
