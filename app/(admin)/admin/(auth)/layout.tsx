import type { Metadata } from "next"

/**
 * Admin auth screens (sign in / forgot / reset). A sibling group to `(console)`
 * so these pages sit OUTSIDE the console gate — you can't require being signed
 * in to reach the sign-in page. No sidebar/topbar chrome; each page renders its
 * own centered `AdminAuthShell`.
 */
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · RJ Jewellers Admin" },
  robots: { index: false, follow: false },
}

export default function AdminAuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>
}
