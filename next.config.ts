import type { NextConfig } from "next"

/**
 * Static security response headers applied to every route. The per-request,
 * nonce-based `Content-Security-Policy` is set separately in `middleware.ts`
 * (it can't live here because the nonce changes each request). These are the
 * headers that never vary, so config is the cheaper place for them.
 */
const securityHeaders = [
  // Force HTTPS for two years, including subdomains; eligible for preload lists.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Block MIME sniffing so a mistyped asset can't be treated as executable.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Legacy clickjacking guard; CSP `frame-ancestors 'self'` is the modern one.
  // SAMEORIGIN (was DENY) so the print dialog's same-origin iframe loads (6.6).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Send only the origin on cross-origin navigations — no full path/query leak.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop powerful features we never use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
] as const

/**
 * Supabase hostname for `next/image`, derived from the same public env var the
 * CSP uses (`supabaseOrigin` in proxy.ts). Hardcoding it here meant renaming
 * the self-hosted stack silently broke every product image with an
 * "unconfigured host" runtime error — env is the single source of truth.
 * Next loads `.env*` before evaluating this file.
 */
function supabaseImageHost(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  try {
    return url ? new URL(url).hostname : ""
  } catch {
    return ""
  }
}

const nextConfig: NextConfig = {
  // Trace only the files the server actually needs into `.next/standalone`, so
  // the Docker runtime image ships a minimal `server.js` + pruned node_modules
  // instead of the whole repo. See Dockerfile.
  output: "standalone",
  // Type errors are still a hard failure everywhere that matters — plain
  // `bun run build`, `bun run typecheck`, and CI. Only the Docker image build
  // opts out (it sets SKIP_TYPE_CHECK=1), because `tsc` costs ~112s of the
  // ~5.5min deploy on the 3-core VPS and re-checks a tree CI already checked.
  typescript: { ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === "1" },
  experimental: {
    // Persist Turbopack's compile cache to `.next/cache/turbopack` so repeat
    // builds only recompile what changed (locally: 3.7s cold → 230ms warm).
    // The Dockerfile keeps that directory alive across image builds with a
    // BuildKit cache mount.
    turbopackFileSystemCacheForBuild: true,
    serverActions: {
      // The bulk .xlsx import posts the sheet to a server action twice
      // (preview + apply); the 1 MB default would reject bigger catalogues.
      bodySizeLimit: "4mb",
    },
  },
  images: {
    remotePatterns: [
      ...(supabaseImageHost()
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseImageHost(),
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      // Managed Supabase Cloud project — remove once fully cut over to the
      // self-hosted stack above (docs/SELF_HOSTED_SUPABASE.md).
      {
        protocol: "https",
        hostname: "naolegptozpaiojozzcy.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: [...securityHeaders] }]
  },
  /**
   * Serve the operator handbook (Mintlify, `handbook/`) under our own origin at
   * `/docs`. Mintlify is a hosted platform — it can't be mounted as a real Next
   * route — so this reverse-proxies its deployment.
   *
   * **Requires the "Host at" toggle set to `<domain>/docs` in the Mintlify
   * dashboard** (their subpath hosting setup). That's what makes the deployment
   * emit its assets under `/mintlify-assets/*` and `/_mintlify/*`, which we
   * forward below. Without it Mintlify serves from root and its chunks land on
   * `/_next/static/*` — the same namespace as our own app's chunks — so the page
   * loads its HTML and then 404s every script. Verified: not a theory.
   *
   * Left off entirely until `HANDBOOK_ORIGIN` is set, so local dev doesn't get
   * a half-broken `/docs`. Preview the handbook with `bun run handbook` (:3333).
   *
   * These paths are excluded from the `proxy.ts` matcher — they carry
   * Mintlify's own script policy, not our nonce CSP, which would block their
   * bundle outright. Nothing of ours renders here.
   */
  async rewrites() {
    const handbook = process.env.HANDBOOK_ORIGIN
    if (!handbook) return { beforeFiles: [], afterFiles: [], fallback: [] }
    return {
      // Before filesystem + dynamic routing, so `/docs` beats the storefront's
      // `[category]` catch-all (which otherwise answers it "Category not found").
      beforeFiles: [
        { source: "/docs", destination: `${handbook}/docs` },
        { source: "/docs/:path*", destination: `${handbook}/docs/:path*` },
      ],
      afterFiles: [],
      // Only reached when this app has no such route — so Mintlify's own assets
      // (it is itself a Next app, sharing our `/_next/*` namespace) resolve here
      // while every real app asset is served by us, untouched. A blanket
      // `/_next/*` rewrite instead of a fallback would break the app.
      fallback: [
        { source: "/_next/:path*", destination: `${handbook}/_next/:path*` },
        { source: "/mintlify-assets/:path*", destination: `${handbook}/mintlify-assets/:path*` },
        { source: "/_mintlify/:path*", destination: `${handbook}/_mintlify/:path*` },
      ],
    }
  },
  /**
   * Dev doorway to the handbook. `mint dev` serves from root and emits
   * root-relative links (`/glossary`, `/selling/orders`) — it has no base-path
   * option, verified in `mint dev --help`. Proxying it under `/docs` therefore
   * yields a page that renders but whose every link escapes into the storefront
   * (`/glossary` → the `[category]` catch-all → "Category not found").
   *
   * So locally `/docs` redirects to the handbook server rather than pretending
   * to host it. The real in-place `/docs` needs Mintlify's "Host at" mode, which
   * makes *Mintlify* emit `/docs/...` links — see `rewrites()` above.
   */
  async redirects() {
    if (process.env.HANDBOOK_ORIGIN || process.env.NODE_ENV === "production") return []
    return [
      { source: "/docs", destination: "http://localhost:3333", permanent: false },
      { source: "/docs/:path*", destination: "http://localhost:3333/:path*", permanent: false },
    ]
  },
}

export default nextConfig
