/**
 * @file cookies.ts
 * @description Client-side cookie utilities to synchronize auth sessions
 * between browser client state and Next.js Server/Edge Middleware.
 */

export const AUTH_COOKIE_NAME = 'devledgr_session';
export const ROLE_COOKIE_NAME = 'devledgr_role';

/**
 * Sets an auth session cookie readable by Next.js Edge Middleware.
 */
export function setAuthCookies(sessionToken: string, role: string): void {
  if (typeof document === 'undefined') return;
  // 7 days expiration
  const maxAge = 60 * 60 * 24 * 7;
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(
    sessionToken
  )}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `${ROLE_COOKIE_NAME}=${encodeURIComponent(
    role
  )}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Clears session cookies on logout.
 */
export function clearAuthCookies(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `${ROLE_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Reads a cookie value by name on the client.
 */
export function getClientCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}
