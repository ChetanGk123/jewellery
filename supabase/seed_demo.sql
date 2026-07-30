-- supabase/seed_demo.sql — DEMO / TEST data for exercising the whole app.
--
-- ⚠️  NOT for a public production database. It creates a demo customer whose
--     password is written in plain text below. Run it on dev/staging, or clear
--     it out before the store goes live (see §11 for the teardown).
--
-- Prerequisites: 0001_initial_schema.sql applied, and `seed.sql` run first (it
-- creates the `setting` singleton this file does not touch).
--
-- How to run — Supabase SQL editor, or:
--     psql "$DATABASE_URL" -f supabase/seed_demo.sql
--
-- Runs as the table owner, so RLS is bypassed. Re-running is safe: §0 removes
-- every row this file previously created, keyed on the demo slugs/SKUs/emails,
-- and never touches rows it did not insert.
--
-- Product photos come from `public/seed-images/` (relative URLs — served by
-- Next itself, no Storage bucket or `remotePatterns` entry needed). They are
-- CC-licensed test images; see that folder's ATTRIBUTION.md.
--
-- Contents: 6 categories · 20 products (19 photographed + 1 Draft) · 20
-- product_image rows · 1 demo customer · 14 reviews · 6 coupons · 5 orders with
-- items · 1 return request · 3 contact tickets · 5 subscribers · 1 abandoned
-- cart. Catalogue and traffic only — store settings, the cron secret and the
-- admin account are `seed.sql`'s job.

begin;

-- `crypt`/`gen_salt` live in the `extensions` schema on Supabase and in
-- `public` on some self-hosted stacks — cover both.
set local search_path = public, extensions;

-- ════════════════════════════════════════════════════════════════════════
-- 0. Teardown of any previous run (idempotency)
-- ════════════════════════════════════════════════════════════════════════
-- Order matters only where there is no ON DELETE CASCADE: order_item,
-- product_image, review and return_request all cascade from their parent.

delete from public."order"          where order_no like 'JR-DEMO-%';
delete from public.contact_message  where ticket_no like 'TK-DEMO-%';
delete from public.subscriber       where email like '%@demo.rjjewellers.in';
delete from public.coupon           where code in
  ('FESTIVE10','FLAT500','FREESHIP','WELCOME15','DIWALI25','OLDCODE');
delete from public.product          where slug like 'demo-%' or sku like 'RJ-DEMO-%';
delete from public.category         where slug in
  ('earrings','necklaces','mangalsutra','rings','bangles-kada','anklets-adornments');
-- Cascades to customer_profile, cart_snapshot, push_subscription, identities.
-- Only the demo shopper — the admin account belongs to seed.sql, not here.
delete from auth.users              where email = 'demo@rjjewellers.in';

-- ════════════════════════════════════════════════════════════════════════
-- 1. Categories (6)
-- ════════════════════════════════════════════════════════════════════════
-- `image_url` is left null so the storefront falls back to `hero_bg`, the
-- maroon/gold gradient placeholder — the same path a fresh store takes before
-- the operator uploads category art.

insert into public.category (slug, name, description, hero_bg, sort_order) values
  ('earrings',            'Earrings',            'Jhumkas, temple drops and everyday studs in 22kt-tone finishes.',        'linear-gradient(135deg, #2A0A12 0%, #71182B 100%)', 1),
  ('necklaces',           'Necklaces',           'Haars, chokers and layered chains for the wedding trousseau.',           'linear-gradient(135deg, #4A0E1C 0%, #A87A1E 100%)', 2),
  ('mangalsutra',         'Mangalsutra',         'Vati pendants and black-bead chains, daily-wear to ceremonial.',         'linear-gradient(135deg, #2A1115 0%, #B58A3C 100%)', 3),
  ('rings',               'Rings',               'Kundan polki, coloured stone cocktail rings and minimal bands.',         'linear-gradient(135deg, #71182B 0%, #E6CA7E 100%)', 4),
  ('bangles-kada',        'Bangles & Kada',      'Antique kada pairs and glass bangle sets, sized 2.4 to 2.10.',           'linear-gradient(135deg, #2A0A12 0%, #C9A24B 100%)', 5),
  ('anklets-adornments',  'Anklets & Adornments','Payals, nath, maang tikka and nose pins to finish the look.',            'linear-gradient(135deg, #4A0E1C 0%, #F3E3C7 100%)', 6);

-- ════════════════════════════════════════════════════════════════════════
-- 2. Products (20)
-- ════════════════════════════════════════════════════════════════════════
-- Money is integer paise throughout (₹2,499 → 249900). `rating`/`review_count`
-- are deliberately left at their defaults — the `review_sync_rating` trigger
-- recomputes them from §6. `primary_image_url` is likewise left null; the
-- `product_image_sync_primary` trigger fills it from §3.
--
-- Status mix is intentional: 17 Active, 1 Low stock, 1 Out of stock, 1 Draft —
-- so you can verify the storefront hides Draft while admin still lists it.

