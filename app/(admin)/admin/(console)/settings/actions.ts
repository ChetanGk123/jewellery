"use server"

import { revalidatePath, updateTag } from "next/cache"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"
import { CACHE_TAGS } from "@/lib/db/cache"
import { formValuesToPayload, settingsFormSchema } from "@/lib/admin/settings"
import { type PushSendReport, sendAdminPushNow } from "@/lib/push/send"
import {
  type SweepResult,
  sweepUnusedAdminImages,
  type UploadResult,
  uploadAdminImage,
} from "@/lib/db/admin-storage"
import { createServerClient } from "@/lib/db/server"
import { ROUTES } from "@/lib/routes"

export type SettingsActionResult = { ok: boolean; error?: string }
export type { SweepResult } from "@/lib/db/admin-storage"

/**
 * Storage housekeeping (Settings → Storage): remove bucket objects no product
 * or category references. Runs under the clicking admin's cookie session, so
 * the is_admin() Storage policies authorise the deletes.
 */
export async function sweepUnusedImages(): Promise<SweepResult> {
  await requireAdmin(ROUTES.adminSettings)
  return sweepUnusedAdminImages()
}

/**
 * Upload the homepage hero photo (9.3) through the shared admin Storage
 * pipeline; the returned URL is held in the Settings form and persisted onto
 * `setting.homepage_hero` by the normal Save.
 */
export async function uploadHeroImage(formData: FormData): Promise<UploadResult> {
  await requireAdmin(ROUTES.adminSettings)
  return uploadAdminImage(formData, "branding")
}

/** The browser's push subscription, as sent by the Notifications card (6.17). */
const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(400).optional(),
})

/**
 * Store this device's push subscription so the server can notify the admin of
 * new orders/messages/reviews. Goes through the is_admin()-gated
 * `admin_save_push_subscription` RPC (0038); the table itself is sealed.
 */
export async function savePushSubscription(input: unknown): Promise<SettingsActionResult> {
  await requireAdmin(ROUTES.adminSettings)

  const parsed = pushSubscriptionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "That subscription looks invalid. Please try again." }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.rpc("admin_save_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.p256dh,
    p_auth: parsed.data.auth,
    p_user_agent: parsed.data.userAgent ?? null,
  })
  if (error) {
    return { ok: false, error: "Couldn't enable notifications. Please try again." }
  }
  return { ok: true }
}

export type { PushSendReport } from "@/lib/push/send"

/**
 * Fire a real push at every subscribed device, immediately (no after() queue —
 * the admin is waiting on the outcome). Doubles as the diagnostic: the report
 * says exactly why nothing was delivered when config is incomplete.
 */
export async function sendTestPushNotification(): Promise<PushSendReport> {
  await requireAdmin(ROUTES.adminSettings)
  return sendAdminPushNow({
    title: "Test notification",
    body: "Push notifications are working — you'll be pinged like this for new orders.",
    url: ROUTES.adminSettings,
    tag: "test-notification",
  })
}

/** Forget this device's subscription ("Disable on this device"). */
export async function deletePushSubscription(endpoint: string): Promise<SettingsActionResult> {
  await requireAdmin(ROUTES.adminSettings)

  const supabase = await createServerClient()
  const { error } = await supabase.rpc("admin_delete_push_subscription", {
    p_endpoint: endpoint,
  })
  if (error) {
    return { ok: false, error: "Couldn't disable notifications. Please try again." }
  }
  return { ok: true }
}

/**
 * Save the store settings (TASKS 3.11) through the admin-only
 * `admin_update_settings` RPC (0018). Re-validates the shared schema
 * server-side, then revalidates the whole storefront layout so the banner,
 * homepage promo and shipping figures reflect the change live.
 */
export async function updateStoreSettings(values: unknown): Promise<SettingsActionResult> {
  await requireAdmin(ROUTES.adminSettings)

  const parsed = settingsFormSchema.safeParse(values)
  if (!parsed.success) {
    return { ok: false, error: "Please correct the highlighted fields." }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.rpc("admin_update_settings", {
    p_payload: formValuesToPayload(parsed.data),
  })

  if (error) {
    if (error.message.includes("NOT_ADMIN")) {
      return { ok: false, error: "You don't have permission to do that." }
    }
    return { ok: false, error: "Couldn't save settings. Please try again." }
  }

  // Settings are cached cross-request (TASKS 4.18) — expire the tag so the
  // banner/promo/shipping figures change live, plus re-render this admin page.
  updateTag(CACHE_TAGS.settings)
  revalidatePath("/", "layout")
  revalidatePath(ROUTES.adminSettings)
  return { ok: true }
}
