import React, { lazy, Suspense, useState } from 'react';
import CrossLinkChipBar from '../../shared/CrossLinkChipBar';
import type { RoadConditionTabId } from '../RoadCondition/RoadConditionView';
import SectionDashboard from '../Dashboard/SectionDashboard';

const CrossSectionAnalytics = lazy(() => import('./CrossSectionAnalytics'));
const RoadConditionView = lazy(() => import('../RoadCondition/RoadConditionView'));
const PavementCatalogue = lazy(() => import('./PavementCatalogue'));
const AIVisionDashboard = lazy(() => import('./AIVisionDashboard'));
const DigitalTwin = lazy(() => import('./DigitalTwin'));
// NPMSSection removed — was imported from '../../sections/NPMSSection' which does not exist
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

// 6 sub-tabs — all PMS content merged, no duplicates:
// Dashboard  = section KPIs + condition distribution + summary (Supabase live)
// Condition Map = network condition map
// Inventory & Surveys = inventory/surveys + road video survey
// Analytics = deterioration + pavement age + FWD/structural
// Life Cycle = life cycle management
// Design & AI Tools = design catalogue + AI defect vision + 3D digital twin
const MAIN_TABS: Array<{ id: MainTab; label: string }> = [
  { id: 'dashboard',  label: 'Dashboard' },
  { id: 'conditionmap', label: 'Condition Map' },
  { id: 'surveys',    label: 'Inventory & Surveys' },
  { id: 'analytics',  label: 'Analytics & Deterioration' },
  { id: 'lifecycle',  label: 'Life Cycle Management' },
  { id: 'design',     label: 'Design Catalogue & AI Tools' },
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

        {/* ── Definition Card ── */}
        <div style={{background:'rgba(245,158,11,0.04)',border:'1px solid rgba(245,158,11,0.14)',borderRadius:16,padding:'20px 24px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{fontSize:36,lineHeight:1,flexShrink:0}}>🛣️</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
              <span style={{fontSize:18,fontWeight:800,color:'rgba(245,158,11,1)',letterSpacing:-0.5}}>Pavement Management System</span>
              <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>HDM-4 · IRI Survey · PCI Rating · Treatment Design · URF</span>
            </div>
            <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 10px',lineHeight:1.6}}>Integrated pavement management system combining HDM-4 deterioration modelling, IRI roughness surveys, PCI condition ratings, and AI-assisted treatment design for optimal URF budget allocation across Uganda's national road network.</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {["HDM-4 Modelled","IRI Survey","PCI Rating","Treatment Design","URF Priority","AfDB Standards"].map(b=>(
                <span key={b} style={{background:'rgba(245,158,11,0.12)',color:'rgba(245,158,11,0.9)',fontSize:9,fontWeight:700,borderRadius:20,padding:'2px 8px',textTransform:'uppercase' as const,letterSpacing:0.5}}>{b}</span>
              ))}
            </div>
          </div>
        </div>
      <style>{`
        @keyframes pms-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .npms-workspace-tab:hover { color: #a7b4c7 !important; }
      `}</style>

      {!import.meta.env.VITE_STANDALONE && <CrossLinkChipBar sectionId="pms" />}

      <main style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Suspense fallback={<Spinner />}>
          <SectionDashboard sectionId="pms" accent="#4d9fff" />
        </Suspense>
      </main>
    </div>
  );
}
