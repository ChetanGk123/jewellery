"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { setMessageStatus } from "@/app/(admin)/admin/(console)/messages/actions"
import { AdminPager } from "@/components/admin/ui/AdminPager"
import {
  ADMIN_MESSAGES_PAGE_SIZE,
  type AdminMessageRow,
  type MessageFilter,
  type MessageStatus,
  MESSAGE_FILTERS,
  messageDateLabel,
  messageStatusChip,
} from "@/lib/admin/message"
import type { AdminMessagesPage } from "@/lib/db/admin-messages"
import { ROUTES } from "@/lib/routes"

/** Build a URL for a filter tab / page. Omits the default `New` filter + page 1. */
function hrefFor(filter: MessageFilter, page: number): string {
  const params = new URLSearchParams()
  if (filter !== "New") params.set("status", filter)
  if (page > 1) params.set("page", String(page))
  const qs = params.toString()
  return qs ? `${ROUTES.adminMessages}?${qs}` : ROUTES.adminMessages
}

/**
 * Contact messages queue (TASKS 3.8, prototype-matched; paginated 5.10): All /
 * New / In Progress / Resolved filter pills with live counts over a responsive
 * card grid. The filter + page live in the URL (`?status`/`?page`), so the read
 * is bounded and the view is shareable. Each ticket card shows its number, status
 * pill, subject, sender, message and date, with context actions — Start (New → In
 * Progress), ✓ Resolve (→ Resolved) and Reopen (Resolved → In Progress) — driven
 * through the `setMessageStatus` server action.
 */
