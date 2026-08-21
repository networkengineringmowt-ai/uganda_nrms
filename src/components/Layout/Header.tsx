import { Bell, Search, RefreshCw, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useBMS } from '../../store/BMSContext';
import { UserBadge } from '../../modules/Auth/UserBadge';

const CURR = new Date().getFullYear();   // dynamic current year â never hardcode

const VIEW_TITLES: Record<string, { title: string; sub: string; color?: string }> = {
  rms:           { title: 'RMS â Road Management System', sub: 'Overview Â· Road network map Â· Road inventory Â· Network story', color: '#00f5ff' },
  bms:           { title: 'Bridge Management System',     sub: 'Dashboard Â· Structure map Â· Inventory & condition Â· Bridge works', color: '#4d9fff' },
  lifecycle:     { title: 'Life Cycle Management',        sub: 'Per-link timeline Â· IRI trajectory Â· Intervention history Â· Projected maintenance', color: '#00d4aa' },
  budget:        { title: 'Budget & Maintenance',         sub: 'Maintenance financing Â· Unit-cost matrix Â· MTEF planning', color: '#ff2d78' },
  pim:           { title: 'Public Investment',            sub: 'PIM funding Â· PPP projects Â· Donor vs GoU financing', color: '#ffd23f' },
  projecttracker:{ title: 'Projects & Works',             sub: 'Execution tracking Â· Physical vs financial progress', color: '#00ff88' },
  oprc:          { title: 'OPRC Contracts',               sub: 'Output & performance-based road contracts Â· 6 lots', color: '#00ff88' },
  ndpiv:         { title: 'NDP IV Investment',            sub: 'National Development Plan IV road projects & funding', color: '#b967ff' },
  overloading:   { title: 'Overloading & ESAL',           sub: 'Axle-load risk index Â· Weighbridge analytics Â· Hotspot map', color: '#ff3366' },
  growthfactors: { title: 'Traffic Growth Factors',       sub: 'Monthly / seasonal expansion factors Â· Annual growth', color: '#00d4aa' },
  trafficanalytics: { title: 'Traffic Analytics',         sub: 'AADT trends Â· Vehicle composition Â· Regional distribution', color: '#00f5ff' },
  trafficsummary:{ title: 'Traffic Summary Tables',       sub: 'Road links & stations Â· TIS counts', color: '#00f5ff' },
  maintenanceprogramme: { title: 'Maintenance Programme', sub: 'Priority-ranked interventions Â· PMS programme', color: '#ff6b35' },
  mlarchitecture:{ title: 'ML System Architecture',       sub: 'Model pipeline Â· Deep learning components', color: '#b967ff' },
  tabularsummaries: { title: 'Tabular Summaries',         sub: '100 cited tables Â· Platform data hub', color: '#00f5ff' },
  dataaudit:     { title: 'Data Audit',                   sub: 'Cross-section KPI validation Â· Coverage & freshness', color: '#ffd23f' },
  datacapture:   { title: 'Data Capture',                 sub: 'Field data entry Â· Writes to the live Supabase database', color: '#00d4aa' },
  pendingsurveys:{ title: 'Pending Submissions',          sub: 'Queued condition surveys awaiting export', color: '#ffd23f' },
  // Platform
  network:       { title: 'Network Overview',              sub: 'Dashboard Â· Road Network Map Â· Network Story Â· Architecture', color: '#6366f1' },
  admin:         { title: 'Admin Tools',                   sub: 'Platform Mind Map Â· Data Audit Â· System Architecture',        color: '#00f5ff' },
  sources:       { title: 'Sources & Evidence',            sub: 'Evidence Catalogue Â· Tabular Summaries Â· Documents Â· Downloads', color: '#94a3b8' },
  platform:      { title: 'Platform Overview',            sub: 'Uganda National Roads Management Platform',             color: '#00f5ff' },
  networkstory:  { title: 'Network Story 1986â',          sub: 'Road network development since liberation Â· 40-year arc', color: '#b967ff' },
  roadnetwork:   { title: 'Road Network Map',             sub: '1,017 national road links Â· 21,302 km official (FY25-26) Â· Data: DNR GIS / NDPIV FY25-26', color: '#00ff88' },
  casestudies:   { title: 'Global Case Studies',          sub: 'World map Â· Comparative analytics Â· Literature Review Matrix (195 countries) Â· Lessons for DNR', color: '#00d4aa' },
  roadreserve:   { title: 'Road Reserve Management',      sub: 'Gazette status Â· Reserve corridor map Â· Encroachment register Â· Legal enforcement', color: '#00d4aa' },
  roadvideoview: { title: 'Road Survey Video',             sub: 'Road surface video archive Â· 2021â2026',               color: '#ff6b35' },
  traffic:       { title: 'Traffic & Demand',             sub: `Network traffic counts Â· base year 2016 Â· projected to ${CURR} Â· 298 TCS stations`,   color: '#ffd23f' },
  roadcondition: { title: 'Pavement Management',          sub: `Road condition Â· IRI Â· HDM-4 Â· maintenance programme Â· as of ${CURR}`,    color: '#fb923c' },
  atc:           { title: 'ATC Live Dashboard',           sub: 'Automatic Traffic Counters Â· 10 permanent mother stations Â· Jul 2025âpresent', color: '#ffd23f' },
  projects:      { title: 'Projects & Road Development',  sub: 'Ongoing upgrading & construction contracts Â· FY 2025/26', color: '#ff2d78' },
  // BMS
  gismap:        { title: 'Structure Map',                   sub: 'GIS structure map Â· All bridges & major culverts Â· 2018â2024 time series', color: '#00ff88' },
  dashboard:     { title: 'BMS Dashboard',                sub: 'Bridge Management System Â· DNR',                        color: '#00f5ff' },
  registry:      { title: 'Structure Registry',           sub: '546 bridges Â· 452 culverts Â· 998 total',        color: '#4d9fff' },
  inspections:   { title: 'Inspection Management',        sub: 'Schedule, record and track field inspections',          color: '#ffd23f' },
  condition:     { title: 'Condition Assessment',         sub: 'Component ratings and defect analysis',                 color: '#ff6b35' },
  maintenance:   { title: 'Maintenance & Works',          sub: 'Work orders, contracts and maintenance records',        color: '#b967ff' },
  analytics:     { title: 'Analytics & Reports',          sub: 'Condition trends, cost analysis and network insights',  color: '#00f5ff' },
  priority:      { title: 'Priority Ranking',             sub: 'Risk-based intervention priority scores',               color: '#ff2d78' },
  documents:     { title: 'Document Store',               sub: 'Drawings, reports, contracts and records',             color: '#4d9fff' },
  media:         { title: 'Media and Document Gallery',   sub: 'Photography, video surveys, field reports & documents Â· Uganda national roads', color: '#b967ff' },
  phototwin:     { title: 'Photo Gallery & Digital Twin', sub: 'Inspection photos and structural schematics',          color: '#00ff88' },
  // Newly-wired sections â keep banner chrome consistent with the rest of the platform
  roadatlas:     { title: 'Road Atlas',                   sub: 'Visual intelligence atlas Â· 21,160 km mapped national network Â· DNR GIS', color: '#00d4aa' },
  roadvideo:     { title: 'Road Video Survey',            sub: 'Georeferenced pavement survey video Â· frame-by-frame Â· 2021â2026', color: '#ff6b35' },
  bridgeworks:   { title: 'Bridge Works Programme',       sub: 'Bridge & major-culvert development projects Â· MoWT status report', color: '#4d9fff' },
  downloads:     { title: 'Downloads & Exports',          sub: 'Network, bridge & culvert inventory Â· WGS84 shapefiles Â· CSV Â· GeoJSON', color: '#94a3b8' },
  gisenterprise: { title: 'GIS Enterprise',               sub: 'Enterprise GIS architecture Â· client / service / data layers Â· WMS & tile services', color: '#b967ff' },
  hdm4:          { title: 'HDM-4 Analysis',               sub: 'Highway Development & Management Â· works cost matrix Â· economic appraisal', color: '#00f5ff' },
};

