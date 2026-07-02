import Link from "next/link";
import { ROUTES } from "@/lib/routes";

/**
 * Shared hero header for the help / info pages — breadcrumb (Home / Help / …),
 * a gold eyebrow, the page title, and a lead paragraph. Matches the storefront
 * prototype's help-centre header treatment.
 */
export function HelpHeader({
  crumb,
  eyebrow,
  title,
  intro,
}: {
  crumb: string;
  eyebrow: string;
  title: string;
  intro: string;
}) {
  return (
    <section className="border-b border-[#E7D9C2] bg-cream-50">
      <div className="mx-auto flex max-w-[860px] flex-col gap-3 px-6 py-14 text-center">
        <nav aria-label="Breadcrumb">
          <ol className="flex justify-center gap-2 text-[12px] leading-none text-[#9C8A84]">
            <li>
              <Link
                href={ROUTES.home}
                className="text-maroon-700 hover:underline"
              >
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>Help</li>
            <li aria-hidden>/</li>
            <li aria-current="page">{crumb}</li>
          </ol>
        </nav>
        <span className="text-[11px] font-medium uppercase leading-none tracking-[0.2em] text-gold-600">
          {eyebrow}
        </span>
        <h1 className="m-0 font-heading text-[clamp(34px,6vw,48px)] font-semibold leading-[1.05] text-maroon-900">
          {title}
        </h1>
        <p className="m-0 text-[15px] font-light leading-[1.7] text-[#5E4A44]">
          {intro}
        </p>
      </div>
    </section>
  );
}
