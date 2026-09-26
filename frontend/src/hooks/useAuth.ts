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
import { ADMIN_USER, DEFAULT_USER } from '@/lib/mock-data';

export function useAuth() {
  const router = useRouter();
  const { user, setUser, isLoggedIn, showToast } = useAppStore();


  const loginWithGitHub = useCallback(
    async (username?: string, name?: string) => {
      const session = await authService.loginWithGitHub(username, name);
      if (session.token === 'pending_oauth_redirect') {
        return session;
      }

      const uname = username || session.username || 'junior_dev';
      const rname = name || session.name || 'Alex Okafor';
      const profile = session.role === 'admin' ? ADMIN_USER : { ...DEFAULT_USER, username: uname, name: rname };

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

  const loginWithEmail = useCallback(
    async (email: string) => {
      const result = await authService.loginWithEmail(email);
      showToast({
        title: 'Magic Link Dispatched',
        message: result.message,
      });
      return result;
    },
    [showToast]
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

  const switchRole = useCallback(
    async (targetRole: UserRole) => {
      const updatedProfile = await authService.switchRole(targetRole);

      setUser({ ...updatedProfile });
      setAuthCookies(`mock_token_${Date.now()}_${targetRole}`, targetRole);

      showToast({
        title: `Switched Persona: @${updatedProfile.username}`,
        message: `Now viewing DevLedgr as ${targetRole.toUpperCase()}.`,
      });

      return updatedProfile;
    },
    [setUser, showToast]
  );

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
    loginWithEmail,
    logout,
    switchRole,
    can,
  };
}
