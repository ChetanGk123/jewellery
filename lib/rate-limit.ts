import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort in-memory fixed-window rate limiter (TASKS 3.9).
 *
 * Guards anon-callable server actions (e.g. the newsletter subscribe) from
 * rapid abuse. It's a single-process Map, so it's per-instance — good enough to
 * blunt a burst from one client on a single Node server, NOT a distributed
 * guarantee. If this ever runs across many serverless instances, swap the store
 * for Redis/Upstash behind the same `checkRateLimit` signature. The DB unique
 * index + the RPC's own validation remain the real correctness boundary; this
 * is purely an abuse throttle.
 */

type Window = { count: number; resetAt: number };

const store = new Map<string, Window>();

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the window resets (only meaningful when `ok` is false). */
  retryAfterSec: number;
};

type Options = {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** A monotonic timestamp; injectable so callers/tests aren't tied to the clock. */
  now?: number;
};

/**
 * Records a hit for `key` and reports whether it's within the allowance. Expired
 * windows are reset lazily on access; a light sweep keeps the Map from growing
 * unboundedly under many distinct keys.
 */
export function checkRateLimit(key: string, options: Options): RateLimitResult {
  const now = options.now ?? Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    sweep(now);
    return { ok: true, retryAfterSec: 0 };
  }

  if (existing.count >= options.limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

/** Drop expired windows so a stream of unique keys can't leak memory. */
function sweep(now: number): void {
  if (store.size < 1000) return;
  for (const [key, window] of store) {
    if (window.resetAt <= now) store.delete(key);
  }
}

/**
 * A coarse per-client key for a server action, derived from the forwarded
 * client IP. Falls back to a shared bucket when no IP header is present (local
 * dev) — that only ever makes the limit stricter, never leakier.
 */
export async function clientRateKey(scope: string): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${scope}:${ip}`;
}
