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
      {
        protocol: "https",
        hostname: "jewellery-db.chetanlab.org",
        pathname: "/storage/v1/object/public/**",
      },
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
}

export default nextConfig
