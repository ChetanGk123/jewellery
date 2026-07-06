/**
 * Absolute site origin for SEO surfaces (sitemap, robots, metadataBase, JSON-LD
 * absolute URLs) — TASKS 4.16. Optional (falls back to localhost for dev),
 * unlike `lib/env.ts`'s required Supabase vars, since every environment
 * (including CI/tests) can run without a real domain configured yet.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
