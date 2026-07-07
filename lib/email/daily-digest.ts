/**
 * Daily digest email for the operator (TASKS 5.17): yesterday's orders,
 * revenue, cancelled count, the pending queue and low-stock products, sent at
 * close of day by the cron route. Pure template — same email-client
 * constraints as the other builders; all product-derived fields escaped.
 */

import { type EmailMessage, escapeHtml } from "./order-confirmation";
import { STORE_INFO } from "@/lib/store-info";
import { formatPaise } from "@/lib/utils/money";

export type DigestLowStockRow = { name: string; sku: string; stock: number };

export type DailyDigestEmailInput = {
  /** The IST calendar day the digest covers, e.g. "2026-07-06". */
  dateIso: string;
  /** Orders placed that day, all statuses. */
  orders: number;
  /** How many of those are cancelled (excluded from revenue). */
  cancelled: number;
  revenuePaise: number;
  /** Current pending queue — the "needs action tomorrow" number. */
  pendingOrders: number;
  lowStockCount: number;
  /** Worst offenders (lowest stock first, capped by the RPC). */
  lowStock: DigestLowStockRow[];
  /** Absolute URL of the admin dashboard. */
  adminUrl: string;
};

const HEADING_FONT = "Georgia, 'Times New Roman', serif";
const BODY_FONT = "'Segoe UI', Helvetica, Arial, sans-serif";

/** "2026-07-06" → "06 Jul 2026" (plain calendar date, no timezone math). */
function dateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Build the close-of-day digest. */
export function buildDailyDigestEmail(
  input: DailyDigestEmailInput,
): EmailMessage {
  const day = dateLabel(input.dateIso);
  const revenue = formatPaise(input.revenuePaise);
  const orders = `${input.orders} order${input.orders === 1 ? "" : "s"}`;
  const cancelledNote =
    input.cancelled > 0 ? ` (${input.cancelled} cancelled)` : "";

  const subject = `Daily digest — ${day}: ${orders}, ${revenue}`;

  const stockLines =
    input.lowStock.length > 0
      ? input.lowStock.map((p) => `• ${p.name} (${p.sku}) — ${p.stock} left`)
      : ["No low-stock products."];

  const text = [
    `${STORE_INFO.name} — daily digest for ${day}`,
    "",
    `Orders: ${orders}${cancelledNote}`,
    `Revenue: ${revenue}`,
    `Pending queue: ${input.pendingOrders}`,
    `Low stock (${input.lowStockCount}):`,
    ...stockLines,
    "",
    `Open the dashboard: ${input.adminUrl}`,
  ].join("\n");

  const kpiRows: Array<[string, string]> = [
    ["Orders", `${orders}${cancelledNote}`],
    ["Revenue", revenue],
    ["Pending queue", String(input.pendingOrders)],
    ["Low stock", String(input.lowStockCount)],
  ];

  const kpiHtml = kpiRows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="font-family:${BODY_FONT};font-size:12px;letter-spacing:.5px;text-transform:uppercase;color:#8A7365;padding:8px 12px 8px 0;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="font-family:${BODY_FONT};font-size:14px;color:#2A0A12;padding:8px 0;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const stockHtml = stockLines
    .map(
      (line) =>
        `<div style="font-family:${BODY_FONT};font-size:13px;color:#5E4A40;padding:3px 0;">${escapeHtml(line)}</div>`,
    )
    .join("");

  const html = `
<div style="margin:0;padding:32px 12px;background:#F5F1EA;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
    <tr><td align="center" style="padding-bottom:18px;font-family:${HEADING_FONT};font-size:20px;letter-spacing:2px;color:#2A0A12;">
      ${escapeHtml(STORE_INFO.wordmark)} · Admin
    </td></tr>
    <tr><td style="background:#FFFFFF;border:1px solid #EAE3D7;border-radius:10px;padding:26px 28px;">
      <div style="font-family:${HEADING_FONT};font-size:22px;color:#71182B;padding-bottom:12px;">Daily digest · ${escapeHtml(day)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0">${kpiHtml}</table>
      <div style="font-family:${BODY_FONT};font-size:12px;letter-spacing:.5px;text-transform:uppercase;color:#8A7365;padding:16px 0 4px;">Low stock</div>
      ${stockHtml}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 2px;">
        <tr><td style="background:#71182B;border-radius:8px;">
          <a href="${escapeHtml(input.adminUrl)}" style="display:inline-block;padding:11px 26px;font-family:${BODY_FONT};font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#F3E3C7;text-decoration:none;">Open dashboard</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;

  return { subject, html, text };
}
