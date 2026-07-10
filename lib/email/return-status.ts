/**
 * Return-flow emails (TASKS 8.7e): Requested / Approved / Rejected /
 * Refunded / Exchanged customer notifications, plus the internal new-return
 * alert. Pure (no server-only deps) so it unit-tests without a mail provider;
 * same email-client constraints as `order-status.ts` (inline styles, table
 * layout, system font stack). Verbiage lives in copy.ts / the operator's
 * saved overrides; the settlement details (refund amount, UTR, ship-to
 * address, shipping-payer note, rejection note) are DATA rendered
 * structurally here.
 */

import {
  type AdminAlertCopy,
  DEFAULT_EMAIL_COPY,
  type EmailCopy,
  type EmailTemplateId,
  escapeHtml,
  renderCopy,
  renderCopyHtml,
  type ReturnStatusKindCopy,
} from "./copy"
import type { EmailMessage } from "./order-confirmation"
import { DEFAULT_STORE_INFO, type ResolvedStoreInfo } from "@/lib/store-info"
import { formatPaise } from "@/lib/utils/money"

export type ReturnEmailKind = "Requested" | "Approved" | "Rejected" | "Refunded" | "Exchanged"

export type ReturnStatusEmailInput = {
  kind: ReturnEmailKind
  orderNo: string
  customerName: string
  /** Absolute URL of the signed-in account order page (where returns live). */
  orderUrl: string
  /** What the customer asked for — labels the request in the email body. */
  resolution: "refund" | "exchange" | string
  /** Approved: the who-pays-shipping note from the returns settings. */
  shippingNote?: string
  /** Refunded: what was paid + the UPI reference (UTR). */
  refundAmountPaise?: number | null
  refundReference?: string | null
  /** Rejected: the operator's note, shown verbatim (escaped). */
  operatorNote?: string | null
}

const HEADING_FONT = "Georgia, 'Times New Roman', serif"
const BODY_FONT = "'Segoe UI', Helvetica, Arial, sans-serif"

/** Per-kind structure that is NOT verbiage (mirrors order-status KIND_META). */
const KIND_META: Record<ReturnEmailKind, { copyKey: EmailTemplateId; accent: string }> = {
  Requested: { copyKey: "returnRequested", accent: "#B7791F" },
  Approved: { copyKey: "returnApproved", accent: "#1B6FA8" },
  Rejected: { copyKey: "returnRejected", accent: "#C0392F" },
  Refunded: { copyKey: "returnRefunded", accent: "#15692F" },
  Exchanged: { copyKey: "returnExchanged", accent: "#A87A1E" },
}

/** The saved copy group for one return kind (send-path convenience). */
export function returnStatusCopyFor(copy: EmailCopy, kind: ReturnEmailKind): ReturnStatusKindCopy {
  return copy[KIND_META[kind].copyKey] as ReturnStatusKindCopy
}

/**
 * Build a return-flow message. Customer-derived fields are escaped; money is
 * formatted from integer paise at this UI boundary.
 */
