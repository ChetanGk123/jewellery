import type { ReactNode } from "react"
import { STORE_INFO } from "@/lib/store-info"

/**
 * Chrome for the admin auth screens (sign in / forgot / reset). Centered card in
 * the storefront's auth language, topped with the wordmark + "Admin Console" so
 * it reads clearly as the operator login rather than the customer one.
 */
export function AdminAuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-cream-100 px-6 py-16">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center text-center leading-none">
          <span className="font-display text-[24px] tracking-[0.14em] text-maroon-700">
            {STORE_INFO.wordmark}
          </span>
          <span className="mt-2 text-[9.5px] uppercase tracking-[0.34em] text-gold-600">
            Admin Console
          </span>
        </div>
        <div className="flex flex-col gap-5 rounded border border-[#E7D9C2] bg-[#FFFDF8] p-8">
          <header className="flex flex-col gap-1.5">
            <h1 className="m-0 font-heading text-[26px] font-semibold leading-tight text-maroon-900">
              {title}
            </h1>
            {subtitle && (
              <p className="m-0 text-[13.5px] font-light leading-relaxed text-[#5E4A44]">
                {subtitle}
              </p>
            )}
          </header>
          {children}
        </div>
        {footer && <p className="mt-4 text-center text-[13px] text-[#5E4A44]">{footer}</p>}
      </div>
    </main>
  )
}
