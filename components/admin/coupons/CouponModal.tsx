"use client";

import { useState, useTransition } from "react";
import {
  deleteCoupon,
  upsertCoupon,
} from "@/app/(admin)/admin/(console)/coupons/actions";
import { useDialog } from "@/hooks/useDialog";
import type { AdminCouponRow } from "@/lib/admin/coupon";
import type { CouponKind } from "@/lib/coupons";

type Props = {
  /** Existing coupon to edit, or null/omitted to create a new one. */
  coupon?: AdminCouponRow | null;
  onClose: () => void;
};

/** Reverse the action's rupees→paise / value encoding back to input strings. */
function paiseToRupeeString(paise: number | null): string {
  return paise != null ? String(paise / 100) : "";
}

function valueStringFor(row: AdminCouponRow): string {
  if (row.kind === "free_shipping") return "";
  if (row.kind === "fixed") return String(row.value / 100);
  return String(row.value); // percent
}

const KIND_OPTIONS: { value: CouponKind; label: string }[] = [
  { value: "percent", label: "Percent off" },
  { value: "fixed", label: "Fixed amount" },
  { value: "free_shipping", label: "Free shipping" },
];

/**
 * Create Coupon modal (TASKS 3.6 + 3.6b, prototype-matched — 460px card: code,
 * type + value, min order, max discount, usage limit, expiry). The value field
 * is hidden for free-shipping codes; the max-discount cap applies to percent
 * codes only. New coupons default to active; the list's inline toggle manages
 * active state afterward. The parent refreshes via revalidatePath.
 */
