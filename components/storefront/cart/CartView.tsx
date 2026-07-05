"use client";

import Link from "next/link";
import { cartSavingsPaise, cartSubtotalPaise } from "@/lib/cart";
import { type Coupon, validateCoupon } from "@/lib/coupons";
import { shippingPaise } from "@/lib/shipping";
import { ROUTES } from "@/lib/routes";
import { cartEnquiryUrl } from "@/lib/whatsapp";
import { useCartHydrated, useCartStore } from "@/stores/cart";
import { CartLineRow } from "./CartLineRow";
import { CartSummary } from "./CartSummary";
import { CouponField } from "./CouponField";

type Props = {
  freeShipThresholdPaise: number;
  /** Store's flat delivery fee (Settings 3.11), used below the free-ship threshold. */
  flatRatePaise: number;
  /** Currently-usable coupons, loaded server-side (display-only preview). */
  coupons: Coupon[];
};

/**
 * Client container for the cart page. Owns the store subscription and renders
 * one of three states: a neutral placeholder until the persisted cart rehydrates
 * (so the server-rendered empty cart never mismatches), the empty-cart prompt,
 * or the line list + order summary. All totals derive from the pure selectors in
 * `lib/cart` / `lib/shipping` at render time.
 */
export function CartView({ freeShipThresholdPaise, flatRatePaise, coupons }: Props) {
  const hasHydrated = useCartHydrated();
  const lines = useCartStore((state) => state.lines);
  const couponCode = useCartStore((state) => state.couponCode);
  const setItemQuantity = useCartStore((state) => state.setItemQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  if (!hasHydrated) {
    return (
      <div
        aria-busy="true"
        className="min-h-[40vh] text-[14px] leading-none text-[#9C8A84]"
      >
        Loading your cart…
      </div>
    );
  }

  if (lines.length === 0) {
    return <EmptyCart />;
  }

  const subtotalPaise = cartSubtotalPaise(lines);
  const savingsPaise = cartSavingsPaise(lines);
  const couponResult = couponCode
    ? validateCoupon(couponCode, subtotalPaise, coupons)
    : null;
  const discountPaise = couponResult?.ok ? couponResult.discountPaise : 0;
  const freeShipping = couponResult?.ok ? couponResult.freeShipping : false;
  const shipPaise = freeShipping
    ? 0
    : shippingPaise(subtotalPaise, freeShipThresholdPaise, flatRatePaise);
  const totalPaise = subtotalPaise - discountPaise + shipPaise;

  return (
    <div className="flex flex-wrap items-start gap-10">
      <div className="flex min-w-full flex-col md:min-w-[300px] md:flex-1">
        <ul className="m-0 flex list-none flex-col p-0">
          {lines.map((line) => (
            <CartLineRow
              key={line.id}
              line={line}
              onDecrement={(l) => setItemQuantity(l.id, l.quantity - 1)}
              onIncrement={(l) => setItemQuantity(l.id, l.quantity + 1)}
              onRemove={(l) => removeItem(l.id)}
            />
          ))}
        </ul>
        <Link
          href={ROUTES.shop}
          className="mt-[22px] self-start text-[13px] font-medium leading-none tracking-[0.06em] text-maroon-700 hover:underline"
        >
          ← Continue shopping
        </Link>
      </div>

      <CartSummary
        subtotalPaise={subtotalPaise}
        savingsPaise={savingsPaise}
        discountPaise={discountPaise}
        shippingPaise={shipPaise}
        totalPaise={totalPaise}
        freeShipThresholdPaise={freeShipThresholdPaise}
        checkoutHref={ROUTES.checkout}
        whatsappHref={cartEnquiryUrl(lines)}
        couponSlot={
          <CouponField subtotalPaise={subtotalPaise} coupons={coupons} />
        }
      />
    </div>
  );
}

/** Empty-cart prompt, matched to the prototype's dashed panel. */
function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-4 rounded border border-dashed border-[#E0CFB4] bg-[#FFFDF8] px-5 py-[90px] text-center">
      <span className="text-[40px] leading-none text-gold-400" aria-hidden>
        ⚲
      </span>
      <p className="m-0 font-heading text-[28px] font-semibold leading-none text-maroon-900">
        Your cart is empty
      </p>
      <p className="m-0 text-[14px] leading-[1.5] text-[#7A655F]">
        Discover handcrafted bridal jewellery made to shine.
      </p>
      <Link
        href={ROUTES.shop}
        className="mt-1.5 rounded-sm bg-maroon-700 px-[30px] py-3.5 text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-cream-200 transition-colors hover:bg-maroon-900"
      >
        Start shopping
      </Link>
    </div>
  );
}
