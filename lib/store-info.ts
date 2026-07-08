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
