/**
 * PageToolbar - Back / Scroll-to-top / Export cluster, fixed to the top-right
 * corner of every page and section on the platform. Mounted once in App.tsx
 * so it shows up everywhere without every section needing to render its own.
 *
 * Presentation: a floating "dock". At rest it collapses to a small glowing
 * orb (a kebab/more-options glyph) so it never crowds the header - hovering
 * it (or tapping it, for touch) expands it into a labelled Back / Top /
 * Export pill with richer hover/press feedback. The orb pulses gently until
 * the user's first-ever interaction with the dock (tracked in
 * localStorage['dnr_toolbar_used'], same convention as the rest of the app's
 * dnr_* keys), then settles down permanently. A one-time callout
 * (localStorage['dnr_toolbar_hint_seen']) introduces it and its keyboard
 * shortcuts the very first time a browser sees it, then never shows again.
 *
 * Shortcuts (skipped while typing in a field): Alt+Left = Back,
 * Alt+Up = scroll to top, Alt+E = toggle the Export menu. Firing one briefly
 * pops the dock open and flashes the segment that fired, so the shortcut's
 * effect is visible even if the dock was collapsed.
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
  ArrowUp, ArrowLeft, Download, Loader2, ChevronDown, MoreVertical, X,
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
const USED_KEY = 'dnr_toolbar_used';
const HINT_KEY = 'dnr_toolbar_hint_seen';

type FormatId = 'png' | 'pdf' | 'csv' | 'xlsx' | 'json' | 'sql';
type Phase = 'idle' | 'loading' | 'success';
type CopyPhase = 'idle' | 'copied';
type SegId = 'back' | 'top' | 'export';

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

function readFlag(key: string): boolean {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}
function writeFlag(key: string) {
  try { localStorage.setItem(key, '1'); } catch { /* private mode / full - ignore */ }
}

// Small floating label that appears below a trigger on hover/focus, with the
// action name plus its keyboard shortcut - richer and more consistent across
// browsers than the native title="" tooltip it replaces.
function HoverTip({ show, label, shortcut, align = 'right' }: { show: boolean; label: string; shortcut?: string; align?: 'right' | 'left' }) {
  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute', top: 'calc(100% + 8px)', [align]: 0,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 9px', borderRadius: 8, whiteSpace: 'nowrap', zIndex: 3002,
        background: 'rgba(6,13,24,0.97)', border: `1px solid ${ACCENT}40`,
        boxShadow: '0 10px 24px rgba(0,0,0,0.5)',
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(0.94)',
        pointerEvents: 'none',
        transition: 'opacity 0.14s ease, transform 0.14s ease',
      } as React.CSSProperties}
    >
      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(226,234,244,0.95)' }}>{label}</span>
      {shortcut && (
        <span style={{
          fontSize: 9, fontWeight: 800, color: ACCENT, letterSpacing: '0.02em',
          background: `${ACCENT}14`, border: `1px solid ${ACCENT}30`, borderRadius: 4, padding: '1px 5px',
        }}>
          {shortcut}
        </span>
      )}
    </div>
  );
}

