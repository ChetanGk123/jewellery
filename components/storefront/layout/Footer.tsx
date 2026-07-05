import Link from "next/link";
import { NewsletterForm } from "./NewsletterForm";
import { FacebookIcon } from "@/components/ui/FacebookIcon";
import { InstagramIcon } from "@/components/ui/InstagramIcon";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { FOOTER_SHOP_LINKS, FOOTER_HELP_LINKS } from "@/lib/navigation";
import { STORE_INFO, type SocialLink } from "@/lib/store-info";

const socialBadgeClass =
  "flex h-[34px] w-[34px] items-center justify-center rounded-full border border-gold-300/40 text-sm text-gold-300 transition-colors hover:bg-gold-300/10";

/**
 * Storefront footer, matched to `refereces/JR Jewellers Storefront.html`:
 * deep-maroon panel with a brand blurb + socials, Shop/Help columns, a
 * newsletter signup (UI-only for now), and a payments/GST strip.
 */
export function Footer() {
  return (
    <footer className="mt-auto bg-maroon-950 text-[#D9C2B8]">
      <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-10 px-6 pt-14 pb-[30px]">
        <div className="flex min-w-[240px] max-w-[320px] flex-1 flex-col gap-[14px]">
          <span className="font-display text-2xl leading-none tracking-[0.14em] text-gold-300">
            {STORE_INFO.wordmark}
          </span>
          <p className="m-0 text-[13px] font-light leading-[1.7] text-[#C3A89D]">
            {STORE_INFO.tagline}
          </p>
          <div className="mt-1.5 flex gap-3">
            {STORE_INFO.socials.map((social) =>
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
                  aria-label={social.label}
                  className={socialBadgeClass}
                >
                  <SocialGlyph social={social} />
                </span>
              ),
            )}
          </div>
        </div>

        <FooterColumn title="Shop" links={FOOTER_SHOP_LINKS} />
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
        <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-3 px-6 py-[18px]">
          <span className="text-[11.5px] font-light leading-none text-[#9C8278]">
            © {new Date().getFullYear()} {STORE_INFO.name} · GST registered · Made in India
          </span>
          <span className="text-[11.5px] font-light leading-none text-[#9C8278]">
            UPI · Cards · Netbanking · COD · Razorpay Secured
          </span>
        </div>
      </div>
    </footer>
  );
}

/** Renders a social badge's mark: a self-hosted SVG where we have one, else the text glyph. */
function SocialGlyph({ social }: { social: SocialLink }) {
  if (social.label === "WhatsApp") return <WhatsAppIcon size={16} />;
  if (social.label === "Facebook") return <FacebookIcon size={16} />;
  if (social.label === "Instagram") return <InstagramIcon size={16} />;
  return <>{social.glyph}</>;
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="flex min-w-[140px] flex-col gap-3">
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
  );
}
