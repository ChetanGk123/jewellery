"use server"

import { z } from "zod"
import { createServerClient } from "@/lib/db/server"
import { queueSubscriberWelcomeEmail } from "@/lib/email/send"
import { checkRateLimit, clientRateKey } from "@/lib/rate-limit"
import { subscribeSchema } from "@/lib/subscribe/schema"

export type SubscribeResult = { ok: true; alreadyMember: boolean } | { ok: false; error: string }

/** The email plus the spam honeypot (see `Honeypot`). */
const submitInputSchema = z.object({
  values: z.unknown(),
  honeypot: z.string().optional(),
})

const DECLINE_MESSAGE = "Couldn't sign you up just now. Please try again."
const RATE_LIMITED_MESSAGE = "Too many attempts — please try again shortly."

/** Newsletter throttle: at most 5 sign-up attempts per client per 10 minutes. */
const RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 } as const

/**
 * Footer newsletter subscribe (TASKS 3.9). Rate-limits per client IP, drops
 * bots via the honeypot (like checkout/contact), validates the shared schema
 * server-side, then hands the address to the `subscribe_email` SECURITY DEFINER
 * RPC — the only write path (the table is RLS-sealed). The RPC de-dupes
 * case-insensitively, so a re-subscribe succeeds as `alreadyMember`.
 */
export async function subscribe(input: unknown): Promise<SubscribeResult> {
  const wrapper = submitInputSchema.safeParse(input)
  if (!wrapper.success) return { ok: false, error: DECLINE_MESSAGE }

  // Bot check: a filled honeypot means it wasn't a human. Decline generically.
  if (wrapper.data.honeypot && wrapper.data.honeypot.trim().length > 0) {
    return { ok: false, error: DECLINE_MESSAGE }
  }

  const key = await clientRateKey("subscribe")
  if (!checkRateLimit(key, RATE_LIMIT).ok) {
    return { ok: false, error: RATE_LIMITED_MESSAGE }
  }

  const parsed = subscribeSchema.safeParse(wrapper.data.values)
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Enter a valid email address."
    return { ok: false, error: first }
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc("subscribe_email", {
    p_email: parsed.data.email,
    p_source: "footer",
  })

  if (error) {
    console.error("subscribe_email failed", error)
    return { ok: false, error: DECLINE_MESSAGE }
  }

  const status =
    data && typeof data === "object" && "status" in data
      ? String((data as { status: unknown }).status)
      : ""
  const alreadyMember = status === "already"

  // One-time welcome for NEW addresses (6.19) — re-subscribes stay silent.
  // Queued best-effort; a mail hiccup never fails the recorded sign-up.
  if (!alreadyMember) {
    await queueSubscriberWelcomeEmail(parsed.data.email)
  }

  return { ok: true, alreadyMember }
}