insert into public.product (
  slug, sku, name, category_id, material, badge,
  price_paise, mrp_paise, stock, status,
  blurb, desc_long, details_plating, details_stones, details_care, shipping_note,
  is_featured, is_fresh, plating_options, gallery
) values
  -- ── Earrings ──────────────────────────────────────────────────────────
  ('demo-meenakari-chandbali-jhumka', 'RJ-DEMO-EAR-001', 'Meenakari Chandbali Jhumka',
   (select id from public.category where slug = 'earrings'), 'Brass, gold tone', 'Bestseller',
   249900, 319900, 24, 'Active',
   'Hand-painted meenakari crescents with a fluted jhumka drop and pearl fringe.',
   'A Hyderabadi chandbali reworked for modern wear — the crescent is hand-enamelled in rani pink and jade, then set with uncut-look stones. The jhumka drop swings freely and finishes in a row of shell pearls. Light enough for a full evening; the push-back is secured with a screw-on stopper.',
   '3-micron 22kt gold plating over brass', 'Kundan-look glass stones, shell pearls', 'Wipe with a dry cotton cloth after wear. Store in the pouch provided; keep away from perfume and water.',
   'Dispatched in 2–3 working days.', true, false,
   '{"Gold tone","Silver tone"}',
   '[{"url":"/seed-images/chandbali-jhumka.jpg","name":"Meenakari Chandbali Jhumka","primary":true}]'::jsonb),

  ('demo-lakshmi-temple-drops', 'RJ-DEMO-EAR-002', 'Lakshmi Temple Drop Earrings',
   (select id from public.category where slug = 'earrings'), 'Brass, antique gold tone', 'Bridal Edit',
   329900, null, 12, 'Active',
   'South Indian temple motif with a Lakshmi medallion and antique-gold matte finish.',
   'Cast from a traditional Nagercoil temple mould, the Lakshmi medallion sits above a ridged drop finished in matte antique gold. Pairs with a kasu maalai for the muhurtham, or on its own with a Kanjeevaram.',
   'Antique gold plating, matte sealed', 'Ruby and emerald tone glass cabochons', 'Do not immerse in water. The matte finish darkens gently with age — that is intended.',
   'Dispatched in 2–3 working days.', true, false,
   '{"Gold tone"}',
   '[{"url":"/seed-images/temple-drop-earrings.jpg","name":"Lakshmi Temple Drop Earrings","primary":true}]'::jsonb),

  ('demo-freshwater-pearl-studs', 'RJ-DEMO-EAR-003', 'Freshwater Pearl Studs',
   (select id from public.category where slug = 'earrings'), 'Sterling silver 925', 'None',
   89900, 109900, 60, 'Active',
   '7mm button pearls on 925 silver posts — the everyday pair.',
   'Genuine freshwater button pearls, hand-matched for lustre and set on hypoallergenic sterling silver posts. The pair that goes from a work call to a family function without a change.',
   'Rhodium-finished 925 silver', 'Freshwater cultured pearls, 7mm', 'Pearls are porous — put them on last, after perfume and hairspray. Wipe with a damp cloth only.',
   'Dispatched in 2 working days.', false, true,
   '{"Silver tone","Rose gold"}',
   '[{"url":"/seed-images/pearl-stud-earrings.jpg","name":"Freshwater Pearl Studs","primary":true}]'::jsonb),

  -- ── Necklaces ─────────────────────────────────────────────────────────
  ('demo-satlada-haram', 'RJ-DEMO-NEC-001', 'Satlada Pearl Haram',
   (select id from public.category where slug = 'necklaces'), 'Brass, gold tone', 'Bridal Edit',
   899900, 1149900, 6, 'Active',
   'Seven-strand Hyderabadi haram with a carved emerald-tone centrepiece.',
   'The satlada — literally seven strands — is the Nizami bridal heirloom. Graduated shell pearl strands fall to below the sternum and gather into a carved centrepiece flanked by emerald-tone drops. Comes with an adjustable dori so it sits right on any neckline.',
   '3-micron 22kt gold plating over brass', 'Shell pearls, emerald-tone carved glass', 'Store flat in the box provided so the strands do not tangle. Never hang a multi-strand haram.',
   'Made to order — dispatched in 5–7 working days.', true, false,
   '{"Gold tone"}',
   '[{"url":"/seed-images/satlada-haram.jpg","name":"Satlada Pearl Haram","primary":true}]'::jsonb),

  ('demo-layered-chain-necklace', 'RJ-DEMO-NEC-002', 'Layered Rope Chain Necklace',
   (select id from public.category where slug = 'necklaces'), 'Brass, gold tone', 'New',
   199900, null, 30, 'Active',
   'Three rope chains at graduated lengths on a single clasp — no tangling.',
   'The layered look without the morning fight: three rope chains at 16, 18 and 20 inches, joined to one lobster clasp so they always sit at the right spacing. Wears well over a kurta or a plain black dress.',
   '2-micron gold plating over brass', 'None', 'Remove before swimming or bathing. Chlorine strips plating faster than anything else.',
   'Dispatched in 2–3 working days.', false, true,
   '{"Gold tone","Rose gold"}',
   '[{"url":"/seed-images/layered-chain-necklace.jpg","name":"Layered Rope Chain Necklace","primary":true}]'::jsonb),

  ('demo-antique-choker-set', 'RJ-DEMO-NEC-003', 'Antique Kundan Choker Set',
   (select id from public.category where slug = 'necklaces'), 'Brass, antique gold tone', 'Bridal Edit',
   749900, 899900, 4, 'Low stock',
   'Choker with matching jhumkas and a maang tikka — the full bridal set.',
   'A three-piece set built around an uncut-kundan-look choker with pearl drops, finished in antique gold. Includes matching jhumkas and a maang tikka, all packed in a single lined box. Sized with an adjustable dori at the back.',
   'Antique gold plating over brass', 'Kundan-look glass, shell pearl drops', 'Handle the kundan settings gently — do not press on the stones. Keep in the box between wears.',
   'Made to order — dispatched in 5–7 working days.', true, false,
   '{"Gold tone"}',
   '[{"url":"/seed-images/antique-choker-set.jpg","name":"Antique Kundan Choker Set","primary":true}]'::jsonb),

  -- ── Mangalsutra ───────────────────────────────────────────────────────
  ('demo-mangalsutra-chain-22in', 'RJ-DEMO-MNG-001', 'Classic Mangalsutra Chain — 22in',
   (select id from public.category where slug = 'mangalsutra'), 'Brass, gold tone', 'Bestseller',
   459900, 549900, 18, 'Active',
   'Double-line black bead chain, 22 inches, with a plain gold-tone clasp.',
   'The traditional length and the traditional weight — two lines of black beads with gold-tone spacers, finished at 22 inches. No pendant, so you can add the vati your family uses.',
   '3-micron 22kt gold plating over brass', 'Glass black beads (nalla pusalu)', 'Take it off before a head bath; soap residue dulls the beads.',
   'Dispatched in 2–3 working days.', true, false,
   '{"Gold tone"}',
   '[{"url":"/seed-images/mangalsutra-chain-22in.jpg","name":"Classic Mangalsutra Chain 22in","primary":true}]'::jsonb),

  ('demo-vati-pendant-mangalsutra', 'RJ-DEMO-MNG-002', 'Vati Pendant Mangalsutra',
   (select id from public.category where slug = 'mangalsutra'), 'Brass, gold tone', 'None',
   529900, null, 15, 'Active',
   'Twin-vati Maharashtrian pendant on a double black bead chain.',
   'The two vatis represent the couple; the black beads guard against nazar. This is the Maharashtrian form, with domed vatis in a high-polish gold tone on a 24-inch double bead chain.',
   '3-micron 22kt gold plating over brass', 'Glass black beads', 'Polish the vatis with a dry cloth. Do not use silver dip — it strips gold plating.',
   'Dispatched in 3–4 working days.', false, false,
   '{"Gold tone"}',
   '[{"url":"/seed-images/vati-pendant-mangalsutra.jpg","name":"Vati Pendant Mangalsutra","primary":true},
     {"url":"/seed-images/mangal-2.jpg","name":"Vati Pendant — clasp detail","primary":false}]'::jsonb),

  ('demo-short-mangalsutra-daily', 'RJ-DEMO-MNG-003', 'Short Mangalsutra — Daily Wear',
   (select id from public.category where slug = 'mangalsutra'), 'Brass, gold tone', 'New',
   349900, 399900, 22, 'Active',
   'An 18-inch single-line version that sits above the neckline of a kurta.',
   'Built for women who wear a mangalsutra to work every day: single line, 18 inches, lighter beads and a small pendant that will not catch on a dupatta or a laptop bag strap.',
   '2-micron gold plating over brass', 'Glass black beads', 'Daily wear will dull the plating over 12–18 months; we re-plate at a nominal charge.',
   'Dispatched in 2 working days.', false, true,
   '{"Gold tone","Rose gold"}',
   '[{"url":"/seed-images/mangal-2.jpg","name":"Short Mangalsutra Daily Wear","primary":true}]'::jsonb),

  -- ── Rings ─────────────────────────────────────────────────────────────
  ('demo-kundan-polki-ring', 'RJ-DEMO-RNG-001', 'Kundan Polki Statement Ring',
   (select id from public.category where slug = 'rings'), 'Brass, antique gold tone', 'Bestseller',
   279900, 329900, 20, 'Active',
   'An uncut-polki-look centre stone in a scalloped antique setting.',
   'A wide-face statement ring with an uncut-polki-look centre in a hand-scalloped bezel, ringed by small kundan chips. Adjustable at the shank, so it fits sizes 12 to 18.',
   'Antique gold plating over brass', 'Kundan-look glass, uncut polki-style centre', 'Adjust the shank slowly with both hands; do not force it.',
   'Dispatched in 2–3 working days.', true, false,
   '{"Gold tone"}',
   '[{"url":"/seed-images/kundan-polki-ring.jpg","name":"Kundan Polki Statement Ring","primary":true}]'::jsonb),

  ('demo-emerald-cocktail-ring', 'RJ-DEMO-RNG-002', 'Emerald Cocktail Ring',
   (select id from public.category where slug = 'rings'), 'Brass, gold tone', 'None',
   419900, 489900, 0, 'Out of stock',
   'A single emerald-tone oval in a pavé halo — the one that gets noticed.',
   'An oval emerald-tone stone, 14x10mm, held in a four-prong setting inside a pavé halo of white stones. Deliberately oversized. Fixed size 16; other sizes made to order.',
   '3-micron 22kt gold plating over brass', 'Emerald-tone glass, cubic zirconia halo', 'Do not soak. Clean around the prongs with a soft dry brush.',
   'Currently out of stock — restocking in 3 weeks.', false, false,
   '{"Gold tone","Silver tone"}',
   '[{"url":"/seed-images/emerald-cocktail-ring.jpg","name":"Emerald Cocktail Ring","primary":true}]'::jsonb),

  ('demo-minimal-band-ring', 'RJ-DEMO-RNG-003', 'Minimal Stacking Band',
   (select id from public.category where slug = 'rings'), 'Sterling silver 925', 'New',
   129900, null, 45, 'Active',
   'A 2mm brushed band made to stack two or three deep.',
   'Plain, 2mm, brushed rather than polished so it does not compete with whatever you stack beside it. Sterling silver, available in rhodium or rose finish.',
   'Rhodium or rose finish on 925 silver', 'None', 'Silver tarnishes — that is normal. A silver cloth brings it back in a minute.',
   'Dispatched in 2 working days.', false, true,
   '{"Silver tone","Rose gold"}',
   '[{"url":"/seed-images/minimal-band-ring.jpg","name":"Minimal Stacking Band","primary":true}]'::jsonb),

  -- ── Bangles & Kada ────────────────────────────────────────────────────
  ('demo-antique-kada-pair', 'RJ-DEMO-BNG-001', 'Antique Temple Kada — Pair',
   (select id from public.category where slug = 'bangles-kada'), 'Brass, antique gold tone', 'Bridal Edit',
   639900, 749900, 8, 'Active',
   'Broad temple-motif kadas sold as a pair, size 2.6 and 2.8.',
   'Broad-faced kadas with a repeating temple arch motif and a screw-open hinge, so they go on without forcing the wrist. Sold as a pair — specify 2.6 or 2.8 at checkout in the order notes.',
   'Antique gold plating over brass', 'Ruby-tone glass accents', 'Open the hinge fully before wearing. Do not twist the kada onto the hand.',
   'Made to order — dispatched in 5–7 working days.', true, false,
   '{"Gold tone"}',
   '[{"url":"/seed-images/antique-kada-pair.jpg","name":"Antique Temple Kada Pair","primary":true}]'::jsonb),

  ('demo-glass-bangle-set-12', 'RJ-DEMO-BNG-002', 'Glass Bangle Set of 12',
   (select id from public.category where slug = 'bangles-kada'), 'Lac and glass', 'None',
   59900, 79900, 80, 'Active',
   'Twelve lac-and-glass bangles with mirror work — one full haath.',
   'A dozen bangles in graduated tones with small mirror inlays, enough to fill one arm. Traditional lac core, so they have some give. Sizes 2.4 through 2.10.',
   'Lac core with glass and mirror inlay', 'Mirror inlay, glass beading', 'Glass bangles chip — store them in the roll provided, not loose in a drawer.',
   'Dispatched in 2 working days. Packed in a padded roll.', false, false,
   '{}',
   '[{"url":"/seed-images/glass-bangle-set-of-12.jpg","name":"Glass Bangle Set of 12","primary":true}]'::jsonb),

  -- ── Anklets & Adornments ──────────────────────────────────────────────
  ('demo-bridal-nath', 'RJ-DEMO-ADN-001', 'Maharashtrian Bridal Nath',
   (select id from public.category where slug = 'anklets-adornments'), 'Brass, gold tone', 'Bridal Edit',
   189900, 229900, 14, 'Active',
   'Clip-on brahmani nath with pearl and ruby-tone drops — no piercing needed.',
   'The Maharashtrian brahmani shape, curved to sit against the cheek, strung with rice pearls and a ruby-tone centre. Clip-on fitting with a silicone pad, so it holds through a full ceremony without a piercing.',
   'Gold plating over brass', 'Rice pearls, ruby-tone glass', 'Adjust the clip tension gently before the day, not on the day.',
   'Dispatched in 3–4 working days.', true, false,
   '{"Gold tone"}',
   '[{"url":"/seed-images/bridal-nath.jpg","name":"Maharashtrian Bridal Nath","primary":true}]'::jsonb),

  ('demo-kundan-maang-tikka', 'RJ-DEMO-ADN-002', 'Kundan Maang Tikka',
   (select id from public.category where slug = 'anklets-adornments'), 'Brass, antique gold tone', 'None',
   229900, null, 16, 'Active',
   'A single-layer tikka with a pearl drop and a strong hair hook.',
   'Round kundan-look centre with a shell pearl drop, on a chain long enough for a centre parting. The hook is reinforced — the usual failure point on a tikka is the hook bending open mid-function.',
   'Antique gold plating over brass', 'Kundan-look glass, shell pearl', 'Hook it into the hair, not into the parting itself, so it does not pull.',
   'Dispatched in 2–3 working days.', false, false,
   '{"Gold tone"}',
   '[{"url":"/seed-images/kundan-maang-tikka.jpg","name":"Kundan Maang Tikka","primary":true}]'::jsonb),

  ('demo-crystal-nose-pin', 'RJ-DEMO-ADN-003', 'Crystal Nose Pin',
   (select id from public.category where slug = 'anklets-adornments'), 'Sterling silver 925', 'None',
   49900, 59900, 100, 'Active',
   'A 2mm crystal on a 925 silver screw-in post — safe for a fresh piercing.',
   'Small, clean and hypoallergenic. The screw-in post will not fall out during sleep, which is the main complaint with push-pin nose studs.',
   'Rhodium-finished 925 silver', 'Cubic zirconia, 2mm', 'Clean with saline, not with alcohol, if the piercing is new.',
   'Dispatched in 2 working days.', false, true,
   '{"Silver tone","Gold tone"}',
   '[{"url":"/seed-images/crystal-nose-pin.jpg","name":"Crystal Nose Pin","primary":true}]'::jsonb),

  ('demo-ghungroo-payal-pair', 'RJ-DEMO-ADN-004', 'Ghungroo Payal — Pair',
   (select id from public.category where slug = 'anklets-adornments'), 'Sterling silver 925', 'Bestseller',
   169900, 199900, 26, 'Active',
   'Silver payals with a full row of ghungroos — you will hear these.',
   'A traditional pair with closely-set ghungroos along the whole length, so they ring properly rather than rattling. Adjustable chain extension at the clasp.',
   'Oxidised 925 silver', 'None', 'Oxidised silver darkens in the recesses on purpose — clean only the raised surfaces.',
   'Dispatched in 2–3 working days.', true, false,
   '{"Silver tone"}',
   '[{"url":"/seed-images/ghungroo-payal-pair.jpg","name":"Ghungroo Payal Pair","primary":true}]'::jsonb),

  ('demo-minimal-chain-anklet', 'RJ-DEMO-ADN-005', 'Minimal Chain Anklet',
   (select id from public.category where slug = 'anklets-adornments'), 'Sterling silver 925', 'New',
   99900, null, 40, 'Active',
   'A single fine silver chain with one charm — silent, unlike a payal.',
   'For when a payal is too much: one fine rope chain, one small disc charm, adjustable from 9 to 11 inches. Sold singly, not as a pair.',
   'Rhodium-finished 925 silver', 'None', 'Take it off before a beach day — sand scratches fine chain.',
   'Dispatched in 2 working days.', false, true,
   '{"Silver tone","Rose gold"}',
   '[{"url":"/seed-images/minimal-chain-anklet.jpg","name":"Minimal Chain Anklet","primary":true}]'::jsonb),

  -- ── Draft: never visible on the storefront, editable in admin ──────────
  -- Deliberately image-less as well, so the admin placeholder path is covered.
  ('demo-complete-bridal-trousseau', 'RJ-DEMO-SET-001', 'Complete Bridal Trousseau Set',
   (select id from public.category where slug = 'anklets-adornments'), 'Brass, gold tone', 'Bridal Edit',
   1299900, 1599900, 2, 'Draft',
   'Choker, haram, jhumkas, tikka, nath and kada in one box — pricing not final.',
   'Work in progress: the full seven-piece trousseau. Photography and final pricing pending, so this stays in Draft — it should not appear anywhere on the storefront.',
   'Antique gold plating over brass', 'Kundan-look glass, shell pearls', 'Draft record — care copy not written yet.',
   null, false, false,
   '{"Gold tone"}',
   '[]'::jsonb);

