"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import type { NavLink } from "@/lib/navigation"
import { STORE_INFO } from "@/lib/store-info"

type Props = {
  links: NavLink[]
  accountHref: string
  accountLabel: string
}

/**
 * Mobile-only hamburger + off-canvas drawer (≤`md`), mirroring the admin
 * console's drawer pattern (fixed backdrop + slide-in panel) in storefront
 * chrome. Replaces the primary nav strip on mobile, which wrapped into four
 * rows and pushed the hero below the fold (TASKS 4.7).
 */
export function MobileNavDrawer({ links, accountHref, accountLabel }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [isOpen])

  return (
    <div className="flex-none md:hidden">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className="flex h-9 w-9 flex-none flex-col items-center justify-center gap-[5px]"
      >
        <span className="h-[2px] w-5 bg-maroon-700" />
        <span className="h-[2px] w-5 bg-maroon-700" />
        <span className="h-[2px] w-5 bg-maroon-700" />
      </button>

      {isMounted &&
        createPortal(
          <>
            {isOpen && (
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 z-40 bg-black/40"
              />
            )}

            <aside
              aria-label="Mobile navigation"
              className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col overflow-y-auto bg-cream-50 px-5 py-6 shadow-[8px_0_24px_rgba(74,14,28,0.15)] transition-transform duration-300 ${
                isOpen ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="font-display text-[20px] tracking-[0.14em] text-maroon-700">
                  {STORE_INFO.wordmark}
                </span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setIsOpen(false)}
                  className="text-[22px] leading-none text-maroon-700"
                >
                  ×
                </button>
              </div>

              <nav aria-label="Primary" className="flex flex-col gap-1">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="rounded-sm border-b border-[#EFE3D0] px-2.5 py-3 text-[13.5px] font-medium uppercase leading-none tracking-[0.1em] text-[#5E4A44] transition-colors hover:text-maroon-700"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <Link
                href={accountHref}
                onClick={() => setIsOpen(false)}
                className="mt-5 rounded-sm border border-gold-300 px-2.5 py-3 text-center text-[13px] font-semibold text-maroon-700"
              >
                {accountLabel}
              </Link>
            </aside>
          </>,
          document.body,
        )}
    </div>
  )
}
