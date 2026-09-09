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

        <div style={{background:'rgba(139,92,246,0.04)',border:'1px solid rgba(139,92,246,0.14)',borderRadius:10,padding:'10px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <span style={{fontSize:15,fontWeight:800,color:'rgba(139,92,246,1)',letterSpacing:-0.3}}>Uganda Road Atlas</span>
          <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>Visual Atlas · Network Maps · Classification · MoWT</span>
        </div>
      <Suspense fallback={<AtlasSpinner />}>
        <AtlasContent />
      </Suspense>
    </div>
  );
}
