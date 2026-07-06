"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import {
  type CheckoutFormValues,
  checkoutSchema,
} from "@/lib/checkout/schema";
import {
  orderItemsSchema,
  type PlacedOrder,
  toPlacedOrder,
} from "@/lib/checkout/order";
import { CACHE_TAGS } from "@/lib/db/cache";
import { upsertCustomerProfile } from "@/lib/db/profile";
import { createServerClient, getCurrentUser } from "@/lib/db/server";
import { checkRateLimit } from "@/lib/rate-limit";

export type CheckoutActionResult =
  | { ok: true; order: PlacedOrder }
  | {
      ok: false;
      /** Per-field messages keyed by form field, for inline display. */
      fieldErrors: Partial<Record<keyof CheckoutFormValues, string>>;
      /** A top-level message when the failure isn't field-specific. */
      formError?: string;
    };

/** Full submit payload: the form fields, the cart items, and any coupon code. */
const submitInputSchema = z.object({
  values: z.unknown(),
  items: orderItemsSchema,
  couponCode: z.string().nullable().optional(),
  /**
   * Honeypot: a decoy field hidden from humans (see `Honeypot`). Real users
   * leave it empty; naive bots autofill it. Any non-empty value is treated as
   * abuse and the order is silently dropped. Never trusted for real data.
   */
  honeypot: z.string().optional(),
});

/** Generic failure message shown when we decline to place an order. */
const DECLINE_MESSAGE =
  "We couldn't place your order just now. Please try again in a moment.";
const RATE_LIMITED_MESSAGE =
  "Too many order attempts — please wait a few minutes and try again.";

/** Checkout throttle: at most 5 order attempts per account per 10 minutes. */
const RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 } as const;

/**
 * Authoritative checkout gate (TASKS 2.5). Re-validates the SAME form schema
 * server-side, then hands the price-free item list + contact to the
 * `place_order` SECURITY DEFINER RPC, which recomputes every total from the DB
 * and writes `order` + `order_item` atomically. Client prices/totals are never
 * trusted — this action never sends a price, and the RPC is the only write path.
 */
export async function submitCheckout(
  input: unknown,
): Promise<CheckoutActionResult> {
  const wrapper = submitInputSchema.safeParse(input);
  if (!wrapper.success) {
    return {
      ok: false,
      fieldErrors: {},
      formError:
        "Your cart looks out of date. Please refresh the page and try again.",
    };
  }

  // Bot check: a filled honeypot means it wasn't a human. Decline generically
  // so we don't hint at the trap, and never reach the DB.
  if (wrapper.data.honeypot && wrapper.data.honeypot.trim().length > 0) {
    return { ok: false, fieldErrors: {}, formError: DECLINE_MESSAGE };
  }

  // Checkout is sign-in only. The `place_order` RPC enforces this too (raises
  // for anonymous callers); checking here returns a friendly message instead
  // of a generic failure when a session expires mid-checkout.
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      fieldErrors: {},
      formError: "Your session has expired. Please sign in and try again.",
    };
  }

  if (!checkRateLimit(`checkout:${user.id}`, RATE_LIMIT).ok) {
    return { ok: false, fieldErrors: {}, formError: RATE_LIMITED_MESSAGE };
  }

  const parsed = checkoutSchema.safeParse(wrapper.data.values);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const fieldErrors: Partial<Record<keyof CheckoutFormValues, string>> = {};
    for (const [key, messages] of Object.entries(flat)) {
      const first = messages?.[0];
      if (first) fieldErrors[key as keyof CheckoutFormValues] = first;
    }
    return {
      ok: false,
      fieldErrors,
      formError: "Please correct the highlighted fields and try again.",
    };
  }

  const contact = parsed.data;
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_items: wrapper.data.items.map((item) => ({
      product_id: item.productId,
      tone: item.tone,
      qty: item.qty,
    })),
    p_customer: {
      full_name: contact.fullName,
      phone: contact.phone,
      email: contact.email,
      address_line: contact.addressLine,
      city: contact.city,
      state: contact.state,
      pincode: contact.pincode,
      payment_method: contact.paymentMethod,
    },
    p_coupon: wrapper.data.couponCode ?? undefined,
  });

  if (error) {
    console.error("place_order failed", error);
    return { ok: false, fieldErrors: {}, formError: DECLINE_MESSAGE };
  }

  const order = toPlacedOrder(data);
  if (!order) {
    console.error("place_order returned an unexpected shape", data);
    return {
      ok: false,
      fieldErrors: {},
      formError:
        "Your order may not have gone through. Please contact us before retrying.",
    };
  }

  // "Saved details" loop: remember this checkout's contact + address as the
  // customer's profile so the next checkout prefills. Best-effort — a profile
  // hiccup must never fail an already-placed order.
  await upsertCustomerProfile(user.id, {
    fullName: contact.fullName,
    phone: contact.phone,
    addressLine: contact.addressLine,
    city: contact.city,
    state: contact.state,
    pincode: contact.pincode,
  });

  // The order decremented stock — expire cached catalog reads so sold-out
  // states show without waiting out the revalidate window.
  updateTag(CACHE_TAGS.products);

  return { ok: true, order };
}
