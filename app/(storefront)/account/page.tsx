import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/storefront/auth/SignOutButton";
import { ProfileForm } from "@/components/storefront/account/ProfileForm";
import { getCustomerProfile } from "@/lib/db/profile";
import { getCurrentUser } from "@/lib/db/server";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "My Account",
  robots: { index: false },
};

/**
 * Account home: saved contact + default address (prefills checkout), a link to
 * order history, and sign out. Signed-out visitors are sent to sign in and
 * come straight back.
 */
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`${ROUTES.signIn}?next=${encodeURIComponent(ROUTES.account)}`);
  }

  const profile = await getCustomerProfile(user.id);
  const seededName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";
  const defaults = profile ?? {
    fullName: seededName,
    phone: "",
    addressLine: "",
    city: "",
    state: "",
    pincode: "",
  };

  return (
    <main className="mx-auto w-full max-w-[860px] flex-1 px-6 py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-heading text-[32px] font-semibold leading-tight text-maroon-900">
            My Account
          </h1>
          <p className="m-0 text-[13.5px] font-light text-[#5E4A44]">
            Signed in as{" "}
            <span className="font-medium text-maroon-900">{user.email}</span>
          </p>
        </div>
        <Link
          href={ROUTES.accountOrders}
          className="rounded-sm border border-gold-400 bg-[#FBF1E0] px-5 py-3 text-[12px] font-semibold uppercase leading-none tracking-[0.12em] text-gold-600 transition-colors hover:border-maroon-700 hover:bg-maroon-700 hover:text-cream-200"
        >
          My Orders →
        </Link>
      </header>

      <section
        aria-labelledby="profile-heading"
        className="flex flex-col gap-5 rounded border border-[#E7D9C2] bg-[#FFFDF8] p-8"
      >
        <div className="flex flex-col gap-1">
          <h2
            id="profile-heading"
            className="m-0 text-[14px] font-semibold uppercase leading-none tracking-[0.14em] text-maroon-900"
          >
            Contact &amp; Delivery Details
          </h2>
          <p className="m-0 text-[13px] font-light text-[#5E4A44]">
            Saved details prefill your checkout.
          </p>
        </div>
        <ProfileForm defaults={defaults} />
      </section>

      <div className="mt-8">
        <SignOutButton />
      </div>
    </main>
  );
}