-- ════════════════════════════════════════════════════════════════════════
-- 3. Product images
-- ════════════════════════════════════════════════════════════════════════
-- The storefront reads `product_image` (both the listing and the detail page),
-- while the admin edit modal reads the `gallery` jsonb set above — so both have
-- to be written or the two consoles disagree. Inserting here also fires
-- `product_image_sync_primary`, which backfills `product.primary_image_url`.

insert into public.product_image (product_id, url, design_name, is_primary, sort_order)
select p.id,
       g.item ->> 'url',
       g.item ->> 'name',
       coalesce((g.item ->> 'primary')::boolean, false),
       (g.ord - 1)::int
from public.product p
cross join lateral jsonb_array_elements(p.gallery) with ordinality as g(item, ord)
where p.sku like 'RJ-DEMO-%';

-- ════════════════════════════════════════════════════════════════════════
-- 4. Demo customer account
-- ════════════════════════════════════════════════════════════════════════
--   demo@rjjewellers.in  /  DemoUser@2026
--
-- A plain shopper — the orders, reviews, return request and abandoned cart
-- below all hang off this account. The ADMIN account is not created here; it is
-- part of the mandatory bootstrap in `seed.sql`, because a usable admin login
-- is needed whether or not you ever load demo data.
--
-- `email_confirmed_at` is pre-set so the account never has to clear a
-- confirmation mail (which self-hosted stacks often cannot send at all).

