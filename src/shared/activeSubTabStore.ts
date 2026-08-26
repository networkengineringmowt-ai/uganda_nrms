/**
 * activeSubTabStore - tiny cross-component subject so the platform-wide
 * PageToolbar (mounted once in App.tsx, outside SectionDashboard) can know
 * which of the six section sub-tabs (Dashboard / Interactive Map /
 * Exhaustive Tables / Deep Analytics / SQL Database & Schema / Data Capture)
 * is currently visible, without threading tab state through props or a
 * heavier context provider. SectionSubTabs (SectionDashboard.tsx) publishes
 * on every tab change and on mount; PageToolbar subscribes via
 * useSyncExternalStore so it re-renders in step with the visible content.
 */
export interface ActiveSubTab {
  tabId: string;      // 'dashboard' | 'map' | 'tables' | 'analytics' | 'sql' | 'capture'
  tabLabel: string;   // e.g. 'Exhaustive Tables'
  sectionId: string;  // sidebar sectionId, e.g. 'bms'
}

const DEFAULT_STATE: ActiveSubTab = { tabId: 'dashboard', tabLabel: 'Dashboard', sectionId: '' };

let current: ActiveSubTab = DEFAULT_STATE;
const listeners = new Set<() => void>();

export function setActiveSubTab(next: ActiveSubTab) {
  if (current.tabId === next.tabId && current.tabLabel === next.tabLabel && current.sectionId === next.sectionId) return;
  current = next;
  listeners.forEach(l => l());
}

export function getActiveSubTab(): ActiveSubTab {
  return current;
}

export function subscribeActiveSubTab(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
