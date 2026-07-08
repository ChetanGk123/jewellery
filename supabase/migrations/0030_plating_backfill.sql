-- 0030_plating_backfill.sql
-- 6.3 follow-through. The storefront tone selector now reads the
-- admin-managed `product.plating_options` column instead of the seed-era
-- `product_option` rows (which had no console edit path — admin changes never
-- reached the storefront). `plating_options` arrived in 0009 defaulting to
-- '{}', so products seeded before that still hold their tones only in
-- `product_option`. Backfill those labels once, making the column the single
-- source of truth for every product.
--
-- `product_option` itself is kept (data preservation; nothing reads it now) —
-- drop in a later cleanup migration once the backfill has soaked.

update public.product p
set plating_options = sub.labels
from (
  select product_id, array_agg(label order by sort_order) as labels
  from public.product_option
  group by product_id
) sub
where sub.product_id = p.id
  and coalesce(cardinality(p.plating_options), 0) = 0;
