"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import type { CouponKind } from "@/lib/coupons";
import { createServerClient } from "@/lib/db/server";
import { ROUTES } from "@/lib/routes";

/**
 * The coupon modal's payload. `id: null` → create. `value`/`minOrder` are the
 * raw strings the admin typed (percent or rupees); this action parses them to
 * the DB's integer paise/percent so the client never handles paise. `expiresAt`
 * is a `YYYY-MM-DD` from a date input, or "" for no expiry.
 */
export type CouponInput = {
  id: string | null;
  code: string;
  kind: CouponKind;
  value: string;
  minOrder: string;
  expiresAt: string;
  isActive: boolean;
};

export type CouponActionResult = { ok: boolean; error?: string };

function messageFor(code: string | undefined, raw: string): string {
  if (code === "23505") return "A coupon with that code already exists.";
  if (raw.includes("NOT_ADMIN")) return "You don't have permission to do that.";
  if (raw.includes("COUPON_NOT_FOUND")) return "That coupon no longer exists.";
  if (raw.includes("CODE_REQUIRED")) return "Coupon code is required.";
  if (raw.includes("INVALID_KIND")) return "Pick a valid discount type.";
  return "Couldn't save the coupon. Please try again.";
}

/** Rupees string → integer paise, or null when blank/invalid. */
function rupeesToPaise(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const rupees = Number(trimmed);
  if (!Number.isFinite(rupees) || rupees < 0) return null;
  return Math.round(rupees * 100);
}

/** Discount `value` for the payload, by kind (percent number, fixed paise, 0). */
function couponValueFor(kind: CouponKind, raw: string): number {
  if (kind === "free_shipping") return 0;
  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  if (kind === "fixed") return Math.round(parsed * 100);
  return Math.round(parsed); // percent
}

/**
 * Create or update a coupon through the admin-only `admin_upsert_coupon` RPC
 * (0012). The RPC re-checks admin + required code and clamps percent to 0–100.
 */
export async function upsertCoupon(
  input: CouponInput,
): Promise<CouponActionResult> {
  await requireAdmin(ROUTES.adminCoupons);

  const code = input.code?.trim().toUpperCase() ?? "";
  if (!code) return { ok: false, error: "Coupon code is required." };

  // Store expiry as end-of-day UTC so the code stays valid through the chosen
  // date; the list formats it back in UTC to match.
  const expiresAt = input.expiresAt?.trim()
    ? `${input.expiresAt.trim()}T23:59:59.000Z`
    : null;

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("admin_upsert_coupon", {
    p_id: input.id,
    p_payload: {
      code,
      kind: input.kind,
      value: couponValueFor(input.kind, input.value),
      min_subtotal_paise: rupeesToPaise(input.minOrder),
      max_discount_paise: null,
      usage_limit: null,
      expires_at: expiresAt,
      is_active: input.isActive,
    },
  });

  if (error) return { ok: false, error: messageFor(error.code, error.message) };

  revalidatePath(ROUTES.adminCoupons);
  return { ok: true };
}

/** Flip a coupon's active state via `admin_toggle_coupon` (0012). */
export async function toggleCoupon(
  id: string,
  active: boolean,
): Promise<CouponActionResult> {
  await requireAdmin(ROUTES.adminCoupons);

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("admin_toggle_coupon", {
    p_id: id,
    p_active: active,
  });

  if (error) return { ok: false, error: messageFor(error.code, error.message) };

  revalidatePath(ROUTES.adminCoupons);
  return { ok: true };
}
