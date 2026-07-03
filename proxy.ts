import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request Content-Security-Policy with a nonce (TASKS — Security).
 *
 * Lives in `proxy.ts` (Next 16's successor to the deprecated `middleware.ts`).
 * A fresh nonce is minted for every document request and threaded to Next.js
 * (via the request `Content-Security-Policy` header, which Next reads to stamp
 * its own bootstrap/hydration `<script>` tags) and to the browser (via the
 * response header). `'strict-dynamic'` then lets those nonce'd scripts load the
 * rest of the chunk graph, so we never need `'unsafe-inline'` in `script-src`.
 *
 * Tradeoff: reading a per-request nonce opts pages into dynamic rendering. Our
 * storefront pages already render per-request (Supabase reads + `headers()`), so
 * the incremental cost is nil; revisit if any page becomes statically cacheable.
 *
 * `style-src 'unsafe-inline'` is retained deliberately: `next/font` injects an
 * inline `@font-face` <style> and inline `style` attributes are used for a few
 * dynamic widths — documented, low-risk (no script execution via style).
 */

/** Supabase origin (storage images + client SDK), derived from public env. */
function supabaseOrigin(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}

/** Base64 nonce from 16 CSPRNG bytes (Edge-runtime safe — no Node `Buffer`). */
function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export async function proxy(request: NextRequest) {
  const nonce = makeNonce();
  const supabase = supabaseOrigin();
  const isDev = process.env.NODE_ENV !== "production";

  // Production is strict: only nonce'd scripts run (via `'strict-dynamic'`).
  // Development must relax to `'unsafe-eval'`/`'unsafe-inline'` — Next's Fast
  // Refresh/HMR runtime evals code and injects un-nonce'd inline scripts, which
  // a strict policy would block, breaking the dev server entirely.
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  // Dev HMR opens a websocket back to the Next dev server; allow ws(s):.
  const connectSrc = isDev
    ? `connect-src 'self' ${supabase} ws: wss:`
    : `connect-src 'self' ${supabase}`;

  const directives = [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: ${supabase}`.trim(),
    `font-src 'self'`,
    connectSrc.trim(),
    `frame-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ];
  // Only force HTTPS upgrades in production (localhost dev is plain http).
  if (!isDev) directives.push(`upgrade-insecure-requests`);
  const csp = directives.join("; ");

  // Give Next the nonce (and CSP) on the *request* so it stamps its scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // Supabase session refresh: rotate an expired auth token on the way in so
  // Server Components always see a live session. When tokens rotate we must
  // (a) update the REQUEST cookies (so this render sees the new token) and
  // (b) rebuild the response and set the cookies on it (so the browser keeps
  // it) — the standard @supabase/ssr middleware dance, merged with our CSP
  // request headers.
  const supabaseClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          // request.cookies.set mutates the underlying Cookie header; re-sync
          // our forwarded header copy before rebuilding the response.
          requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );
  // Triggers the refresh when needed; result intentionally unused here.
  await supabaseClient.auth.getUser();

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  /**
   * Run on document requests only — skip Next static assets, the image
   * optimizer, and common static file extensions so we don't pay the nonce cost
   * (or override caching headers) on every chunk/font/image.
   */
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
