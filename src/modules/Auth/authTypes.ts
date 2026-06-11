// Three access levels — three interfaces:
//  rms   → field data-entry ONLY (mobile-friendly capture shell)
//  super → dashboards/reports of everything, read-only (no input, no admin/audit)
//  admin → everything, all at once
export type UserRole = 'rms' | 'super' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  region?: string;
  department?: string;
  lastLogin?: string;
  isActive: boolean;
}

export interface Permission {
  canViewMaps: boolean;
  canViewTraffic: boolean;
  canViewBudget: boolean;
  canViewBridges: boolean;
  canViewML: boolean;
  canEditRoads: boolean;
  canEditBridges: boolean;
  canSubmitSurvey: boolean;
  canApproveMaintenance: boolean;
  canManageUsers: boolean;
  canExportData: boolean;
  canViewConfidential: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  rms:   { canViewMaps:false, canViewTraffic:false, canViewBudget:false, canViewBridges:false, canViewML:false, canEditRoads:true,  canEditBridges:true,  canSubmitSurvey:true,  canApproveMaintenance:false, canManageUsers:false, canExportData:false, canViewConfidential:false },
  super: { canViewMaps:true,  canViewTraffic:true,  canViewBudget:true,  canViewBridges:true,  canViewML:true,  canEditRoads:false, canEditBridges:false, canSubmitSurvey:false, canApproveMaintenance:false, canManageUsers:false, canExportData:true,  canViewConfidential:true  },
  admin: { canViewMaps:true,  canViewTraffic:true,  canViewBudget:true,  canViewBridges:true,  canViewML:true,  canEditRoads:true,  canEditBridges:true,  canSubmitSurvey:true,  canApproveMaintenance:true,  canManageUsers:true,  canExportData:true,  canViewConfidential:true  },
};

export function hasPermission(user: User | null, perm: keyof Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role][perm];
}
