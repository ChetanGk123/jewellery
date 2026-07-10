/**
 * Client-safe settings-form schema + mappers (TASKS 3.11). Shared by the client
 * `SettingsView` (holds the form state) and the `updateStoreSettings` server
 * action (validates + builds the RPC payload) so the two can't drift. Type-only
 * imports from the server-only `lib/db/settings` are erased at build, so this
 * module stays safe to include in the client bundle.
 *
 * Money is edited in whole rupees for the operator and converted to integer
 * paise at the boundary (the DB stores paise; see CLAUDE.md §2).
 */

import { z } from "zod"
import type { BannerSetting, PromoSetting, StoreInfoFields, StoreSettings } from "@/lib/db/settings"
import type { Json } from "@/lib/db/types"
import { type HeroSettings, heroSettingsToBlob } from "@/lib/homepage-hero"
import { type ReturnSettings, returnSettingsToBlob } from "@/lib/returns"

const optionalText = (max: number) => z.string().trim().max(max)

export const settingsFormSchema = z.object({
  storeName: z.string().trim().min(1, "Store name is required.").max(120),
  supportEmail: optionalText(160).refine(
    (v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
    "Enter a valid email address.",
  ),
  phone: optionalText(40),
  gstin: optionalText(20),
  storeInfo: z.object({
    descriptor: optionalText(120),
    tagline: optionalText(300),
    whatsapp: optionalText(20),
    addressLine: optionalText(160),
    addressCity: optionalText(80),
    addressState: optionalText(80),
    addressNote: optionalText(120),
    hoursShort: optionalText(120),
    hoursLong: optionalText(160),
    hoursNote: optionalText(200),
  }),
  freeShipThresholdRupees: z
    .number()
    .int("Whole rupees only.")
    .min(0, "Can't be negative.")
    .max(10_000_000),
  flatRateRupees: z.number().int("Whole rupees only.").min(0, "Can't be negative.").max(1_000_000),
  codEnabled: z.boolean(),
  returns: z.object({
    windowDays: z
      .number()
      .int("Whole days only.")
      .min(0, "Can't be negative.")
      .max(365, "A year is the most the window can be."),
    shippingPayer: z.enum(["customer", "store", "store_for_defects"]),
  }),
  // The hero photo URL comes from the uploadHeroImage action, never typed by
  // hand; "" means "no photo — show the placeholder card".
  hero: z.object({
    imageUrl: optionalText(600),
  }),
  banner: z.object({
    enabled: z.boolean(),
    msg1: optionalText(160),
    msg2: optionalText(160),
    offerLabel: optionalText(80),
    offerText: optionalText(80),
    code: optionalText(40),
  }),
  promo: z.object({
    enabled: z.boolean(),
    eyebrow: optionalText(120),
    title: optionalText(200),
    button: optionalText(60),
    code: optionalText(40),
    note: optionalText(200),
  }),
})

export type SettingsFormValues = z.infer<typeof settingsFormSchema>

const RUPEE = 100

/**
 * Seed the form from the loaded store settings (paise → rupees). The returns
 * policy and hero arrive separately — their columns are deliberately outside
 * the shared `getStoreSettings` select (see `getReturnSettings` 8.7,
 * `getHeroSettings` 9.3).
 */
export function settingsToFormValues(
  s: StoreSettings,
  returns: ReturnSettings,
  hero: HeroSettings,
): SettingsFormValues {
  return {
    storeName: s.storeName,
    supportEmail: s.supportEmail ?? "",
    phone: s.phone ?? "",
    gstin: s.gstin ?? "",
    storeInfo: storeInfoValues(s.storeInfo),
    freeShipThresholdRupees: Math.round(s.freeShipThresholdPaise / RUPEE),
    flatRateRupees: Math.round(s.flatRatePaise / RUPEE),
    codEnabled: s.codEnabled,
    returns: { windowDays: returns.windowDays, shippingPayer: returns.shippingPayer },
    hero: { imageUrl: hero.imageUrl ?? "" },
    banner: bannerValues(s.banner),
    promo: promoValues(s.promo),
  }
}

/** The blob fields are already flat strings — pass straight through (6.15). */
function storeInfoValues(s: StoreInfoFields): SettingsFormValues["storeInfo"] {
  return {
    descriptor: s.descriptor,
    tagline: s.tagline,
    whatsapp: s.whatsapp,
    addressLine: s.addressLine,
    addressCity: s.addressCity,
    addressState: s.addressState,
    addressNote: s.addressNote,
    hoursShort: s.hoursShort,
    hoursLong: s.hoursLong,
    hoursNote: s.hoursNote,
  }
}

function bannerValues(b: BannerSetting): SettingsFormValues["banner"] {
  return {
    enabled: b.enabled,
    msg1: b.msg1,
    msg2: b.msg2,
    offerLabel: b.offerLabel,
    offerText: b.offerText,
    code: b.code,
  }
}

function promoValues(p: PromoSetting): SettingsFormValues["promo"] {
  return {
    enabled: p.enabled,
    eyebrow: p.eyebrow,
    title: p.title,
    button: p.button,
    code: p.code,
    note: p.note,
  }
}

/** Build the `admin_update_settings` RPC payload (rupees → paise, banner/promo JSON). */
export function formValuesToPayload(v: SettingsFormValues): Json {
  return {
    store_name: v.storeName,
    support_email: v.supportEmail.trim(),
    phone: v.phone.trim(),
    gstin: v.gstin.trim(),
    // 6.15 — shallow-merged server-side, so wordmark/socials are preserved.
    // Nested address/hours are sent whole (the || merge replaces them wholesale).
    store_info: {
      descriptor: v.storeInfo.descriptor.trim(),
      tagline: v.storeInfo.tagline.trim(),
      whatsappE164: v.storeInfo.whatsapp.replace(/\D/g, ""),
      address: {
        line: v.storeInfo.addressLine.trim(),
        city: v.storeInfo.addressCity.trim(),
        state: v.storeInfo.addressState.trim(),
        note: v.storeInfo.addressNote.trim(),
      },
      hours: {
        short: v.storeInfo.hoursShort.trim(),
        long: v.storeInfo.hoursLong.trim(),
        note: v.storeInfo.hoursNote.trim(),
      },
    },
    free_ship_threshold_paise: Math.round(v.freeShipThresholdRupees * RUPEE),
    flat_rate_paise: Math.round(v.flatRateRupees * RUPEE),
    cod_enabled: v.codEnabled,
    returns: returnSettingsToBlob(v.returns),
    homepage_hero: heroSettingsToBlob({ imageUrl: v.hero.imageUrl.trim() || null }),
    banner: {
      enabled: v.banner.enabled,
      msg1: v.banner.msg1.trim(),
      msg2: v.banner.msg2.trim(),
      offerLabel: v.banner.offerLabel.trim(),
      offerText: v.banner.offerText.trim(),
      code: v.banner.code.trim(),
    },
    homepage_promo: {
      enabled: v.promo.enabled,
      eyebrow: v.promo.eyebrow.trim(),
      title: v.promo.title.trim(),
      button: v.promo.button.trim(),
      code: v.promo.code.trim(),
      note: v.promo.note.trim(),
    },
  }
}
