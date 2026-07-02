/**
 * WhatsApp enquiry links (TASKS 2.7). Pure builders for prefilled `wa.me` URLs
 * from product or cart context — no React/DOM deps, so they're unit testable and
 * usable from any component. The number is the single `STORE_INFO.whatsapp`
 * handle; the store name in the copy is `STORE_INFO.name`, so both track the one
 * source of truth (mirrors the prototype's `wa.me/<no>?text=...` enquiry).
 */

import type { CartLine } from "@/lib/cart";
import { cartSubtotalPaise } from "@/lib/cart";
import { STORE_INFO } from "@/lib/store-info";
import { formatPaise } from "@/lib/utils/money";

const WA_BASE = "https://wa.me";

/** A `wa.me` link to the store, with `message` prefilled into the chat box. */
export function whatsappUrl(message: string): string {
  return `${WA_BASE}/${STORE_INFO.whatsapp.number}?text=${encodeURIComponent(message)}`;
}

/** Enquiry text for a single product, optionally naming the chosen plating tone. */
export function productEnquiryMessage(
  name: string,
  tone?: string | null,
): string {
  const tonePart = tone ? ` (${tone} plating)` : "";
  return `Hi ${STORE_INFO.name}, I'm interested in the ${name}${tonePart}.`;
}

/** Prefilled `wa.me` link enquiring about one product. */
export function productEnquiryUrl(name: string, tone?: string | null): string {
  return whatsappUrl(productEnquiryMessage(name, tone));
}

/** Enquiry text listing the cart's lines (qty, name, tone, unit price) + subtotal. */
export function cartEnquiryMessage(lines: readonly CartLine[]): string {
  const items = lines
    .map((line) => {
      const tone = line.optionValue ? ` (${line.optionValue})` : "";
      return `• ${line.quantity}× ${line.name}${tone} — ${formatPaise(line.pricePaise)}`;
    })
    .join("\n");
  const subtotal = formatPaise(cartSubtotalPaise(lines));
  return `Hi ${STORE_INFO.name}, I'd like to enquire about my cart:\n${items}\nSubtotal: ${subtotal}`;
}

/** Prefilled `wa.me` link enquiring about the current cart. */
export function cartEnquiryUrl(lines: readonly CartLine[]): string {
  return whatsappUrl(cartEnquiryMessage(lines));
}
