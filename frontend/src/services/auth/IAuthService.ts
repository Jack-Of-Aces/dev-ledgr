/**
 * @file IAuthService.ts
 * @description Contract for authentication, session handling, and role elevation.
 * Implementations: HttpAuthService (production), MockAuthService (offline/dev sandbox).
 */

import { UserRole, UserSession } from '@/types/auth';
import { UserProfile } from '@/types';

export interface IAuthService {
  /**
   * Initiates GitHub OAuth authentication.
   * If live OAuth is configured, redirects to GitHub; otherwise initiates sandbox session.
   */
  loginWithGitHub(username?: string, name?: string): Promise<UserSession>;

  /**
   * Initiates passwordless email sign-in / magic link.
   */
  loginWithEmail(email: string): Promise<{ success: boolean; message: string }>;

  /**
   * Logs out the active user and invalidates session cookies.
   */
  logout(): Promise<void>;

  /**
   * Retrieves the current user session, or null if unauthenticated.
   */
  getCurrentSession(): Promise<UserSession | null>;

  /**
   * Switches demo persona between user and admin in development mode.
   */
  switchRole(role: UserRole): Promise<UserProfile>;
}
