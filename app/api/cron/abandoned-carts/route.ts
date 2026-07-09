import { NextResponse } from "next/server"
import { z } from "zod"
import { publicClient } from "@/lib/db/public"
import { sendAbandonedCartEmailNow } from "@/lib/email/send"

/**
 * Abandoned-cart reminder trigger (TASKS 6.19). Hit by the deploy scheduler a
 * few times a day, e.g.:
 *
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *     https://<host>/api/cron/abandoned-carts
 *
 * Same two-gate model as the daily digest (5.17): the route checks the bearer
 * against CRON_SECRET (env), and the `get_abandoned_carts` /
 * `mark_carts_reminded` RPCs (0041) re-check the same value against the sealed
 * `app_secret` row. Each cart is reminded ONCE per abandonment — the RPC
 * suppresses rows whose `reminded_at` postdates the last cart activity, and
 * only carts whose email actually sent are marked, so a failed send retries
 * on the next run.
 */

const cartsSchema = z.array(
  z.object({
    user_id: z.string(),
    email: z.string(),
    items: z.array(
      z.object({
        name: z.string(),
        slug: z.string().nullable(),
        qty: z.number(),
        unit_price_paise: z.number(),
        tone: z.string().nullable(),
      }),
    ),
    updated_at: z.string(),
  }),
)

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured." },
      { status: 503 },
    )
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  }

  const { data, error } = await publicClient.rpc("get_abandoned_carts", {
    p_secret: secret,
  })
  if (error) {
    console.error("[cron] abandoned carts RPC failed:", error.message)
    return NextResponse.json({ ok: false, error: "Cart query failed." }, { status: 502 })
  }

  const parsed = cartsSchema.safeParse(data)
  if (!parsed.success) {
    console.error("[cron] abandoned carts payload malformed:", parsed.error)
    return NextResponse.json({ ok: false, error: "Cart payload malformed." }, { status: 502 })
  }

  const carts = parsed.data
  if (carts.length === 0) {
    return NextResponse.json({ ok: true, carts: 0, sent: 0 })
  }

  // Sequential sends (≤100/run): trivial volume, and it keeps the provider
  // from rate-limiting a burst. Only successful sends get marked reminded.
  const sentIds: string[] = []
  for (const cart of carts) {
    const sent = await sendAbandonedCartEmailNow({ to: cart.email, items: cart.items })
    if (sent) sentIds.push(cart.user_id)
  }

  if (sentIds.length > 0) {
    const { error: markError } = await publicClient.rpc("mark_carts_reminded", {
      p_secret: secret,
      p_user_ids: sentIds,
    })
    if (markError) {
      // Sends went out but the ledger write failed — the next run would
      // re-email these carts, so surface it loudly.
      console.error("[cron] mark_carts_reminded failed:", markError.message)
      return NextResponse.json(
        { ok: false, carts: carts.length, sent: sentIds.length, error: "Marking failed." },
        { status: 502 },
      )
    }
  }

  if (sentIds.length < carts.length) {
    return NextResponse.json(
      {
        ok: false,
        carts: carts.length,
        sent: sentIds.length,
        error: "Some sends failed or email is disabled.",
      },
      { status: 502 },
    )
  }
  return NextResponse.json({ ok: true, carts: carts.length, sent: sentIds.length })
}
