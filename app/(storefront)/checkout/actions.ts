"use server";

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
import { createServerClient } from "@/lib/db/server";

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
});

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
  const supabase = createServerClient();
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
    return {
      ok: false,
      fieldErrors: {},
      formError:
        "We couldn't place your order just now. Please try again in a moment.",
    };
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

  return { ok: true, order };
}
