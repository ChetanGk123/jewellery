import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/redirect";
import { createServerClient } from "@/lib/db/server";
import { ROUTES } from "@/lib/routes";

/**
 * OAuth / email-link landing point (PKCE). Google sign-in, sign-up
 * confirmation, magic links and password-reset links all return here with a
 * `?code=`; we exchange it for a session cookie and continue to the sanitised
 * `next` target. Failures fall back to the sign-in page rather than a 500 —
 * the common causes (expired or already-used link) are user-recoverable.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  const signIn = new URL(ROUTES.signIn, url.origin);
  signIn.searchParams.set("error", "link");
  return NextResponse.redirect(signIn);
}