export function CouponModal({ coupon, onClose }: Props) {
  const editing = coupon != null;
  const [code, setCode] = useState(coupon?.code ?? "");
  const [kind, setKind] = useState<CouponKind>(coupon?.kind ?? "percent");
  const [value, setValue] = useState(coupon ? valueStringFor(coupon) : "");
  const [minOrder, setMinOrder] = useState(
    coupon ? paiseToRupeeString(coupon.minSubtotalPaise) : "",
  );
  const [maxDiscount, setMaxDiscount] = useState(
    coupon ? paiseToRupeeString(coupon.maxDiscountPaise) : "",
  );
  const [usageLimit, setUsageLimit] = useState(
    coupon?.usageLimit != null ? String(coupon.usageLimit) : "",
  );
  // Stored as `${date}T18:29:59Z`, so the leading 10 chars are the chosen date.
  const [expiresAt, setExpiresAt] = useState(coupon?.expiresAt?.slice(0, 10) ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useDialog<HTMLDivElement>({
    isOpen: true,
    onDismiss: onClose,
    isPending,
  });

  const showValue = kind !== "free_shipping";
  const isPercent = kind === "percent";
  const valuePlaceholder = kind === "fixed" ? "200" : "25";

  const onSave = () => {
    // Reject an out-of-range percentage here so the admin isn't silently
    // clamped server-side (TASKS 3.6b).
    if (isPercent && Number(value.trim()) > 100) {
      setError("A percentage discount can't exceed 100%.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await upsertCoupon({
        id: coupon?.id ?? null,
        code,
        kind,
        value,
        minOrder,
        maxDiscount,
        usageLimit,
        expiresAt,
        // Editing preserves the current active state (toggled from the list);
        // a brand-new coupon starts active.
        isActive: coupon?.isActive ?? true,
      });
      if (res.ok) onClose();
      else setError(res.error ?? "Couldn't save the coupon.");
    });
  };

  // Two-step delete so a destructive action can't fire on a single misclick
  // (mirrors CategoryModal). Only available when editing an existing coupon.
  const onDelete = () => {
    if (!coupon) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteCoupon(coupon.id);
      if (res.ok) onClose();
      else {
        setConfirmDelete(false);
        setError(res.error ?? "Couldn't delete the coupon.");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(42,10,18,0.45)] p-6"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit coupon" : "Create coupon"}
        tabIndex={-1}
        className="w-[460px] max-w-full overflow-hidden rounded-[14px] bg-[#F8F5EF] shadow-[0_30px_70px_rgba(42,10,18,0.3)] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E7E0D4] bg-white px-[26px] py-[22px]">
          <h2 className="font-heading text-[22px] leading-none text-[#2A1F1A]">
            {editing ? "Edit Coupon" : "Create Coupon"}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-[22px] leading-none text-[#8A7E74] hover:text-[#2A1F1A]"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-3.5 px-[26px] py-6">
          <label className="font-body text-[12px] font-medium text-[#8A7E74]">
            Coupon code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. DIWALI25"
              autoFocus
              className="mt-1.5 block w-full rounded-lg border border-[#E7E0D4] bg-white px-3 py-[11px] font-body text-[14px] font-semibold uppercase tracking-[0.06em] text-[#2A1F1A] outline-none focus:border-gold-400"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex-1 font-body text-[12px] font-medium text-[#8A7E74]">
              Type
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as CouponKind)}
                className="mt-1.5 block w-full rounded-lg border border-[#E7E0D4] bg-white px-3 py-[11px] font-body text-[14px] text-[#2A1F1A] outline-none focus:border-gold-400"
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1 font-body text-[12px] font-medium text-[#8A7E74]">
              Value
              <input
                value={showValue ? value : ""}
                onChange={(e) => setValue(e.target.value)}
                disabled={!showValue}
                inputMode="numeric"
                placeholder={showValue ? valuePlaceholder : "—"}
                className="mt-1.5 block w-full rounded-lg border border-[#E7E0D4] bg-white px-3 py-[11px] font-body text-[14px] text-[#2A1F1A] outline-none focus:border-gold-400 disabled:bg-[#F3EEE4] disabled:text-[#B9AEA2]"
              />
            </label>
          </div>

          <div className="flex gap-3">
            <label className="flex-1 font-body text-[12px] font-medium text-[#8A7E74]">
              Min order (₹)
              <input
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                inputMode="numeric"
                placeholder="999"
                className="mt-1.5 block w-full rounded-lg border border-[#E7E0D4] bg-white px-3 py-[11px] font-body text-[14px] text-[#2A1F1A] outline-none focus:border-gold-400"
              />
            </label>
            <label className="flex-1 font-body text-[12px] font-medium text-[#8A7E74]">
              Max discount (₹)
              <input
                value={isPercent ? maxDiscount : ""}
                onChange={(e) => setMaxDiscount(e.target.value)}
                disabled={!isPercent}
                inputMode="numeric"
                placeholder={isPercent ? "No cap" : "—"}
                className="mt-1.5 block w-full rounded-lg border border-[#E7E0D4] bg-white px-3 py-[11px] font-body text-[14px] text-[#2A1F1A] outline-none focus:border-gold-400 disabled:bg-[#F3EEE4] disabled:text-[#B9AEA2]"
              />
            </label>
          </div>

          <div className="flex gap-3">
            <label className="flex-1 font-body text-[12px] font-medium text-[#8A7E74]">
              Usage limit
              <input
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                inputMode="numeric"
                placeholder="Unlimited"
                className="mt-1.5 block w-full rounded-lg border border-[#E7E0D4] bg-white px-3 py-[11px] font-body text-[14px] text-[#2A1F1A] outline-none focus:border-gold-400"
              />
            </label>
            <label className="flex-1 font-body text-[12px] font-medium text-[#8A7E74]">
              Expires
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-[#E7E0D4] bg-white px-3 py-[11px] font-body text-[14px] text-[#2A1F1A] outline-none focus:border-gold-400"
              />
            </label>
          </div>

          {error && (
            <p className="rounded-lg border border-[#F0C8CE] bg-[#FBE9E7] px-3 py-2.5 font-body text-[12.5px] leading-snug text-[#C0392F]">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2.5 border-t border-[#E7E0D4] bg-white px-[26px] py-[18px]">
          {editing && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className="mr-auto rounded-lg border border-[#E0B7B2] bg-white px-[18px] py-[11px] font-body text-[12px] font-semibold text-[#C0392F] transition-colors hover:bg-[#FBE9E7] disabled:opacity-60"
            >
              {confirmDelete ? "Confirm delete?" : "Delete"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="ml-auto rounded-lg border border-[#DAD0C2] bg-white px-5 py-[11px] font-body text-[12px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isPending}
            className="rounded-lg bg-maroon-700 px-6 py-[11px] font-body text-[12px] font-semibold text-cream-200 transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Saving…" : editing ? "Save Changes" : "Create Coupon"}
          </button>
        </div>
      </div>
    </div>
  );
}
