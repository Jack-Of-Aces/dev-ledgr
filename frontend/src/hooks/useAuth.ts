/**
 * @file useAuth.ts
 * @description Application hook for managing authentication state, session lifecycle,
 * and role-based access checks (RBAC).
 */

'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { authService } from '@/services/auth/authService';
import { UserRole, Permission, hasPermission as checkRolePermission } from '@/types/auth';
import { setAuthCookies, clearAuthCookies } from '@/lib/cookies';
import { DEFAULT_USER } from '@/lib/mock-data';

export function useAuth() {
  const router = useRouter();
  const { user, isLoggedIn } = useAppStore();


  const loginWithGitHub = useCallback(
    async (username?: string, name?: string) => {
      const session = await authService.loginWithGitHub(username, name);
      if (session.token === 'pending_oauth_redirect') {
        return session;
      }

      const uname = username || session.username || 'developer';
      const rname = name || session.name || uname || 'Developer';
      // Never substitute a sample identity for a real one. The role comes from
      // the session, which the backend populates from public.profiles; reading
      // it from a shared constant here would both rename a real admin after a
      // demo persona and pin every sign-in to the base role.
      const profile = {
        ...DEFAULT_USER,
        username: uname,
        name: rname,
        role: session.role,
        avatarUrl: session.avatarUrl || DEFAULT_USER.avatarUrl,
        authProvider: 'github' as const,
        githubConnected: true,
        githubUsername: uname,
        githubUrl: `https://github.com/${uname}`,
        githubVerifiedAt: new Date().toISOString(),
        onboardingCompleted: false,
      };

      useAppStore.setState({
        isLoggedIn: true,
        user: profile,
        activeToast: {
          title: `Authenticated: @${profile.username}`,
          message: `Connected to DevLedgr consensus network with ${session.role.toUpperCase()} privileges.`,
        },
      });

      setAuthCookies(session.token, session.role);
      return session;
    },
    []
  );

  const loginWithGoogle = useCallback(
    async (email?: string, name?: string) => {
      const session = await authService.loginWithGoogle(email, name);
      if (session.token === 'pending_oauth_redirect') {
        return session;
      }

      const uname = email?.split('@')[0] || session.username || 'developer';
      const rname = name || session.name || 'Developer';
      const profile = {
        ...DEFAULT_USER,
        username: uname,
        name: rname,
        role: session.role,
        avatarUrl: session.avatarUrl || DEFAULT_USER.avatarUrl,
        email: email || `${uname}@gmail.com`,
        authProvider: 'google' as const,
        githubConnected: false,
        githubUsername: undefined,
        githubUrl: '',
        onboardingCompleted: false,
      };

      useAppStore.setState({
        isLoggedIn: true,
        user: profile,
        activeToast: {
          title: `Signed In via Google: ${rname}`,
          message: `Welcome to DevLedgr! Link your GitHub account to enable proof stamping.`,
        },
      });

      setAuthCookies(session.token, session.role);
      return session;
    },
    []
  );

  const connectGitHub = useCallback(
    async (githubUsername: string) => {
      const clean = githubUsername.replace(/^@/, '').trim();
      useAppStore.getState().connectGitHubAccount(clean);
    },
    []
  );

  const logout = useCallback(async () => {
    await authService.logout();
    clearAuthCookies();

    useAppStore.setState({
      isLoggedIn: false,
      activeToast: {
        title: 'Signed Out',
        message: 'Disconnected from DevLedgr session.',
      },
    });

    // Use router.push for internal navigation - avoids full page reload and
    // satisfies the Next.js no-location-assign-relative-destination rule.
    router.push('/');
  }, [router]);

  const can = useCallback(
    (permission: Permission): boolean => {
      const currentRole: UserRole = user.role || 'user';
      return checkRolePermission(currentRole, permission);
    },
    [user.role]
  );

  return {
    user,
    role: user.role || 'user',
    isLoggedIn,
    isAdmin: user.role === 'admin' || user.role === 'reviewer',
    loginWithGitHub,
    loginWithGoogle,
    connectGitHub,
    logout,
    can,
  };
}
