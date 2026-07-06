"use client";

import { useState, useTransition } from "react";
import { REVIEW_BODY_MIN } from "@/lib/review/schema";
import { submitReview } from "@/app/(storefront)/product/[slug]/actions";
import { StarRatingInput } from "./StarRatingInput";

type Props = {
  productId: string;
  /** Verified-purchase gate (implies signed-in) — false renders nothing. */
  hasPurchased: boolean;
  prefillName: string;
};

/**
 * "Write a review" form on the product detail page (TASKS 4.15). Only ever
 * shown to a customer with a Delivered order for this product — no sign-in
 * prompt or "buy it first" notice for anyone else, the section simply isn't
 * there. Submits via the `submitReview` action into the existing moderation
 * queue (0014) — a submitted review never appears immediately (it lands
 * `pending`), so success is a static confirmation, not a list update.
 */
export function ReviewForm({ productId, hasPurchased, prefillName }: Props) {
  const [name, setName] = useState(prefillName);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!hasPurchased) {
    return null;
  }

  if (isSubmitted) {
    return (
      <div className="mt-8 rounded-[3px] border border-gold-300 bg-cream-50 p-6 text-center">
        <p className="m-0 text-[13.5px] font-medium leading-normal text-maroon-900">
          Thanks for your review! It'll appear here once it's approved.
        </p>
      </div>
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await submitReview(productId, { name, rating, title, body });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setFormError(result.formError ?? null);
        return;
      }
      setIsSubmitted(true);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 flex flex-col gap-4 rounded-[3px] border border-[#EFE3D0] bg-cream-50 p-6"
    >
      <h3 className="m-0 font-heading text-[20px] font-semibold leading-none text-maroon-900">
        Write a Review
      </h3>

      {formError && <p className="m-0 text-[13px] text-[#B23A48]">{formError}</p>}

      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold uppercase leading-none tracking-[0.1em] text-maroon-900">
          Your Rating
        </span>
        <StarRatingInput value={rating} onChange={setRating} />
        {fieldErrors.rating && (
          <span className="text-[12px] text-[#B23A48]">{fieldErrors.rating}</span>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold uppercase leading-none tracking-[0.1em] text-maroon-900">
          Your Name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-sm border border-[#E7D9C2] bg-white px-3.5 py-2.5 text-[13.5px] text-maroon-900 outline-none focus:border-gold-400"
        />
        {fieldErrors.name && (
          <span className="text-[12px] text-[#B23A48]">{fieldErrors.name}</span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold uppercase leading-none tracking-[0.1em] text-maroon-900">
          Title (optional)
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-sm border border-[#E7D9C2] bg-white px-3.5 py-2.5 text-[13.5px] text-maroon-900 outline-none focus:border-gold-400"
        />
        {fieldErrors.title && (
          <span className="text-[12px] text-[#B23A48]">{fieldErrors.title}</span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold uppercase leading-none tracking-[0.1em] text-maroon-900">
          Your Review
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder={`At least ${REVIEW_BODY_MIN} characters`}
          className="resize-none rounded-sm border border-[#E7D9C2] bg-white px-3.5 py-2.5 text-[13.5px] text-maroon-900 outline-none focus:border-gold-400"
        />
        {fieldErrors.body && (
          <span className="text-[12px] text-[#B23A48]">{fieldErrors.body}</span>
        )}
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-sm bg-maroon-700 px-[26px] py-3 text-[12px] font-semibold uppercase leading-none tracking-[0.12em] text-cream-200 transition-colors hover:bg-maroon-800 disabled:opacity-60"
      >
        {isPending ? "Submitting…" : "Submit Review"}
      </button>
    </form>
  );
}
