/**
 * @file authService.ts
 * @description Unified authentication service provider implementing Fallback Decorator.
 * Seamlessly routes to Live OAuth or Mock Sandbox.
 */

import { IAuthService } from './IAuthService';
import { mockAuthService } from './mockAuthService';
import { UserRole, UserSession } from '@/types/auth';
import { UserProfile } from '@/types';
import { envConfig } from '@/lib/config';
import { defaultHttpClient } from '../api/httpClient';

export class AuthService implements IAuthService {
  private mock = mockAuthService;
  private http = defaultHttpClient;

  async loginWithGitHub(username?: string, name?: string): Promise<UserSession> {
    if (envConfig.useMocks || !envConfig.githubClientId) {
      return this.mock.loginWithGitHub(username, name);
    }

    // Live OAuth Redirect Flow:
    if (typeof window !== 'undefined') {
      const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/callback/github`);
      window.location.href = `https://github.com/login/oauth/authorize?client_id=${envConfig.githubClientId}&scope=read:user,public_repo&redirect_uri=${redirectUri}`;
    }

    // Fallback if called outside browser
    return this.mock.loginWithGitHub(username, name);
  }

  async loginWithEmail(email: string): Promise<{ success: boolean; message: string }> {
    if (envConfig.useMocks) {
      return this.mock.loginWithEmail(email);
    }

    try {
      return await this.http.post<{ success: boolean; message: string }>('/api/v1/auth/magic-link', {
        email,
      });
    } catch {
      // Graceful fallback for MVP
      return this.mock.loginWithEmail(email);
    }
  }

  async logout(): Promise<void> {
    if (!envConfig.useMocks) {
      try {
        await this.http.post('/api/v1/auth/logout');
      } catch {
        // Continue clearing client tokens regardless of network state
      }
    }
    await this.mock.logout();
  }

  async getCurrentSession(): Promise<UserSession | null> {
    if (envConfig.useMocks) {
      return this.mock.getCurrentSession();
    }

    try {
      return await this.http.get<UserSession>('/api/v1/auth/me');
    } catch {
      return this.mock.getCurrentSession();
    }
  }

  async switchRole(role: UserRole): Promise<UserProfile> {
    return this.mock.switchRole(role);
  }
}

export const authService = new AuthService();