do $$
declare
  v_demo_id uuid := gen_random_uuid();
  v_has_provider_id boolean;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
    ('00000000-0000-0000-0000-000000000000', v_demo_id, 'authenticated', 'authenticated',
     'demo@rjjewellers.in', crypt('DemoUser@2026', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Ananya Deshpande"}'::jsonb,
     now() - interval '90 days', now(), '', '', '', '');

  -- GoTrue needs a matching identity row for password sign-in. `provider_id`
  -- only exists on newer releases, so branch rather than assume.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
  ) into v_has_provider_id;

  if v_has_provider_id then
    insert into auth.identities (id, user_id, identity_data, provider, provider_id,
                                 last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_demo_id,
            jsonb_build_object('sub', v_demo_id::text, 'email', 'demo@rjjewellers.in',
                               'email_verified', true),
            'email', v_demo_id::text, now(), now(), now());
  else
    insert into auth.identities (id, user_id, identity_data, provider,
                                 last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_demo_id,
            jsonb_build_object('sub', v_demo_id::text, 'email', 'demo@rjjewellers.in',
                               'email_verified', true),
            'email', now(), now(), now());
  end if;
end $$;

-- Prefills the checkout form for the customer account.
insert into public.customer_profile (id, full_name, phone, address_line, city, state, pincode)
select id, 'Ananya Deshpande', '9876543210',
       'Flat 402, Shivneri Apartments, Law College Road', 'Pune', 'Maharashtra', '411004'
