/**
 * Store info — the single source of truth for the business's own identity and
 * contact details (name, tagline, phone, WhatsApp, email, address, GSTIN,
 * socials). Every storefront surface reads from here, so any of these change in
 * ONE place instead of being edited across the footer, header, contact page,
 * help copy, and product enquiry links.
 *
 * These are static brand constants (identical across environments), so they live
 * as `const`s rather than env vars. Store-EDITABLE copy (announcement banner,
 * homepage promo, DB display name) is DB-backed via `getStoreSettings` (the
 * `setting` table) — keep the two concerns separate.
 *
 * The `tel:` / `mailto:` / `wa.me` link forms are DERIVED from the raw handle so
 * the dialable link and the human-readable display can never drift apart.
 */

/** Full phone in E.164 digits (country code + number, no spaces or symbols). */
const PHONE_E164 = "919972777455"
const PHONE_DISPLAY = "+91 99727 77455"
const EMAIL = "care@rjjewellers.in"

export type SocialLink = {
  label: string
  /** Short glyph shown in the footer badge. */
  glyph: string
  /** Public profile URL, or null until the real handle is available. */
  href: string | null
}

export const STORE_INFO = {
  /** Legal / display name, e.g. in the copyright line. */
  name: "RJ Jewellers",
  /** Uppercase wordmark used in the header and footer lockups. */
  wordmark: "RJ JEWELLERS",
  /** One-line descriptor shown under the wordmark. */
  descriptor: "Artificial Bridal Jewellery",
  /** Longer brand blurb (footer). */
  tagline:
    "Handcrafted artificial bridal jewellery — Kundan, polki, temple & pearl. Made in India, shipped nationwide.",

  phone: {
    display: PHONE_DISPLAY,
    href: `tel:+${PHONE_E164}`,
  },
  whatsapp: {
    /** E.164 digits, for building wa.me / prefilled enquiry links (see 2.7). */
    number: PHONE_E164,
    href: `https://wa.me/${PHONE_E164}`,
  },
  email: {
    display: EMAIL,
    href: `mailto:${EMAIL}`,
  },
  address: {
    line: "RJ Jewellers, Jaipur, Rajasthan",
    city: "Jaipur",
    state: "Rajasthan",
    /** Visiting note. */
    note: "By appointment",
  },
  hours: {
    /** Compact form, e.g. beneath a phone number. */
    short: "Mon–Sat, 10am–7pm",
    /** Full form with timezone. */
    long: "Mon–Sat · 10:00 AM – 7:00 PM IST",
    note: "WhatsApp messages answered all week.",
  },
  /** GST registration number — null until it's available to display. */
  gstin: null as string | null,

  socials: [
    { label: "Facebook", glyph: "f", href: null },
    { label: "Instagram", glyph: "♢", href: null },
    { label: "WhatsApp", glyph: "💬", href: `https://wa.me/${PHONE_E164}` },
  ] as SocialLink[],
} as const

/* ----------------------- Settings-driven resolution (6.15) ---------------- */

/**
 * The store's identity/contact, fully resolved — same shape as `STORE_INFO`
 * but with all fields widened to `string` (they may come from the DB). Every
 * consumer that used to read `STORE_INFO` reads this instead (via the
 * server-only `getStoreInfo()`), so the operator can edit these in Settings.
 */
export type ResolvedStoreInfo = {
  name: string
  wordmark: string
  descriptor: string
  tagline: string
  phone: { display: string; href: string }
  whatsapp: { number: string; href: string }
  email: { display: string; href: string }
  address: { line: string; city: string; state: string; note: string }
  hours: { short: string; long: string; note: string }
  gstin: string | null
  socials: SocialLink[]
}

/**
 * DB-side overrides for `resolveStoreInfo`. `storeName`/`supportEmail`/`phone`/
 * `gstin` are the existing scalar `setting` columns (already editable, 3.11);
 * `storeInfo` is the free-form `store_info` jsonb blob (6.15) holding the
 * fields with no scalar column yet. All optional — anything absent, blank, or
 * malformed falls back to the `STORE_INFO` const so the storefront is never
 * blanked.
 */
