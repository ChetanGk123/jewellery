/**
 * Admin new-order alert email (TASKS 5.2 / audit C2). Sent to the store inbox
 * the moment a COD order is placed, so orders are pushed — not discovered by
 * polling the console. Pure template; same email-client constraints as the
 * customer emails.
 */

import { type EmailMessage, escapeHtml } from "./order-confirmation";
import { STORE_INFO } from "@/lib/store-info";
import { formatPaise } from "@/lib/utils/money";

export type NewOrderAdminEmailInput = {
  orderNo: string;
  customerName: string;
  city: string;
  state: string;
  itemCount: number;
  totalPaise: number;
  /** Absolute URL of the admin order queue. */
  adminUrl: string;
};

const HEADING_FONT = "Georgia, 'Times New Roman', serif";
const BODY_FONT = "'Segoe UI', Helvetica, Arial, sans-serif";

/** Build the internal new-order alert. All customer-derived fields escaped. */
export function buildNewOrderAdminEmail(
  input: NewOrderAdminEmailInput,
): EmailMessage {
  const total = formatPaise(input.totalPaise);
  const name = input.customerName.trim() || "A customer";
  const where = `${input.city}, ${input.state}`;
  const items = `${input.itemCount} item${input.itemCount === 1 ? "" : "s"}`;

  const subject = `New COD order ${input.orderNo} — ${total}`;

  const text = [
    `New order placed: ${input.orderNo}`,
    "",
    `Customer: ${name}`,
    `Deliver to: ${where}`,
    `Items: ${items}`,
    `Total (COD): ${total}`,
    "",
    `Process it in the console: ${input.adminUrl}`,
  ].join("\n");

  const rows: Array<[string, string]> = [
    ["Order", input.orderNo],
    ["Customer", name],
    ["Deliver to", where],
    ["Items", items],
    ["Total · COD", total],
  ];

  const rowHtml = rows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="font-family:${BODY_FONT};font-size:12px;letter-spacing:.5px;text-transform:uppercase;color:#8A7365;padding:8px 12px 8px 0;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="font-family:${BODY_FONT};font-size:14px;color:#2A0A12;padding:8px 0;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const html = `
<div style="margin:0;padding:32px 12px;background:#F5F1EA;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
    <tr><td align="center" style="padding-bottom:18px;font-family:${HEADING_FONT};font-size:20px;letter-spacing:2px;color:#2A0A12;">
      ${escapeHtml(STORE_INFO.wordmark)} · Admin
    </td></tr>
    <tr><td style="background:#FFFFFF;border:1px solid #EAE3D7;border-radius:10px;padding:26px 28px;">
      <div style="font-family:${HEADING_FONT};font-size:22px;color:#71182B;padding-bottom:12px;">New order placed</div>
      <table role="presentation" cellpadding="0" cellspacing="0">${rowHtml}</table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 2px;">
        <tr><td style="background:#71182B;border-radius:8px;">
          <a href="${escapeHtml(input.adminUrl)}" style="display:inline-block;padding:11px 26px;font-family:${BODY_FONT};font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#F3E3C7;text-decoration:none;">Open order queue</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;

  return { subject, html, text };
}
