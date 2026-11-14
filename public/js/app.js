/* Trench Chimps design demo.
   Catalog is public/data/catalog.json, synced from the Shopify store.
   Checkout is a Shopify cart permalink. This file never takes payment. */
(() => {
  const BRAND = {
    logo: "images/logo-trench-chimps-logo-transparent-6b8a19f2.webp",
    mark: "images/tc-mark-trench-chimps-tc-transparent-b8077817.webp",
    hero: "images/hero-trench-chimps-jungle-hero-06e7e167.webp",
  };

  const CATEGORIES = [
    { id: "hoodies", label: "Hoodies" },
    { id: "tees", label: "Tees" },
    { id: "womens", label: "Women’s" },
    { id: "kids", label: "Kids" },
    { id: "all", label: "All merchandise" },
  ];

  const ARTWORK = [
    {
      src: "images/artwork/chimp-1.webp",
      title: "Trench Chimps #1",
      caption: "Lime · Black T",
    },
    {
      src: "images/artwork/chimp-25.webp",
      title: "Trench Chimps #25",
      caption: "Honey Mustard · Pink TC Hoodie",
    },
    {
      src: "images/artwork/chimp-100.webp",
      title: "Trench Chimps #100",
      caption: "Chocolate · Roots",
    },
  ];

  const STORY = [
    {
      quote: "Welcome to the trenches.",
      detail: "A little wild. A lot of character.",
    },
    {
      quote: "Meet Trench Chimps — an art collection for those who move their own way.",
      detail: "",
    },
    {
      quote:
        "Trench Chimps is a collection of 3,333 digital collectibles on Robinhood Chain. Expressive faces, distinctive traits, and plenty of personality — each Chimp brings its own energy to the collection.",
      detail: "The art is the starting point. What you see in your Chimp, and the stories you give it, are yours.",
    },
    {
      quote: "Same jungle. Different energy.",
      detail:
        "Trench Chimps is an art collection. Collect for the artwork and the character you connect with. Community stories are welcome; they are not a promised project deliverable.",
    },
  ];

  const CART_KEY = "tc-demo-cart-v2";
  const RECENT_KEY = "tc-demo-recent-v1";
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const state = {
    catalog: null,
    route: null,
    cart: loadCart(),
    selection: {},
    quick: null,
    recent: loadRecent(),
  };
  let revealObserver = null;
  let stickyObserver = null;

  document.documentElement.classList.add("js");

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function money(amount) {
    const currency = state.catalog?.currency || "USD";
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount) || 0);
  }

  function priceLabel(product) {
    if (product.priceMin === product.priceMax) return money(product.priceMin);
    return `${money(product.priceMin)} – ${money(product.priceMax)}`;
  }

  function cdn(src, width) {
    if (!src) return "";
    if (!/^https?:/i.test(src)) return src;
    const url = new URL(src);
    url.searchParams.set("width", String(width));
    return url.toString();
  }

  function srcset(src) {
    if (!src || !/^https?:/i.test(src)) return "";
    return [480, 800, 1200].map((w) => `${cdn(src, w)} ${w}w`).join(", ");
  }

  function imgTag(src, alt, opts = {}) {
    const width = opts.width || 800;
    const set = srcset(src);
    const sizes = opts.sizes ? ` sizes="${escapeHtml(opts.sizes)}"` : "";
    const setAttr = set ? ` srcset="${escapeHtml(set)}"${sizes}` : "";
    const lazy = opts.eager ? ' fetchpriority="high"' : ' loading="lazy"';
    const cls = opts.className ? ` class="${escapeHtml(opts.className)}"` : "";
    return `<img${cls} src="${escapeHtml(cdn(src, width))}"${setAttr} alt="${escapeHtml(alt)}"${lazy} decoding="async">`;
  }

  function announce(message) {
    const live = $("#live");
    if (live) live.textContent = message;
  }

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((item) => item && Number.isFinite(Number(item.variantId)) && Number(item.qty) > 0)
        .map((item) => ({ variantId: Number(item.variantId), qty: Math.min(10, Math.round(Number(item.qty))) }));
    } catch {
      return [];
    }
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCount();
  }

  function loadRecent() {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(raw) ? raw.filter((h) => typeof h === "string") : [];
    } catch {
      return [];
    }
  }

  function remember(handle) {
    state.recent = [handle, ...state.recent.filter((h) => h !== handle)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(state.recent));
  }

  function products() {
    return state.catalog?.products || [];
  }

  function findProduct(handle) {
    return products().find((product) => product.handle === handle);
  }

  function productsIn(id) {
    if (!id || id === "all") return products();
    return products().filter((product) => product.categories.includes(id));
  }

  function variantById(id) {
    for (const product of products()) {
      const variant = product.variants.find((item) => Number(item.id) === Number(id));
      if (variant) return { product, variant };
    }
    return null;
  }

  function ensureSel(product) {
    let sel = state.selection[product.handle];
    if (!sel) {
      sel = { color: product.colors[0] || "", size: "", qty: 1, image: "" };
      state.selection[product.handle] = sel;
    }
    if (sel.color && !product.colors.includes(sel.color)) sel.color = product.colors[0] || "";
    if (sel.qty < 1) sel.qty = 1;
    if (sel.qty > 10) sel.qty = 10;
    return sel;
  }

  function findVariant(product, color, size) {
    return product.variants.find((variant) => variant.color === color && variant.size === size);
  }

  function sizesFor(product, color) {
    const sizes = [];
    product.variants.forEach((variant) => {
      if (variant.color === color && variant.size && !sizes.includes(variant.size)) sizes.push(variant.size);
    });
    return sizes;
  }

  function imagesFor(product, color) {
    const matched = product.images.filter((image) => image.colors.includes(color));
    if (matched.length) return matched;
    const src = product.variants.find((variant) => variant.color === color && variant.image)?.image;
    if (src) return [{ src, alt: "", view: "photo", width: null, height: null, colors: [color] }];
    return product.images.slice(0, 1);
  }

  function cardImages(product, color) {
    const imgs = imagesFor(product, color);
    const lifestyle = imgs.find((image) => image.view === "lifestyle");
    const front = imgs.find((image) => image.view === "front" || image.view === "photo");
    const back = imgs.find((image) => image.view === "back");
    const primary = lifestyle || front || imgs[0];
    let alt = null;
    if (primary && back && back.src !== primary.src) alt = back;
    else if (primary && front && front.src !== primary.src) alt = front;
    else if (primary) alt = imgs.find((image) => image.src !== primary.src) || null;
    return { primary, alt, all: imgs };
  }

  function altText(product, image, color) {
    if (image?.alt) return image.alt;
    const bits = [product.title];
    if (color) bits.push(color);
    if (image?.view && image.view !== "photo") bits.push(image.view);
    return bits.join(", ");
  }

  function badges(product) {
    const items = [];
    if (!product.available) items.push(["sold", "Sold out"]);
    else if (product.isNew) items.push(["new", "New"]);
    if (product.limited) items.push(["limited", "Limited drop"]);
    return items;
  }

  function stickyLabel(product, sel) {
    if (!sel.size) return "Select size";
    const variant = findVariant(product, sel.color, sel.size);
    return variant?.available ? "Add to bag" : "Sold out";
  }

  function availabilityCopy(product, sel) {
    if (sel.size) {
      const variant = findVariant(product, sel.color, sel.size);
      if (!variant) return { text: "That combination isn’t in the catalog.", out: true };
      return variant.available
        ? { text: "In stock", out: false }
        : { text: "Sold out", out: true };
    }
    const ready = sizesFor(product, sel.color).filter((size) => findVariant(product, sel.color, size)?.available).length;
    if (!ready) return { text: "Sold out in this color", out: true };
    return { text: `In stock in ${ready} ${ready === 1 ? "size" : "sizes"}`, out: false };
  }

  function detailLine(text) {
    return String(text).replace(/,\s*$/, "");
  }

  function hasCare(product) {
    return product.details.some((line) => /wash|dry|iron|bleach|tumble/i.test(line));
  }

  function sizeNote(product) {
    if (!product.sizeChart?.rows?.length) return "";
    const chartSizes = product.sizeChart.rows.map((row) => row[0]);
    const youth = product.sizes.length && product.sizes.every((size) => /^Y/i.test(size));
    const plain = chartSizes.every((size) => !/^Y/i.test(size));
    if (youth && plain) {
      return `Product sizes are labeled ${product.sizes.join(", ")}. The size chart on the product uses ${chartSizes.join(", ")}.`;
    }
    return "";
  }

  function categoryLabel(id) {
    if (id === "rooted-different") return "Rooted Different";
    return CATEGORIES.find((category) => category.id === id)?.label || "Collection";
  }

  function parseHash() {
    const raw = (location.hash || "#/").replace(/^#/, "");
    const queryAt = raw.indexOf("?");
    const pathPart = queryAt >= 0 ? raw.slice(0, queryAt) : raw;
    const queryPart = queryAt >= 0 ? raw.slice(queryAt + 1) : "";
    const parts = pathPart.split("/").filter(Boolean).map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
    const params = new URLSearchParams(queryPart || "");
    const legacy = {
      men: "#/shop",
      women: "#/collections/womens",
      youth: "#/collections/kids",
      hoodies: "#/collections/hoodies",
      about: "#/story",
    };
    if (parts.length === 1 && legacy[parts[0].toLowerCase()]) {
      history.replaceState(null, "", legacy[parts[0].toLowerCase()]);
      return parseHash();
    }
    const shop = {
      q: params.get("q") || "",
      color: params.get("color") || "",
      size: params.get("size") || "",
      availability: params.get("avail") || "all",
      sort: params.get("sort") || "newest",
      category: (params.get("cat") || "all").toLowerCase(),
    };
    const head = (parts[0] || "").toLowerCase();
    const path = `/${parts.join("/")}`;
    if (head === "shop") return { name: "shop", path, handle: null, collection: shop.category, shop };
    if (head === "collections" && parts[1]) {
      return { name: "collection", path, handle: null, collection: parts[1].toLowerCase(), shop };
    }
    if (head === "collections") return { name: "collections", path, handle: null, collection: null, shop };
    if (head === "product" && parts[1]) {
      return { name: "product", path, handle: parts[1].toLowerCase(), collection: null, shop };
    }
    if (head === "story") return { name: "story", path, handle: null, collection: null, shop };
    if (head === "community") return { name: "community", path, handle: null, collection: null, shop };
    return { name: "home", path: "/", handle: null, collection: null, shop };
  }

  function listQuery(shop, { includeCategory = false } = {}) {
    const params = new URLSearchParams();
    if (shop.q) params.set("q", shop.q);
    if (shop.color) params.set("color", shop.color);
    if (shop.size) params.set("size", shop.size);
    if (shop.availability && shop.availability !== "all") params.set("avail", shop.availability);
    if (shop.sort && shop.sort !== "newest") params.set("sort", shop.sort);
    if (includeCategory && shop.category && shop.category !== "all") params.set("cat", shop.category);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  function hrefForCategory(id, shop) {
    const qs = listQuery(shop);
    if (!id || id === "all") return `#/shop${qs}`;
    return `#/collections/${id}${qs}`;
  }

  function setHash(next) {
    if ((location.hash || "#/") === next) onRoute();
    else location.hash = next;
  }

  function sorted(list, sort) {
    const copy = [...list];
    if (sort === "price-asc") copy.sort((a, b) => a.priceMin - b.priceMin || a.title.localeCompare(b.title));
    else if (sort === "price-desc") copy.sort((a, b) => b.priceMax - a.priceMax || a.title.localeCompare(b.title));
    else if (sort === "name") copy.sort((a, b) => a.title.localeCompare(b.title));
    else copy.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
    return copy;
  }

  function matchesFilters(product, shop, category) {
    if (category && category !== "all" && !product.categories.includes(category)) return false;
    if (shop.q) {
      const blob = [product.title, product.handle, ...product.description, ...product.style, ...product.colors, ...product.details]
        .join(" ")
        .toLowerCase();
      if (!blob.includes(shop.q.toLowerCase())) return false;
    }
    let variants = product.variants;
    if (shop.color) variants = variants.filter((variant) => variant.color === shop.color);
    if (shop.size) variants = variants.filter((variant) => variant.size === shop.size);
    if ((shop.color || shop.size) && !variants.length) return false;
    if (shop.availability === "in" && !variants.some((variant) => variant.available)) return false;
    if (shop.availability === "out" && variants.some((variant) => variant.available)) return false;
    return true;
  }

  function visibleProducts(category, shop) {
    return sorted(
      products().filter((product) => matchesFilters(product, shop, category)),
      shop.sort
    );
  }

  function optionPool(category, shop, key) {
    const values = [];
    products()
      .filter((product) => matchesFilters(product, { ...shop, [key]: "" }, category))
      .forEach((product) => {
        product.variants.forEach((variant) => {
          const value = variant[key];
          if (value && !values.includes(value)) values.push(value);
        });
      });
    return values;
  }

  function swatchStyle(product, color) {
    const image = imagesFor(product, color).find((item) => item.view !== "lifestyle") || imagesFor(product, color)[0];
    const src = image ? cdn(image.src, 96) : "";
    return src ? `background-image:url('${src.replaceAll("'", "%27")}')` : "";
  }

  function badgeHtml(product) {
    const items = badges(product)
      .map(([kind, label]) => `<span class="badge ${kind === "new" ? "" : kind}">${escapeHtml(label)}</span>`)
      .join("");
    return items ? `<div class="badges">${items}</div>` : "";
  }

  function swatchHtml(product, sel) {
    if (!product.colors.length) return "";
    return `<div class="swatches" role="group" aria-label="Color">${product.colors
      .map((color) => {
        const pressed = color === sel.color;
        return `<button class="swatch" type="button" data-swatch="${escapeHtml(product.handle)}" data-color="${escapeHtml(
          color
        )}" aria-pressed="${pressed}" aria-label="${escapeHtml(color)}" title="${escapeHtml(color)}" style="${swatchStyle(
          product,
          color
        )}"></button>`;
      })
      .join("")}</div>`;
  }

  function cardHtml(product, mode) {
    const sel = ensureSel(product);
    const images = cardImages(product, sel.color);
    const primary = images.primary;
    const alt = images.alt;
    const sizes = sizesFor(product, sel.color);
    const variant = sel.size ? findVariant(product, sel.color, sel.size) : null;
    const anyAvailable = sizes.some((size) => findVariant(product, sel.color, size)?.available);
    const price = variant ? money(variant.price) : priceLabel(product);
    const compare =
      variant && variant.compareAt && variant.compareAt > variant.price ? `<s>${money(variant.compareAt)}</s>` : "";
    const media = primary
      ? `<a class="media" href="#/product/${encodeURIComponent(product.handle)}">
          ${badgeHtml(product)}
          ${imgTag(primary.src, altText(product, primary, sel.color), {
            width: 800,
            className: "primary",
            sizes: "(min-width: 1040px) 22vw, 50vw",
          })}
          ${
            alt
              ? imgTag(alt.src, "", {
                  width: 800,
                  className: "alt",
                  sizes: "(min-width: 1040px) 22vw, 50vw",
                })
              : ""
          }
        </a>`
      : "";
    const shopControls =
      mode === "shop"
        ? `<label class="sr-only" for="card-size-${escapeHtml(product.handle)}">Size for ${escapeHtml(product.title)}</label>
           <div class="card-actions">
             <select class="select" id="card-size-${escapeHtml(product.handle)}" data-size-for="${escapeHtml(product.handle)}">
               <option value="">Size</option>
               ${sizes
                 .map((size) => {
                   const item = findVariant(product, sel.color, size);
                   const sold = item && !item.available ? " (sold out)" : "";
                   return `<option value="${escapeHtml(size)}" ${size === sel.size ? "selected" : ""} ${
                     item && !item.available ? "disabled" : ""
                   }>${escapeHtml(size)}${sold}</option>`;
                 })
                 .join("")}
             </select>
             <button class="btn btn-primary btn-small" type="button" data-add="${escapeHtml(product.handle)}" ${
               !anyAvailable || (variant && !variant.available) ? 'aria-disabled="true"' : ""
             }>${!anyAvailable || (variant && !variant.available) ? "Sold out" : "Add"}</button>
           </div>
           <button class="btn btn-ghost btn-small" type="button" data-quick="${escapeHtml(product.handle)}">Quick view</button>`
        : `<a class="btn btn-ghost btn-small" href="#/product/${encodeURIComponent(product.handle)}">View</a>`;
    return `<article class="card">
      ${media}
      <div class="card-body">
        <h3><a href="#/product/${encodeURIComponent(product.handle)}">${escapeHtml(product.title)}</a></h3>
        <p class="price">${compare} ${price}</p>
        ${swatchHtml(product, sel)}
        ${shopControls}
      </div>
    </article>`;
  }

  function pillsHtml(active, shop) {
    const items = [{ id: "all", label: "All" }, ...CATEGORIES.filter((category) => category.id !== "all"), { id: "rooted-different", label: "Rooted Different" }];
    return `<div class="pills">${items
      .map((item) => {
        const current = (active || "all") === item.id;
        return `<a class="pill" href="${hrefForCategory(item.id, shop)}" ${current ? 'aria-current="page"' : ""}>${escapeHtml(
          item.label
        )}</a>`;
      })
      .join("")}</div>`;
  }

  function filtersHtml(category, shop) {
    const colors = optionPool(category, shop, "color");
    const sizes = optionPool(category, shop, "size");
    const select = (id, label, value, options) => `<label class="field" for="${id}">${label}
      <select id="${id}" data-filter="${id}">
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
          .join("")}
      </select></label>`;
    return `<div class="filters">
      ${select(
        "filter-color",
        "Color",
        colors.includes(shop.color) ? shop.color : "",
        [{ value: "", label: "All colors" }, ...colors.map((color) => ({ value: color, label: color }))]
      )}
      ${select(
        "filter-size",
        "Size",
        sizes.includes(shop.size) ? shop.size : "",
        [{ value: "", label: "All sizes" }, ...sizes.map((size) => ({ value: size, label: size }))]
      )}
      ${select("filter-avail", "Availability", shop.availability, [
        { value: "all", label: "All" },
        { value: "in", label: "In stock" },
        { value: "out", label: "Sold out" },
      ])}
      ${select("filter-sort", "Sort", shop.sort, [
        { value: "newest", label: "Newest" },
        { value: "price-asc", label: "Price, low to high" },
        { value: "price-desc", label: "Price, high to low" },
        { value: "name", label: "Name" },
      ])}
    </div>`;
  }

  function listingHtml(category, shop, { intro } = {}) {
    const items = visibleProducts(category, shop);
    const noun = items.length === 1 ? "style" : "styles";
    return `${intro || ""}
      <div class="toolbar">
        ${pillsHtml(category, shop)}
        ${filtersHtml(category, shop)}
        <p class="count">${items.length} ${noun}</p>
      </div>
      ${
        items.length
          ? `<div class="grid">${items.map((product) => cardHtml(product, "shop")).join("")}</div>`
          : `<p class="empty">Nothing in the catalog matches these filters.</p>`
      }`;
  }

  function categoryTiles() {
    return `<div class="cat-grid">${CATEGORIES.map((category) => {
      const list = productsIn(category.id);
      const sample = list[0];
      const image = sample ? cardImages(sample, sample.colors[0]).primary : null;
      const count = `${list.length} ${list.length === 1 ? "style" : "styles"}`;
      if (!list.length) {
        return `<div class="cat-tile is-upcoming"><span><strong>${escapeHtml(category.label)}</strong><em>Upcoming</em></span></div>`;
      }
      return `<a class="cat-tile" href="${category.id === "all" ? "#/shop" : `#/collections/${category.id}`}">
        ${image ? imgTag(image.src, "", { width: 700, sizes: "(min-width: 1040px) 18vw, 50vw" }) : ""}
        <span><strong>${escapeHtml(category.label)}</strong><em>${count}</em></span>
      </a>`;
    }).join("")}</div>`;
  }

  function rootedProducts() {
    return productsIn("rooted-different");
  }

  function rootedBand(level) {
    const list = rootedProducts();
    const product = list[0];
    const image = product ? cardImages(product, product.colors[0]).primary : null;
    const names = list.map((item) => item.title);
    const fact = names.length ? `In the catalog now: ${names.join(", ")}.` : "Nothing named Rooted Different is in the catalog right now.";
    const href = level === "h1" ? "#collection-products" : "#/collections/rooted-different";
    return `<section class="editorial">
      ${image ? imgTag(image.src, altText(product, image, product.colors[0]), { className: "editorial-bg", width: 1600, eager: level === "h1", sizes: "100vw" }) : ""}
      <div class="editorial-copy">
        <div class="inner">
          <p class="kicker">The collection</p>
          <${level}>Rooted Different</${level}>
          <p class="support">Different by nature. Trench by choice.</p>
          <p class="lede">${escapeHtml(fact)}</p>
          ${list.length ? `<div class="hero-actions"><a class="btn btn-primary" href="${href}">Shop collection</a></div>` : ""}
        </div>
      </div>
    </section>`;
  }

  function shotRow(product) {
    return `<div class="shot-row">${product.images
      .map((image) => {
        const view = image.view === "photo" ? "Product" : image.view.charAt(0).toUpperCase() + image.view.slice(1);
        const color = image.colors.length === 1 ? image.colors[0] : "";
        const label = color ? `${view} · ${color}` : view;
        return `<figure class="shot">${imgTag(image.src, altText(product, image, color), {
          width: 900,
          sizes: "(min-width: 720px) 22vw, 50vw",
        })}<figcaption>${escapeHtml(label)}</figcaption></figure>`;
      })
      .join("")}</div>`;
  }

  function policyBlock(title, paragraphs, href, label) {
    return `<details>
      <summary>${escapeHtml(title)}</summary>
      <div class="policy">${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</div>
      <p style="margin-top:.7rem"><a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(label)}</a></p>
    </details>`;
  }

  function optionsBlock(product, { idPrefix }) {
    const sel = ensureSel(product);
    const sizes = sizesFor(product, sel.color);
    const avail = availabilityCopy(product, sel);
    const variant = sel.size ? findVariant(product, sel.color, sel.size) : null;
    const price = variant ? money(variant.price) : priceLabel(product);
    const compare =
      variant && variant.compareAt && variant.compareAt > variant.price ? `<s>${money(variant.compareAt)}</s> ` : "";
    const canAdd = Boolean(variant && variant.available);
    const noneReady = !sizes.some((size) => findVariant(product, sel.color, size)?.available);
    let button = "Select a size";
    if (noneReady || (sel.size && variant && !variant.available)) button = "Sold out";
    else if (canAdd) button = "Add to bag";
    return `<p class="price" style="font-size:1.35rem">${compare}${price}</p>
      <p class="avail ${avail.out ? "is-out" : ""}">${escapeHtml(avail.text)}</p>
      <div>
        <p class="option-label" id="${idPrefix}-color-label">Color${sel.color ? `: ${escapeHtml(sel.color)}` : ""}</p>
        ${swatchHtml(product, sel)}
      </div>
      <div>
        <p class="option-label" id="${idPrefix}-size-label">Size</p>
        <div class="sizes" role="radiogroup" aria-labelledby="${idPrefix}-size-label">
          ${sizes
            .map((size) => {
              const item = findVariant(product, sel.color, size);
              const on = size === sel.size;
              const enabled = item?.available;
              return `<button class="size-pill" type="button" role="radio" aria-checked="${on}" data-size="${escapeHtml(
                size
              )}" data-size-handle="${escapeHtml(product.handle)}" ${enabled ? "" : "disabled"}>${escapeHtml(size)}</button>`;
            })
            .join("")}
        </div>
      </div>
      <div class="qty-row">
        <button type="button" data-qty-delta="-1" data-qty-handle="${escapeHtml(product.handle)}" aria-label="Decrease quantity">−</button>
        <label class="sr-only" for="${idPrefix}-qty">Quantity</label>
        <input id="${idPrefix}-qty" inputmode="numeric" value="${sel.qty}" data-qty-for="${escapeHtml(product.handle)}">
        <button type="button" data-qty-delta="1" data-qty-handle="${escapeHtml(product.handle)}" aria-label="Increase quantity">+</button>
      </div>
      <button class="btn btn-primary btn-block" type="button" id="${idPrefix}-add" data-add="${escapeHtml(product.handle)}" ${
        button === "Sold out" ? 'aria-disabled="true"' : ""
      }>${button}</button>`;
  }

  function detailsBlock(product) {
    const paragraphs = [...product.description, ...product.style];
    const chart = product.sizeChart;
    const note = sizeNote(product);
    const chartHtml = chart
      ? `${note ? `<p class="note">${escapeHtml(note)}</p>` : ""}<div class="table-wrap"><table><thead><tr>${chart.headers
          .map((cell) => `<th>${escapeHtml(cell)}</th>`)
          .join("")}</tr></thead><tbody>${chart.rows
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`
      : `<p class="note">No size chart is published on this product.</p>`;
    const care = hasCare(product) ? "" : `<p class="note">Care instructions are not included in the product description.</p>`;
    return `<div class="details">
      <details open>
        <summary>Description</summary>
        ${paragraphs.length ? paragraphs.map((paragraph) => `<p style="margin-top:.6rem">${escapeHtml(paragraph)}</p>`).join("") : `<p class="note" style="margin-top:.6rem">No additional description is published on this product.</p>`}
        <p style="margin-top:.7rem"><a href="${escapeHtml(product.url)}" target="_blank" rel="noopener">View on the official store</a></p>
      </details>
      <details>
        <summary>Materials and construction</summary>
        ${
          product.details.length
            ? `<ul>${product.details.map((line) => `<li>${escapeHtml(detailLine(line))}</li>`).join("")}</ul>${care}`
            : `<p class="note" style="margin-top:.6rem">Materials are not listed on this product.</p>`
        }
      </details>
      <details>
        <summary>Size guide</summary>
        ${chartHtml}
      </details>
      ${policyBlock("Shipping", state.catalog.policies.shipping, state.catalog.links.shipping, "Shipping policy")}
      ${policyBlock("Returns", state.catalog.policies.returns, state.catalog.links.refund, "Refund policy")}
    </div>`;
  }

  function galleryHtml(product, sel) {
    const images = imagesFor(product, sel.color);
    const active = images.find((image) => image.src === sel.image) || images[0];
    if (!active) return "";
    return `<div class="gallery">
      <div class="gallery-main">${imgTag(active.src, altText(product, active, sel.color), {
        width: 1400,
        eager: true,
        sizes: "(min-width: 720px) 50vw, 100vw",
      })}</div>
      <div class="thumbs">${images
        .map((image) => {
          const current = image.src === active.src;
          return `<button type="button" data-thumb="${escapeHtml(product.handle)}" data-src="${escapeHtml(image.src)}" aria-current="${current}" aria-label="${escapeHtml(
            altText(product, image, sel.color)
          )}">${imgTag(image.src, "", { width: 160 })}</button>`;
        })
        .join("")}</div>
    </div>`;
  }

  function productPage(product) {
    const sel = ensureSel(product);
    const related = relatedProducts(product);
    const recent = state.recent.map(findProduct).filter((item) => item && item.handle !== product.handle).slice(0, 4);
    const active = imagesFor(product, sel.color).find((image) => image.src === sel.image) || imagesFor(product, sel.color)[0];
    return `<div class="wrap section">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a><span aria-hidden="true">/</span><a href="#/shop">Shop</a><span aria-hidden="true">/</span><span>${escapeHtml(
        product.title
      )}</span></nav>
      <div class="pdp">
        ${galleryHtml(product, sel)}
        <div class="pdp-info">
          <p class="kicker">${product.categories.includes("rooted-different") ? "Rooted Different" : "The drop"}</p>
          <h1>${escapeHtml(product.title)}</h1>
          <div style="display:grid;gap:.8rem;margin-top:1rem">
            ${optionsBlock(product, { idPrefix: "pdp" })}
            ${detailsBlock(product)}
          </div>
        </div>
      </div>
      ${
        related.length
          ? `<div class="section" style="padding-bottom:0"><div class="section-head"><h2 class="section-title">Related</h2></div><div class="grid">${related
              .map((item) => cardHtml(item, "compact"))
              .join("")}</div></div>`
          : ""
      }
      ${
        recent.length
          ? `<div class="section"><div class="section-head"><h2 class="section-title">Recently viewed</h2></div><div class="grid">${recent
              .map((item) => cardHtml(item, "compact"))
              .join("")}</div></div>`
          : ""
      }
    </div>
    <div class="sticky-atc" id="sticky-atc" hidden>
      ${active ? imgTag(active.src, "", { width: 120 }) : ""}
      <div><strong>${escapeHtml(product.title)}</strong><span class="price">${sel.size && findVariant(product, sel.color, sel.size) ? money(findVariant(product, sel.color, sel.size).price) : priceLabel(product)}</span></div>
      <button class="btn btn-primary" type="button" data-add="${escapeHtml(product.handle)}">${stickyLabel(product, sel)}</button>
    </div>`;
  }

  function relatedProducts(product) {
    const cats = new Set(product.categories.filter((category) => category !== "rooted-different"));
    const ranked = products()
      .filter((item) => item.handle !== product.handle)
      .map((item) => ({ item, score: item.categories.filter((category) => cats.has(category)).length }))
      .sort((a, b) => b.score - a.score || String(b.item.publishedAt).localeCompare(String(a.item.publishedAt)));
    const list = ranked.filter((entry) => entry.score > 0).map((entry) => entry.item);
    ranked.forEach((entry) => {
      if (list.length < 4 && !list.includes(entry.item)) list.push(entry.item);
    });
    return list.slice(0, 4);
  }

  function quickHtml(product) {
    const sel = ensureSel(product);
    return `<div class="quick-grid">
      ${galleryHtml(product, sel)}
      <div>
        <p class="kicker">Quick view</p>
        <h2 id="quick-title">${escapeHtml(product.title)}</h2>
        <div style="display:grid;gap:.8rem;margin-top:1rem">
          ${optionsBlock(product, { idPrefix: "quick" })}
          <a class="btn btn-ghost" href="#/product/${encodeURIComponent(product.handle)}">Full details</a>
        </div>
      </div>
    </div>`;
  }

  function homePage() {
    const newest = sorted(products(), "newest");
    const latest = newest.slice(0, 4);
    const featured = newest.slice(latest.length, latest.length + 4);
    return `${heroHtml()}
      <section class="section wrap reveal">
        <div class="section-head">
          <div><p class="kicker">Latest drop</p><h2 class="section-title">Just landed</h2></div>
          <a class="btn btn-ghost" href="#/shop">Shop all</a>
        </div>
        <div class="grid">${latest.map((product) => cardHtml(product, "compact")).join("")}</div>
      </section>
      <section class="section wrap reveal" style="padding-top:0">
        <div class="section-head"><div><p class="kicker">Shop by category</p><h2 class="section-title">Find your fit</h2></div></div>
        <p class="lede">Grouped from product names in the live catalog. The Shopify store doesn’t publish separate Hoodies, Tees, Women’s, or Kids collections.</p>
        <div style="height:1rem"></div>
        ${categoryTiles()}
      </section>
      <div class="reveal">${rootedBand("h2")}</div>
      ${
        featured.length
          ? `<section class="section wrap reveal">
              <div class="section-head"><div><p class="kicker">Featured</p><h2 class="section-title">Featured products</h2></div></div>
              <p class="lede">Not a sales ranking. The store doesn’t publish popularity data, so these are the other styles in the current catalog.</p>
              <div class="feature-grid" style="margin-top:1rem">${featured
                .map((product) => {
                  const image = cardImages(product, product.colors[0]).primary;
                  const blurb = product.description[0] || product.style[0] || "";
                  return `<a class="feature" href="#/product/${encodeURIComponent(product.handle)}">
                    ${image ? imgTag(image.src, altText(product, image, product.colors[0]), { width: 800, sizes: "(min-width: 720px) 30vw, 100vw" }) : ""}
                    <div><h3>${escapeHtml(product.title)}</h3><p class="price">${priceLabel(product)}</p><p class="note">${escapeHtml(
                      blurb
                    )}</p></div>
                  </a>`;
                })
                .join("")}</div>
            </section>`
          : ""
      }
      ${communityTeaser()}
      ${storyTeaser()}
      ${updatesBlock()}`;
  }

  function heroHtml() {
    const fresh = products().some((product) => product.isNew);
    return `<section class="hero">
      ${imgTag(BRAND.hero, "Jungle foliage artwork from the Trench Chimps store", {
        className: "hero-bg",
        width: 1800,
        eager: true,
        sizes: "100vw",
      })}
      <div class="hero-content">
        <img class="hero-mark" src="${BRAND.mark}" alt="">
        ${fresh ? `<p class="kicker">New drop</p>` : ""}
        <h1>Born in the trenches</h1>
        <p class="hero-sub">Rooted different. Built different.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#/shop">Shop the drop</a>
          <a class="btn btn-ghost" href="#/collections/rooted-different">Explore the collection</a>
        </div>
      </div>
    </section>`;
  }

  function communityTeaser() {
    return `<section class="section wrap reveal">
      <div class="split">
        <div>
          <p class="kicker">Community</p>
          <h2 class="section-title">Spotted in the trenches</h2>
          <p class="lede">No customer photos are published here. This demo can’t accept uploads or moderate them.</p>
          <div class="link-row">
            <a class="btn btn-primary" href="#/community">The gallery</a>
            <a class="btn btn-ghost" href="https://x.com/trenchchimps" target="_blank" rel="noopener">@trenchchimps</a>
          </div>
        </div>
        <div class="art-grid">${artworkHtml()}</div>
      </div>
    </section>`;
  }

  function artworkHtml() {
    return ARTWORK.map(
      (art) => `<figure class="art-card">
        <img src="${art.src}" alt="${escapeHtml(art.title)}, official collection artwork" width="600" height="600">
        <figcaption><strong>${escapeHtml(art.title)}</strong><span>${escapeHtml(art.caption)}</span></figcaption>
      </figure>`
    ).join("");
  }

  function storyTeaser() {
    return `<section class="section wrap reveal" style="padding-top:0">
      <p class="kicker">The trench story</p>
      <h2 class="section-title">Same jungle. Different energy.</h2>
      <div class="quotes" style="margin-top:1rem">
        <blockquote><p>${escapeHtml(STORY[0].quote)}</p><p>${escapeHtml(STORY[0].detail)}</p><footer>trenchchimps.com</footer></blockquote>
        <blockquote><p>${escapeHtml(STORY[2].quote)}</p><footer>trenchchimps.com</footer></blockquote>
      </div>
      <div class="link-row">
        <a class="btn btn-ghost" href="#/story">Read the story</a>
        <a class="btn btn-ghost" href="https://trenchchimps.com/" target="_blank" rel="noopener">trenchchimps.com</a>
      </div>
    </section>`;
  }

  function updatesBlock() {
    return `<section class="updates">
      <div class="wrap section">
        <p class="kicker">Updates</p>
        <h2 class="section-title">Stay in the trenches</h2>
        <p class="lede">Fresh merch. New drops. Get the word first.</p>
        <p class="note" style="margin-top:.7rem">That line is from the official store footer. Neither this demo nor that footer has a working email signup, so this page does not collect addresses.</p>
        <div class="link-row">
          <a class="btn btn-gold" href="https://x.com/trenchchimps" target="_blank" rel="noopener">Follow on X</a>
        </div>
      </div>
    </section>`;
  }

  function collectionsPage() {
    return `<div class="wrap section">
      <p class="kicker">Collections</p>
      <h1 class="section-title">Shop the catalog</h1>
      <p class="lede">These groups are read from product titles and descriptions. Shopify itself only publishes a home collection and an example collection, neither of which lists the current merch.</p>
      <div style="height:1.2rem"></div>
      ${categoryTiles()}
      <div style="height:1.5rem"></div>
      <a class="feature" href="#/collections/rooted-different">
        <img src="${BRAND.mark}" alt="">
        <div><p class="kicker">Editorial</p><h3>Rooted Different</h3><p class="note">Different by nature. Trench by choice.</p></div>
      </a>
    </div>`;
  }

  function collectionPage(id, shop) {
    if (id === "rooted-different") {
      const list = rootedProducts();
      return `${rootedBand("h1")}
        <div class="wrap section" id="collection-products">
          ${
            list.length
              ? list.map((product) => `<h2 class="section-title" style="font-size:2rem;margin-bottom:.8rem">${escapeHtml(product.title)}</h2>${shotRow(product)}`).join("")
              : `<p class="empty">No Rooted Different products are in the catalog.</p>`
          }
          <div style="height:1.4rem"></div>
          ${listingHtml(id, { ...shop, q: shop.q }, { intro: "" })}
        </div>`;
    }
    const known = CATEGORIES.some((category) => category.id === id);
    const label = categoryLabel(id);
    const note =
      id === "kids"
        ? "Kids in this shop means products whose names say Youth."
        : id === "womens"
          ? "Women’s means products whose names say women."
          : "Included because the product name or description matches this group.";
    return `<div class="wrap section">
      <nav class="crumbs"><a href="#/">Home</a><span>/</span><a href="#/collections">Collections</a><span>/</span><span>${escapeHtml(
        label
      )}</span></nav>
      <p class="kicker">Collection</p>
      <h1 class="section-title">${escapeHtml(label)}</h1>
      <p class="lede">${known ? escapeHtml(note) : "This name isn’t a group in the catalog."}</p>
      <div style="height:1rem"></div>
      ${listingHtml(id, shop)}
    </div>`;
  }

  function shopPage(shop) {
    const category = shop.category && shop.category !== "all" ? shop.category : "all";
    return `<div class="wrap section">
      <p class="kicker">Shop</p>
      <h1 class="section-title">${shop.q ? `Search` : "All merchandise"}</h1>
      <p class="lede">${
        shop.q
          ? `Results for “${escapeHtml(shop.q)}”. Prices and stock come from the live catalog.`
          : "Prices, colors, sizes, and stock come from the public Shopify catalog."
      }</p>
      <div style="height:1rem"></div>
      ${listingHtml(category, shop)}
    </div>`;
  }

  function storyPage() {
    return `<div class="wrap section">
      <p class="kicker">Our story</p>
      <h1 class="section-title">The trench story</h1>
      <p class="lede">The lines below are from trenchchimps.com. This demo doesn’t add a merch origin story the official sites don’t publish.</p>
      <div class="quotes" style="margin-top:1.4rem">${STORY.map(
        (block) => `<blockquote><p>${escapeHtml(block.quote)}</p>${
          block.detail ? `<p style="margin-top:.45rem">${escapeHtml(block.detail)}</p>` : ""
        }<footer>trenchchimps.com</footer></blockquote>`
      ).join("")}</div>
      <p class="lede" style="margin-top:1.2rem">Merch in this demo is the Treehouse Shop catalog on store.trenchchimps.com. The collection site and the shop are separate.</p>
      <div class="link-row">
        <a class="btn btn-primary" href="https://trenchchimps.com/" target="_blank" rel="noopener">trenchchimps.com</a>
        <a class="btn btn-ghost" href="https://opensea.io/collection/trench-chimps" target="_blank" rel="noopener">OpenSea</a>
        <a class="btn btn-ghost" href="#/shop">Shop the drop</a>
      </div>
    </div>`;
  }

  function communityPage() {
    return `<div class="wrap section">
      <p class="kicker">Community</p>
      <h1 class="section-title">Spotted in the trenches</h1>
      <p class="lede">A place for real photos of people in the merch. There are no approved submissions to show.</p>
      <div class="empty-panel" style="margin-top:1.2rem">
        <strong>Coming soon — no community photos yet.</strong>
        <p class="note">This demo has no upload form and no moderation queue. Don’t send photos to this page.</p>
        <div class="link-row">
          <a class="btn btn-primary" href="https://x.com/trenchchimps" target="_blank" rel="noopener">Share on X @trenchchimps</a>
          <a class="btn btn-ghost" href="${escapeHtml(state.catalog.links.contact)}" target="_blank" rel="noopener">Official store contact form</a>
        </div>
        <p class="note">Posting on X or using the store contact form is a suggestion, not a promise that a photo will be featured. No public email address is listed on the store or trenchchimps.com.</p>
      </div>
      <div style="height:2rem"></div>
      <h2 class="section-title" style="font-size:2.2rem">Official artwork</h2>
      <p class="lede">Production artwork from trenchchimps.com. These are collection characters, not customers.</p>
      <div class="art-grid" style="margin-top:1rem">${artworkHtml()}</div>
      <div class="split" style="margin-top:2rem">
        <div class="empty-panel">
          <h2 style="font-family:var(--body);font-size:1rem;letter-spacing:.08em">Artist spotlights</h2>
          <p class="note">None are published on trenchchimps.com or the store.</p>
        </div>
        <div class="empty-panel">
          <h2 style="font-family:var(--body);font-size:1rem;letter-spacing:.08em">Collaborations</h2>
          <p class="note">No upcoming collaborations are listed on the official sites.</p>
        </div>
      </div>
    </div>`;
  }

  function missingProduct() {
    return `<div class="wrap error-panel"><img src="${BRAND.mark}" alt=""><h1>Not in the catalog</h1><p class="note">That product isn’t in the synced Shopify list.</p><a class="btn btn-primary" href="#/shop">Return to shop</a></div>`;
  }

  function renderMain() {
    const route = state.route;
    const main = $("#main");
    const focusId = document.activeElement?.id;
    let html = "";
    if (route.name === "home") html = homePage();
    else if (route.name === "shop") html = shopPage(route.shop);
    else if (route.name === "collections") html = collectionsPage();
    else if (route.name === "collection") html = collectionPage(route.collection, route.shop);
    else if (route.name === "product") {
      const product = findProduct(route.handle);
      html = product ? productPage(product) : missingProduct();
    } else if (route.name === "story") html = storyPage();
    else if (route.name === "community") html = communityPage();
    main.innerHTML = html;
    if (focusId) {
      const next = document.getElementById(focusId);
      if (next) next.focus();
    }
    mountReveals();
    mountSticky();
    if (state.quick) renderQuick();
  }

  function setMeta() {
    const route = state.route;
    let title = "Trench Chimps — Design Demo";
    let description = "Design demo of the Trench Chimps store. Prices and variants come from the public Shopify catalog. Checkout opens the official store.";
    let image = new URL(BRAND.hero, location.href).href;
    let ld = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Trench Chimps Design Demo",
      url: location.href,
    };
    if (route.name === "shop") {
      title = "Shop — Trench Chimps Design Demo";
      ld = itemListLd(visibleProducts(route.shop.category === "all" ? "all" : route.shop.category, route.shop));
    } else if (route.name === "collection") {
      title = `${categoryLabel(route.collection)} — Trench Chimps Design Demo`;
    } else if (route.name === "story") title = "Our Story — Trench Chimps Design Demo";
    else if (route.name === "community") title = "Spotted in the Trenches — Trench Chimps Design Demo";
    else if (route.name === "collections") title = "Collections — Trench Chimps Design Demo";
    else if (route.name === "product") {
      const product = findProduct(route.handle);
      if (product) {
        title = `${product.title} — Trench Chimps Design Demo`;
        description = product.description[0] || product.style[0] || description;
        const shot = cardImages(product, product.colors[0]).primary;
        if (shot) image = cdn(shot.src, 1200);
        ld = productLd(product);
      }
    }
    document.title = title;
    $('meta[name="description"]')?.setAttribute("content", description);
    $('meta[property="og:title"]')?.setAttribute("content", title);
    $('meta[property="og:description"]')?.setAttribute("content", description);
    $('meta[property="og:image"]')?.setAttribute("content", image);
    const script = $("#ld-json");
    if (script) script.textContent = JSON.stringify(ld).replaceAll("<", "\\u003c");
  }

  function productLd(product) {
    const available = product.variants.filter((variant) => variant.available);
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      description: [...product.description, ...product.style].join(" "),
      image: product.images.slice(0, 6).map((image) => cdn(image.src, 1200)),
      brand: { "@type": "Brand", name: "Trench Chimps" },
      sku: product.variants.find((variant) => variant.sku)?.sku || undefined,
      offers: {
        "@type": "AggregateOffer",
        lowPrice: product.priceMin,
        highPrice: product.priceMax,
        priceCurrency: state.catalog.currency || "USD",
        offerCount: available.length,
        availability: product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: product.url,
        seller: { "@type": "Organization", name: state.catalog.shop.name, url: state.catalog.storeUrl },
      },
    };
  }

  function itemListLd(list) {
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: list.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: product.url,
        name: product.title,
      })),
    };
  }

  function updateNav() {
    const route = state.route;
    $$("#desktop-nav a, #mobile-panel a").forEach((link) => {
      const href = link.getAttribute("href");
      let current = false;
      if (href === "#/" && route.name === "home") current = true;
      if (href === "#/shop" && route.name === "shop") current = true;
      if (href === "#/collections" && (route.name === "collections" || route.name === "collection")) current = true;
      if (href === "#/story" && route.name === "story") current = true;
      if (href === "#/community" && route.name === "community") current = true;
      if (current) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.body.dataset.page = route.name;
  }

  function onRoute() {
    if (!state.catalog) return;
    const next = parseHash();
    const previous = state.route;
    const pathChanged = !previous || previous.path !== next.path;
    state.route = next;
    if (pathChanged) {
      closeMenu();
      closeSearch();
      closeQuick(true);
      window.scrollTo(0, 0);
      if (next.name === "product" && next.handle) remember(next.handle);
    }
    const search = $("#search-input");
    if (search && document.activeElement !== search) search.value = next.shop.q || "";
    updateNav();
    renderMain();
    setMeta();
  }

  function mountReveals() {
    revealObserver?.disconnect();
    const nodes = $$("#main .reveal");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((node) => node.classList.add("is-in"));
      return;
    }
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    nodes.forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.96 && rect.bottom > 0) node.classList.add("is-in");
      else revealObserver.observe(node);
    });
  }

  function mountSticky() {
    stickyObserver?.disconnect();
    const button = $("#pdp-add");
    const bar = $("#sticky-atc");
    document.body.classList.remove("atc-stuck");
    if (!button || !bar) return;
    stickyObserver = new IntersectionObserver(
      ([entry]) => {
        const show = !entry.isIntersecting;
        bar.hidden = !show;
        document.body.classList.toggle("atc-stuck", show);
      },
      { threshold: 0.4 }
    );
    stickyObserver.observe(button);
  }

  function updateCount() {
    const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
    const badge = $("#cart-count");
    badge.textContent = String(count);
    badge.hidden = count === 0;
    $("#cart-toggle").setAttribute("aria-label", count ? `Open bag, ${count} items` : "Open bag");
  }

  function renderCart() {
    const body = $("#cart-body");
    if (!state.cart.length) {
      body.innerHTML = `<div class="cart-empty">
        <img src="${BRAND.mark}" alt="">
        <h3 style="font-family:var(--display);font-size:2rem">Your bag is empty</h3>
        <p class="note">Nothing is held here. The official store bag is separate.</p>
        <a class="btn btn-primary" href="#/shop" data-close="cart">Return to shop</a>
      </div>`;
      return;
    }
    const rows = state.cart
      .map((item, index) => {
        const found = variantById(item.variantId);
        if (!found) {
          return `<div class="cart-item"><div></div><div><p>A saved item is no longer in the catalog.</p><button class="remove" type="button" data-remove="${index}">Remove</button></div></div>`;
        }
        const { product, variant } = found;
        const image = variant.image || cardImages(product, variant.color).primary?.src || "";
        const status = variant.available ? "" : `<p class="avail is-out">Sold out in the live catalog</p>`;
        return `<div class="cart-item">
          ${image ? imgTag(image, product.title, { width: 200 }) : "<div></div>"}
          <div>
            <h3>${escapeHtml(product.title)}</h3>
            <p class="note">${escapeHtml(variant.color)}${variant.size ? ` / ${escapeHtml(variant.size)}` : ""}</p>
            <p class="price">${money(variant.price)}</p>
            ${status}
            <div class="qty-row">
              <button type="button" data-cart-qty="-1" data-index="${index}" aria-label="Decrease quantity">−</button>
              <span>${item.qty}</span>
              <button type="button" data-cart-qty="1" data-index="${index}" aria-label="Increase quantity">+</button>
            </div>
            <button class="remove" type="button" data-remove="${index}">Remove</button>
          </div>
        </div>`;
      })
      .join("");
    const subtotal = state.cart.reduce((sum, item) => {
      const found = variantById(item.variantId);
      if (!found) return sum;
      return sum + found.variant.price * item.qty;
    }, 0);
    const blocked = state.cart.some((item) => {
      const found = variantById(item.variantId);
      return !found || !found.variant.available;
    });
    const href = checkoutHref();
    body.innerHTML = `${rows}<div class="summary-block">
      <div class="summary-row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
      <p class="note">${escapeHtml(state.catalog.policies.shipping[0] || "Shipping is calculated on the official store.")}</p>
      <p class="note">Shipping and tax are calculated at Shopify checkout. This demo does not take payment.</p>
      ${
        blocked
          ? `<p class="avail is-out">Remove sold-out items before checkout.</p><button class="btn btn-primary btn-block" type="button" disabled>Checkout on Shopify</button>`
          : `<a class="btn btn-primary btn-block" href="${escapeHtml(href)}" target="_blank" rel="noopener">Checkout on Shopify</a>`
      }
    </div>`;
  }

  function checkoutHref() {
    const parts = [];
    state.cart.forEach((item) => {
      const found = variantById(item.variantId);
      if (found?.variant.available) parts.push(`${found.variant.id}:${item.qty}`);
    });
    if (!parts.length) return state.catalog.links.store;
    return `${state.catalog.storeUrl.replace(/\/$/, "")}/cart/${parts.join(",")}`;
  }

  function openCart() {
    const drawer = $("#cart-drawer");
    drawer.hidden = false;
    document.body.classList.add("locked", "cart-open");
    requestAnimationFrame(() => drawer.classList.add("is-open"));
    $("#cart-toggle").setAttribute("aria-expanded", "true");
    renderCart();
    $(".cart-panel")?.focus();
  }

  function closeCart() {
    const drawer = $("#cart-drawer");
    drawer.classList.remove("is-open");
    document.body.classList.remove("locked", "cart-open");
    $("#cart-toggle").setAttribute("aria-expanded", "false");
    window.setTimeout(() => {
      if (!document.body.classList.contains("cart-open")) drawer.hidden = true;
    }, 280);
  }

  function renderQuick() {
    const product = state.quick ? findProduct(state.quick) : null;
    const modal = $("#quick-view");
    if (!product) {
      modal.hidden = true;
      return;
    }
    $("#quick-body").innerHTML = quickHtml(product);
    modal.hidden = false;
    document.body.classList.add("locked");
    $(".modal-panel")?.focus();
  }

  function openQuick(handle) {
    state.quick = handle;
    renderQuick();
  }

  function closeQuick(silent) {
    if (!state.quick && $("#quick-view")?.hidden) return;
    state.quick = null;
    const modal = $("#quick-view");
    if (modal) modal.hidden = true;
    if (!document.body.classList.contains("cart-open")) document.body.classList.remove("locked");
    if (!silent) $("#quick-body").innerHTML = "";
  }

  function closeMenu() {
    document.body.classList.remove("menu-open", "locked");
    if (document.body.classList.contains("cart-open") || state.quick) document.body.classList.add("locked");
    $("#menu-toggle")?.setAttribute("aria-expanded", "false");
    $("#menu-toggle")?.setAttribute("aria-label", "Open menu");
    const panel = $("#mobile-panel");
    if (panel) panel.hidden = true;
  }

  function placeMenu() {
    const header = document.querySelector(".site-header");
    const panel = $("#mobile-panel");
    if (!header || !panel) return;
    panel.style.top = `${Math.max(0, header.getBoundingClientRect().bottom)}px`;
  }

  function toggleMenu() {
    const open = !document.body.classList.contains("menu-open");
    document.body.classList.toggle("menu-open", open);
    document.body.classList.toggle("locked", open || document.body.classList.contains("cart-open") || Boolean(state.quick));
    $("#menu-toggle").setAttribute("aria-expanded", String(open));
    $("#menu-toggle").setAttribute("aria-label", open ? "Close menu" : "Open menu");
    const panel = $("#mobile-panel");
    panel.hidden = !open;
    if (open) placeMenu();
  }

  function closeSearch() {
    document.body.classList.remove("search-open");
    $("#search-toggle")?.setAttribute("aria-expanded", "false");
    const results = $("#search-results");
    if (results) results.hidden = true;
  }

  function addProduct(handle) {
    const product = findProduct(handle);
    if (!product) return;
    const sel = ensureSel(product);
    if (!sel.size) {
      announce(`Select a size for ${product.title}.`);
      const target = $(`#card-size-${CSS.escape(handle)}`) || $("#pdp-size") || $("#quick-size") || $(".size-pill");
      const sizeSelect = document.querySelector(`[data-size-for="${CSS.escape(handle)}"]`) || document.querySelector(`[data-size-handle="${CSS.escape(handle)}"]`);
      (sizeSelect || target)?.focus();
      (sizeSelect || target)?.scrollIntoView({ block: "center" });
      return;
    }
    const variant = findVariant(product, sel.color, sel.size);
    if (!variant || !variant.available) {
      announce(`${product.title} in ${sel.size} is sold out.`);
      return;
    }
    const existing = state.cart.find((item) => item.variantId === Number(variant.id));
    const nextQty = Math.min(10, (existing?.qty || 0) + sel.qty);
    if (existing) existing.qty = nextQty;
    else state.cart.push({ variantId: Number(variant.id), qty: Math.min(10, sel.qty) });
    saveCart();
    announce(`Added ${product.title}, ${variant.color}, ${variant.size}, quantity ${existing ? existing.qty : sel.qty}, to your bag.`);
    closeQuick(true);
    openCart();
  }

  function applyFilterChange(id, value) {
    const route = state.route;
    const shop = { ...route.shop };
    if (id === "filter-color") shop.color = value;
    if (id === "filter-size") shop.size = value;
    if (id === "filter-avail") shop.availability = value;
    if (id === "filter-sort") shop.sort = value;
    if (route.name === "collection") setHash(`#/collections/${route.collection}${listQuery(shop)}`);
    else setHash(`#/shop${listQuery({ ...shop, category: route.shop.category }, { includeCategory: true })}`);
  }

  function renderSearchResults(query) {
    const box = $("#search-results");
    const q = query.trim().toLowerCase();
    if (!q || !state.catalog) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    const hits = products()
      .filter((product) => product.title.toLowerCase().includes(q) || product.colors.some((color) => color.toLowerCase().includes(q)))
      .slice(0, 6);
    if (!hits.length) {
      box.hidden = false;
      box.innerHTML = `<p class="note" style="padding:.8rem">No matching products.</p>`;
      return;
    }
    box.hidden = false;
    box.innerHTML = hits
      .map(
        (product) => `<a href="#/product/${encodeURIComponent(product.handle)}"><span>${escapeHtml(product.title)}</span><small>${priceLabel(
          product
        )}</small></a>`
      )
      .join("");
  }

  function fillChrome() {
    const shop = state.catalog.shop;
    const place = [shop.city, shop.province].filter(Boolean).join(", ");
    const when = new Date(state.catalog.syncedAt);
    const stamp = Number.isNaN(when.getTime())
      ? ""
      : when.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const el = $("#shop-meta");
    if (el) {
      el.textContent = `${shop.name || "Official store"}${place ? ` · ${place}` : ""}. Catalog synced ${stamp} from the public Shopify product list.`;
    }
  }

  document.addEventListener("click", (event) => {
    const swatch = event.target.closest("[data-swatch]");
    if (swatch) {
      const product = findProduct(swatch.dataset.swatch);
      if (!product) return;
      const sel = ensureSel(product);
      sel.color = swatch.dataset.color;
      sel.image = "";
      if (sel.size && !sizesFor(product, sel.color).includes(sel.size)) sel.size = "";
      renderMain();
      if (state.quick) renderQuick();
      return;
    }
    const sizeBtn = event.target.closest("[data-size-handle]");
    if (sizeBtn && !sizeBtn.disabled) {
      const product = findProduct(sizeBtn.dataset.sizeHandle);
      if (!product) return;
      ensureSel(product).size = sizeBtn.dataset.size;
      renderMain();
      if (state.quick) renderQuick();
      return;
    }
    const thumb = event.target.closest("[data-thumb]");
    if (thumb) {
      const product = findProduct(thumb.dataset.thumb);
      if (!product) return;
      ensureSel(product).image = thumb.dataset.src;
      renderMain();
      if (state.quick) renderQuick();
      return;
    }
    const add = event.target.closest("[data-add]");
    if (add) {
      const product = findProduct(add.dataset.add);
      if (!product) return;
      const sel = ensureSel(product);
      if (add.getAttribute("aria-disabled") === "true" && sel.size) {
        announce(`${product.title} is sold out in that size.`);
        return;
      }
      addProduct(add.dataset.add);
      return;
    }
    const quick = event.target.closest("[data-quick]");
    if (quick) {
      openQuick(quick.dataset.quick);
      return;
    }
    if (event.target.closest("#cart-toggle")) {
      if (document.body.classList.contains("cart-open")) closeCart();
      else openCart();
      return;
    }
    if (event.target.closest("#menu-toggle")) {
      toggleMenu();
      return;
    }
    if (event.target.closest("#search-toggle")) {
      const open = !document.body.classList.contains("search-open");
      document.body.classList.toggle("search-open", open);
      $("#search-toggle").setAttribute("aria-expanded", String(open));
      if (open) $("#search-input")?.focus();
      else closeSearch();
      return;
    }
    if (event.target.closest("[data-close='quick']")) {
      closeQuick();
      return;
    }
    if (event.target.closest("[data-close='cart']")) {
      closeCart();
      return;
    }
    const delta = event.target.closest("[data-qty-delta]");
    if (delta) {
      const product = findProduct(delta.dataset.qtyHandle);
      if (!product) return;
      const sel = ensureSel(product);
      sel.qty = Math.min(10, Math.max(1, sel.qty + Number(delta.dataset.qtyDelta)));
      renderMain();
      if (state.quick) renderQuick();
      return;
    }
    const cartQty = event.target.closest("[data-cart-qty]");
    if (cartQty) {
      const index = Number(cartQty.dataset.index);
      const item = state.cart[index];
      if (!item) return;
      item.qty += Number(cartQty.dataset.cartQty);
      if (item.qty <= 0) state.cart.splice(index, 1);
      else item.qty = Math.min(10, item.qty);
      saveCart();
      renderCart();
      return;
    }
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      state.cart.splice(Number(remove.dataset.remove), 1);
      saveCart();
      renderCart();
      return;
    }
    if (!event.target.closest(".search-form")) {
      const results = $("#search-results");
      if (results) results.hidden = true;
    }
  });

  document.addEventListener("change", (event) => {
    const size = event.target.closest("[data-size-for]");
    if (size) {
      const product = findProduct(size.dataset.sizeFor);
      if (!product) return;
      ensureSel(product).size = size.value;
      renderMain();
      return;
    }
    const qty = event.target.closest("[data-qty-for]");
    if (qty) {
      const product = findProduct(qty.dataset.qtyFor);
      if (!product) return;
      const value = Math.round(Number(qty.value));
      ensureSel(product).qty = Number.isFinite(value) ? Math.min(10, Math.max(1, value)) : 1;
      renderMain();
      if (state.quick) renderQuick();
      return;
    }
    const filter = event.target.closest("[data-filter]");
    if (filter) applyFilterChange(filter.dataset.filter, filter.value);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.quick) closeQuick();
    else if (document.body.classList.contains("cart-open")) closeCart();
    else if (document.body.classList.contains("search-open")) closeSearch();
    else closeMenu();
  });

  $("#search-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = $("#search-input").value.trim();
    closeSearch();
    closeMenu();
    setHash(query ? `#/shop?q=${encodeURIComponent(query)}` : "#/shop");
  });

  $("#search-input")?.addEventListener("input", (event) => {
    renderSearchResults(event.target.value);
  });

  document.addEventListener(
    "error",
    (event) => {
      if (event.target?.tagName === "IMG") event.target.classList.add("is-broken");
    },
    true
  );

  function boot(catalog) {
    state.catalog = catalog;
    fillChrome();
    updateCount();
    window.addEventListener("hashchange", onRoute);
    onRoute();
  }

  fetch("data/catalog.json", { cache: "no-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then(boot)
    .catch(() => {
      $("#main").innerHTML = `<div class="error-panel"><img src="${BRAND.mark}" alt=""><h1>The catalog didn’t load</h1><p class="note">This demo reads a saved copy of the public Shopify catalog. Refresh, or shop on the official store.</p><a class="btn btn-primary" href="https://store.trenchchimps.com/">Official store</a></div>`;
    });
})();
