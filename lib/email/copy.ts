/**
 * Editable email verbiage (TASKS 7.1). One const default per string — extracted
 * verbatim from the builders — plus the resolve/merge layer that overlays the
 * operator's saved `setting.email_copy` overrides (same pattern as
 * `resolveStoreInfo`, 6.15: trimmed non-empty strings win, blanks fall back).
 *
 * Pure and client-safe: the admin Emails console imports this (and the
 * builders) in the browser for live previews. Copy strings carry `{token}`
 * placeholders; builders substitute them via `renderCopy`/`renderCopyHtml` —
 * HTML contexts escape the template BEFORE injecting values, so operator copy
 * can never smuggle markup into an email.
 */

/** Escape user- or operator-provided values before interpolating into HTML. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export type OrderConfirmationCopy = {
  subject: string
  heading: string
  intro: string
  codNotice: string
  button: string
}

export type OrderStatusKindCopy = {
  subject: string
  heading: string
  intro: string
  totalLabel: string
  note: string
  button: string
}

export type AdminAlertCopy = {
  subject: string
  heading: string
  button: string
}

/** The five return-flow notifications share one field shape (8.7e). */
export type ReturnStatusKindCopy = {
  subject: string
  heading: string
  intro: string
  note: string
  button: string
}

export type AbandonedCartCopy = {
  subject: string
  heading: string
  intro: string
  notice: string
  button: string
}

export type SubscriberWelcomeCopy = {
  subject: string
  heading: string
  body: string
  button: string
}

export type DailyDigestCopy = {
  subject: string
  heading: string
  button: string
}

export type EmailCopy = {
  orderConfirmation: OrderConfirmationCopy
  orderConfirmed: OrderStatusKindCopy
  orderShipped: OrderStatusKindCopy
  orderDelivered: OrderStatusKindCopy
  orderCancelled: OrderStatusKindCopy
  returnRequested: ReturnStatusKindCopy
  returnApproved: ReturnStatusKindCopy
  returnRejected: ReturnStatusKindCopy
  returnRefunded: ReturnStatusKindCopy
  returnExchanged: ReturnStatusKindCopy
  adminAlert: AdminAlertCopy
  returnAdminAlert: AdminAlertCopy
  abandonedCart: AbandonedCartCopy
  subscriberWelcome: SubscriberWelcomeCopy
  dailyDigest: DailyDigestCopy
}

export type EmailTemplateId = keyof EmailCopy

/**
 * The live wording, verbatim from the builders. Structural text that is data
 * rather than verbiage (breakdown labels, KPI labels, per-item lines, the
 * shared footer) is NOT editable and stays in the builders.
 */
