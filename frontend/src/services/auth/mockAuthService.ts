/**
 * @file mockAuthService.ts
 * @description High-fidelity sandbox authentication service.
 * Manages simulated GitHub and Google OAuth logins and dev role switching.
 */

import { IAuthService } from './IAuthService';
import { UserRole, UserSession } from '@/types/auth';
import { UserProfile } from '@/types';
import { DEFAULT_USER, ADMIN_USER } from '@/lib/mock-data';
import { setAuthCookies, clearAuthCookies, getClientCookie, AUTH_COOKIE_NAME, ROLE_COOKIE_NAME } from '@/lib/cookies';

export class MockAuthService implements IAuthService {
  async loginWithGitHub(username = 'junior_dev', name = 'Alex Okafor'): Promise<UserSession> {
    const role: UserRole = username === 'lead_auditor' ? 'admin' : 'user';
    const token = `mock_gh_token_${Date.now()}_${username}`;

    setAuthCookies(token, role);

    return {
      token,
      username,
      name,
      role,
      avatarUrl: username === 'lead_auditor' ? ADMIN_USER.avatarUrl : DEFAULT_USER.avatarUrl,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async loginWithGoogle(email = 'alex.okafor@gmail.com', name = 'Alex Okafor'): Promise<UserSession> {
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
    const role = (getClientCookie(ROLE_COOKIE_NAME) as UserRole) || 'user';

    if (!token) return null;

    const isAdmin = role === 'admin';
    const profile = isAdmin ? ADMIN_USER : DEFAULT_USER;

    return {
      token,
      username: profile.username,
      name: profile.name,
      role,
      avatarUrl: profile.avatarUrl,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async switchRole(role: UserRole): Promise<UserProfile> {
    const profile = role === 'admin' ? ADMIN_USER : DEFAULT_USER;
    const token = `mock_switched_token_${Date.now()}_${role}`;
    setAuthCookies(token, role);
    return profile;
  }
}

export const mockAuthService = new MockAuthService();