export type StoreInfoInput = {
  storeName?: string | null
  supportEmail?: string | null
  phone?: string | null
  gstin?: string | null
  storeInfo?: unknown
}

/** A trimmed non-empty string, else undefined (so it can't overwrite a default). */
function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

/** Digits only, for building `tel:`/`wa.me` links from a display number. */
function digits(value: string): string {
  return value.replace(/\D/g, "")
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/** Overlay a nested `{line,city,state,note}`-style group; only clean strings win. */
function mergeGroup<T extends Record<string, string>>(base: T, raw: unknown): T {
  const record = asRecord(raw)
  const out = { ...base }
  for (const key of Object.keys(base) as (keyof T)[]) {
    const v = clean(record[key as string])
    if (v !== undefined) out[key] = v as T[keyof T]
  }
  return out
}

/** Default socials with the WhatsApp badge re-pointed at the resolved number. */
function defaultSocials(whatsappNumber: string): SocialLink[] {
  return STORE_INFO.socials.map((social) =>
    social.label === "WhatsApp"
      ? { ...social, href: `https://wa.me/${whatsappNumber}` }
      : { ...social },
  )
}

/** A DB `socials` override is honoured only if it's an array of valid links. */
function mergeSocials(base: SocialLink[], raw: unknown): SocialLink[] {
  if (!Array.isArray(raw)) return base
  const parsed: SocialLink[] = []
  for (const item of raw) {
    const r = asRecord(item)
    const label = clean(r.label)
    const glyph = clean(r.glyph)
    if (!label || !glyph) return base // malformed entry → keep the const list
    const href = clean(r.href)
    parsed.push({ label, glyph, href: href ?? null })
  }
  return parsed
}

/**
 * Merge DB overrides over the `STORE_INFO` const into a fully-resolved object,
 * re-deriving the `tel:`/`mailto:`/`wa.me` links from the (possibly edited)
 * raw handles so the dialable link and the display can't drift.
 */
export function resolveStoreInfo(input: StoreInfoInput): ResolvedStoreInfo {
  const blob = asRecord(input.storeInfo)

  const name = clean(input.storeName) ?? STORE_INFO.name
  const wordmark = clean(blob.wordmark) ?? name.toUpperCase()

  const phoneDisplay = clean(input.phone) ?? STORE_INFO.phone.display
  const phoneDigits = digits(phoneDisplay)
  const phoneHref = phoneDigits ? `tel:+${phoneDigits}` : STORE_INFO.phone.href

  const whatsappNumber = clean(blob.whatsappE164) ?? STORE_INFO.whatsapp.number
  const emailDisplay = clean(input.supportEmail) ?? STORE_INFO.email.display

  return {
    name,
    wordmark,
    descriptor: clean(blob.descriptor) ?? STORE_INFO.descriptor,
    tagline: clean(blob.tagline) ?? STORE_INFO.tagline,
    phone: { display: phoneDisplay, href: phoneHref },
    whatsapp: { number: whatsappNumber, href: `https://wa.me/${whatsappNumber}` },
    email: { display: emailDisplay, href: `mailto:${emailDisplay}` },
    address: mergeGroup({ ...STORE_INFO.address }, blob.address),
    hours: mergeGroup({ ...STORE_INFO.hours }, blob.hours),
    gstin: clean(input.gstin) ?? STORE_INFO.gstin,
    socials: mergeSocials(defaultSocials(whatsappNumber), blob.socials),
  }
}

/**
 * The const resolved with no DB overrides — the fallback for pure builders
 * (email templates) whose caller may not have fetched `getStoreInfo()`.
 */
export const DEFAULT_STORE_INFO: ResolvedStoreInfo = resolveStoreInfo({})
