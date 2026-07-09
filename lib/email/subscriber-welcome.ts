/**
 * Newsletter welcome (TASKS 6.19): queued when a NEW address subscribes via
 * the footer form — the sign-up was silent before. Pure template; same
 * email-client constraints as the other builders. Sent once (the RPC de-dupes
 * re-subscribes as `alreadyMember`, which doesn't re-queue).
 */

import { DEFAULT_EMAIL_COPY, escapeHtml, renderCopy, renderCopyHtml, type SubscriberWelcomeCopy } from "./copy"
import type { EmailMessage } from "./order-confirmation"
import { DEFAULT_STORE_INFO, type ResolvedStoreInfo } from "@/lib/store-info"

export type SubscriberWelcomeEmailInput = {
  /** Absolute URL of the shop page. */
  shopUrl: string
}

const HEADING_FONT = "Georgia, 'Times New Roman', serif"
const BODY_FONT = "'Segoe UI', Helvetica, Arial, sans-serif"

/** Build the one-time welcome message. */
export function buildSubscriberWelcomeEmail(
  input: SubscriberWelcomeEmailInput,
  info: ResolvedStoreInfo = DEFAULT_STORE_INFO,
  copy: SubscriberWelcomeCopy = DEFAULT_EMAIL_COPY.subscriberWelcome,
): EmailMessage {
  const subject = renderCopy(copy.subject, { storeName: info.name })

  const text = [
    renderCopy(copy.body, { storeName: info.name }),
    "",
    `${renderCopy(copy.button, {})}: ${input.shopUrl}`,
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
      <div style="font-family:${HEADING_FONT};font-size:24px;color:#2A0A12;padding-bottom:10px;">${renderCopyHtml(copy.heading, {})}</div>
      <div style="font-family:${BODY_FONT};font-size:14px;line-height:1.65;color:#5E4A44;">
        ${renderCopyHtml(copy.body, { storeName: info.name })}
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px auto 4px;">
        <tr><td style="background:#71182B;border-radius:2px;">
          <a href="${escapeHtml(input.shopUrl)}" style="display:inline-block;padding:12px 30px;font-family:${BODY_FONT};font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#F3E3C7;text-decoration:none;">${renderCopyHtml(copy.button, {})}</a>
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
