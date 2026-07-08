"use client"

import { useState } from "react"
import Image from "next/image"
import type { ProductImage } from "@/lib/db/queries"
import { PLACEHOLDER_GRADIENT } from "@/lib/theme"

/**
 * Product image gallery — a large primary frame with a row of selectable
 * thumbnails, matched to the storefront prototype. Seed data ships CSS
 * gradients (`bg`) rather than photos, so each frame falls back to the gradient
 * plus an engraved sunburst motif when no `url` is present. Thumbnails only
 * appear when there is more than one image.
 */
export function ProductGallery({
  images,
  productName,
}: {
  images: ProductImage[]
  productName: string
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = images[activeIndex] ?? null
  const bigBackground = active?.bg ?? PLACEHOLDER_GRADIENT

  return (
    <div className="flex flex-col gap-3.5 md:min-w-[300px] md:flex-1">
      <div
        className="relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-[4px] border border-[#EFE3D0]"
        style={{ background: bigBackground }}
      >
        {active?.url ? (
          <Image
            src={active.url}
            alt={productName}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 600px"
            className="object-cover"
          />
        ) : (
          <>
            <div className="pointer-events-none absolute inset-4 border border-[rgba(168,122,30,0.32)]" />
            <GalleryMotif />
            <span className="mt-4 text-[11px] font-normal uppercase leading-none tracking-[0.12em] text-gold-500">
              Product image — your photo here
            </span>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-3">
          {images.map((img, index) => {
            const isActive = index === activeIndex
            return (
              <button
                key={img.id}
                type="button"
                aria-label={`View image ${index + 1} of ${productName}`}
                aria-pressed={isActive}
                onClick={() => setActiveIndex(index)}
                className={`flex aspect-square items-center justify-center rounded-[3px] border-2 transition-colors ${
                  isActive ? "border-gold-500" : "border-[#EFE3D0] hover:border-gold-300"
                }`}
                style={{ background: img.bg ?? PLACEHOLDER_GRADIENT }}
              >
                {img.url ? <span className="sr-only">Thumbnail {index + 1}</span> : <ThumbMotif />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Large engraved sunburst shown behind a photoless primary image. */
function GalleryMotif() {
  return (
    <svg
      viewBox="0 0 120 120"
      width="120"
      height="120"
      fill="none"
      stroke="#9C7526"
      strokeWidth="1.1"
      className="opacity-80"
      aria-hidden
    >
      <circle cx="60" cy="60" r="44" />
      <circle cx="60" cy="60" r="32" className="opacity-50" />
      <path d="M60 24 L66 54 L60 60 L54 54 Z" fill="#9C7526" stroke="none" />
      <path d="M60 96 L66 66 L60 60 L54 66 Z" fill="#9C7526" stroke="none" />
      <path d="M24 60 L54 54 L60 60 L54 66 Z" fill="#9C7526" stroke="none" />
      <path d="M96 60 L66 54 L60 60 L66 66 Z" fill="#9C7526" stroke="none" />
      <circle cx="60" cy="60" r="3.6" fill="#9C7526" stroke="none" />
    </svg>
  )
}

/** Simple ring glyph for photoless thumbnails. */
function ThumbMotif() {
  return (
    <svg
      viewBox="0 0 120 120"
      width="40"
      height="40"
      fill="none"
      stroke="#A88A55"
      strokeWidth="1.6"
      className="opacity-55"
      aria-hidden
    >
      <circle cx="60" cy="60" r="40" />
      <circle cx="60" cy="60" r="4" fill="#A88A55" stroke="none" />
    </svg>
  )
}
