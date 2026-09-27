/**
 * @file SupabaseAuthSync.tsx
 * @description Client-side synchronization bridge between Supabase Auth and DevLedgr Zustand store.
 * Automatically synchronizes login state, user avatars, and session cookies across tabs and reloads.
 * The dev record (including role) is owned by the backend; Supabase metadata is only used
 * as a placeholder until the backend profile loads.
 */

'use client';

import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { setAuthCookies, clearAuthCookies, getClientCookie, AUTH_COOKIE_NAME } from '@/lib/cookies';
import { DEFAULT_USER } from '@/lib/mock-data';
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
    const supabase = getSupabase();
    if (!supabase) return;

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
