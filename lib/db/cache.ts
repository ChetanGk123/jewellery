/**
 * Cross-request cache vocabulary for the public catalog (TASKS 4.18).
 *
 * Every route stays dynamically rendered (the nonce CSP requires per-request
 * HTML), but the Supabase reads underneath are cached with `unstable_cache`.
 * Tags let write paths expire exactly what they changed; the revalidate window
 * is the staleness ceiling when a write path forgets (or can't know — e.g. a
 * DB trigger).
 *
 * Who must revalidate what:
 * - `products`  — admin product upsert; category rename (embedded in listing
 *   rows); review approval (rating trigger); order placement/cancel (stock).
 * - `categories` — admin category upsert/delete.
 * - `reviews`   — review moderation.
 * - `settings`  — admin settings save.
 */
export const CACHE_TAGS = {
  products: "products",
  categories: "categories",
  reviews: "reviews",
  settings: "settings",
} as const;

/** Staleness ceiling (seconds) for cached catalog reads. */
export const CATALOG_REVALIDATE_SECONDS = 300;
