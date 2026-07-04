/**
 * Client-safe product status helpers (Phase 3.4). Kept separate from the
 * server-only `lib/db/admin-products.ts` so client components (the list view and
 * the add/edit modal) can import these constants without pulling a server module
 * into the browser bundle. Mirrors the role of `order-status.ts` for orders.
 */

/** Filter options for the products list (hybrid of stored status + stock). */
export const PRODUCT_STATUS_FILTERS = [
  "All",
  "Active",
  "Low stock",
  "Out of stock",
  "Draft",
] as const;
export type ProductStatusFilter = (typeof PRODUCT_STATUS_FILTERS)[number];

/** Products per page in the admin catalogue. */
export const ADMIN_PRODUCTS_PAGE_SIZE = 8;

/** Stored `product.status` values a product can be saved as. */
export const PRODUCT_STATUS_OPTIONS = ["Active", "Draft"] as const;

/** Badge choices in the modal ("None" stores the literal string, no badge). */
export const BADGE_OPTIONS = ["None", "Bestseller", "New", "Bridal Edit"] as const;

const LOW_STOCK_THRESHOLD = 5;

export type StatusChip = { label: string; color: string; bg: string };

/**
 * The chip shown in the products table — derived from both the stored status and
 * the stock level: Draft wins, then out-of-stock, then low-stock, else Active.
 */
export function productDisplayChip(status: string, stock: number): StatusChip {
  if (status === "Draft") return { label: "Draft", color: "#8A7E74", bg: "#F1ECE3" };
  if (stock <= 0)
    return { label: "Out of stock", color: "#C0392F", bg: "#FBE9E7" };
  if (stock <= LOW_STOCK_THRESHOLD)
    return { label: "Low stock", color: "#B7791F", bg: "#FBF1DD" };
  return { label: "Active", color: "#1B7A3D", bg: "#E7F3EB" };
}

/** Colour for the stock number in the table (green / amber / red). */
export function stockColor(status: string, stock: number): string {
  if (status === "Draft") return "#8A7E74";
  if (stock <= 0) return "#C0392F";
  if (stock <= LOW_STOCK_THRESHOLD) return "#B7791F";
  return "#1B7A3D";
}
