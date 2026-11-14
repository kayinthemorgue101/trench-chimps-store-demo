# Trench Chimps Store — Design Demo

A static storefront demo for [Trench Chimps](https://trenchchimps.com/) merch. It is **not** the official store and it does not take payment.

Official shop: https://store.trenchchimps.com/ (Shopify, shop name Treehouse Shop)

## What is real

- Product titles, prices, variants, availability, photos, size charts, and material notes are copied from the public Shopify catalog (`/products.json`). No Storefront API token is used.
- Checkout opens a Shopify cart permalink (`/cart/<variant_id>:<qty>,...`) on the official store. Shopify handles payment.
- Shipping and refund copy is read from the store’s public policy JSON.
- Artwork on the community page is the official collection art from trenchchimps.com, labeled as collection art.
- Story copy is quoted from trenchchimps.com.

## What is not real

- The bag lives in this browser only (`localStorage`). It is not the Shopify bag until checkout.
- There is no email signup. The official store footer does not expose a working newsletter form, so this demo links to [@trenchchimps](https://x.com/trenchchimps) instead.
- “Spotted in the Trenches” has no customer photos and no moderation queue. The page says so and points at X and the official contact form.
- Hoodies, Tees, Women’s, Kids, and Rooted Different are groups derived from product names. Shopify does not publish those collections.
- “Featured” is not a sales ranking. The catalog has no popularity data.
- “New” means `published_at` within 30 days of the last catalog sync. “Sold out” and “Limited drop” come only from variant availability and tags/titles.

## Catalog sync

`scripts/sync_catalog.py` fetches the public endpoints and writes `public/data/catalog.json`. Render runs it on each deploy. If Shopify can’t be reached and a catalog file is already present, the script keeps that file and the build continues.

Client-side `fetch` of `store.trenchchimps.com` is not used. Those responses do not send `Access-Control-Allow-Origin`, so a static page cannot read them in the browser.

```bash
python3 scripts/sync_catalog.py
python3 -m http.server 4173 --directory public
```

Open http://localhost:4173

## Deploy

Render static site. Publish path: `public`. The service auto-deploys from the default branch when that branch is updated.
