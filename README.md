# Trench Chimps Store — Design Demo

A clickable static mockup of a redesigned merch homepage for [Trench Chimps](https://store.trenchchimps.com/). It uses the real product names, prices, variants, and photos from the live Shopify store, but **it is not the official store and cannot take real orders**.

Official store: https://store.trenchchimps.com/

## What’s in the demo

- Homepage with announcement bar, branded header, jungle hero, product grid, collection tiles, About the Chimps, and Join the Troop signup
- Collection filters for Men, Women, Youth, and Hoodies
- Product modal with real colors, sizes, and prices
- A client-side cart drawer (stored in your browser only)
- Checkout links back to the real product pages on store.trenchchimps.com
- The email form only shows a thanks message — it does not submit anywhere

## Local preview

The site is plain HTML, CSS, and JavaScript in `public/`. No build step.

```bash
python3 -m http.server 4173 --directory public
```

Then open http://localhost:4173

## Deploy

This repo is set up as a Render static site. The publish path is `public`. On Render, a successful deploy is served at the service’s `onrender.com` URL.
