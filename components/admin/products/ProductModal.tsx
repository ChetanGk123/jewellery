"use client"

import { useRef, useState, useTransition } from "react"
import {
  uploadProductImage,
  upsertProduct,
  type ProductInput,
} from "@/app/(admin)/admin/(console)/products/actions"
import {
  BADGE_OPTIONS,
  MAX_PLATING_OPTION_LEN,
  MAX_PLATING_OPTIONS,
  MAX_PRODUCT_IMAGES,
  PLATING_OPTIONS,
  type ProductImage,
} from "@/lib/admin/product-status"
import type { AdminCategory, AdminProductRow } from "@/lib/db/admin-products"
import { PLACEHOLDER_GRADIENT } from "@/lib/theme"
import { useDialog } from "@/hooks/useDialog"

type Props = {
  product: AdminProductRow | null
  categories: AdminCategory[]
  onClose: () => void
}

type FormState = {
  name: string
  sku: string
  categoryId: string
  price: string
  sale: string
  stock: string
  material: string
  badge: string
  blurb: string
  descLong: string
  detailsPlating: string
  detailsStones: string
  detailsCare: string
  shippingNote: string
  images: ProductImage[]
  plating: string[]
}

const rupees = (paise: number) =>
  Number.isInteger(paise / 100) ? String(paise / 100) : (paise / 100).toFixed(2)

/** Rebuild the Designs & images grid from the stored gallery / primary url. */
function initialImages(p: AdminProductRow | null): ProductImage[] {
  if (!p) return [{ url: "", name: "", primary: true }]
  if (p.gallery.length > 0) return p.gallery
  if (p.imageUrl) return [{ url: p.imageUrl, name: "", primary: true }]
  return [{ url: "", name: "", primary: true }]
}

function initialState(p: AdminProductRow | null, categories: AdminCategory[]): FormState {
  // Reverse of the action's price mapping: a stored MRP means the price_paise is
  // the sale, so the "Price" field shows the MRP and "Sale" the charged amount.
  const price = p ? (p.mrpPaise != null ? rupees(p.mrpPaise) : rupees(p.pricePaise)) : ""
  const sale = p && p.mrpPaise != null ? rupees(p.pricePaise) : ""
  return {
    name: p?.name ?? "",
    sku: p?.sku ?? "",
    categoryId: p?.categoryId ?? categories[0]?.id ?? "",
    price,
    sale,
    stock: p ? String(p.stock) : "",
    material: p?.material ?? "",
    badge: p?.badge ?? "None",
    blurb: p?.blurb ?? "",
    descLong: p?.descLong ?? "",
    detailsPlating: p?.detailsPlating ?? "",
    detailsStones: p?.detailsStones ?? "",
    detailsCare: p?.detailsCare ?? "",
    shippingNote: p?.shippingNote ?? "",
    images: initialImages(p),
    plating: p?.platingOptions ?? [],
  }
}

