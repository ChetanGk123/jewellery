import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { env } from "@/lib/env";

/**
 * Server-side Supabase client for React Server Components and route handlers.
 * Anon/publishable key only — no session persistence (storefront reads are
 * public via RLS). Admin writes (Phase 3) will use a separate service-role client.
 */
export function createServerClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
