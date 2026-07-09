"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { getReviewContact, setReviewStatus } from "@/app/(admin)/admin/(console)/reviews/actions"
import { AdminPager } from "@/components/admin/ui/AdminPager"
import {
  ADMIN_REVIEWS_PAGE_SIZE,
  type AdminReviewRow,
  type ReviewContact,
  type ReviewFilter,
  REVIEW_FILTERS,
  reviewDateLabel,
  reviewStars,
  reviewStatusChip,
} from "@/lib/admin/review"
import type { AdminReviewsPage } from "@/lib/db/admin-reviews"
import { ROUTES } from "@/lib/routes"
import { customerWhatsappUrl, reviewContactMessage } from "@/lib/whatsapp"

/** Build a URL for a filter tab / page. Omits the default `Pending` filter + page 1. */
function hrefFor(filter: ReviewFilter, page: number): string {
  const params = new URLSearchParams()
  if (filter !== "Pending") params.set("status", filter)
  if (page > 1) params.set("page", String(page))
  const qs = params.toString()
  return qs ? `${ROUTES.adminReviews}?${qs}` : ROUTES.adminReviews
}

/**
 * Reviews moderation (TASKS 3.7, prototype-matched; paginated 5.10): Pending /
 * Approved / All filter pills with live counts over a responsive card grid. The
 * filter + page live in the URL (`?status`/`?page`), so the read is bounded and
 * the view is shareable. Each pending card carries ✓ Approve / × Reject actions
 * that flip its status through the `setReviewStatus` server action; the
 * storefront shows approved reviews only (already RLS-filtered).
 */
export function ReviewsView({ page }: { page: AdminReviewsPage }) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Reviewer contacts fetched on demand (6.12), keyed by review id.
  const [contacts, setContacts] = useState<Record<string, ReviewContact>>({})
  const [contactPendingId, setContactPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const moderate = (row: AdminReviewRow, status: "approved" | "rejected") => {
    setError(null)
    setPendingId(row.id)
    startTransition(async () => {
      const res = await setReviewStatus(row.id, status)
      setPendingId(null)
      if (!res.ok) setError(res.error ?? "Couldn't update the review.")
    })
  }

  const loadContact = (row: AdminReviewRow) => {
    setError(null)
    setContactPendingId(row.id)
    startTransition(async () => {
      const res = await getReviewContact(row.id)
      setContactPendingId(null)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setContacts((prev) => ({ ...prev, [row.id]: res.contact }))
    })
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {REVIEW_FILTERS.map((tab) => {
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
          {page.filter === "Pending"
            ? "Nothing to moderate — no reviews are awaiting approval."
            : "No reviews to show here yet."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {page.rows.map((r) => {
            const chip = reviewStatusChip(r.status)
            const isBusy = pendingId === r.id
            return (
              <article
                key={r.id}
                className="flex flex-col gap-2.5 rounded-xl border border-[#EAE3D7] bg-white p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-body text-[11px] font-medium uppercase tracking-[0.08em] text-[#A87A1E]">
                    {r.productName}
                  </span>
                  <span
                    className="shrink-0 rounded-full px-[9px] py-1 font-body text-[10.5px] font-semibold"
                    style={{ color: chip.color, background: chip.bg }}
                  >
                    {chip.label}
                  </span>
                </div>

                <span
                  aria-label={`${r.rating} out of 5 stars`}
                  className="text-[14px] tracking-[2px] text-gold-500"
                >
                  {reviewStars(r.rating)}
                </span>

                {r.title && (
                  <h3 className="m-0 font-heading text-[17px] font-semibold leading-[1.3] text-[#2A1F1A]">
                    {r.title}
                  </h3>
                )}
                {r.body && (
                  <p className="m-0 font-body text-[13px] font-light leading-[1.6] text-[#5E4A40]">
                    {r.body}
                  </p>
                )}

                <div className="font-body text-[12px] text-[#A99C90]">
                  {r.author} · {reviewDateLabel(r.createdAt)}
                </div>

                {/* Contact lookup (6.12) — account-linked reviews only; PII on demand. */}
                {r.hasContact &&
                  (contacts[r.id] ? (
                    <ReviewContactActions review={r} contact={contacts[r.id]} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => loadContact(r)}
                      disabled={contactPendingId === r.id}
                      className="self-start rounded-md border border-[#E7E0D4] bg-white px-2.5 py-1.5 font-body text-[11.5px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2] disabled:opacity-60"
                    >
                      {contactPendingId === r.id ? "Looking up…" : "Contact reviewer"}
                    </button>
                  ))}

                {r.status === "pending" && (
                  <div className="mt-1.5 flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => moderate(r, "approved")}
                      disabled={isBusy}
                      className="flex-1 rounded-md border border-[#BFE0C9] bg-[#E7F3EB] py-2.5 font-body text-[12px] font-semibold text-[#15692F] transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      ✓ Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => moderate(r, "rejected")}
                      disabled={isBusy}
                      className="flex-1 rounded-md border border-[#F0CBC6] bg-[#FBE9E7] py-2.5 font-body text-[12px] font-semibold text-[#C0392F] transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      × Reject
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      <AdminPager
        page={page.page}
        pageCount={page.pageCount}
        total={page.total}
        pageSize={ADMIN_REVIEWS_PAGE_SIZE}
        hrefForPage={(n) => hrefFor(page.filter, n)}
      />
    </div>
  )
}

/**
 * Ways to reach a looked-up reviewer (TASKS 6.12): Call / WhatsApp (prefilled
 * with a neutral opener naming their review's product) / Email — the 5.15
 * order-drawer button language. Buttons hide individually when a channel is
 * missing; a reviewer with no order has no phone but still an account email.
 */
function ReviewContactActions({
  review,
  contact,
}: {
  review: AdminReviewRow
  contact: ReviewContact
}) {
  if (!contact.phone && !contact.email) {
    return <p className="m-0 font-body text-[12px] text-[#A99C90]">No contact details on file.</p>
  }

  const message = reviewContactMessage({
    reviewerName: contact.name,
    productName: review.productName,
  })
  const waUrl = contact.phone ? customerWhatsappUrl(contact.phone, message) : null
  const base =
    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-body text-[11.5px] font-semibold transition-colors"

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className={`${base} border-[#E7E0D4] bg-white text-[#5E4A40] hover:bg-[#FBF8F2]`}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 2Z" />
            </svg>
            Call
          </a>
        )}
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${base} border-[#BFE3C8] bg-[#EAF6EE] text-[#128C4A] hover:bg-[#E0F1E6]`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.4-3c-.3-.4 0-.5.1-.7l.4-.5c.1-.2.2-.3.3-.5v-.5c0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s1 2.5 1.1 2.7c.1.2 1.9 3 4.7 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.4-.4Z" />
            </svg>
            WhatsApp
          </a>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className={`${base} border-[#E7E0D4] bg-white text-[#5E4A40] hover:bg-[#FBF8F2]`}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-10 6L2 7" />
            </svg>
            Email
          </a>
        )}
      </div>
      <p className="m-0 break-words font-body text-[11.5px] text-[#A99C90]">
        {[contact.phone, contact.email].filter(Boolean).join(" · ")}
      </p>
    </div>
  )
}
