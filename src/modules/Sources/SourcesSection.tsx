/**
 * SourcesSection — Sources & Evidence unified 2-tab view.
 * Tabs: Evidence Catalogue | Tabular Summaries (which has its own sub-tabs)
 * Follows the exact BMS tab-bar pattern.
 */
import { lazy, Suspense, useState } from 'react';
import { FileText, Table2, BookOpen } from 'lucide-react';

const SRC_Catalogue = lazy(() => import('./SourcesCatalogueSection'));
const SRC_Tables    = lazy(() => import('./TabularSummaries'));
const SRC_Dictionary = lazy(() => import('./DataDictionary'));

function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '2px solid rgba(77,159,255,0.18)', borderTopColor: '#4d9fff',
        animation: 'src-spin .8s linear infinite',
      }}/>
    </div>
  );
}

const MAIN_TABS = [
  { id: 'catalogue'  as const, label: 'Evidence Catalogue',  icon: <FileText size={13}/> },
  { id: 'tables'     as const, label: 'Tabular Summaries',   icon: <Table2 size={13}/> },
  { id: 'dictionary' as const, label: 'Data Dictionary',     icon: <BookOpen size={13}/> },
];
type TabId = typeof MAIN_TABS[number]['id'];

export default function SourcesSection() {
  const [tab, setTab] = useState<TabId>('catalogue');

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(2,5,8,0.97)',
      fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>

        {/* ── Definition Card ── */}
        <div style={{background:'rgba(99,102,241,0.04)',border:'1px solid rgba(99,102,241,0.14)',borderRadius:16,padding:'20px 24px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{fontSize:36,lineHeight:1,flexShrink:0}}>📚</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
              <span style={{fontSize:18,fontWeight:800,color:'rgba(99,102,241,1)',letterSpacing:-0.5}}>Data Sources & Catalogue</span>
              <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>UBOS · URF · World Bank · AfDB · OpenStreetMap</span>
            </div>
            <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 10px',lineHeight:1.6}}>Comprehensive catalogue of data feeds, spatial layers, and statistical sources underpinning Uganda NRMS — including UBOS census, URF work plans, World Bank indicators, AfDB project data, and OpenStreetMap base layers.</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {["Supabase DB","UBOS Data","URF Records","World Bank","AfDB Stats","OpenStreetMap"].map(b=>(
                <span key={b} style={{background:'rgba(99,102,241,0.12)',color:'rgba(99,102,241,0.9)',fontSize:9,fontWeight:700,borderRadius:20,padding:'2px 8px',textTransform:'uppercase' as const,letterSpacing:0.5}}>{b}</span>
              ))}
            </div>
          </div>
        </div>
      <style>{`
        @keyframes src-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* ── BMS-style main tab bar ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 2, padding: '0 14px', flexShrink: 0,
        borderBottom: '1px solid rgba(77,159,255,0.15)',
        background: 'rgba(4,9,18,0.85)',
      }}>
        {MAIN_TABS.map(t => {
          const isActive = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px 11px', fontSize: 11, fontWeight: isActive ? 800 : 500,
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              color: isActive ? '#4d9fff' : 'rgba(148,163,184,0.70)',
              borderBottom: isActive ? '2px solid #4d9fff' : '2px solid transparent',
              transition: 'all 0.13s',
            }}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Content area ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Suspense fallback={<Spinner />}>
          {tab === 'catalogue'  && <SRC_Catalogue />}
          {tab === 'tables'     && <SRC_Tables />}
          {tab === 'dictionary' && <SRC_Dictionary />}
        </Suspense>
      </div>
    </div>
  );
}
