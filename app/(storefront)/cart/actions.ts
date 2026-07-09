"use server"

import { z } from "zod"
import { createServerClient, getCurrentUser } from "@/lib/db/server"

/**
 * Cart-snapshot sync (TASKS 6.19). The cart lives in localStorage; this mirrors
 * it server-side for signed-in customers so the abandoned-cart cron can see
 * idle carts. Best-effort fire-and-forget: a sync hiccup must never surface in
 * the shopping flow, and anonymous visitors are skipped entirely (no address
 * to remind). The `sync_cart` RPC (0041) re-sanitizes every field regardless.
 */

const syncItemsSchema = z
  .array(
    z.object({
      name: z.string().min(1).max(120),
      slug: z.string().max(120).nullable(),
      qty: z.number().int().min(1).max(10),
      unitPricePaise: z.number().int().min(0),
      tone: z.string().max(40).nullable(),
    }),
  )
  .max(50)

export async function syncCart(input: unknown): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  const parsed = syncItemsSchema.safeParse(input)
  if (!parsed.success) return

  const supabase = await createServerClient()
  const { error } = await supabase.rpc("sync_cart", {
    p_items: parsed.data.map((it) => ({
      name: it.name,
      slug: it.slug,
      qty: it.qty,
      unit_price_paise: it.unitPricePaise,
      tone: it.tone,
    })),
  })
  if (error) {
    console.error("sync_cart failed:", error.message)
  }
}
