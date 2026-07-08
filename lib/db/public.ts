import "server-only"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "./types"
import { env } from "@/lib/env"

/**
 * Cookie-free anon Supabase client for PUBLIC catalog reads (TASKS 4.18).
 *
 * The cookie-aware `createServerClient` reads `cookies()` — a request-scoped
 * dynamic API that `unstable_cache` forbids inside cached functions. Catalog
 * data (products, categories, reviews, settings) is RLS public-read, so those
 * queries never need the visitor's session; running them anonymously returns
 * identical rows and lets the data layer cache across requests.
 *
 * Never use this client for user-scoped reads (orders, profile) or any write —
 * those stay on the cookie client / RPCs so RLS sees the real user.
 */
export const publicClient = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
)
