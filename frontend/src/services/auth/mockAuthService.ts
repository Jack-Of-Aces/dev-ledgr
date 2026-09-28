/**
 * @file mockAuthService.ts
 * @description Sandbox authentication service used when no backend is configured.
 * Simulates GitHub and Google OAuth logins. Roles are not mocked: every sandbox
 * session is a plain developer, so the sandbox cannot hand out an elevated one.
 */

import { IAuthService } from './IAuthService';
import { UserRole, UserSession } from '@/types/auth';
import { UserProfile } from '@/types';
import { DEFAULT_USER, DEMO_CANDIDATE_USER } from '@/lib/mock-data';
import { setAuthCookies, clearAuthCookies, getClientCookie, AUTH_COOKIE_NAME } from '@/lib/cookies';

export class MockAuthService implements IAuthService {
  // The sandbox signs everyone in as a plain developer. There is no handle that
  // mints an elevated session: roles are not mocked, so there is no way for the
  // sandbox to hand out a reviewer or admin session.
  async loginWithGitHub(username = 'developer', name = 'Candidate Engineer'): Promise<UserSession> {
    const role: UserRole = 'user';
    const token = `mock_gh_token_${Date.now()}_${username}`;

    setAuthCookies(token, role);

    return {
      token,
      username,
      name,
      role,
      avatarUrl: DEFAULT_USER.avatarUrl,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async loginWithGoogle(email = 'developer@gmail.com', name = 'Candidate Engineer'): Promise<UserSession> {
    const username = email.split('@')[0];
    const role: UserRole = 'user';
    const token = `mock_google_token_${Date.now()}_${username}`;

    setAuthCookies(token, role);

    return {
      token,
      username,
      name,
      role,
      avatarUrl: DEFAULT_USER.avatarUrl,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async logout(): Promise<void> {
    clearAuthCookies();
  }

  async getCurrentSession(): Promise<UserSession | null> {
    const token = getClientCookie(AUTH_COOKIE_NAME);
    if (!token) return null;

    // The role is fixed rather than read back from the cookie. A cookie is
    // user-writable, so trusting it here is what let a sandbox session claim
    // admin without any account holding that role.
    return {
      token,
      username: DEMO_CANDIDATE_USER.username,
      name: DEMO_CANDIDATE_USER.name,
      role: 'user',
      avatarUrl: DEMO_CANDIDATE_USER.avatarUrl,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async fetchDevProfile(): Promise<UserProfile | null> {
    // The sandbox has no backend; callers keep their locally derived profile.
    return null;
  }
}

export const mockAuthService = new MockAuthService();
