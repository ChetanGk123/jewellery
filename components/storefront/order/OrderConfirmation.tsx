import Link from "next/link";
import type { OrderConfirmation as OrderConfirmationData } from "@/lib/checkout/order";
import { ROUTES } from "@/lib/routes";
import { formatPaise } from "@/lib/utils/money";

type Props = {
  confirmation: OrderConfirmationData;
  /**
   * True when the coupon entered at checkout was no longer valid at placement,
   * so it wasn't applied. Shows a gentle notice; the total below is correct
   * (the server recomputed it without the discount). TASKS 3.6b.
   */
  couponDropped?: boolean;
};

/** Static COD delivery estimate shown on the confirmation (matches the prototype). */
const ESTIMATED_DELIVERY = "4–7 days";

/**
 * Order confirmation view (TASKS 2.6), mirrored from the storefront prototype's
 * `isConfirm` screen: a centered thank-you with the gold check, the order
 * reference, and a compact summary card. Presentational — the page fetches the
 * order by its unguessable id and passes the non-sensitive confirmation in.
 */
export function OrderConfirmation({ confirmation, couponDropped }: Props) {
  return (
    <main className="mx-auto flex max-w-[680px] flex-col items-center gap-[18px] px-6 pb-[90px] pt-[70px] text-center">
      <span
        aria-hidden="true"
        className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] text-[42px] leading-none text-[#3A0E18] shadow-[0_14px_30px_rgba(168,122,30,0.3)]"
      >
        ✓
      </span>

      <h1 className="m-0 font-heading text-[42px] font-semibold leading-[1.1] text-maroon-900">
        Thank you for your order!
      </h1>

      <p className="m-0 max-w-[460px] text-[16px] font-light leading-[1.6] text-[#5E4A44]">
        Your order{" "}
        <span className="font-semibold text-maroon-700">
          {confirmation.orderNo}
        </span>{" "}
        is confirmed. Keep this order number handy — we'll use{" "}
        <span className="text-maroon-900">{confirmation.customerEmail}</span>{" "}
        to reach you about it.
      </p>

      {couponDropped && (
        <p className="m-0 max-w-[460px] rounded border border-[#E7C98A] bg-[#FBF3DE] px-4 py-3 text-[13px] leading-snug text-[#8A6D1E]">
          The coupon you entered was no longer valid, so it wasn't applied. Your
          order total below reflects the final amount.
        </p>
      )}

      <dl className="mt-2 flex min-w-[300px] flex-col gap-2.5 rounded border border-[#E7D9C2] bg-[#FFFDF8] px-8 py-6 text-left">
        <Row label="Order number" value={confirmation.orderNo} />
        <Row
          label="Amount payable"
          value={formatPaise(confirmation.totalPaise)}
          emphasis
        />
        <Row label="Estimated delivery" value={ESTIMATED_DELIVERY} />
      </dl>

      <p className="m-0 text-[12.5px] leading-snug text-[#9C8A84]">
        Cash on Delivery — please keep the amount ready when your order arrives.
      </p>

      <Link
        href={ROUTES.shop}
        className="mt-2.5 rounded-sm bg-maroon-700 px-[34px] py-[15px] text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-[#F3E3C7] transition-colors hover:bg-maroon-900"
      >
        Continue Shopping
      </Link>
    </main>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-[30px]">
      <dt className="text-[13px] font-normal leading-none text-[#9C8A84]">
        {label}
      </dt>
      <dd
        className={`m-0 text-[13px] font-semibold leading-none ${
          emphasis ? "text-maroon-700" : "text-maroon-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
