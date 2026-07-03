"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { saveProfile } from "@/app/(storefront)/account/actions";
import {
  type ProfileValues,
  profileSchema,
} from "@/lib/account/profile";
import { AuthError, AuthField, AuthSubmit } from "@/components/storefront/auth/AuthCard";

const SAVED_FEEDBACK_MS = 2500;

/**
 * Profile editor: name, phone and the default delivery address that prefills
 * checkout. Same field/CTA language as the auth + checkout forms.
 */
export function ProfileForm({ defaults }: { defaults: ProfileValues }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
  });

  const onValid = async (values: ProfileValues) => {
    setFormError(null);
    const result = await saveProfile(values);
    if (!result.ok) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        setError(field as keyof ProfileValues, { message });
      }
      setFormError(result.formError ?? "Something went wrong. Please try again.");
      return;
    }
    setIsSaved(true);
    window.setTimeout(() => setIsSaved(false), SAVED_FEEDBACK_MS);
  };

  return (
    <form
      onSubmit={handleSubmit(onValid)}
      noValidate
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap gap-3.5">
        <div className="min-w-[200px] flex-1">
          <AuthField
            id="fullName"
            label="Full name"
            autoComplete="name"
            error={errors.fullName?.message}
            registration={register("fullName")}
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <AuthField
            id="phone"
            label="Phone"
            inputMode="numeric"
            autoComplete="tel"
            error={errors.phone?.message}
            registration={register("phone")}
          />
        </div>
      </div>

      <AuthField
        id="addressLine"
        label="Address (house no, street, area)"
        autoComplete="street-address"
        error={errors.addressLine?.message}
        registration={register("addressLine")}
      />

      <div className="flex flex-wrap gap-3.5">
        <div className="min-w-[140px] flex-1">
          <AuthField
            id="city"
            label="City"
            autoComplete="address-level2"
            error={errors.city?.message}
            registration={register("city")}
          />
        </div>
        <div className="min-w-[140px] flex-1">
          <AuthField
            id="state"
            label="State"
            autoComplete="address-level1"
            error={errors.state?.message}
            registration={register("state")}
          />
        </div>
        <div className="w-[140px] flex-none">
          <AuthField
            id="pincode"
            label="Pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            error={errors.pincode?.message}
            registration={register("pincode")}
          />
        </div>
      </div>

      <AuthError message={formError} />
      <div className="flex items-center gap-4">
        <AuthSubmit isBusy={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save Details"}
        </AuthSubmit>
        {isSaved && (
          <span
            role="status"
            className="text-[13px] font-medium text-[#1E7A38]"
          >
            ✓ Saved
          </span>
        )}
      </div>
    </form>
  );
}
