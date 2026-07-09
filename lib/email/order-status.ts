/**
 * Order status-change emails (TASKS 5.2): Shipped / Delivered / Cancelled
 * customer notifications — the deliberate 4.6 deferrals. Pure (no server-only
 * deps) so it unit-tests without a mail provider. Same email-client constraints
 * as `order-confirmation.ts`: inline styles, table layout, system font stack.
 */

import {
  DEFAULT_EMAIL_COPY,
  escapeHtml,
  renderCopy,
  renderCopyHtml,
  type EmailTemplateId,
  type OrderStatusKindCopy,
} from "./copy"
import type { EmailMessage } from "./order-confirmation"
import { DEFAULT_STORE_INFO, type ResolvedStoreInfo } from "@/lib/store-info"
import { formatPaise } from "@/lib/utils/money"

/** The three order statuses that notify the customer (audit C2). */
export type OrderStatusEmailKind = "Shipped" | "Delivered" | "Cancelled"

/** One ordered item, for the Delivered email's review invitations (6.18). */
export type OrderStatusEmailItem = {
  name: string
  /** Absolute product-page URL (reviews anchor); null when unavailable. */
  reviewUrl: string | null
}

export type OrderStatusEmailInput = {
  kind: OrderStatusEmailKind
  orderNo: string
  customerName: string
  totalPaise: number
  /** Absolute URL of the order page. */
  orderUrl: string
  /** Courier AWB (6.4 follow-up) — rendered as a tracking row on Shipped. */
  awb?: string | null
  /** Courier tracking page (6.4c) — when set, the AWB row links to it. */
  trackingUrl?: string | null
  /** Ordered items — the Delivered email invites a review for each (6.18). */
  items?: OrderStatusEmailItem[]
}

const HEADING_FONT = "Georgia, 'Times New Roman', serif"
const BODY_FONT = "'Segoe UI', Helvetica, Arial, sans-serif"

/**
 * Per-kind structure that is NOT verbiage: the accent colour and which
 * `email_copy` template group the kind reads from (7.2). The wording itself
 * lives in copy.ts / the operator's saved overrides.
 */
const KIND_META: Record<OrderStatusEmailKind, { copyKey: EmailTemplateId; accent: string }> = {
  Shipped: { copyKey: "orderShipped", accent: "#71182B" },
  Delivered: { copyKey: "orderDelivered", accent: "#15692F" },
  Cancelled: { copyKey: "orderCancelled", accent: "#C0392F" },
}

/**
 * Build a status-change message. The customer name is HTML-escaped; the total
 * is formatted from integer paise at this UI boundary. `info` carries the
 * Settings-editable brand/contact details (6.15); `copy` the editable verbiage
 * for this kind (7.2) — defaulted per kind, so the param stays optional.
 */
