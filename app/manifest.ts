import type { MetadataRoute } from "next"

/**
 * Web-app manifest (6.17): makes the site installable so iOS (16.4+) can
 * deliver admin push notifications — Apple only allows Web Push for
 * home-screen-installed apps. start_url points at the admin console because
 * the operator is the install audience; the storefront is unaffected by this
 * file existing.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JR Jewellers Admin",
    short_name: "JR Admin",
    description: "JR Jewellers store console — orders, catalogue, and alerts.",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#FBF6EE",
    theme_color: "#2A0A12",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  }
}
