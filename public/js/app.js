/* Trench Chimps store design demo — client-only cart */
(() => {
  const data = window.TC_DATA;
  if (!data || !Array.isArray(data.products)) {
    console.error("Product catalog failed to load.");
    return;
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const img = (name) => (name ? `images/${name}` : "");
  const money = (n) => `$${Number(n).toFixed(2)}`;
  const priceLabel = (p) =>
    p.priceMin === p.priceMax ? money(p.priceMin) : `${money(p.priceMin)} – ${money(p.priceMax)}`;
  const escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const CART_KEY = "tc-demo-cart-v1";
  const state = {
    filter: "all",
    page: "home",
    productHandle: null,
    cart: loadCart(),
    modal: null,
  };

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }
  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  }
  function cartCount() {
    return state.cart.reduce((sum, item) => sum + item.qty, 0);
  }
  function cartTotal() {
    return state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }
  function findProduct(handle) {
    return data.products.find((p) => p.handle === handle);
  }
  function sizesForColor(product, color) {
    const available = new Set(
      product.variants.filter((v) => v.color === color).map((v) => v.size)
    );
    return product.sizes.filter((s) => available.has(s));
  }
  function findVariant(product, color, size) {
    return product.variants.find((v) => v.color === color && v.size === size);
  }
  function imageFor(product, color, fallback) {
    const v = product.variants.find((x) => x.color === color && x.image);
    return v?.image || fallback || product.cardImage || product.images[0];
  }

  function parseHash() {
    const raw = (location.hash || "#/").replace(/^#/, "");
    const parts = raw.split("/").filter(Boolean);
    const first = (parts[0] || "").toLowerCase();
    if (first === "product" && parts[1]) {
      return { page: "product", filter: "all", handle: parts[1] };
    }
    if (["men", "women", "youth", "hoodies"].includes(first)) {
      return { page: "collection", filter: first, handle: null };
    }
    if (first === "shop") return { page: "shop", filter: "all", handle: null };
    if (first === "about") return { page: "about", filter: "all", handle: null };
    return { page: "home", filter: "all", handle: null };
  }

  function applyRoute() {
    const route = parseHash();
    state.page = route.page === "product" ? state.page || "home" : route.page;
    if (route.page !== "product") state.filter = route.filter;
    state.productHandle = route.handle;

    document.body.classList.toggle("page-collection", route.page === "collection");
    document.body.classList.toggle("page-about", route.page === "about");
    document.body.classList.toggle("page-shop", route.page === "shop");

    const titles = { men: "MEN", women: "WOMEN", youth: "YOUTH", hoodies: "HOODIES" };
    const dropTitle = $("#drop-title");
    const dropEyebrow = $("#drop-eyebrow");
    if (route.page === "collection") {
      dropTitle.textContent = titles[route.filter] || "THE DROP";
      dropEyebrow.textContent = "Shop the collection";
    } else {
      dropTitle.textContent = "THE DROP";
      dropEyebrow.textContent = "The collection";
    }

    $$(".nav a").forEach((a) => {
      const href = a.getAttribute("href");
      const current =
        (route.page === "home" && href === "#/") ||
        (route.page === "shop" && href === "#/shop") ||
        (route.page === "about" && href === "#/about") ||
        (route.page === "collection" && href === `#/${route.filter}`);
      a.toggleAttribute("aria-current", current);
      if (current) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    $$(".collection-tile").forEach((a) => {
      const href = a.getAttribute("href");
      if (route.page === "collection" && href === `#/${route.filter}`) {
        a.setAttribute("aria-current", "page");
      } else a.removeAttribute("aria-current");
    });

    renderGrid();
    closeNav();

    if (route.page === "product" && route.handle) {
      const product = findProduct(route.handle);
      if (product) openModal(product, { fromRoute: true });
    } else if (route.page !== "product") {
      closeModal({ silent: true });
    }

    if (route.page === "shop" || route.page === "collection") {
      requestAnimationFrame(() => {
        const el = $("#drop");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } else if (route.page === "about") {
      requestAnimationFrame(() => {
        const el = $("#about");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } else if (route.page === "home") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  function renderGrid() {
    const grid = $("#product-grid");
    const empty = $("#empty-filter");
    const items =
      state.filter === "all"
        ? data.products
        : data.products.filter((p) => p.collections.includes(state.filter));
    grid.innerHTML = items
      .map(
        (p) => `
      <article class="product-card" data-handle="${escapeHtml(p.handle)}">
        <a class="media" href="#/product/${encodeURIComponent(p.handle)}" aria-label="${escapeHtml(p.title)}">
          <img src="${img(p.cardImage)}" alt="${escapeHtml(p.title)}" width="600" height="600">
        </a>
        <div class="meta">
          <h3>${escapeHtml(p.title)}</h3>
          <p class="price">${priceLabel(p)}</p>
          <button class="btn btn-yellow js-open-product" type="button" data-handle="${escapeHtml(p.handle)}">Add to cart</button>
        </div>
      </article>`
      )
      .join("");
    empty.hidden = items.length > 0;
  }

  function openModal(product, { fromRoute } = {}) {
    const firstColor = product.colors[0];
    const firstSize = sizesForColor(product, firstColor)[0] || product.sizes[0];
    state.modal = {
      handle: product.handle,
      color: firstColor,
      size: firstSize,
      image: imageFor(product, firstColor, product.cardImage),
    };
    renderModal();
    const modal = $("#product-modal");
    modal.hidden = false;
    document.body.classList.add("modal-open");
    $(".modal-panel", modal)?.focus();
    if (!fromRoute) {
      history.pushState(null, "", `#/product/${encodeURIComponent(product.handle)}`);
    }
  }

  function closeModal({ silent } = {}) {
    const modal = $("#product-modal");
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    state.modal = null;
    if (!silent && parseHash().page === "product") {
      if (window.history.length > 1) history.back();
      else {
        history.pushState(null, "", "#/shop");
        applyRoute();
      }
    }
  }

  function renderModal() {
    if (!state.modal) return;
    const product = findProduct(state.modal.handle);
    if (!product) return;
    const variant = findVariant(product, state.modal.color, state.modal.size);
    const availableSizes = sizesForColor(product, state.modal.color);
    if (state.modal.size && !availableSizes.includes(state.modal.size)) {
      state.modal.size = availableSizes[0] || "";
    }
    const current = findVariant(product, state.modal.color, state.modal.size) || variant;
    const activeImage = current?.image || state.modal.image || product.cardImage;
    state.modal.image = activeImage;
    const note = (product.note || "").replace(/\s*[-–—]\s*call or chat with us.*$/i, "");
    const styleOnly = product.description && /PC\d|N\d{3,}|6004|3001|29M/.test(product.description) && product.description.length < 120;

    const thumbs = (product.images || [])
      .map(
        (src) => `
        <button type="button" data-image="${escapeHtml(src)}" aria-current="${src === activeImage}">
          <img src="${img(src)}" alt="">
        </button>`
      )
      .join("");

    const swatches = product.colors
      .map((color) => {
        const hex = product.swatches?.[color] || "#888";
        const checked = color === state.modal.color;
        return `<button class="swatch" type="button" role="radio" aria-checked="${checked}" aria-label="${escapeHtml(
          color
        )}" data-color="${escapeHtml(color)}" style="background:${hex}"></button>`;
      })
      .join("");

    const sizes = product.sizes
      .map((size) => {
        const enabled = availableSizes.includes(size);
        const checked = size === state.modal.size;
        return `<button class="size-pill" type="button" role="radio" aria-checked="${checked}" data-size="${escapeHtml(
          size
        )}" ${enabled ? "" : "disabled"}>${escapeHtml(size)}</button>`;
      })
      .join("");

    const fabric = (product.fabric || [])
      .map((b) => `<li>${escapeHtml(b)}</li>`)
      .join("");

    let chart = "";
    if (product.sizeChart?.rows?.length) {
      const head = product.sizeChart.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
      const rows = product.sizeChart.rows
        .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
        .join("");
      const youthNote =
        product.handle === "youth-tc-tee"
          ? "<p class='modal-desc'>Youth sizes on the product are YS, YM, YL, and YXL.</p>"
          : "";
      chart = `<details class="sizechart"><summary>Size chart</summary>${youthNote}<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></details>`;
    }

    $("#modal-body").innerHTML = `
      <div class="modal-gallery">
        <img id="modal-image" src="${img(activeImage)}" alt="${escapeHtml(product.title)}">
        <div class="thumbs">${thumbs}</div>
      </div>
      <div class="modal-info">
        <h2 id="modal-title">${escapeHtml(product.title)}</h2>
        <p class="modal-price">${current ? money(current.price) : priceLabel(product)}</p>
        ${
          product.description && !styleOnly
            ? `<p class="modal-desc">${escapeHtml(product.description)}</p>`
            : styleOnly
            ? `<p class="modal-desc">${escapeHtml(product.description)}</p>`
            : ""
        }
        ${note ? `<p class="modal-note">${escapeHtml(note)}.</p>` : ""}
        <span class="option-label" id="color-label">Color: ${escapeHtml(state.modal.color || "")}</span>
        <div class="swatches" role="radiogroup" aria-labelledby="color-label">${swatches}</div>
        <span class="option-label" id="size-label">Size</span>
        <div class="sizes" role="radiogroup" aria-labelledby="size-label">${sizes}</div>
        ${fabric ? `<span class="option-label">Details</span><ul class="fabric-list">${fabric}</ul>` : ""}
        ${chart}
        <div class="modal-actions">
          <button class="btn btn-yellow btn-block" type="button" id="add-to-cart" ${
            current && current.available ? "" : "disabled"
          }>Add to cart</button>
          <a class="store-link" href="${escapeHtml(product.url)}" target="_blank" rel="noopener">View on the real store</a>
        </div>
      </div>`;
  }

  function addCurrentToCart() {
    if (!state.modal) return;
    const product = findProduct(state.modal.handle);
    const variant = findVariant(product, state.modal.color, state.modal.size);
    if (!product || !variant) return;
    const key = String(variant.id);
    const existing = state.cart.find((i) => i.key === key);
    if (existing) existing.qty += 1;
    else {
      state.cart.push({
        key,
        variantId: variant.id,
        handle: product.handle,
        title: product.title,
        color: variant.color,
        size: variant.size,
        price: variant.price,
        image: variant.image || product.cardImage,
        url: product.url,
        qty: 1,
      });
    }
    saveCart();
    updateCartBadge();
    closeModal();
    openCart();
    renderCart();
  }

  function updateCartBadge() {
    const el = $("#cart-count");
    const n = cartCount();
    el.textContent = String(n);
    el.hidden = n === 0;
    $("#cart-toggle")?.setAttribute("aria-label", n ? `Open cart, ${n} items` : "Open cart");
  }

  function renderCart() {
    const body = $("#cart-body");
    if (!state.cart.length) {
      body.innerHTML = `<p class="cart-empty">Your cart is empty.</p>`;
      return;
    }
    const items = state.cart
      .map(
        (item, i) => `
      <div class="cart-item" data-index="${i}">
        <img src="${img(item.image)}" alt="">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="meta">${escapeHtml(item.color)} / ${escapeHtml(item.size)}</p>
          <p class="meta">${money(item.price)}</p>
          <div class="qty-row">
            <button type="button" data-qty="-1" aria-label="Decrease quantity">−</button>
            <span>${item.qty}</span>
            <button type="button" data-qty="1" aria-label="Increase quantity">+</button>
            <button type="button" class="remove" data-remove>Remove</button>
          </div>
        </div>
      </div>`
      )
      .join("");
    const links = state.cart
      .map((item) => `<li><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a></li>`)
      .join("");
    body.innerHTML = `
      ${items}
      <div class="cart-summary">
        <div class="row"><span>Subtotal</span><span>${money(cartTotal())}</span></div>
        <p class="demo-checkout-note">This is a design demo, so checkout isn’t live. Buy these on the official store:</p>
        <ul class="cart-links">${links}</ul>
        <a class="btn btn-yellow btn-block" href="${
          state.cart.length === 1 ? escapeHtml(state.cart[0].url) : "https://store.trenchchimps.com/"
        }" target="_blank" rel="noopener">Checkout on the real store</a>
      </div>`;
  }

  function openCart() {
    const drawer = $("#cart-drawer");
    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add("is-open"));
    document.body.classList.add("cart-open");
    $("#cart-toggle")?.setAttribute("aria-expanded", "true");
    renderCart();
    $(".cart-panel", drawer)?.focus();
  }
  function closeCart() {
    const drawer = $("#cart-drawer");
    drawer.classList.remove("is-open");
    document.body.classList.remove("cart-open");
    $("#cart-toggle")?.setAttribute("aria-expanded", "false");
    setTimeout(() => {
      if (!document.body.classList.contains("cart-open")) drawer.hidden = true;
    }, 250);
  }
  function toggleNav() {
    const open = !document.body.classList.contains("nav-open");
    document.body.classList.toggle("nav-open", open);
    $("#menu-toggle")?.setAttribute("aria-expanded", String(open));
    $("#menu-toggle")?.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  function closeNav() {
    document.body.classList.remove("nav-open");
    $("#menu-toggle")?.setAttribute("aria-expanded", "false");
    $("#menu-toggle")?.setAttribute("aria-label", "Open menu");
  }

  document.addEventListener("click", (e) => {
    const openBtn = e.target.closest(".js-open-product");
    if (openBtn) {
      const product = findProduct(openBtn.dataset.handle);
      if (product) openModal(product);
      return;
    }
    if (e.target.closest("#cart-toggle")) {
      if (document.body.classList.contains("cart-open")) closeCart();
      else openCart();
      return;
    }
    if (e.target.closest("#menu-toggle")) {
      toggleNav();
      return;
    }
    if (e.target.closest("[data-close=modal]")) {
      closeModal();
      return;
    }
    if (e.target.closest("[data-close=cart]")) {
      closeCart();
      return;
    }
    if (e.target.closest("#add-to-cart")) {
      addCurrentToCart();
      return;
    }
    const colorBtn = e.target.closest(".swatch[data-color]");
    if (colorBtn && state.modal) {
      state.modal.color = colorBtn.dataset.color;
      renderModal();
      return;
    }
    const sizeBtn = e.target.closest(".size-pill[data-size]");
    if (sizeBtn && state.modal && !sizeBtn.disabled) {
      state.modal.size = sizeBtn.dataset.size;
      renderModal();
      return;
    }
    const thumb = e.target.closest(".thumbs [data-image]");
    if (thumb && state.modal) {
      state.modal.image = thumb.dataset.image;
      const picture = $("#modal-image");
      if (picture) picture.src = img(state.modal.image);
      $$(".thumbs [data-image]").forEach((b) => b.setAttribute("aria-current", b === thumb ? "true" : "false"));
      return;
    }
    const qtyBtn = e.target.closest("[data-qty]");
    if (qtyBtn) {
      const item = qtyBtn.closest(".cart-item");
      const i = Number(item?.dataset.index);
      const delta = Number(qtyBtn.dataset.qty);
      if (state.cart[i]) {
        state.cart[i].qty += delta;
        if (state.cart[i].qty <= 0) state.cart.splice(i, 1);
        saveCart();
        updateCartBadge();
        renderCart();
      }
      return;
    }
    if (e.target.closest("[data-remove]")) {
      const item = e.target.closest(".cart-item");
      const i = Number(item?.dataset.index);
      if (state.cart[i]) {
        state.cart.splice(i, 1);
        saveCart();
        updateCartBadge();
        renderCart();
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!($("#product-modal").hidden)) closeModal();
      else if (document.body.classList.contains("cart-open")) closeCart();
      else closeNav();
    }
  });

  $("#troop-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#troop-email");
    if (!input.checkValidity()) {
      input.reportValidity();
      return;
    }
    input.value = "";
    const thanks = $("#troop-thanks");
    thanks.hidden = false;
  });

  window.addEventListener("hashchange", applyRoute);

  $("#shop-the-drop")?.addEventListener("click", (e) => {
    // Let the hash change handle scroll when going to #/shop.
    if ((location.hash || "") === "#/shop") {
      e.preventDefault();
      $("#drop")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  updateCartBadge();
  applyRoute();
})();
