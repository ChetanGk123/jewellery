import "server-only";
import { after } from "next/server";
import {
  buildOrderConfirmationEmail,
  type EmailMessage,
  type OrderConfirmationEmailInput,
} from "./order-confirmation";
import { ROUTES } from "@/lib/routes";
import { SITE_URL } from "@/lib/site-url";
import { STORE_INFO } from "@/lib/store-info";

/**
 * Transactional email via the Resend REST API (TASKS 4.6). Deliberately a
 * plain authenticated POST — one endpoint doesn't warrant the vendor SDK.
 *
 * Degrades to a no-op when RESEND_API_KEY isn't configured (local dev, CI):
 * checkout must never depend on email. Every failure is logged, never thrown.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;

/**
 * Sender identity. Resend requires a verified domain for real addresses;
 * `onboarding@resend.dev` works out of the box but only delivers to the
 * account owner's inbox — set EMAIL_FROM once the domain is verified.
 */
const FROM =
  process.env.EMAIL_FROM ?? `${STORE_INFO.name} <onboarding@resend.dev>`;

/** True when a provider key is configured (drives the confirmation-page copy). */
export function isEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Deliver one message. Best-effort: logs and swallows every failure. */
async function sendEmail(to: string, message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

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
    });

    if (!response.ok) {
      console.error(
        `email send failed (${response.status})`,
        await response.text().catch(() => ""),
      );
    }
  } catch (error: unknown) {
    console.error("email send failed", error);
  }
}

export type QueueOrderConfirmationInput = Omit<
  OrderConfirmationEmailInput,
  "orderUrl"
> & { to: string };

/**
 * Queue the order-confirmation email to run after the checkout response is
 * sent (`after()`), so the customer never waits on the mail provider. Falls
 * back to a detached send outside a request scope (unit tests). Never throws —
 * an email hiccup must not fail an already-placed order.
 */
export function queueOrderConfirmationEmail(
  input: QueueOrderConfirmationInput,
): void {
  if (!isEmailEnabled()) return;

  const { to, ...fields } = input;
  const message = buildOrderConfirmationEmail({
    ...fields,
    orderUrl: `${SITE_URL}${ROUTES.order(input.orderNo)}`,
  });

  try {
    after(() => sendEmail(to, message));
  } catch {
    // No request scope (e.g. tests) — send detached instead.
    void sendEmail(to, message);
  }
}
