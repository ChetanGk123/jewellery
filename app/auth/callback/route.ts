import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin/roles";
import { safeNext } from "@/lib/auth/redirect";
import { createServerClient } from "@/lib/db/server";
import { ROUTES } from "@/lib/routes";

/**
 * Landing point for every emailed auth link + Google OAuth (TASKS 2.8).
 * Handles, in order:
 *
 *  1. `token_hash` + `type` — links from the recommended email templates
 *     (`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=…`).
 *     Verified SERVER-side via `verifyOtp`, so they work in any browser (no
 *     PKCE verifier needed) and don't depend on the redirect-URL allowlist.
 *  2. `code` — the PKCE exchange (Google OAuth, and default-template links
 *     opened in the same browser that requested them).
 *  3. Supabase error params (`error_code=otp_expired` etc.) — surfaced as a
 *     friendly message on the sign-in page instead of a dead end.
 */

/** `type` values an emailed link may carry — anything else is rejected. */
const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isEmailOtpType(value: string): value is EmailOtpType {
  return (EMAIL_OTP_TYPES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");
  const errorCode = url.searchParams.get("error_code");

  // 1) Template-based link: verify the hash server-side.
  if (tokenHash && type && isEmailOtpType(type)) {
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      // Recovery links continue to a choose-new-password screen. The email
      // carries no app context (the shared recovery template has no `next`), so
      // route by the recovering user's ROLE: an admin lands on the admin reset
      // page, a customer on theirs.
      if (type === "recovery") {
        const dest = isAdmin(data.user)
          ? ROUTES.adminResetPassword
          : ROUTES.resetPassword;
        return NextResponse.redirect(new URL(dest, url.origin));
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
    return redirectToSignIn(url.origin, isExpired(error.code) ? "expired" : "link");
  }

  // 2) PKCE code (OAuth / same-browser default-template links).
  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
    return redirectToSignIn(url.origin, "link");
  }

  // 3) Supabase bounced here with an error (expired/used link).
  return redirectToSignIn(
    url.origin,
    errorCode && isExpired(errorCode) ? "expired" : "link",
  );
}

function isExpired(code: string | null | undefined): boolean {
  return code === "otp_expired";
}

function redirectToSignIn(origin: string, error: "expired" | "link") {
  const signIn = new URL(ROUTES.signIn, origin);
  signIn.searchParams.set("error", error);
  return NextResponse.redirect(signIn);
}
