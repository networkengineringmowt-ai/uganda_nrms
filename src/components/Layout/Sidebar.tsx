import { useState } from 'react';
import {
  Activity, Shield, Construction, Layers, Network, Building2,
  DollarSign, Clock, Database, ShieldCheck, Route, Globe, Landmark,
  ChevronDown, Gauge, Map, Video, Hammer, FileText, Download,
  Leaf, BarChart3, TrendingUp,
  BookOpen, Navigation, ClipboardList, ClipboardCheck, MapPin, ListOrdered,
  Camera, LineChart, AlertTriangle, HardHat, Target, Cpu, BrainCircuit, ListTodo,
} from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import { useAuth } from '../../modules/Auth/AuthContext';
import { useDbStatus } from '../../shared/useDbStatus';
import type { ActiveView } from '../../index';

interface Section {
  id:     ActiveView;
  label:  string;
  icon:   React.ReactNode;
  color:  string;
}

interface Group {
  id:    string;
  label: string;
  icon:  React.ReactNode;
  color: string;
  items: ActiveView[];
}

const N = {
  indigo: '#5e5ce6', cyan:   '#00f5ff', orange: '#ff6b35',
  teal:   '#00d4aa', blue:   '#4d9fff', purple: '#b967ff',
  green:  '#00ff88', yellow: '#ffd23f', pink:   '#ff2d78',
  gray:   '#94a3b8',
};

// Per-section metadata (label / icon / colour) - looked up by id.
const SECTIONS: Record<string, Section> = {
  rms:           { id: 'rms',           label: 'RMS - Road Mgmt System',   icon: <Route size={14}/>,        color: N.cyan   },
  roadcondition: { id: 'roadcondition', label: 'Pavement Management',      icon: <Activity size={14}/>,     color: N.orange },
  npms:          { id: 'npms',          label: 'National PMS',              icon: <FileText size={14}/>,     color: N.orange },
  bms:           { id: 'bms',           label: 'Bridge Management',         icon: <Network size={14}/>,      color: N.blue   },
  roadreserve:   { id: 'roadreserve',   label: 'Road Reserve Management',   icon: <Landmark size={14}/>,     color: N.teal   },
  traffic:       { id: 'traffic',       label: 'Traffic Information',       icon: <Layers size={14}/>,       color: N.cyan   },
  ntis:          { id: 'ntis',          label: 'National Traffic Info (NTIS)', icon: <TrendingUp size={14}/>, color: N.cyan   },
  projects:      { id: 'projects',      label: 'Projects & Works',          icon: <Construction size={14}/>, color: N.green  },
  pim:           { id: 'pim',           label: 'Public Investment',         icon: <Building2 size={14}/>,    color: N.yellow },
  budget:        { id: 'budget',        label: 'Budget & Maintenance',      icon: <DollarSign size={14}/>,   color: N.pink   },
  lifecycle:     { id: 'lifecycle',     label: 'Life Cycle Management',     icon: <Clock size={14}/>,        color: N.teal   },
  casestudies:   { id: 'casestudies',   label: 'Global Case Studies',       icon: <Globe size={14}/>,        color: N.teal   },
  sources:       { id: 'sources',       label: 'Sources & Evidence',        icon: <Database size={14}/>,     color: N.gray   },
  admin:         { id: 'admin',         label: 'Admin Tools',               icon: <ShieldCheck size={14}/>,  color: N.cyan   },
  gisenterprise: { id: 'gisenterprise', label: 'GIS Enterprise',            icon: <Layers size={14}/>,       color: N.purple },
  atc:           { id: 'atc',           label: 'ATC Traffic Counters',      icon: <Gauge size={14}/>,        color: N.orange },
  roadatlas:     { id: 'roadatlas',     label: 'Road Atlas',                icon: <Map size={14}/>,          color: N.cyan   },
  roadvideo:     { id: 'roadvideo',     label: 'Road Video Survey',         icon: <Video size={14}/>,        color: N.cyan   },
  bridgeworks:   { id: 'bridgeworks',   label: 'Bridge Works Programme',    icon: <Hammer size={14}/>,       color: N.blue   },
  downloads:     { id: 'downloads',     label: 'Downloads',                 icon: <Download size={14}/>,     color: N.gray   },
  ducar:         { id: 'ducar',         label: 'DUCAR Roads',                icon: <Leaf size={14}/>,         color: N.green  },
  socioeconomic: { id: 'socioeconomic', label: 'Socio-Economic Analysis',   icon: <BarChart3 size={14}/>,    color: N.yellow },

  // Restored from history - these were standalone sidebar tabs before the
  // 6-tab hub consolidation folded their content into a parent section's
  // sub-tabs. The content never moved or was deleted, so this just gives
  // each one its own row again, per an explicit request to bring back every
  // tab that has ever existed in the nav.
  networkstory:    { id: 'networkstory',    label: 'Network Story 1986–', icon: <BookOpen size={14}/>,       color: N.purple },
  roadnetwork:     { id: 'roadnetwork',     label: 'Road Network Map',      icon: <Navigation size={14}/>,     color: N.cyan   },
  registry:        { id: 'registry',        label: 'Structure Registry',    icon: <ClipboardList size={14}/>,  color: N.blue   },
  inspections:     { id: 'inspections',     label: 'Inspection Management', icon: <ClipboardCheck size={14}/>, color: N.blue   },
  gismap:          { id: 'gismap',          label: 'Structure GIS Map',     icon: <MapPin size={14}/>,         color: N.blue   },
  priority:        { id: 'priority',        label: 'Priority Ranking',      icon: <ListOrdered size={14}/>,    color: N.pink   },
  phototwin:       { id: 'phototwin',       label: 'Photo & Digital Twin',  icon: <Camera size={14}/>,         color: N.blue   },
  trafficanalytics:{ id: 'trafficanalytics',label: 'Traffic Analytics',     icon: <LineChart size={14}/>,      color: N.cyan   },
  trafficsummary:  { id: 'trafficsummary',  label: 'Traffic Summary',       icon: <FileText size={14}/>,       color: N.cyan   },
  growthfactors:   { id: 'growthfactors',   label: 'Growth Factors',        icon: <TrendingUp size={14}/>,     color: N.orange },
  overloading:     { id: 'overloading',     label: 'Overloading Analytics', icon: <AlertTriangle size={14}/>,  color: N.orange },
  oprc:            { id: 'oprc',            label: 'OPRC Contracts',        icon: <HardHat size={14}/>,        color: N.green  },
  ndpiv:           { id: 'ndpiv',           label: 'NDP IV (Vision 2040)',  icon: <Target size={14}/>,         color: N.yellow },
  hdm4:            { id: 'hdm4',            label: 'HDM-4 Analysis',        icon: <Cpu size={14}/>,            color: N.teal   },
  mlarchitecture:  { id: 'mlarchitecture',  label: 'ML System Architecture',icon: <BrainCircuit size={14}/>,   color: N.purple },
  projecttracker:  { id: 'projecttracker',  label: 'Project Tracker',       icon: <ListTodo size={14}/>,       color: N.green  },
};

