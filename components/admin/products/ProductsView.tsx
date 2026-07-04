"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ADMIN_PRODUCTS_PAGE_SIZE,
  PRODUCT_STATUS_FILTERS,
  productDisplayChip,
  stockColor,
} from "@/lib/admin/product-status";
import type { AdminProductRow, AdminProductsPage } from "@/lib/db/admin-products";
import { ROUTES } from "@/lib/routes";
import { PLACEHOLDER_GRADIENT } from "@/lib/theme";
import { formatPaise } from "@/lib/utils/money";
import { ProductModal } from "./ProductModal";

type ModalState = { open: boolean; product: AdminProductRow | null };

export function ProductsView({ page }: { page: AdminProductsPage }) {
  const router = useRouter();
  const [search, setSearch] = useState(page.search);
  const [modal, setModal] = useState<ModalState>({ open: false, product: null });

  const hrefFor = (over: Partial<Record<"search" | "category" | "status" | "page", string>>) => {
    const params = new URLSearchParams();
    const s = over.search ?? page.search;
    const cat = over.category ?? page.categoryId;
    const st = over.status ?? page.status;
    const pg = over.page ?? "1";
    if (s.trim()) params.set("search", s.trim());
    if (cat !== "All") params.set("category", cat);
    if (st !== "All") params.set("status", st);
    if (pg !== "1") params.set("page", pg);
    const qs = params.toString();
    return qs ? `${ROUTES.adminProducts}?${qs}` : ROUTES.adminProducts;
  };

  const go = (over: Parameters<typeof hrefFor>[0]) => router.push(hrefFor(over));

  const rangeStart = page.total === 0 ? 0 : (page.page - 1) * ADMIN_PRODUCTS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page.page * ADMIN_PRODUCTS_PAGE_SIZE, page.total);

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go({ search, page: "1" });
          }}
          className="flex min-w-[200px] max-w-[320px] flex-1 items-center rounded-lg border border-[#E7E0D4] bg-white px-3"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9C8A7E" strokeWidth={2} aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SKU"
            className="flex-1 bg-transparent px-2 py-2.5 text-[13px] outline-none"
          />
        </form>

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

        <button
          type="button"
          onClick={() => setModal({ open: true, product: null })}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-maroon-700 px-[18px] py-[11px] text-[12px] font-semibold uppercase tracking-[0.04em] text-cream-200 transition-opacity hover:opacity-90"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add product
        </button>
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
              <span className="w-[56px] text-right">Edit</span>
            </div>

            {page.rows.length === 0 ? (
              <p className="px-[22px] py-[50px] text-center text-[13px] text-[#A99C90]">
                No products match these filters.
              </p>
            ) : (
              page.rows.map((p) => {
                const chip = productDisplayChip(p.status, p.stock);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3.5 border-b border-[#F3EEE4] px-[22px] py-[13px] last:border-b-0 hover:bg-[#FBF8F2]"
                  >
                    <div
                      className="h-[46px] w-[46px] flex-none rounded-lg border border-[#EFE3D0] bg-cover bg-center"
                      style={{
                        backgroundImage: p.imageUrl
                          ? `url(${p.imageUrl})`
                          : PLACEHOLDER_GRADIENT,
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
                    <span className="w-[56px] text-right">
                      <button
                        type="button"
                        onClick={() => setModal({ open: true, product: p })}
                        className="text-[12px] font-semibold text-maroon-700 hover:underline"
                      >
                        Edit
                      </button>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {page.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12px] text-[#8A7E74]">
            Showing {rangeStart}–{rangeEnd} of {page.total}
          </span>
          {page.pageCount > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {Array.from({ length: page.pageCount }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={hrefFor({ page: String(n) })}
                  aria-current={n === page.page ? "page" : undefined}
                  className={`min-w-[34px] rounded-md border px-2.5 py-[7px] text-center text-[12px] font-semibold ${
                    n === page.page
                      ? "border-maroon-700 bg-maroon-700 text-cream-200"
                      : "border-[#E7E0D4] bg-white text-maroon-700 hover:border-[#D8CDB9]"
                  }`}
                >
                  {n}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {modal.open && (
        <ProductModal
          key={modal.product?.id ?? "new"}
          product={modal.product}
          categories={page.categories}
          onClose={() => setModal({ open: false, product: null })}
        />
      )}
    </div>
  );
}