from auth.users where email = 'demo@rjjewellers.in';

-- ════════════════════════════════════════════════════════════════════════
-- 5. Coupons (6)
-- ════════════════════════════════════════════════════════════════════════
-- Covers all three kinds plus the three rejection paths the cart has to
-- handle: exhausted usage limit, past expiry, and manually deactivated.

insert into public.coupon (code, kind, value, min_subtotal_paise, max_discount_paise,
                           usage_limit, usage_count, expires_at, is_active) values
  ('FESTIVE10',  'percent',       10, 99900,  100000, 500, 37,  now() + interval '60 days', true),
  ('FLAT500',    'fixed',      50000, 299900, null,   200, 12,  now() + interval '30 days', true),
  ('FREESHIP',   'free_shipping',  0, null,   null,   null, 88, null,                       true),
  ('WELCOME15',  'percent',       15, null,   150000, 100, 100, now() + interval '90 days', true),  -- exhausted
  ('DIWALI25',   'percent',       25, 149900, 200000, null, 210, now() - interval '20 days', true), -- expired
  ('OLDCODE',    'fixed',      25000, null,   null,   null, 5,  null,                       false); -- deactivated

-- ════════════════════════════════════════════════════════════════════════
-- 6. Reviews (14)
-- ════════════════════════════════════════════════════════════════════════
-- Only 'approved' rows feed product.rating / review_count (sync_product_rating);
-- the pending and rejected rows exist to give the admin moderation queue work.
-- The unique index on (product_id, user_id) allows the demo customer at most
-- one review per product, so their two are on different products.

