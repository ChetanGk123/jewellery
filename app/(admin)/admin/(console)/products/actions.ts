"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createServerClient } from "@/lib/db/server";
import { ROUTES } from "@/lib/routes";

/** The add/edit form's payload — rupees for money, `id: null` means create. */
export type ProductInput = {
  id: string | null;
  name: string;
  sku: string;
  categoryId: string;
  priceRupees: number;
  saleRupees: number | null;
  stock: number;
  status: string;
  imageUrl: string;
  material: string;
  badge: string;
  blurb: string;
  descLong: string;
  detailsPlating: string;
  detailsStones: string;
  detailsCare: string;
  shippingNote: string;
  isFeatured: boolean;
  isFresh: boolean;
};

export type ProductActionResult = { ok: boolean; error?: string };

function messageFor(code: string | undefined, raw: string): string {
  if (code === "23505") return "A product with that SKU already exists.";
  if (raw.includes("NOT_ADMIN")) return "You don't have permission to do that.";
  if (raw.includes("PRODUCT_NOT_FOUND")) return "That product no longer exists.";
  if (raw.includes("NAME_REQUIRED")) return "Product name is required.";
  if (raw.includes("SKU_REQUIRED")) return "SKU is required.";
  if (raw.includes("CATEGORY_REQUIRED")) return "Please choose a category.";
  return "Couldn't save the product. Please try again.";
}

/**
 * Create or update a product through the admin-only `admin_upsert_product` RPC
 * (0008). Validates + converts rupees → integer paise here, then lets the RPC
 * re-check admin + required fields and generate the slug.
 */
export async function upsertProduct(
  input: ProductInput,
): Promise<ProductActionResult> {
  await requireAdmin(ROUTES.adminProducts);

  const name = input.name?.trim() ?? "";
  const sku = input.sku?.trim() ?? "";
  if (!name) return { ok: false, error: "Product name is required." };
  if (!sku) return { ok: false, error: "SKU is required." };
  if (!input.categoryId) return { ok: false, error: "Please choose a category." };

  const price = Number(input.priceRupees);
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: "Enter a valid price." };
  }
  const sale = input.saleRupees == null ? null : Number(input.saleRupees);
  if (sale != null && (!Number.isFinite(sale) || sale < 0)) {
    return { ok: false, error: "Enter a valid sale price." };
  }
  const stock = Math.trunc(Number(input.stock));
  if (!Number.isFinite(stock) || stock < 0) {
    return { ok: false, error: "Enter a valid stock quantity." };
  }

  // "Sale price" is what the customer pays; the higher "Price" becomes the
  // strike-through MRP. Without a valid sale, Price is the charged amount.
  let pricePaise: number;
  let mrpPaise: number | null;
  if (sale != null && sale > 0 && sale < price) {
    pricePaise = Math.round(sale * 100);
    mrpPaise = Math.round(price * 100);
  } else {
    pricePaise = Math.round(price * 100);
    mrpPaise = null;
  }

  const payload = {
    name,
    sku,
    category_id: input.categoryId,
    price_paise: pricePaise,
    mrp_paise: mrpPaise,
    stock,
    status: input.status || "Active",
    primary_image_url: input.imageUrl?.trim() ?? "",
    material: input.material?.trim() ?? "",
    badge: input.badge || "None",
    blurb: input.blurb?.trim() ?? "",
    desc_long: input.descLong?.trim() ?? "",
    details_plating: input.detailsPlating?.trim() ?? "",
    details_stones: input.detailsStones?.trim() ?? "",
    details_care: input.detailsCare?.trim() ?? "",
    shipping_note: input.shippingNote?.trim() ?? "",
    is_featured: input.isFeatured,
    is_fresh: input.isFresh,
  };

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("admin_upsert_product", {
    p_id: input.id,
    p_payload: payload,
  });

  if (error) {
    return { ok: false, error: messageFor(error.code, error.message) };
  }

  revalidatePath(ROUTES.adminProducts);
  return { ok: true };
}
