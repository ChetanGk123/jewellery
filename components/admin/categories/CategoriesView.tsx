"use client";

import { useState } from "react";
import {
  categoryCountLabel,
  type AdminCategoryRow,
} from "@/lib/admin/category";
import { PLACEHOLDER_GRADIENT } from "@/lib/theme";
import { CategoryModal } from "./CategoryModal";

type ModalState = { open: boolean; category: AdminCategoryRow | null };

/**
 * Categories manager (Phase 3.5, prototype-matched): a "New Category" button
 * above a responsive card grid, each card an icon tile + name + product count
 * with an edit pencil. Add/edit/delete all run through the CategoryModal.
 */
export function CategoriesView({
  categories,
}: {
  categories: AdminCategoryRow[];
}) {
  const [modal, setModal] = useState<ModalState>({
    open: false,
    category: null,
  });

  const openNew = () => setModal({ open: true, category: null });
  const openEdit = (category: AdminCategoryRow) =>
    setModal({ open: true, category });
  const close = () => setModal({ open: false, category: null });

  return (
    <div className="flex flex-col gap-[18px]">
      <button
        type="button"
        onClick={openNew}
        className="inline-flex items-center gap-2 self-start rounded-lg bg-maroon-700 px-[18px] py-[11px] font-body text-[12px] font-semibold text-cream-200 transition-opacity hover:opacity-90"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New Category
      </button>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-[#EAE3D7] bg-white px-6 py-[50px] text-center">
          <p className="font-body text-[13px] text-[#A99C90]">
            No categories yet. Create your first collection to organise products.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3.5 rounded-xl border border-[#EAE3D7] bg-white p-[18px]"
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px]"
                style={{ background: c.heroBg ?? PLACEHOLDER_GRADIENT }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A87A1E" strokeWidth={1.6} aria-hidden="true">
                  <path d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-heading text-[16px] leading-tight text-[#2A1F1A]">
                  {c.name}
                </div>
                <div className="mt-[3px] font-body text-[12px] text-[#A99C90]">
                  {categoryCountLabel(c.productCount)}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Edit ${c.name}`}
                onClick={() => openEdit(c)}
                className="text-[#8A7E74] transition-colors hover:text-maroon-700"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <path d="M4 20h4L18 10l-4-4L4 16v4Z" />
                  <path d="M14 6l4 4" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <CategoryModal category={modal.category} onClose={close} />
      )}
    </div>
  );
}
