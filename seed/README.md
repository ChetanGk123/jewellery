# Seed sheets for the admin bulk import

Ready-to-import `.xlsx` fixtures for testing the bulk edit flow (Products /
Categories / Coupons → **Export .xlsx / Import** in the admin console). They
were generated with the app's own workbook builder (`lib/admin/bulk/xlsx.ts`),
so headers, dropdowns, and text-formatted columns match a real export exactly.

| File | Rows | Notes |
| --- | --- | --- |
| `categories-seed.xlsx` | 6 creates | Rings, Earrings, Necklaces, Bangles, Nose Pins, Anklets |
| `products-seed.xlsx` | 18 creates | Spread across all categories; includes Drafts, an out-of-stock row, a low-stock row, sale prices, plating options |
| `coupons-seed.xlsx` | 6 creates | percent / fixed / free-shipping kinds, expiries, one inactive |

## Import order

1. **Categories first** — the product rows reference the new categories by
   name and are rejected as "Unknown category" until they exist.
2. Products.
3. Coupons (independent, any time).

All rows have blank IDs, so importing creates new records; re-importing the
same file afterwards reports duplicate names/SKUs/codes as row errors rather
than creating duplicates. To bulk-*edit* real data, always start from a fresh
export (it carries the row IDs).
