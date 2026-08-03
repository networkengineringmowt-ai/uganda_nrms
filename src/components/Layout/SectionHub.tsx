/**
 * SectionHub — generic tab-bar wrapper used to consolidate multiple modules
 * under one sidebar section (matches the RMSSection tab-bar UI).
 *
 * Automatically prepends a "Dashboard" tab as the first tab for every section.
 * Dashboard content is driven by SectionDashboard which reads live from Supabase.
 */
import React, { Suspense, useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import SectionDashboard from '../../modules/Dashboard/SectionDashboard';

export interface HubTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  element: React.ReactNode;
}

export default function SectionHub({ tabs, accent = '#00f5ff', badge, sectionId }: {
  tabs: HubTab[]; accent?: string; badge?: string; sectionId?: string;
}) {
  // Derive a sectionId from the first tab's id if not explicitly provided
  const resolvedSectionId = sectionId ?? tabs[0]?.id ?? 'default';

  // Prepend the Dashboard tab — always first, always dynamic
  const dashTab: HubTab = {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={13} />,
    element: <SectionDashboard sectionId={resolvedSectionId} accent={accent} />,
  };

  const allTabs: HubTab[] = [dashTab, ...tabs];

  const [tab, setTab] = useState(allTabs[0].id);
  const active = allTabs.find(t => t.id === tab) ?? allTabs[0];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(2,2,2,0.97)', fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 2, padding: '0 14px', flexShrink: 0,
        borderBottom: `1px solid ${accent}26`,
        background: 'rgba(8,8,8,0.85)', overflowX: 'auto',
      }}>
        {allTabs.map(t => {
          const isActive = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px 11px', fontSize: 11, fontWeight: isActive ? 800 : 500,
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              color: isActive ? accent : 'rgba(148,163,184,0.70)',
              borderBottom: isActive ? `2px solid ${accent}` : '2px solid transparent',
              transition: 'all 0.13s', whiteSpace: 'nowrap',
            }}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
        {badge && (
          <div style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: 4,
            fontSize: 9, color: accent, fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap',
          }}>{badge}</div>
        )}
      </div>
      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
          <Suspense fallback={
            <div style={{ padding: 40, color: 'rgba(148,163,184,0.7)', fontSize: 12 }}>Loading module…</div>
          }>
            {active?.element}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
