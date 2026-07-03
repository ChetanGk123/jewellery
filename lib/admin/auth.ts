import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/db/server";
import { ROUTES } from "@/lib/routes";
import { isAdmin } from "./roles";

/**
 * Authoritative admin gate for server components / actions. Returns the
 * signed-in admin, or redirects to the admin sign-in (carrying `next` so the
 * operator lands back where they were headed). This is the real gate — the
 * proxy redirect is a coarse first line, and `getCurrentUser` revalidates the
 * JWT against Supabase Auth rather than trusting the cookie.
 */
export async function requireAdmin(next?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!isAdmin(user)) {
    const target = next
      ? `${ROUTES.adminSignIn}?next=${encodeURIComponent(next)}`
      : ROUTES.adminSignIn;
    redirect(target);
  }
  // isAdmin narrowed nothing for TS, but a non-admin already redirected above.
  return user as User;
}
