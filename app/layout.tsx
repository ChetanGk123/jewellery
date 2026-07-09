import type { Metadata } from "next"
import { headers } from "next/headers"
import { Marcellus, Cormorant_Garamond, Jost } from "next/font/google"
import { JsonLd } from "@/components/seo/JsonLd"
import { getNonce } from "@/lib/csp-nonce"
import { getStoreInfo } from "@/lib/db/settings"
import { buildOrganizationJsonLd } from "@/lib/seo"
import { SITE_URL } from "@/lib/site-url"
import "./globals.css"

const marcellus = Marcellus({
  variable: "--font-marcellus",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
})

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  display: "swap",
})

const DEFAULT_DESCRIPTION =
  "Handcrafted Kundan, Polki and temple jewellery for the Indian bride. Cash on delivery across India."

// Brand name is settings-driven (6.15): resolved per request from the DB-backed
// getStoreInfo() (cached; falls back to the STORE_INFO const) so tab titles
// can't drift from the storefront/emails. The descriptive suffix is editorial
// SEO copy, not brand identity.
export async function generateMetadata(): Promise<Metadata> {
  const info = await getStoreInfo()
  const title = `${info.name} — Bridal & Fine Jewellery`
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: `%s · ${info.name}`,
    },
    description: DEFAULT_DESCRIPTION,
    openGraph: {
      type: "website",
      siteName: info.name,
      title,
      description: DEFAULT_DESCRIPTION,
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: DEFAULT_DESCRIPTION,
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Reading a request header opts every route into dynamic rendering. That's the
  // deliberate cost of our strict, nonce-based CSP: only during a per-request
  // render can Next.js stamp the nonce (minted in `proxy.ts`) onto its own
  // bootstrap/hydration scripts, so `script-src 'nonce-…' 'strict-dynamic'`
  // allows them without ever falling back to `'unsafe-inline'`.
  await headers()
  const [nonce, info] = await Promise.all([getNonce(), getStoreInfo()])

  return (
    <html
      lang="en"
      className={`${marcellus.variable} ${cormorant.variable} ${jost.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <JsonLd data={buildOrganizationJsonLd(info)} nonce={nonce} />
        {children}
      </body>
    </html>
  )
}
