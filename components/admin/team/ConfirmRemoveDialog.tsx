"use client";

import { useEffect, useRef } from "react";

type Props = {
  email: string;
  isPending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * Confirmation dialog before revoking an admin (the destructive step on the Team
 * page). Mirrors `CouponModal`'s overlay + card shell; focuses Cancel on open and
 * closes on Escape. The RPC still blocks self-revoke / last-admin regardless.
 */
export function ConfirmRemoveDialog({
  email,
  isPending,
  error,
  onConfirm,
  onClose,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPending, onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(42,10,18,0.45)] p-6"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Remove admin access"
        className="w-[420px] max-w-full overflow-hidden rounded-[14px] bg-[#F8F5EF] shadow-[0_30px_70px_rgba(42,10,18,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-2.5 px-[26px] py-6">
          <h2 className="font-heading text-[22px] leading-tight text-[#2A1F1A]">
            Remove admin access?
          </h2>
          <p className="font-body text-[13.5px] leading-relaxed text-[#5E4A40]">
            <span className="font-semibold text-maroon-700">{email}</span> will
            lose access to the admin console on their next sign-in. You can grant
            it again any time.
          </p>

          {error && (
            <p className="mt-1 rounded-lg border border-[#F0C8CE] bg-[#FBE9E7] px-3 py-2.5 font-body text-[12.5px] leading-snug text-[#C0392F]">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[#E7E0D4] bg-white px-[26px] py-[18px]">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-[#DAD0C2] bg-white px-5 py-[11px] font-body text-[12px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-lg bg-[#C0392F] px-6 py-[11px] font-body text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Removing…" : "Remove access"}
          </button>
        </div>
      </div>
    </div>
  );
}
