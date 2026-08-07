/**
 * Client-safe Emails-form schema + mappers (TASKS 7.4). Shared by the client
 * `EmailsView` (form state + live preview) and the `updateEmailCopy` server
 * action (validates + builds the RPC payload) so the two can't drift — the
 * `lib/admin/settings.ts` pattern.
 *
 * Every field is optional text: empty = "use the code default" (the form shows
 * defaults as placeholders). The payload sends COMPLETE per-template objects,
 * so the RPC's top-level shallow merge replaces each edited template wholesale
 * and clearing a field genuinely resets it to the default.
 */

import { z } from "zod"
import type { Json } from "@/lib/db/types"
import { EMAIL_COPY_DEFAULTS } from "@/lib/email/copy"

/** Subjects/headings/labels stay short; intros/notices/bodies get more room. */
const line = z.string().trim().max(200)
const paragraph = z.string().trim().max(600)

const orderConfirmationSchema = z.object({
  subject: line,
  heading: line,
  intro: paragraph,
  codNotice: paragraph,
  button: line,
})

const statusKindSchema = z.object({
  subject: line,
  heading: line,
  intro: paragraph,
  totalLabel: line,
  note: paragraph,
  button: line,
})

/** The return-flow kinds share one field shape (8.7e — no total label). */
const returnKindSchema = z.object({
  subject: line,
  heading: line,
  intro: paragraph,
  note: paragraph,
  button: line,
})

export const emailCopyFormSchema = z.object({
  orderConfirmation: orderConfirmationSchema,
  orderConfirmed: statusKindSchema,
  orderShipped: statusKindSchema,
  orderDelivered: statusKindSchema,
  orderCancelled: statusKindSchema,
  returnRequested: returnKindSchema,
  returnApproved: returnKindSchema,
  returnRejected: returnKindSchema,
  returnRefunded: returnKindSchema,
  returnExchanged: returnKindSchema,
  adminAlert: z.object({ subject: line, heading: line, button: line }),
  returnAdminAlert: z.object({ subject: line, heading: line, button: line }),
  abandonedCart: z.object({
    subject: line,
    heading: line,
    intro: paragraph,
    notice: paragraph,
    button: line,
  }),
  subscriberWelcome: z.object({
    subject: line,
    heading: line,
    body: paragraph,
    button: line,
  }),
  dailyDigest: z.object({ subject: line, heading: line, button: line }),
})

export type EmailCopyFormValues = z.infer<typeof emailCopyFormSchema>

/** Coerce an unknown JSON value into a plain record (empty on mismatch). */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/** A SAVED override for the form: trimmed non-empty string, else "" (unset). */
function savedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/** One template group: saved overrides only — defaults stay placeholders. */
function groupValues<T extends Record<string, string>>(defaults: T, raw: unknown): T {
  const record = asRecord(raw)
  return Object.fromEntries(
    Object.keys(defaults).map((key) => [key, savedString(record[key])]),
  ) as T
}

/** Seed the Emails form from the raw saved `email_copy` blob (7.3 read). */
export function emailCopyToFormValues(raw: unknown): EmailCopyFormValues {
  const record = asRecord(raw)
  return {
    orderConfirmation: groupValues(EMAIL_COPY_DEFAULTS.orderConfirmation, record.orderConfirmation),
    orderConfirmed: groupValues(EMAIL_COPY_DEFAULTS.orderConfirmed, record.orderConfirmed),
    orderShipped: groupValues(EMAIL_COPY_DEFAULTS.orderShipped, record.orderShipped),
    orderDelivered: groupValues(EMAIL_COPY_DEFAULTS.orderDelivered, record.orderDelivered),
    orderCancelled: groupValues(EMAIL_COPY_DEFAULTS.orderCancelled, record.orderCancelled),
    returnRequested: groupValues(EMAIL_COPY_DEFAULTS.returnRequested, record.returnRequested),
    returnApproved: groupValues(EMAIL_COPY_DEFAULTS.returnApproved, record.returnApproved),
    returnRejected: groupValues(EMAIL_COPY_DEFAULTS.returnRejected, record.returnRejected),
    returnRefunded: groupValues(EMAIL_COPY_DEFAULTS.returnRefunded, record.returnRefunded),
    returnExchanged: groupValues(EMAIL_COPY_DEFAULTS.returnExchanged, record.returnExchanged),
    adminAlert: groupValues(EMAIL_COPY_DEFAULTS.adminAlert, record.adminAlert),
    returnAdminAlert: groupValues(EMAIL_COPY_DEFAULTS.returnAdminAlert, record.returnAdminAlert),
    abandonedCart: groupValues(EMAIL_COPY_DEFAULTS.abandonedCart, record.abandonedCart),
    subscriberWelcome: groupValues(EMAIL_COPY_DEFAULTS.subscriberWelcome, record.subscriberWelcome),
    dailyDigest: groupValues(EMAIL_COPY_DEFAULTS.dailyDigest, record.dailyDigest),
  }
}

/**
 * Build the `email_copy` value for the `admin_update_settings` payload.
 * Values are already trimmed by the schema; empty strings are kept
 * deliberately (see module doc: clearing = reset to default).
 */
export function formValuesToEmailCopyPayload(values: EmailCopyFormValues): Json {
  return Object.fromEntries(
    Object.entries(values).map(([templateId, group]) => [templateId, { ...group }]),
  )
}
