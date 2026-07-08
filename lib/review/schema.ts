import { z } from "zod"

/** Shared bounds so the client hint and server validation never drift. */
export const REVIEW_BODY_MIN = 10
export const REVIEW_BODY_MAX = 1000

/** Customer review submission (TASKS 4.15) — validated identically client + server. */
export const reviewSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80, "Name is too long."),
  rating: z.number().int().min(1, "Choose a star rating.").max(5),
  title: z.string().trim().max(120, "Keep the title under 120 characters.").optional(),
  body: z
    .string()
    .trim()
    .min(REVIEW_BODY_MIN, `Write at least ${REVIEW_BODY_MIN} characters.`)
    .max(REVIEW_BODY_MAX, `Keep it under ${REVIEW_BODY_MAX} characters.`),
})

export type ReviewFormValues = z.infer<typeof reviewSchema>
