import { Suspense } from 'react';
import CrossLinkChipBar from '../../shared/CrossLinkChipBar';
import SectionDashboard from '../Dashboard/SectionDashboard';

// NOTE: PMS sub-tab switching (Dashboard | Interactive Map | Exhaustive Tables |
// Deep Analytics | SQL Database & Schema | Data Capture) is owned entirely by
// <SectionDashboard> → SectionSubTabs below, which drives the actual content
// via SECTION_EXTRAS['pms']. This component only supplies the page chrome
// around it, so it holds no tab state of its own.

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '2px solid rgba(77, 159, 255,0.35)', borderTopColor: '#4d9fff',
        animation: 'pms-spin 0.8s linear infinite',
      }} />
    </div>
  );
}

export default function PMSSection() {
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
