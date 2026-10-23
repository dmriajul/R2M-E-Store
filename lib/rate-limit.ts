/**
 * Sliding-window rate limiter (in memory).
 *
 * Good enough for a single Node process and for blunting abuse on serverless
 * instances, which each keep their own window. If the store ever runs on many
 * long-lived instances, swap the Map for a shared store (Upstash/Redis) — the
 * call sites only depend on `check(key)`.
 */

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the oldest hit leaves the window (0 when allowed). */
  retryAfter: number;
}

export interface RateLimiter {
  /** Records a hit for `key` and reports whether it is within the limit. */
  check(key: string): RateLimitResult;
}

/**
 * @param options.max      hits allowed per window
 * @param options.windowMs window length in milliseconds
 */
export function createRateLimiter({ max, windowMs }: { max: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, number[]>();
  let lastSweep = Date.now();

  /** Drops keys whose hits have all expired so the map can't grow forever. */
  function sweep(now: number) {
    if (now - lastSweep < windowMs) return;
    lastSweep = now;
    for (const [key, stamps] of hits) {
      if (stamps.every((stamp) => now - stamp >= windowMs)) hits.delete(key);
    }
  }

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      sweep(now);

      const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        const oldest = recent[0] ?? now;
        return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) };
      }

      recent.push(now);
      hits.set(key, recent);
      return { ok: true, retryAfter: 0 };
    },
  };
}

/** Best-effort client IP for anonymous rate-limit keys and Turnstile remoteip. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "anonymous"
  );
}
