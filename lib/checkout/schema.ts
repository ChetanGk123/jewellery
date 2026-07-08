/**
 * Shared checkout validation — the address + tender schema used by BOTH the
 * client form (React Hook Form resolver) and the server action, so the two can
 * never drift. Pure zod, no React / server-only deps.
 *
 * v1 is COD-only (see ARCHITECTURE_PLAN — Razorpay deferred), so the payment
 * method is a single literal for now; widen the union when online tender lands.
 * Money and cart lines are NOT part of this schema: order totals are recomputed
 * server-side from the DB at order creation (TASKS 2.5) and never trusted from
 * the client.
 */

import { z } from "zod"

/** Indian mobile: 10 digits, first digit 6–9. */
const PHONE_RE = /^[6-9]\d{9}$/
/** Indian PIN code: 6 digits, first digit 1–9. */
const PINCODE_RE = /^[1-9]\d{5}$/

export const PAYMENT_METHODS = ["cod"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const checkoutSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(80, "Name is too long."),
  phone: z.string().trim().regex(PHONE_RE, "Enter a valid 10-digit mobile number."),
  email: z.string().trim().email("Enter a valid email address.").max(120, "Email is too long."),
  addressLine: z
    .string()
    .trim()
    .min(5, "Enter your street address.")
    .max(200, "Address is too long."),
  city: z.string().trim().min(2, "Enter your city.").max(60, "City is too long."),
  state: z.string().trim().min(2, "Enter your state.").max(60, "State is too long."),
  pincode: z.string().trim().regex(PINCODE_RE, "Enter a valid 6-digit PIN code."),
  paymentMethod: z.enum(PAYMENT_METHODS),
})

/** Validated checkout details. */
export type CheckoutFormValues = z.infer<typeof checkoutSchema>

/** Blank form defaults (COD pre-selected as the only v1 tender). */
export const CHECKOUT_DEFAULTS: CheckoutFormValues = {
  fullName: "",
  phone: "",
  email: "",
  addressLine: "",
  city: "",
  state: "",
  pincode: "",
  paymentMethod: "cod",
}