insert into public.review (product_id, user_id, name, rating, title, body, status, created_at)
values
  ((select id from public.product where slug = 'demo-meenakari-chandbali-jhumka'),
   (select id from auth.users where email = 'demo@rjjewellers.in'),
   'Ananya D.', 5, 'Lighter than they look',
   'Wore these for a six-hour reception and my ears were fine. The meenakari colour is much richer in person than on screen.',
   'approved', now() - interval '22 days'),
  ((select id from public.product where slug = 'demo-meenakari-chandbali-jhumka'), null,
   'Sneha R.', 4, 'Beautiful, clasp is fiddly',
   'No complaints about the jhumka itself. The screw-on stopper takes practice to get on.',
   'approved', now() - interval '15 days'),
  ((select id from public.product where slug = 'demo-meenakari-chandbali-jhumka'), null,
   'Priya M.', 5, 'Bought a second pair', 'Gifted the first to my sister-in-law and immediately ordered again.',
   'approved', now() - interval '6 days'),
  ((select id from public.product where slug = 'demo-lakshmi-temple-drops'), null,
   'Lakshmi V.', 5, 'Proper temple work',
   'The mould detail is sharp, not the blurry cast you get at this price. Matched my kasu maalai well.',
   'approved', now() - interval '30 days'),
  ((select id from public.product where slug = 'demo-lakshmi-temple-drops'), null,
   'Divya K.', 4, 'Heavier than expected', 'Gorgeous, but I would not wear them all day. Fine for a few hours.',
   'approved', now() - interval '11 days'),
  ((select id from public.product where slug = 'demo-freshwater-pearl-studs'),
   (select id from auth.users where email = 'demo@rjjewellers.in'),
   'Ananya D.', 5, 'My default earrings now', 'Went straight from the box to daily wear. Pearls are well matched.',
   'approved', now() - interval '40 days'),
  ((select id from public.product where slug = 'demo-freshwater-pearl-studs'), null,
   'Meera S.', 3, 'Smaller than I pictured', '7mm is accurate, that is on me for not reading. Quality is good.',
   'approved', now() - interval '19 days'),
  ((select id from public.product where slug = 'demo-satlada-haram'), null,
   'Rukmini B.', 5, 'Wedding piece, worth it',
   'Wore this for my daughter''s muhurtham. Several people asked whether it was the family original.',
   'approved', now() - interval '55 days'),
  ((select id from public.product where slug = 'demo-mangalsutra-chain-22in'), null,
   'Kavya N.', 5, 'Exactly 22 inches', 'Measured it. Bead spacing is even the whole way round.',
   'approved', now() - interval '27 days'),
  ((select id from public.product where slug = 'demo-mangalsutra-chain-22in'), null,
   'Anjali P.', 4, 'Good weight', 'Feels substantial without being heavy on the neck. Plating still bright after a month.',
   'approved', now() - interval '9 days'),
  ((select id from public.product where slug = 'demo-kundan-polki-ring'), null,
   'Shruti J.', 5, 'The adjustable shank actually works', 'Fits my index and my middle finger. Centre stone catches light nicely.',
   'approved', now() - interval '13 days'),
  ((select id from public.product where slug = 'demo-ghungroo-payal-pair'), null,
   'Harini T.', 4, 'They ring properly', 'Close-set ghungroos, so it is a ring and not a rattle. Slightly long for me.',
   'approved', now() - interval '8 days'),
  -- Awaiting moderation → shows up in the admin Reviews queue, not on the PDP.
  ((select id from public.product where slug = 'demo-antique-choker-set'), null,
   'Neha G.', 5, 'Whole set in one box', 'Everything matched, nothing needed swapping. Will update after the wedding.',
   'pending', now() - interval '2 days'),
  ((select id from public.product where slug = 'demo-glass-bangle-set-12'), null,
   'spam_bot_99', 1, 'CHEAP RATES CLICK HERE', 'visit my site for wholesale rates www.example-spam.test',
   'rejected', now() - interval '4 days');

