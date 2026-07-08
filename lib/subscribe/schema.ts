/**
 * Shared newsletter-signup validation (TASKS 3.9) — used by BOTH the footer
 * NewsletterForm and the `subscribe` server action so the two can't drift. Pure
 * zod, no React / server-only deps. The `subscribe_email` RPC re-checks the
 * address at the write boundary since it's anon-callable.
 */

import { z } from "zod"

export const subscribeSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(120, "Email is too long."),
})

export type SubscribeValues = z.infer<typeof subscribeSchema>
