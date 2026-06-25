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
import { LiveTicker } from './shared/LiveTicker';
import { usePavementLive } from './shared/liveEngine';

const PMSSection = lazy(() => import('./modules/PMS/PMSSection'));
const RMSFieldShell = lazy(() => import('./modules/RMS/RMSFieldShell'));

const kfmt = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(2) + 'M'
  : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k'
  : Math.round(n).toLocaleString('en-US');

/** Live pavement strip — carries every link's condition forward to now. */
function NpmsLiveBar() {
  const p = usePavementLive();
  return (
    <LiveTicker
      accent="#f59e0b"
      asOf={p.asOf}
      ready={p.ready}
      title="Condition nowcast · 1,013 links"
      metrics={[
        { label: 'Network IRI',  value: p.avgIRI.toFixed(3), unit: 'm/km', color: '#f59e0b', sub: 'km-weighted, live' },
        { label: 'Network VCI',  value: p.avgVCI.toFixed(1), unit: '/100', color: '#00f5ff', sub: 'condition index' },
        { label: 'Good',         value: kfmt(p.goodKm), unit: 'km', color: '#00ff88', sub: p.pctGood.toFixed(1) + '% of network' },
        { label: 'Fair',         value: kfmt(p.fairKm), unit: 'km', color: '#ffd23f', sub: p.pctFair.toFixed(1) + '%' },
        { label: 'Poor',         value: kfmt(p.poorKm), unit: 'km', color: '#ff3366', sub: p.pctPoor.toFixed(1) + '%' },
        { label: 'Paved age',    value: p.avgAge.toFixed(1), unit: 'yrs', color: '#b967ff', sub: 'since build / rehab' },
      ]}
    />
  );
}

function Header() {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      padding: '8px 16px', background: 'rgba(2,2,2,0.9)',
      borderBottom: '1px solid rgba(245,158,11,0.15)',
    }}>
      <img src={`${import.meta.env.BASE_URL}mowt.jpg`} alt="MoWT"
        style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain',
          background: '#fff', padding: 2, border: '1px solid rgba(245,158,11,0.3)' }} />
      <div style={{ lineHeight: 1.25 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#f59e0b', letterSpacing: '0.04em' }}>
          Uganda National Pavement Management System
        </div>
        <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.6)' }}>
          Ministry of Works &amp; Transport · Department of National Roads · NPMS
        </div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88',
          boxShadow: '0 0 6px #00ff88' }} />
        <span style={{ fontSize: 9.5, color: 'rgba(0,255,136,0.7)', fontWeight: 700 }}>System Online</span>
      </div>
    </header>
  );
}

function ModuleSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%',
        border: '2px solid rgba(245,158,11,0.4)', borderTopColor: '#f59e0b',
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
      background: '#000000', overflow: 'hidden' }}>
      <Header />
      <NpmsLiveBar />
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
