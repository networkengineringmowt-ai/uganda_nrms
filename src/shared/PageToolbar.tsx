/**
 * PageToolbar — Export / Back / Top cluster, fixed to the top-right corner of
 * every page and section on the platform. Mounted once in App.tsx so it shows
 * up everywhere without every section needing to render its own.
 */
import { useState } from 'react';
import { ArrowUp, ArrowLeft, Download, Loader2 } from 'lucide-react';
import { useBMS } from '../store/BMSContext';
import { exportElementToPNG } from './exportUtils';

const CONTENT_PANE_ID = 'nrms-content-pane';

function BtnStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 7,
    background: 'rgba(8,8,12,0.82)', border: '1px solid rgba(255,255,255,0.10)',
    color: disabled ? 'rgba(148,163,184,0.35)' : 'rgba(226,234,244,0.9)',
    cursor: disabled ? 'default' : 'pointer',
    backdropFilter: 'blur(10px)',
    transition: 'background 0.12s, border-color 0.12s',
  };
}

export default function PageToolbar() {
  const { state, goBack, canGoBack } = useBMS();
  const [exporting, setExporting] = useState(false);

  const scrollToTop = () => {
    const pane = document.getElementById(CONTENT_PANE_ID);
    if (pane) pane.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const name = `nrms-${state.activeView || 'view'}`;
      await exportElementToPNG(CONTENT_PANE_ID, name);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 12, right: 16, zIndex: 200,
      display: 'flex', gap: 6, pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
        <button
          title="Back"
          aria-label="Back"
          disabled={!canGoBack}
          onClick={() => canGoBack && goBack()}
          style={BtnStyle(!canGoBack)}
          onMouseEnter={e => { if (canGoBack) e.currentTarget.style.background = 'rgba(20,20,28,0.92)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(8,8,12,0.82)'; }}
        >
          <ArrowLeft size={14} />
        </button>
        <button
          title="Scroll to top"
          aria-label="Scroll to top"
          onClick={scrollToTop}
          style={BtnStyle(false)}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(20,20,28,0.92)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(8,8,12,0.82)'; }}
        >
          <ArrowUp size={14} />
        </button>
        <button
          title="Export this view as PNG"
          aria-label="Export this view as PNG"
          onClick={handleExport}
          disabled={exporting}
          style={BtnStyle(false)}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(20,20,28,0.92)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(8,8,12,0.82)'; }}
        >
          {exporting ? <Loader2 size={14} style={{ animation: 'pt-spin 0.8s linear infinite' }} /> : <Download size={14} />}
        </button>
      </div>
      <style>{`@keyframes pt-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
