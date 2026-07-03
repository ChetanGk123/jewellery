import type { Metadata } from "next";
import { headers } from "next/headers";
import { Marcellus, Cormorant_Garamond, Jost } from "next/font/google";
import "./globals.css";

const marcellus = Marcellus({
  variable: "--font-marcellus",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "JR Jewellers — Bridal & Fine Jewellery",
    template: "%s · JR Jewellers",
  },
  description:
    "Handcrafted Kundan, Polki and temple jewellery for the Indian bride. Cash on delivery across India.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading a request header opts every route into dynamic rendering. That's the
  // deliberate cost of our strict, nonce-based CSP: only during a per-request
  // render can Next.js stamp the nonce (minted in `proxy.ts`) onto its own
  // bootstrap/hydration scripts, so `script-src 'nonce-…' 'strict-dynamic'`
  // allows them without ever falling back to `'unsafe-inline'`.
  await headers();

  return (
    <html
      lang="en"
      className={`${marcellus.variable} ${cormorant.variable} ${jost.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
