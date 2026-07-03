"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { type FieldError, useForm } from "react-hook-form";
import { submitCheckout } from "@/app/(storefront)/checkout/actions";
import { Honeypot } from "@/components/ui/Honeypot";
import type { CartLine } from "@/lib/cart";
import {
  cartLinesToOrderItems,
  type PlacedOrder,
} from "@/lib/checkout/order";
import {
  CHECKOUT_DEFAULTS,
  type CheckoutFormValues,
  checkoutSchema,
} from "@/lib/checkout/schema";
import { CheckoutSummary } from "./CheckoutSummary";

type Props = {
  lines: readonly CartLine[];
  couponCode: string | null;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  onPlaced: (order: PlacedOrder) => void;
};

/**
 * Checkout form (TASKS 2.4). Client validation runs through React Hook Form with
 * the shared zod resolver; on submit the SAME schema is re-checked server-side by
 * `submitCheckout`, which is the authoritative gate (the resolver is only a UX
 * nicety). The `<form>` wraps both columns so the summary's "Place Order" submit
 * button posts these fields. Order creation + confirmation land in TASKS 2.5/2.6.
 */
export function CheckoutForm({
  lines,
  couponCode,
  subtotalPaise,
  discountPaise,
  shippingPaise,
  totalPaise,
  onPlaced,
}: Props) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: CHECKOUT_DEFAULTS,
    mode: "onTouched",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");

  const onValid = async (values: CheckoutFormValues) => {
    setFormError(null);
    const result = await submitCheckout({
      values,
      items: cartLinesToOrderItems(lines),
      couponCode,
      honeypot,
    });
    if (!result.ok) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        setError(field as keyof CheckoutFormValues, { message });
      }
      setFormError(result.formError ?? "Something went wrong. Please try again.");
      return;
    }
    onPlaced(result.order);
  };

  return (
    <form
      onSubmit={handleSubmit(onValid)}
      noValidate
      className="relative flex flex-wrap items-start gap-10"
    >
      <Honeypot value={honeypot} onChange={setHoneypot} />
      <div className="flex min-w-[320px] flex-1 flex-col gap-[26px]">
        <fieldset className="m-0 flex flex-col gap-3.5 border-0 p-0">
          <legend className="mb-0.5 p-0 text-[13px] font-semibold uppercase leading-none tracking-[0.14em] text-maroon-900">
            Contact &amp; Shipping
          </legend>

          <div className="flex flex-wrap gap-3.5">
            <Field
              id="fullName"
              placeholder="Full name"
              autoComplete="name"
              error={errors.fullName}
              registration={register("fullName")}
              className="min-w-[200px] flex-1"
            />
            <Field
              id="phone"
              placeholder="Phone (10 digits)"
              inputMode="numeric"
              autoComplete="tel"
              error={errors.phone}
              registration={register("phone")}
              className="min-w-[200px] flex-1"
            />
          </div>

          <Field
            id="email"
            type="email"
            placeholder="Email (for order updates)"
            autoComplete="email"
            error={errors.email}
            registration={register("email")}
          />

          <Field
            id="addressLine"
            placeholder="Address (house no, street, area)"
            autoComplete="street-address"
            error={errors.addressLine}
            registration={register("addressLine")}
          />

          <div className="flex flex-wrap gap-3.5">
            <Field
              id="city"
              placeholder="City"
              autoComplete="address-level2"
              error={errors.city}
              registration={register("city")}
              className="min-w-[140px] flex-1"
            />
            <Field
              id="state"
              placeholder="State"
              autoComplete="address-level1"
              error={errors.state}
              registration={register("state")}
              className="min-w-[140px] flex-1"
            />
            <Field
              id="pincode"
              placeholder="Pincode"
              inputMode="numeric"
              autoComplete="postal-code"
              error={errors.pincode}
              registration={register("pincode")}
              className="w-[120px] flex-none"
            />
          </div>
        </fieldset>

        <div className="flex flex-col gap-3">
          <span className="text-[13px] font-semibold uppercase leading-none tracking-[0.14em] text-maroon-900">
            Payment Method
          </span>
          <input type="hidden" {...register("paymentMethod")} />
          <div className="flex items-center gap-3 rounded-sm border border-maroon-700 bg-[#FCF1F2] px-4 py-[15px]">
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-maroon-700">
              <span className="h-2 w-2 rounded-full bg-maroon-700" />
            </span>
            <span className="text-[14px] font-medium leading-none text-maroon-900">
              Cash on Delivery
            </span>
            <span className="ml-auto text-[12px] leading-none text-[#9C8A84]">
              Pay when it arrives
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-sm border border-[#E7D9C2] bg-[#FBF7F0] px-4 py-[15px] opacity-60">
            <span className="h-[18px] w-[18px] rounded-full border-2 border-[#CDBBA0]" />
            <span className="text-[14px] font-medium leading-none text-[#9C8A84]">
              Card / UPI
            </span>
            <span className="ml-auto text-[12px] leading-none text-[#B79B7E]">
              Coming soon
            </span>
          </div>
        </div>

        {formError && (
          <p
            role="alert"
            className="m-0 rounded-sm border border-[#F0C8CE] bg-[#FBEAEC] px-3.5 py-3 text-[13px] leading-snug text-[#B23A48]"
          >
            {formError}
          </p>
        )}
      </div>

      <CheckoutSummary
        lines={lines}
        subtotalPaise={subtotalPaise}
        discountPaise={discountPaise}
        shippingPaise={shippingPaise}
        totalPaise={totalPaise}
        isSubmitting={isSubmitting}
      />
    </form>
  );
}

type FieldProps = {
  id: keyof CheckoutFormValues;
  placeholder: string;
  registration: ReturnType<ReturnType<typeof useForm<CheckoutFormValues>>["register"]>;
  error?: FieldError;
  type?: "text" | "email";
  inputMode?: "text" | "numeric";
  autoComplete?: string;
  className?: string;
};

/** One labelled text input with an inline validation message. */
function Field({
  id,
  placeholder,
  registration,
  error,
  type = "text",
  inputMode,
  autoComplete,
  className = "",
}: FieldProps) {
  const borderClass = error
    ? "border-[#D98A94] focus:border-[#B23A48]"
    : "border-[#E7D9C2] focus:border-gold-400";

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-[2px] border ${borderClass} bg-white px-3.5 py-[13px] text-[14px] text-maroon-900 outline-none placeholder:text-[#B79B7E]`}
        {...registration}
      />
      {error && (
        <p
          id={`${id}-error`}
          className="m-0 text-[12px] leading-snug text-[#B23A48]"
        >
          {error.message}
        </p>
      )}
    </div>
  );
}
