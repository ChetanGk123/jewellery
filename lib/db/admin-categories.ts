import "server-only";
import {
  ADMIN_CATEGORIES_PAGE_SIZE,
  type AdminCategoryRow,
} from "@/lib/admin/category";
import { type AdminRead, loadAdmin } from "./admin-read";
import { createServerClient } from "./server";

export type AdminCategoriesPage = {
  rows: AdminCategoryRow[];
  page: number;
  pageCount: number;
  total: number;
};

function emptyPage(page: number): AdminCategoriesPage {
  return { rows: [], page, pageCount: 1, total: 0 };
}

/**
 * Admin categories (Phase 3.5, paginated in 5.10). Reads one page of `category`
 * rows through the admin's cookie session, ordered by `sort_order`, then tallies
 * the product count per collection with a **bounded** `product` read — only the
 * page's category ids (`in(...)`) rather than the whole catalogue (all statuses,
 * Drafts included; the storefront hides Drafts in app code). Writes go through
 * the `admin_upsert_category` / `admin_delete_category` RPCs (0011).
 */
export async function listAdminCategories(opts: {
  page: number;
}): Promise<AdminRead<AdminCategoriesPage>> {
  const page = Math.max(1, opts.page);

  return loadAdmin(
    "categories",
    async () => {
      const supabase = await createServerClient();
      const from = (page - 1) * ADMIN_CATEGORIES_PAGE_SIZE;

      const { data: cats, count } = await supabase
        .from("category")
        .select("id, name, slug, description, hero_bg, sort_order", {
          count: "exact",
        })
        .order("sort_order", { ascending: true })
        .range(from, from + ADMIN_CATEGORIES_PAGE_SIZE - 1);

      const ids = (cats ?? []).map((c) => c.id);
      const { data: products } = ids.length
        ? await supabase
            .from("product")
            .select("category_id")
            .in("category_id", ids)
        : { data: [] };

      const counts = new Map<string, number>();
      for (const p of products ?? []) {
        if (!p.category_id) continue;
        counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
      }

      const rows: AdminCategoryRow[] = (cats ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        heroBg: c.hero_bg,
        sortOrder: c.sort_order,
        productCount: counts.get(c.id) ?? 0,
      }));

      const total = count ?? 0;
      const pageCount = Math.max(
        1,
        Math.ceil(total / ADMIN_CATEGORIES_PAGE_SIZE),
      );

      return { rows, page, pageCount, total };
    },
    emptyPage(page),
  );
}
