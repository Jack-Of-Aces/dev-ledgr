/**
 * @file mockAuthService.ts
 * @description Sandbox authentication service used when no backend is configured.
 * Simulates GitHub and Google OAuth logins. Roles are not mocked: every sandbox
 * session is a plain developer, so the sandbox cannot hand out an elevated one.
 */

import { IAuthService } from './IAuthService';
import { UserRole, UserSession } from '@/types/auth';
import { UserProfile } from '@/types';
import { DEFAULT_USER, DEMO_CANDIDATE_USER, ADMIN_USER } from '@/lib/mock-data';
import { setAuthCookies, clearAuthCookies, getClientCookie, AUTH_COOKIE_NAME } from '@/lib/cookies';

function getMockRole(): UserRole {
  if (process.env.NEXT_PUBLIC_ADMIN_OVERRIDE === 'true') {
    return 'admin';
  }
  return 'user';
}

export class MockAuthService implements IAuthService {
  async loginWithGitHub(username = 'developer', name = 'Candidate Engineer'): Promise<UserSession> {
    const role: UserRole = getMockRole();
    const token = `mock_gh_token_${Date.now()}_${username}`;

    setAuthCookies(token, role);

    const baseUser = role === 'admin' ? ADMIN_USER : DEFAULT_USER;
    return {
      token,
      username: role === 'admin' ? ADMIN_USER.username : username,
      name: role === 'admin' ? ADMIN_USER.name : name,
      role,
      avatarUrl: baseUser.avatarUrl,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async loginWithGoogle(email = 'developer@gmail.com', name = 'Candidate Engineer'): Promise<UserSession> {
    const username = email.split('@')[0];
    const role: UserRole = getMockRole();
    const token = `mock_google_token_${Date.now()}_${username}`;

    setAuthCookies(token, role);

    const baseUser = role === 'admin' ? ADMIN_USER : DEFAULT_USER;
    return {
      token,
      username: role === 'admin' ? ADMIN_USER.username : username,
      name: role === 'admin' ? ADMIN_USER.name : name,
      role,
      avatarUrl: baseUser.avatarUrl,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async logout(): Promise<void> {
    clearAuthCookies();
  }

  async getCurrentSession(): Promise<UserSession | null> {
    const token = getClientCookie(AUTH_COOKIE_NAME);
    if (!token) return null;

    const role = getMockRole();
    const user = role === 'admin' ? ADMIN_USER : DEMO_CANDIDATE_USER;

    return {
      token,
      username: user.username,
      name: user.name,
      role,
      avatarUrl: user.avatarUrl,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async fetchDevProfile(): Promise<UserProfile | null> {
    if (getMockRole() === 'admin') {
      return ADMIN_USER;
    }
    return null;
  }
}

export const mockAuthService = new MockAuthService();
