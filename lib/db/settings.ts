import "server-only"
import { unstable_cache } from "next/cache"
import { cache } from "react"
import { DEFAULT_EMAIL_COPY, type EmailCopy, resolveEmailCopy } from "@/lib/email/copy"
import { DEFAULT_HERO_SETTINGS, type HeroSettings, resolveHeroSettings } from "@/lib/homepage-hero"
import { DEFAULT_RETURN_SETTINGS, resolveReturnSettings, type ReturnSettings } from "@/lib/returns"
import { resolveStoreInfo, type ResolvedStoreInfo } from "@/lib/store-info"
import { CACHE_TAGS, CATALOG_REVALIDATE_SECONDS } from "./cache"
import { publicClient } from "./public"

/**
 * Typed access to the single `setting` row. The `banner` and `homepage_promo`
 * columns are free-form JSON in the DB, so we read them through defaults —
 * the storefront always renders sensible copy even if a field is missing or the
 * shape drifts (mirrors the prototype's `Object.assign({}, DEFAULT, saved)`).
 */

export type BannerSetting = {
  enabled: boolean
  msg1: string
  msg2: string
  offerLabel: string
  offerText: string
  code: string
}

export type PromoSetting = {
  enabled: boolean
  eyebrow: string
  title: string
  code: string
  note: string
  button: string
}

/**
 * The raw, editable `store_info` blob fields flattened for the Settings form
 * (6.15). All strings, empty when unset — the form shows const defaults as
 * placeholders, and `getStoreInfo()` (not this) does the const merge for the
 * storefront. `wordmark`/`socials` live in the blob but aren't edited here yet,
 * so they're preserved by the RPC's shallow merge and omitted from this shape.
 */
export type StoreInfoFields = {
  descriptor: string
  tagline: string
  whatsapp: string
  addressLine: string
  addressCity: string
  addressState: string
  addressNote: string
  hoursShort: string
  hoursLong: string
  hoursNote: string
}

export type StoreSettings = {
  storeName: string
  /** Contact + tax details (Store Information card, 3.11); may be unset. */
  supportEmail: string | null
  phone: string | null
  gstin: string | null
  /** Editable brand/contact blob fields (6.15) — raw, empty when unset. */
  storeInfo: StoreInfoFields
  banner: BannerSetting
  promo: PromoSetting
  /** Shipping & Payments (3.11) — the source of truth for the cart/checkout/place_order. */
  freeShipThresholdPaise: number
  flatRatePaise: number
  codEnabled: boolean
  /** Razorpay live mode — surfaced read-only until the payments phase. */
  razorpayLive: boolean
}

const BANNER_DEFAULT: BannerSetting = {
  enabled: true,
  msg1: "Free shipping over ₹999",
  msg2: "Cash on Delivery available",
  offerLabel: "Festive offer:",
  offerText: "FLAT 20% OFF",
  code: "BRIDE20",
}

const PROMO_DEFAULT: PromoSetting = {
  enabled: true,
  eyebrow: "Festive Season Offer",
  title: "Flat 20% off the entire bridal range",
  code: "BRIDE20",
  note: "at checkout. Limited period.",
  button: "Shop the Sale",
}

const DEFAULT_FREE_SHIP_THRESHOLD_PAISE = 99900
const DEFAULT_FLAT_RATE_PAISE = 7900

/** Coerce an unknown JSON value into a plain string map (empty on mismatch). */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === "string" ? value : undefined
}

/** Collect only the keys present as strings, so undefined never overwrites a default. */
function pickStrings(record: Record<string, unknown>, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of keys) {
    const value = readString(record, key)
    if (value !== undefined) out[key] = value
  }
  return out
}

/** Overlay saved JSON onto a typed default; strings win, `enabled` stays truthy-by-default. */
function mergeBanner(raw: unknown): BannerSetting {
  const record = asRecord(raw)
  return {
    ...BANNER_DEFAULT,
    ...pickStrings(record, ["msg1", "msg2", "offerLabel", "offerText", "code"]),
    enabled: record.enabled !== false,
  }
}

