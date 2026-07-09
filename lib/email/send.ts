import "server-only"
import { after } from "next/server"
import { buildAbandonedCartEmail } from "./abandoned-cart"
import { buildNewOrderAdminEmail, type NewOrderAdminEmailInput } from "./admin-alert"
import type { EmailTemplateId } from "./copy"
import { buildDailyDigestEmail, type DailyDigestEmailInput } from "./daily-digest"
import {
  buildOrderConfirmationEmail,
  type EmailMessage,
  type OrderConfirmationEmailInput,
} from "./order-confirmation"
import { buildOrderStatusEmail, orderStatusCopyFor, type OrderStatusEmailKind } from "./order-status"
import { buildSampleEmail } from "./samples"
import { buildSubscriberWelcomeEmail } from "./subscriber-welcome"
import { getEmailCopy, getStoreInfo } from "@/lib/db/settings"
import { ROUTES } from "@/lib/routes"
import { SITE_URL } from "@/lib/site-url"
import type { ResolvedStoreInfo } from "@/lib/store-info"

/**
 * Transactional email via the Resend REST API (TASKS 4.6). Deliberately a
 * plain authenticated POST — one endpoint doesn't warrant the vendor SDK.
 *
 * Degrades to a no-op when RESEND_API_KEY isn't configured (local dev, CI):
 * checkout must never depend on email. Every failure is logged, never thrown.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails"
const SEND_TIMEOUT_MS = 10_000

/**
 * Sender identity. Resend requires a verified domain for real addresses;
 * `onboarding@resend.dev` works out of the box but only delivers to the
 * account owner's inbox — set EMAIL_FROM once the domain is verified.
 * Per-call (not module const) so the Settings-edited store name shows (6.15).
 */
function fromAddress(info: ResolvedStoreInfo): string {
  return process.env.EMAIL_FROM ?? `${info.name} <onboarding@resend.dev>`
}

/** True when a provider key is configured (drives the confirmation-page copy). */
export function isEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

/**
 * Deliver one message. Best-effort: logs and swallows every failure; returns
 * whether the provider accepted it (queued callers ignore this, the cron
 * digest reports it).
 */
async function sendEmail(to: string, message: EmailMessage, from: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })

    if (!response.ok) {
      console.error(`email send failed (${response.status})`, await response.text().catch(() => ""))
      return false
    }
    return true
  } catch (error: unknown) {
    console.error("email send failed", error)
    return false
  }
}

/**
 * Schedule a send to run after the response is flushed (`after()`), so the
 * customer/operator never waits on the mail provider. Falls back to a detached
 * send outside a request scope (unit tests). Never throws — an email hiccup
 * must not fail an already-committed order or status change.
 */
function queue(to: string, message: EmailMessage, from: string): void {
  try {
    after(() => sendEmail(to, message, from))
  } catch {
    // No request scope (e.g. tests) — send detached instead.
    void sendEmail(to, message, from)
  }
}

export type QueueOrderConfirmationInput = Omit<OrderConfirmationEmailInput, "orderUrl"> & {
  to: string
}

/**
 * Queue the order-confirmation email on successful checkout (TASKS 4.6).
 * Async since 6.15: resolves the Settings-editable store identity first —
 * await it so `after()` still registers inside the request scope.
 */
export async function queueOrderConfirmationEmail(
  input: QueueOrderConfirmationInput,
): Promise<void> {
  if (!isEmailEnabled()) return

  const [info, emailCopy] = await Promise.all([getStoreInfo(), getEmailCopy()])
  const { to, ...fields } = input
  queue(
    to,
    buildOrderConfirmationEmail(
      { ...fields, orderUrl: `${SITE_URL}${ROUTES.order(input.orderNo)}` },
      info,
      emailCopy.orderConfirmation,
    ),
    fromAddress(info),
  )
}

export type QueueOrderStatusInput = {
  to: string
  kind: OrderStatusEmailKind
  orderNo: string
  customerName: string
  totalPaise: number
  /** Courier AWB — the Shipped email renders it as a tracking row (6.4). */
  awb?: string | null
  /** Courier tracking page — links the AWB row when set (6.4c). */
  trackingUrl?: string | null
  /** Ordered items — the Delivered email invites a review per item (6.18). */
  items?: Array<{ name: string; slug: string | null }>
}

/** Anchor of the product page's reviews section (ProductReviews heading). */
const REVIEWS_ANCHOR = "#reviews-heading"

/**
 * Queue a Shipped / Delivered / Cancelled notification to the customer
 * (TASKS 5.2). Links to the public order page; a no-op without a provider.
 */
export async function queueOrderStatusEmail(input: QueueOrderStatusInput): Promise<void> {
  if (!isEmailEnabled()) return

  const [info, emailCopy] = await Promise.all([getStoreInfo(), getEmailCopy()])
  const { to, items, ...fields } = input
  queue(
    to,
    buildOrderStatusEmail(
      {
        ...fields,
        orderUrl: `${SITE_URL}${ROUTES.order(input.orderNo)}`,
        items: items?.map((it) => ({
          name: it.name,
          reviewUrl: it.slug ? `${SITE_URL}${ROUTES.product(it.slug)}${REVIEWS_ANCHOR}` : null,
        })),
      },
      info,
      orderStatusCopyFor(emailCopy, input.kind),
    ),
    fromAddress(info),
  )
}

