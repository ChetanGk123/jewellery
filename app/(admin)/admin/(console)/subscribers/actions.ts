"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin/auth"
import type { AdminSubscriberRow } from "@/lib/admin/subscriber"
import { getAllSubscribers } from "@/lib/db/admin-subscribers"
import { createServerClient } from "@/lib/db/server"
import { ROUTES } from "@/lib/routes"

export type SubscriberActionResult = { ok: boolean; error?: string }

function messageFor(raw: string): string {
  if (raw.includes("NOT_ADMIN")) return "You don't have permission to do that."
  if (raw.includes("SUBSCRIBER_NOT_FOUND")) return "That subscriber is already gone."
  return "Couldn't remove the subscriber. Please try again."
}

/**
 * Remove one address from the mailing list through the admin-only
 * `admin_remove_subscriber` RPC (0017). The RPC re-checks admin and 404s a
 * missing row; the table stays RLS-sealed for writes.
 */
export async function removeSubscriber(id: string): Promise<SubscriberActionResult> {
  await requireAdmin(ROUTES.adminSubscribers)

  const supabase = await createServerClient()
  const { error } = await supabase.rpc("admin_remove_subscriber", {
    p_id: id,
  })

  if (error) return { ok: false, error: messageFor(error.message) }

  revalidatePath(ROUTES.adminSubscribers)
  return { ok: true }
}

/**
 * The full mailing list for the Copy emails / Export CSV bulk actions. The list
 * table itself paginates (5.10), so these actions read the whole list on demand
 * — behind the admin gate + admin-read RLS, capped in `getAllSubscribers`.
 */
export async function exportSubscribers(): Promise<AdminSubscriberRow[]> {
  await requireAdmin(ROUTES.adminSubscribers)
  return getAllSubscribers()
}