-- ════════════════════════════════════════════════════════════════════════
-- 7. Orders (5) + line items
-- ════════════════════════════════════════════════════════════════════════
-- Real checkouts go through place_order(), which generates JR-YYMMDD-NNNN-XXXX
-- order numbers off order_no_seq. These use a JR-DEMO-000N form instead so §0
-- can identify and remove them without touching genuine orders.
--
-- Totals obey the store rules seeded in seed.sql: shipping is ₹0 at or above
-- the ₹999 free-ship threshold, else ₹79 flat. In every row:
--   total_paise = subtotal_paise - discount_paise + shipping_paise
-- Statuses cover the full pipeline: Delivered, Shipped, Confirmed, Pending,
-- Cancelled.

insert into public."order" (
  order_no, status, payment_method, payment_status, user_id,
  customer_name, customer_phone, customer_email,
  address_line, city, state, pincode,
  subtotal_paise, discount_paise, shipping_paise, total_paise, coupon_code,
  awb, tracking_url, delivered_at, created_at
) values
  -- 1. Delivered, signed-in customer — the order §8's return request hangs off.
  ('JR-DEMO-0001', 'Delivered', 'cod', 'paid',
   (select id from auth.users where email = 'demo@rjjewellers.in'),
   'Ananya Deshpande', '9876543210', 'demo@rjjewellers.in',
   'Flat 402, Shivneri Apartments, Law College Road', 'Pune', 'Maharashtra', '411004',
   219800, 0, 0, 219800, null,
   'DEMOAWB0001', 'https://shiprocket.co/tracking/DEMOAWB0001',
   now() - interval '9 days', now() - interval '16 days'),

  -- 2. Shipped, signed-in customer — in transit, has an AWB.
  ('JR-DEMO-0002', 'Shipped', 'cod', 'pending',
   (select id from auth.users where email = 'demo@rjjewellers.in'),
   'Ananya Deshpande', '9876543210', 'demo@rjjewellers.in',
   'Flat 402, Shivneri Apartments, Law College Road', 'Pune', 'Maharashtra', '411004',
   249900, 0, 0, 249900, null,
   'DEMOAWB0002', 'https://shiprocket.co/tracking/DEMOAWB0002',
   null, now() - interval '4 days'),

  -- 3. Confirmed, guest checkout, FESTIVE10 applied (10% of ₹1,697 = ₹169.70).
  ('JR-DEMO-0003', 'Confirmed', 'cod', 'pending', null,
   'Rohit Malhotra', '9811122233', 'rohit.malhotra@example.com',
   'B-12, Greenwood Society, Baner Road', 'Pune', 'Maharashtra', '411045',
   169700, 16970, 0, 152730, 'FESTIVE10',
   null, null, null, now() - interval '2 days'),

  -- 4. Pending, below the ₹999 free-ship threshold → ₹79 flat shipping.
  ('JR-DEMO-0004', 'Pending', 'cod', 'pending',
   (select id from auth.users where email = 'demo@rjjewellers.in'),
   'Ananya Deshpande', '9876543210', 'demo@rjjewellers.in',
   'Flat 402, Shivneri Apartments, Law College Road', 'Pune', 'Maharashtra', '411004',
   49900, 0, 7900, 57800, null,
   null, null, null, now() - interval '6 hours'),

  -- 5. Cancelled, guest checkout — high value, customer changed their mind.
  ('JR-DEMO-0005', 'Cancelled', 'cod', 'pending', null,
   'Sunita Iyer', '9900011122', 'sunita.iyer@example.com',
   '17, Rajaji Street, T. Nagar', 'Chennai', 'Tamil Nadu', '600017',
   1089800, 0, 0, 1089800, null,
   null, null, null, now() - interval '11 days');

insert into public.order_item (order_id, product_id, name, tone, qty, unit_price_paise, line_total_paise)
values
  -- JR-DEMO-0001 · ₹899 + ₹1,299 = ₹2,198
  ((select id from public."order" where order_no = 'JR-DEMO-0001'),
   (select id from public.product where slug = 'demo-freshwater-pearl-studs'),
   'Freshwater Pearl Studs', 'Silver tone', 1, 89900, 89900),
  ((select id from public."order" where order_no = 'JR-DEMO-0001'),
   (select id from public.product where slug = 'demo-minimal-band-ring'),
   'Minimal Stacking Band', 'Rose gold', 1, 129900, 129900),

  -- JR-DEMO-0002 · ₹2,499
  ((select id from public."order" where order_no = 'JR-DEMO-0002'),
   (select id from public.product where slug = 'demo-meenakari-chandbali-jhumka'),
   'Meenakari Chandbali Jhumka', 'Gold tone', 1, 249900, 249900),

  -- JR-DEMO-0003 · (₹599 x 2) + ₹499 = ₹1,697
  ((select id from public."order" where order_no = 'JR-DEMO-0003'),
   (select id from public.product where slug = 'demo-glass-bangle-set-12'),
   'Glass Bangle Set of 12', null, 2, 59900, 119800),
  ((select id from public."order" where order_no = 'JR-DEMO-0003'),
   (select id from public.product where slug = 'demo-crystal-nose-pin'),
   'Crystal Nose Pin', 'Silver tone', 1, 49900, 49900),

  -- JR-DEMO-0004 · ₹499
  ((select id from public."order" where order_no = 'JR-DEMO-0004'),
   (select id from public.product where slug = 'demo-crystal-nose-pin'),
   'Crystal Nose Pin', 'Gold tone', 1, 49900, 49900),

  -- JR-DEMO-0005 · ₹8,999 + ₹1,899 = ₹10,898
  ((select id from public."order" where order_no = 'JR-DEMO-0005'),
   (select id from public.product where slug = 'demo-satlada-haram'),
   'Satlada Pearl Haram', 'Gold tone', 1, 899900, 899900),
  ((select id from public."order" where order_no = 'JR-DEMO-0005'),
   (select id from public.product where slug = 'demo-bridal-nath'),
   'Maharashtrian Bridal Nath', 'Gold tone', 1, 189900, 189900);

