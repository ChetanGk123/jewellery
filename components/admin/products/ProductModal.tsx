"use client";

import { useState, useTransition } from "react";
import {
  upsertProduct,
  type ProductInput,
} from "@/app/(admin)/admin/(console)/products/actions";
import { BADGE_OPTIONS, PRODUCT_STATUS_OPTIONS } from "@/lib/admin/product-status";
import type { AdminCategory, AdminProductRow } from "@/lib/db/admin-products";

type Props = {
  product: AdminProductRow | null;
  categories: AdminCategory[];
  onClose: () => void;
};

type FormState = {
  name: string;
  sku: string;
  categoryId: string;
  price: string;
  sale: string;
  stock: string;
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

const rupees = (paise: number) =>
  Number.isInteger(paise / 100) ? String(paise / 100) : (paise / 100).toFixed(2);

function initialState(p: AdminProductRow | null, categories: AdminCategory[]): FormState {
  // Reverse of the action's price mapping: a stored MRP means the price_paise is
  // the sale, so the "Price" field shows the MRP and "Sale" the charged amount.
  const price = p ? (p.mrpPaise != null ? rupees(p.mrpPaise) : rupees(p.pricePaise)) : "";
  const sale = p && p.mrpPaise != null ? rupees(p.pricePaise) : "";
  return {
    name: p?.name ?? "",
    sku: p?.sku ?? "",
    categoryId: p?.categoryId ?? categories[0]?.id ?? "",
    price,
    sale,
    stock: p ? String(p.stock) : "",
    status: p?.status ?? "Active",
    imageUrl: p?.imageUrl ?? "",
    material: p?.material ?? "",
    badge: p?.badge ?? "None",
    blurb: p?.blurb ?? "",
    descLong: p?.descLong ?? "",
    detailsPlating: p?.detailsPlating ?? "",
    detailsStones: p?.detailsStones ?? "",
    detailsCare: p?.detailsCare ?? "",
    shippingNote: p?.shippingNote ?? "",
    isFeatured: p?.isFeatured ?? false,
    isFresh: p?.isFresh ?? false,
  };
}

export function ProductModal({ product, categories, onClose }: Props) {
  const [form, setForm] = useState<FormState>(() => initialState(product, categories));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    const input: ProductInput = {
      id: product?.id ?? null,
      name: form.name,
      sku: form.sku,
      categoryId: form.categoryId,
      priceRupees: Number(form.price),
      saleRupees: form.sale.trim() === "" ? null : Number(form.sale),
      stock: Number(form.stock),
      status: form.status,
      imageUrl: form.imageUrl,
      material: form.material,
      badge: form.badge,
      blurb: form.blurb,
      descLong: form.descLong,
      detailsPlating: form.detailsPlating,
      detailsStones: form.detailsStones,
      detailsCare: form.detailsCare,
      shippingNote: form.shippingNote,
      isFeatured: form.isFeatured,
      isFresh: form.isFresh,
    };
    startTransition(async () => {
      const res = await upsertProduct(input);
      if (res.ok) onClose();
      else setError(res.error ?? "Couldn't save the product.");
    });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(42,10,18,0.45)] p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-[560px] max-w-full flex-col overflow-hidden rounded-[14px] bg-[#F8F5EF] shadow-[0_30px_70px_rgba(42,10,18,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E7E0D4] bg-white px-[26px] py-[22px]">
          <h2 className="font-heading text-[22px] text-[#2A1F1A]">
            {product ? "Edit product" : "Add product"}
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

        <div className="flex flex-col gap-4 overflow-y-auto px-[26px] py-6">
          <Grid cols={2}>
            <Field label="Product name">
              <input {...text(form.name, (v) => set("name", v))} placeholder="e.g. Kundan Rani Haar" />
            </Field>
            <Field label="SKU">
              <input {...text(form.sku, (v) => set("sku", v))} placeholder="JR-NK-001" />
            </Field>
          </Grid>

          <Grid cols={3}>
            <Field label="Category">
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
            <Field label="Material">
              <input {...text(form.material, (v) => set("material", v))} placeholder="Kundan" />
            </Field>
            <Field label="Badge">
              <select value={form.badge} onChange={(e) => set("badge", e.target.value)} className={SELECT_CLS}>
                {BADGE_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
          </Grid>

          <Grid cols={3}>
            <Field label="Price (₹)">
              <input {...text(form.price, (v) => set("price", v))} inputMode="decimal" placeholder="1899" />
            </Field>
            <Field label="Sale price (₹)">
              <input {...text(form.sale, (v) => set("sale", v))} inputMode="decimal" placeholder="optional" />
            </Field>
            <Field label="Stock">
              <input {...text(form.stock, (v) => set("stock", v))} inputMode="numeric" placeholder="24" />
            </Field>
          </Grid>

          <Grid cols={2}>
            <Field label="Status">
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className={SELECT_CLS}>
                {PRODUCT_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Image URL">
              <input {...text(form.imageUrl, (v) => set("imageUrl", v))} placeholder="https://…" />
            </Field>
          </Grid>

          <Field label="Short tagline">
            <input {...text(form.blurb, (v) => set("blurb", v))} placeholder="Shown under the name on the storefront" />
          </Field>
          <Field label="Description">
            <textarea
              value={form.descLong}
              onChange={(e) => set("descLong", e.target.value)}
              rows={3}
              placeholder="Full product description shown on the product page…"
              className={`${INPUT_CLS} resize-y`}
            />
          </Field>

          <Grid cols={3}>
            <Field label="Plating finish">
              <input {...text(form.detailsPlating, (v) => set("detailsPlating", v))} placeholder="22K gold-tone" />
            </Field>
            <Field label="Stones">
              <input {...text(form.detailsStones, (v) => set("detailsStones", v))} placeholder="Kundan, pearls" />
            </Field>
            <Field label="Care">
              <input {...text(form.detailsCare, (v) => set("detailsCare", v))} placeholder="Keep dry" />
            </Field>
          </Grid>
          <Field label="Shipping note">
            <input {...text(form.shippingNote, (v) => set("shippingNote", v))} placeholder="Dispatched in 3–5 days" />
          </Field>

          <div className="flex gap-6">
            <Toggle label="Featured" checked={form.isFeatured} onChange={(v) => set("isFeatured", v)} />
            <Toggle label="New / fresh" checked={form.isFresh} onChange={(v) => set("isFresh", v)} />
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#E7E0D4] bg-white px-[26px] py-[18px]">
          {error && <p className="text-[12px] font-medium text-[#C0392F]">{error}</p>}
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-[#E7E0D4] bg-white px-5 py-3 text-[12px] font-semibold text-[#5E4A40] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              className="rounded-lg bg-maroon-700 px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-cream-200 transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save product"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const INPUT_CLS =
  "mt-1.5 block w-full rounded-lg border border-[#E7E0D4] bg-white px-3 py-2.5 text-[14px] text-[#2A1F1A] outline-none focus:border-[#C9A24B]";
const SELECT_CLS = `${INPUT_CLS} cursor-pointer`;

/** Spread onto <input> for a controlled text field with the shared style. */
function text(value: string, onChange: (v: string) => void) {
  return {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    className: INPUT_CLS,
    type: "text" as const,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[12px] font-medium text-[#8A7E74]">
      {label}
      {children}
    </label>
  );
}

function Grid({ cols, children }: { cols: 2 | 3; children: React.ReactNode }) {
  return (
    <div className={`grid gap-4 ${cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#2A1F1A]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-maroon-700"
      />
      {label}
    </label>
  );
}
