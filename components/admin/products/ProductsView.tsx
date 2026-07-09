"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ADMIN_PRODUCTS_PAGE_SIZE,
  PRODUCT_STATUS_FILTERS,
  productDisplayChip,
  stockColor,
} from "@/lib/admin/product-status"
import type { AdminProductRow, AdminProductsPage } from "@/lib/db/admin-products"
import { ROUTES } from "@/lib/routes"
import { PLACEHOLDER_GRADIENT } from "@/lib/theme"
import { formatPaise } from "@/lib/utils/money"
import {
  applyProductsImport,
  parseProductsImport,
} from "@/app/(admin)/admin/(console)/products/import-actions"
import { AdminPager } from "@/components/admin/ui/AdminPager"
import { AdminSearchBox } from "@/components/admin/ui/AdminSearchBox"
import { BulkImportControl } from "@/components/admin/ui/BulkImportControl"
import { ProductModal } from "./ProductModal"

type ModalState = { open: boolean; product: AdminProductRow | null }

export function ProductsView({
  page,
  initialEdit = null,
}: {
  page: AdminProductsPage
  /** Product to open the edit modal for on load (e.g. Analytics "Edit product" deep link). */
  initialEdit?: AdminProductRow | null
}) {
  const router = useRouter()
  const [modal, setModal] = useState<ModalState>(
    initialEdit ? { open: true, product: initialEdit } : { open: false, product: null },
  )

  const hrefFor = (over: Partial<Record<"search" | "category" | "status" | "page", string>>) => {
    const params = new URLSearchParams()
    const s = over.search ?? page.search
    const cat = over.category ?? page.categoryId
    const st = over.status ?? page.status
    const pg = over.page ?? "1"
    if (s.trim()) params.set("search", s.trim())
    if (cat !== "All") params.set("category", cat)
    if (st !== "All") params.set("status", st)
    if (pg !== "1") params.set("page", pg)
    const qs = params.toString()
    return qs ? `${ROUTES.adminProducts}?${qs}` : ROUTES.adminProducts
  }

  const go = (over: Parameters<typeof hrefFor>[0]) => router.push(hrefFor(over))

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <AdminSearchBox
          value={page.search}
          onSearch={(term) => router.replace(hrefFor({ search: term, page: "1" }))}
          placeholder="Search by name or SKU"
          ariaLabel="Search products by name or SKU"
          className="min-w-[200px] max-w-[320px] flex-1"
        />

        <select
          value={page.categoryId}
          onChange={(e) => go({ category: e.target.value, page: "1" })}
          className="cursor-pointer rounded-lg border border-[#E7E0D4] bg-white px-3 py-2.5 text-[13px] text-[#2A1F1A]"
        >
          <option value="All">All categories</option>
          {page.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={page.status}
          onChange={(e) => go({ status: e.target.value, page: "1" })}
          className="cursor-pointer rounded-lg border border-[#E7E0D4] bg-white px-3 py-2.5 text-[13px] text-[#2A1F1A]"
        >
          {PRODUCT_STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "All" ? "All status" : s}
            </option>
          ))}
        </select>

        <div className="ml-auto flex flex-wrap gap-2.5">
          <BulkImportControl
            entityLabel="products"
            exportHref={`${ROUTES.adminProducts}/export`}
            parseAction={parseProductsImport}
            applyAction={applyProductsImport}
          />
          <button
            type="button"
            onClick={() => setModal({ open: true, product: null })}
            className="inline-flex items-center gap-2 rounded-lg bg-maroon-700 px-[18px] py-[11px] text-[12px] font-semibold tracking-[0.04em] text-cream-200 transition-opacity hover:opacity-90"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Product
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#EAE3D7] bg-white">
        <div className="overflow-x-auto">
          <div className="min-w-[780px]">
            <div className="flex items-center gap-3.5 border-b border-[#EFE9DE] bg-[#FBF8F2] px-[22px] py-[13px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8A7E74]">
              <span className="w-[46px]" />
              <span className="flex-1">Product</span>
              <span className="w-[150px]">Category</span>
              <span className="w-[90px] text-right">Price</span>
              <span className="w-[70px] text-center">Stock</span>
              <span className="w-[110px] text-center">Status</span>
              <span className="w-[80px] text-right">Actions</span>
            </div>

            {page.rows.length === 0 ? (
              <p className="px-[22px] py-[50px] text-center text-[13px] text-[#A99C90]">
                No products match these filters.
              </p>
            ) : (
              page.rows.map((p) => {
                const chip = productDisplayChip(p.status, p.stock)
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3.5 border-b border-[#F3EEE4] px-[22px] py-[13px] last:border-b-0 hover:bg-[#FBF8F2]"
                  >
                    <div
                      className="h-[46px] w-[46px] flex-none rounded-lg border border-[#EFE3D0] bg-cover bg-center"
                      style={{
                        backgroundImage: p.imageUrl ? `url(${p.imageUrl})` : PLACEHOLDER_GRADIENT,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium text-[#2A1F1A]">
                        {p.name}
                      </div>
                      <div className="mt-[3px] text-[11px] text-[#A99C90]">{p.sku}</div>
                    </div>
                    <span className="w-[150px] truncate text-[12.5px] text-[#5E4A40]">
                      {p.categoryName}
                    </span>
                    <span className="w-[90px] text-right">
                      <span className="text-[13px] font-semibold text-[#2A1F1A]">
                        {formatPaise(p.pricePaise)}
                      </span>
                      {p.mrpPaise != null && (
                        <span className="ml-1 text-[11px] text-[#A99C90] line-through">
                          {formatPaise(p.mrpPaise)}
                        </span>
                      )}
                    </span>
                    <span
                      className="w-[70px] text-center text-[13px] font-semibold"
                      style={{ color: stockColor(p.status, p.stock) }}
                    >
                      {p.stock}
                    </span>
                    <span className="flex w-[110px] justify-center">
                      <span
                        className="rounded-full px-2.5 py-[5px] text-[11px] font-semibold"
                        style={{ color: chip.color, background: chip.bg }}
                      >
                        {chip.label}
                      </span>
                    </span>
                    <span className="flex w-[80px] items-center justify-end gap-3">
                      {p.status !== "Draft" && (
                        <a
                          href={ROUTES.product(p.slug)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View on storefront"
                          className="inline-flex text-[#8A7E74] transition-colors hover:text-maroon-700"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.8}
                            aria-hidden="true"
                          >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <path d="M15 3h6v6M10 14 21 3" />
                          </svg>
                        </a>
                      )}
                      <Link
                        href={`${ROUTES.adminAnalytics}?product=${p.id}`}
                        title="View analytics"
                        className="inline-flex text-[#8A7E74] transition-colors hover:text-maroon-700"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        >
                          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
                        </svg>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setModal({ open: true, product: p })}
                        title="Edit product"
                        className="inline-flex text-[#8A7E74] transition-colors hover:text-maroon-700"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        >
                          <path d="M4 20h4L18 10l-4-4L4 16v4Z" />
                          <path d="M14 6l4 4" />
                        </svg>
                      </button>
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <AdminPager
        page={page.page}
        pageCount={page.pageCount}
        total={page.total}
        pageSize={ADMIN_PRODUCTS_PAGE_SIZE}
        hrefForPage={(n) => hrefFor({ page: String(n) })}
      />

      {modal.open && (
        <ProductModal
          key={modal.product?.id ?? "new"}
          product={modal.product}
          categories={page.categories}
          onClose={() => setModal({ open: false, product: null })}
        />
      )}
    </div>
  )
}
