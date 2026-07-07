"use client";

import { useState, useTransition } from "react";
import { toggleCoupon } from "@/app/(admin)/admin/(console)/coupons/actions";
import { AdminPager } from "@/components/admin/ui/AdminPager";
import {
  ADMIN_COUPONS_PAGE_SIZE,
  type AdminCouponRow,
  couponDiscountLabel,
  couponExpiryLabel,
  couponMinOrderLabel,
  couponUsageLabel,
} from "@/lib/admin/coupon";
import type { AdminCouponsPage } from "@/lib/db/admin-coupons";
import { ROUTES } from "@/lib/routes";
import { CouponModal } from "./CouponModal";

function hrefForPage(page: number): string {
  return page > 1 ? `${ROUTES.adminCoupons}?page=${page}` : ROUTES.adminCoupons;
}

/**
 * Coupons manager (TASKS 3.6, prototype-matched; paginated 5.10): a "Create
 * Coupon" button over a table (code, discount, min order, usage, expiry, active,
 * edit). The list is a single URL-driven page (`?page`). Each row's active state
 * flips inline through the `toggleCoupon` action; create/edit go through the
 * CouponModal.
 */
export function CouponsView({ page }: { page: AdminCouponsPage }) {
  // `null` = closed; "new" = create; an object = edit that coupon.
  const [modal, setModal] = useState<"new" | AdminCouponRow | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const onToggle = (row: AdminCouponRow) => {
    setError(null);
    setPendingId(row.id);
    startTransition(async () => {
      const res = await toggleCoupon(row.id, !row.isActive);
      setPendingId(null);
      if (!res.ok) setError(res.error ?? "Couldn't update the coupon.");
    });
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <button
        type="button"
        onClick={() => setModal("new")}
        className="inline-flex items-center gap-2 self-start rounded-lg bg-maroon-700 px-[18px] py-[11px] font-body text-[12px] font-semibold text-cream-200 transition-opacity hover:opacity-90"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Create Coupon
      </button>

      {error && (
        <p className="rounded-lg border border-[#F0C8CE] bg-[#FBE9E7] px-3 py-2.5 font-body text-[12.5px] text-[#C0392F]">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-[#EAE3D7] bg-white">
        <div className="overflow-x-auto">
          <div className="min-w-[870px]">
            {/* Header */}
            <div className="flex items-center gap-3.5 border-b border-[#EFE9DE] bg-[#FBF8F2] px-[22px] py-[13px] font-body text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8A7E74]">
              <span className="w-[140px]">Code</span>
              <span className="flex-1">Discount</span>
              <span className="w-[120px]">Min order</span>
              <span className="w-[120px]">Usage</span>
              <span className="w-[120px]">Expires</span>
              <span className="w-[90px] text-center">Active</span>
              <span className="w-[60px] text-center">Edit</span>
            </div>

            {page.rows.length === 0 ? (
              <p className="px-[22px] py-[50px] text-center font-body text-[13px] text-[#A99C90]">
                No coupons yet. Create your first discount code.
              </p>
            ) : (
              page.rows.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3.5 border-b border-[#F3EEE4] px-[22px] py-[15px] last:border-b-0"
                >
                  <span className="w-[140px] font-body text-[13px] font-semibold tracking-[0.04em] text-maroon-700">
                    {c.code}
                  </span>
                  <span className="flex-1 font-body text-[13px] font-medium text-[#2A1F1A]">
                    {couponDiscountLabel(c)}
                  </span>
                  <span className="w-[120px] font-body text-[12.5px] text-[#5E4A40]">
                    {couponMinOrderLabel(c)}
                  </span>
                  <span className="w-[120px] font-body text-[12.5px] text-[#5E4A40]">
                    {couponUsageLabel(c)}
                  </span>
                  <span className="w-[120px] font-body text-[12.5px] text-[#5E4A40]">
                    {couponExpiryLabel(c)}
                  </span>
                  <span className="flex w-[90px] justify-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={c.isActive}
                      aria-label={`${c.isActive ? "Deactivate" : "Activate"} ${c.code}`}
                      onClick={() => onToggle(c)}
                      disabled={pendingId === c.id}
                      className={`relative h-6 w-[42px] rounded-full transition-colors disabled:opacity-60 ${
                        c.isActive ? "bg-[#1E7A38]" : "bg-[#D8CFC2]"
                      }`}
                    >
                      <span
                        className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-[left] ${
                          c.isActive ? "left-[21px]" : "left-[3px]"
                        }`}
                      />
                    </button>
                  </span>
                  <span className="flex w-[60px] justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setModal(c);
                      }}
                      aria-label={`Edit ${c.code}`}
                      className="rounded-md border border-[#DAD0C2] bg-white px-3 py-1.5 font-body text-[11.5px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2]"
                    >
                      Edit
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <AdminPager
        page={page.page}
        pageCount={page.pageCount}
        total={page.total}
        pageSize={ADMIN_COUPONS_PAGE_SIZE}
        hrefForPage={hrefForPage}
      />

      {modal !== null && (
        <CouponModal
          coupon={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