export function buildReturnStatusEmail(
  input: ReturnStatusEmailInput,
  info: ResolvedStoreInfo = DEFAULT_STORE_INFO,
  copy?: ReturnStatusKindCopy,
): EmailMessage {
  const meta = KIND_META[input.kind]
  const kindCopy = copy ?? (DEFAULT_EMAIL_COPY[meta.copyKey] as ReturnStatusKindCopy)
  const name = input.customerName.trim() || "there"
  const vars = { name, orderNo: input.orderNo }

  const subject = renderCopy(kindCopy.subject, { orderNo: input.orderNo, storeName: info.name })
  const intro = renderCopy(kindCopy.intro, vars)
  const requestedLabel = input.resolution === "refund" ? "Refund to UPI" : "Exchange"

  // Approved: where to send the parcel + who pays (settings-driven data).
  const shipTo = input.kind === "Approved" ? info.address.line : ""
  const shippingNote = input.kind === "Approved" ? (input.shippingNote ?? "") : ""

  // Refunded: the payout record.
  const refundAmount =
    input.kind === "Refunded" && typeof input.refundAmountPaise === "number"
      ? formatPaise(input.refundAmountPaise)
      : ""
  const refundRef = input.kind === "Refunded" ? (input.refundReference ?? "").trim() : ""

  // Rejected: the operator's reason, when they wrote one.
  const operatorNote = input.kind === "Rejected" ? (input.operatorNote ?? "").trim() : ""

  const text = [
    intro,
    "",
    `Requested resolution: ${requestedLabel}`,
    ...(shipTo ? ["", `Ship the piece to: ${shipTo}`, ...(shippingNote ? [shippingNote] : [])] : []),
    ...(refundAmount
      ? ["", `Refund paid: ${refundAmount}`, ...(refundRef ? [`UPI reference (UTR): ${refundRef}`] : [])]
      : []),
    ...(operatorNote ? ["", `Note from the store: ${operatorNote}`] : []),
    "",
    kindCopy.note,
    "",
    `${renderCopy(kindCopy.button, {})}: ${input.orderUrl}`,
    "",
    `Questions? WhatsApp us at ${info.phone.display} or reply to this email.`,
    `— ${info.name}`,
  ].join("\n")

  const shipToHtml = shipTo
    ? `
      <div style="font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:#5E4A44;border:1px solid #E7D9C2;border-radius:3px;padding:12px 14px;margin-bottom:12px;">
        <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#8A7365;padding-bottom:4px;">Ship the piece to</div>
        <strong style="color:#2A0A12;">${escapeHtml(shipTo)}</strong>
        ${shippingNote ? `<div style="padding-top:6px;">${escapeHtml(shippingNote)}</div>` : ""}
      </div>`
    : ""

  const refundHtml = refundAmount
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border-top:1px solid #F3E3C7;">
        <tr><td style="font-family:${BODY_FONT};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#8A7365;padding:14px 0 4px;">Refund paid</td></tr>
        <tr><td style="font-family:${HEADING_FONT};font-size:22px;color:#15692F;">${escapeHtml(refundAmount)}</td></tr>
        ${refundRef ? `<tr><td style="font-family:${BODY_FONT};font-size:12px;color:#5E4A44;padding-top:4px;">UPI reference (UTR): ${escapeHtml(refundRef)}</td></tr>` : ""}
      </table>`
    : ""

  const operatorNoteHtml = operatorNote
    ? `
      <div style="font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:#8A2E3A;background:#FBEAEC;border:1px solid #E0B7B2;border-radius:3px;padding:12px 14px;margin-bottom:12px;">
        ${escapeHtml(operatorNote)}
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
      <div style="font-family:${BODY_FONT};font-size:14px;line-height:1.65;color:#5E4A44;padding-bottom:16px;">
        ${renderCopyHtml(kindCopy.intro, vars)}
      </div>
      <div style="font-family:${BODY_FONT};font-size:12px;color:#8A7365;padding-bottom:16px;">
        Requested resolution: <strong style="color:#2A0A12;">${escapeHtml(requestedLabel)}</strong>
      </div>
      ${shipToHtml}${refundHtml}${operatorNoteHtml}
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

export type ReturnAdminEmailInput = {
  orderNo: string
  customerName: string
  resolution: "refund" | "exchange" | string
  reason: string
  /** Absolute URL of the admin returns queue. */
  adminUrl: string
}

/** Build the internal new-return alert (mirrors `buildNewOrderAdminEmail`). */
export function buildReturnAdminEmail(
  input: ReturnAdminEmailInput,
  info: ResolvedStoreInfo = DEFAULT_STORE_INFO,
  copy: AdminAlertCopy = DEFAULT_EMAIL_COPY.returnAdminAlert,
): EmailMessage {
  const name = input.customerName.trim() || "A customer"
  const resolution = input.resolution === "refund" ? "Refund to UPI" : "Exchange"
  const subject = renderCopy(copy.subject, { orderNo: input.orderNo, resolution })

  const text = [
    `${renderCopy(copy.heading, {})}: ${input.orderNo}`,
    "",
    `Customer: ${name}`,
    `Asking for: ${resolution}`,
    `Reason: ${input.reason}`,
    "",
    `Review it in the console: ${input.adminUrl}`,
  ].join("\n")

  const rows: Array<[string, string]> = [
    ["Order", input.orderNo],
    ["Customer", name],
    ["Asking for", resolution],
    ["Reason", input.reason],
  ]
  const rowHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="font-family:${BODY_FONT};font-size:12px;color:#8A7365;padding:5px 14px 5px 0;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="font-family:${BODY_FONT};font-size:13px;color:#2A1F1A;padding:5px 0;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("")

  const html = `
<div style="margin:0;padding:28px 12px;background:#F6F1E8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
    <tr><td align="center" style="padding-bottom:18px;font-family:${HEADING_FONT};font-size:20px;letter-spacing:2px;color:#2A0A12;">
      ${escapeHtml(info.wordmark)} · Admin
    </td></tr>
    <tr><td style="background:#FFFFFF;border:1px solid #EAE3D7;border-radius:8px;padding:26px 28px;">
      <div style="font-family:${HEADING_FONT};font-size:20px;color:#71182B;padding-bottom:12px;">${renderCopyHtml(copy.heading, {})}</div>
      <table role="presentation" cellpadding="0" cellspacing="0">${rowHtml}</table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;">
        <tr><td style="background:#71182B;border-radius:4px;">
          <a href="${escapeHtml(input.adminUrl)}" style="display:inline-block;padding:11px 24px;font-family:${BODY_FONT};font-size:12.5px;letter-spacing:0.5px;color:#F3E3C7;text-decoration:none;">${renderCopyHtml(copy.button, {})}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`

  return { subject, html, text }
}
