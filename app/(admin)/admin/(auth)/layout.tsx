import type { Metadata } from "next"
import { getStoreInfo } from "@/lib/db/settings"

/**
 * Admin auth screens (sign in / forgot / reset). A sibling group to `(console)`
 * so these pages sit OUTSIDE the console gate — you can't require being signed
 * in to reach the sign-in page. No sidebar/topbar chrome; each page renders its
 * own centered `AdminAuthShell`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const info = await getStoreInfo()
  return {
    title: { default: "Admin", template: `%s · ${info.name} Admin` },
    robots: { index: false, follow: false },
  }
}

export default function AdminAuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>
}
