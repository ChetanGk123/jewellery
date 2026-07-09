"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin/auth"
import { type MessageStatus, normalizeResolutionNote } from "@/lib/admin/message"
import { createServerClient } from "@/lib/db/server"
import { ROUTES } from "@/lib/routes"

export type MessageActionResult = { ok: boolean; error?: string }

const NOTE_REQUIRED_MESSAGE = "Add a short note on how this was resolved."

function messageFor(raw: string): string {
  if (raw.includes("NOT_ADMIN")) return "You don't have permission to do that."
  if (raw.includes("MESSAGE_NOT_FOUND")) return "That message no longer exists."
  if (raw.includes("INVALID_STATUS")) return "Pick a valid status."
  if (raw.includes("RESOLUTION_NOTE_REQUIRED") || raw.includes("NOTE_TOO_LONG")) {
    return NOTE_REQUIRED_MESSAGE
  }
  return "Couldn't update the message. Please try again."
}

/**
 * Move a contact ticket along the New → In Progress → Resolved flow (and back
 * on reopen) through the admin-only `admin_set_message_status` RPC (0015/0040).
 * Resolving requires a summary note (6.13) — normalized here with the same rule
 * the RPC enforces; the RPC clears the note again on reopen. The table stays
 * RLS-sealed for writes.
 */
export async function setMessageStatus(
  id: string,
  status: MessageStatus,
  note?: string,
): Promise<MessageActionResult> {
  await requireAdmin(ROUTES.adminMessages)

  const resolutionNote = status === "Resolved" ? normalizeResolutionNote(note ?? "") : null
  if (status === "Resolved" && !resolutionNote) {
    return { ok: false, error: NOTE_REQUIRED_MESSAGE }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.rpc("admin_set_message_status", {
    p_id: id,
    p_status: status,
    ...(resolutionNote ? { p_note: resolutionNote } : {}),
  })

  if (error) return { ok: false, error: messageFor(error.message) }

  revalidatePath(ROUTES.adminMessages)
  return { ok: true }
}
