/**
 * Client-safe category types + helpers for the admin console (Phase 3.5).
 * Kept free of `server-only` imports so both the client CategoriesView/Modal
 * and the server data module (`lib/db/admin-categories.ts`) can share them
 * without dragging the Supabase server client into the browser bundle.
 */

/** Categories shown per page in the admin card grid (TASKS 5.10). */
export const ADMIN_CATEGORIES_PAGE_SIZE = 12

export type AdminCategoryRow = {
  id: string
  name: string
  slug: string
  description: string | null
  heroBg: string | null
  /** Storefront tile photo (6.11); null falls back to the heroBg gradient. */
  imageUrl: string | null
  sortOrder: number
  productCount: number
}

/** "12 products" / "1 product" / "No products yet" for the card subtitle. */
export function categoryCountLabel(count: number): string {
  if (count <= 0) return "No products yet"
  return `${count} product${count === 1 ? "" : "s"}`
}
