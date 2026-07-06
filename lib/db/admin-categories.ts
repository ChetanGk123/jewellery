import "server-only";
import type { AdminCategoryRow } from "@/lib/admin/category";
import { type AdminRead, loadAdmin } from "./admin-read";
import { createServerClient } from "./server";

/**
 * Admin categories (Phase 3.5). Reads `category` through the admin's cookie
 * session and tallies the product count per collection (all statuses, Drafts
 * included — the storefront hides Drafts in app code). Writes go through the
 * `admin_upsert_category` / `admin_delete_category` RPCs (0011), never a direct
 * table write. The `AdminCategoryRow` type + label helper live in the
 * client-safe `lib/admin/category` so the client views can share them.
 */

export async function listAdminCategories(): Promise<
  AdminRead<AdminCategoryRow[]>
> {
  return loadAdmin("categories", async () => {
    const supabase = await createServerClient();

    const [cats, products] = await Promise.all([
      supabase
        .from("category")
        .select("id, name, slug, description, hero_bg, sort_order")
        .order("sort_order", { ascending: true }),
      supabase.from("product").select("category_id"),
    ]);

    const counts = new Map<string, number>();
    for (const p of products.data ?? []) {
      if (!p.category_id) continue;
      counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
    }

    return (cats.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      heroBg: c.hero_bg,
      sortOrder: c.sort_order,
      productCount: counts.get(c.id) ?? 0,
    }));
  }, []);
}
