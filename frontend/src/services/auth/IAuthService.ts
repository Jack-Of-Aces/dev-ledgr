/**
 * @file IAuthService.ts
 * @description Contract for authentication and session handling.
 * Standardizes OAuth authentication via GitHub and Google.
 *
 * There is deliberately no way to change a role here. Roles live in
 * public.profiles and are owned by the backend, which exposes a single
 * admin-only endpoint for changing them; a client-side persona switch can
 * only ever fake the session cookie, never the stored role.
 */

import { UserSession } from '@/types/auth';
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
}
