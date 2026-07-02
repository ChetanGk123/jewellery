import Link from "next/link";
import type { PlacedOrder } from "@/lib/checkout/order";
import { ROUTES } from "@/lib/routes";
import { formatPaise } from "@/lib/utils/money";

type Props = {
  order: PlacedOrder;
};

/**
 * Interim order-placed confirmation shown in-place after `place_order` succeeds
 * (TASKS 2.5). It reflects the server-recomputed totals and the real order
 * number so the customer has a reference immediately. The dedicated
 * `/order/[orderNo]` confirmation/tracking page is TASKS 2.6.
 */
export function OrderPlaced({ order }: Props) {
  return (
    <section
      aria-labelledby="order-placed-heading"
      className="mx-auto flex max-w-[560px] flex-col items-center gap-5 rounded border border-[#E7D9C2] bg-[#FFFDF8] px-6 py-[70px] text-center"
    >
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] text-[26px] leading-none text-[#3A0E18] shadow-[0_10px_24px_rgba(168,122,30,0.28)]"
      >
        ✓
      </span>

      <div className="flex flex-col gap-2">
        <h2
          id="order-placed-heading"
          className="m-0 font-heading text-[32px] font-semibold leading-none text-maroon-900"
        >
          Order placed
        </h2>
        <p className="m-0 text-[14px] leading-[1.5] text-[#7A655F]">
          Thank you — your Cash-on-Delivery order is confirmed. We&apos;ll call
          to verify and share dispatch updates shortly.
        </p>
      </div>

      <dl className="flex w-full max-w-[320px] flex-col gap-2.5 rounded-sm border border-[#EFE3D0] bg-[#FBF7F0] px-5 py-4 text-left">
        <div className="flex items-center justify-between">
          <dt className="text-[12px] uppercase leading-none tracking-[0.12em] text-[#9C8A84]">
            Order no.
          </dt>
          <dd className="m-0 text-[15px] font-semibold leading-none text-maroon-900">
            {order.orderNo}
          </dd>
        </div>
        <div className="h-px bg-[#EFE3D0]" />
        <div className="flex items-baseline justify-between">
          <dt className="text-[12px] uppercase leading-none tracking-[0.12em] text-[#9C8A84]">
            Amount due
          </dt>
          <dd className="m-0 text-[20px] font-semibold leading-none text-maroon-700">
            {formatPaise(order.totalPaise)}
          </dd>
        </div>
      </dl>

      <Link
        href={ROUTES.shop}
        className="mt-1 rounded-sm bg-maroon-700 px-[30px] py-3.5 text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-cream-200 transition-colors hover:bg-maroon-900"
      >
        Continue shopping
      </Link>
    </section>
  );
}
