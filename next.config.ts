import type { NextConfig } from "next";

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
  // Legacy clickjacking guard; CSP `frame-ancestors 'none'` is the modern one.
  { key: "X-Frame-Options", value: "DENY" },
  // Send only the origin on cross-origin navigations — no full path/query leak.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop powerful features we never use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
] as const;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "naolegptozpaiojozzcy.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: [...securityHeaders] }];
  },
};

export default nextConfig;