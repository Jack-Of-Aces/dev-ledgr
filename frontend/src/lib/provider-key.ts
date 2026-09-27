/**
 * @file provider-key.ts
 * @description Server-only lookup of the signed-in dev's BYOK AI provider key.
 * The key is stored encrypted by the Go backend and fetched server-to-server,
 * so it never has to be held in the browser (store, localStorage or requests).
 */

// Server-only: SERVICE_API_KEY has no NEXT_PUBLIC_ prefix, so Next.js never
// exposes it to client bundles.
import { envConfig } from './config';
import { AUTH_COOKIE_NAME } from './cookies';

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Returns the caller's stored provider key, or undefined when there is none,
 * the backend or SERVICE_API_KEY is not configured, or the lookup fails.
 * Callers then fall back to the server's own provider keys.
 */
export async function resolveProviderKey(req: Request): Promise<string | undefined> {
  const apiUrl = (process.env.API_URL || envConfig.apiUrl).replace(/\/$/, '');
  const serviceKey = process.env.SERVICE_API_KEY;
  const userToken = readCookie(req, AUTH_COOKIE_NAME);
  if (!apiUrl || !serviceKey || !userToken) {
    return undefined;
  }

  try {
    const res = await fetch(`${apiUrl}/api/internal/provider-key`, {
      headers: { 'X-Service-Key': serviceKey, 'X-User-Token': userToken },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return undefined;
    }
    const data: { apiKey?: string } = await res.json();
    return data.apiKey || undefined;
  } catch (err) {
    console.warn('[provider-key] Lookup failed; using server provider keys:', err);
    return undefined;
  }
}
