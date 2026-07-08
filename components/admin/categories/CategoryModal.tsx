"use client"

import { useRef, useState, useTransition } from "react"
import {
  deleteCategory,
  uploadCategoryImage,
  upsertCategory,
} from "@/app/(admin)/admin/(console)/categories/actions"
import { useDialog } from "@/hooks/useDialog"
import type { AdminCategoryRow } from "@/lib/admin/category"
import { PLACEHOLDER_GRADIENT } from "@/lib/theme"

type Props = {
  category: AdminCategoryRow | null
  onClose: () => void
}

/**
 * Add/edit category modal (prototype-matched — 440px card, name + description,
 * Delete on edit). Delete is two-step: the first click arms a confirm so a
 * destructive action can't fire on a single misclick. The parent owns the list
 * refresh via revalidatePath in the action.
 */
export function CategoryModal({ category, onClose }: Props) {
  const editing = category !== null
  const [name, setName] = useState(category?.name ?? "")
  const [description, setDescription] = useState(category?.description ?? "")
  const [imageUrl, setImageUrl] = useState<string | null>(category?.imageUrl ?? null)
  const [isUploading, setIsUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const dialogRef = useDialog<HTMLDivElement>({
    isOpen: true,
    onDismiss: onClose,
    isPending,
  })

  const onSave = () => {
    setError(null)
    startTransition(async () => {
      const res = await upsertCategory({
        id: category?.id ?? null,
        name,
        description,
        imageUrl,
      })
      if (res.ok) onClose()
      else setError(res.error ?? "Couldn't save the category.")
    })
  }

  // Photo → shared admin Storage pipeline (6.11); the URL is stored on Save.
  const onPickFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setIsUploading(true)
    try {
      const fd = new FormData()
      fd.set("file", file)
      const res = await uploadCategoryImage(fd)
      if (res.ok && res.url) setImageUrl(res.url)
      else setError(res.error ?? "Upload failed. Please try again.")
    } finally {
      setIsUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const onDelete = () => {
    if (!category) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await deleteCategory(category.id)
      if (res.ok) onClose()
      else {
        setConfirmDelete(false)
        setError(res.error ?? "Couldn't delete the category.")
      }
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
        aria-label={editing ? "Edit category" : "New category"}
        tabIndex={-1}
        className="w-[440px] max-w-full overflow-hidden rounded-[14px] bg-[#F8F5EF] shadow-[0_30px_70px_rgba(42,10,18,0.3)] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E7E0D4] bg-white px-[26px] py-[22px]">
          <h2 className="font-heading text-[22px] leading-none text-[#2A1F1A]">
            {editing ? "Edit Category" : "New Category"}
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
          <label className="font-body text-[12px] font-medium text-[#8A7E74]">
            Category name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bridal Sets"
              autoFocus
              className="mt-1.5 block w-full rounded-lg border border-[#E7E0D4] bg-white px-[13px] py-3 font-body text-[14px] text-[#2A1F1A] outline-none focus:border-gold-400"
            />
          </label>
          <label className="font-body text-[12px] font-medium text-[#8A7E74]">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description shown on the storefront"
              className="mt-1.5 block min-h-[64px] w-full resize-y rounded-lg border border-[#E7E0D4] bg-white px-[13px] py-3 font-body text-[14px] leading-relaxed text-[#2A1F1A] outline-none focus:border-gold-400"
            />
          </label>

          {/* Tile photo (6.11) — shown on the storefront category tile;
              without one the tile keeps its gradient. */}
          <div className="font-body text-[12px] font-medium text-[#8A7E74]">
            Tile photo <span className="font-normal text-[#A99C90]">(optional)</span>
            <div className="mt-1.5 flex items-center gap-3">
              <span
                aria-hidden="true"
                className="h-[64px] w-[64px] flex-none rounded-lg border border-[#E7E0D4] bg-cover bg-center"
                style={
                  imageUrl
                    ? { backgroundImage: `url(${imageUrl})` }
                    : { background: category?.heroBg ?? PLACEHOLDER_GRADIENT }
                }
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={isUploading || isPending}
                className="rounded-lg border border-[#DAD0C2] bg-white px-3.5 py-2 font-body text-[12px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2] disabled:opacity-60"
              >
                {isUploading ? "Uploading…" : imageUrl ? "Replace photo" : "Upload photo"}
              </button>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  disabled={isUploading || isPending}
                  className="font-body text-[12px] font-semibold text-[#C0392F] hover:underline disabled:opacity-60"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-[#F0C8CE] bg-[#FBE9E7] px-3 py-2.5 font-body text-[12.5px] leading-snug text-[#C0392F]">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2.5 border-t border-[#E7E0D4] bg-white px-[26px] py-[18px]">
          {editing && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className="mr-auto rounded-lg border border-[#E0B7B2] bg-white px-[18px] py-[11px] font-body text-[12px] font-semibold text-[#C0392F] transition-colors hover:bg-[#FBE9E7] disabled:opacity-60"
            >
              {confirmDelete ? "Confirm delete?" : "Delete"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="ml-auto rounded-lg border border-[#DAD0C2] bg-white px-5 py-[11px] font-body text-[12px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isPending}
            className="rounded-lg bg-maroon-700 px-6 py-[11px] font-body text-[12px] font-semibold text-cream-200 transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Saving…" : editing ? "Save Changes" : "Add Category"}
          </button>
        </div>
      </div>
    </div>
  )
}
