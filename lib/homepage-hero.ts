/**
 * The homepage hero's settings blob (`setting.homepage_hero`, TASKS 9.1) —
 * the `lib/returns.ts` pattern: a tolerant resolver over code defaults plus
 * the inverse blob builder for the `admin_update_settings` payload. Only the
 * photo is operator-managed for now; the rest of the hero (copy, CTAs) stays
 * in code, and future fields ride this same blob. Client-safe (no imports).
 */

export type HeroSettings = {
  /** Public bucket URL of the uploaded hero photo; null shows the placeholder card. */
  imageUrl: string | null
}

export const DEFAULT_HERO_SETTINGS: HeroSettings = {
  imageUrl: null,
}

/**
 * Resolve the raw `setting.homepage_hero` jsonb — tolerant of any shape (the
 * 0042/email_copy lesson: a settings read must never take the storefront
 * down). Blob keys are snake_case like the other setting blobs.
 */
export function resolveHeroSettings(raw: unknown): HeroSettings {
  const record =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}

  const url = typeof record.image_url === "string" ? record.image_url.trim() : ""
  return { imageUrl: url === "" ? null : url }
}

/** Build the `setting.homepage_hero` blob for the `admin_update_settings` payload. */
export function heroSettingsToBlob(settings: HeroSettings): { image_url: string } {
  return { image_url: settings.imageUrl ?? "" }
}