export function buildOrderStatusEmail(
  input: OrderStatusEmailInput,
  info: ResolvedStoreInfo = DEFAULT_STORE_INFO,
  copy?: OrderStatusKindCopy,
): EmailMessage {
  const meta = KIND_META[input.kind]
  const kindCopy = copy ?? (DEFAULT_EMAIL_COPY[meta.copyKey] as OrderStatusKindCopy)
  const total = formatPaise(input.totalPaise)
  const name = input.customerName.trim() || "there"
  const intro = renderCopy(kindCopy.intro, { orderNo: input.orderNo })

  const subject = renderCopy(kindCopy.subject, { orderNo: input.orderNo, storeName: info.name })

  // Tracking only makes sense while the parcel is moving — Shipped alone.
  const awb = input.kind === "Shipped" ? (input.awb ?? "").trim() : ""
  const trackingUrl = awb ? (input.trackingUrl ?? "").trim() : ""

  const trackingTextLine = trackingUrl
    ? `Tracking (AWB): ${awb} — track your parcel at ${trackingUrl}`
    : `Tracking (AWB): ${awb} — use this number on the courier's tracking page.`

  // Review invitations belong to the moment the jewellery arrives — Delivered
  // alone (6.18). One line/row per item; unlinked items still get named.
  const reviewItems = input.kind === "Delivered" ? (input.items ?? []) : []

  const reviewTextLines =
    reviewItems.length > 0
      ? [
          "",
          "How was your jewellery? A short review helps other brides:",
          ...reviewItems.map((it) =>
            it.reviewUrl ? `Write a review: ${it.name} — ${it.reviewUrl}` : `• ${it.name}`,
          ),
        ]
      : []

  const text = [
    `Namaste ${name},`,
    "",
    intro,
    "",
    `${kindCopy.totalLabel}: ${total}`,
    ...(awb ? [trackingTextLine] : []),
    kindCopy.note,
    ...reviewTextLines,
    "",
    `${renderCopy(kindCopy.button, {})}: ${input.orderUrl}`,
    "",
    `Questions? WhatsApp us at ${info.phone.display} or reply to this email.`,
    `— ${info.name}`,
  ].join("\n")

  // With a link on file the AWB itself is the anchor; plain text otherwise.
  const awbInner = trackingUrl
    ? `<a href="${escapeHtml(trackingUrl)}" style="color:#71182B;">${escapeHtml(awb)}</a>`
    : `<strong style="color:#2A0A12;">${escapeHtml(awb)}</strong>`
  const awbHtml = awb
    ? `
      <div style="font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:#5E4A44;border:1px solid #E7D9C2;border-radius:3px;padding:12px 14px;margin-bottom:12px;">
        Tracking (AWB): ${awbInner} — ${trackingUrl ? "tap the number to track your parcel." : "use this number on the courier&rsquo;s tracking page."}
      </div>`
    : ""

  const reviewRowsHtml = reviewItems
    .map((it) => {
      const label = it.reviewUrl
        ? `<a href="${escapeHtml(it.reviewUrl)}" style="color:#71182B;">Write a review →</a>`
        : ""
      return `
        <tr>
          <td style="font-family:${BODY_FONT};font-size:13px;line-height:1.7;color:#3D2B25;padding-right:12px;">${escapeHtml(it.name)}</td>
          <td style="font-family:${BODY_FONT};font-size:13px;line-height:1.7;white-space:nowrap;" align="right">${label}</td>
        </tr>`
    })
    .join("")
  const reviewHtml =
    reviewItems.length > 0
      ? `
      <div style="border:1px solid #E7D9C2;border-radius:3px;padding:14px;margin-bottom:12px;">
        <div style="font-family:${BODY_FONT};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#8A7365;padding-bottom:6px;">How was your jewellery?</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${reviewRowsHtml}</table>
      </div>`
      : ""

  const html = `
<div style="margin:0;padding:32px 12px;background:#FBF6EE;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
    <tr><td align="center" style="padding-bottom:22px;">
      <div style="font-family:${HEADING_FONT};font-size:26px;letter-spacing:3px;color:#2A0A12;">${escapeHtml(info.wordmark)}</div>
      <div style="font-family:${BODY_FONT};font-size:11px;letter-spacing:2px;color:#A87A1E;text-transform:uppercase;padding-top:4px;">${escapeHtml(info.descriptor)}</div>
    </td></tr>
    <tr><td style="background:#FFFDF8;border:1px solid #E7D9C2;border-radius:3px;padding:34px 34px 30px;">
      <div style="font-family:${HEADING_FONT};font-size:24px;color:${meta.accent};padding-bottom:10px;">${renderCopyHtml(kindCopy.heading, {})}</div>
      <div style="font-family:${BODY_FONT};font-size:14px;line-height:1.65;color:#5E4A44;">
        Namaste ${escapeHtml(name)}, ${renderCopyHtml(kindCopy.intro, { orderNo: input.orderNo })}
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;border-top:1px solid #F3E3C7;">
        <tr><td style="font-family:${BODY_FONT};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#8A7365;padding:16px 0 4px;">${renderCopyHtml(kindCopy.totalLabel, {})}</td></tr>
        <tr><td style="font-family:${HEADING_FONT};font-size:22px;color:#2A0A12;padding-bottom:18px;">${escapeHtml(total)}</td></tr>
      </table>
      ${awbHtml}${reviewHtml}
      <div style="font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:#5E4A44;background:#FBF3DE;border:1px solid #E7C98A;border-radius:3px;padding:12px 14px;">
        ${renderCopyHtml(kindCopy.note, {})}
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px auto 4px;">
        <tr><td style="background:${meta.accent};border-radius:2px;">
          <a href="${escapeHtml(input.orderUrl)}" style="display:inline-block;padding:12px 30px;font-family:${BODY_FONT};font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#F3E3C7;text-decoration:none;">${renderCopyHtml(kindCopy.button, {})}</a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding-top:20px;font-family:${BODY_FONT};font-size:12px;line-height:1.7;color:#8A7365;">
      Questions? WhatsApp us at ${escapeHtml(info.phone.display)} or reply to this email.<br/>
      ${escapeHtml(info.address.line)}
    </td></tr>
  </table>
</div>`

  return { subject, html, text }
}