export function ProductModal({ product, categories, onClose }: Props) {
  const [form, setForm] = useState<FormState>(() => initialState(product, categories))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const dialogRef = useDialog<HTMLDivElement>({
    isOpen: true,
    onDismiss: onClose,
    isPending,
  })

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  // --- Designs & images helpers -------------------------------------------
  const setImage = (i: number, patch: Partial<ProductImage>) =>
    set(
      "images",
      form.images.map((im, idx) => (idx === i ? { ...im, ...patch } : im)),
    )

  const addImage = () => {
    if (form.images.length >= MAX_PRODUCT_IMAGES) return
    set("images", [...form.images, { url: "", name: "", primary: form.images.length === 0 }])
  }

  const removeImage = (i: number) => {
    const kept = form.images.filter((_, idx) => idx !== i)
    const hasPrimary = kept.some((im) => im.primary)
    // If we removed the primary, promote the first remaining image.
    set(
      "images",
      kept.map((im, idx) => ({ ...im, primary: hasPrimary ? im.primary : idx === 0 })),
    )
  }

  const makePrimary = (i: number) =>
    set(
      "images",
      form.images.map((im, idx) => ({ ...im, primary: idx === i })),
    )

  const togglePlating = (opt: string) =>
    set(
      "plating",
      form.plating.includes(opt) ? form.plating.filter((p) => p !== opt) : [...form.plating, opt],
    )

  // Custom finishes beyond the default chips (6.3).
  const [customOption, setCustomOption] = useState("")
  const customPlating = form.plating.filter(
    (p) => !(PLATING_OPTIONS as readonly string[]).includes(p),
  )
  const addCustomOption = () => {
    const opt = customOption.trim()
    if (!opt) return
    const exists = form.plating.some((p) => p.toLowerCase() === opt.toLowerCase())
    if (!exists && form.plating.length < MAX_PLATING_OPTIONS) {
      set("plating", [...form.plating, opt])
    }
    setCustomOption("")
  }

  const submit = () => {
    const input: ProductInput = {
      id: product?.id ?? null,
      name: form.name,
      sku: form.sku,
      categoryId: form.categoryId,
      priceRupees: Number(form.price),
      saleRupees: form.sale.trim() === "" ? null : Number(form.sale),
      stock: Number(form.stock),
      // Not exposed in this dialog (matches the prototype) — carried through so
      // editing a product doesn't wipe its saved status / feature flags.
      status: product?.status ?? "Active",
      images: form.images,
      platingOptions: form.plating,
      material: form.material,
      badge: form.badge,
      blurb: form.blurb,
      descLong: form.descLong,
      detailsPlating: form.detailsPlating,
      detailsStones: form.detailsStones,
      detailsCare: form.detailsCare,
      shippingNote: form.shippingNote,
      isFeatured: product?.isFeatured ?? false,
      isFresh: product?.isFresh ?? false,
    }
    startTransition(async () => {
      const res = await upsertProduct(input)
      if (res.ok) onClose()
      else setError(res.error ?? "Couldn't save the product.")
    })
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(42,10,18,0.45)] p-6"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={product ? "Edit product" : "Add new product"}
        tabIndex={-1}
        className="max-h-[90vh] w-[520px] max-w-full overflow-auto rounded-[14px] bg-[#F8F5EF] shadow-[0_30px_70px_rgba(42,10,18,0.3)] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E7E0D4] bg-white px-[26px] py-[22px]">
          <h2 className="font-heading text-[22px] leading-none text-[#2A1F1A]">
            {product ? "Edit Product" : "Add New Product"}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-[22px] leading-none text-[#8A7E74] hover:text-[#2A1F1A]"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-[26px] py-6">
          <Field label="Product name">
            <input
              {...text(form.name, (v) => set("name", v))}
              placeholder="e.g. Kundan Rani Haar"
            />
          </Field>
          <Field label="SKU">
            <input {...text(form.sku, (v) => set("sku", v))} placeholder="JR-NK-001" />
          </Field>

          {/* Designs & images */}
          <section className="flex flex-col gap-2.5 rounded-[10px] border border-[#EAE3D7] bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#2A1F1A]">
                Designs &amp; images
              </span>
              <span className="text-[11px] text-[#A99C90]">
                {form.images.length} of {MAX_PRODUCT_IMAGES} designs
              </span>
            </div>
            <p className="text-[11.5px] leading-[1.4] text-[#8A7E74]">
              Add multiple photos or design variants. The primary image shows first on the
              storefront.
            </p>
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(122px,1fr))]">
              {form.images.map((im, i) => (
                <ImageCard
                  key={i}
                  image={im}
                  index={i}
                  onUrl={(v) => setImage(i, { url: v })}
                  onName={(v) => setImage(i, { name: v })}
                  onPrimary={() => makePrimary(i)}
                  onRemove={() => removeImage(i)}
                />
              ))}
              {form.images.length < MAX_PRODUCT_IMAGES && (
                <button
                  type="button"
                  onClick={addImage}
                  className="flex min-h-33 flex-col items-center justify-center gap-2 rounded-[9px] border-[1.5px] border-dashed border-[#C9B68F] bg-[#FCF9F3] text-[#A87A1E] transition-colors hover:border-[#A87A1E] hover:bg-[#F6EDDC]"
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span className="text-[11px] font-medium">Add design</span>
                </button>
              )}
            </div>
          </section>

          {/* Category / Material / Badge */}
          <div className="flex flex-wrap gap-3">
            <Field label="Category" className="min-w-35 flex-1">
              <select
                value={form.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                className={SELECT_CLS}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Material" className="min-w-35 flex-1">
              <input {...text(form.material, (v) => set("material", v))} placeholder="Kundan" />
            </Field>
            <Field label="Badge" className="min-w-35 flex-1">
              <select
                value={form.badge}
                onChange={(e) => set("badge", e.target.value)}
                className={SELECT_CLS}
              >
                {BADGE_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Price / Sale / Stock */}
          <div className="flex gap-3">
            <Field label="Price (₹)" className="flex-1">
              <input
                {...text(form.price, (v) => set("price", v))}
                inputMode="decimal"
                placeholder="1899"
              />
            </Field>
            <Field label="Sale price (₹)" className="flex-1">
              <input
                {...text(form.sale, (v) => set("sale", v))}
                inputMode="decimal"
                placeholder="optional"
              />
            </Field>
            <Field label="Stock" className="flex-1">
              <input
                {...text(form.stock, (v) => set("stock", v))}
                inputMode="numeric"
                placeholder="24"
              />
            </Field>
          </div>

          {/* Plating options */}
          <section className="flex flex-col gap-2.5 rounded-[10px] border border-[#EAE3D7] bg-white p-4">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#2A1F1A]">
              Plating options
            </span>
            <p className="text-[11.5px] leading-[1.4] text-[#8A7E74]">
              Select the finishes a customer can choose on the storefront, or add your own.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {PLATING_OPTIONS.map((opt) => {
                const on = form.plating.includes(opt)
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => togglePlating(opt)}
                    className={`rounded-[7px] border px-4 py-2.5 text-[12.5px] font-medium transition-colors ${
                      on
                        ? "border-maroon-700 bg-maroon-700 text-cream-200"
                        : "border-[#E7E0D4] bg-white text-[#2A1F1A] hover:border-[#C9B68F]"
                    }`}
                  >
                    {on ? "✓ " : ""}
                    {opt}
                  </button>
                )
              })}
              {customPlating.map((opt) => (
                <span
                  key={opt}
                  className="inline-flex items-center gap-2 rounded-[7px] border border-maroon-700 bg-maroon-700 px-4 py-2.5 text-[12.5px] font-medium text-cream-200"
                >
                  {opt}
                  <button
                    type="button"
                    aria-label={`Remove ${opt}`}
                    onClick={() => togglePlating(opt)}
                    className="text-[15px] leading-none opacity-75 transition-opacity hover:opacity-100"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            {form.plating.length < MAX_PLATING_OPTIONS && (
              <div className="flex gap-2">
                <input
                  value={customOption}
                  onChange={(e) => setCustomOption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addCustomOption()
                    }
                  }}
                  maxLength={MAX_PLATING_OPTION_LEN}
                  placeholder='Add a custom finish — e.g. "Antique gold"'
                  aria-label="Add a custom plating option"
                  className={FIELD_INPUT}
                />
                <button
                  type="button"
                  onClick={addCustomOption}
                  disabled={!customOption.trim()}
                  className="rounded-[7px] border border-[#DAD0C2] bg-white px-4 text-[12.5px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2] disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            )}
          </section>

          <Field label="Description">
            <textarea
              value={form.descLong}
              onChange={(e) => set("descLong", e.target.value)}
              rows={3}
              placeholder="Short product description shown on the storefront…"
              className={`${FIELD_INPUT} min-h-[64px] resize-y leading-[1.5]`}
            />
          </Field>

          {/* Product details */}
          <section className="flex flex-col gap-3 rounded-[10px] border border-[#EAE3D7] bg-white p-4">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#2A1F1A]">
              Product details
            </span>
            <div className="flex flex-wrap gap-3">
              <Field label="Plating finish" className="min-w-[160px] flex-1">
                <input
                  {...text(form.detailsPlating, (v) => set("detailsPlating", v))}
                  placeholder="22K gold-tone, anti-tarnish"
                />
              </Field>
              <Field label="Stones" className="min-w-[160px] flex-1">
                <input
                  {...text(form.detailsStones, (v) => set("detailsStones", v))}
                  placeholder="Kundan, pearls, cubic zirconia"
                />
              </Field>
            </div>
            <Field label="Care instructions">
              <input
                {...text(form.detailsCare, (v) => set("detailsCare", v))}
                placeholder="Keep dry; store in a soft pouch"
              />
            </Field>
          </section>

          <Field label="Short tagline">
            <input
              {...text(form.blurb, (v) => set("blurb", v))}
              placeholder="Shown under the name on the storefront"
            />
          </Field>

          <Field label="Shipping information">
            <textarea
              value={form.shippingNote}
              onChange={(e) => set("shippingNote", e.target.value)}
              rows={3}
              placeholder="Dispatch & returns details shown on the product page…"
              className={`${FIELD_INPUT} min-h-[64px] resize-y leading-[1.5]`}
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-[#E7E0D4] bg-white px-[26px] py-[18px]">
          {error && <p className="text-[12px] font-medium text-[#C0392F]">{error}</p>}
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-[#DAD0C2] bg-white px-5 py-[11px] text-[12px] font-semibold text-[#5E4A40] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              className="rounded-lg bg-maroon-700 px-6 py-[11px] text-[12px] font-semibold text-cream-200 transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save Product"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const FIELD_INPUT =
  "mt-1.5 block w-full rounded-lg border border-[#E7E0D4] bg-white px-3 py-2.5 text-[14px] text-[#2A1F1A] outline-none focus:border-[#C9A24B]"
const SELECT_CLS = `${FIELD_INPUT} cursor-pointer`

/** Spread onto <input> for a controlled text field with the shared style. */
function text(value: string, onChange: (v: string) => void) {
  return {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    className: FIELD_INPUT,
    type: "text" as const,
  }
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`block text-[12px] font-medium text-[#8A7E74] ${className ?? ""}`}>
      {label}
      {children}
    </label>
  )
}

/**
 * One tile in the Designs & images grid — mirrors the prototype exactly: a
 * square preview (the click-to-upload target), a Design name input, and a
 * Primary button. Uploading a file goes through the uploadProductImage server
 * action (Supabase Storage) and stores the returned public URL.
 */
function ImageCard({
  image,
  index,
  onUrl,
  onName,
  onPrimary,
  onRemove,
}: {
  image: ProductImage
  index: number
  onUrl: (v: string) => void
  onName: (v: string) => void
  onPrimary: () => void
  onRemove: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setErr(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await uploadProductImage(fd)
      if (res.ok && res.url) onUrl(res.url)
      else setErr(res.error ?? "Upload failed.")
    } catch {
      setErr("Upload failed.")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="overflow-hidden rounded-[9px] border border-[#E7E0D4] bg-[#FBF8F2]">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        title={image.url ? "Replace image" : "Upload image"}
        className="group relative flex aspect-square w-full items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: image.url ? `url(${image.url})` : PLACEHOLDER_GRADIENT }}
      >
        <span className="absolute left-1.5 top-1.5 h-5 w-5 rounded-full bg-[rgba(42,10,18,0.55)] text-center text-[10px] font-semibold leading-5 text-cream-200">
          {index + 1}
        </span>
        {image.primary && (
          <span className="absolute right-1.5 top-1.5 rounded-[5px] bg-maroon-700 px-1.5 py-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-cream-200">
            Primary
          </span>
        )}
        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-[rgba(251,248,242,0.75)] text-[10px] font-semibold text-[#A87A1E]">
            Uploading…
          </span>
        ) : (
          !image.url && (
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#A88A55"
              strokeWidth={1.4}
              className="opacity-60 transition-opacity group-hover:opacity-90"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="10" r="1.6" />
              <path d="m4 17 5-4 4 3 3-2 4 3" />
            </svg>
          )
        )}
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          title="Remove"
          className="absolute bottom-1.5 right-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white/90 text-[14px] text-[#C0392F] shadow-[0_1px_4px_rgba(0,0,0,0.18)]"
        >
          ×
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <div className="flex flex-col gap-1.5 p-2">
        {err && <p className="text-[10px] font-medium text-[#C0392F]">{err}</p>}
        <input
          value={image.name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Design name"
          className="w-full rounded-md border border-[#E7E0D4] bg-white px-2 py-1.5 text-[11.5px] text-[#2A1F1A] outline-none focus:border-[#C9A24B]"
        />
        <button
          type="button"
          onClick={onPrimary}
          disabled={image.primary}
          className={`rounded-md py-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] transition-colors ${
            image.primary
              ? "cursor-default bg-maroon-700 text-cream-200"
              : "border border-[#E7E0D4] bg-white text-maroon-700 hover:border-[#C9B68F]"
          }`}
        >
          {image.primary ? "Primary" : "Set primary"}
        </button>
      </div>
    </div>
  )
}
