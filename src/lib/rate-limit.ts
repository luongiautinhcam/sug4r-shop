import { RATE_LIMIT_ENABLED } from "./constants";

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Periodically clean up old entries to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60_000; // 1 minute
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < 900_000); // 15 min max
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't prevent Node.js from exiting
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Sliding-window rate limiter (in-memory).
 *
 * @param key - Unique identifier (e.g., IP address, email, or combined)
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  if (!RATE_LIMIT_ENABLED) {
    return { allowed: true, remaining: limit, resetAt: new Date() };
  }

  ensureCleanupTimer();

  const now = Date.now();
  const windowStart = now - windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= limit) {
    const oldestInWindow = entry.timestamps[0]!;
    const resetAt = new Date(oldestInWindow + windowMs);
    return { allowed: false, remaining: 0, resetAt };
  }

  entry.timestamps.push(now);
  const remaining = limit - entry.timestamps.length;
  const resetAt = new Date(now + windowMs);

  return { allowed: true, remaining, resetAt };
}

/**
 * Pre-configured rate limit presets for common use cases.
 */
export const RATE_LIMITS = {
  /** Admin login: 5 attempts per 15 minutes per key */
  adminLogin: (key: string) => checkRateLimit(key, 5, 15 * 60 * 1000),

  /** Checkout: 10 attempts per 15 minutes per IP */
  checkout: (key: string) => checkRateLimit(key, 10, 15 * 60 * 1000),

  /** Delivery reveal: 10 attempts per 15 minutes per IP */
  delivery: (key: string) => checkRateLimit(key, 10, 15 * 60 * 1000),

  /** Webhook: 100 requests per minute per IP */
  webhook: (key: string) => checkRateLimit(key, 100, 60 * 1000),

  /** General API: 60 requests per minute per IP */
  general: (key: string) => checkRateLimit(key, 60, 60 * 1000),
} as const;
