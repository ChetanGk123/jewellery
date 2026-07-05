import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/storefront/product/ProductCard";
import { ProductBuyBox } from "@/components/storefront/product/ProductBuyBox";
import { ProductGallery } from "@/components/storefront/product/ProductGallery";
import { ProductReviews } from "@/components/storefront/product/ProductReviews";
import { ProductTabs } from "@/components/storefront/product/ProductTabs";
import { StarRating } from "@/components/storefront/product/StarRating";
import {
  getApprovedReviews,
  getProductBySlug,
  getRelatedProducts,
} from "@/lib/db/queries";
import { getStoreSettings } from "@/lib/db/settings";
import { ROUTES } from "@/lib/routes";
import { discountPercent, formatPaise } from "@/lib/utils/money";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description:
      product.blurb ??
      `${product.name} — handcrafted artificial bridal jewellery from JR Jewellers.`,
  };
}

/**
 * Product detail page (TASKS 1.5) — mirrors the storefront prototype: breadcrumb,
 * a gallery + info split, tabbed copy, customer reviews, and a related-products
 * rail. Add to Cart / WhatsApp remain stubs until Phase 2.
 */
export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [reviews, related, settings] = await Promise.all([
    getApprovedReviews(product.id),
    getRelatedProducts(product.category.slug, product.slug),
    getStoreSettings(),
  ]);

  const off = discountPercent(product.price_paise, product.mrp_paise);
  const hasSale = off > 0;
  const reviewCount = product.review_count;
  const freeShip = formatPaise(settings.freeShipThresholdPaise);

  // Absolute URL for the WhatsApp enquiry link (derived from the request host).
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host && /^(localhost|127\.)/.test(host) ? "http" : "https");
  const productUrl = host
    ? `${proto}://${host}${ROUTES.product(product.slug)}`
    : undefined;

  return (
    <main className="mx-auto max-w-[1280px] flex-1 px-6 pb-[70px] pt-[26px]">
      <nav aria-label="Breadcrumb" className="mb-[26px]">
        <ol className="flex flex-wrap items-center gap-2 text-[12px] leading-none text-[#9C8A84]">
          <li>
            <Link href={ROUTES.home} className="text-maroon-700 hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link
              href={ROUTES.category(product.category.slug)}
              className="text-maroon-700 hover:underline"
            >
              {product.category.name}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">{product.name}</li>
        </ol>
      </nav>

      <div className="flex flex-col gap-10 md:flex-row md:flex-wrap md:gap-12">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="flex max-w-[520px] flex-col gap-[18px] md:min-w-[300px] md:flex-1">
          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-medium uppercase leading-none tracking-[0.18em] text-gold-600">
              {product.category.name}
              {product.material ? ` · ${product.material}` : ""}
            </span>
            <h1 className="m-0 font-heading text-[40px] font-semibold leading-[1.05] text-maroon-900">
              {product.name}
            </h1>
            <div className="flex items-center gap-2.5 text-[13px] font-medium leading-none text-[#6B5158]">
              <StarRating rating={product.rating} />
              <span>
                {product.rating.toFixed(1)} · {reviewCount}{" "}
                {reviewCount === 1 ? "review" : "reviews"}
              </span>
            </div>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-[30px] font-semibold leading-none text-maroon-700">
              {formatPaise(product.price_paise)}
            </span>
            {hasSale && product.mrp_paise !== null && (
              <span className="text-[18px] font-normal leading-none text-[#A6938C] line-through">
                {formatPaise(product.mrp_paise)}
              </span>
            )}
            {hasSale && (
              <span className="rounded-sm bg-maroon-700 px-[9px] py-[5px] text-[12px] font-semibold leading-none text-white">
                {off}% OFF
              </span>
            )}
          </div>

          {product.blurb && (
            <p className="m-0 text-[15px] font-light leading-[1.7] text-[#5E4A44]">
              {product.blurb}
            </p>
          )}

          <ProductBuyBox
            product={{
              id: product.id,
              slug: product.slug,
              name: product.name,
              categoryName: product.category.name,
              pricePaise: product.price_paise,
              mrpPaise: product.mrp_paise,
              imageUrl:
                (product.images.find((img) => img.is_primary) ??
                  product.images[0])?.url ?? null,
              imageBg:
                (product.images.find((img) => img.is_primary) ??
                  product.images[0])?.bg ?? null,
              stock: product.stock,
            }}
            options={product.options}
            productUrl={productUrl}
          />

          <ul className="m-0 flex flex-wrap gap-[18px] border-y border-[#EFE3D0] py-[18px] text-[12.5px] font-normal leading-none text-[#5E4A44]">
            <li>✓ Free shipping over {freeShip}</li>
            <li>✓ Cash on Delivery</li>
            <li>✓ 7-day easy returns</li>
          </ul>

          <ProductTabs
            data={{
              descLong: product.desc_long,
              material: product.material,
              plating: product.details_plating,
              stones: product.details_stones,
              care: product.details_care,
              shippingNote: product.shipping_note,
            }}
          />
        </div>
      </div>

      <ProductReviews reviews={reviews} />

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-[58px]">
          <h2
            id="related-heading"
            className="m-0 mb-6 font-heading text-[32px] font-semibold leading-none text-maroon-900"
          >
            You may also love
          </h2>
          <div className="grid grid-cols-2 gap-[22px] sm:grid-cols-3 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
