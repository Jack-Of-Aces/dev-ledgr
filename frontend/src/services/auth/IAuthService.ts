/**
 * @file IAuthService.ts
 * @description Contract for authentication, session handling, and role elevation.
 * Standardizes OAuth authentication via GitHub and Google.
 */

import { UserRole, UserSession } from '@/types/auth';
import { UserProfile } from '@/types';

export interface IAuthService {
  /**
   * Initiates GitHub OAuth authentication.
   * If live Supabase OAuth is configured, redirects to GitHub; otherwise initiates sandbox session.
   */
  loginWithGitHub(username?: string, name?: string): Promise<UserSession>;

  /**
   * Initiates Google OAuth authentication.
   * If live Supabase OAuth is configured, redirects to Google; otherwise initiates sandbox session.
   */
  loginWithGoogle(email?: string, name?: string): Promise<UserSession>;

  /**
   * Logs out the active user and invalidates session cookies.
   */
  logout(): Promise<void>;

  /**
   * Retrieves the current user session, or null if unauthenticated.
   */
  getCurrentSession(): Promise<UserSession | null>;

  /**
   * Loads the dev record for a Supabase access token from the backend, which
   * creates the record on first sign-in and owns the authoritative role.
   * Returns null when no backend is configured or it cannot be reached.
   */
  fetchDevProfile(accessToken: string): Promise<UserProfile | null>;

  /**
   * Switches demo persona between user and admin in development mode.
   */
  switchRole(role: UserRole): Promise<UserProfile>;
}
