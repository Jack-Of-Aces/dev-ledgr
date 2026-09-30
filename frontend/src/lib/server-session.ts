/**
 * @file server-session.ts
 * @description Server-only resolution of the caller's authenticated identity for
 * the Next.js API routes.
 *
 * It exists because the browser store is not an authority. `useAppStore` is
 * persisted to localStorage and its `user` object and `submissions` array are
 * both writable from the console, so any route that took a profile or a
 * submission list from a request body was reading whatever the caller chose to
 * send. /api/ai/scrutiny did exactly that: unauthenticated, it returned a
 * finished recruiter CV and cover letter for any identity in the body, and
 * /api/github/verify-link treated a body-supplied address as "the registered
 * email" while reporting back whether any GitHub account used it.
 *
 * The only thing here that cannot be forged is the session cookie, and the only
 * thing that can turn a token into a profile is the Go backend, which verifies
 * the Supabase JWT and owns the dev record. So every identity-bearing route
 * resolves its caller through this module and treats the body as untrusted.
 *
 * SERVER-ONLY: this forwards the caller's own bearer token to the backend.
 * Importing it from a client component would ship that code to the browser.
 */

import { envConfig } from './config';
import { AUTH_COOKIE_NAME } from './cookies';
import type { SubmissionEntry, UserProfile } from '@/types';

// The backend is a separate service on the request path. A slow one must not
// turn into a hung route handler, so every call here is bounded.
const BACKEND_TIMEOUT_MS = 4000;

export interface ServerSession {
  /** The caller's Supabase access token. Never logged, never returned. */
  token: string;
  /** The authoritative dev record, owned by the backend. */
  profile: UserProfile;
  /**
   * The caller's ledger entries as held by the backend, already narrowed to the
   * ones a reviewer has stamped. See verifiedSubmissionsOnly for why.
   */
  submissions: SubmissionEntry[];
  /**
   * Whether the ledger read actually succeeded. It is separate from
   * `submissions` because an empty list has two very different causes — a dev
   * with no proofs, and a backend that could not be read — and a route that
   * reports proof counts must not conflate them.
   */
  ledger: 'ok' | 'unavailable';
}

export type SessionFailureCode =
  | 'NO_SESSION'
  | 'SESSION_REJECTED'
  | 'BACKEND_UNCONFIGURED'
  | 'BACKEND_UNREACHABLE';

export type SessionFailure = {
  ok: false;
  status: 401 | 503;
  code: SessionFailureCode;
  error: string;
};

export type SessionResolution = { ok: true; session: ServerSession } | SessionFailure;

function backendBaseUrl(): string {
  // API_URL (server-only) wins over the NEXT_PUBLIC_ value, matching
  // provider-key.ts, so a route can reach an internal address the browser
  // cannot see.
  return (process.env.API_URL || envConfig.apiUrl || '').replace(/\/$/, '');
}

/**
 * Reads the caller's session token.
 *
 * The cookie is the primary source: /auth/callback and useAuth both write
 * `devledgr_session` with the Supabase access token, and same-origin fetch
 * calls carry it automatically. A bearer header is accepted as well so a
 * server-to-server caller is not forced to mint a cookie.
 */
export function readSessionToken(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') || '';
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === AUTH_COOKIE_NAME) {
      const raw = rest.join('=');
      if (!raw) return null;
      try {
        return decodeURIComponent(raw) || null;
      } catch {
        return raw;
      }
    }
  }

  const auth = req.headers.get('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim() || null;
  }
  return null;
}

/**
 * Narrows a submission list to entries a reviewer has actually stamped.
 *
 * The generated CV and the job-gap check both describe these entries as
 * "verified proof" of work, and that document is read by recruiters. An entry
 * still sitting in the review queue has not been examined by anybody, so
 * listing it under a heading that claims verification asserts something the
 * platform has not established.
 */
export function verifiedSubmissionsOnly(subs: SubmissionEntry[]): SubmissionEntry[] {
  return subs.filter(
    (s) => Boolean(s) && s.status === 'verified' && typeof s.hash === 'string' && s.hash.length > 0
  );
}

/**
 * Fills in every field the CV templates read, so a sparse backend record cannot
 * produce "undefined" in a document a recruiter sees.
 */
