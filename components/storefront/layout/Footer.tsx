import Link from "next/link"
import { NewsletterForm } from "./NewsletterForm"
import { FacebookIcon } from "@/components/ui/FacebookIcon"
import { InstagramIcon } from "@/components/ui/InstagramIcon"
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon"
import { buildFooterShopLinks, FOOTER_HELP_LINKS } from "@/lib/navigation"
import { getCategories } from "@/lib/db/queries"
import { ROUTES } from "@/lib/routes"
import type { ResolvedStoreInfo, SocialLink } from "@/lib/store-info"

const socialBadgeClass =
  "flex h-[34px] w-[34px] items-center justify-center rounded-full border border-gold-300/40 text-sm text-gold-300 transition-colors hover:bg-gold-300/10"

/**
 * Storefront footer, matched to `refereces/JR Jewellers Storefront.html`:
 * deep-maroon panel with a brand blurb + socials, Shop/Help columns, a
 * newsletter signup (UI-only for now), and a payments/GST strip.
 */
export async function Footer({ info }: { info: ResolvedStoreInfo }) {
  const shopLinks = buildFooterShopLinks(await getCategories())
  return (
    <footer className="mt-auto bg-maroon-950 text-[#D9C2B8]">
      <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-10 px-6 pt-14 pb-[30px]">
        <div className="flex min-w-[240px] max-w-[320px] flex-1 flex-col gap-[14px]">
          <span className="font-display text-2xl leading-none tracking-[0.14em] text-gold-300">
            {info.wordmark}
          </span>
          <p className="m-0 text-[13px] font-light leading-[1.7] text-[#C3A89D]">{info.tagline}</p>
          <div className="mt-1.5 flex gap-3">
            {info.socials.map((social) =>
              social.href ? (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className={socialBadgeClass}
                >
                  <SocialGlyph social={social} />
                </a>
              ) : (
                <span
                  key={social.label}
                  role="img"
                  aria-label={social.label}
                  className={socialBadgeClass}
                >
                  <SocialGlyph social={social} />
                </span>
              ),
            )}
          </div>
        </div>

        <FooterColumn title="Shop" links={shopLinks} />
        <FooterColumn title="Help" links={FOOTER_HELP_LINKS} />

        <div className="flex min-w-[200px] flex-col gap-3">
          <span className="text-xs font-semibold uppercase leading-none tracking-[0.16em] text-gold-300">
            Stay in touch
          </span>
          <p className="m-0 text-[13px] font-light leading-[1.5] text-[#C3A89D]">
            Offers, new drops &amp; bridal inspiration.
          </p>
          <NewsletterForm />
        </div>
      </div>

      <div className="border-t border-gold-300/20">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-6 py-[18px]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="text-[11.5px] font-light leading-none text-[#9C8278]">
              © {new Date().getFullYear()} {info.name} · GST registered · Made in India
            </span>
            <nav aria-label="Legal">
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] font-light leading-none text-[#9C8278]">
                <li>
                  <Link href={ROUTES.privacy} className="hover:text-gold-300 hover:underline">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href={ROUTES.terms} className="hover:text-gold-300 hover:underline">
                    Terms of Use
                  </Link>
                </li>
                <li>
                  <Link href={ROUTES.refundPolicy} className="hover:text-gold-300 hover:underline">
                    Refund Policy
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
          <span className="text-[11.5px] font-light leading-none text-[#9C8278]">
            Cash on Delivery · Secure Checkout
          </span>
        </div>
      </div>
    </footer>
  )
}

/** Renders a social badge's mark: a self-hosted SVG where we have one, else the text glyph. */
function SocialGlyph({ social }: { social: SocialLink }) {
  if (social.label === "WhatsApp") return <WhatsAppIcon size={16} />
  if (social.label === "Facebook") return <FacebookIcon size={16} />
  if (social.label === "Instagram") return <InstagramIcon size={16} />
  return <>{social.glyph}</>
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: { href: string; label: string }[]
}) {
  return (
    <div className="flex min-w-35 flex-col gap-3">
      <span className="text-xs font-semibold uppercase leading-none tracking-[0.16em] text-gold-300">
        {title}
      </span>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-[13px] font-light leading-none text-[#C3A89D] transition-colors hover:text-gold-300"
        >
          {link.label}
        </Link>
      ))}
    </div>
  )
}
