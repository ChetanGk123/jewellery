"use server"

import { type ProfileValues, profileSchema } from "@/lib/account/profile"
import { upsertCustomerProfile } from "@/lib/db/profile"
import { getCurrentUser } from "@/lib/db/server"

export type SaveProfileResult =
  | { ok: true }
  | {
      ok: false
      fieldErrors: Partial<Record<keyof ProfileValues, string>>
      formError?: string
    }

/**
 * Save the signed-in customer's profile (name/phone/default address). Session
 * is re-checked here — client gating is UX only — and RLS enforces row
 * ownership underneath even if this check were bypassed.
 */
export async function saveProfile(input: unknown): Promise<SaveProfileResult> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      ok: false,
      fieldErrors: {},
      formError: "Your session has expired. Please sign in again.",
    }
  }

  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors
    const fieldErrors: Partial<Record<keyof ProfileValues, string>> = {}
    for (const [key, messages] of Object.entries(flat)) {
      const first = messages?.[0]
      if (first) fieldErrors[key as keyof ProfileValues] = first
    }
    return {
      ok: false,
      fieldErrors,
      formError: "Please correct the highlighted fields and try again.",
    }
  }

  const result = await upsertCustomerProfile(user.id, parsed.data)
  if (!result.ok) {
    return {
      ok: false,
      fieldErrors: {},
      formError: "We couldn't save your details just now. Please try again.",
    }
  }

  return { ok: true }
}