export const EMAIL_COPY_DEFAULTS: EmailCopy = {
  orderConfirmation: {
    // "Confirmed" is a distinct admin fulfilment status (order-status.ts) that
    // only an operator can set — this email fires at placement, so it must say
    // received/placed, never confirmed.
    subject: "Order received — {orderNo} · {storeName}",
    heading: "Thank you for your order!",
    intro:
      "Namaste {name}, we've received your order {orderNo}. We'll confirm it shortly and deliver in 4–7 days.",
    codNotice: "Please keep {total} ready at delivery — our courier collects payment in cash.",
    button: "View your order",
  },
  orderConfirmed: {
    subject: "Order {orderNo} confirmed — {storeName}",
    heading: "Your order is confirmed!",
    intro: "Order {orderNo} is confirmed and we've started preparing it for despatch.",
    totalLabel: "Amount payable · Cash on Delivery",
    note: "We'll email you again the moment it ships. Please keep the amount ready — our courier collects payment in cash.",
    button: "View your order",
  },
  orderShipped: {
    subject: "Order {orderNo} shipped — {storeName}",
    heading: "Your order is on its way!",
    intro: "Good news — order {orderNo} has been shipped and is on its way.",
    totalLabel: "Amount payable · Cash on Delivery",
    note: "Please keep the amount ready — our courier collects payment in cash on delivery.",
    button: "View your order",
  },
  orderDelivered: {
    subject: "Order {orderNo} delivered — {storeName}",
    heading: "Delivered — thank you!",
    intro: "Order {orderNo} has been delivered. We hope you love your new piece.",
    totalLabel: "Order total · paid on delivery",
    note: "If anything isn't right, just reply to this email or WhatsApp us — we're happy to help.",
    button: "View your order",
  },
  orderCancelled: {
    subject: "Order {orderNo} cancelled — {storeName}",
    heading: "Your order was cancelled",
    intro:
      "Order {orderNo} has been cancelled. As this was Cash on Delivery, you haven't been charged.",
    totalLabel: "Cancelled order total",
    note: "Changed your mind? Your favourites are waiting — browse the collection anytime.",
    button: "View your order",
  },
  returnRequested: {
    subject: "Return request received — {orderNo} · {storeName}",
    heading: "We've received your return request",
    intro:
      "Namaste {name}, your return request for order {orderNo} is with us. We'll review it and get back to you within 1–2 days.",
    note: "Please keep the piece safe with its original packaging until the return is approved.",
    button: "View your order",
  },
  returnApproved: {
    subject: "Return approved — {orderNo} · {storeName}",
    heading: "Your return is approved",
    intro:
      "Namaste {name}, good news — your return for order {orderNo} is approved. Pack the piece securely with all its original packaging.",
    note: "Once you've couriered it, share the receipt with us on WhatsApp so we can watch for the parcel.",
    button: "View your order",
  },
  returnRejected: {
    subject: "About your return request — {orderNo} · {storeName}",
    heading: "We couldn't accept this return",
    intro:
      "Namaste {name}, we've reviewed your return request for order {orderNo} and couldn't approve it this time.",
    note: "If you think this is a mistake, reply to this email or WhatsApp us — we're happy to take another look.",
    button: "View your order",
  },
  returnRefunded: {
    subject: "Refund paid — {orderNo} · {storeName}",
    heading: "Your refund is on its way",
    intro: "Namaste {name}, we've paid the refund for your return on order {orderNo} to your UPI ID.",
    note: "UPI transfers usually appear instantly, but can take a few hours depending on your bank.",
    button: "View your order",
  },
  returnExchanged: {
    subject: "Exchange confirmed — {orderNo} · {storeName}",
    heading: "Your exchange is confirmed",
    intro:
      "Namaste {name}, your exchange for order {orderNo} is confirmed — the replacement piece is being prepared and will reach you soon.",
    note: "We'll share the tracking details once the replacement ships.",
    button: "View your order",
  },
  adminAlert: {
    subject: "New COD order {orderNo} — {total}",
    heading: "New order placed",
    button: "Open order queue",
  },
  returnAdminAlert: {
    subject: "Return requested — {orderNo} ({resolution})",
    heading: "New return request",
    button: "Open returns queue",
  },
  abandonedCart: {
    subject: "Your cart is waiting — {storeName}",
    heading: "Still thinking it over?",
    intro:
      "Namaste — you left a few pieces sparkling in your cart. They're still saved for you.",
    notice: "Cash on Delivery available — nothing to pay until it arrives.",
    button: "Complete your order",
  },
  subscriberWelcome: {
    subject: "Welcome to {storeName}",
    heading: "Welcome to the family",
    body: "Namaste — thank you for joining the {storeName} list. You'll be the first to hear about new arrivals, festive offers, and bridal-edit drops. A few times a month, never spam.",
    button: "Browse the collection",
  },
  dailyDigest: {
    subject: "Daily digest — {day}: {orders}, {revenue}",
    heading: "Daily digest · {day}",
    button: "Open dashboard",
  },
}

/**
 * Tokens each field may use — drives the "You can use {orderNo}, {total}"
 * hints in the admin editor. Fields absent here take no tokens.
 */
export const COPY_TOKENS: { [T in EmailTemplateId]: Partial<Record<keyof EmailCopy[T], string[]>> } =
  {
    orderConfirmation: {
      subject: ["orderNo", "storeName"],
      intro: ["name", "orderNo"],
      codNotice: ["total"],
    },
    orderConfirmed: { subject: ["orderNo", "storeName"], intro: ["orderNo"] },
    orderShipped: { subject: ["orderNo", "storeName"], intro: ["orderNo"] },
    orderDelivered: { subject: ["orderNo", "storeName"], intro: ["orderNo"] },
    orderCancelled: { subject: ["orderNo", "storeName"], intro: ["orderNo"] },
    returnRequested: { subject: ["orderNo", "storeName"], intro: ["name", "orderNo"] },
    returnApproved: { subject: ["orderNo", "storeName"], intro: ["name", "orderNo"] },
    returnRejected: { subject: ["orderNo", "storeName"], intro: ["name", "orderNo"] },
    returnRefunded: { subject: ["orderNo", "storeName"], intro: ["name", "orderNo"] },
    returnExchanged: { subject: ["orderNo", "storeName"], intro: ["name", "orderNo"] },
    adminAlert: { subject: ["orderNo", "total"] },
    returnAdminAlert: { subject: ["orderNo", "resolution"] },
    abandonedCart: { subject: ["storeName"] },
    subscriberWelcome: { subject: ["storeName"], body: ["storeName"] },
    dailyDigest: { subject: ["day", "orders", "revenue"], heading: ["day"] },
  }

