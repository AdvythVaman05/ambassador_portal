import "server-only";
import { headers } from "next/headers";

import { Redis } from "ioredis";

// Distributed rate limiter using Redis if REDIS_URL is provided,
// falling back to an in-memory fixed-window counter for local development.

let redisClient: Redis | null = null;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL);
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const PRUNE_ABOVE = 5000;

function prune(now: number) {
  if (buckets.size < PRUNE_ABOVE) return;
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}

export type RateCheck = { ok: true; remaining: number } | { ok: false; retryAfterSeconds: number };

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateCheck> {
  const redisKey = `ratelimit:${key}`;

  if (redisClient) {
    try {
      const result = await redisClient.multi()
        .incr(redisKey)
        .pttl(redisKey)
        .exec();

      if (result) {
        const count = result[0][1] as number;
        const ttl = result[1][1] as number;

        if (count === 1) {
          await redisClient.pexpire(redisKey, windowMs);
          return { ok: true, remaining: limit - 1 };
        }

        if (count > limit) {
          const retryAfterSeconds = Math.max(1, Math.ceil(ttl / 1000));
          return { ok: false, retryAfterSeconds };
        }

        return { ok: true, remaining: limit - count };
      }
    } catch (e) {
      console.error("Redis rate limit failed, falling back to memory:", e);
    }
  }

  // Fallback to in-memory store
  const now = Date.now();
  prune(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true, remaining: limit - bucket.count };
}

/** Best-effort caller identity for rate limiting: forwarded IP, else the socket-ish fallback. */
export async function clientKey(scope: string): Promise<string> {
  let ip = "unknown";
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    if (fwd) ip = fwd.split(",")[0]!.trim();
    else ip = h.get("x-real-ip") ?? "unknown";
  } catch {
    // headers() is unavailable outside a request context (scripts, build-time); don't block.
  }
  return `${scope}:${ip}`.slice(0, 160);
}

export const LIMITS = {
  apply: { limit: 5, windowMs: 60 * 60_000 },
  magicLink: { limit: 6, windowMs: 10 * 60_000 },
  passwordLogin: { limit: 8, windowMs: 10 * 60_000 },
  devSignIn: { limit: 30, windowMs: 10 * 60_000 },
  claim: { limit: 20, windowMs: 10 * 60_000 },
  submission: { limit: 40, windowMs: 10 * 60_000 },
} as const;
