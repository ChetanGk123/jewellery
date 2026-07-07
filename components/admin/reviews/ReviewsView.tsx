"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setReviewStatus } from "@/app/(admin)/admin/(console)/reviews/actions";
import { AdminPager } from "@/components/admin/ui/AdminPager";
import {
  ADMIN_REVIEWS_PAGE_SIZE,
  type AdminReviewRow,
  type ReviewFilter,
  REVIEW_FILTERS,
  reviewDateLabel,
  reviewStars,
  reviewStatusChip,
} from "@/lib/admin/review";
import type { AdminReviewsPage } from "@/lib/db/admin-reviews";
import { ROUTES } from "@/lib/routes";

/** Build a URL for a filter tab / page. Omits the default `Pending` filter + page 1. */
function hrefFor(filter: ReviewFilter, page: number): string {
  const params = new URLSearchParams();
  if (filter !== "Pending") params.set("status", filter);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${ROUTES.adminReviews}?${qs}` : ROUTES.adminReviews;
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
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const moderate = (row: AdminReviewRow, status: "approved" | "rejected") => {
    setError(null);
    setPendingId(row.id);
    startTransition(async () => {
      const res = await setReviewStatus(row.id, status);
      setPendingId(null);
      if (!res.ok) setError(res.error ?? "Couldn't update the review.");
    });
  };

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {REVIEW_FILTERS.map((tab) => {
          const active = page.filter === tab;
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
          );
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
            const chip = reviewStatusChip(r.status);
            const isBusy = pendingId === r.id;
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
            );
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
  );
}
