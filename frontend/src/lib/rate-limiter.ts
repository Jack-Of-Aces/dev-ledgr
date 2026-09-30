/**
 * @file rate-limiter.ts
 * @description Sliding window in-memory rate limiter for DevLedgr API routes.
 * Protects AI and external API endpoints against abuse and DoS with IP-level tracking.
 *
 * Client identification is only as good as the trust placed in the proxy chain,
 * so headers are consulted at all only when an operator says a trusted hop is
 * in front of the app. See getClientIp.
 */

interface RateLimitRecord {
  timestamps: number[];
}

/**
 * The counter store is a process-local Map, which means the effective limit is
 * per instance, not per deployment: N replicas behind a load balancer admit N ×
 * `limit` requests per window. That is a real weakening and it is not fixable
 * here — a shared store (Redis, or a limiter at the edge) is the fix, and
 * adding one is a dependency this file is not authorised to take. Until then,
 * treat these numbers as per-replica and put a shared limiter in front of a
 * multi-replica deployment. The same caveat is documented on the Go backend's
 * own rateLimiter.
 */
const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up stale entries every 5 minutes to prevent memory leak
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStaleEntries(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const expiry = now - windowMs;
  for (const [key, record] of rateLimitStore.entries()) {
    const valid = record.timestamps.filter((ts) => ts > expiry);
    if (valid.length === 0) {
      rateLimitStore.delete(key);
    } else {
      record.timestamps = valid;
    }
  }
}

export interface RateLimitOptions {
  /**
   * Maximum allowed requests in the sliding window. Default: 20.
   */
  limit?: number;
  /**
   * Sliding window duration in milliseconds. Default: 60,000 (1 minute).
   */
  windowMs?: number;
  /**
   * Overrides TRUSTED_PROXY_HOPS for this call. See getClientIp.
   */
  trustedProxyHops?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
  clientIp: string;
}

/**
 * Key used when the caller's address cannot be established.
 *
 * A Next.js route handler receives a Web `Request`, which carries no socket
 * address, so there is no way to fall back to the peer connection the way a
 * plain net/http handler can. Everything else is a client-supplied header.
 * Rather than pick one of those headers and call it an IP address, every caller
 * shares this bucket: an attacker cannot rotate a forged header to get fresh
 * quota, which is the failure this file exists to prevent, at the cost of the
 * bucket being shared. Operators behind a proxy should set TRUSTED_PROXY_HOPS
 * to get per-client limiting back.
 */
export const UNATTRIBUTED_CLIENT_KEY = 'unattributed';

let cachedProxyHops: number | null = null;

/**
 * Number of reverse proxies trusted to have appended to x-forwarded-for.
 *
 * Read from TRUSTED_PROXY_HOPS and cached: this is deployment configuration,
 * not a per-request value, and re-reading it on every call would be wasteful.
 */
function envTrustedProxyHops(): number {
  if (cachedProxyHops !== null) return cachedProxyHops;
  const parsed = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '', 10);
  cachedProxyHops = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  if (cachedProxyHops === 0) {
    console.warn(
      '[rate-limiter] TRUSTED_PROXY_HOPS is not set, so all callers share one rate-limit bucket. ' +
        'Set it to the number of proxies in front of this app to get per-client limiting.'
    );
  }
  return cachedProxyHops;
}

function parseForwardedFor(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part) => part.trim())
    // Strip an optional port so "1.2.3.4:5678" buckets the same as "1.2.3.4".
    .map((part) => part.replace(/^\[([^\]]+)](?::\d+)$/, '$1').replace(/:\d+$/, ''))
    .filter(Boolean);
}

/**
 * Extracts the client IP address.
 *
 * The old version took the first entry of x-forwarded-for unconditionally.
 * That entry is the one the *client* wrote: any caller can send
 * `x-forwarded-for: <fresh ip>` and walk straight through a per-IP limit, or
 * send a victim's address to have their quota burned. x-real-ip and
 * cf-connecting-ip are attacker-controlled for the same reason unless a proxy
 * overwrites them.
 *
 * x-forwarded-for is built left to right as `client, proxy1, proxy2, …`, so only
 * the entries a trusted hop appended are worth reading. With TRUSTED_PROXY_HOPS
 * set to the number of proxies in front of the app, the client address is that
 * many entries from the right, and everything to its left is ignored as forged.
 *
 * With no trusted hop configured there is nothing left to trust, so the caller
 * is bucketed under UNATTRIBUTED_CLIENT_KEY rather than under a header it
 * chose. Set TRUSTED_PROXY_HOPS=1 for a single nginx/Cloudflare/Vercel-style
 * proxy in front of the app.
 */
export function getClientIp(req: Request, options: RateLimitOptions = {}): string {
  const hops = options.trustedProxyHops ?? envTrustedProxyHops();

  if (hops > 0) {
    const chain = parseForwardedFor(req.headers.get('x-forwarded-for'));
    if (chain.length > 0) {
      const chosen = chain[Math.max(0, chain.length - hops)];
      if (chosen) return chosen;
    }

    // The configured proxy did not forward a usable chain. These two headers
    // are only meaningful when that same proxy overwrites them, which is
    // exactly the assertion TRUSTED_PROXY_HOPS makes, so they are read under
    // the same condition and never outside it.
    const realIp = req.headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;
    const cfIp = req.headers.get('cf-connecting-ip')?.trim();
    if (cfIp) return cfIp;
  }

  return UNATTRIBUTED_CLIENT_KEY;
}

/**
 * Checks and increments rate limit for a specific client and endpoint identifier.
 */
export function checkRateLimit(
  req: Request,
  routeIdentifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limit = options.limit ?? 20;
  const windowMs = options.windowMs ?? 60_000;
  const now = Date.now();
  const clientIp = getClientIp(req, options);
  const key = `${routeIdentifier}:${clientIp}`;

  cleanupStaleEntries(windowMs);

  const windowStart = now - windowMs;
  let record = rateLimitStore.get(key);

  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filter out timestamps outside the sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  const currentCount = record.timestamps.length;
  const oldestTimestamp = record.timestamps[0] || now;
  const resetInSeconds = Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000));

  if (currentCount >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetInSeconds,
      clientIp,
    };
  }

  // Record this request
  record.timestamps.push(now);

  return {
    allowed: true,
    limit,
    remaining: limit - record.timestamps.length,
    resetInSeconds,
    clientIp,
  };
}