/** Coerce an unknown JSON value into a plain record (empty on mismatch). */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/** Trimmed non-empty string, else undefined — blanks never beat a default. */
function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** Overlay saved strings onto one template's defaults; unknown keys dropped. */
function mergeGroup<T extends Record<string, string>>(defaults: T, raw: unknown): T {
  const record = asRecord(raw)
  const merged = Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [key, clean(record[key]) ?? fallback]),
  )
  return merged as T
}

/**
 * Resolve the operator's saved `email_copy` blob over the const defaults.
 * Tolerant of any raw shape — junk, blanks and unknown keys all fall back, so
 * every email always has complete copy.
 */
export function resolveEmailCopy(raw: unknown): EmailCopy {
  const record = asRecord(raw)
  return {
    orderConfirmation: mergeGroup(EMAIL_COPY_DEFAULTS.orderConfirmation, record.orderConfirmation),
    orderConfirmed: mergeGroup(EMAIL_COPY_DEFAULTS.orderConfirmed, record.orderConfirmed),
    orderShipped: mergeGroup(EMAIL_COPY_DEFAULTS.orderShipped, record.orderShipped),
    orderDelivered: mergeGroup(EMAIL_COPY_DEFAULTS.orderDelivered, record.orderDelivered),
    orderCancelled: mergeGroup(EMAIL_COPY_DEFAULTS.orderCancelled, record.orderCancelled),
    returnRequested: mergeGroup(EMAIL_COPY_DEFAULTS.returnRequested, record.returnRequested),
    returnApproved: mergeGroup(EMAIL_COPY_DEFAULTS.returnApproved, record.returnApproved),
    returnRejected: mergeGroup(EMAIL_COPY_DEFAULTS.returnRejected, record.returnRejected),
    returnRefunded: mergeGroup(EMAIL_COPY_DEFAULTS.returnRefunded, record.returnRefunded),
    returnExchanged: mergeGroup(EMAIL_COPY_DEFAULTS.returnExchanged, record.returnExchanged),
    adminAlert: mergeGroup(EMAIL_COPY_DEFAULTS.adminAlert, record.adminAlert),
    returnAdminAlert: mergeGroup(EMAIL_COPY_DEFAULTS.returnAdminAlert, record.returnAdminAlert),
    abandonedCart: mergeGroup(EMAIL_COPY_DEFAULTS.abandonedCart, record.abandonedCart),
    subscriberWelcome: mergeGroup(EMAIL_COPY_DEFAULTS.subscriberWelcome, record.subscriberWelcome),
    dailyDigest: mergeGroup(EMAIL_COPY_DEFAULTS.dailyDigest, record.dailyDigest),
  }
}

/** The pure const-resolved fallback, mirroring `DEFAULT_STORE_INFO`. */
export const DEFAULT_EMAIL_COPY: EmailCopy = resolveEmailCopy({})

const TOKEN_RE = /\{(\w+)\}/g

/**
 * Substitute `{token}`s in a plain-text context. Unknown tokens stay literal —
 * a typo in saved copy degrades visibly instead of throwing.
 */
export function renderCopy(template: string, vars: Record<string, string>): string {
  return template.replace(TOKEN_RE, (match, key: string) =>
    key in vars ? vars[key] : match,
  )
}

/**
 * Substitute `{token}`s in an HTML context. The template is escaped FIRST
 * (braces survive escaping), then values are injected: `vars` get escaped,
 * `htmlVars` are trusted pre-rendered fragments (e.g. a `<strong>`-wrapped
 * order number) and pass through verbatim — never put user input in htmlVars
 * unescaped.
 */
export function renderCopyHtml(
  template: string,
  vars: Record<string, string>,
  htmlVars: Record<string, string> = {},
): string {
  return escapeHtml(template).replace(TOKEN_RE, (match, key: string) => {
    if (key in htmlVars) return htmlVars[key]
    if (key in vars) return escapeHtml(vars[key])
    return match
  })
}
