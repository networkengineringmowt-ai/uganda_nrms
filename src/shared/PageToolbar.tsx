/**
 * PageToolbar - Back / Scroll-to-top / Export cluster, fixed to the top-right
 * corner of every page and section on the platform. Mounted once in App.tsx
 * so it shows up everywhere without every section needing to render its own.
 *
 * The Export menu is tab-aware: it subscribes to activeSubTabStore (published
 * by SectionSubTabs in SectionDashboard.tsx) so the offered formats and their
 * order match whichever of the six section sub-tabs is actually on screen -
 * data formats (CSV/XLSX/JSON) lead on Exhaustive Tables / Deep Analytics,
 * a .sql download + "Copy SQL" lead on SQL Database & Schema, and PNG/PDF
 * visual snapshots lead everywhere else (Dashboard / Interactive Map / Data
 * Capture). CSV/XLSX/JSON are sourced generically by scanning the content
 * pane for its first rendered <table> (see scanFirstTable in exportUtils.ts);
 * SQL is sourced the same way from the first <pre> - see that file for why a
 * DOM scan was chosen over per-module callback plumbing. A one-click "Copy"
 * action next to the section title covers the common case (paste into
 * Excel/Sheets, or paste SQL into a client) without opening a save dialog.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ArrowUp, ArrowLeft, Download, Loader2, ChevronDown,
  FileImage, FileType, FileText, FileSpreadsheet, Braces, Database, Check, Copy,
} from 'lucide-react';
import { useBMS } from '../store/BMSContext';
import {
  exportElementToPNG, exportElementToPDF, exportTableToCSV, exportTableToXLSX,
  exportTableToJSON, exportTextFile, copyRowsToClipboard, copyTextToClipboard,
  scanFirstTable, scanFirstPre,
} from './exportUtils';
import { subscribeActiveSubTab, getActiveSubTab } from './activeSubTabStore';

const CONTENT_PANE_ID = 'nrms-content-pane';
const ACCENT = '#00f5ff';

type FormatId = 'png' | 'pdf' | 'csv' | 'xlsx' | 'json' | 'sql';
type Phase = 'idle' | 'loading' | 'success';
type CopyPhase = 'idle' | 'copied';

interface FormatDef {
  id: FormatId;
  label: string;
  sub: string;
  icon: typeof FileImage;
  requiresTable?: boolean;
  requiresSql?: boolean;
}

const FORMAT_DEFS: Record<FormatId, FormatDef> = {
  png:  { id: 'png',  label: 'PNG Image',       sub: 'Snapshot of current view',              icon: FileImage },
  pdf:  { id: 'pdf',  label: 'PDF Document',     sub: 'Print-ready, paginated snapshot',        icon: FileType },
  csv:  { id: 'csv',  label: 'CSV Spreadsheet',  sub: 'Raw rows from the on-screen table',      icon: FileText,       requiresTable: true },
  xlsx: { id: 'xlsx', label: 'Excel Workbook',   sub: 'Styled .xlsx of the on-screen table',    icon: FileSpreadsheet, requiresTable: true },
  json: { id: 'json', label: 'JSON Data',        sub: 'Raw rows, machine-readable',             icon: Braces,         requiresTable: true },
  sql:  { id: 'sql',  label: 'SQL File (.sql)',  sub: 'DDL shown on this schema tab',           icon: Database,       requiresSql: true },
};

// Which formats appear, and in what order, per section sub-tab - the leading
// formats are what that tab's content actually is; the rest stay one click
// away rather than disappearing, since a legacy component can still surface
// a table or chart outside the tab's primary shape.
const TAB_FORMAT_ORDER: Record<string, FormatId[]> = {
  dashboard: ['png', 'pdf', 'csv', 'xlsx', 'json'],
  map:       ['png', 'pdf', 'csv', 'xlsx', 'json'],
  tables:    ['csv', 'xlsx', 'json', 'png', 'pdf'],
  analytics: ['csv', 'xlsx', 'json', 'png', 'pdf'],
  sql:       ['sql', 'png', 'pdf'],
  capture:   ['png', 'pdf', 'csv', 'xlsx', 'json'],
};

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
  const activeTab = useSyncExternalStore(subscribeActiveSubTab, getActiveSubTab);

  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [hasTable, setHasTable] = useState(false);
  const [hasSql, setHasSql] = useState(false);
  const [phase, setPhase] = useState<Record<FormatId, Phase>>({ png: 'idle', pdf: 'idle', csv: 'idle', xlsx: 'idle', json: 'idle', sql: 'idle' });
  const [copyPhase, setCopyPhase] = useState<CopyPhase>('idle');
  const busy = Object.values(phase).some(p => p !== 'idle');

  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Re-scan whenever the menu opens AND whenever the visible tab changes
  // while it's open (a user can flip tabs without closing the menu first).
  const rescan = () => {
    const scanned = scanFirstTable(CONTENT_PANE_ID);
    setHasTable(!!scanned && scanned.rows.length > 0);
    setHasSql(!!scanFirstPre(CONTENT_PANE_ID));
  };

  const openMenu = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    rescan();
    setIsClosing(false);
    setIsOpen(true);
  };

  useEffect(() => {
    if (isOpen) rescan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab.tabId, activeTab.sectionId]);

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
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const baseName = () => {
    const sec = activeTab.sectionId || state.activeView || 'view';
    return `nrms-${sec}-${activeTab.tabId}`;
  };

  const runExport = async (fmt: FormatDef) => {
    if (busy) return;
    if (fmt.requiresTable && !hasTable) return;
    if (fmt.requiresSql && !hasSql) return;

    setPhase(p => ({ ...p, [fmt.id]: 'loading' }));
    const name = baseName();
    // Safety net: PNG/PDF capture shells out to html-to-image, which walks
    // and clones the entire content pane. A data-dense dashboard (many
    // Recharts SVGs) can legitimately take 20-30s to capture even with no
    // network involved - 45s gives that real work room to finish, while
    // still guaranteeing the toolbar can never lock up forever on a genuine
    // hang (an unreachable resource, a browser quirk).
    const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([
      p,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('export timed out')), ms)),
    ]);
    try {
      if (fmt.id === 'png') {
        await withTimeout(exportElementToPNG(CONTENT_PANE_ID, name), 45000);
      } else if (fmt.id === 'pdf') {
        // PDF pays the same capture cost as PNG, plus slicing the captured
        // image into page-height chunks - observed to run noticeably longer
        // than PNG on a tall, chart-dense page, so it gets more headroom.
        await withTimeout(exportElementToPDF(CONTENT_PANE_ID, name), 60000);
      } else if (fmt.id === 'csv') {
        const scanned = scanFirstTable(CONTENT_PANE_ID);
        if (scanned && scanned.rows.length) exportTableToCSV(scanned.rows, name);
      } else if (fmt.id === 'xlsx') {
        const scanned = scanFirstTable(CONTENT_PANE_ID);
        if (scanned && scanned.rows.length) await withTimeout(exportTableToXLSX(scanned.rows, scanned.headers, name), 45000);
      } else if (fmt.id === 'json') {
        const scanned = scanFirstTable(CONTENT_PANE_ID);
        if (scanned && scanned.rows.length) exportTableToJSON(scanned.rows, name);
      } else if (fmt.id === 'sql') {
        const sql = scanFirstPre(CONTENT_PANE_ID);
        if (sql) exportTextFile(sql, name, 'sql');
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

  // One-click clipboard copy, contextual to the tab: SQL text on the schema
  // tab, otherwise the scanned table as tab-separated rows (pastes straight
  // into Excel/Sheets). No file dialog, no filename - the fast path for
  // "I just want this in my clipboard."
  const copyEnabled = activeTab.tabId === 'sql' ? hasSql : hasTable;
  const runCopy = async () => {
    if (!copyEnabled || copyPhase === 'copied') return;
    let ok = false;
    if (activeTab.tabId === 'sql') {
      const sql = scanFirstPre(CONTENT_PANE_ID);
      if (sql) ok = await copyTextToClipboard(sql);
    } else {
      const scanned = scanFirstTable(CONTENT_PANE_ID);
      if (scanned && scanned.rows.length) ok = await copyRowsToClipboard(scanned.rows);
    }
    if (!ok) return;
    setCopyPhase('copied');
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyPhase('idle'), 1400);
  };

  const anyLoading = Object.values(phase).some(p => p === 'loading');
  const order = TAB_FORMAT_ORDER[activeTab.tabId] ?? TAB_FORMAT_ORDER.dashboard;
  const formats = order.map(id => FORMAT_DEFS[id]);

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
          title={`Export ${activeTab.tabLabel}`}
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
              position: 'absolute', top: 36, right: 0, width: 278,
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
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
              padding: '4px 4px 8px',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 9, fontWeight: 800, color: 'rgba(148,163,184,0.75)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>
                  Export as
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: ACCENT, marginTop: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {activeTab.tabLabel}
                </div>
              </div>
              <button
                role="menuitem"
                disabled={!copyEnabled || busy}
                title={copyEnabled ? (activeTab.tabId === 'sql' ? 'Copy SQL to clipboard' : 'Copy table to clipboard (paste into Excel/Sheets)') : 'Nothing to copy on this tab'}
                onClick={runCopy}
                className="pt-copy-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                  padding: '5px 8px', borderRadius: 7,
                  background: copyPhase === 'copied' ? 'rgba(52,211,153,0.14)' : `${ACCENT}12`,
                  border: `1px solid ${copyPhase === 'copied' ? 'rgba(52,211,153,0.4)' : ACCENT + '30'}`,
                  color: copyPhase === 'copied' ? '#34d399' : ACCENT,
                  cursor: !copyEnabled || busy ? 'default' : 'pointer',
                  opacity: !copyEnabled ? 0.4 : 1,
                  fontSize: 10, fontWeight: 700,
                }}
              >
                {copyPhase === 'copied' ? <Check size={12} /> : <Copy size={12} />}
                {copyPhase === 'copied' ? 'Copied' : 'Copy'}
              </button>
            </div>

            {formats.map((fmt, i) => {
              const disabled = (!!fmt.requiresTable && !hasTable) || (!!fmt.requiresSql && !hasSql);
              const itemPhase = phase[fmt.id];
              const Icon = fmt.icon;
              return (
                <button
                  key={fmt.id}
                  role="menuitem"
                  disabled={disabled || busy}
                  title={disabled ? (fmt.requiresSql ? 'No SQL shown on this tab' : 'No table on this view') : `Export as ${fmt.label}`}
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
                      {itemPhase === 'loading' && (fmt.id === 'png' || fmt.id === 'pdf')
                        ? 'Generating, up to 30s for full pages...'
                        : disabled ? (fmt.requiresSql ? 'No SQL shown on this tab' : 'No table on this view') : fmt.sub}
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
        .pt-copy-btn:not(:disabled):hover {
          filter: brightness(1.25);
        }
        .pt-copy-btn:not(:disabled):active {
          transform: scale(0.96);
        }
      `}</style>
    </div>
  );
}
