"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cartSubtotalPaise } from "@/lib/cart";
import type { PlacedOrder } from "@/lib/checkout/order";
import { validateCoupon } from "@/lib/coupons";
import { ROUTES } from "@/lib/routes";
import { shippingPaise } from "@/lib/shipping";
import { useCartHydrated, useCartStore } from "@/stores/cart";
import { CheckoutForm } from "./CheckoutForm";

type Props = {
  freeShipThresholdPaise: number;
};

/**
 * Client container for the checkout page. Owns the cart-store subscription and
 * derives the same display totals as the cart summary (subtotal − live coupon
 * discount + shipping), then hands them to the form. Renders a neutral gate
 * until the persisted cart rehydrates, and a "cart empty" prompt when there's
 * nothing to check out. All totals are display-only — the server recomputes them
 * authoritatively at order creation (TASKS 2.5).
 */
export function CheckoutView({ freeShipThresholdPaise }: Props) {
  const router = useRouter();
  const hasHydrated = useCartHydrated();
  const lines = useCartStore((state) => state.lines);
  const couponCode = useCartStore((state) => state.couponCode);
  const clearCart = useCartStore((state) => state.clearCart);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // On a successful order, clear the cart and hand off to the confirmation page
  // (keyed on the unguessable order id). `isRedirecting` is checked ABOVE the
  // empty-cart guard so clearing the cart doesn't flash the empty prompt.
  const handlePlaced = (order: PlacedOrder) => {
    setIsRedirecting(true);
    clearCart();
    router.push(ROUTES.order(order.orderId));
  };

  if (!hasHydrated) {
    return (
      <div
        aria-busy="true"
        className="min-h-[40vh] text-[14px] leading-none text-[#9C8A84]"
      >
        Loading checkout…
      </div>
    );
  }

  if (isRedirecting) {
    return (
      <div
        aria-busy="true"
        className="min-h-[40vh] text-[14px] leading-none text-[#9C8A84]"
      >
        Taking you to your order confirmation…
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded border border-dashed border-[#E0CFB4] bg-[#FFFDF8] px-5 py-[90px] text-center">
        <p className="m-0 font-heading text-[28px] font-semibold leading-none text-maroon-900">
          Your cart is empty
        </p>
        <p className="m-0 text-[14px] leading-[1.5] text-[#7A655F]">
          Add something you love before checking out.
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

  const subtotalPaise = cartSubtotalPaise(lines);
  const couponResult = couponCode
    ? validateCoupon(couponCode, subtotalPaise)
    : null;
  const discountPaise = couponResult?.ok ? couponResult.discountPaise : 0;
  const shipPaise = shippingPaise(subtotalPaise, freeShipThresholdPaise);
  const totalPaise = subtotalPaise - discountPaise + shipPaise;

  return (
    <CheckoutForm
      lines={lines}
      couponCode={couponCode}
      subtotalPaise={subtotalPaise}
      discountPaise={discountPaise}
      shippingPaise={shipPaise}
      totalPaise={totalPaise}
      onPlaced={handlePlaced}
    />
  );
}
