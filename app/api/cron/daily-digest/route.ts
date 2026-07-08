import { NextResponse } from "next/server"
import { z } from "zod"
import { publicClient } from "@/lib/db/public"
import { sendDailyDigestEmailNow } from "@/lib/email/send"

/**
 * Close-of-day digest trigger (TASKS 5.17). Hit by the deploy scheduler once
 * a day after IST close, e.g.:
 *
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *     https://<host>/api/cron/daily-digest
 *
 * Two gates share one secret: the route checks the bearer against CRON_SECRET
 * (env), and the `get_daily_digest` RPC (0029) re-checks the same value
 * against the sealed `app_secret` row — so neither a leaked URL nor a direct
 * PostgREST call gets data without it. The RPC returns aggregates only.
 */

/** The RPC's jsonb payload — validated, never trusted blindly. */
const digestSchema = z.object({
  date: z.string(),
  orders: z.number(),
  cancelled: z.number(),
  revenue_paise: z.number(),
  pending_orders: z.number(),
  low_stock_count: z.number(),
  low_stock: z.array(
    z.object({
      name: z.string(),
      sku: z.string(),
      stock: z.number(),
    }),
  ),
})

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

  const { data, error } = await publicClient.rpc("get_daily_digest", {
    p_secret: secret,
  })
  if (error) {
    console.error("[cron] daily digest RPC failed:", error.message)
    return NextResponse.json({ ok: false, error: "Digest query failed." }, { status: 502 })
  }

  const parsed = digestSchema.safeParse(data)
  if (!parsed.success) {
    console.error("[cron] daily digest payload malformed:", parsed.error)
    return NextResponse.json({ ok: false, error: "Digest payload malformed." }, { status: 502 })
  }

  const d = parsed.data
  const sent = await sendDailyDigestEmailNow({
    dateIso: d.date,
    orders: d.orders,
    cancelled: d.cancelled,
    revenuePaise: d.revenue_paise,
    pendingOrders: d.pending_orders,
    lowStockCount: d.low_stock_count,
    lowStock: d.low_stock,
  })

  if (!sent) {
    // isEmailEnabled() false or the provider rejected — surface it to the cron.
    return NextResponse.json(
      { ok: false, date: d.date, error: "Email send failed or disabled." },
      { status: 502 },
    )
  }
  return NextResponse.json({ ok: true, date: d.date, orders: d.orders })
}
