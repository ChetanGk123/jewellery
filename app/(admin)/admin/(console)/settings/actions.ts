"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { formValuesToPayload, settingsFormSchema } from "@/lib/admin/settings";
import { createServerClient } from "@/lib/db/server";
import { ROUTES } from "@/lib/routes";

export type SettingsActionResult = { ok: boolean; error?: string };

/**
 * Save the store settings (TASKS 3.11) through the admin-only
 * `admin_update_settings` RPC (0018). Re-validates the shared schema
 * server-side, then revalidates the whole storefront layout so the banner,
 * homepage promo and shipping figures reflect the change live.
 */
export async function updateStoreSettings(
  values: unknown,
): Promise<SettingsActionResult> {
  await requireAdmin(ROUTES.adminSettings);

  const parsed = settingsFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Please correct the highlighted fields." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("admin_update_settings", {
    p_payload: formValuesToPayload(parsed.data),
  });

  if (error) {
    if (error.message.includes("NOT_ADMIN")) {
      return { ok: false, error: "You don't have permission to do that." };
    }
    return { ok: false, error: "Couldn't save settings. Please try again." };
  }

  // Storefront reads settings per request (banner/promo/shipping) — revalidate
  // the whole tree so the change is live, plus this admin page.
  revalidatePath("/", "layout");
  revalidatePath(ROUTES.adminSettings);
  return { ok: true };
}
