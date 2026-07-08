import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./types"
import { env } from "@/lib/env"

/**
 * Browser Supabase client (singleton). Uses the RLS-protected publishable key —
 * safe to ship to the browser. Cookie-based sessions (`@supabase/ssr`) so the
 * server (RSC/actions, via `./server`) sees the same signed-in customer; this
 * is the client the auth UI calls (sign in/up, OTP, OAuth, sign out).
 */
export const supabase = createBrowserClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
)
