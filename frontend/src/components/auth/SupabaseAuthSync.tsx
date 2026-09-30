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
import {
  setAuthCookies,
  clearAuthCookies,
  getClientCookie,
  AUTH_COOKIE_NAME,
  ROLE_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from '@/lib/cookies';
import { DEFAULT_USER } from '@/lib/mock-data';
import { UserRole } from '@/types/auth';
import { EngineeringTrack, ExperienceLevel, UserProfile } from '@/types';
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

/**
 * The access token whose dev record is already in the store.
 *
 * onAuthStateChange emits INITIAL_SESSION with the session that getSession() has
 * just returned, so without this the whole sync ran twice on every page load:
 * two calls to /api/auth/me, and two writes of authReady: false. The second one
 * can land after a page that gates on authReady has already mounted, which
 * unmounts and remounts its subtree — a half-filled onboarding wizard would be
 * thrown away by nothing more than a reload. Reset on sign-out, since the next
 * sign-in has to run the full sync again.
 */
let appliedAccessToken: string | null = null;

async function applySession(
  session: Session,
  { isRefresh = false }: { isRefresh?: boolean } = {}
): Promise<void> {
  const u = session.user;
  const meta = u.user_metadata || {};
  const username =
    meta.user_name || meta.preferred_username || u.email?.split('@')[0] || 'developer';

  if (isRefresh) {
    // A background token renewal. Keep the token and role cookies current.
    // Preserve the dev's existing role from the store rather than hardcoding 'user'
    // (which previously demoted admins and reviewers on hourly token refresh).
    const currentRole = useAppStore.getState().user.role || 'user';
    setAuthCookies(session.access_token, currentRole, session.refresh_token);

    // Silently re-verify dev record in the background without resetting authReady
    // or unmounting UI trees.
    void authService.fetchDevProfile(session.access_token).then((dev) => {
      if (dev) {
        useAppStore.setState({ user: dev });
        setAuthCookies(session.access_token, dev.role, session.refresh_token);
      }
    });
    return;
  }

  if (session.access_token === appliedAccessToken) {
    return;
  }
  appliedAccessToken = session.access_token;

  // Stale-while-revalidate: If we already have this dev's authoritative profile
  // in the persisted store, keep it visible rather than immediately blowing it
  // away with raw Supabase user_metadata placeholders and role: 'user'.
  const existingUser = useAppStore.getState().user;
  const isSameUser =
    Boolean(existingUser?.username) &&
    (existingUser.email?.toLowerCase() === u.email?.toLowerCase() ||
      existingUser.username.toLowerCase() === username.toLowerCase());
  const activeRole = isSameUser && existingUser.role ? existingUser.role : 'user';

  useAppStore.setState({
    isLoggedIn: true,
    authReady: false,
    user: isSameUser
      ? existingUser
      : {
          ...DEFAULT_USER,
          username,
          name: meta.full_name || meta.name || username,
          role: 'user',
          headline: meta.headline || '',
          bio: meta.bio || '',
          avatarUrl: meta.avatar_url || meta.picture || DEFAULT_USER.avatarUrl,
          githubUrl: meta.user_name ? `https://github.com/${meta.user_name}` : '',
          statedSkills: Array.isArray(meta.skills) ? meta.skills : [],
          email: u.email,
        },
  });
  setAuthCookies(session.access_token, activeRole, session.refresh_token);

  // Overwrite with the authoritative dev record from the backend.
  const dev = await authService.fetchDevProfile(session.access_token);
  if (dev) {
    useAppStore.setState({ user: dev });
    setAuthCookies(session.access_token, dev.role, session.refresh_token);
  }
  // Ready either way. If fetchDevProfile returned null (e.g. Render spin-up timeout),
  // keeping existingUser prevents dropping to raw Supabase placeholders.
  useAppStore.setState({ authReady: true });
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
      useAppStore.setState({ authReady: true, isLoggedIn: false });
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
        // Never trust a role from the JWT. user_metadata is editable by the
        // account holder, so reading meta.role here would let anyone grant
        // themselves admin in a cookie the Edge proxy gates /admin on. The
        // authoritative role is fetched from the backend just below.
        const role: UserRole = 'user';
        const isOnboarded = Boolean(meta.onboarding_completed);
        const shouldOnboard = !isOnboarded || (isGoogle && !meta.github_connected);
        const githubConnected = isGoogle ? Boolean(meta.github_connected) : true;
        const githubUsername = isGoogle
          ? meta.github_username || undefined
          : meta.user_name || username;

        setAuthCookies(accessToken, role, refreshToken || undefined);

        useAppStore.setState({
          isLoggedIn: true,
          user: {
            ...DEFAULT_USER,
            username,
            name,
            role,
            // Same rule as applySession: provisional means provisional. These
            // are placeholders for the millisecond before the dev record
            // arrives, not a profile to be saved.
            headline: meta.headline || '',
            bio: meta.bio || '',
            avatarUrl,
            githubUrl: githubUsername ? `https://github.com/${githubUsername}` : '',
            githubConnected,
            githubUsername,
            authProvider: isGoogle ? 'google' : 'github',
            onboardingCompleted: !shouldOnboard,
            engineeringTrack: meta.engineering_track || undefined,
            targetRole: meta.target_role || undefined,
            experienceLevel: meta.experience_level || undefined,
            statedSkills: Array.isArray(meta.skills) ? meta.skills : [],
            email: payload?.email,
          },
        });

        const supabase = getSupabase();
        if (supabase && refreshToken) {
          supabase.auth
            .setSession({ access_token: accessToken, refresh_token: refreshToken })
            .catch((err) => console.warn('[SupabaseAuthSync] setSession notice:', err));
        }

        // Replace the provisional profile with the backend's dev record before
        // navigating, so a real reviewer or admin does not get bounced off /admin
        // by a role the token cannot legitimately carry.
        let authoritative: UserProfile | null = null;
        void authService
          .fetchDevProfile(accessToken)
          .then((dev) => {
            if (!dev) return;
            authoritative = dev;
            useAppStore.setState({ user: dev });
            setAuthCookies(accessToken, dev.role, refreshToken || undefined);
          })
          .finally(() => {
            // The dev record decides whether onboarding is done, not the token.
            // onboarding_completed in user_metadata is editable by the account
            // holder, so a value there must not decide the redirect. The
            // metadata-derived flag is only the fallback for when the fetch
            // failed and there is no record to ask.
            const needsOnboarding = authoritative
              ? !authoritative.onboardingCompleted
              : shouldOnboard;
            useAppStore.setState({ authReady: true });
            window.location.replace(needsOnboarding ? '/onboarding' : '/dashboard');
          });
        return;
      }
    }

    // 3. Regular session sync via Supabase client
    const supabase = getSupabase();
    if (!supabase) {
      // No Supabase configured. Nothing will ever resolve a session, so the
      // wait is over by definition.
      useAppStore.setState({ authReady: true });
      return;
    }

    // Check active session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        void applySession(session, { isRefresh: false });
        return;
      }

      // No browser session, but there may still be a valid one: /auth/callback
      // completes the PKCE exchange in a route handler, so the tokens arrive as
      // cookies rather than in the Supabase client's storage. Adopt them here so
      // the client owns the token from now on and can renew it. Without this the
      // access token in devledgr_session expired after an hour with nothing able
      // to refresh it, and every later request came back 401 INVALID_TOKEN.
      const accessToken = getClientCookie(AUTH_COOKIE_NAME);
      const refreshToken = getClientCookie(REFRESH_COOKIE_NAME);
      if (accessToken && refreshToken) {
        const { data: adopted, error: adoptError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!adoptError && adopted.session?.user) {
          const role = useAppStore.getState().user.role || getClientCookie(ROLE_COOKIE_NAME) || 'user';
          setAuthCookies(adopted.session.access_token, role, adopted.session.refresh_token);
          void applySession(adopted.session, { isRefresh: false });
          return;
        }
        console.warn('[SupabaseAuthSync] could not adopt the callback session:', adoptError);
      }

      // isLoggedIn is left alone rather than forced false: the callback route
      // sets its cookie before the redirect, and on a hard reload the cookie can
      // briefly outlive a Supabase session that is still being restored.
      if (!accessToken) {
        useAppStore.setState({ isLoggedIn: false });
      }
      useAppStore.setState({ authReady: true });
    }).catch((err) => {
      // A rejected getSession used to leave authReady false with no terminal
      // path, which would hang every page waiting on it. Treat it as "no
      // session": the auth guard sends the dev to sign in from there.
      console.warn('[SupabaseAuthSync] session check failed:', err);
      useAppStore.setState({ isLoggedIn: false, authReady: true });
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
        // A refresh is not a new session. It must not clear authReady, because
        // pages that gate on it unmount and remount their subtree — which would
        // throw away a half-filled onboarding wizard once an hour, when Supabase
        // silently renews the token.
        void applySession(session, { isRefresh: event === 'TOKEN_REFRESHED' });
      } else if (event === 'SIGNED_OUT') {
        // Let the next sign-in run the full sync; a reused token would otherwise
        // be skipped as already applied and leave the previous dev's profile in
        // the store.
        appliedAccessToken = null;
        useAppStore.setState({ isLoggedIn: false, user: DEFAULT_USER, authReady: true });
        clearAuthCookies();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
};
