/**
 * nbms.tsx - standalone entry for the Uganda National Bridge Management System.
 * Mounts ONLY the BMS section (Dashboard · Structure Map · Inventory & Condition
 * incl. the Digital Twin · Bridge Works) in the providers it needs, with its own
 * branded header. Deployed separately to networkengineringmowt-ai/uganda_nbms.
 *
 * Three access levels (matching the main NRMS platform):
 *   rms   → mobile-first field capture shell (data entry only)
 *   super → full BMS dashboards & reports (read-only)
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

const BMSSection = lazy(() => import('./modules/BMS/BMSSection'));
const RMSFieldShell = lazy(() => import('./modules/RMS/RMSFieldShell'));

function Header() {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      padding: '8px 16px', background: 'rgba(2,2,2,0.9)',
      borderBottom: '1px solid rgba(100, 210, 255,0.15)',
    }}>
      <img src={`${import.meta.env.BASE_URL}mowt.jpg`} alt="MoWT"
        style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain',
          background: '#fff', padding: 2, border: '1px solid rgba(100, 210, 255,0.3)' }} />
      <div style={{ lineHeight: 1.25 }}>

        {/* ── Definition Card ── */}
        <div style={{background:'rgba(14,165,233,0.04)',border:'1px solid rgba(14,165,233,0.14)',borderRadius:16,padding:'20px 24px',marginBottom:24,display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{fontSize:36,lineHeight:1,flexShrink:0}}>🌉</div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
              <span style={{fontSize:18,fontWeight:800,color:'rgba(14,165,233,1)',letterSpacing:-0.5}}>National Bridge Management System</span>
              <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>NBMS · UNRA · MoWT · NBI Protocol · AfDB Standards</span>
            </div>
            <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 10px',lineHeight:1.6}}>National Bridge Management System for Uganda - providing a comprehensive national-level view of bridge condition, load capacity, inspection schedules, and maintenance investment needs across the UNRA and MoWT managed bridge portfolio.</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {["NBI Protocol","National Network","UNRA / MoWT","Condition Rating","AfDB Standards","MoWT Policy"].map(b=>(
                <span key={b} style={{background:'rgba(14,165,233,0.12)',color:'rgba(14,165,233,0.9)',fontSize:9,fontWeight:700,borderRadius:20,padding:'2px 8px',textTransform:'uppercase' as const,letterSpacing:0.5}}>{b}</span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#64d2ff', letterSpacing: '0.04em' }}>
          Uganda National Bridge Management System
        </div>
        <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.6)' }}>
          Ministry of Works &amp; Transport · Department of National Roads · NBMS
        </div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#30d158',
          boxShadow: '0 0 6px #30d158' }} />
        <span style={{ fontSize: 9.5, color: 'rgba(48, 209, 88,0.7)', fontWeight: 700 }}>System Online</span>
      </div>
    </header>
  );
}

function ModuleSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%',
        border: '2px solid rgba(75,99,130,0.4)', borderTopColor: '#64d2ff',
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

  // bms → mobile-first field capture shell (bridge inspection data entry)
  if (user.role === 'bms') {
    return (
      <Suspense fallback={<ModuleSpinner />}>
        <RMSFieldShell />
      </Suspense>
    );
  }

  // super / admin → full BMS dashboards & reports
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#000000', overflow: 'hidden' }}>
      <Header />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Suspense fallback={<ModuleSpinner />}>
          <BMSSection />
        </Suspense>
      </div>
    </div>
  );
}

function NBMSApp() {
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
    <NBMSApp />
  </StrictMode>,
);