export default function PageToolbar() {
  const { state, goBack, canGoBack } = useBMS();
  const activeTab = useSyncExternalStore(subscribeActiveSubTab, getActiveSubTab);

  // ── Dock expand/collapse ────────────────────────────────────────────────
  const [hovering, setHovering] = useState(false);
  const [pinned, setPinned] = useState(false);       // toggled by tapping the orb (touch-friendly)
  const [flash, setFlash] = useState<SegId | null>(null); // brief peek + pop when a shortcut fires
  const [hasUsed, setHasUsed] = useState(() => readFlag(USED_KEY));
  const [hoveredSeg, setHoveredSeg] = useState<SegId | null>(null);
  const usedRef = useRef(hasUsed);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Export menu ─────────────────────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [hasTable, setHasTable] = useState(false);
  const [hasSql, setHasSql] = useState(false);
  const [phase, setPhase] = useState<Record<FormatId, Phase>>({ png: 'idle', pdf: 'idle', csv: 'idle', xlsx: 'idle', json: 'idle', sql: 'idle' });
  const [copyPhase, setCopyPhase] = useState<CopyPhase>('idle');
  const busy = Object.values(phase).some(p => p !== 'idle');

  // ── First-visit hint ────────────────────────────────────────────────────
  const [hintVisible, setHintVisible] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (readFlag(HINT_KEY)) return;
    const showTimer = setTimeout(() => setHintVisible(true), 1400);
    return () => clearTimeout(showTimer);
  }, []);
  const dismissHint = () => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    setHintVisible(false);
    writeFlag(HINT_KEY);
  };
  useEffect(() => {
    if (!hintVisible) return;
    hintTimerRef.current = setTimeout(dismissHint, 8000);
    return () => { if (hintTimerRef.current) clearTimeout(hintTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintVisible]);

  const markUsed = () => {
    if (usedRef.current) return;
    usedRef.current = true;
    setHasUsed(true);
    writeFlag(USED_KEY);
  };

  const expanded = hovering || pinned || isOpen || flash !== null || hintVisible;

  const flashSeg = (seg: SegId) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlash(seg);
    flashTimerRef.current = setTimeout(() => setFlash(null), 900);
  };

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
    markUsed();
    if (isOpen) closeMenu();
    else openMenu();
  };

  // Outside-click + Escape handling. A click outside also un-pins the dock
  // (touch users tapped the orb open; tapping elsewhere closes it again).
  useEffect(() => {
    if (!isOpen && !pinned) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closeMenu();
        setPinned(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeMenu(); setPinned(false); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, pinned]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
  }, []);

  const baseName = () => {
    const sec = activeTab.sectionId || state.activeView || 'view';
    return `nrms-${sec}-${activeTab.tabId}`;
  };

  const runExport = async (fmt: FormatDef) => {
    if (busy) return;
    if (fmt.requiresTable && !hasTable) return;
    if (fmt.requiresSql && !hasSql) return;
    markUsed();

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
    markUsed();
    setCopyPhase('copied');
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyPhase('idle'), 1400);
  };

  // ── Keyboard shortcuts: Alt+Left (Back), Alt+Up (Top), Alt+E (Export) ────
  // Skipped while typing in a field, so they never fight a form or search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const tgt = e.target as HTMLElement | null;
      const tag = tgt?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!tgt?.isContentEditable;
      if (typing) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (canGoBack) { markUsed(); goBack(); flashSeg('back'); }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        markUsed(); scrollToTop(); flashSeg('top');
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        flashSeg('export');
        toggleMenu();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGoBack, isOpen, busy]);

  const anyLoading = Object.values(phase).some(p => p === 'loading');
  const order = TAB_FORMAT_ORDER[activeTab.tabId] ?? TAB_FORMAT_ORDER.dashboard;
  const formats = order.map(id => FORMAT_DEFS[id]);

  const segStyle = (id: SegId, disabled: boolean): React.CSSProperties => {
    const isFlash = flash === id;
    return {
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      height: 34, borderRadius: 9, flexShrink: 0,
      padding: id === 'export' ? '0 10px' : '0 11px',
      background: isFlash ? `${ACCENT}22` : 'rgba(10,10,15,0.88)',
      border: `1px solid ${isFlash ? ACCENT + '80' : 'rgba(255,255,255,0.10)'}`,
      color: disabled ? 'rgba(148,163,184,0.35)' : (isFlash ? ACCENT : 'rgba(226,234,244,0.92)'),
      cursor: disabled ? 'default' : 'pointer',
      backdropFilter: 'blur(10px)',
      transition: 'background 0.14s, border-color 0.14s, transform 0.14s, color 0.14s',
      transform: isFlash ? 'scale(1.07)' : 'scale(1)',
      boxShadow: isFlash ? `0 0 0 3px ${ACCENT}22, 0 0 18px ${ACCENT}30` : 'none',
      whiteSpace: 'nowrap',
    };
  };

  return (
    <div style={{
      position: 'fixed', top: topOffset, right: 16, zIndex: 3000,
      pointerEvents: 'none', transition: 'top 0.15s ease',
    }}>
      <div
        ref={rootRef}
        style={{ position: 'relative', pointerEvents: 'auto' }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Dock: kebab orb (always present, trailing edge) + Back/Top/Export
            segments that grow in from the left when expanded. Both layers
            share the same flex row so the whole cluster crossfades/slides
            as one piece rather than jumping. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: expanded ? 6 : 0 }}>
          <div
            className="pt-segs"
            style={{
              display: 'flex', alignItems: 'center', gap: expanded ? 6 : 0,
              maxWidth: expanded ? 420 : 0, opacity: expanded ? 1 : 0,
              overflow: 'hidden', pointerEvents: expanded ? 'auto' : 'none',
              transition: 'max-width 0.32s cubic-bezier(0.16,1,0.3,1), opacity 0.22s ease, gap 0.3s',
            }}
          >
            <div style={{ position: 'relative' }}>
              <button
                aria-label="Back"
                disabled={!canGoBack}
                onClick={() => { if (canGoBack) { markUsed(); goBack(); } }}
                onMouseEnter={() => setHoveredSeg('back')}
                onMouseLeave={() => setHoveredSeg(null)}
                style={segStyle('back', !canGoBack)}
                className="pt-seg-btn"
              >
                <ArrowLeft size={14} />
                <span style={{ fontSize: 10.5, fontWeight: 700 }}>Back</span>
              </button>
              <HoverTip show={hoveredSeg === 'back' && !busy} label="Go back" shortcut="Alt + ←" />
            </div>

            <div style={{ position: 'relative' }}>
              <button
                aria-label="Scroll to top"
                onClick={() => { markUsed(); scrollToTop(); }}
                onMouseEnter={() => setHoveredSeg('top')}
                onMouseLeave={() => setHoveredSeg(null)}
                style={segStyle('top', false)}
                className="pt-seg-btn"
              >
                <ArrowUp size={14} />
                <span style={{ fontSize: 10.5, fontWeight: 700 }}>Top</span>
              </button>
              <HoverTip show={hoveredSeg === 'top'} label="Scroll to top" shortcut="Alt + ↑" />
            </div>

            <div style={{ position: 'relative' }}>
              <button
                aria-label="Export this view"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onClick={toggleMenu}
                onMouseEnter={() => setHoveredSeg('export')}
                onMouseLeave={() => setHoveredSeg(null)}
                disabled={busy}
                className="pt-seg-btn"
                style={{
                  ...segStyle('export', false),
                  border: isOpen ? `1px solid ${ACCENT}80` : segStyle('export', false).border,
                  boxShadow: isOpen ? `0 0 0 3px ${ACCENT}1f, 0 0 16px ${ACCENT}33` : segStyle('export', false).boxShadow,
                  color: isOpen ? ACCENT : segStyle('export', false).color,
                }}
              >
                {anyLoading ? <Loader2 size={14} style={{ animation: 'pt-spin 0.8s linear infinite' }} /> : <Download size={14} />}
                <span style={{ fontSize: 10.5, fontWeight: 700 }}>Export</span>
                <ChevronDown size={12} style={{ transition: 'transform 0.18s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </button>
              <HoverTip show={hoveredSeg === 'export' && !isOpen} label="Export this view" shortcut="Alt + E" />

              {isOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute', top: 40, right: 0, width: 278,
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
          </div>

          {/* Orb: always visible. Toggles pin (touch-friendly); hover on the
              wrapper above already expands for mouse users. Pulses gently
              until the dock has been used once, ever, on this browser. */}
          <div style={{ position: 'relative' }}>
            <button
              aria-label={expanded ? 'Collapse page tools' : 'Page tools: Back, Top, Export'}
              aria-expanded={expanded}
              onClick={() => setPinned(p => !p)}
              onMouseEnter={() => setHoveredSeg(null)}
              className="pt-orb"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: expanded ? 'rgba(0,245,255,0.14)' : 'rgba(10,10,15,0.88)',
                border: `1px solid ${expanded ? ACCENT + '70' : 'rgba(255,255,255,0.14)'}`,
                color: expanded ? ACCENT : 'rgba(226,234,244,0.85)',
                cursor: 'pointer', backdropFilter: 'blur(10px)',
                transition: 'background 0.16s, border-color 0.16s, color 0.16s, transform 0.16s',
                transform: pinned ? 'rotate(90deg)' : 'rotate(0deg)',
                animation: (!hasUsed && !expanded) ? 'pt-breathe 2.6s ease-in-out infinite' : 'none',
              }}
            >
              {pinned ? <X size={15} /> : <MoreVertical size={15} />}
            </button>
          </div>
        </div>

        {/* First-visit hint callout - shown once ever per browser. */}
        {hintVisible && (
          <div
            role="status"
            style={{
              position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 236,
              background: 'rgba(6,13,24,0.97)', border: `1px solid ${ACCENT}45`,
              borderRadius: 12, padding: '11px 12px', zIndex: 3003,
              boxShadow: `0 14px 32px rgba(0,0,0,0.55), 0 0 22px ${ACCENT}1c`,
              animation: 'pt-hint-in 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>Page tools live here</div>
              <button
                aria-label="Dismiss"
                onClick={dismissHint}
                style={{ background: 'transparent', border: 'none', color: 'rgba(148,163,184,0.75)', cursor: 'pointer', padding: 0, lineHeight: 0 }}
              >
                <X size={13} />
              </button>
            </div>
            <div style={{ fontSize: 10.5, color: 'rgba(226,234,244,0.85)', marginTop: 5, lineHeight: 1.45 }}>
              Back, scroll-to-top and a tab-aware Export menu (PNG, PDF, CSV, Excel, JSON) - now with shortcuts:
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
              {(['Alt+←', 'Alt+↑', 'Alt+E'] as const).map(k => (
                <span key={k} style={{
                  fontSize: 9.5, fontWeight: 800, color: ACCENT, background: `${ACCENT}14`,
                  border: `1px solid ${ACCENT}30`, borderRadius: 5, padding: '2px 6px',
                }}>
                  {k}
                </span>
              ))}
            </div>
            <button
              onClick={dismissHint}
              style={{
                marginTop: 9, width: '100%', padding: '6px 0', borderRadius: 7,
                background: `${ACCENT}16`, border: `1px solid ${ACCENT}35`, color: ACCENT,
                fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
              }}
            >
              Got it
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pt-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @keyframes pt-breathe {
          0%, 100% { box-shadow: 0 0 0 0 ${ACCENT}00, 0 0 0 0 ${ACCENT}00; }
          50%      { box-shadow: 0 0 0 5px ${ACCENT}1a, 0 0 16px 2px ${ACCENT}33; }
        }

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
        @keyframes pt-hint-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .pt-seg-btn:not(:disabled):hover {
          background: rgba(0,245,255,0.10) !important;
          border-color: ${ACCENT}55 !important;
          transform: translateY(-1px);
        }
        .pt-seg-btn:not(:disabled):active {
          transform: scale(0.96);
        }
        .pt-orb:hover {
          transform: scale(1.08) !important;
        }
        .pt-orb:active {
          transform: scale(0.92) !important;
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

        @media (prefers-reduced-motion: reduce) {
          .pt-orb, .pt-seg-btn, .pt-export-item, .pt-copy-btn { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