-- ════════════════════════════════════════════════════════════════════════
-- 8. Return request — on the delivered order
-- ════════════════════════════════════════════════════════════════════════
-- `photos` holds paths in the private return-photos bucket. These point at
-- objects that do not exist, so the admin thumbnails will 404 — expected for
-- seed data; upload real ones through the customer return flow to test that.

insert into public.return_request (order_id, user_id, status, reason, resolution, upi_id, photos, created_at)
select o.id, o.user_id, 'Requested',
       'The stacking band arrived with a visible scratch across the brushed face. Happy to keep the pearl studs — only returning the ring.',
       'refund', 'ananya@okhdfcbank', array[
         o.user_id::text || '/demo-return-1.jpg',
         o.user_id::text || '/demo-return-2.jpg'
       ], now() - interval '3 days'
from public."order" o
where o.order_no = 'JR-DEMO-0001';

-- ════════════════════════════════════════════════════════════════════════
-- 9. Contact tickets (3) and newsletter subscribers (5)
-- ════════════════════════════════════════════════════════════════════════

insert into public.contact_message (ticket_no, subject, body, name, email, phone, status, resolution_note, created_at) values
  ('TK-DEMO-001', 'Sizing help — kada pair',
   'I want the antique temple kada but I am not sure between 2.6 and 2.8. My bangle size is usually 2.6 in glass bangles. Which should I order?',
   'Preethi Raghavan', 'preethi.r@example.com', '9845012345', 'New', null, now() - interval '1 day'),
  ('TK-DEMO-002', 'Order not showing in my account',
   'I placed an order as a guest before creating an account. Can you attach it to demo@rjjewellers.in so I can track it?',
   'Ananya Deshpande', 'demo@rjjewellers.in', '9876543210', 'In Progress', null, now() - interval '5 days'),
  ('TK-DEMO-003', 'Bulk enquiry — 40 sets for return gifts',
   'We need roughly 40 glass bangle sets as return gifts for a wedding in November. Do you offer a bulk rate and can you deliver to Nashik?',
   'Vikram Joshi', 'vikram.joshi@example.com', '9822233344', 'Resolved',
   'Quoted 18% off for 40+ units, delivery to Nashik in 10 days. Customer confirmed on WhatsApp; invoice raised offline.',
   now() - interval '14 days');

insert into public.subscriber (email, source, created_at) values
  ('ananya.d@demo.rjjewellers.in',   'footer',   now() - interval '88 days'),
  ('preethi.r@demo.rjjewellers.in',  'popup',    now() - interval '34 days'),
  ('vikram.j@demo.rjjewellers.in',   'checkout', now() - interval '14 days'),
  ('sneha.rao@demo.rjjewellers.in',  'footer',   now() - interval '7 days'),
  ('divya.k@demo.rjjewellers.in',    'popup',    now() - interval '2 days');

-- ════════════════════════════════════════════════════════════════════════
-- 10. Abandoned cart — feeds /api/cron/abandoned-carts
-- ════════════════════════════════════════════════════════════════════════
-- `reminded_at` is null and `updated_at` is old, which is exactly the state the
-- cron looks for when deciding who to nudge.

insert into public.cart_snapshot (user_id, items, updated_at, reminded_at)
select id,
  '[{"name":"Antique Kundan Choker Set","slug":"demo-antique-choker-set","qty":1,"unit_price_paise":749900,"tone":"Gold tone"},
    {"name":"Kundan Maang Tikka","slug":"demo-kundan-maang-tikka","qty":1,"unit_price_paise":229900,"tone":"Gold tone"}]'::jsonb,
  now() - interval '3 days', null
from auth.users where email = 'demo@rjjewellers.in';

commit;

-- ════════════════════════════════════════════════════════════════════════
-- 11. Teardown — removes everything above, leaves real data alone
-- ════════════════════════════════════════════════════════════════════════
-- Store settings are NOT touched by this file — they belong to `seed.sql`, so
-- there is nothing to undo here.
--
-- Run §0's statements on their own, or:
--
--   delete from public."order"         where order_no  like 'JR-DEMO-%';
--   delete from public.contact_message where ticket_no like 'TK-DEMO-%';
--   delete from public.subscriber      where email     like '%@demo.rjjewellers.in';
--   delete from public.product         where sku       like 'RJ-DEMO-%';
--   delete from public.category        where slug in ('earrings','necklaces','mangalsutra',
--                                                     'rings','bangles-kada','anklets-adornments');
--   delete from public.coupon          where code in ('FESTIVE10','FLAT500','FREESHIP',
--                                                     'WELCOME15','DIWALI25','OLDCODE');
--   delete from auth.users             where email = 'demo@rjjewellers.in';
