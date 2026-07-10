"use client"

import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"
import { requestReturn } from "@/app/(storefront)/account/orders/actions"
import { MAX_RETURN_PHOTOS, RETURN_PHOTO_MAX_BYTES, type ReturnResolution } from "@/lib/returns"

type Props = {
  orderNo: string
  /** Last day of the return window, pre-formatted for display. */
  deadlineLabel: string
  /** Who-pays-shipping note from the store's returns settings. */
  shippingNote: string
}

type PhotoPick = { file: File; previewUrl: string }

/**
 * "Request return" on a Delivered order inside its return window (TASKS 8.7c).
 * Collapsed to a single button until the customer opens it — the form asks for
 * the reason, refund-to-UPI vs exchange, and 1–3 REQUIRED photos (operator
 * decision). Client checks are UX only; the server action and the
 * `customer_request_return` RPC re-verify everything.
 */
export function RequestReturnForm({ orderNo, deadlineLabel, shippingNote }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [resolution, setResolution] = useState<ReturnResolution>("refund")
  const [photos, setPhotos] = useState<PhotoPick[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handlePickPhotos(files: FileList | null) {
    if (!files) return
    setError(null)
    const next = [...photos]
    for (const file of Array.from(files)) {
      if (next.length >= MAX_RETURN_PHOTOS) break
      if (!file.type.startsWith("image/")) {
        setError("Photos must be image files.")
        continue
      }
      if (file.size > RETURN_PHOTO_MAX_BYTES) {
        setError("Each photo must be under 5 MB.")
        continue
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) })
    }
    setPhotos(next)
    // Allow re-picking the same file after a removal.
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photos[index].previewUrl)
    setPhotos(photos.filter((_, i) => i !== index))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (photos.length === 0) {
      setError("Please attach at least one photo of the item.")
      return
    }

    const formData = new FormData(event.currentTarget)
    formData.set("orderNo", orderNo)
    formData.delete("photos")
    for (const photo of photos) {
      formData.append("photos", photo.file)
    }

    startTransition(async () => {
      const result = await requestReturn(formData)
      if (!result.ok) {
        setError(result.error)
        return
      }
      for (const photo of photos) URL.revokeObjectURL(photo.previewUrl)
      router.refresh()
    })
  }

  if (!isOpen) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="self-start rounded-sm border border-[#D9C49A] bg-white px-5 py-2.5 text-[12px] font-semibold uppercase leading-none tracking-[0.08em] text-maroon-700 transition-colors hover:bg-[#FBF6EE]"
        >
          Request Return
        </button>
        <span className="text-[12px] leading-relaxed text-[#8A7E74]">
          Returns accepted until {deadlineLabel}.
        </span>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded border border-[#E7D9C2] bg-[#FFFDF8] p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.1em] text-gold-600">
          Request Return
        </span>
        <span className="text-[11.5px] leading-none text-[#8A7E74]">Until {deadlineLabel}</span>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-maroon-900">
          What went wrong? <span className="text-[#B23A48]">*</span>
        </span>
        <textarea
          name="reason"
          required
          maxLength={1000}
          rows={3}
          disabled={isPending}
          placeholder="Tell us what's wrong with the piece — damaged, not as pictured, wrong item…"
          className="rounded-sm border border-[#E7D9C2] bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-maroon-900 outline-none transition-colors placeholder:text-[#B4A89C] focus:border-gold-600"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[12.5px] font-medium text-maroon-900">
          How should we make it right?
        </legend>
        <div className="flex flex-wrap gap-2.5">
          {(
            [
              { value: "refund", label: "Refund to my UPI" },
              { value: "exchange", label: "Exchange the piece" },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-2 rounded-sm border px-4 py-2.5 text-[12.5px] font-medium transition-colors ${
                resolution === option.value
                  ? "border-maroon-700 bg-[#FBF6EE] text-maroon-900"
                  : "border-[#E7D9C2] bg-white text-[#5E4A44] hover:border-[#D9C49A]"
              }`}
            >
              <input
                type="radio"
                name="resolution"
                value={option.value}
                checked={resolution === option.value}
                onChange={() => setResolution(option.value)}
                disabled={isPending}
                className="accent-[#71182B]"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {resolution === "refund" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-maroon-900">
            UPI ID for the refund <span className="text-[#B23A48]">*</span>
          </span>
          <input
            type="text"
            name="upiId"
            required
            disabled={isPending}
            placeholder="name@bank"
            autoComplete="off"
            className="max-w-[280px] rounded-sm border border-[#E7D9C2] bg-white px-3.5 py-2.5 text-[13px] text-maroon-900 outline-none transition-colors placeholder:text-[#B4A89C] focus:border-gold-600"
          />
          <span className="text-[11.5px] leading-relaxed text-[#8A7E74]">
            Cash on Delivery refunds are paid manually to this UPI ID once we receive the item.
          </span>
        </label>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[12.5px] font-medium text-maroon-900">
          Photos of the item <span className="text-[#B23A48]">*</span>
          <span className="ml-1 font-normal text-[#8A7E74]">(1–{MAX_RETURN_PHOTOS}, required)</span>
        </span>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2.5">
            {photos.map((photo, i) => (
              <div key={photo.previewUrl} className="relative">
                {/* Local object-URL preview of the customer's own pick. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl}
                  alt={`Return photo ${i + 1}`}
                  className="h-16 w-16 rounded-sm border border-[#E7D9C2] object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  disabled={isPending}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-maroon-700 text-[10px] leading-none text-white transition-opacity hover:opacity-90"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {photos.length < MAX_RETURN_PHOTOS && (
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-sm border border-dashed border-[#D9C49A] bg-white px-4 py-2.5 text-[12px] font-medium text-[#5E4A44] transition-colors hover:bg-[#FBF6EE]">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              disabled={isPending}
              onChange={(e) => handlePickPhotos(e.target.files)}
              className="sr-only"
            />
            + Add photo{photos.length === 0 ? "s" : ""}
          </label>
        )}
      </div>

      <p className="m-0 rounded-sm bg-[#FBF6EE] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#5E4A44]">
        {shippingNote}
      </p>

      {error && <p className="m-0 text-[12.5px] text-[#B23A48]">{error}</p>}

      <div className="flex gap-2.5">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-sm bg-maroon-700 px-5 py-2.5 text-[12px] font-semibold uppercase leading-none tracking-[0.08em] text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? "Submitting…" : "Submit Request"}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          disabled={isPending}
          className="rounded-sm border border-[#E7D9C2] bg-white px-5 py-2.5 text-[12px] font-semibold uppercase leading-none tracking-[0.08em] text-[#5E4A44] transition-colors hover:bg-cream-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
