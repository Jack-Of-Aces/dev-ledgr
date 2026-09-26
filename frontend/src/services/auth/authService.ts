/**
 * @file authService.ts
 * @description Unified authentication service provider.
 * Connects directly to Supabase Auth (GitHub OAuth & Magic Links) with graceful fallback to sandbox.
 */

import { IAuthService } from './IAuthService';
import { mockAuthService } from './mockAuthService';
import { UserRole, UserSession } from '@/types/auth';
import { UserProfile } from '@/types';
import { envConfig } from '@/lib/config';
import { getSupabase } from '@/lib/supabase';
import { setAuthCookies, clearAuthCookies } from '@/lib/cookies';
import { DEFAULT_USER } from '@/lib/mock-data';

export class AuthService implements IAuthService {
  private mock = mockAuthService;

  async loginWithGitHub(username?: string, name?: string): Promise<UserSession> {
    const supabase = getSupabase();

    // 1. Live Supabase GitHub OAuth Flow
    if (supabase && envConfig.hasSupabase && typeof window !== 'undefined') {
      const redirectUri = `${window.location.origin}/auth/callback?next=/dashboard`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: redirectUri,
          scopes: 'read:user public_repo',
        },
      });

      if (error) {
        console.warn('[AuthService] Supabase GitHub OAuth error, trying fallback:', error);
      } else if (data.url) {
        // Supabase will navigate to GitHub
        return {
          token: 'pending_oauth_redirect',
          username: username || 'authenticating',
          name: name || 'Developer',
          role: 'user',
          avatarUrl: DEFAULT_USER.avatarUrl,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        };
      }
    }

    // 2. Direct GitHub OAuth (if custom client ID without Supabase)
    if (envConfig.githubClientId && typeof window !== 'undefined') {
      const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/callback/github`);
      window.location.href = `https://github.com/login/oauth/authorize?client_id=${envConfig.githubClientId}&scope=read:user,public_repo&redirect_uri=${redirectUri}`;
      return this.mock.loginWithGitHub(username, name);
    }

    // 3. Fallback to Sandbox Provider
    return this.mock.loginWithGitHub(username, name);
  }

  async loginWithEmail(email: string): Promise<{ success: boolean; message: string }> {
    const supabase = getSupabase();

    // 1. Live Supabase Email Magic Link
    if (supabase && envConfig.hasSupabase && typeof window !== 'undefined') {
      const redirectUri = `${window.location.origin}/auth/callback?next=/dashboard`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUri,
        },
      });

      if (error) {
        console.warn('[AuthService] Supabase OTP error:', error);
        return {
          success: false,
          message: error.message || 'Failed to dispatch magic link. Please check email address.',
        };
      }

      return {
        success: true,
        message: `Magic verification link sent to ${email}. Check your inbox to sign in!`,
      };
    }

    // 2. Fallback to Sandbox
    return this.mock.loginWithEmail(email);
  }

  async logout(): Promise<void> {
    const supabase = getSupabase();
    if (supabase && envConfig.hasSupabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('[AuthService] Supabase signOut error:', err);
      }
    }

    clearAuthCookies();
    await this.mock.logout();
  }

  async getCurrentSession(): Promise<UserSession | null> {
    const supabase = getSupabase();

    if (supabase && envConfig.hasSupabase) {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error && session?.user) {
          const u = session.user;
          const meta = u.user_metadata || {};
          const username = meta.user_name || meta.preferred_username || u.email?.split('@')[0] || 'developer';
          const name = meta.full_name || meta.name || username;
          const avatarUrl = meta.avatar_url || DEFAULT_USER.avatarUrl;
          const role: UserRole = meta.role === 'admin' ? 'admin' : 'user';

          setAuthCookies(session.access_token, role);

          return {
            token: session.access_token,
            username,
            name,
            role,
            avatarUrl,
            expiresAt: new Date(session.expires_at ? session.expires_at * 1000 : Date.now() + 3600000).toISOString(),
          };
        }
      } catch (err) {
        console.warn('[AuthService] Error checking Supabase session:', err);
      }
    }

    return this.mock.getCurrentSession();
  }

  async switchRole(role: UserRole): Promise<UserProfile> {
    return this.mock.switchRole(role);
  }
}

export const authService = new AuthService();
