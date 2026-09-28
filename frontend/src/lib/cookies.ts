/**
 * @file cookies.ts
 * @description Client-side cookie utilities to synchronize auth sessions
 * between browser client state and Next.js Server/Edge Middleware.
 */

export const AUTH_COOKIE_NAME = 'devledgr_session';
export const ROLE_COOKIE_NAME = 'devledgr_role';

/**
 * The Supabase refresh token, set by /auth/callback alongside the access token.
 *
 * It exists because that route performs the PKCE exchange server-side, so the
 * browser's Supabase client never held a session and had nothing to auto-refresh
 * — leaving devledgr_session holding a one-hour access token under a seven-day
 * max-age, and every API call returning 401 INVALID_TOKEN once the hour was up.
 * The client reads this back to establish a real session on mount, after which
 * Supabase renews the access token itself and the cookie stops mattering.
 *
 * It is readable by script, which the access token already is: the Edge proxy
 * needs a non-HttpOnly cookie and the API is called with a bearer token from the
 * browser. It is not a new exposure, but it is a real one and moving both to
 * HttpOnly would mean proxying authenticated calls server-side.
 */
export const REFRESH_COOKIE_NAME = 'devledgr_refresh';

/**
 * Sets an auth session cookie readable by Next.js Edge Middleware.
 *
 * The max-age is the cookie's own lifetime, not the token's. Supabase access
 * tokens last an hour; the cookie outlives them deliberately so the session
 * survives a restart, and the client refreshes the token rather than trusting
 * this one to stay valid.
 */
export function setAuthCookies(sessionToken: string, role: string, refreshToken?: string): void {
  if (typeof document === 'undefined') return;
  // 7 days expiration
  const maxAge = 60 * 60 * 24 * 7;
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(
    sessionToken
  )}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `${ROLE_COOKIE_NAME}=${encodeURIComponent(
    role
  )}; path=/; max-age=${maxAge}; SameSite=Lax`;
  if (refreshToken) {
    document.cookie = `${REFRESH_COOKIE_NAME}=${encodeURIComponent(
      refreshToken
    )}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }
}

/**
 * Clears session cookies on logout.
 */
export function clearAuthCookies(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `${ROLE_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `${REFRESH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Reads a cookie value by name on the client.
 */
export function getClientCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}
