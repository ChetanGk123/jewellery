import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isAdmin } from "@/lib/admin/roles"
import { ROUTES } from "@/lib/routes"

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  try {
    return url ? new URL(url).origin : ""
  } catch {
    return ""
  }
}

/** Base64 nonce from 16 CSPRNG bytes (Edge-runtime safe — no Node `Buffer`). */
function makeNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

export async function proxy(request: NextRequest) {
  const nonce = makeNonce()
  const supabase = supabaseOrigin()
  const isDev = process.env.NODE_ENV !== "production"

  // Production is strict: only nonce'd scripts run (via `'strict-dynamic'`).
  // Development must relax to `'unsafe-eval'`/`'unsafe-inline'` — Next's Fast
  // Refresh/HMR runtime evals code and injects un-nonce'd inline scripts, which
  // a strict policy would block, breaking the dev server entirely.
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`

  // Realtime (6.9) opens a websocket to the Supabase host. CSP3 lets wss
  // match the https origin, but older Safari needs it spelled out.
  const supabaseWs = supabase.replace(/^https:/, "wss:")

  // Dev HMR opens a websocket back to the Next dev server; allow ws(s):.
  const connectSrc = isDev
    ? `connect-src 'self' ${supabase} ws: wss:`
    : `connect-src 'self' ${supabase} ${supabaseWs}`

  const directives = [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: ${supabase}`.trim(),
    `font-src 'self'`,
    connectSrc.trim(),
    // 'self' (was 'none'): the order print dialog (6.6) embeds our own
    // /admin/orders/[no]/print route in an iframe. Cross-origin framing —
    // both directions — stays blocked.
    `frame-src 'self'`,
    `frame-ancestors 'self'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ]
  // Only force HTTPS upgrades in production (localhost dev is plain http).
  if (!isDev) directives.push(`upgrade-insecure-requests`)
  const csp = directives.join("; ")

  // Give Next the nonce (and CSP) on the *request* so it stamps its scripts.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  let response = NextResponse.next({ request: { headers: requestHeaders } })

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
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          // request.cookies.set mutates the underlying Cookie header; re-sync
          // our forwarded header copy before rebuilding the response.
          requestHeaders.set("cookie", request.headers.get("cookie") ?? "")
          response = NextResponse.next({ request: { headers: requestHeaders } })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )
  // Triggers the session refresh when needed, and gives us the verified JWT
  // claims for the admin gate below. `getClaims()` (not `getUser()`): the
  // project signs JWTs with an asymmetric key (ES256), so verification runs
  // locally via WebCrypto against the JWKS (module-cached ~10 min) — no Auth
  // server round trip on every navigation (TASKS 4.18). Near-expiry sessions
  // are still refreshed first, which is what persists rotated cookies above.
  const { data: claimsData } = await supabaseClient.auth.getClaims()
  const claims = claimsData?.claims ?? null

  // Coarse admin gate: bounce non-admins off the console before it renders. The
  // console layout re-checks authoritatively via `requireAdmin`; this is the
  // early first line (and covers the `(auth)` pages via `isAdminPublic`).
  const path = request.nextUrl.pathname
  const isAdminArea = path === ROUTES.admin || path.startsWith(`${ROUTES.admin}/`)
  const isAdminPublic =
    path === ROUTES.adminSignIn ||
    path === ROUTES.adminForgotPassword ||
    path === ROUTES.adminResetPassword
  // Note: redirecting an already-signed-in admin OFF the sign-in page is handled
  // authoritatively by the sign-in page itself (getCurrentUser → getUser). Doing
  // it here from the locally-verified `claims` would trust a stale role claim
  // after a hard revoke (session deleted, JWT not yet expired) and fight the
  // layout's requireAdmin redirect — an infinite loop.
  if (isAdminArea && !isAdminPublic && !isAdmin(claims)) {
    const signIn = new URL(ROUTES.adminSignIn, request.url)
    signIn.searchParams.set("next", path)
    const redirectRes = NextResponse.redirect(signIn)
    redirectRes.headers.set("Content-Security-Policy", csp)
    redirectRes.headers.set("Cache-Control", "no-store, must-revalidate")
    return redirectRes
  }

  // Never let the browser cache a console document. Without this, a revoked admin
  // could hit Back and have bfcache resurrect the fully-rendered console without
  // re-hitting the gate; `no-store` excludes these pages from bfcache so Back
  // forces a fresh request (which the checks above + `requireAdmin` re-run on).
  if (isAdminArea) {
    response.headers.set("Cache-Control", "no-store, must-revalidate")
  }

  response.headers.set("Content-Security-Policy", csp)
  return response
}

export const config = {
  /**
   * Run on document requests only — skip Next static assets, the image
   * optimizer, and common static file extensions so we don't pay the nonce cost
   * (or override caching headers) on every chunk/font/image.
   */
  matcher: [
    {
      // `docs`, `mintlify-assets` and `_mintlify` are the rewritten Mintlify
      // handbook (see next.config.ts): a foreign app on our origin. Our nonce
      // CSP would block its scripts, and it needs no session or admin gate —
      // so skip all three entirely.
      source:
        "/((?!_next/static|_next/image|docs|mintlify-assets|_mintlify|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
