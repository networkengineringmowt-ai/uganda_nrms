/**
 * BMSSection — Bridge Management System unified view.
 * Main tabs: Dashboard · Structure Map · Inventory & Condition · Bridge Works.
 * Analytics, Priority Ranking and the Digital Twin live as sub-tabs under
 * Inventory & Condition (merged from the former Analytics & Digital Twin tab).
 */
import { lazy, Suspense, useState } from 'react';
import CrossLinkChipBar from '../../shared/CrossLinkChipBar';
const SectionDashboard = lazy(() => import('../Dashboard/SectionDashboard'));
import {
  LayoutDashboard, Map, Table2, BarChart3,
  ClipboardCheck, Activity, Wrench, AlertTriangle, Camera, Hammer,
} from 'lucide-react';

// ── Lazy-load all BMS sub-modules ─────────────────────────────────────────────
const BMS_Dashboard   = lazy(() => import('../Dashboard/Dashboard'));
const BMS_GISMap      = lazy(() => import('../GISMap/GISMapView'));
const BMS_Registry    = lazy(() => import('../Registry/StructureRegistry'));
const BMS_Inspections = lazy(() => import('../Inspections/InspectionManagement'));
const BMS_Condition   = lazy(() => import('../Condition/ConditionAssessment'));
const BMS_Maintenance = lazy(() => import('../Maintenance/MaintenanceWorks'));
const BMS_Analytics   = lazy(() => import('../Analytics/Analytics'));
const BMS_PhotoTwin   = lazy(() => import('../PhotoTwin/PhotoTwin'));
const BMS_BridgeWorks = lazy(() => import('../BridgeWorks/BridgeWorksSection'));
const BMS_Critical    = lazy(() => import('../Condition/CriticalStructures'));

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%',
        border: '2px solid rgba(75,99,130,0.4)', borderTopColor: '#00f5ff',
        animation: 'bms-spin 0.8s linear infinite' }} />
    </div>
  );
}

// ── Sub-tab bar for Tabs 3 and 4 ──────────────────────────────────────────────
interface SubTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

function SubTabBar({
  tabs, active, onSelect,
}: { tabs: SubTab[]; active: string; onSelect: (id: string) => void }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: '6px 14px 0',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(8,8,8,0.6)', flexShrink: 0,
    }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <button key={t.id} onClick={() => onSelect(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px 7px', fontSize: 10, fontWeight: isActive ? 700 : 500,
            background: 'none', border: 'none', cursor: 'pointer',
            color: isActive ? '#00f5ff' : 'rgba(148,163,184,0.65)',
            borderBottom: isActive ? '2px solid #00f5ff' : '2px solid transparent',
            transition: 'all 0.13s',
          }}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Main BMS Section ──────────────────────────────────────────────────────────
const MAIN_TABS = [
  { id: 'overview',   label: 'Dashboard',                 icon: <LayoutDashboard size={13}/> },
  { id: 'map',        label: 'Structure Map',              icon: <Map size={13}/> },
  { id: 'inventory',  label: 'Inventory & Condition',      icon: <Table2 size={13}/> },
  { id: 'works',      label: 'Bridge Works',               icon: <Hammer size={13}/> },
];

// Analytics & Digital Twin merged in here as sub-tabs (no separate main tab).
const INVENTORY_TABS: SubTab[] = [
  { id: 'registry',    label: 'Registry',    icon: <Table2 size={11}/> },
  { id: 'inspections', label: 'Inspections & Condition', icon: <ClipboardCheck size={11}/> },
  { id: 'critical',    label: 'Critical Structures', icon: <AlertTriangle size={11}/> },
  { id: 'analytics',   label: 'Analytics',   icon: <BarChart3 size={11}/> },
  { id: 'phototwin',   label: 'Digital Twin', icon: <Camera size={11}/> },
];

export default function BMSSection() {
  const [mainTab, setMainTab]         = useState('overview');
  const [inventoryTab, setInventoryTab] = useState('registry');

  // Map tab needs no overflow (fills its own container)
  const contentStyle: React.CSSProperties =
    mainTab === 'map'
      ? { flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }
      : { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(2,2,2,0.97)',
      fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      <style>{`
        @keyframes bms-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Cross-section links are hidden in the standalone NBMS build (no other sections to jump to) */}
      {!import.meta.env.VITE_STANDALONE && <CrossLinkChipBar sectionId="bms" />}

      {/* Single navigation layer: Dashboard | Interactive Map | Exhaustive Tables | Deep Analytics | SQL Database & Schema | Data Capture (rendered inside SectionDashboard) */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}>
        <Suspense fallback={<Spinner />}>
          <SectionDashboard sectionId="bms" accent="#00f5ff" />
        </Suspense>
      </div>
    </div>
  );
}
