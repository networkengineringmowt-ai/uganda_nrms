/**
 * LifecycleView — Life Cycle Management shell.
 *
 * Two tabs:
 *   · History Map — the national network timeline map (RoadNetworkView opened
 *     in History mode: 1960–2026 paving animation, year slider, playback).
 *   · Lifecycle Analytics — the per-link IRI deterioration timeline and
 *     intervention-history analytics (LifecycleSection).
 */
import { Suspense, lazy, useState } from 'react';
import { Map as MapIcon, Activity } from 'lucide-react';

const RoadNetworkView  = lazy(() => import('../RoadNetwork/RoadNetworkView'));
const LifecycleSection = lazy(() => import('./LifecycleSection'));

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%',
        border: '2px solid rgba(120,120,120,0.4)', borderTopColor: '#00f5ff',
        animation: 'bms-spin 0.8s linear infinite' }} />
    </div>
  );
}

const TABS = [
  { id: 'map',       label: 'History Map',         icon: MapIcon },
  { id: 'analytics', label: 'Lifecycle Analytics', icon: Activity },
] as const;
type TabId = typeof TABS[number]['id'];

export default function LifecycleView() {
  const [tab, setTab] = useState<TabId>('map');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, padding: '4px 10px', flexShrink: 0,
        background: 'rgba(2,2,2,0.9)', borderBottom: '1px solid rgba(0,245,255,0.1)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
            fontSize: 10.5, fontWeight: 700, transition: 'all 0.12s',
            background: tab === id ? 'rgba(0,245,255,0.12)' : 'transparent',
            border: `1px solid ${tab === id ? 'rgba(0,245,255,0.35)' : 'transparent'}`,
            color: tab === id ? '#00f5ff' : 'rgba(148,163,184,0.7)',
          }}>
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <Suspense fallback={<Spinner />}>
          {tab === 'map'       && <RoadNetworkView defaultHistory />}
          {tab === 'analytics' && (
            <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
              <LifecycleSection />
            </div>
          )}
        </Suspense>
      </div>
    </div>
  );
}
