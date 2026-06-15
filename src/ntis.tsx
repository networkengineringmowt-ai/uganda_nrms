/**
 * ntis.tsx — standalone entry for the Uganda National Traffic Information System.
 * Mounts ONLY the TIS section (Traffic Map · Counts & Analysis · Trends & Risk ·
 * Station Directory — ATC counts, projections, growth/seasonal factors,
 * overloading & ESAL, network analytics) in its own provider stack with a
 * branded header. Supersedes the older uganda_atc app with the current UI.
 * Deployed separately to networkengineringmowt-ai/uganda_ntis.
 */
import { StrictMode, Suspense, lazy, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/transitions.css';
import { BMSProvider } from './store/BMSContext';
import { AuthProvider } from './modules/Auth/AuthContext';
import { BotHighlightContext } from './modules/AssetBot/types';

const TrafficSection = lazy(() => import('./modules/Traffic/TrafficSection'));

function Header() {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      padding: '8px 16px', background: 'rgba(2,5,8,0.9)',
      borderBottom: '1px solid rgba(0,245,255,0.15)',
    }}>
      <img src={`${import.meta.env.BASE_URL}mowt.jpg`} alt="MoWT"
        style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain',
          background: '#fff', padding: 2, border: '1px solid rgba(0,245,255,0.3)' }} />
      <div style={{ lineHeight: 1.25 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#00f5ff', letterSpacing: '0.04em' }}>
          Uganda National Traffic Information System
        </div>
        <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.6)' }}>
          Ministry of Works &amp; Transport · Department of National Roads · NTIS
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

function NTISApp() {
  const [highlightedLinks, setHighlightedLinks] = useState<string[]>([]);
  return (
    <AuthProvider>
      <BotHighlightContext.Provider value={{ highlightedLinks, setHighlightedLinks }}>
        <BMSProvider>
          <div style={{ height: '100vh', display: 'flex', flexDirection: 'column',
            background: '#0a0f1e', overflow: 'hidden' }}>
            <Header />
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <Suspense fallback={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%',
                    border: '2px solid rgba(75,99,130,0.4)', borderTopColor: '#00f5ff',
                    animation: 'bms-spin 0.8s linear infinite' }} />
                </div>
              }>
                <TrafficSection />
              </Suspense>
            </div>
          </div>
        </BMSProvider>
      </BotHighlightContext.Provider>
    </AuthProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NTISApp />
  </StrictMode>,
);
