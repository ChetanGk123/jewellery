import type { Metadata } from "next";
import { Marcellus, Cormorant_Garamond, Jost } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getStoreSettings } from "@/lib/db/settings";
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
  const settings = await getStoreSettings();

  return (
    <html
      lang="en"
      className={`${marcellus.variable} ${cormorant.variable} ${jost.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <Header banner={settings.banner} />
        {children}
        <Footer />
      </body>
    </html>
  );
}