export default function Header({ showSearch, onMenuClick }: { showSearch?: boolean; onMenuClick?: () => void }) {
  const { state, navigate, goBack, goForward, canGoBack, canGoForward } = useBMS();
  const [query, setQuery] = useState('');
  const [now, setNow]     = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(t);
  }, []);

  const meta        = VIEW_TITLES[state.activeView] ?? { title: state.activeView, sub: 'DNR Â· Ministry of Works & Transport', color: '#00f5ff' };
  const accent      = meta.color ?? '#00f5ff';
  const accentRgb   = hexToRgb(accent);

  const criticalCount = state.structures.filter(s => s.conditionRating === 1).length;
  const dueCount      = state.structures.filter(s => s.inspectionDue).length;
  const alertCount    = criticalCount + dueCount;

  return (
    <header
      className="flex items-center gap-2 flex-shrink-0"
      style={{
        padding: '3px 12px',
        background: 'rgba(2,2,2,0.88)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderBottom: `1px solid rgba(${accentRgb},0.12)`,
        boxShadow: `0 1px 0 rgba(${accentRgb},0.06), 0 4px 24px rgba(0,0,0,0.4)`,
        transition: 'border-color 0.4s, box-shadow 0.4s',
        zIndex: 10,
      }}
    >
      {/* Accent stripe */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
        background: `linear-gradient(to bottom, transparent, ${accent}, transparent)`,
        opacity: 0.7,
      }}/>

      {/* Mobile hamburger â opens the sidebar drawer, hidden on desktop */}
      <button
        className="mobile-menu-btn"
        onClick={onMenuClick}
        aria-label="Open menu"
        style={{
          display: 'none', flexShrink: 0,
          width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
          borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.85)',
          cursor: 'pointer',
        }}
      >
        <Menu size={16}/>
      </button>

      {/* Back / Forward navigation */}
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        <button
          onClick={goBack}
          disabled={!canGoBack}
          title="Go back"
          style={{
            padding: '5px 7px', borderRadius: 7, cursor: canGoBack ? 'pointer' : 'default',
            background: canGoBack ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${canGoBack ? `rgba(${accentRgb},0.25)` : 'rgba(255,255,255,0.05)'}`,
            color: canGoBack ? accent : 'rgba(100,116,139,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            opacity: canGoBack ? 1 : 0.4,
          }}
          onMouseEnter={e => {
            if (canGoBack) {
              (e.currentTarget as HTMLButtonElement).style.background = `rgba(${accentRgb},0.12)`;
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background =
              canGoBack ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)';
          }}
        >
          <ChevronLeft size={14}/>
        </button>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          title="Go forward"
          style={{
            padding: '5px 7px', borderRadius: 7, cursor: canGoForward ? 'pointer' : 'default',
            background: canGoForward ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${canGoForward ? `rgba(${accentRgb},0.25)` : 'rgba(255,255,255,0.05)'}`,
            color: canGoForward ? accent : 'rgba(100,116,139,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            opacity: canGoForward ? 1 : 0.4,
          }}
          onMouseEnter={e => {
            if (canGoForward) {
              (e.currentTarget as HTMLButtonElement).style.background = `rgba(${accentRgb},0.12)`;
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background =
              canGoForward ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)';
          }}
        >
          <ChevronRight size={14}/>
        </button>
      </div>

      {/* MoWT crest */}
      <img
        src={`${import.meta.env.BASE_URL}mowt.jpg`}
        alt="Ministry of Works and Transport"
        style={{
          width: 24, height: 24, borderRadius: 7, flexShrink: 0, objectFit: 'contain',
          background: '#fff', padding: 2,
          border: `1px solid rgba(${accentRgb},0.3)`,
          boxShadow: `0 0 14px rgba(${accentRgb},0.18)`,
          transition: 'border-color 0.4s, box-shadow 0.4s',
        }}
      />

      {/* Muted breadcrumb + live clock only â the section's own header is the title
          (this removes the duplicate "double" header). */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'rgba(148,163,184,0.45)', flexShrink: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {meta.title}
        </span>
        <span style={{ fontSize: 9, color: 'rgba(100,116,139,0.7)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {now.toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}{' '}
          <span style={{ fontFamily: 'monospace', color: accent, opacity: 0.75 }}>
            {now.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} EAT
          </span>
        </span>
      </div>

      {/* Search */}
      {showSearch && (
        <div style={{ position: 'relative', width: 260, flexShrink: 0 }}>
          <Search size={12} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'rgba(0,245,255,0.4)',
          }}/>
          <input
            className="bms-input"
            style={{ paddingLeft: 28, paddingTop: 6, paddingBottom: 6, fontSize: 12 }}
            placeholder="Search structures, roads, IDsâ¦"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      )}

      {/* Alert bell */}
      <button
        onClick={() => navigate('priority')}
        title={`${alertCount} alerts`}
        style={{
          position: 'relative',
          padding: '6px', borderRadius: 8, flexShrink: 0,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(148,163,184,0.7)',
          cursor: 'pointer', transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
          (e.currentTarget as HTMLButtonElement).style.color = '#e2eaf4';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(148,163,184,0.7)';
        }}
      >
        <Bell size={14}/>
        {alertCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            width: 15, height: 15, borderRadius: '50%',
            background: '#ff3366', boxShadow: '0 0 8px #ff3366',
            fontSize: 8, fontWeight: 800, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </button>

      {/* Refresh */}
      <button
        onClick={() => window.location.reload()}
        title="Reload"
        style={{
          padding: '6px', borderRadius: 8, flexShrink: 0,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(148,163,184,0.7)',
          cursor: 'pointer', transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
          (e.currentTarget as HTMLButtonElement).style.color = '#e2eaf4';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(148,163,184,0.7)';
        }}
      >
        <RefreshCw size={14}/>
      </button>

      {/* User badge (role-aware) */}
      <UserBadge />
    </header>
  );
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}
