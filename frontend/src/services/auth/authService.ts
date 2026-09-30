/**
 * @file authService.ts
 * @description Unified authentication service provider.
 * Connects directly to Supabase OAuth (GitHub and Google) with graceful fallback to sandbox.
 */

import { IAuthService } from './IAuthService';
import { mockAuthService } from './mockAuthService';
import { UserRole, UserSession } from '@/types/auth';
import { UserProfile } from '@/types';
import { envConfig } from '@/lib/config';
import { getSupabase } from '@/lib/supabase';
import { setAuthCookies, clearAuthCookies } from '@/lib/cookies';
import { DEFAULT_USER } from '@/lib/mock-data';
import { defaultHttpClient } from '../api/httpClient';

export class AuthService implements IAuthService {
  private mock = mockAuthService;
  private http = defaultHttpClient;

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
        if (typeof window !== 'undefined') {
          window.location.assign(data.url);
        }
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

    // 2. Fallback to Sandbox Provider.
    //
    // There used to be a second branch here that sent the browser straight to
    // github.com/login/oauth/authorize when a custom client id was configured.
    // Its redirect_uri pointed at /api/auth/callback/github, which does not
    // exist in this app, so it was a 404 waiting for anyone who set that var
    // and hit a Supabase error. There is no code exchange on that path either:
    // the Supabase PKCE route is the only one that can turn a code into a
    // session. Silent sandbox sign-in is the honest fallback.
    return this.mock.loginWithGitHub(username, name);
  }

  async loginWithGoogle(email?: string, name?: string): Promise<UserSession> {
    const supabase = getSupabase();

    // 1. Live Supabase Google OAuth Flow
    if (supabase && envConfig.hasSupabase && typeof window !== 'undefined') {
      const redirectUri = `${window.location.origin}/auth/callback?next=/onboarding`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.warn('[AuthService] Supabase Google OAuth error:', error);
      } else if (data.url) {
        if (typeof window !== 'undefined') {
          window.location.assign(data.url);
        }
        return {
          token: 'pending_oauth_redirect',
          username: email?.split('@')[0] || 'authenticating',
          name: name || 'Developer',
          role: 'user',
          avatarUrl: DEFAULT_USER.avatarUrl,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        };
      }
    }

    // 2. Fallback to Sandbox Provider
    return this.mock.loginWithGoogle(email, name);
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
          const avatarUrl = meta.avatar_url || meta.picture || DEFAULT_USER.avatarUrl;
          // Starts as the base role and is only ever raised by the backend below.
          // Seeding it from user_metadata would trust an account-editable field:
          // the /api/auth/me call is conditional, so any failure to reach it
          // would otherwise leave a self-declared admin in the role cookie.
          let role: UserRole = 'user';
          let devUsername = username;
          let devName = name;
          let devAvatar = avatarUrl;

          // Per backend specification: Call GET /api/auth/me to create/sync the dev record
          // and obtain the authoritative database role. user_metadata is not trusted.
          if (envConfig.apiUrl && !envConfig.useMocks) {
            try {
              const res = await fetch(`${envConfig.apiUrl.replace(/\/$/, '')}/api/auth/me`, {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                  Accept: 'application/json',
                },
              });
              if (res.ok) {
                const me = await res.json();
                if (me.role) role = me.role as UserRole;
                if (me.username) devUsername = me.username;
                if (me.name) devName = me.name;
                if (me.avatarUrl) devAvatar = me.avatarUrl;
              }
            } catch (syncErr) {
              console.warn('[AuthService] Notice: /api/auth/me authoritative sync deferred:', syncErr);
            }
          }

          // Use the authoritative role from /api/auth/me (already in `role` var above).
          setAuthCookies(session.access_token, role, session.refresh_token);

          return {
            token: session.access_token,
            username: devUsername,
            name: devName,
            role,
            avatarUrl: devAvatar,
            expiresAt: new Date(session.expires_at ? session.expires_at * 1000 : Date.now() + 3600000).toISOString(),
          };
        }
      } catch (err) {
        console.warn('[AuthService] Error checking Supabase session:', err);
      }
    }

    return this.mock.getCurrentSession();
  }

  async fetchDevProfile(accessToken: string): Promise<UserProfile | null> {
    if (envConfig.useMocks) {
      return null;
    }

    try {
      // GET /api/auth/me provisions the dev record on first sign-in.
      // Use 30s timeout to gracefully survive backend cold starts (e.g. Render spin-up).
      const res = await this.http.get<{ dev: UserProfile }>('/api/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeoutMs: 30000,
      });
      return res.dev ?? null;
    } catch (err) {
      console.warn('[AuthService] Could not load dev profile from backend:', err);
      return null;
    }
  }
}

export const authService = new AuthService();
