"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { adminPageMeta } from "@/lib/admin/nav"
import type { AdminNavCounts } from "@/lib/db/admin-metrics"
import { ROUTES } from "@/lib/routes"

/**
 * Admin topbar (prototype-matched): mobile menu button, per-view page title +
 * subtitle (derived from the route), an order search box and a notification
 * bell. Submitting the search jumps to the orders queue filtered by `?q=`
 * (TASKS 5.5). The bell (TASKS 5.14) shows the pending-work total from the
 * same server-fetched counts as the sidebar badges, and opens a dropdown
 * linking each queue — fresh on every server render, not a live socket.
 */
export function AdminTopbar({
  counts,
  onMenuClick,
}: {
  counts: AdminNavCounts
  onMenuClick: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const { title, subtitle } = adminPageMeta(pathname)

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `${ROUTES.adminOrders}?q=${encodeURIComponent(q)}` : ROUTES.adminOrders)
  }

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-[#E7E0D4] bg-[#F5F1EA]/90 px-5 py-[18px] backdrop-blur-md sm:gap-5 sm:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-[#E7E0D4] bg-white lg:hidden"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#5E4A40"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="truncate font-heading text-[26px] font-semibold leading-none text-[#2A1F1A]">
          {title}
        </h1>
        <span className="truncate text-[12.5px] leading-none text-[#8A7E74]">{subtitle}</span>
      </div>

      <form
        role="search"
        onSubmit={onSearch}
        className="ml-auto hidden max-w-[340px] flex-1 items-center rounded-lg border border-[#E7E0D4] bg-white px-3 md:flex"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9C8A7E"
          strokeWidth={2}
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3-3" />
        </svg>
        <input
          type="search"
          id="admin-order-search"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search orders by number, customer, phone or email"
          placeholder="Search orders..."
          className="w-full flex-1 border-none bg-transparent px-2 py-[9px] text-[13px] text-[#2A1F1A] outline-none placeholder:text-[#9C8A7E]"
        />
      </form>

      <NotificationBell counts={counts} />
    </header>
  )
}

/**
 * Notification bell (TASKS 5.14): count badge = pending orders + reviews +
 * new messages; the dropdown links each queue. Same data as the sidebar
 * badges — server-fetched per request, so it refreshes on navigation.
 */
function NotificationBell({ counts }: { counts: AdminNavCounts }) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const total = counts.orders + counts.reviews + counts.messages

  // Dismiss on outside click / Escape (6.1). A backdrop element can't do this
  // reliably from inside the topbar's stacking context — higher-z siblings
  // swallow the click — so listen at the document level instead.
  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [isOpen])

  const items = [
    {
      label: "Pending orders",
      count: counts.orders,
      // Land on the Pending tab; reviews/messages already default to their queues.
      href: `${ROUTES.adminOrders}?status=Pending`,
    },
    { label: "Reviews to moderate", count: counts.reviews, href: ROUTES.adminReviews },
    { label: "New messages", count: counts.messages, href: ROUTES.adminMessages },
  ]

  return (
    <div ref={wrapRef} className="relative ml-auto flex-none md:ml-0">
      <button
        type="button"
        aria-label={total > 0 ? `Notifications — ${total} pending` : "Notifications"}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        className="relative flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-[#E7E0D4] bg-white transition-colors hover:border-[#D8CDB9]"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#5E4A40"
          strokeWidth={1.7}
          aria-hidden="true"
        >
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {total > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-maroon-700 px-1 text-[10px] font-bold leading-none text-cream-200">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[250px] overflow-hidden rounded-xl border border-[#EAE3D7] bg-white shadow-[0_14px_36px_rgba(42,10,18,0.14)]">
          <div className="border-b border-[#F0EADF] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A99C90]">
            Needs attention
          </div>
          {total === 0 ? (
            <p className="px-4 py-4 text-[12.5px] text-[#A99C90]">
              All caught up — nothing pending.
            </p>
          ) : (
            items
              .filter((item) => item.count > 0)
              .map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between gap-3 border-b border-[#F5F0E7] px-4 py-3 text-[13px] font-medium text-[#2A1F1A] transition-colors last:border-b-0 hover:bg-[#FBF8F2]"
                >
                  {item.label}
                  <span className="rounded-[9px] bg-maroon-700 px-[7px] py-[3px] text-[11px] font-semibold leading-none text-cream-200">
                    {item.count}
                  </span>
                </Link>
              ))
          )}
        </div>
      )}
    </div>
  )
}