function mergePromo(raw: unknown): PromoSetting {
  const record = asRecord(raw)
  return {
    ...PROMO_DEFAULT,
    ...pickStrings(record, ["eyebrow", "title", "code", "note", "button"]),
    enabled: record.enabled !== false,
  }
}

/** Flatten the raw `store_info` blob into the Settings form fields (6.15). */
function readStoreInfoFields(raw: unknown): StoreInfoFields {
  const blob = asRecord(raw)
  const address = asRecord(blob.address)
  const hours = asRecord(blob.hours)
  const str = (record: Record<string, unknown>, key: string) => readString(record, key) ?? ""
  return {
    descriptor: str(blob, "descriptor"),
    tagline: str(blob, "tagline"),
    whatsapp: str(blob, "whatsappE164"),
    addressLine: str(address, "line"),
    addressCity: str(address, "city"),
    addressState: str(address, "state"),
    addressNote: str(address, "note"),
    hoursShort: str(hours, "short"),
    hoursLong: str(hours, "long"),
    hoursNote: str(hours, "note"),
  }
}

/**
 * The store's public settings (banner, homepage promo, free-ship threshold).
 * Cached across requests (tag `settings`, expired by the admin settings save)
 * and `React.cache`d within one: the storefront layout and several pages each
 * call this during the same render.
 */
export const getStoreSettings = cache(
  unstable_cache(
    async (): Promise<StoreSettings> => {
      const { data, error } = await publicClient
        .from("setting")
        .select(
          "store_name, support_email, phone, gstin, store_info, banner, homepage_promo, free_ship_threshold_paise, flat_rate_paise, cod_enabled, razorpay_live",
        )
        .maybeSingle()

      if (error) {
        throw new Error(`getStoreSettings failed: ${error.message}`)
      }

      return {
        storeName: data?.store_name ?? "RJ Jewellers",
        supportEmail: data?.support_email ?? null,
        phone: data?.phone ?? null,
        gstin: data?.gstin ?? null,
        storeInfo: readStoreInfoFields(data?.store_info),
        banner: mergeBanner(data?.banner),
        promo: mergePromo(data?.homepage_promo),
        freeShipThresholdPaise:
          data?.free_ship_threshold_paise ?? DEFAULT_FREE_SHIP_THRESHOLD_PAISE,
        flatRatePaise: data?.flat_rate_paise ?? DEFAULT_FLAT_RATE_PAISE,
        codEnabled: data?.cod_enabled ?? true,
        razorpayLive: data?.razorpay_live ?? false,
      }
    },
    ["getStoreSettings"],
    { tags: [CACHE_TAGS.settings], revalidate: CATALOG_REVALIDATE_SECONDS },
  ),
)

/**
 * The store's resolved identity/contact (TASKS 6.15) — the DB-backed successor
 * to reading the `STORE_INFO` const directly. Merges the editable scalar
 * columns + the `store_info` jsonb blob over the const (which stays as the
 * fallback + seed), re-deriving `tel:`/`mailto:`/`wa.me` links. Cached like
 * `getStoreSettings` (same `settings` tag, expired on the admin save) and
 * `React.cache`d within a render. Never throws to callers — on a read error it
 * falls back to the pure const so the storefront chrome always renders.
 */
export const getStoreInfo = cache(
  unstable_cache(
    async (): Promise<ResolvedStoreInfo> => {
      const { data } = await publicClient
        .from("setting")
        .select("store_name, support_email, phone, gstin, store_info")
        .maybeSingle()

      return resolveStoreInfo({
        storeName: data?.store_name,
        supportEmail: data?.support_email,
        phone: data?.phone,
        gstin: data?.gstin,
        storeInfo: data?.store_info,
      })
    },
    ["getStoreInfo"],
    { tags: [CACHE_TAGS.settings], revalidate: CATALOG_REVALIDATE_SECONDS },
  ),
)

