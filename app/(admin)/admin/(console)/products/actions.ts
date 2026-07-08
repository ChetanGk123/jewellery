"use server"

import { revalidatePath, updateTag } from "next/cache"
import { requireAdmin } from "@/lib/admin/auth"
import { CACHE_TAGS } from "@/lib/db/cache"
import { PLATING_OPTIONS, type ProductImage } from "@/lib/admin/product-status"
import { createServerClient } from "@/lib/db/server"
import { ROUTES } from "@/lib/routes"

/** The add/edit form's payload — rupees for money, `id: null` means create. */
export type ProductInput = {
  id: string | null
  name: string
  sku: string
  categoryId: string
  priceRupees: number
  saleRupees: number | null
  stock: number
  status: string
  images: ProductImage[]
  platingOptions: string[]
  material: string
  badge: string
  blurb: string
  descLong: string
  detailsPlating: string
  detailsStones: string
  detailsCare: string
  shippingNote: string
  isFeatured: boolean
  isFresh: boolean
}

/**
 * Normalise the Designs & images grid: trim, drop entries with no url, and
 * guarantee exactly one primary (the marked one, else the first). Returns the
 * cleaned gallery plus the primary url denormalised for the storefront.
 */
function normalizeImages(images: ProductImage[]): {
  gallery: ProductImage[]
  primaryUrl: string
} {
  const cleaned = (images ?? [])
    .map((im) => ({
      url: (im.url ?? "").trim(),
      name: (im.name ?? "").trim(),
      primary: im.primary === true,
    }))
    .filter((im) => im.url !== "")

  if (cleaned.length === 0) return { gallery: [], primaryUrl: "" }

  let primaryIdx = cleaned.findIndex((im) => im.primary)
  if (primaryIdx === -1) primaryIdx = 0
  const gallery = cleaned.map((im, i) => ({ ...im, primary: i === primaryIdx }))
  return { gallery, primaryUrl: gallery[primaryIdx].url }
}

export type ProductActionResult = { ok: boolean; error?: string }
export type UploadResult = { ok: boolean; url?: string; error?: string }

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
const PRODUCT_IMAGE_BUCKET = "product-images"

/**
 * Upload one product image to Supabase Storage through the admin cookie session
 * (Storage writes are is_admin()-gated by 0010). Returns the public URL, which
 * the modal stores in the product's gallery. Validates type + size server-side.
 */
export async function uploadProductImage(formData: FormData): Promise<UploadResult> {
  await requireAdmin(ROUTES.adminProducts)

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file selected." }
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Please choose an image file." }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image must be under 5 MB." }
  }

  const ext = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
  const path = `products/${crypto.randomUUID()}.${ext || "jpg"}`

  const supabase = await createServerClient()
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) {
    return { ok: false, error: "Upload failed. Please try again." }
  }

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path)
  return { ok: true, url: data.publicUrl }
}

function messageFor(code: string | undefined, raw: string): string {
  if (code === "23505") return "A product with that SKU already exists."
  if (raw.includes("NOT_ADMIN")) return "You don't have permission to do that."
  if (raw.includes("PRODUCT_NOT_FOUND")) return "That product no longer exists."
  if (raw.includes("NAME_REQUIRED")) return "Product name is required."
  if (raw.includes("SKU_REQUIRED")) return "SKU is required."
  if (raw.includes("CATEGORY_REQUIRED")) return "Please choose a category."
  return "Couldn't save the product. Please try again."
}

/**
 * Create or update a product through the admin-only `admin_upsert_product` RPC
 * (0008). Validates + converts rupees → integer paise here, then lets the RPC
 * re-check admin + required fields and generate the slug.
 */
export async function upsertProduct(input: ProductInput): Promise<ProductActionResult> {
  await requireAdmin(ROUTES.adminProducts)

  const name = input.name?.trim() ?? ""
  const sku = input.sku?.trim() ?? ""
  if (!name) return { ok: false, error: "Product name is required." }
  if (!sku) return { ok: false, error: "SKU is required." }
  if (!input.categoryId) return { ok: false, error: "Please choose a category." }

  const price = Number(input.priceRupees)
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: "Enter a valid price." }
  }
  const sale = input.saleRupees == null ? null : Number(input.saleRupees)
  if (sale != null && (!Number.isFinite(sale) || sale < 0)) {
    return { ok: false, error: "Enter a valid sale price." }
  }
  const stock = Math.trunc(Number(input.stock))
  if (!Number.isFinite(stock) || stock < 0) {
    return { ok: false, error: "Enter a valid stock quantity." }
  }

  // "Sale price" is what the customer pays; the higher "Price" becomes the
  // strike-through MRP. Without a valid sale, Price is the charged amount.
  let pricePaise: number
  let mrpPaise: number | null
  if (sale != null && sale > 0 && sale < price) {
    pricePaise = Math.round(sale * 100)
    mrpPaise = Math.round(price * 100)
  } else {
    pricePaise = Math.round(price * 100)
    mrpPaise = null
  }

  const { gallery, primaryUrl } = normalizeImages(input.images)
  // Only persist recognised finishes, preserving the chip order.
  const platingOptions = PLATING_OPTIONS.filter((opt) => (input.platingOptions ?? []).includes(opt))

  const payload = {
    name,
    sku,
    category_id: input.categoryId,
    price_paise: pricePaise,
    mrp_paise: mrpPaise,
    stock,
    status: input.status || "Active",
    primary_image_url: primaryUrl,
    gallery,
    plating_options: platingOptions,
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
  }

  const supabase = await createServerClient()
  const { error } = await supabase.rpc("admin_upsert_product", {
    p_id: input.id,
    p_payload: payload,
  })

  if (error) {
    return { ok: false, error: messageFor(error.code, error.message) }
  }

  revalidatePath(ROUTES.adminProducts)
  updateTag(CACHE_TAGS.products)
  return { ok: true }
}
