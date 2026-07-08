/**
 * Absolute site origin for SEO surfaces (sitemap, robots, metadataBase, JSON-LD
 * absolute URLs) — TASKS 4.16. Optional (falls back to localhost for dev),
 * unlike `lib/env.ts`'s required Supabase vars, since every environment
 * (including CI/tests) can run without a real domain configured yet.
 *
 * The value is validated, not just presence-checked: Docker/Compose passes an
 * *empty string* (`${NEXT_PUBLIC_SITE_URL:-}`) when the var is unset, which `??`
 * would happily hand to `new URL("")` and crash SSR for the whole app. So we
 * treat empty/whitespace/unparseable values as "not configured" and fall back.
 */
const FALLBACK_SITE_URL = "http://localhost:3000"

function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!raw) return FALLBACK_SITE_URL
  try {
    // Normalise (drops any trailing slash, validates the origin is parseable).
    return new URL(raw).origin
  } catch {
    return FALLBACK_SITE_URL
  }
}

export const SITE_URL = resolveSiteUrl()