export function MessagesView({ page }: { page: AdminMessagesPage }) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const move = (row: AdminMessageRow, status: MessageStatus) => {
    setError(null)
    setPendingId(row.id)
    startTransition(async () => {
      const res = await setMessageStatus(row.id, status)
      setPendingId(null)
      if (!res.ok) setError(res.error ?? "Couldn't update the message.")
    })
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {MESSAGE_FILTERS.map((tab) => {
          const active = page.filter === tab
          return (
            <Link
              key={tab}
              href={hrefFor(tab, 1)}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-4 py-[9px] text-[12.5px] font-medium transition-colors ${
                active
                  ? "border-maroon-700 bg-maroon-700 text-cream-200"
                  : "border-[#EAE3D7] bg-white text-[#5E4A40] hover:border-[#D8CDB9]"
              }`}
            >
              {tab} <span className="opacity-70">{page.counts[tab]}</span>
            </Link>
          )
        })}
      </div>

      {error && (
        <p className="rounded-lg border border-[#F0C8CE] bg-[#FBE9E7] px-3 py-2.5 font-body text-[12.5px] text-[#C0392F]">
          {error}
        </p>
      )}

      {page.rows.length === 0 ? (
        <p className="rounded-xl border border-[#EAE3D7] bg-white px-[22px] py-[50px] text-center font-body text-[13px] text-[#A99C90]">
          No messages with this status.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {page.rows.map((m) => {
            const chip = messageStatusChip(m.status)
            const isBusy = pendingId === m.id
            return (
              <article
                key={m.id}
                className="flex flex-col gap-[11px] rounded-xl border border-[#EAE3D7] bg-white p-5"
              >
                <div className="flex items-center justify-between gap-2.5">
                  <span className="font-body text-[12.5px] font-semibold tracking-[0.03em] text-[#71182B]">
                    {m.ticketNo}
                  </span>
                  <span
                    className="shrink-0 rounded-full px-[11px] py-[5px] font-body text-[10.5px] font-semibold"
                    style={{ color: chip.color, background: chip.bg }}
                  >
                    {chip.label}
                  </span>
                </div>

                <div className="flex flex-col gap-[3px]">
                  <span className="font-heading text-[18px] font-semibold leading-[1.25] text-[#2A1F1A]">
                    {m.subject || "No subject"}
                  </span>
                  <span className="font-body text-[12px] text-[#A99C90]">{m.name}</span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-body text-[12px] text-[#8A7E74]">
                    {m.email && <span>{m.email}</span>}
                    {m.email && m.phone && <span className="text-[#D8CDB9]">·</span>}
                    {m.phone && <span>{m.phone}</span>}
                  </span>
                </div>

                <ContactActions email={m.email} phone={m.phone} />

                <p className="m-0 whitespace-pre-line font-body text-[13px] font-light leading-[1.6] text-[#5E4A40]">
                  {m.body}
                </p>

                <div className="mt-0.5 flex items-center justify-between gap-2.5">
                  <span className="font-body text-[11.5px] text-[#A99C90]">
                    {messageDateLabel(m.createdAt)}
                  </span>
                  <div className="flex gap-2">
                    {m.status === "New" && (
                      <button
                        type="button"
                        onClick={() => move(m, "In Progress")}
                        disabled={isBusy}
                        className="rounded-md border border-[#E8D6A8] bg-[#FBF1DD] px-[13px] py-2 font-body text-[11.5px] font-semibold text-[#B7791F] transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        Start
                      </button>
                    )}
                    {m.status === "Resolved" && (
                      <button
                        type="button"
                        onClick={() => move(m, "In Progress")}
                        disabled={isBusy}
                        className="rounded-md border border-[#E7E0D4] bg-white px-[13px] py-2 font-body text-[11.5px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2] disabled:opacity-60"
                      >
                        Reopen
                      </button>
                    )}
                    {m.status !== "Resolved" && (
                      <button
                        type="button"
                        onClick={() => move(m, "Resolved")}
                        disabled={isBusy}
                        className="rounded-md border border-[#BFE0C9] bg-[#E7F3EB] px-[13px] py-2 font-body text-[11.5px] font-semibold text-[#15692F] transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        ✓ Resolve
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <AdminPager
        page={page.page}
        pageCount={page.pageCount}
        total={page.total}
        pageSize={ADMIN_MESSAGES_PAGE_SIZE}
        hrefForPage={(n) => hrefFor(page.filter, n)}
      />
    </div>
  )
}

/** India country code for the WhatsApp deep link (10-digit local numbers). */
const WA_COUNTRY_CODE = "91"

/**
 * One-click ways to reach the customer about their enquiry: Call and WhatsApp
 * (phone) and Mail (email). Each is a real deep link — `tel:` / `mailto:` open
 * the OS handler; the WhatsApp link opens wa.me with the number in international
 * form. A link only shows when its detail is present.
 */
function ContactActions({ email, phone }: { email: string; phone: string }) {
  const digits = phone.replace(/\D/g, "")
  const base =
    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-body text-[11.5px] font-semibold transition-colors"
  const neutral = "border-[#E7E0D4] bg-white text-[#5E4A40] hover:bg-[#FBF8F2]"
  const whatsapp = "border-[#BFE3C8] bg-[#EAF6EE] text-[#128C4A] hover:bg-[#E0F1E6]"

  if (!digits && !email) return null

  return (
    <div className="flex flex-wrap gap-2">
      {digits && (
        <a href={`tel:${phone}`} className={`${base} ${neutral}`}>
          <PhoneIcon /> Call
        </a>
      )}
      {digits && (
        <a
          href={`https://wa.me/${WA_COUNTRY_CODE}${digits}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${base} ${whatsapp}`}
        >
          <WhatsAppIcon /> WhatsApp
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={`${base} ${neutral}`}>
          <MailIcon /> Mail
        </a>
      )}
    </div>
  )
}

function PhoneIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.9.36 1.78.68 2.62a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.46-1.25a2 2 0 0 1 2.11-.45c.84.32 1.72.55 2.62.68A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.004c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2zm5.8 14.16c-.24.68-1.42 1.3-1.95 1.34-.5.05-.99.21-3.35-.7-2.83-1.11-4.62-3.99-4.76-4.18-.14-.19-1.14-1.52-1.14-2.9 0-1.38.72-2.06.98-2.34.24-.26.53-.33.71-.33l.5.01c.16.01.38-.06.59.45.24.58.82 2 .89 2.14.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.38-.42.51-.14.14-.28.29-.12.57.16.28.72 1.18 1.54 1.91 1.06.94 1.95 1.24 2.23 1.38.28.14.44.12.6-.07.16-.19.69-.8.87-1.08.18-.28.36-.23.61-.14.25.09 1.6.75 1.87.89.28.14.46.21.53.33.07.12.07.68-.17 1.36z" />
    </svg>
  )
}
