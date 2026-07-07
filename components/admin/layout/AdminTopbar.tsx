"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { adminPageMeta } from "@/lib/admin/nav";
import { ROUTES } from "@/lib/routes";

/**
 * Admin topbar (prototype-matched): mobile menu button, per-view page title +
 * subtitle (derived from the route), an order search box and a notification
 * bell. Submitting the search jumps to the orders queue filtered by `?q=`
 * (TASKS 5.5); the bell is still presentational until 5.14 wires real events.
 */
export function AdminTopbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { title, subtitle } = adminPageMeta(pathname);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `${ROUTES.adminOrders}?q=${encodeURIComponent(q)}` : ROUTES.adminOrders);
  };

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-[#E7E0D4] bg-[#F5F1EA]/90 px-5 py-[18px] backdrop-blur-md sm:gap-5 sm:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-[#E7E0D4] bg-white lg:hidden"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#5E4A40"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="truncate font-heading text-[26px] font-semibold leading-none text-[#2A1F1A]">
          {title}
        </h1>
        <span className="truncate text-[12.5px] leading-none text-[#8A7E74]">
          {subtitle}
        </span>
      </div>

      <form
        role="search"
        onSubmit={onSearch}
        className="ml-auto hidden max-w-[340px] flex-1 items-center rounded-lg border border-[#E7E0D4] bg-white px-3 md:flex"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9C8A7E"
          strokeWidth={2}
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3-3" />
        </svg>
        <input
          type="search"
          id="admin-order-search"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search orders by number, customer, phone or email"
          placeholder="Search orders..."
          className="w-full flex-1 border-none bg-transparent px-2 py-[9px] text-[13px] text-[#2A1F1A] outline-none placeholder:text-[#9C8A7E]"
        />
      </form>

      <button
        type="button"
        aria-label="Notifications"
        className="ml-auto flex h-[38px] w-[38px] flex-none items-center justify-center rounded-lg border border-[#E7E0D4] bg-white md:ml-0"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#5E4A40"
          strokeWidth={1.7}
          aria-hidden="true"
        >
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      </button>
    </header>
  );
}
