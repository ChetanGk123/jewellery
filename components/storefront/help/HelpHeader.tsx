import Link from "next/link"
import { ROUTES } from "@/lib/routes"

/**
 * Shared hero header for the help / info pages — maroon-gradient band with a
 * Home / Help / … breadcrumb, a gold eyebrow, the page title, and a lead
 * paragraph. Mirrors the storefront prototype's help-centre header treatment.
 */
export function HelpHeader({
  crumb,
  eyebrow,
  title,
  intro,
}: {
  crumb: string
  eyebrow: string
  title: string
  intro: string
}) {
  return (
    <section className="bg-[linear-gradient(120deg,#4A0E1C,#71182B_60%,#5E1322)]">
      <div className="mx-auto flex max-w-[1000px] flex-col gap-3.5 px-6 pb-[50px] pt-[46px]">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap gap-2 text-[12px] leading-none text-[#E0B7A8]">
            <li>
              <Link href={ROUTES.home} className="text-gold-300 hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>Help</li>
            <li aria-hidden>/</li>
            <li aria-current="page">{crumb}</li>
          </ol>
        </nav>
        <span className="text-[12px] font-medium uppercase leading-none tracking-[0.32em] text-gold-300">
          {eyebrow}
        </span>
        <h1 className="m-0 font-heading text-[clamp(36px,5.5vw,56px)] font-semibold leading-[1.04] text-[#FBF1DE]">
          {title}
        </h1>
        <p className="m-0 max-w-[560px] text-[15px] font-light leading-[1.7] text-[#E8CFC0]">
          {intro}
        </p>
      </div>
    </section>
  )
}
