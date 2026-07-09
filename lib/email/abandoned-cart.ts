/**
 * Abandoned-cart reminder (TASKS 6.19): sent by the cron route to a signed-in
 * customer whose synced cart has sat idle for 24h+. Pure template — same
 * email-client constraints as the other builders (inline styles, table layout,
 * system fonts); every item field is escaped even though the `sync_cart` RPC
 * already sanitizes what it stores (defense in depth).
 */

import { type EmailMessage, escapeHtml } from "./order-confirmation"
import { DEFAULT_STORE_INFO, type ResolvedStoreInfo } from "@/lib/store-info"
import { formatPaise } from "@/lib/utils/money"

export type AbandonedCartItem = {
  name: string
  qty: number
  unitPricePaise: number
  /** Chosen plating tone, when the line had one. */
  tone: string | null
  /** Absolute product-page URL; null when the product has no live page. */
  productUrl: string | null
}

export type AbandonedCartEmailInput = {
  items: AbandonedCartItem[]
  /** Absolute URL of the cart page. */
  cartUrl: string
}

const HEADING_FONT = "Georgia, 'Times New Roman', serif"
const BODY_FONT = "'Segoe UI', Helvetica, Arial, sans-serif"

/** Build the reminder. Totals are advisory — checkout recomputes everything. */
export function buildAbandonedCartEmail(
  input: AbandonedCartEmailInput,
  info: ResolvedStoreInfo = DEFAULT_STORE_INFO,
): EmailMessage {
  const totalPaise = input.items.reduce((sum, it) => sum + it.unitPricePaise * it.qty, 0)
  const total = formatPaise(totalPaise)

  const subject = `Your cart is waiting — ${info.name}`

  const itemLine = (it: AbandonedCartItem) =>
    `• ${it.name}${it.tone ? ` (${it.tone})` : ""} ×${it.qty} — ${formatPaise(it.unitPricePaise * it.qty)}`

  const text = [
    "Namaste,",
    "",
    "You left a few pieces sparkling in your cart — they're still saved for you:",
    ...input.items.map(itemLine),
    "",
    `Cart total: ${total} (Cash on Delivery available)`,
    `Complete your order: ${input.cartUrl}`,
    "",
    `Questions? WhatsApp us at ${info.phone.display} or reply to this email.`,
    `— ${info.name}`,
  ].join("\n")

  const rowsHtml = input.items
    .map((it) => {
      const name = it.productUrl
        ? `<a href="${escapeHtml(it.productUrl)}" style="color:#71182B;text-decoration:none;">${escapeHtml(it.name)}</a>`
        : escapeHtml(it.name)
      return `
        <tr>
          <td style="font-family:${BODY_FONT};font-size:14px;line-height:1.7;color:#3D2B25;padding:4px 12px 4px 0;">
            ${name}${it.tone ? `<span style="color:#8A7365;"> · ${escapeHtml(it.tone)}</span>` : ""}<span style="color:#8A7365;"> ×${it.qty}</span>
          </td>
          <td style="font-family:${BODY_FONT};font-size:14px;line-height:1.7;color:#2A0A12;white-space:nowrap;" align="right">${escapeHtml(formatPaise(it.unitPricePaise * it.qty))}</td>
        </tr>`
    })
    .join("")

  const html = `
<div style="margin:0;padding:32px 12px;background:#FBF6EE;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
    <tr><td align="center" style="padding-bottom:22px;">
      <div style="font-family:${HEADING_FONT};font-size:26px;letter-spacing:3px;color:#2A0A12;">${escapeHtml(info.wordmark)}</div>
      <div style="font-family:${BODY_FONT};font-size:11px;letter-spacing:2px;color:#A87A1E;text-transform:uppercase;padding-top:4px;">${escapeHtml(info.descriptor)}</div>
    </td></tr>
    <tr><td style="background:#FFFDF8;border:1px solid #E7D9C2;border-radius:3px;padding:34px 34px 30px;">
      <div style="font-family:${HEADING_FONT};font-size:24px;color:#2A0A12;padding-bottom:10px;">Still thinking it over?</div>
      <div style="font-family:${BODY_FONT};font-size:14px;line-height:1.65;color:#5E4A44;">
        Namaste — you left a few pieces sparkling in your cart. They're still saved for you.
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;border-top:1px solid #F3E3C7;padding-top:10px;">
        ${rowsHtml}
        <tr>
          <td style="font-family:${BODY_FONT};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#8A7365;padding:14px 0 0;border-top:1px solid #F3E3C7;">Cart total</td>
          <td style="font-family:${HEADING_FONT};font-size:20px;color:#2A0A12;padding:14px 0 0;border-top:1px solid #F3E3C7;" align="right">${escapeHtml(total)}</td>
        </tr>
      </table>
      <div style="font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:#8A6D1E;background:#FBF3DE;border:1px solid #E7C98A;border-radius:3px;padding:12px 14px;margin-top:18px;">
        Cash on Delivery available — nothing to pay until it arrives.
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px auto 4px;">
        <tr><td style="background:#71182B;border-radius:2px;">
          <a href="${escapeHtml(input.cartUrl)}" style="display:inline-block;padding:12px 30px;font-family:${BODY_FONT};font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#F3E3C7;text-decoration:none;">Complete your order</a>
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
