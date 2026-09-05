/**
 * NetworkSection - Network Overview unified 4-tab view.
 * Tabs:
 *   1. Platform Dashboard  - high-level KPI overview
 *   2. Road Network Map    - full-screen GeoJSON map + timeline
 *   3. Network Story       - scrollytelling 1986-to-now narrative
 *
 * Follows the exact BMS tab-bar pattern:
 *   borderBottom '1px solid rgba(77, 159, 255,0.15)'
 *   active:   color '#4d9fff', borderBottom '2px solid #4d9fff', fontWeight 800
 *   inactive: color 'rgba(148,163,184,0.70)', borderBottom '2px solid transparent'
 */
import { lazy, Suspense, useState } from 'react';
import { LayoutDashboard, Map, BookOpen } from 'lucide-react';
import type { ActiveView } from '../../index';

const NET_PlatformDashboard   = lazy(() => import('../PlatformDashboard/PlatformDashboard'));
const NET_RoadNetworkView     = lazy(() => import('../RoadNetwork/RoadNetworkView'));
const NET_NetworkStory        = lazy(() => import('../NetworkStory/NetworkStory'));

function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '2px solid rgba(77, 159, 255,0.18)', borderTopColor: '#4d9fff',
        animation: 'net-spin .8s linear infinite',
      }}/>
    </div>
  );
}

const MAIN_TABS = [
  { id: 'dashboard'    as const, label: 'Platform Dashboard', icon: <LayoutDashboard size={13}/> },
  { id: 'roadnetwork'  as const, label: 'Road Network Map',   icon: <Map size={13}/> },
  { id: 'networkstory' as const, label: 'Network Story',      icon: <BookOpen size={13}/> },
];

type TabId = typeof MAIN_TABS[number]['id'];

export default function NetworkSection() {
  const [tab, setTab] = useState<TabId>('dashboard');

  // Road Network Map and Network Story need full-height no-overflow treatment
  const isFullHeight = tab === 'roadnetwork' || tab === 'networkstory';

  const contentStyle: React.CSSProperties = isFullHeight
    ? { flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }
    : { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(2,5,8,0.97)',
      fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>

        {/* ── Definition Card ── */}
        <div style={{background:'rgba(34,197,94,0.04)',border:'1px solid rgba(34,197,94,0.14)',borderRadius:16,padding:'20px 24px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{fontSize:36,lineHeight:1,flexShrink:0}}>🌐</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
              <span style={{fontSize:18,fontWeight:800,color:'rgba(34,197,94,1)',letterSpacing:-0.5}}>Uganda Road Network</span>
              <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>UNRA · MoWT · 21,302km · National Connectivity · NDPIV</span>
            </div>
            <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 10px',lineHeight:1.6}}>National road network management hub - integrating UNRA inventory, condition assessments, traffic data, and NDPIV connectivity targets for the complete 21,302km classified road network spanning national, district, and community access classes.</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {["21,302km Network","UNRA Registry","NDPIV Targets","GIS Linked","Condition Data","Traffic Counts"].map(b=>(
                <span key={b} style={{background:'rgba(34,197,94,0.12)',color:'rgba(34,197,94,0.9)',fontSize:9,fontWeight:700,borderRadius:20,padding:'2px 8px',textTransform:'uppercase' as const,letterSpacing:0.5}}>{b}</span>
              ))}
            </div>
          </div>
        </div>
      <style>{`
        @keyframes net-spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
      `}</style>

      {/* ── BMS-style main tab bar ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 2, padding: '0 14px', flexShrink: 0,
        borderBottom: '1px solid rgba(77, 159, 255,0.15)',
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
      <div style={contentStyle}>
        <Suspense fallback={<Spinner />}>

          {/* Tab 1: Platform Dashboard - scrollable */}
          {tab === 'dashboard' && <NET_PlatformDashboard />}

          {/* Tab 2: Road Network Map - full-height, position absolute */}
          {tab === 'roadnetwork' && (
            <div style={{ position: 'absolute', inset: 0 }}>
              <NET_RoadNetworkView />
            </div>
          )}

          {/* Tab 3: Network Story - full-height, self-scrolling */}
          {tab === 'networkstory' && (
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
              <NET_NetworkStory />
            </div>
          )}


        </Suspense>
      </div>
    </div>
  );
}
