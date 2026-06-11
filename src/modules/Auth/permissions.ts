import type { UserRole } from './authTypes';

// Views that only the admin level may open. super gets every dashboard and
// report but no input, audit, or admin tooling; rms never reaches the main
// shell at all (it gets the dedicated mobile capture interface).
export const ADMIN_ONLY_VIEWS = new Set([
  'admin', 'dataaudit', 'datacapture', 'pendingsurveys',
]);

export function canAccessView(role: UserRole | undefined, view: string): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  if (role === 'super') return !ADMIN_ONLY_VIEWS.has(view);
  return false; // rms uses its own shell
}
