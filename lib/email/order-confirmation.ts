/**
 * Order-confirmation email template (TASKS 4.6). Pure — no React/server-only
 * deps — so it unit-tests without a mail provider. Email-client constraints
 * apply throughout: inline styles only, table layout, system font stack
 * (webfonts are unreliable in mail clients), brand palette from CLAUDE.md.
 */

import { DEFAULT_STORE_INFO, type ResolvedStoreInfo } from "@/lib/store-info"
import { formatPaise } from "@/lib/utils/money"

export type OrderConfirmationEmailInput = {
  orderNo: string
  customerName: string
  addressLine: string
  city: string
  state: string
  pincode: string
  totalPaise: number
  /** Absolute URL of the order confirmation page. */
  orderUrl: string
}

export type EmailMessage = {
  subject: string
  html: string
  text: string
}

/** Escape user-provided values before interpolating into HTML markup. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

const HEADING_FONT = "Georgia, 'Times New Roman', serif"
const BODY_FONT = "'Segoe UI', Helvetica, Arial, sans-serif"

/**
 * Build the COD order-confirmation message. Every customer-entered field is
 * HTML-escaped; totals are formatted from integer paise at this UI boundary.
 * `info` carries the Settings-editable brand/contact details (6.15); the
 * const-resolved default keeps the builder pure for unit tests.
 */
export function buildOrderConfirmationEmail(
  input: OrderConfirmationEmailInput,
  info: ResolvedStoreInfo = DEFAULT_STORE_INFO,
): EmailMessage {
  const total = formatPaise(input.totalPaise)
  const name = input.customerName.trim() || "there"
  const addressLines = [input.addressLine, `${input.city}, ${input.state} ${input.pincode}`]

  const subject = `Order confirmed — ${input.orderNo} · ${info.name}`

  const text = [
    `Namaste ${name},`,
    "",
    `Thank you for your order! ${input.orderNo} is confirmed and will be delivered in 4–7 days.`,
    "",
    `Total (Cash on Delivery): ${total}`,
    `Delivering to: ${addressLines.join(", ")}`,
    "",
    `Please keep ${total} ready at delivery — our courier collects payment in cash.`,
    `View your order: ${input.orderUrl}`,
    "",
    `Questions? WhatsApp us at ${info.phone.display} or reply to this email.`,
    `— ${info.name}`,
  ].join("\n")

  const html = `
<div style="margin:0;padding:32px 12px;background:#FBF6EE;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
    <tr><td align="center" style="padding-bottom:22px;">
      <div style="font-family:${HEADING_FONT};font-size:26px;letter-spacing:3px;color:#2A0A12;">${escapeHtml(info.wordmark)}</div>
      <div style="font-family:${BODY_FONT};font-size:11px;letter-spacing:2px;color:#A87A1E;text-transform:uppercase;padding-top:4px;">${escapeHtml(info.descriptor)}</div>
    </td></tr>
    <tr><td style="background:#FFFDF8;border:1px solid #E7D9C2;border-radius:3px;padding:34px 34px 30px;">
      <div style="font-family:${HEADING_FONT};font-size:24px;color:#2A0A12;padding-bottom:10px;">Thank you for your order!</div>
      <div style="font-family:${BODY_FONT};font-size:14px;line-height:1.65;color:#5E4A44;">
        Namaste ${escapeHtml(name)}, your order
        <strong style="color:#71182B;">${escapeHtml(input.orderNo)}</strong>
        is confirmed and will be delivered in 4–7 days.
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;border-top:1px solid #F3E3C7;">
        <tr><td style="font-family:${BODY_FONT};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#8A7365;padding:16px 0 4px;">Total · Cash on Delivery</td></tr>
        <tr><td style="font-family:${HEADING_FONT};font-size:22px;color:#2A0A12;">${escapeHtml(total)}</td></tr>
        <tr><td style="font-family:${BODY_FONT};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#8A7365;padding:18px 0 4px;">Delivering to</td></tr>
        <tr><td style="font-family:${BODY_FONT};font-size:14px;line-height:1.6;color:#3D2B25;padding-bottom:18px;">${addressLines.map(escapeHtml).join("<br/>")}</td></tr>
      </table>
      <div style="font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:#8A6D1E;background:#FBF3DE;border:1px solid #E7C98A;border-radius:3px;padding:12px 14px;">
        Please keep ${escapeHtml(total)} ready at delivery — our courier collects payment in cash.
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px auto 4px;">
        <tr><td style="background:#71182B;border-radius:2px;">
          <a href="${escapeHtml(input.orderUrl)}" style="display:inline-block;padding:12px 30px;font-family:${BODY_FONT};font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#F3E3C7;text-decoration:none;">View your order</a>
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
