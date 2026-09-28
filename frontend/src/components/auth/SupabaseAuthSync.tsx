'use client';

/**
 * @file SupabaseAuthSync.tsx
 * @description Client-side synchronization bridge between Supabase Auth and DevLedgr Zustand store.
 * Automatically synchronizes login state, user avatars, and session cookies across tabs and reloads.
 * The dev record (including role) is owned by the backend; Supabase metadata is only used
 * as a placeholder until the backend profile loads.
 */

import { useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { setAuthCookies, clearAuthCookies, getClientCookie, AUTH_COOKIE_NAME } from '@/lib/cookies';
import { DEFAULT_USER } from '@/lib/mock-data';
import { UserRole } from '@/types/auth';
import { EngineeringTrack, ExperienceLevel } from '@/types';
import { authService } from '@/services/auth/authService';

interface JwtPayload {
  email?: string;
  app_metadata?: { provider?: string; providers?: string[] };
  user_metadata?: {
    user_name?: string;
    preferred_username?: string;
    name?: string;
    full_name?: string;
    avatar_url?: string;
    picture?: string;
    role?: string;
    headline?: string;
    bio?: string;
    skills?: string[];
    onboarding_completed?: boolean;
    engineering_track?: EngineeringTrack;
    target_role?: string;
    experience_level?: ExperienceLevel;
    github_connected?: boolean;
    github_username?: string;
  };
}

function parseJwt(token: string): JwtPayload | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload) as JwtPayload;
  } catch {
    return null;
  }
}

async function applySession(session: Session): Promise<void> {
  const u = session.user;
  const meta = u.user_metadata || {};
  const username =
    meta.user_name || meta.preferred_username || u.email?.split('@')[0] || 'developer';

  // Seed the store with Supabase metadata immediately so the UI responds.
  // role is always 'user' here — user_metadata is user-editable, not trusted.
  useAppStore.setState({
    isLoggedIn: true,
    user: {
      ...DEFAULT_USER,
      username,
      name: meta.full_name || meta.name || username,
      role: 'user',
      headline: meta.headline || 'Full-Stack Software Engineer',
      bio: meta.bio || 'Verified developer on DevLedgr.',
      avatarUrl: meta.avatar_url || meta.picture || DEFAULT_USER.avatarUrl,
      githubUrl: meta.user_name ? `https://github.com/${meta.user_name}` : '',
      statedSkills: meta.skills || ['Go', 'TypeScript', 'PostgreSQL'],
      email: u.email,
    },
  });
  setAuthCookies(session.access_token, 'user');

  // Overwrite with the authoritative dev record from the backend.
  const dev = await authService.fetchDevProfile(session.access_token);
  if (dev) {
    useAppStore.setState({ user: dev });
    setAuthCookies(session.access_token, dev.role);
  }
}

export const SupabaseAuthSync: React.FC = () => {
  const hasHandledOAuthRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. OAuth error in hash (e.g. #error=access_denied)
    if (window.location.hash.includes('error=')) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const errorMsg =
        hashParams.get('error_description') ||
        hashParams.get('error') ||
        'Authentication failed';
      window.location.replace(`/login?error=${encodeURIComponent(errorMsg)}`);
      return;
    }

    // 2. Implicit OAuth flow: access_token in hash
    const hash = window.location.hash;
    if (hash.includes('access_token=') && !hasHandledOAuthRef.current) {
      hasHandledOAuthRef.current = true;
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken) {
        const payload = parseJwt(accessToken);
        const meta = payload?.user_metadata || {};
        const isGoogle = payload?.app_metadata?.provider === 'google';
        const username =
          meta.user_name ||
          meta.preferred_username ||
          payload?.email?.split('@')[0] ||
          'developer';
        const name = meta.full_name || meta.name || username;
        const avatarUrl = meta.avatar_url || meta.picture || DEFAULT_USER.avatarUrl;
        const role: UserRole = meta.role === 'admin' ? 'admin' : 'user';
        const isOnboarded = Boolean(meta.onboarding_completed);
        const shouldOnboard = !isOnboarded || (isGoogle && !meta.github_connected);
        const githubConnected = isGoogle ? Boolean(meta.github_connected) : true;
        const githubUsername = isGoogle
          ? meta.github_username || undefined
          : meta.user_name || username;

        setAuthCookies(accessToken, role);

        useAppStore.setState({
          isLoggedIn: true,
          user: {
            ...DEFAULT_USER,
            username,
            name,
            role,
            headline:
              meta.headline ||
              (isGoogle ? 'Engineering Candidate' : 'Software Engineer · Verified Ledger'),
            bio: meta.bio || 'Verified developer on DevLedgr.',
            avatarUrl,
            githubUrl: githubUsername ? `https://github.com/${githubUsername}` : '',
            githubConnected,
            githubUsername,
            authProvider: isGoogle ? 'google' : 'github',
            onboardingCompleted: !shouldOnboard,
            engineeringTrack: meta.engineering_track || undefined,
            targetRole: meta.target_role || undefined,
            experienceLevel: meta.experience_level || undefined,
            statedSkills: meta.skills || ['Go', 'TypeScript', 'PostgreSQL'],
            email: payload?.email,
          },
        });

        const supabase = getSupabase();
        if (supabase && refreshToken) {
          supabase.auth
            .setSession({ access_token: accessToken, refresh_token: refreshToken })
            .catch((err) => console.warn('[SupabaseAuthSync] setSession notice:', err));
        }

        window.location.replace(shouldOnboard ? '/onboarding' : '/dashboard');
        return;
      }
    }

    // 3. Regular session sync via Supabase client
    const supabase = getSupabase();
    if (!supabase) return;

    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        void applySession(session);
      } else if (!getClientCookie(AUTH_COOKIE_NAME)) {
        useAppStore.setState({ isLoggedIn: false });
      }
    });

    // Listen to real-time auth events (OAuth redirect, signout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        (event === 'SIGNED_IN' ||
          event === 'INITIAL_SESSION' ||
          event === 'TOKEN_REFRESHED') &&
        session?.user
      ) {
        void applySession(session);
      } else if (event === 'SIGNED_OUT') {
        useAppStore.setState({ isLoggedIn: false, user: DEFAULT_USER });
        clearAuthCookies();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
};
