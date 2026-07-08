import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./types"
import { env } from "@/lib/env"

/**
 * Service-role Supabase client for the admin console (Phase 3) — SERVER ONLY.
 *
 * Bypasses RLS, so it is the read/write path for admin views over data the
 * storefront's publishable key can't touch: the deny-all `order`/`order_item`
 * tables, unapproved `review` rows, and every admin mutation. The storefront
 * clients (`./client`, `./server`) keep using the RLS-safe publishable key and
 * never gain write policies — all elevated access funnels through here.
 *
 * The secret lives in `SUPABASE_SECRET_KEY` (a plain server env var, never
 * `NEXT_PUBLIC_*`), read lazily so the storefront build/runtime doesn't require
 * it — only code that actually calls `getAdminClient()` does. `import
 * "server-only"` makes the bundler error if a client module ever imports this.
 */
let cached: SupabaseClient<Database> | null = null

export function getAdminClient(): SupabaseClient<Database> {
  if (cached) return cached

  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set. The admin console needs the Supabase " +
        "service-role (secret) key — add it to .env.local (server-only, never " +
        "NEXT_PUBLIC_*).",
    )
  }

  cached = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    // A machine client: no user session, no token refresh, no cookie storage.
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