// Top-level tabs are grouped by which platform SYSTEM actually owns the
// content (RMS/BMS/TIS/Planning/Knowledge), not by a generic UI bucket -
// e.g. every bridge/culvert-related tab sits under BMS and nothing else,
// every traffic-related tab sits under TIS and nothing else, matching how
// the rest of the app (DEFS text, SECTION_ALIAS, module folder names) already
// names these systems. Navigation itself is unchanged (each child still
// calls navigate(id)); this is a presentation/IA grouping only.
// Nav trimmed to cut sidebar clutter, but ONLY for genuine duplicates: an id
// that SECTION_ALIAS maps onto another id's underlying data, making it
// byte-identical to a sibling (npms -> pms/roadcondition, nbms -> bms). Those
// stay folded/unreachable-by-nav. Everything else that has its own DEFS text
// AND its own dedicated SECTION_EXTRAS component (not just a description) is
// a clearly distinguishable tab, not a duplicate, and gets its own row here -
// per explicit request to restore every such standalone tab. 'ntis' is the
// one exception kept folded: it has DEFS text but no SECTION_EXTRAS component
// of its own (nothing distinguishes it from 'traffic'), so it would render as
// an empty near-duplicate if exposed - its content IS the TIS group below.
// OPRC, NDP IV, and Socio-Economic Analysis are deliberately their own rows:
// each is its own distinct dataset, not a generic sub-view of Projects/PIM.
// Registry, Inspections, Structure GIS Map, Priority Ranking, Photo & Digital
// Twin, and Bridge Works Programme are the BMS system's own family - bridges
// and major culverts, nothing else - each backed by its own dedicated
// component (BMS_Registry, BMS_Inspections, BMS_GISMap, LazyPriorityRanking,
// BMS_PhotoTwin, BMS_BridgeWorks), grouped with Bridge Management rather than
// only reachable as its sub-tabs. Traffic Analytics, Traffic Summary, Growth
// Factors, and Overloading Analytics are the TIS system's own family -
// everything traffic sits under TIS (Traffic Information Sytem / traffic ->
// 'tis' in SECTION_ALIAS), nothing else - each likewise backed by its own
// dedicated component. HDM-4 Analysis and Project Tracker are Planning-family
// tabs (life-cycle costing model runs; Gantt/Kanban project tracking). ML
// System Architecture is a platform/system doc, so it sits with Admin. See
// SECTION_EXTRAS in SectionDashboard.tsx for exactly where each one's content
// renders, both as its own tab and (where relevant) cross-linked inside a
// parent hub's own sub-tabs - a component appearing in both places is a
// deliberate cross-link, not a nav duplicate.
const GROUPS: Group[] = [
  { id: 'assets',    label: 'Network & Assets',      icon: <Network size={15}/>,      color: N.cyan,   items: [
    'rms', 'roadcondition', 'roadreserve', 'roadatlas', 'roadvideo', 'ducar',
    'networkstory', 'roadnetwork',
  ] },
  { id: 'bms',       label: 'BMS - Bridge Management', icon: <Hammer size={15}/>,     color: N.blue,   items: [
    'bms', 'registry', 'inspections', 'gismap', 'priority', 'phototwin', 'bridgeworks',
  ] },
  { id: 'traffic',   label: 'TIS - Traffic Information', icon: <Activity size={15}/>, color: N.orange, items: [
    'traffic', 'atc',
    'trafficanalytics', 'trafficsummary', 'growthfactors', 'overloading',
  ] },
  { id: 'planning',  label: 'Planning & Investment', icon: <Building2 size={15}/>,    color: N.green,  items: [
    'projects', 'pim', 'socioeconomic', 'budget', 'lifecycle', 'oprc', 'ndpiv',
    'hdm4', 'projecttracker',
  ] },
  { id: 'knowledge', label: 'Knowledge & Admin',     icon: <Shield size={15}/>,       color: N.purple, items: [
    'casestudies', 'sources', 'downloads', 'gisenterprise', 'admin', 'mlarchitecture',
  ] },
];

