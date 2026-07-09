"use server"

import { revalidatePath, updateTag } from "next/cache"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"
import { emailCopyFormSchema, formValuesToEmailCopyPayload } from "@/lib/admin/email-copy"
import { CACHE_TAGS } from "@/lib/db/cache"
import { createServerClient } from "@/lib/db/server"
import { isEmailEnabled, sendTestTemplateEmailNow } from "@/lib/email/send"
import { checkRateLimit } from "@/lib/rate-limit"
import { ROUTES } from "@/lib/routes"

export type EmailCopyActionResult = { ok: boolean; error?: string }

/**
 * Save the operator's email verbiage (TASKS 7.4) through the admin-only
 * `admin_update_settings` RPC (0042 branch). Mirrors `updateStoreSettings`:
 * re-validates the shared schema server-side, then expires the settings tag so
 * the send path picks the new wording up immediately.
 */
export async function updateEmailCopy(values: unknown): Promise<EmailCopyActionResult> {
  await requireAdmin(ROUTES.adminEmails)

  const parsed = emailCopyFormSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, error: "Please correct the highlighted fields." }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.rpc("admin_update_settings", {
    p_payload: { email_copy: formValuesToEmailCopyPayload(parsed.data) },
  })

  if (error) {
    if (error.message.includes("NOT_ADMIN")) {
      return { ok: false, error: "You don't have permission to do that." }
    }
    return { ok: false, error: "Couldn't save the email copy. Please try again." }
  }

  updateTag(CACHE_TAGS.settings)
  revalidatePath(ROUTES.adminEmails)
  return { ok: true }
}

/** The template ids the test-send accepts — matches `EmailTemplateId`. */
const testTemplateSchema = z.enum([
  "orderConfirmation",
  "orderShipped",
  "orderDelivered",
  "orderCancelled",
  "adminAlert",
  "abandonedCart",
  "subscriberWelcome",
  "dailyDigest",
])

export type TestEmailResult = { ok: boolean; recipient?: string; error?: string }

/** Test sends are cheap but external — a small per-admin throttle suffices. */
const TEST_SEND_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 } as const

/**
 * Deliver one template (sample data + SAVED copy) to the store inbox, so the
 * operator can check real inbox rendering. Never takes a recipient — the
 * address is always the admin alert inbox, resolved server-side.
 */
export async function sendTestEmail(templateId: unknown): Promise<TestEmailResult> {
  const user = await requireAdmin(ROUTES.adminEmails)

  const parsed = testTemplateSchema.safeParse(templateId)
  if (!parsed.success) {
    return { ok: false, error: "Unknown email template." }
  }

  if (!isEmailEnabled()) {
    return {
      ok: false,
      error: "Email isn't configured — set RESEND_API_KEY to enable sending.",
    }
  }

  const limit = checkRateLimit(`test-email:${user.id}`, TEST_SEND_LIMIT)
  if (!limit.ok) {
    return {
      ok: false,
      error: `Too many test sends — try again in ${Math.ceil(limit.retryAfterSec / 60)} min.`,
    }
  }

  const { sent, to } = await sendTestTemplateEmailNow(parsed.data)
  if (!sent) {
    return { ok: false, error: "The mail provider declined the send — check the server logs." }
  }
  return { ok: true, recipient: to }
}
