import React, { lazy, Suspense, useState } from 'react';
import CrossLinkChipBar from '../../shared/CrossLinkChipBar';
import type { RoadConditionTabId } from '../RoadCondition/RoadConditionView';
import SectionDashboard from '../Dashboard/SectionDashboard';

const CrossSectionAnalytics = lazy(() => import('./CrossSectionAnalytics'));
const RoadConditionView = lazy(() => import('../RoadCondition/RoadConditionView'));
const PavementCatalogue = lazy(() => import('./PavementCatalogue'));
const AIVisionDashboard = lazy(() => import('./AIVisionDashboard'));
const DigitalTwin = lazy(() => import('./DigitalTwin'));
const NPMSSection = lazy(() => import('../../sections/NPMSSection'));
const LifecycleView = lazy(() => import('../Lifecycle/LifecycleView'));
const RoadVideoView = lazy(() => import('../RoadVideoView/RoadVideoView'));

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

type MainTab = 'dashboard' | 'conditionmap' | 'surveys' | 'analytics' | 'lifecycle' | 'design';

// 6 sub-tabs â all PMS content merged, no duplicates:
//   Dashboard          = cross-section analytics + national pavement infographics
//   Condition Map      = network condition map
//   Inventory & Surveys= inventory/surveys + road video survey
//   Analytics          = deterioration + pavement age + FWD/structural
//   Life Cycle         = life cycle management
//   Design & AI Tools  = design catalogue + AI defect vision + 3D digital twin
const MAIN_TABS: Array<{ id: MainTab; label: string }> = [
  { id: 'dashboard',    label: 'Dashboard' },
  { id: 'conditionmap', label: 'Condition Map' },
  { id: 'surveys',      label: 'Inventory & Surveys' },
  { id: 'analytics',    label: 'Analytics & Deterioration' },
  { id: 'lifecycle',    label: 'Life Cycle Management' },
  { id: 'design',       label: 'Design Catalogue & AI Tools' },
];

const Block = ({ children }: { children: React.ReactNode }) => (
  <div style={{ minHeight: '86vh', display: 'flex', flexDirection: 'column',
    borderBottom: '1px solid rgba(93,167,255,0.15)' }}>{children}</div>
);

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

      <main style={{ flex: 1, minHeight: 0,
        overflow: mainTab === 'conditionmap' ? 'hidden' : 'auto' }}>
        <Suspense fallback={<Spinner />}>
          {mainTab === 'dashboard' && (<>
            <Block><CrossSectionAnalytics /></Block>
            <Block><NPMSSection /></Block>
          </>)}
          {mainTab === 'conditionmap' && (
            <RoadConditionView activeTab={'conditionmap' as RoadConditionTabId} embedded />
          )}
          {mainTab === 'surveys' && (<>
            <Block><RoadConditionView activeTab={'inventory' as RoadConditionTabId} embedded /></Block>
            <Block><RoadVideoView /></Block>
          </>)}
          {mainTab === 'analytics' && (<>
            <Block><RoadConditionView activeTab={'analytics' as RoadConditionTabId} embedded /></Block>
            <Block><RoadConditionView activeTab={'age' as RoadConditionTabId} embedded /></Block>
            <Block><RoadConditionView activeTab={'fwd' as RoadConditionTabId} embedded /></Block>
          </>)}
          {mainTab === 'lifecycle' && <LifecycleView />}
          {mainTab === 'design' && (<>
            <Block><PavementCatalogue /></Block>
            <Block><AIVisionDashboard /></Block>
            <Block><DigitalTwin /></Block>
          </>)}
        </Suspense>
      </main>
    </div>
  );
}
