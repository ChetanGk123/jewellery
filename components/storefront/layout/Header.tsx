import Link from "next/link";
import type { BannerSetting } from "@/lib/db/settings";
import { getCurrentUser } from "@/lib/db/server";
import { ROUTES } from "@/lib/routes";
import { PRIMARY_NAV } from "@/lib/navigation";
import { STORE_INFO } from "@/lib/store-info";
import { CartBadge } from "./CartBadge";
import { MobileNavDrawer } from "./MobileNavDrawer";

/**
 * Storefront header, matched to `refereces/JR Jewellers Storefront.html`:
 * a gradient announcement bar that scrolls away, over a sticky brand row
 * (left logo · centre search · account/cart) and a centred nav strip.
 *
 * The announcement bar is driven by `setting.banner`. The account link is
 * session-aware ("Sign In" ↔ "Account") — every route already renders
 * per-request (strict CSP nonce), so reading the session here costs nothing.
 */
export async function Header({ banner }: { banner: BannerSetting }) {
  const showBanner = banner.enabled && Boolean(banner.msg1);
  const user = await getCurrentUser();
  const accountHref = user ? ROUTES.account : ROUTES.signIn;
  const accountLabel = user ? "Account" : "Sign In";

  return (
    <header>
      {/* Announcement bar — scrolls with the page (not sticky), per prototype. */}
      {showBanner && (
        <div className="bg-[linear-gradient(90deg,#4A0E1C,#71182B_50%,#4A0E1C)] px-4 py-[9px] text-center text-[12px] font-medium leading-normal tracking-[0.06em] text-[#F0DCBE]">
          <span>{banner.msg1}</span>
          {banner.msg2 && (
            <>
              <span className="mx-1.5" aria-hidden>
                ·
              </span>
              <span>{banner.msg2}</span>
            </>
          )}
          {banner.offerText && (
            <>
              <span className="mx-1.5" aria-hidden>
                ·
              </span>
              <span>
                {banner.offerLabel}{" "}
                <span className="font-semibold text-gold-300">
                  {banner.offerText}
                </span>
                {banner.code && (
                  <>
                    {" "}
                    with code{" "}
                    <span className="font-semibold text-gold-300">
                      {banner.code}
                    </span>
                  </>
                )}
              </span>
            </>
          )}
        </div>
      )}

      <div className="sticky top-0 z-40 border-b border-[#E7D9C2] bg-cream-100/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-[22px] gap-y-3 px-6 py-3.5">
          <MobileNavDrawer
            links={PRIMARY_NAV}
            accountHref={accountHref}
            accountLabel={accountLabel}
          />

          <Link href={ROUTES.home} className="flex flex-none flex-col leading-none">
            <span className="font-display text-[clamp(20px,5.5vw,26px)] leading-none tracking-[0.14em] text-maroon-700">
              {STORE_INFO.wordmark}
            </span>
            <span className="mt-[5px] text-[9.5px] uppercase leading-none tracking-[0.36em] text-gold-600">
              {STORE_INFO.descriptor}
            </span>
          </Link>

          <form
            action={ROUTES.shop}
            role="search"
            className="flex min-w-[200px] flex-1 basis-[300px] items-center rounded-sm border border-[#E7D9C2] bg-white px-3.5 transition-colors focus-within:border-gold-400"
          >
            <span className="text-[15px] text-[#B79B7E]" aria-hidden>
              ⚲
            </span>
            <input
              type="search"
              name="q"
              aria-label="Search products"
              placeholder="Search necklaces, jhumkas, bridal sets..."
              className="min-w-0 flex-1 border-none bg-transparent px-2.5 py-[11px] text-[13px] text-maroon-900 outline-none placeholder:text-[#B79B7E]"
            />
          </form>

          <div className="flex flex-none items-center gap-[18px]">
            <Link
              href={accountHref}
              className="whitespace-nowrap text-[13px] text-[#5E4A44] transition-colors hover:text-maroon-700"
            >
              {accountLabel}
            </Link>
            <Link
              href={ROUTES.cart}
              aria-label="Cart"
              className="group flex items-center gap-[7px]"
            >
              <span className="whitespace-nowrap text-[13px] text-[#5E4A44] transition-colors group-hover:text-maroon-700">
                Cart
              </span>
              <CartBadge />
            </Link>
          </div>
        </div>

        <nav
          aria-label="Primary"
          className="hidden border-t border-[#EFE3D0] bg-cream-50/60 md:block"
        >
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-center gap-x-[26px] gap-y-1 px-6">
            {PRIMARY_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap border-b-2 border-transparent py-[13px] text-[12.5px] font-medium uppercase tracking-[0.13em] text-[#5E4A44] transition-colors hover:border-gold-400 hover:text-maroon-700"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
