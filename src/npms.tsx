/**
 * npms.tsx — standalone entry for the Uganda National Pavement Management System.
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
        <div style={{ fontSize: 14, fontWeight: 900, color: '#f4f7fb', letterSpacing: '0.02em' }}>
          Uganda <span style={{ color: '#5da7ff' }}>NPMS</span>
        </div>
        <div className="npms-header-subtitle" style={{ fontSize: 9.5, color: '#6f7b8f' }}>
          Ministry of Works &amp; Transport · Department of National Roads · NPMS
        </div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88',
          boxShadow: '0 0 6px #00ff88' }} />
        <span className="npms-header-user" style={{ fontSize: 9.5, color: '#8290a5', fontWeight: 700 }}>
          {user?.name ?? 'Authorised user'}
        </span>
        <span className="npms-header-online" style={{ fontSize: 9.5, color: 'rgba(0,255,136,0.7)', fontWeight: 700 }}>Online</span>
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
        border: '2px solid rgba(77,159,255,0.35)', borderTopColor: '#4d9fff',
        animation: 'bms-spin 0.8s linear infinite' }} />
    </div>
  );
}

// ── Level gate — three logins, three interfaces ───────────────────────────────
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
