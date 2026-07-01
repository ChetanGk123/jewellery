import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/storefront/product/ProductCard";
import { getCategoryBySlug, getProducts } from "@/lib/db/queries";

type CategoryPageProps = {
  params: Promise<{ category: string }>;
};

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };
  return {
    title: category.name,
    description:
      category.description ??
      `Shop ${category.name} — handcrafted artificial bridal jewellery from JR Jewellers.`,
  };
}

/**
 * Category listing page (TASKS 1.4) — mirrors the prototype's category route:
 * a breadcrumb, a title + product count, and a grid of `ProductCard`s. The
 * sort control and filter sidebar are added in 1.6 (URL search-param state).
 */
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: slug } = await params;
  const [category, products] = await Promise.all([
    getCategoryBySlug(slug),
    getProducts({ categorySlug: slug, sort: "featured" }),
  ]);

  if (!category) notFound();

  return (
    <main className="mx-auto max-w-[1280px] flex-1 px-6 pb-[70px] pt-[26px]">
      <nav aria-label="Breadcrumb" className="mb-[22px]">
        <ol className="flex items-center gap-2 text-[12px] leading-none text-[#9C8A84]">
          <li>
            <Link href="/" className="text-maroon-700 hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">{category.name}</li>
        </ol>
      </nav>

      <header className="mb-7 flex flex-wrap items-end justify-between gap-3.5 border-b border-[#E7D9C2] pb-[22px]">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-heading text-[42px] font-semibold leading-none text-maroon-900">
            {category.name}
          </h1>
          <span className="text-[13px] leading-none text-[#7A655F]">
            {products.length} {products.length === 1 ? "product" : "products"}
          </span>
        </div>
      </header>

      {products.length > 0 ? (
        <div className="grid grid-cols-2 gap-[22px] sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3.5 rounded-md border border-dashed border-[#E0CFB4] bg-cream-50 px-5 py-20 text-center">
          <span className="text-[34px] text-gold-400" aria-hidden>
            ⚲
          </span>
          <p className="m-0 font-heading text-[24px] font-semibold leading-none text-maroon-900">
            No pieces in this collection yet
          </p>
          <p className="m-0 text-[13px] leading-normal text-[#7A655F]">
            Check back soon, or explore the rest of the range.
          </p>
          <Link
            href="/shop"
            className="mt-1.5 rounded-sm bg-maroon-700 px-[26px] py-3 text-[12px] font-semibold uppercase leading-none tracking-[0.12em] text-cream-200 transition-colors hover:bg-maroon-800"
          >
            Browse all jewellery
          </Link>
        </div>
      )}
    </main>
  );
}
