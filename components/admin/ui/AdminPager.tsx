import Link from "next/link";

/**
 * Shared admin list pager (TASKS 5.10). One "Showing X–Y of N" range line plus a
 * Prev / numbered / Next control, driven entirely by the server-rendered page
 * state. Each surface passes `hrefForPage` so page links preserve that view's own
 * filter/search params. Renders nothing when the list is empty. Replaces the
 * per-view inline pagers the orders and products lists used to carry.
 */
type Props = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  hrefForPage: (page: number) => string;
};

export function AdminPager({ page, pageCount, total, pageSize, hrefForPage }: Props) {
  if (total <= 0) return null;

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-[12px] text-[#8A7E74]">
        Showing {rangeStart}–{rangeEnd} of {total}
      </span>
      {pageCount > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <PagerArrow href={hrefForPage(page - 1)} disabled={page <= 1}>
            ‹ Prev
          </PagerArrow>
          {pageItems(page, pageCount).map((item, i) =>
            item === "gap" ? (
              <span
                key={`gap-${i}`}
                aria-hidden="true"
                className="px-1 text-[12px] font-semibold text-[#A99C90]"
              >
                …
              </span>
            ) : (
              <Link
                key={item}
                href={hrefForPage(item)}
                aria-current={item === page ? "page" : undefined}
                className={`min-w-[34px] rounded-md border px-2.5 py-[7px] text-center text-[12px] font-semibold ${
                  item === page
                    ? "border-maroon-700 bg-maroon-700 text-cream-200"
                    : "border-[#E7E0D4] bg-white text-maroon-700 hover:border-[#D8CDB9]"
                }`}
              >
                {item}
              </Link>
            ),
          )}
          <PagerArrow href={hrefForPage(page + 1)} disabled={page >= pageCount}>
            Next ›
          </PagerArrow>
        </div>
      )}
    </div>
  );
}

/**
 * Windowed page numbers (TASKS 5.13): always page 1, the last page, and the
 * current page ±1; runs of hidden pages collapse to a "gap". A gap of exactly
 * one page renders that page instead — "…" standing in for a single number
 * would be silly. Short lists (≤7 pages) show every number.
 */
function pageItems(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const items: (number | "gap")[] = [];
  let last = 0;
  for (let n = 1; n <= pageCount; n++) {
    const isShown = n === 1 || n === pageCount || Math.abs(n - page) <= 1;
    if (!isShown) continue;
    if (n - last === 2) items.push(n - 1);
    else if (n - last > 2) items.push("gap");
    items.push(n);
    last = n;
  }
  return items;
}

/** Prev / Next control — a Link when active, an inert dimmed span at the ends. */
function PagerArrow({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const cls =
    "rounded-md border border-[#E7E0D4] bg-white px-3.5 py-[7px] text-[12px] font-semibold text-maroon-700";
  if (disabled) {
    return (
      <span className={`${cls} cursor-not-allowed opacity-40`} aria-disabled>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={`${cls} hover:border-[#D8CDB9]`}>
      {children}
    </Link>
  );
}
