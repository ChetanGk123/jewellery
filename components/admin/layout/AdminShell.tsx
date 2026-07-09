"use client"

import { useState, type ReactNode } from "react"
import { AdminSidebar } from "./AdminSidebar"
import { AdminTopbar } from "./AdminTopbar"
import type { AdminNavCounts } from "@/lib/db/admin-metrics"

/**
 * Admin console frame: sidebar + topbar around the routed view. Owns the mobile
 * drawer open state (client) while the surrounding layout stays a Server
 * Component that fetches the nav counts.
 */
export function AdminShell({
  counts,
  wordmark,
  adminName,
  adminEmail,
  children,
}: {
  counts: AdminNavCounts
  /** Resolved store wordmark (Settings-editable, 6.15), forwarded to the sidebar. */
  wordmark: string
  adminName: string
  adminEmail: string
  children: ReactNode
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#F5F1EA] font-sans text-[#2A1F1A]">
      <AdminSidebar
        counts={counts}
        wordmark={wordmark}
        adminName={adminName}
        adminEmail={adminEmail}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar counts={counts} onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 px-5 py-7 pb-16 sm:px-8">{children}</main>
      </div>
    </div>
  )
}
