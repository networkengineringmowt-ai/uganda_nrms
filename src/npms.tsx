/**
 * npms.tsx - standalone entry for the Uganda National Pavement Management System.
 * Mounts ONLY the PMS section in its own provider stack with a branded header.
 * Deployed separately to networkengineringmowt-ai/uganda_npms.
 *
 * Three access levels (matching the main NRMS platform):
 *   pms   → mobile-first field capture shell (data entry only)
 *   super → full PMS dashboards & reports (read-only)
 *   admin → everything
 */
import { StrictMode, Suspense, lazy, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/transitions.css';
import { BMSProvider } from './store/BMSContext';
import { AuthProvider, useAuth } from './modules/Auth/AuthContext';
import { LoginPage } from './modules/Auth/LoginPage';
import { AccessPending } from './modules/Auth/AccessPending';
import { BotHighlightContext } from './modules/AssetBot/types';

const PMSSection = lazy(() => import('./modules/PMS/PMSSection'));
const RMSFieldShell = lazy(() => import('./modules/RMS/RMSFieldShell'));

function Header() {
  const { logout, user } = useAuth();
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      minHeight: 50, padding: '7px 18px', background: '#070a0f',
      borderBottom: '1px solid #1b2433',
    }}>
      <img src={`${import.meta.env.BASE_URL}mowt.jpg`} alt="MoWT"
        style={{ width: 34, height: 34, borderRadius: 7, objectFit: 'contain',
          background: '#fff', padding: 2, border: '1px solid #273244' }} />
      <div style={{ lineHeight: 1.25 }}>

        {/* ── Definition Card ── */}
        <div style={{background:'rgba(245,158,11,0.04)',border:'1px solid rgba(245,158,11,0.14)',borderRadius:16,padding:'20px 24px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{fontSize:36,lineHeight:1,flexShrink:0}}>🛣️</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
              <span style={{fontSize:18,fontWeight:800,color:'rgba(245,158,11,1)',letterSpacing:-0.5}}>National Pavement Management System</span>
              <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>NPMS · HDM-4 · IRI Survey · PCI Rating · URF · AfDB</span>
            </div>
            <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 10px',lineHeight:1.6}}>National Pavement Management System for Uganda - delivering national-level pavement performance analytics, HDM-4 deterioration modelling, IRI roughness profiles, and PCI condition ratings to support strategic URF budget allocation.</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {["National PMS","HDM-4 Powered","IRI Survey","PCI Rating","URF Priority","AfDB Standards"].map(b=>(
                <span key={b} style={{background:'rgba(245,158,11,0.12)',color:'rgba(245,158,11,0.9)',fontSize:9,fontWeight:700,borderRadius:20,padding:'2px 8px',textTransform:'uppercase' as const,letterSpacing:0.5}}>{b}</span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#f4f7fb', letterSpacing: '0.02em' }}>
          Uganda <span style={{ color: '#5da7ff' }}>NPMS</span>
        </div>
        <div className="npms-header-subtitle" style={{ fontSize: 9.5, color: '#6f7b8f' }}>
          Ministry of Works &amp; Transport · Department of National Roads · NPMS
        </div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#30d158',
          boxShadow: '0 0 6px #30d158' }} />
        <span className="npms-header-user" style={{ fontSize: 9.5, color: '#8290a5', fontWeight: 700 }}>
          {user?.name ?? 'Authorised user'}
        </span>
        <span className="npms-header-online" style={{ fontSize: 9.5, color: 'rgba(48, 209, 88,0.7)', fontWeight: 700 }}>Online</span>
        <button type="button" onClick={logout} style={{
          marginLeft: 6, padding: '5px 9px', borderRadius: 7, cursor: 'pointer',
          border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(148,163,184,0.06)',
          color: 'rgba(226,232,240,0.75)', fontSize: 9.5, fontWeight: 700,
        }}>Sign out</button>
      </div>
      <style>{`
        @media (max-width: 720px) {
          .npms-header-subtitle, .npms-header-user { display: none; }
        }
        @media (max-width: 420px) {
          .npms-header-online { display: none; }
        }
      `}</style>
    </header>
  );
}

function ModuleSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%',
        border: '2px solid rgba(10, 132, 255,0.35)', borderTopColor: '#0a84ff',
        animation: 'bms-spin 0.8s linear infinite' }} />
    </div>
  );
}

// ── Level gate - three logins, three interfaces ───────────────────────────────
function AppGate() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) return <LoginPage />;

  // Identity Manager: new users await admin approval; revoked users blocked.
  if (user.access === 'pending' || user.access === 'revoked') return <AccessPending />;

  // pms → mobile-first field capture shell
  if (user.role === 'pms') {
    return (
      <Suspense fallback={<ModuleSpinner />}>
        <RMSFieldShell />
      </Suspense>
    );
  }

  // super / admin → full PMS dashboard
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#0a0f1e', overflow: 'hidden' }}>
      <Header />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Suspense fallback={<ModuleSpinner />}>
          <PMSSection />
        </Suspense>
      </div>
    </div>
  );
}

function NPMSApp() {
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NPMSApp />
  </StrictMode>,
);
