/**
 * @file auth.ts
 * @description Domain types and role-based permissions matrix for DevLedgr.
 * Follows SRP: defines authentication contracts and access control decoupled from UI.
 */

export type UserRole = 'user' | 'reviewer' | 'admin';

export interface UserSession {
  token: string;
  username: string;
  name: string;
  role: UserRole;
  avatarUrl: string;
  expiresAt: string;
}

export type Permission =
  | 'view_ideas'
  | 'submit_solution'
  | 'view_jobs'
  | 'apply_job'
  | 'view_coaching'
  | 'run_ai_coach'
  | 'edit_own_profile'
  | 'review_submissions'
  | 'stamp_solution'
  | 'seed_ideas'
  | 'manage_platform';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: [
    'view_ideas',
    'submit_solution',
    'view_jobs',
    'apply_job',
    'view_coaching',
    'run_ai_coach',
    'edit_own_profile',
  ],
  reviewer: [
    'view_ideas',
    'submit_solution',
    'view_jobs',
    'apply_job',
    'view_coaching',
    'run_ai_coach',
    'edit_own_profile',
    'review_submissions',
    'stamp_solution',
  ],
  admin: [
    'view_ideas',
    'submit_solution',
    'view_jobs',
    'apply_job',
    'view_coaching',
    'run_ai_coach',
    'edit_own_profile',
    'review_submissions',
    'stamp_solution',
    'seed_ideas',
    'manage_platform',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
