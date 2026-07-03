"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV, type AdminBadgeKey } from "@/lib/admin/nav";
import { ROUTES } from "@/lib/routes";
import { STORE_INFO } from "@/lib/store-info";
import { AdminNavIcon } from "./AdminNavIcons";
import { AdminSignOutButton } from "@/components/admin/auth/AdminSignOutButton";
import type { AdminNavCounts } from "@/lib/db/admin-metrics";

type Props = {
  counts: AdminNavCounts;
  /** Signed-in admin's email, shown in the footer card. */
  adminEmail: string;
  /** Mobile drawer open state (ignored at `lg` where the sidebar is static). */
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Dark-maroon admin sidebar (prototype-matched): wordmark + "Admin Console",
 * ten nav items with active gold highlight + left bar and live count badges,
 * and a Store Admin footer card. Static column at `lg`; an off-canvas drawer
 * with a backdrop below it.
 */
export function AdminSidebar({ counts, adminEmail, isOpen, onClose }: Props) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === ROUTES.admin
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  const badgeCount = (key?: AdminBadgeKey) => (key ? counts[key] : 0);

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[236px] flex-col gap-1.5 overflow-y-auto bg-maroon-950 px-4 py-6 transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col px-2.5 pb-5 pt-1.5 leading-none">
          <span className="font-display text-[22px] leading-none tracking-[0.12em] text-gold-300">
            {STORE_INFO.wordmark}
          </span>
          <span className="mt-1.5 text-[9.5px] uppercase leading-none tracking-[0.34em] text-[#9C7A6E]">
            Admin Console
          </span>
        </div>

        <nav aria-label="Admin" className="flex flex-col gap-1.5">
          {ADMIN_NAV.map((item) => {
            const active = isActive(item.href);
            const count = badgeCount(item.badge);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-[11px] text-[13.5px] font-medium transition-colors ${
                  active
                    ? "bg-gold-300/10 text-gold-300"
                    : "text-[#C6B2A2] hover:bg-gold-300/[0.06] hover:text-gold-300"
                }`}
              >
                <span
                  className={`h-[18px] w-[3px] flex-none rounded-sm ${
                    active ? "bg-gold-300" : "bg-transparent"
                  }`}
                />
                <AdminNavIcon icon={item.icon} />
                <span className="flex-1">{item.label}</span>
                {count > 0 && (
                  <span className="rounded-[9px] bg-maroon-700 px-[7px] py-[3px] text-[11px] font-semibold leading-none text-cream-200">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex items-center gap-3 rounded-lg border-t border-gold-300/15 px-3 py-3">
          <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[linear-gradient(135deg,#E6CA7E,#A87A1E)] text-sm font-semibold text-maroon-950">
            {initials(STORE_INFO.name)}
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="text-[13px] font-medium text-[#F0DDC9]">
              Store Admin
            </span>
            <span
              className="truncate text-[11px] text-[#9C7A6E]"
              title={adminEmail}
            >
              {adminEmail}
            </span>
          </div>
          <AdminSignOutButton />
        </div>
      </aside>
    </>
  );
}

/** First letters of the first two words, e.g. "RJ Jewellers" → "RJ". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
