/**
 * Order status-change emails (TASKS 5.2): Shipped / Delivered / Cancelled
 * customer notifications — the deliberate 4.6 deferrals. Pure (no server-only
 * deps) so it unit-tests without a mail provider. Same email-client constraints
 * as `order-confirmation.ts`: inline styles, table layout, system font stack.
 */

import { type EmailMessage, escapeHtml } from "./order-confirmation";
import { STORE_INFO } from "@/lib/store-info";
import { formatPaise } from "@/lib/utils/money";

/** The three order statuses that notify the customer (audit C2). */
export type OrderStatusEmailKind = "Shipped" | "Delivered" | "Cancelled";

export type OrderStatusEmailInput = {
  kind: OrderStatusEmailKind;
  orderNo: string;
  customerName: string;
  totalPaise: number;
  /** Absolute URL of the order page. */
  orderUrl: string;
};

const HEADING_FONT = "Georgia, 'Times New Roman', serif";
const BODY_FONT = "'Segoe UI', Helvetica, Arial, sans-serif";

type Copy = {
  subjectWord: string;
  heading: string;
  intro: (orderNo: string) => string;
  totalLabel: string;
  note: string;
  accent: string;
};

const COPY: Record<OrderStatusEmailKind, Copy> = {
  Shipped: {
    subjectWord: "shipped",
    heading: "Your order is on its way!",
    intro: (o) => `Good news — order ${o} has been shipped and is on its way.`,
    totalLabel: "Amount payable · Cash on Delivery",
    note: "Please keep the amount ready — our courier collects payment in cash on delivery.",
    accent: "#71182B",
  },
  Delivered: {
    subjectWord: "delivered",
    heading: "Delivered — thank you!",
    intro: (o) =>
      `Order ${o} has been delivered. We hope you love your new piece.`,
    totalLabel: "Order total · paid on delivery",
    note: "If anything isn't right, just reply to this email or WhatsApp us — we're happy to help.",
    accent: "#15692F",
  },
  Cancelled: {
    subjectWord: "cancelled",
    heading: "Your order was cancelled",
    intro: (o) =>
      `Order ${o} has been cancelled. As this was Cash on Delivery, you haven't been charged.`,
    totalLabel: "Cancelled order total",
    note: "Changed your mind? Your favourites are waiting — browse the collection anytime.",
    accent: "#C0392F",
  },
};

/**
 * Build a status-change message. The customer name is HTML-escaped; the total
 * is formatted from integer paise at this UI boundary.
 */
export function buildOrderStatusEmail(
  input: OrderStatusEmailInput,
): EmailMessage {
  const copy = COPY[input.kind];
  const total = formatPaise(input.totalPaise);
  const name = input.customerName.trim() || "there";
  const intro = copy.intro(input.orderNo);

  const subject = `Order ${input.orderNo} ${copy.subjectWord} — ${STORE_INFO.name}`;

  const text = [
    `Namaste ${name},`,
    "",
    intro,
    "",
    `${copy.totalLabel}: ${total}`,
    copy.note,
    "",
    `View your order: ${input.orderUrl}`,
    "",
    `Questions? WhatsApp us at ${STORE_INFO.phone.display} or reply to this email.`,
    `— ${STORE_INFO.name}`,
  ].join("\n");

  const html = `
<div style="margin:0;padding:32px 12px;background:#FBF6EE;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
    <tr><td align="center" style="padding-bottom:22px;">
      <div style="font-family:${HEADING_FONT};font-size:26px;letter-spacing:3px;color:#2A0A12;">${escapeHtml(STORE_INFO.wordmark)}</div>
      <div style="font-family:${BODY_FONT};font-size:11px;letter-spacing:2px;color:#A87A1E;text-transform:uppercase;padding-top:4px;">${escapeHtml(STORE_INFO.descriptor)}</div>
    </td></tr>
    <tr><td style="background:#FFFDF8;border:1px solid #E7D9C2;border-radius:3px;padding:34px 34px 30px;">
      <div style="font-family:${HEADING_FONT};font-size:24px;color:${copy.accent};padding-bottom:10px;">${escapeHtml(copy.heading)}</div>
      <div style="font-family:${BODY_FONT};font-size:14px;line-height:1.65;color:#5E4A44;">
        Namaste ${escapeHtml(name)}, ${escapeHtml(intro)}
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;border-top:1px solid #F3E3C7;">
        <tr><td style="font-family:${BODY_FONT};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#8A7365;padding:16px 0 4px;">${escapeHtml(copy.totalLabel)}</td></tr>
        <tr><td style="font-family:${HEADING_FONT};font-size:22px;color:#2A0A12;padding-bottom:18px;">${escapeHtml(total)}</td></tr>
      </table>
      <div style="font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:#5E4A44;background:#FBF3DE;border:1px solid #E7C98A;border-radius:3px;padding:12px 14px;">
        ${escapeHtml(copy.note)}
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px auto 4px;">
        <tr><td style="background:${copy.accent};border-radius:2px;">
          <a href="${escapeHtml(input.orderUrl)}" style="display:inline-block;padding:12px 30px;font-family:${BODY_FONT};font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#F3E3C7;text-decoration:none;">View your order</a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding-top:20px;font-family:${BODY_FONT};font-size:12px;line-height:1.7;color:#8A7365;">
      Questions? WhatsApp us at ${escapeHtml(STORE_INFO.phone.display)} or reply to this email.<br/>
      ${escapeHtml(STORE_INFO.address.line)}
    </td></tr>
  </table>
</div>`;

  return { subject, html, text };
}
