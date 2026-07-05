import type { Metadata } from "next";
import { SettingsView } from "@/components/admin/settings/SettingsView";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { settingsToFormValues } from "@/lib/admin/settings";
import { getStoreSettings } from "@/lib/db/settings";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminSettings].title,
};

/**
 * Settings page (TASKS 3.11). Loads the single `setting` row server-side and
 * seeds the client `SettingsView` form; saving goes through the
 * `updateStoreSettings` action and revalidates the storefront so banner, promo
 * and shipping changes are live.
 */
export default async function AdminSettingsPage() {
  const settings = await getStoreSettings();
  return <SettingsView initial={settingsToFormValues(settings)} />;
}
