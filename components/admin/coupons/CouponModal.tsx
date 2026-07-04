"use client";

import { useState, useTransition } from "react";
import { upsertCoupon } from "@/app/(admin)/admin/(console)/coupons/actions";
import type { CouponKind } from "@/lib/coupons";

type Props = {
  onClose: () => void;
};

const KIND_OPTIONS: { value: CouponKind; label: string }[] = [
  { value: "percent", label: "Percent off" },
  { value: "fixed", label: "Fixed amount" },
  { value: "free_shipping", label: "Free shipping" },
];

/**
 * Create Coupon modal (TASKS 3.6, prototype-matched — 460px card: code, type +
 * value, min order + expiry). The value field is hidden for free-shipping codes
 * (no amount to enter). New coupons default to active; the list's inline toggle
 * manages active state afterward. Matches the prototype, which offers create +
 * toggle only (no edit/delete). The parent refreshes via revalidatePath.
 */
export function CouponModal({ onClose }: Props) {
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<CouponKind>("percent");
  const [value, setValue] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const showValue = kind !== "free_shipping";
  const valuePlaceholder = kind === "fixed" ? "200" : "25";

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const res = await upsertCoupon({
        id: null,
        code,
        kind,
        value,
        minOrder,
        expiresAt,
        isActive: true,
      });
      if (res.ok) onClose();
      else setError(res.error ?? "Couldn't save the coupon.");
    });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(42,10,18,0.45)] p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create coupon"
        className="w-[460px] max-w-full overflow-hidden rounded-[14px] bg-[#F8F5EF] shadow-[0_30px_70px_rgba(42,10,18,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E7E0D4] bg-white px-[26px] py-[22px]">
          <h2 className="font-heading text-[22px] leading-none text-[#2A1F1A]">
            Create Coupon
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
        <div className="flex items-center justify-end gap-2.5 border-t border-[#E7E0D4] bg-white px-[26px] py-[18px]">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-[#DAD0C2] bg-white px-5 py-[11px] font-body text-[12px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isPending}
            className="rounded-lg bg-maroon-700 px-6 py-[11px] font-body text-[12px] font-semibold text-cream-200 transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Create Coupon"}
          </button>
        </div>
      </div>
    </div>
  );
}
