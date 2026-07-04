-- 0010_product_images_storage.sql — Supabase Storage for product images
--
-- The Designs & images grid uploads real files (no more URL paste). Files live
-- in a public `product-images` bucket; the stored gallery/primary_image_url hold
-- the resulting public URLs. Uploads go through the admin's cookie session (the
-- uploadProductImage server action), so Storage writes are gated on is_admin()
-- (0006) exactly like every other admin write — the anon/publishable key can
-- read images (public storefront) but cannot upload.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Public read: the storefront and admin thumbnails load images anonymously.
drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Admin-only writes (upload / overwrite / delete), gated on is_admin().
drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
