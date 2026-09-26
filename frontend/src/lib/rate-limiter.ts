/**
 * @file rate-limiter.ts
 * @description Sliding window in-memory rate limiter for DevLedgr API routes.
 * Protects AI and external API endpoints against abuse and DoS with IP-level tracking.
 */

interface RateLimitRecord {
  timestamps: number[];
}

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
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
  clientIp: string;
}

/**
 * Extracts the client IP address from standard proxy headers.
 */
export function getClientIp(req: Request): string {
  const headers = req.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  return '127.0.0.1';
}

/**
 * Checks and increments rate limit for a specific IP and endpoint identifier.
 */
export function checkRateLimit(
  req: Request,
  routeIdentifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limit = options.limit ?? 20;
  const windowMs = options.windowMs ?? 60_000;
  const now = Date.now();
  const clientIp = getClientIp(req);
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
