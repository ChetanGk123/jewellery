import "server-only"
import { type CustomerProfile, type ProfileValues, toCustomerProfile } from "@/lib/account/profile"
import { createServerClient } from "./server"

/**
 * `customer_profile` access for the signed-in customer. RLS is the real
 * enforcement (own-row policies keyed on auth.uid()); the explicit `userId`
 * (from `getCurrentUser()`) is what the insert half of the upsert must carry
 * to satisfy the with-check policy.
 */

/** The signed-in customer's saved profile, or null if never saved. */
export async function getCustomerProfile(userId: string): Promise<CustomerProfile | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("customer_profile")
    .select("full_name, phone, address_line, city, state, pincode")
    .eq("id", userId)
    .maybeSingle()

  if (error || !data) return null
  return toCustomerProfile(data)
}

/** Create or update the customer's profile (name/phone/default address). */
export async function upsertCustomerProfile(
  userId: string,
  values: ProfileValues,
): Promise<{ ok: boolean }> {
  const supabase = await createServerClient()
  const { error } = await supabase.from("customer_profile").upsert({
    id: userId,
    full_name: values.fullName,
    phone: values.phone,
    address_line: values.addressLine,
    city: values.city,
    state: values.state,
    pincode: values.pincode,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error("customer_profile upsert failed", error)
    return { ok: false }
  }
  return { ok: true }
}
