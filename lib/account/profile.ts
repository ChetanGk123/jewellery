/**
 * Pure customer-profile domain: types, row mapper and the profile form schema.
 * No React / server-only deps so it's unit-testable; DB access lives in
 * `lib/db/profile.ts`.
 *
 * The schema is DERIVED from the checkout schema (minus email + tender) — the
 * profile exists to prefill checkout, so the two field sets must never drift.
 */

import { z } from "zod";
import { checkoutSchema, type CheckoutFormValues } from "@/lib/checkout/schema";

export const profileSchema = checkoutSchema.omit({
  email: true,
  paymentMethod: true,
});
export type ProfileValues = z.infer<typeof profileSchema>;

/** A customer's saved contact + default address (camelCase view of the row). */
export type CustomerProfile = ProfileValues;

/** Snake_case row shape returned by Supabase for `customer_profile`. */
type ProfileRow = {
  full_name: string;
  phone: string;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
};

/** Map a `customer_profile` row to the camelCase domain shape. */
export function toCustomerProfile(row: ProfileRow): CustomerProfile {
  return {
    fullName: row.full_name,
    phone: row.phone,
    addressLine: row.address_line,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
  };
}

/**
 * Merge a saved profile + account email into checkout form defaults. Empty
 * profile fields stay empty strings, which is exactly what the form expects.
 */
export function profileToCheckoutDefaults(
  profile: CustomerProfile | null,
  email: string,
): CheckoutFormValues {
  return {
    fullName: profile?.fullName ?? "",
    phone: profile?.phone ?? "",
    email,
    addressLine: profile?.addressLine ?? "",
    city: profile?.city ?? "",
    state: profile?.state ?? "",
    pincode: profile?.pincode ?? "",
    paymentMethod: "cod",
  };
}
