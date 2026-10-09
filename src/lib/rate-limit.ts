import "server-only";
import { headers } from "next/headers";

import { Redis } from "ioredis";

// Distributed rate limiter using Redis if REDIS_URL is provided,
// falling back to an in-memory fixed-window counter for local development.

let redisClient: Redis | null = null;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // Do not endlessly retry on failure
  });

  redisClient.defineCommand("rateLimit", {
    numberOfKeys: 1,
    lua: `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local windowMs = tonumber(ARGV[2])

      local count = redis.call("INCR", key)
      if count == 1 then
        redis.call("PEXPIRE", key, windowMs)
      end

      local ttl = redis.call("PTTL", key)
      if ttl == -1 then
        -- Safety catch if PEXPIRE failed or was missed
        redis.call("PEXPIRE", key, windowMs)
        ttl = windowMs
      end

      return { count, ttl }
    `
  });
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
      // @ts-expect-error dynamically defined command
      const result = await redisClient.rateLimit(redisKey, limit, windowMs) as [number, number];

      const count = result[0];
      const ttl = result[1];

      if (count > limit) {
        const retryAfterSeconds = Math.max(1, Math.ceil((ttl > 0 ? ttl : windowMs) / 1000));
        return { ok: false, retryAfterSeconds };
      }

      return { ok: true, remaining: limit - count };
    } catch (e) {
      console.error("Redis rate limit failed. Failing OPEN to prevent outage:", e);
      // In a distributed setup, failing open is safer than blocking legitimate traffic on redis disconnect.
      // We do not fallback to memory here as memory limiters in distributed deployments cause unpredictable and uneven limits.
      return { ok: true, remaining: 1 };
    }
  }

  // Local development / Single instance in-memory store
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
