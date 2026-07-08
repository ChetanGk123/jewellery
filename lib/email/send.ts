import "server-only"
import { after } from "next/server"
import { buildNewOrderAdminEmail, type NewOrderAdminEmailInput } from "./admin-alert"
import { buildDailyDigestEmail, type DailyDigestEmailInput } from "./daily-digest"
import {
  buildOrderConfirmationEmail,
  type EmailMessage,
  type OrderConfirmationEmailInput,
} from "./order-confirmation"
import { buildOrderStatusEmail, type OrderStatusEmailKind } from "./order-status"
import { ROUTES } from "@/lib/routes"
import { SITE_URL } from "@/lib/site-url"
import { STORE_INFO } from "@/lib/store-info"

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
 */
const FROM = process.env.EMAIL_FROM ?? `${STORE_INFO.name} <onboarding@resend.dev>`

/** True when a provider key is configured (drives the confirmation-page copy). */
export function isEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

/**
 * Deliver one message. Best-effort: logs and swallows every failure; returns
 * whether the provider accepted it (queued callers ignore this, the cron
 * digest reports it).
 */
async function sendEmail(to: string, message: EmailMessage): Promise<boolean> {
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
        from: FROM,
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
function queue(to: string, message: EmailMessage): void {
  try {
    after(() => sendEmail(to, message))
  } catch {
    // No request scope (e.g. tests) — send detached instead.
    void sendEmail(to, message)
  }
}

export type QueueOrderConfirmationInput = Omit<OrderConfirmationEmailInput, "orderUrl"> & {
  to: string
}

/** Queue the order-confirmation email on successful checkout (TASKS 4.6). */
export function queueOrderConfirmationEmail(input: QueueOrderConfirmationInput): void {
  if (!isEmailEnabled()) return

  const { to, ...fields } = input
  queue(
    to,
    buildOrderConfirmationEmail({
      ...fields,
      orderUrl: `${SITE_URL}${ROUTES.order(input.orderNo)}`,
    }),
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
}

/**
 * Queue a Shipped / Delivered / Cancelled notification to the customer
 * (TASKS 5.2). Links to the public order page; a no-op without a provider.
 */
export function queueOrderStatusEmail(input: QueueOrderStatusInput): void {
  if (!isEmailEnabled()) return

  const { to, ...fields } = input
  queue(
    to,
    buildOrderStatusEmail({
      ...fields,
      orderUrl: `${SITE_URL}${ROUTES.order(input.orderNo)}`,
    }),
  )
}

export type QueueNewOrderAdminInput = Omit<NewOrderAdminEmailInput, "adminUrl">

/** Where new-order alerts go — a dedicated inbox, else the store email. */
const ADMIN_ALERT_TO = process.env.ADMIN_ALERT_EMAIL ?? STORE_INFO.email.display

/**
 * Queue the internal new-order alert to the store inbox (TASKS 5.2 / C2), so
 * orders are pushed rather than discovered by polling the console.
 */
export function queueNewOrderAdminEmail(input: QueueNewOrderAdminInput): void {
  if (!isEmailEnabled()) return

  queue(
    ADMIN_ALERT_TO,
    buildNewOrderAdminEmail({
      ...input,
      adminUrl: `${SITE_URL}${ROUTES.adminOrders}`,
    }),
  )
}

export type SendDailyDigestInput = Omit<DailyDigestEmailInput, "adminUrl">

/**
 * Send the close-of-day digest to the store inbox (TASKS 5.17). Unlike the
 * queued sends this is AWAITED — the cron route reports the outcome so a
 * failing digest shows up in the scheduler's logs instead of vanishing.
 */
export async function sendDailyDigestEmailNow(input: SendDailyDigestInput): Promise<boolean> {
  if (!isEmailEnabled()) return false

  return sendEmail(
    ADMIN_ALERT_TO,
    buildDailyDigestEmail({
      ...input,
      adminUrl: `${SITE_URL}${ROUTES.admin}`,
    }),
  )
}
