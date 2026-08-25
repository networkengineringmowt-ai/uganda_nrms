/**
 * PageToolbar - Back / Scroll-to-top / Export cluster, fixed to the top-right
 * corner of every page and section on the platform. Mounted once in App.tsx
 * so it shows up everywhere without every section needing to render its own.
 *
 * Export is a small animated dropdown offering PNG / PDF / CSV / XLSX. CSV
 * and XLSX are sourced generically by scanning the content pane for its
 * first rendered <table> (see scanFirstTable in exportUtils.ts) - see that
 * file for why a DOM scan was chosen over per-module callback plumbing.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp, ArrowLeft, Download, Loader2, ChevronDown,
  FileImage, FileType, FileText, FileSpreadsheet, Check,
} from 'lucide-react';
import { useBMS } from '../store/BMSContext';
import {
  exportElementToPNG, exportElementToPDF, exportTableToCSV, exportTableToXLSX,
  scanFirstTable,
} from './exportUtils';

const CONTENT_PANE_ID = 'nrms-content-pane';
const ACCENT = '#00f5ff';

type FormatId = 'png' | 'pdf' | 'csv' | 'xlsx';
type Phase = 'idle' | 'loading' | 'success';

interface FormatDef {
  id: FormatId;
  label: string;
  sub: string;
  icon: typeof FileImage;
  requiresTable?: boolean;
}

const FORMATS: FormatDef[] = [
  { id: 'png', label: 'PNG Image', sub: 'Snapshot of current view', icon: FileImage },
  { id: 'pdf', label: 'PDF Document', sub: 'Print-ready, paginated snapshot', icon: FileType },
  { id: 'csv', label: 'CSV Spreadsheet', sub: 'Raw data from the on-screen table', icon: FileText, requiresTable: true },
  { id: 'xlsx', label: 'Excel Workbook', sub: 'Styled .xlsx of the on-screen table', icon: FileSpreadsheet, requiresTable: true },
];

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

  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [hasTable, setHasTable] = useState(false);
  const [phase, setPhase] = useState<Record<FormatId, Phase>>({ png: 'idle', pdf: 'idle', csv: 'idle', xlsx: 'idle' });
  const busy = Object.values(phase).some(p => p !== 'idle');

  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the app <header> (when one is rendered - the two full-bleed map
  // views mount no header) so this cluster never paints over the header's
  // own bell/refresh/user-badge controls. Re-measures on view change, on
  // header resize, and on window resize so it stays correct as content changes.
  const [topOffset, setTopOffset] = useState(12);
  useEffect(() => {
    const headerEl = document.querySelector('header');
    const measure = () => {
      const el = document.querySelector('header');
      setTopOffset(el ? Math.round(el.getBoundingClientRect().bottom + 8) : 12);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (headerEl) ro.observe(headerEl);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [state.activeView]);

  const scrollToTop = () => {
    const pane = document.getElementById(CONTENT_PANE_ID);
    if (pane) pane.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeMenu = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 160);
  };

  const openMenu = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    const scanned = scanFirstTable(CONTENT_PANE_ID);
    setHasTable(!!scanned && scanned.rows.length > 0);
    setIsClosing(false);
    setIsOpen(true);
  };

  const toggleMenu = () => {
    if (busy) return;
    if (isOpen) closeMenu();
    else openMenu();
  };

  // Outside-click + Escape handling.
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  const runExport = async (fmt: FormatDef) => {
    if (busy) return;
    if (fmt.requiresTable && !hasTable) return;

    setPhase(p => ({ ...p, [fmt.id]: 'loading' }));
    const name = `nrms-${state.activeView || 'view'}`;
    try {
      if (fmt.id === 'png') {
        await exportElementToPNG(CONTENT_PANE_ID, name);
      } else if (fmt.id === 'pdf') {
        await exportElementToPDF(CONTENT_PANE_ID, name);
      } else if (fmt.id === 'csv') {
        const scanned = scanFirstTable(CONTENT_PANE_ID);
        if (scanned && scanned.rows.length) exportTableToCSV(scanned.rows, name);
      } else if (fmt.id === 'xlsx') {
        const scanned = scanFirstTable(CONTENT_PANE_ID);
        if (scanned && scanned.rows.length) await exportTableToXLSX(scanned.rows, scanned.headers, name);
      }
      setPhase(p => ({ ...p, [fmt.id]: 'success' }));
      successTimerRef.current = setTimeout(() => {
        setPhase(p => ({ ...p, [fmt.id]: 'idle' }));
        closeMenu();
      }, 1000);
    } catch (e) {
      console.error(`${fmt.id.toUpperCase()} export failed`, e);
      setPhase(p => ({ ...p, [fmt.id]: 'idle' }));
    }
  };

  const anyLoading = Object.values(phase).some(p => p === 'loading');

  return (
    <div style={{
      position: 'fixed', top: topOffset, right: 16, zIndex: 3000,
      display: 'flex', gap: 6, pointerEvents: 'none',
      transition: 'top 0.15s ease',
    }}>
      <div ref={rootRef} style={{ position: 'relative', display: 'flex', gap: 6, pointerEvents: 'auto' }}>
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
          title="Export this view"
          aria-label="Export this view"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={toggleMenu}
          disabled={busy}
          style={{
            ...BtnStyle(false),
            width: 'auto', gap: 6, padding: '0 9px',
            border: isOpen ? `1px solid ${ACCENT}80` : '1px solid rgba(255,255,255,0.10)',
            boxShadow: isOpen ? `0 0 0 3px ${ACCENT}1f, 0 0 16px ${ACCENT}33` : 'none',
            color: isOpen ? ACCENT : 'rgba(226,234,244,0.9)',
          }}
          onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(20,20,28,0.92)'; }}
          onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(8,8,12,0.82)'; }}
        >
          {anyLoading ? <Loader2 size={14} style={{ animation: 'pt-spin 0.8s linear infinite' }} /> : <Download size={14} />}
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.02em' }}>Export</span>
          <ChevronDown size={12} style={{ transition: 'transform 0.18s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </button>

        {isOpen && (
          <div
            role="menu"
            style={{
              position: 'absolute', top: 36, right: 0, width: 264,
              background: 'rgba(6,13,24,0.95)', backdropFilter: 'blur(16px)',
              border: `1px solid ${ACCENT}2e`, borderRadius: 12,
              boxShadow: `0 12px 36px rgba(0,0,0,0.55), 0 0 24px ${ACCENT}14`,
              padding: 8, transformOrigin: 'top right',
              animation: isClosing
                ? 'pt-menu-out 0.16s ease forwards'
                : 'pt-menu-in 0.2s cubic-bezier(0.16,1,0.3,1) forwards',
            }}
          >
            <div style={{
              fontSize: 9, fontWeight: 800, color: 'rgba(148,163,184,0.75)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              padding: '4px 8px 8px',
            }}>
              Export as
            </div>

            {FORMATS.map((fmt, i) => {
              const disabled = !!fmt.requiresTable && !hasTable;
              const itemPhase = phase[fmt.id];
              const Icon = fmt.icon;
              return (
                <button
                  key={fmt.id}
                  role="menuitem"
                  disabled={disabled || busy}
                  title={disabled ? 'No table on this view' : `Export as ${fmt.label}`}
                  onClick={() => runExport(fmt)}
                  className="pt-export-item"
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 8px', borderRadius: 8, border: '1px solid transparent',
                    background: 'transparent', textAlign: 'left', cursor: disabled || busy ? 'default' : 'pointer',
                    opacity: disabled ? 0.4 : 1,
                    animation: isClosing ? 'none' : `pt-item-in 0.28s cubic-bezier(0.16,1,0.3,1) ${i * 0.045}s both`,
                  }}
                >
                  <span style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    background: itemPhase === 'success' ? 'rgba(52,211,153,0.14)' : `${ACCENT}14`,
                    color: itemPhase === 'success' ? '#34d399' : ACCENT,
                    transition: 'background 0.2s, color 0.2s',
                  }}>
                    {itemPhase === 'loading' ? (
                      <Loader2 size={14} style={{ animation: 'pt-spin 0.8s linear infinite' }} />
                    ) : itemPhase === 'success' ? (
                      <Check size={15} style={{ animation: 'pt-check-pop 0.35s cubic-bezier(0.34,1.56,0.64,1)' }} />
                    ) : (
                      <Icon size={14} />
                    )}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: disabled ? 'rgba(226,234,244,0.5)' : 'rgba(226,234,244,0.95)' }}>
                      {itemPhase === 'success' ? 'Downloaded' : fmt.label}
                    </span>
                    <span style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.65)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {disabled ? 'No table on this view' : fmt.sub}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pt-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @keyframes pt-menu-in {
          from { opacity: 0; transform: scale(0.92) translateY(-6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pt-menu-out {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to   { opacity: 0; transform: scale(0.95) translateY(-4px); }
        }
        @keyframes pt-item-in {
          from { opacity: 0; transform: translateX(8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pt-check-pop {
          0%   { transform: scale(0.4); opacity: 0; }
          60%  { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        .pt-export-item:not(:disabled):hover {
          background: rgba(0,245,255,0.08) !important;
          border-color: ${ACCENT}40 !important;
          box-shadow: 0 0 0 1px ${ACCENT}22, 0 0 14px ${ACCENT}1a;
        }
        .pt-export-item:not(:disabled):hover span svg {
          transform: scale(1.12);
        }
        .pt-export-item span svg { transition: transform 0.15s ease; }
        .pt-export-item:not(:disabled):active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
}
