import Image from "next/image";
import type { CartLine } from "@/lib/cart";
import { PLACEHOLDER_GRADIENT } from "@/lib/theme";
import { formatPaise } from "@/lib/utils/money";

type Props = {
  lines: readonly CartLine[];
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  isSubmitting: boolean;
};

/**
 * Checkout order summary, matched to the prototype's right column: a scrollable
 * line-item list, the subtotal / discount / shipping / total breakdown, and the
 * gold "Place Order" submit button. Presentational — it renders a `type="submit"`
 * button, so it must live inside the checkout `<form>`. Totals are display-only
 * snapshots; the server recomputes them authoritatively at order creation (2.5).
 */
export function CheckoutSummary({
  lines,
  subtotalPaise,
  discountPaise,
  shippingPaise,
  totalPaise,
  isSubmitting,
}: Props) {
  return (
    <aside
      aria-label="Order summary"
      className="flex w-full flex-col gap-3.5 rounded border border-[#E7D9C2] bg-[#FFFDF8] p-7 md:w-[360px] md:flex-none"
    >
      <h2 className="text-[14px] font-semibold uppercase leading-none tracking-[0.14em] text-maroon-900">
        Order Summary
      </h2>

      <ul className="m-0 flex max-h-[240px] list-none flex-col gap-3 overflow-auto p-0">
        {lines.map((line) => (
          <SummaryLine key={line.id} line={line} />
        ))}
      </ul>

      <div className="h-px bg-[#EFE3D0]" />

      <Row label="Subtotal" value={formatPaise(subtotalPaise)} />
      {discountPaise > 0 && (
        <Row
          label="Discount"
          value={`− ${formatPaise(discountPaise)}`}
          tone="save"
        />
      )}
      <Row
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

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-sm bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] px-4 py-4 text-center text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-[#3A0E18] shadow-[0_10px_24px_rgba(168,122,30,0.28)] transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Placing order…" : "Place Order"}
      </button>
      <p className="m-0 text-center text-[11.5px] leading-snug text-[#9C8A84]">
        Cash on Delivery across India · your details are verified securely
        server-side.
      </p>
    </aside>
  );
}

function SummaryLine({ line }: { line: CartLine }) {
  const background = line.imageBg ?? PLACEHOLDER_GRADIENT;
  const lineTotalPaise = line.pricePaise * line.quantity;

  return (
    <li className="flex items-center gap-3">
      <div className="relative h-12 w-12 flex-none">
        <div
          className="relative h-full w-full overflow-hidden rounded-[2px] border border-[#EFE3D0]"
          style={{ background }}
        >
          {line.imageUrl && (
            <Image
              src={line.imageUrl}
              alt={line.name}
              fill
              sizes="48px"
              className="object-cover"
            />
          )}
        </div>
        <span className="absolute -right-1.5 -top-1.5 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-maroon-700 px-1 text-[10px] font-semibold leading-none text-[#F3E3C7]">
          {line.quantity}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-[3px]">
        <span className="text-[13px] font-medium leading-[1.3] text-maroon-900">
          {line.name}
        </span>
        {line.optionValue && (
          <span className="text-[11px] leading-none text-[#9C8A84]">
            {line.optionValue}
          </span>
        )}
      </div>
      <span className="text-[13px] font-medium leading-none text-maroon-900">
        {formatPaise(lineTotalPaise)}
      </span>
    </li>
  );
}

function Row({
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
