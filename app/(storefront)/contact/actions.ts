"use server";

import { z } from "zod";
import { contactMessageSchema } from "@/lib/contact/schema";
import { createServerClient } from "@/lib/db/server";
import { checkRateLimit, clientRateKey } from "@/lib/rate-limit";

type ContactField = "name" | "email" | "phone" | "subject" | "message";

export type ContactActionResult =
  | { ok: true; ticketNo: string }
  | {
      ok: false;
      /** Per-field messages keyed by form field, for inline display. */
      fieldErrors: Partial<Record<ContactField, string>>;
      /** A top-level message when the failure isn't field-specific. */
      formError?: string;
    };

/** The form fields plus the spam honeypot (see `Honeypot`). */
const submitInputSchema = z.object({
  values: z.unknown(),
  honeypot: z.string().optional(),
});

const DECLINE_MESSAGE =
  "We couldn't send your message just now. Please try again in a moment.";
const RATE_LIMITED_MESSAGE =
  "Too many messages sent — please try again in a few minutes.";

/** Contact throttle: at most 5 submissions per client per 10 minutes. */
const RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 } as const;

/**
 * Contact-form submit (TASKS 3.8). Re-validates the shared schema server-side,
 * drops obvious bots via the honeypot (like checkout), then hands the enquiry to
 * the `submit_contact_message` SECURITY DEFINER RPC, which mints the ticket
 * number and stores it as a New ticket. Returns the ticket number so the form
 * can confirm it. The RPC is the only write path (the table is RLS-sealed).
 */
export async function submitContactMessage(
  input: unknown,
): Promise<ContactActionResult> {
  const wrapper = submitInputSchema.safeParse(input);
  if (!wrapper.success) {
    return { ok: false, fieldErrors: {}, formError: DECLINE_MESSAGE };
  }

  // Bot check: a filled honeypot means it wasn't a human. Decline generically so
  // we don't hint at the trap, and never reach the DB.
  if (wrapper.data.honeypot && wrapper.data.honeypot.trim().length > 0) {
    return { ok: false, fieldErrors: {}, formError: DECLINE_MESSAGE };
  }

  const key = await clientRateKey("contact");
  if (!checkRateLimit(key, RATE_LIMIT).ok) {
    return { ok: false, fieldErrors: {}, formError: RATE_LIMITED_MESSAGE };
  }

  const parsed = contactMessageSchema.safeParse(wrapper.data.values);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const fieldErrors: Partial<Record<ContactField, string>> = {};
    for (const [key, messages] of Object.entries(flat)) {
      const first = messages?.[0];
      if (first) fieldErrors[key as ContactField] = first;
    }
    return {
      ok: false,
      fieldErrors,
      formError: "Please correct the highlighted fields and try again.",
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("submit_contact_message", {
    p_payload: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      subject: parsed.data.subject ?? null,
      message: parsed.data.message,
    },
  });

  if (error) {
    console.error("submit_contact_message failed", error);
    return { ok: false, fieldErrors: {}, formError: DECLINE_MESSAGE };
  }

  const ticketNo =
    data && typeof data === "object" && "ticket_no" in data
      ? String((data as { ticket_no: unknown }).ticket_no)
      : "";
  if (!ticketNo) {
    console.error("submit_contact_message returned an unexpected shape", data);
    return { ok: false, fieldErrors: {}, formError: DECLINE_MESSAGE };
  }

  return { ok: true, ticketNo };
}
