/**
 * WhatsApp enquiry links (TASKS 2.7). Pure builders for prefilled `wa.me` URLs
 * from product or cart context — no React/DOM deps, so they're unit testable and
 * usable from any component. The number is the single `STORE_INFO.whatsapp`
 * handle; the store name in the copy is `STORE_INFO.name`, so both track the one
 * source of truth (mirrors the prototype's `wa.me/<no>?text=...` enquiry).
 */

import type { CartLine } from "@/lib/cart"
import { cartSubtotalPaise } from "@/lib/cart"
import { STORE_INFO } from "@/lib/store-info"
import { formatPaise } from "@/lib/utils/money"

const WA_BASE = "https://wa.me"

/**
 * The store identity an enquiry link speaks as (6.15). Server pages resolve
 * this from `getStoreInfo()` and thread it into the client components; when
 * omitted, the builders fall back to the `STORE_INFO` const so existing
 * callers (and tests) keep working.
 */
export type EnquiryStore = {
  name: string
  /** E.164 digits for the `wa.me` link. */
  whatsappNumber: string
}

const DEFAULT_STORE: EnquiryStore = {
  name: STORE_INFO.name,
  whatsappNumber: STORE_INFO.whatsapp.number,
}

/** A `wa.me` link to the store, with `message` prefilled into the chat box. */
export function whatsappUrl(
  message: string,
  number: string = DEFAULT_STORE.whatsappNumber,
): string {
  return `${WA_BASE}/${number}?text=${encodeURIComponent(message)}`
}

/** Context for a product enquiry: the name, optional chosen tone, and page link. */
export type ProductEnquiry = {
  name: string
  /** Chosen plating tone label, appended when present. */
  tone?: string | null
  /** Absolute product URL, appended on its own line when present. */
  url?: string | null
}

/** Enquiry text for a product — names it, the chosen tone, and links the page. */
export function productEnquiryMessage(
  { name, tone, url }: ProductEnquiry,
  store: EnquiryStore = DEFAULT_STORE,
): string {
  const tonePart = tone ? ` (${tone} plating)` : ""
  const urlPart = url ? `\n${url}` : ""
  return `Hi ${store.name}, I'm interested in the ${name}${tonePart}.${urlPart}`
}

/** Prefilled `wa.me` link enquiring about one product. */
export function productEnquiryUrl(
  enquiry: ProductEnquiry,
  store: EnquiryStore = DEFAULT_STORE,
): string {
  return whatsappUrl(productEnquiryMessage(enquiry, store), store.whatsappNumber)
}

/** Enquiry text listing the cart's lines (qty, name, tone, unit price) + subtotal. */
export function cartEnquiryMessage(
  lines: readonly CartLine[],
  store: EnquiryStore = DEFAULT_STORE,
): string {
  const items = lines
    .map((line) => {
      const tone = line.optionValue ? ` (${line.optionValue})` : ""
      return `• ${line.quantity}× ${line.name}${tone} — ${formatPaise(line.pricePaise)}`
    })
    .join("\n")
  const subtotal = formatPaise(cartSubtotalPaise(lines))
  return `Hi ${store.name}, I'd like to enquire about my cart:\n${items}\nSubtotal: ${subtotal}`
}

/** Prefilled `wa.me` link enquiring about the current cart. */
export function cartEnquiryUrl(
  lines: readonly CartLine[],
  store: EnquiryStore = DEFAULT_STORE,
): string {
  return whatsappUrl(cartEnquiryMessage(lines, store), store.whatsappNumber)
}

/* ------------------- Operator → customer (admin, 5.15) ------------------- */

/** India country code — checkout collects 10-digit local numbers. */
const IN_COUNTRY_CODE = "91"

/**
 * A `wa.me` link **to a customer's number** (the storefront builders above all
 * point at the store). 10-digit local numbers get the Indian country code;
 * longer ones are assumed already international. Returns null when the phone
 * has no usable digits so callers can hide the button instead of linking to a
 * broken chat.
 */
export function customerWhatsappUrl(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "")
  if (!digits) return null
  const intl = digits.length === 10 ? `${IN_COUNTRY_CODE}${digits}` : digits
  return `${WA_BASE}/${intl}?text=${encodeURIComponent(message)}`
}

export type CodConfirmation = {
  customerName: string
  orderNo: string
  totalPaise: number
}

/**
 * COD-confirmation template the operator sends before dispatch (TASKS 5.15):
 * names the order and the amount due, and asks for a YES so unconfirmed
 * parcels don't ship and bounce.
 */
export function codConfirmationMessage({
  customerName,
  orderNo,
  totalPaise,
}: CodConfirmation): string {
  return (
    `Namaste ${customerName}, this is ${STORE_INFO.name}. ` +
    `Confirming your Cash on Delivery order ${orderNo} for ${formatPaise(totalPaise)}. ` +
    `Please reply YES to confirm and we'll pack and dispatch it right away.`
  )
}