function normalizeProfile(raw: Partial<UserProfile>): UserProfile {
  const username = String(raw.username || '');
  return {
    username,
    name: raw.name || username,
    avatarUrl: raw.avatarUrl || '',
    headline: raw.headline || '',
    bio: raw.bio || '',
    githubUrl: raw.githubUrl || '',
    portfolioValidUntil: raw.portfolioValidUntil || '',
    plan: raw.plan || 'free',
    hasApiKey: Boolean(raw.hasApiKey),
    statedSkills: Array.isArray(raw.statedSkills) ? raw.statedSkills.filter(Boolean) : [],
    role: raw.role || 'user',
    email: raw.email || '',
  };
}

async function loadSubmissions(
  base: string,
  token: string,
  username: string
): Promise<{ submissions: SubmissionEntry[]; ledger: ServerSession['ledger'] }> {
  try {
    const res = await fetch(
      `${base}/api/v1/submissions?username=${encodeURIComponent(username)}`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
      }
    );
    if (!res.ok) {
      return { submissions: [], ledger: 'unavailable' };
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      return { submissions: [], ledger: 'unavailable' };
    }
    return { submissions: verifiedSubmissionsOnly(data as SubmissionEntry[]), ledger: 'ok' };
  } catch (err) {
    console.warn('[server-session] Ledger read failed:', err);
    return { submissions: [], ledger: 'unavailable' };
  }
}

/**
 * Resolves the caller into an authoritative dev record.
 *
 * Fails closed at every step. A missing cookie is a 401; a token the backend
 * will not accept is a 401; a backend that is not configured or cannot be
 * reached is a 503. There is deliberately no branch that falls back to whatever
 * the request body claimed, because that fallback is the vulnerability.
 */
export async function resolveServerSession(req: Request): Promise<SessionResolution> {
  const token = readSessionToken(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: 'NO_SESSION',
      error: 'Sign in to use this endpoint.',
    };
  }

  const base = backendBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      code: 'BACKEND_UNCONFIGURED',
      error:
        'This endpoint needs a configured DevLedgr backend (API_URL or NEXT_PUBLIC_API_URL) to verify who is calling it.',
    };
  }

  let raw: Partial<UserProfile>;
  try {
    const res = await fetch(`${base}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        status: 401,
        code: 'SESSION_REJECTED',
        error: 'Your session is no longer valid. Sign in again.',
      };
    }
    if (!res.ok) {
      throw new Error(`dev record lookup returned HTTP ${res.status}`);
    }
    raw = (await res.json()) as Partial<UserProfile>;
  } catch (err) {
    // 503 rather than 401: the session may well be fine, the backend is not.
    // Either way we do not serve the request.
    console.warn('[server-session] Dev record lookup failed:', err);
    return {
      ok: false,
      status: 503,
      code: 'BACKEND_UNREACHABLE',
      error: 'Could not reach the DevLedgr backend to verify your session.',
    };
  }

  if (!raw || typeof raw.username !== 'string' || !raw.username) {
    return {
      ok: false,
      status: 401,
      code: 'SESSION_REJECTED',
      error: 'The backend returned no dev record for this session.',
    };
  }

  const { submissions, ledger } = await loadSubmissions(base, token, raw.username);

  return {
    ok: true,
    session: { token, profile: normalizeProfile(raw), submissions, ledger },
  };
}

/**
 * Reads the caller's registered email from the authoritative dev record.
 *
 * verify-link used to accept an address from the request body and treat it as
 * "the registered email", which turned a public GitHub route into an oracle:
 * ask it about any handle with any address and it would report whether that
 * address appears anywhere on that account. The address now comes from the
 * backend, so the caller can only ever be checked against their own.
 */
export async function resolveRegisteredEmail(
  req: Request
): Promise<{ ok: true; email: string } | SessionFailure> {
  const resolved = await resolveServerSession(req);
  if (!resolved.ok) return resolved;

  const email = resolved.session.profile.email?.trim();
  if (!email) {
    return {
      ok: false,
      status: 401,
      code: 'SESSION_REJECTED',
      error: 'No registered email is on this account, so there is nothing to verify ownership against.',
    };
  }
  return { ok: true, email: email.toLowerCase() };
}
