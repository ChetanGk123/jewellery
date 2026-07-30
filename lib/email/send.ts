import "server-only"
import { after } from "next/server"
import nodemailer, { type Transporter } from "nodemailer"
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
import {
  buildReturnAdminEmail,
  buildReturnStatusEmail,
  type ReturnEmailKind,
  returnStatusCopyFor,
} from "./return-status"
import { buildSampleEmail } from "./samples"
import { buildSubscriberWelcomeEmail } from "./subscriber-welcome"
import { getEmailCopy, getStoreInfo } from "@/lib/db/settings"
import { ROUTES } from "@/lib/routes"
import { SITE_URL } from "@/lib/site-url"
import type { ResolvedStoreInfo } from "@/lib/store-info"

/**
 * Transactional email over SMTP via Nodemailer (TASKS 10.2; replaced the Resend
 * REST call from 4.6). SMTP was chosen to escape Resend's unverified-domain
 * rule, which only delivered to the account owner and so silently failed every
 * real customer send.
 *
 * Degrades to a no-op when SMTP isn't configured (local dev, CI): checkout must
 * never depend on email. Every failure is logged, never thrown.
 *
 * NOTE: this makes sending require a TCP socket, so it can never run on the
 * edge runtime. No caller is edge today — keep it that way.
 */

/** Applied to connect, greeting and socket alike — no stage may outlast it. */
const SEND_TIMEOUT_MS = 10_000
const DEFAULT_SMTP_PORT = 587
/** Implicit TLS (SMTPS). Every other port is STARTTLS-upgraded on connect. */
const SMTPS_PORT = 465
/** A storefront sends in bursts (an order fans out to customer + admin). */
const MAX_POOLED_CONNECTIONS = 3

/**
 * An env var's value, or undefined when it is unset **or blank**.
 *
 * `??` alone is not enough here: `docker-compose.yml` declares every optional
 * var as `${VAR:-}`, so an unset var reaches the container as `""` — which is
 * not nullish, so `process.env.X ?? fallback` yields `""` and the default never
 * applies. That is what produced "No recipients defined" in production: an
 * unset ADMIN_ALERT_EMAIL became an empty To. Trimmed, so a stray space from an
 * env file can't masquerade as a value either.
 */
function envValue(name: string): string | undefined {
  const trimmed = process.env[name]?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Pooled transport, built once and reused: SMTP costs a TCP+TLS+AUTH handshake
 * per connection, which a per-send transport would re-pay on every email.
 * Null (not throwing) when unconfigured, so `sendEmail` can no-op cleanly.
 */
let cachedTransport: Transporter | null = null

function getTransport(): Transporter | null {
  const host = envValue("SMTP_HOST")
  const user = envValue("SMTP_USER")
  // NOT trimmed via envValue: a password's own whitespace is significant.
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass?.trim()) return null

  if (!cachedTransport) {
    const port = Number(envValue("SMTP_PORT") ?? DEFAULT_SMTP_PORT)
    cachedTransport = nodemailer.createTransport({
      host,
      port,
      secure: port === SMTPS_PORT,
      auth: { user, pass },
      pool: true,
      maxConnections: MAX_POOLED_CONNECTIONS,
      // Nodemailer has no single "overall deadline" — each stage needs its own
      // bound, or a server that connects then stalls would hang the send.
      connectionTimeout: SEND_TIMEOUT_MS,
      greetingTimeout: SEND_TIMEOUT_MS,
      socketTimeout: SEND_TIMEOUT_MS,
    })
  }
  return cachedTransport
}

/**
 * Sender identity. Most SMTP providers (Gmail included) reject or rewrite a
 * `From` the authenticated account doesn't own, so the default pairs the
 * Settings-edited store name with SMTP_USER's address. Only set EMAIL_FROM to
 * a different address once that mailbox is a verified alias of SMTP_USER.
 * Per-call (not module const) so the Settings-edited store name shows (6.15).
 */
function fromAddress(info: ResolvedStoreInfo): string {
  return envValue("EMAIL_FROM") ?? `${info.name} <${envValue("SMTP_USER") ?? ""}>`
}

/** True when SMTP is configured (drives the confirmation-page copy). */
export function isEmailEnabled(): boolean {
  return Boolean(envValue("SMTP_HOST") && envValue("SMTP_USER") && process.env.SMTP_PASS?.trim())
}

/**
 * Deliver one message. Best-effort: logs and swallows every failure; returns
 * whether the provider accepted it (queued callers ignore this, the cron
 * digest reports it).
 */
async function sendEmail(to: string, message: EmailMessage, from: string): Promise<boolean> {
  const transport = getTransport()
  if (!transport) return false

  try {
    await transport.sendMail({
      from,
      to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    })
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

export type QueueReturnStatusInput = {
  to: string
  kind: ReturnEmailKind
  orderNo: string
  customerName: string
  resolution: string
  /** Approved: the who-pays-shipping note from the returns settings. */
  shippingNote?: string
  /** Refunded: the payout record. */
  refundAmountPaise?: number | null
  refundReference?: string | null
  /** Rejected: the operator's note. */
  operatorNote?: string | null
}

/**
 * Queue a return-flow notification to the customer (TASKS 8.7e). Links to the
 * signed-in account order page (returns live there); a no-op without a
 * provider, best-effort like every queued send.
 */
export async function queueReturnStatusEmail(input: QueueReturnStatusInput): Promise<void> {
  if (!isEmailEnabled()) return

  const [info, emailCopy] = await Promise.all([getStoreInfo(), getEmailCopy()])
  const { to, ...fields } = input
  queue(
    to,
    buildReturnStatusEmail(
      { ...fields, orderUrl: `${SITE_URL}${ROUTES.accountOrder(input.orderNo)}` },
      info,
      returnStatusCopyFor(emailCopy, input.kind),
    ),
    fromAddress(info),
  )
}

export type QueueReturnAdminInput = {
  orderNo: string
  customerName: string
  resolution: string
  reason: string
}

/** Queue the internal new-return alert to the store inbox (TASKS 8.7e). */
export async function queueReturnAdminEmail(input: QueueReturnAdminInput): Promise<void> {
  if (!isEmailEnabled()) return

  const [info, emailCopy] = await Promise.all([getStoreInfo(), getEmailCopy()])
  queue(
    adminAlertTo(info),
    buildReturnAdminEmail(
      { ...input, adminUrl: `${SITE_URL}${ROUTES.adminReturns}` },
      info,
      emailCopy.returnAdminAlert,
    ),
    fromAddress(info),
  )
}

export type QueueNewOrderAdminInput = Omit<NewOrderAdminEmailInput, "adminUrl">

/** Where new-order alerts go — a dedicated inbox, else the store email. */
export function adminAlertTo(info: ResolvedStoreInfo): string {
  return envValue("ADMIN_ALERT_EMAIL") ?? info.email.display
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
