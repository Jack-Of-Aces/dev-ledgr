'use client';

import { useEffect, useRef } from 'react';
/**
 * @file SupabaseAuthSync.tsx
 * @description Client-side synchronization bridge between Supabase Auth and DevLedgr Zustand store.
 * Automatically synchronizes login state, user avatars, and session cookies across tabs and reloads.
 * The dev record (including role) is owned by the backend; Supabase metadata is only used
 * as a placeholder until the backend profile loads.
 */
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { setAuthCookies, clearAuthCookies, getClientCookie, AUTH_COOKIE_NAME } from '@/lib/cookies';
import { DEFAULT_USER } from '@/lib/mock-data';
import { UserRole } from '@/types/auth';
import { EngineeringTrack, ExperienceLevel } from '@/types';

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

export const SupabaseAuthSync: React.FC = () => {
  const hasHandledOAuthRef = useRef(false);
import { authService } from '@/services/auth/authService';

async function applySession(session: Session): Promise<void> {
  const u = session.user;
  const meta = u.user_metadata || {};
  const username = meta.user_name || meta.preferred_username || u.email?.split('@')[0] || 'developer';

  // Placeholder from Supabase metadata so the UI responds immediately. The
  // role is always 'user' here: user_metadata is editable by the user.
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

  // Replace it with the authoritative dev record from the backend.
  const dev = await authService.fetchDevProfile(session.access_token);
  if (dev) {
    useAppStore.setState({ user: dev });
    setAuthCookies(session.access_token, dev.role);
  }
}

export const SupabaseAuthSync: React.FC = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Check for OAuth hash errors (e.g. #error=access_denied)
    if (window.location.hash.includes('error=')) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const errorMsg =
        hashParams.get('error_description') ||
        hashParams.get('error') ||
        'Authentication failed';
      window.location.replace(`/login?error=${encodeURIComponent(errorMsg)}`);
      return;
    }

    // 2. Synchronous ingestion and immediate redirection when OAuth hash is present
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
        const avatarUrl =
          meta.avatar_url || meta.picture || DEFAULT_USER.avatarUrl;
        const role: UserRole = meta.role === 'admin' ? 'admin' : 'user';
        const isOnboarded = Boolean(meta.onboarding_completed);
        const shouldOnboard = !isOnboarded || (isGoogle && !meta.github_connected);

        const githubConnected = isGoogle
          ? Boolean(meta.github_connected)
          : true;
        const githubUsername = isGoogle
          ? (meta.github_username || undefined)
          : (meta.user_name || username);

        // Immediately stamp cookies so edge middleware authorizes navigation
        setAuthCookies(accessToken, role);

        // Seed store state
        useAppStore.setState({
          isLoggedIn: true,
          user: {
            ...DEFAULT_USER,
            username,
            name,
            role,
            headline:
              meta.headline ||
              (isGoogle
                ? 'Engineering Candidate'
                : 'Software Engineer · Verified Ledger'),
            bio: meta.bio || 'Verified developer on DevLedgr.',
            avatarUrl,
            githubUrl: githubUsername
              ? `https://github.com/${githubUsername}`
              : '',
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

        // Set session in Supabase client instance if available
        const supabase = getSupabase();
        if (supabase && refreshToken) {
          supabase.auth
            .setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            .catch((err) =>
              console.warn('[SupabaseAuthSync] setSession notice:', err)
            );
        }

        // Hard browser replacement: removes the hash from history and lands on onboarding or dashboard
        const destination = shouldOnboard ? '/onboarding' : '/dashboard';
        window.location.replace(destination);
        return;
      }
    }

    // 3. Regular session sync on mount and auth state change
    const supabase = getSupabase();
    if (!supabase) return;

    const handleSessionSync = (session: Session | null) => {
      if (!session?.user) return;

      const u = session.user;
      const meta = u.user_metadata || {};
      const isGoogle = u.app_metadata?.provider === 'google';
      const username =
        meta.user_name ||
        meta.preferred_username ||
        u.email?.split('@')[0] ||
        'developer';
      const name = meta.full_name || meta.name || username;
      const avatarUrl =
        meta.avatar_url || meta.picture || DEFAULT_USER.avatarUrl;
      const role: UserRole = meta.role === 'admin' ? 'admin' : 'user';

      const isOnboarded = Boolean(meta.onboarding_completed);
      const shouldOnboard = !isOnboarded || (isGoogle && !meta.github_connected);

      const githubConnected = isGoogle
        ? Boolean(meta.github_connected)
        : true;
      const githubUsername = isGoogle
        ? (meta.github_username || undefined)
        : (meta.user_name || username);

      useAppStore.setState({
        isLoggedIn: true,
        user: {
          ...DEFAULT_USER,
          username,
          name,
          role,
          headline:
            meta.headline ||
            (isGoogle
              ? 'Engineering Candidate'
              : 'Software Engineer · Verified Ledger'),
          bio: meta.bio || 'Verified developer on DevLedgr.',
          avatarUrl,
          githubUrl: githubUsername
            ? `https://github.com/${githubUsername}`
            : '',
          githubConnected,
          githubUsername,
          authProvider: isGoogle ? 'google' : 'github',
          onboardingCompleted: !shouldOnboard,
          engineeringTrack: (meta.engineering_track as EngineeringTrack) || undefined,
          targetRole: meta.target_role || undefined,
          experienceLevel: (meta.experience_level as ExperienceLevel) || undefined,
          statedSkills: meta.skills || ['Go', 'TypeScript', 'PostgreSQL'],
          email: u.email,
        },
      });

      setAuthCookies(session.access_token, role);

      // If sitting on /login while already logged in, redirect away
      if (
        typeof window !== 'undefined' &&
        window.location.pathname === '/login' &&
        !hasHandledOAuthRef.current
      ) {
        hasHandledOAuthRef.current = true;
        window.location.replace(shouldOnboard ? '/onboarding' : '/dashboard');
      }
    };

    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleSessionSync(session);
      } else {
        const hasSessionCookie =
          document.cookie.includes('devledgr_session') ||
          document.cookie.includes('devledgr_token');
        if (!hasSessionCookie) {
          useAppStore.setState({ isLoggedIn: false });
        }
    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        void applySession(session);
      } else if (!getClientCookie(AUTH_COOKIE_NAME)) {
        // No real session and no sandbox cookie: ensure not logged in
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
        handleSessionSync(session);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        void applySession(session);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Keep API calls authenticated with the fresh access token.
        setAuthCookies(session.access_token, useAppStore.getState().user.role);
      } else if (event === 'SIGNED_OUT') {
        useAppStore.setState({
          isLoggedIn: false,
          user: DEFAULT_USER,
        });
        clearAuthCookies();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
};
