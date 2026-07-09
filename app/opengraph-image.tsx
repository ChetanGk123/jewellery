import { ImageResponse } from "next/og"
import { getStoreInfo } from "@/lib/db/settings"

export const runtime = "edge"
export const alt = "RJ Jewellers — Bridal & Fine Jewellery"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/**
 * Default site-wide OG image (TASKS 4.16) — a branded card in the storefront
 * palette, generated at request time via `next/og` rather than a static
 * asset (no real product photography exists yet, see 4.5). Any route can
 * override this by adding its own `opengraph-image` file; none do yet.
 */
export default async function Image() {
  const info = await getStoreInfo()
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #2A0A12 0%, #4A0E1C 55%, #71182B 100%)",
      }}
    >
      <div
        style={{
          fontSize: 80,
          fontWeight: 600,
          letterSpacing: 10,
          color: "#F3E3C7",
        }}
      >
        {info.wordmark}
      </div>
      <div
        style={{
          marginTop: 22,
          fontSize: 30,
          letterSpacing: 6,
          textTransform: "uppercase",
          color: "#E6CA7E",
        }}
      >
        {info.descriptor}
      </div>
    </div>,
    { ...size },
  )
}