export type QueueNewOrderAdminInput = Omit<NewOrderAdminEmailInput, "adminUrl">

/** Where new-order alerts go — a dedicated inbox, else the store email. */
export function adminAlertTo(info: ResolvedStoreInfo): string {
  return process.env.ADMIN_ALERT_EMAIL ?? info.email.display
}

/**
 * Queue the internal new-order alert to the store inbox (TASKS 5.2 / C2), so
 * orders are pushed rather than discovered by polling the console.
 */
export async function queueNewOrderAdminEmail(input: QueueNewOrderAdminInput): Promise<void> {
  if (!isEmailEnabled()) return

  const [info, emailCopy] = await Promise.all([getStoreInfo(), getEmailCopy()])
  queue(
    adminAlertTo(info),
    buildNewOrderAdminEmail(
      { ...input, adminUrl: `${SITE_URL}${ROUTES.adminOrders}` },
      info,
      emailCopy.adminAlert,
    ),
    fromAddress(info),
  )
}

/** One synced cart item, as `get_abandoned_carts` returns it (0041 keys). */
export type AbandonedCartSendItem = {
  name: string
  slug: string | null
  qty: number
  unit_price_paise: number
  tone: string | null
}

/**
 * Send one abandoned-cart reminder (TASKS 6.19). AWAITED like the digest —
 * the cron route reports per-cart outcomes so failures land in its logs.
 */
export async function sendAbandonedCartEmailNow(input: {
  to: string
  items: AbandonedCartSendItem[]
}): Promise<boolean> {
  if (!isEmailEnabled()) return false

  const [info, emailCopy] = await Promise.all([getStoreInfo(), getEmailCopy()])
  return sendEmail(
    input.to,
    buildAbandonedCartEmail(
      {
        cartUrl: `${SITE_URL}${ROUTES.cart}`,
        items: input.items.map((it) => ({
          name: it.name,
          qty: it.qty,
          unitPricePaise: it.unit_price_paise,
          tone: it.tone,
          productUrl: it.slug ? `${SITE_URL}${ROUTES.product(it.slug)}` : null,
        })),
      },
      info,
      emailCopy.abandonedCart,
    ),
    fromAddress(info),
  )
}

/**
 * Queue the one-time newsletter welcome to a NEW subscriber (TASKS 6.19).
 * Best-effort like the other queued sends — a mail hiccup must never fail an
 * already-recorded sign-up.
 */
export async function queueSubscriberWelcomeEmail(to: string): Promise<void> {
  if (!isEmailEnabled()) return

  const [info, emailCopy] = await Promise.all([getStoreInfo(), getEmailCopy()])
  queue(
    to,
    buildSubscriberWelcomeEmail(
      { shopUrl: `${SITE_URL}${ROUTES.shop}` },
      info,
      emailCopy.subscriberWelcome,
    ),
    fromAddress(info),
  )
}

/**
 * Send one template's SAMPLE render to the store inbox (TASKS 7.4) — the
 * Emails console's "Send test email". AWAITED: the admin is waiting on the
 * outcome. Uses the SAVED copy (not unsaved form state) and the same sample
 * fixtures as the console preview, so inbox and preview match. Returns the
 * recipient so the UI can show where it went.
 */
export async function sendTestTemplateEmailNow(
  templateId: EmailTemplateId,
): Promise<{ sent: boolean; to: string }> {
  const [info, emailCopy] = await Promise.all([getStoreInfo(), getEmailCopy()])
  const to = adminAlertTo(info)
  if (!isEmailEnabled()) return { sent: false, to }

  const message = buildSampleEmail(templateId, { info, copy: emailCopy, baseUrl: SITE_URL })
  const sent = await sendEmail(
    to,
    { ...message, subject: `[Test] ${message.subject}` },
    fromAddress(info),
  )
  return { sent, to }
}

export type SendDailyDigestInput = Omit<DailyDigestEmailInput, "adminUrl">

/**
 * Send the close-of-day digest to the store inbox (TASKS 5.17). Unlike the
 * queued sends this is AWAITED — the cron route reports the outcome so a
 * failing digest shows up in the scheduler's logs instead of vanishing.
 */
export async function sendDailyDigestEmailNow(input: SendDailyDigestInput): Promise<boolean> {
  if (!isEmailEnabled()) return false

  const [info, emailCopy] = await Promise.all([getStoreInfo(), getEmailCopy()])
  return sendEmail(
    adminAlertTo(info),
    buildDailyDigestEmail(
      { ...input, adminUrl: `${SITE_URL}${ROUTES.admin}` },
      info,
      emailCopy.dailyDigest,
    ),
    fromAddress(info),
  )
}
