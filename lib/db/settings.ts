import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { CACHE_TAGS, CATALOG_REVALIDATE_SECONDS } from "./cache";
import { publicClient } from "./public";

/**
 * Typed access to the single `setting` row. The `banner` and `homepage_promo`
 * columns are free-form JSON in the DB, so we read them through defaults —
 * the storefront always renders sensible copy even if a field is missing or the
 * shape drifts (mirrors the prototype's `Object.assign({}, DEFAULT, saved)`).
 */

export type BannerSetting = {
  enabled: boolean;
  msg1: string;
  msg2: string;
  offerLabel: string;
  offerText: string;
  code: string;
};

export type PromoSetting = {
  enabled: boolean;
  eyebrow: string;
  title: string;
  code: string;
  note: string;
  button: string;
};

export type StoreSettings = {
  storeName: string;
  /** Contact + tax details (Store Information card, 3.11); may be unset. */
  supportEmail: string | null;
  phone: string | null;
  gstin: string | null;
  banner: BannerSetting;
  promo: PromoSetting;
  /** Shipping & Payments (3.11) — the source of truth for the cart/checkout/place_order. */
  freeShipThresholdPaise: number;
  flatRatePaise: number;
  codEnabled: boolean;
  /** Razorpay live mode — surfaced read-only until the payments phase. */
  razorpayLive: boolean;
};

const BANNER_DEFAULT: BannerSetting = {
  enabled: true,
  msg1: "Free shipping over ₹999",
  msg2: "Cash on Delivery available",
  offerLabel: "Festive offer:",
  offerText: "FLAT 20% OFF",
  code: "BRIDE20",
};

const PROMO_DEFAULT: PromoSetting = {
  enabled: true,
  eyebrow: "Festive Season Offer",
  title: "Flat 20% off the entire bridal range",
  code: "BRIDE20",
  note: "at checkout. Limited period.",
  button: "Shop the Sale",
};

const DEFAULT_FREE_SHIP_THRESHOLD_PAISE = 99900;
const DEFAULT_FLAT_RATE_PAISE = 7900;

/** Coerce an unknown JSON value into a plain string map (empty on mismatch). */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

/** Collect only the keys present as strings, so undefined never overwrites a default. */
function pickStrings(
  record: Record<string, unknown>,
  keys: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = readString(record, key);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** Overlay saved JSON onto a typed default; strings win, `enabled` stays truthy-by-default. */
function mergeBanner(raw: unknown): BannerSetting {
  const record = asRecord(raw);
  return {
    ...BANNER_DEFAULT,
    ...pickStrings(record, ["msg1", "msg2", "offerLabel", "offerText", "code"]),
    enabled: record.enabled !== false,
  };
}

function mergePromo(raw: unknown): PromoSetting {
  const record = asRecord(raw);
  return {
    ...PROMO_DEFAULT,
    ...pickStrings(record, ["eyebrow", "title", "code", "note", "button"]),
    enabled: record.enabled !== false,
  };
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
          "store_name, support_email, phone, gstin, banner, homepage_promo, free_ship_threshold_paise, flat_rate_paise, cod_enabled, razorpay_live",
        )
        .maybeSingle();

      if (error) {
        throw new Error(`getStoreSettings failed: ${error.message}`);
      }

      return {
    storeName: data?.store_name ?? "JR Jewellers",
    supportEmail: data?.support_email ?? null,
    phone: data?.phone ?? null,
    gstin: data?.gstin ?? null,
    banner: mergeBanner(data?.banner),
    promo: mergePromo(data?.homepage_promo),
    freeShipThresholdPaise:
      data?.free_ship_threshold_paise ?? DEFAULT_FREE_SHIP_THRESHOLD_PAISE,
    flatRatePaise: data?.flat_rate_paise ?? DEFAULT_FLAT_RATE_PAISE,
    codEnabled: data?.cod_enabled ?? true,
    razorpayLive: data?.razorpay_live ?? false,
      };
    },
    ["getStoreSettings"],
    { tags: [CACHE_TAGS.settings], revalidate: CATALOG_REVALIDATE_SECONDS },
  ),
);
