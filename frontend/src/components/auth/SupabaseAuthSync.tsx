/**
 * @file SupabaseAuthSync.tsx
 * @description Client-side synchronization bridge between Supabase Auth and DevLedgr Zustand store.
 * Automatically synchronizes login state, user avatars, and session cookies across tabs and reloads.
 */

'use client';

import { useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { setAuthCookies, clearAuthCookies } from '@/lib/cookies';
import { DEFAULT_USER } from '@/lib/mock-data';
import { UserRole } from '@/types/auth';

export const SupabaseAuthSync: React.FC = () => {
  const { setUser } = useAppStore();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user;
        const meta = u.user_metadata || {};
        const username = meta.user_name || meta.preferred_username || u.email?.split('@')[0] || 'developer';
        const name = meta.full_name || meta.name || username;
        const avatarUrl = meta.avatar_url || DEFAULT_USER.avatarUrl;
        const role: UserRole = meta.role === 'admin' ? 'admin' : 'user';

        useAppStore.setState({
          isLoggedIn: true,
          user: {
            ...DEFAULT_USER,
            username,
            name,
            role,
            headline: meta.headline || 'Full-Stack Software Engineer',
            bio: meta.bio || 'Verified developer on DevLedgr.',
            avatarUrl,
            githubUrl: meta.user_name ? `https://github.com/${meta.user_name}` : `https://github.com/${username}`,
            statedSkills: meta.skills || ['Go', 'TypeScript', 'PostgreSQL'],
            email: u.email,
          },
        });

        setAuthCookies(session.access_token, role);
      } else {
        // If there is no real session and cookies are empty, ensure not logged in
        const cookieToken = document.cookie.includes('devledgr_token');
        if (!cookieToken) {
          useAppStore.setState({ isLoggedIn: false });
        }
      }
    });

    // Listen to real-time auth events (OAuth redirect, signout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const u = session.user;
        const meta = u.user_metadata || {};
        const username = meta.user_name || meta.preferred_username || u.email?.split('@')[0] || 'developer';
        const name = meta.full_name || meta.name || username;
        const avatarUrl = meta.avatar_url || DEFAULT_USER.avatarUrl;
        const role: UserRole = meta.role === 'admin' ? 'admin' : 'user';

        useAppStore.setState({
          isLoggedIn: true,
          user: {
            ...DEFAULT_USER,
            username,
            name,
            role,
            headline: meta.headline || 'Full-Stack Software Engineer',
            bio: meta.bio || 'Verified developer on DevLedgr.',
            avatarUrl,
            githubUrl: meta.user_name ? `https://github.com/${meta.user_name}` : `https://github.com/${username}`,
            statedSkills: meta.skills || ['Go', 'TypeScript', 'PostgreSQL'],
            email: u.email,
          },
        });

        setAuthCookies(session.access_token, role);
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
  }, [setUser]);

  return null;
};
