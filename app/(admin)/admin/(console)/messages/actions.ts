"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin/auth"
import type { MessageStatus } from "@/lib/admin/message"
import { createServerClient } from "@/lib/db/server"
import { ROUTES } from "@/lib/routes"

export type MessageActionResult = { ok: boolean; error?: string }

function messageFor(raw: string): string {
  if (raw.includes("NOT_ADMIN")) return "You don't have permission to do that."
  if (raw.includes("MESSAGE_NOT_FOUND")) return "That message no longer exists."
  if (raw.includes("INVALID_STATUS")) return "Pick a valid status."
  return "Couldn't update the message. Please try again."
}

/**
 * Move a contact ticket along the New → In Progress → Resolved flow (and back
 * on reopen) through the admin-only `admin_set_message_status` RPC (0015). The
 * RPC re-checks admin + a valid status; the table stays RLS-sealed for writes.
 */
export async function setMessageStatus(
  id: string,
  status: MessageStatus,
): Promise<MessageActionResult> {
  await requireAdmin(ROUTES.adminMessages)

  const supabase = await createServerClient()
  const { error } = await supabase.rpc("admin_set_message_status", {
    p_id: id,
    p_status: status,
  })

  if (error) return { ok: false, error: messageFor(error.message) }

  revalidatePath(ROUTES.adminMessages)
  return { ok: true }
}
