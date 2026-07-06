"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelMyOrder } from "@/app/(storefront)/account/orders/actions";

type Props = {
  orderNo: string;
};

/**
 * Cancel-while-Pending control on the order detail page (TASKS 4.14). Two-step
 * (button → inline confirm row) instead of a native `confirm()`, matching the
 * project's design-quality bar for deliberate interaction states.
 */
export function CancelOrderButton({ orderNo }: Props) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await cancelMyOrder(orderNo);
      if (!result.ok) {
        setError(result.error);
        setIsConfirming(false);
        return;
      }
      router.refresh();
    });
  }

  if (!isConfirming) {
    return (
      <div className="flex flex-col gap-2">
        {error && <p className="m-0 text-[12.5px] text-[#B23A48]">{error}</p>}
        <button
          type="button"
          onClick={() => setIsConfirming(true)}
          className="self-start rounded-sm border border-[#E0B7B2] bg-white px-5 py-2.5 text-[12px] font-semibold uppercase leading-none tracking-[0.08em] text-[#B23A48] transition-colors hover:bg-[#FBEAEC]"
        >
          Cancel Order
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded border border-[#E0B7B2] bg-[#FBEAEC] px-5 py-4">
      <p className="m-0 text-[13px] leading-snug text-[#8A2E3A]">
        Cancel this order? This can't be undone.
      </p>
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending}
          className="rounded-sm bg-[#B23A48] px-5 py-2.5 text-[12px] font-semibold uppercase leading-none tracking-[0.08em] text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? "Cancelling…" : "Yes, cancel"}
        </button>
        <button
          type="button"
          onClick={() => setIsConfirming(false)}
          disabled={isPending}
          className="rounded-sm border border-[#E0B7B2] bg-white px-5 py-2.5 text-[12px] font-semibold uppercase leading-none tracking-[0.08em] text-[#5E4A44] transition-colors hover:bg-cream-50"
        >
          No, keep it
        </button>
      </div>
    </div>
  );
}
