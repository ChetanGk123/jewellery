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

/** Context for a product enquiry: the name, optional chosen tone, and page link. */
export type ProductEnquiry = {
  name: string;
  /** Chosen plating tone label, appended when present. */
  tone?: string | null;
  /** Absolute product URL, appended on its own line when present. */
  url?: string | null;
};

/** Enquiry text for a product — names it, the chosen tone, and links the page. */
export function productEnquiryMessage({ name, tone, url }: ProductEnquiry): string {
  const tonePart = tone ? ` (${tone} plating)` : "";
  const urlPart = url ? `\n${url}` : "";
  return `Hi ${STORE_INFO.name}, I'm interested in the ${name}${tonePart}.${urlPart}`;
}

/** Prefilled `wa.me` link enquiring about one product. */
export function productEnquiryUrl(enquiry: ProductEnquiry): string {
  return whatsappUrl(productEnquiryMessage(enquiry));
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