export default function Sidebar() {
  const { state, navigate } = useBMS();
  const { structures, activeView } = state;
  const { user } = useAuth();
  const dbStatus = useDbStatus();

  const criticalCount = structures.filter(s => s.conditionRating === 1).length;

  // super level: dashboards & reports only - Admin Tools stays hidden
  const isAdmin = user?.role === 'admin';
  const visibleGroups = GROUPS
    .map(g => ({ ...g, items: g.items.filter(id => id !== 'admin' || isAdmin) }))
    .filter(g => g.items.length > 0);

  // Which top-level tab is expanded - defaults to the one holding the active view.
  const groupOf = (view: string) =>
    visibleGroups.find(g => g.items.includes(view as ActiveView))?.id ?? visibleGroups[0]?.id;
  const [openGroup, setOpenGroup] = useState<string | undefined>(groupOf(activeView));

  return (
    <aside
      className="flex flex-col z-20 flex-shrink-0"
      style={{
        width: 240, minWidth: 240,
        background: 'rgba(8,14,28,0.72)',
        backdropFilter: 'blur(28px) saturate(200%)',
        WebkitBackdropFilter: 'blur(28px) saturate(200%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '4px 0 32px rgba(0,0,0,0.6), 1px 0 0 rgba(0, 245, 255,0.05)',
      }}
    >
      {/* Brand header */}
      <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid rgba(0, 245, 255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <img
            src={`${import.meta.env.BASE_URL}mowt.jpg`}
            alt="Ministry of Works and Transport"
            style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0, objectFit: 'contain',
              background: '#fff', padding: 2,
              border: '1px solid rgba(0, 245, 255,0.3)',
              boxShadow: '0 0 16px rgba(0, 245, 255,0.15)',
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div className="metallic-chrome" style={{ fontSize: 10, fontWeight: 900,
              letterSpacing: '0.12em', lineHeight: 1.2 }}>UGROADS</div>
            <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.04em' }}>
              Ministry of Works & Transport · DNR
            </div>
          </div>
        </div>
        <div style={{
          marginTop: 9, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(0, 245, 255,0.4), transparent)',
          animation: 'scanLineAnim 3s ease-in-out infinite',
        }}/>
      </div>

      {/* Network summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid rgba(0, 245, 255,0.08)' }}>
        <StatPill label="Roads"    value="21.3k" color={N.cyan} />
        <StatPill label="Bridges"  value={String(structures.filter(s=>s.type==='bridge').length)} color={N.blue} />
        <StatPill label="Critical" value={String(criticalCount)} color={N.pink} />
      </div>

      {/* ── 4 top-level tabs (accordion groups) ── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {visibleGroups.map(g => {
          const grp = hexToRgb(g.color);
          const isOpen = openGroup === g.id;
          const hasActive = g.items.includes(activeView as ActiveView);
          return (
            <div key={g.id} style={{ marginBottom: 4 }}>
              {/* Group header = top-level tab */}
              <button
                onClick={() => setOpenGroup(isOpen ? undefined : g.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '10px 11px', borderRadius: 8,
                  fontSize: 11.5, fontWeight: 800, letterSpacing: '0.02em',
                  cursor: 'pointer', border: 'none', textAlign: 'left',
                  transition: 'all 0.15s',
                  background: isOpen || hasActive ? `rgba(${grp},0.13)` : 'rgba(255,255,255,0.02)',
                  color: isOpen || hasActive ? g.color : 'rgba(203,213,225,0.85)',
                  borderLeft: hasActive ? `3px solid ${g.color}` : '3px solid transparent',
                }}
                onMouseEnter={e => { if (!isOpen && !hasActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (!isOpen && !hasActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)'; }}
              >
                <span style={{ color: g.color, flexShrink: 0,
                  filter: isOpen || hasActive ? `drop-shadow(0 0 6px ${g.color})` : 'none' }}>
                  {g.icon}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.label}
                </span>
                <ChevronDown size={13} style={{
                  flexShrink: 0, opacity: 0.7,
                  transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 0.2s',
                }}/>
              </button>

              {/* Child sections */}
              <div style={{
                overflow: 'hidden',
                maxHeight: isOpen ? `${g.items.length * 40 + 8}px` : '0px',
                transition: 'max-height 0.25s ease',
              }}>
                <div style={{ padding: '4px 0 4px 8px' }}>
                  {g.items.map(id => {
                    const s = SECTIONS[id];
                    if (!s) return null;
                    const isActive = activeView === id;
                    const rgb = hexToRgb(s.color);
                    return (
                      <button
                        key={id}
                        onClick={() => navigate(id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                          padding: '8px 11px', borderRadius: 7, marginBottom: 2,
                          fontSize: 10.5, fontWeight: isActive ? 800 : 600,
                          cursor: 'pointer', border: 'none', textAlign: 'left',
                          transition: 'all 0.15s',
                          background: isActive ? `rgba(${rgb},0.14)` : 'transparent',
                          color: isActive ? s.color : 'rgba(203,213,225,0.7)',
                          borderLeft: isActive ? `2px solid ${s.color}` : '2px solid transparent',
                        }}
                        onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = '#e2eaf4'; } }}
                        onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(203,213,225,0.7)'; } }}
                      >
                        <span style={{ color: isActive ? s.color : 'rgba(148,163,184,0.5)', flexShrink: 0,
                          filter: isActive ? `drop-shadow(0 0 5px ${s.color})` : 'none' }}>
                          {s.icon}
                        </span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.label}
                        </span>
                        {isActive && (
                          <span style={{
                            width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0,
                            boxShadow: `0 0 8px ${s.color}`, animation: 'pulse 2s ease-in-out infinite',
                          }}/>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(0, 245, 255,0.08)', textAlign: 'center' }}>
        <div style={{ fontSize: 7.5, color: 'rgba(100,116,139,0.45)', letterSpacing: '0.05em' }}>
          Uganda NRMS v4.0 · DNR 2026 (FY25-26)
        </div>
        {/* Real Supabase connectivity check (useDbStatus), not a decorative
            dot - this used to always read "System Online" in green even
            when the database was completely unreachable. */}
        <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%',
            background: dbStatus === 'connected' ? '#00ff88' : dbStatus === 'offline' ? '#ff2d78' : '#94a3b8',
            boxShadow: dbStatus === 'connected' ? '0 0 6px #00ff88' : dbStatus === 'offline' ? '0 0 6px #ff2d78' : 'none',
            animation: dbStatus !== 'offline' ? 'pulse 2s ease-in-out infinite' : 'none', display: 'inline-block' }}/>
          <span style={{ fontSize: 7.5,
            color: dbStatus === 'connected' ? 'rgba(0, 255, 136,0.6)' : dbStatus === 'offline' ? 'rgba(255, 45, 120,0.75)' : 'rgba(148,163,184,0.6)' }}>
            {dbStatus === 'connected' ? 'Database Connected' : dbStatus === 'offline' ? 'Database Offline' : 'Checking database…'}
          </span>
        </div>
      </div>
    </aside>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 4px',
      background: `rgba(${hexToRgb(color)}, 0.04)`,
      borderRight: '1px solid rgba(0, 245, 255,0.05)' }}>
      <span style={{ fontSize: 12, fontWeight: 900, lineHeight: 1, color,
        textShadow: `0 0 10px ${color}60` }}>{value}</span>
      <span style={{ fontSize: 6.5, color: 'rgba(100,116,139,0.55)', marginTop: 2,
        textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}