/**
 * The RAW saved `email_copy` blob — the admin Emails form seed (empty fields =
 * unset). Deliberately NOT part of `getStoreSettings`: that read feeds every
 * storefront page, and it must keep working when this code ships before
 * migration 0042 lands. Tolerant of the column not existing yet (returns {},
 * so the form shows all defaults); uncached — an admin-only read that should
 * always reflect the latest save.
 */
export async function getRawEmailCopy(): Promise<unknown> {
  const { data, error } = await publicClient.from("setting").select("email_copy").maybeSingle()
  if (error) {
    console.error("getRawEmailCopy failed (email_copy column missing? apply 0042):", error.message)
    return {}
  }
  return data?.email_copy ?? {}
}

/**
 * The resolved email verbiage (TASKS 7.3): the operator's saved `email_copy`
 * overrides merged over the code defaults. Cached like `getStoreInfo` (same
 * `settings` tag, expired by the admin save) and `React.cache`d within a
 * render. Never throws — on a read error (including the 0042 column not yet
 * applied) the emails fall back to the const defaults, since a copy hiccup
 * must never block a send.
 */
/**
 * The store's returns policy (TASKS 8.7): window days + shipping payer from
 * the `setting.returns` blob, resolved over the code defaults. Deliberately
 * NOT part of `getStoreSettings` (the 0042/email_copy lesson — that select
 * feeds every storefront page and must survive code shipping before the 0043
 * migration). Cached like `getEmailCopy` (same `settings` tag, expired by the
 * admin save); never throws — a broken read falls back to the defaults.
 */
export const getReturnSettings = cache(
  unstable_cache(
    async (): Promise<ReturnSettings> => {
      try {
        const { data, error } = await publicClient.from("setting").select("returns").maybeSingle()
        if (error) {
          console.error("getReturnSettings failed (returns column missing? apply 0043):", error.message)
          return DEFAULT_RETURN_SETTINGS
        }
        return resolveReturnSettings(data?.returns)
      } catch (error: unknown) {
        console.error("getReturnSettings failed, using defaults", error)
        return DEFAULT_RETURN_SETTINGS
      }
    },
    ["getReturnSettings"],
    { tags: [CACHE_TAGS.settings], revalidate: CATALOG_REVALIDATE_SECONDS },
  ),
)

/**
 * The homepage hero's operator-managed fields (TASKS 9.3) — today just the
 * uploaded photo URL. Deliberately NOT part of `getStoreSettings` (the
 * 0042/email_copy lesson: that select feeds every storefront page and must
 * survive code shipping before migration 0044). Cached like the other
 * settings reads (same `settings` tag, expired by the admin save); never
 * throws — a broken read falls back to the placeholder card.
 */
export const getHeroSettings = cache(
  unstable_cache(
    async (): Promise<HeroSettings> => {
      try {
        const { data, error } = await publicClient
          .from("setting")
          .select("homepage_hero")
          .maybeSingle()
        if (error) {
          console.error("getHeroSettings failed (homepage_hero column missing? apply 0044):", error.message)
          return DEFAULT_HERO_SETTINGS
        }
        return resolveHeroSettings(data?.homepage_hero)
      } catch (error: unknown) {
        console.error("getHeroSettings failed, using defaults", error)
        return DEFAULT_HERO_SETTINGS
      }
    },
    ["getHeroSettings"],
    { tags: [CACHE_TAGS.settings], revalidate: CATALOG_REVALIDATE_SECONDS },
  ),
)

export const getEmailCopy = cache(
  unstable_cache(
    async (): Promise<EmailCopy> => {
      try {
        const { data } = await publicClient.from("setting").select("email_copy").maybeSingle()
        return resolveEmailCopy(data?.email_copy)
      } catch (error: unknown) {
        console.error("getEmailCopy failed, using default copy", error)
        return DEFAULT_EMAIL_COPY
      }
    },
    ["getEmailCopy"],
    { tags: [CACHE_TAGS.settings], revalidate: CATALOG_REVALIDATE_SECONDS },
  ),
)
