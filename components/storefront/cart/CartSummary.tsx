import Link from "next/link";
import { amountToFreeShipPaise, qualifiesForFreeShipping } from "@/lib/shipping";
import { formatPaise } from "@/lib/utils/money";

type Props = {
  subtotalPaise: number;
  savingsPaise: number;
  shippingPaise: number;
  totalPaise: number;
  freeShipThresholdPaise: number;
  checkoutHref: string;
};

/**
 * Cart order-summary panel, matched to the prototype: a free-shipping progress
 * hint, the subtotal / shipping / total breakdown, and the checkout CTA. Coupon
 * input and the discount line land in 2.3; COD is the only v1 tender.
 */
export function CartSummary({
  subtotalPaise,
  savingsPaise,
  shippingPaise,
  totalPaise,
  freeShipThresholdPaise,
  checkoutHref,
}: Props) {
  const toFreePaise = amountToFreeShipPaise(subtotalPaise, freeShipThresholdPaise);
  const qualifies = qualifiesForFreeShipping(subtotalPaise, freeShipThresholdPaise);
  const progress = Math.min(
    100,
    Math.round((subtotalPaise / freeShipThresholdPaise) * 100),
  );

  return (
    <aside
      aria-label="Order summary"
      className="flex w-full flex-col gap-4 rounded border border-[#E7D9C2] bg-[#FFFDF8] p-7 md:w-[360px] md:flex-none"
    >
      <h2 className="text-[14px] font-semibold uppercase leading-none tracking-[0.14em] text-maroon-900">
        Order Summary
      </h2>

      {qualifies ? (
        <p className="m-0 text-[12.5px] font-medium leading-snug text-[#1E7A38]">
          ✓ You&apos;ve unlocked free shipping.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-[12.5px] leading-snug text-[#5E4A44]">
            Add{" "}
            <span className="font-semibold text-maroon-700">
              {formatPaise(toFreePaise)}
            </span>{" "}
            more for free shipping.
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EFE3D0]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#E6CA7E,#C9A24B)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="h-px bg-[#EFE3D0]" />

      <SummaryRow label="Subtotal" value={formatPaise(subtotalPaise)} />
      {savingsPaise > 0 && (
        <SummaryRow
          label="You save"
          value={`− ${formatPaise(savingsPaise)}`}
          tone="save"
        />
      )}
      <SummaryRow
        label="Shipping"
        value={shippingPaise === 0 ? "FREE" : formatPaise(shippingPaise)}
      />

      <div className="h-px bg-[#EFE3D0]" />

      <div className="flex items-baseline justify-between">
        <span className="text-[16px] font-semibold leading-none text-maroon-900">
          Total
        </span>
        <span className="text-[24px] font-semibold leading-none text-maroon-700">
          {formatPaise(totalPaise)}
        </span>
      </div>

      <Link
        href={checkoutHref}
        className="rounded-sm bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] px-4 py-4 text-center text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-[#3A0E18] shadow-[0_10px_24px_rgba(168,122,30,0.28)] transition-[filter] hover:brightness-105"
      >
        Proceed to Checkout
      </Link>
      <p className="m-0 text-center text-[11.5px] leading-snug text-[#9C8A84]">
        Cash on Delivery available across India · secure checkout
      </p>
    </aside>
  );
}

function SummaryRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "save";
}) {
  const valueColor = tone === "save" ? "text-[#1E7A38]" : "text-[#2A1115]";
  return (
    <div className="flex items-center justify-between text-[14px] leading-none">
      <span className="text-[#5E4A44]">{label}</span>
      <span className={valueColor}>{value}</span>
    </div>
  );
}
