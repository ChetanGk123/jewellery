import "server-only";
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database } from "./types";
import { env } from "@/lib/env";

/**
 * Server-side Supabase client for React Server Components, server actions and
 * route handlers. Cookie-aware (`@supabase/ssr`): requests run AS the signed-in
 * customer, so RLS row ownership (own orders, own profile) applies naturally.
 * Public catalog reads keep working unauthenticated via their public policies.
 * Admin writes (Phase 3) will use a separate service-role client.
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSSRClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where Next forbids cookie writes.
            // Safe to ignore: the proxy (middleware) refreshes sessions and is
            // the path that persists rotated tokens back to the browser.
          }
        },
      },
    },
  );
}

/**
 * Convenience: the signed-in Supabase user for the current request, or null.
 * `getUser()` revalidates the JWT against Supabase Auth (never trust the
 * cookie's claims alone) — use this in layouts/pages/actions for auth gates.
 * `React.cache`d so a render tree that asks twice pays one Auth round trip.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
});
