/**
 * Road Network Visual Intelligence Atlas
 *
 * Self-contained view rendered within the RMS shell. Displays the full national
 * road network intelligence: historical timeline, charts, 3D spatial view,
 * regional breakdown, asset values, condition cycles, and project pipeline.
 *
 * Data source: useDashboardBundle (live API at /api/dashboard-bundle or
 * /data/bundle.json static fallback for offline use).
 */
import { lazy, Suspense } from 'react';
import '../../styles/roadAtlas.css';

// Heavy atlas content is lazy-loaded to keep the initial chunk small
const AtlasContent = lazy(() => import('./AtlasContent'));

function AtlasSpinner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: '#030712',
    }}>
      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
        <div style={{
          width: 40, height: 40,
          border: '2px solid #1e3a5f',
          borderTopColor: '#f97316',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p style={{ fontSize: 12, letterSpacing: '0.1em' }}>Loading Visual Atlas…</p>
      </div>
    </div>
  );
}

export default function RoadAtlasView() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', background: '#030712' }}>

        {/* ── Definition Card ── */}
        <div style={{background:'rgba(139,92,246,0.04)',border:'1px solid rgba(139,92,246,0.14)',borderRadius:16,padding:'20px 24px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{fontSize:36,lineHeight:1,flexShrink:0}}>🗺️</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
              <span style={{fontSize:18,fontWeight:800,color:'rgba(139,92,246,1)',letterSpacing:-0.5}}>Uganda Road Atlas</span>
              <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>Visual Atlas · Network Maps · Classification · MoWT · UNRA</span>
            </div>
            <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 10px',lineHeight:1.6}}>Visual road atlas for Uganda's classified road network - providing printable maps, network schematics, road classification layouts, and spatial reference material aligned with UNRA and MoWT national road design standards.</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {["Visual Atlas","Road Maps","Classification","Print Ready","UNRA / MoWT","Spatial Ref"].map(b=>(
                <span key={b} style={{background:'rgba(139,92,246,0.12)',color:'rgba(139,92,246,0.9)',fontSize:9,fontWeight:700,borderRadius:20,padding:'2px 8px',textTransform:'uppercase' as const,letterSpacing:0.5}}>{b}</span>
              ))}
            </div>
          </div>
        </div>
      <Suspense fallback={<AtlasSpinner />}>
        <AtlasContent />
      </Suspense>
    </div>
  );
}
