#!/usr/bin/env python3
"""Build public/data/catalog.json from the public Shopify catalog.

No Storefront API token is required. Prices, variants, availability, images,
and policy copy come from:

  https://store.trenchchimps.com/products.json
  https://store.trenchchimps.com/meta.json
  https://store.trenchchimps.com/policies/shipping-policy.json
  https://store.trenchchimps.com/policies/refund-policy.json

Shopify does not publish Hoodies / Tees / Women's / Kids collections.
Category ids are derived only from product title, handle, and description
wording so the shop can group what is actually for sale.
"""

from __future__ import annotations

import html
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path

STORE = "https://store.trenchchimps.com"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "catalog.json"
NEW_WINDOW_DAYS = 30
USER_AGENT = "TrenchChimpsDesignDemo/1.0 (catalog sync)"


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode("utf-8"))


def clean(text: str) -> str:
    text = html.unescape(text or "")
    text = text.replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


class BodyParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.paragraphs: list[str] = []
        self.details: list[str] = []
        self.tables: list[list[list[str]]] = []
        self._buf: list[str] = []
        self._in_p = False
        self._in_li = False
        self._in_cell = False
        self._in_table = False
        self._row: list[str] = []
        self._rows: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "p":
            self._in_p = True
            self._buf = []
        elif tag == "li":
            self._in_li = True
            self._buf = []
        elif tag == "table":
            self._in_table = True
            self._rows = []
        elif tag == "tr" and self._in_table:
            self._row = []
        elif tag in ("td", "th") and self._in_table:
            self._in_cell = True
            self._buf = []
        elif tag == "br":
            self._buf.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if tag == "p" and self._in_p:
            text = clean("".join(self._buf))
            if text:
                self.paragraphs.append(text)
            self._in_p = False
        elif tag == "li" and self._in_li:
            text = clean("".join(self._buf))
            if text:
                self.details.append(text)
            self._in_li = False
        elif tag in ("td", "th") and self._in_cell:
            self._row.append(clean("".join(self._buf)))
            self._in_cell = False
        elif tag == "tr" and self._in_table:
            if any(self._row):
                self._rows.append(self._row)
            self._row = []
        elif tag == "table" and self._in_table:
            if self._rows:
                self.tables.append(self._rows)
            self._in_table = False
            self._rows = []

    def handle_data(self, data: str) -> None:
        if self._in_p or self._in_li or self._in_cell:
            self._buf.append(data)


STYLE_RE = re.compile(
    r"\b(PC\d+[A-Z]*|N\d{3,}|6004|3001YCVC|3001|29M|Bella|Jerzees|Next Level|Port & Company)\b",
    re.I,
)


def parse_body(body_html: str) -> dict:
    parser = BodyParser()
    parser.feed(body_html or "")
    description = []
    style = []
    for paragraph in parser.paragraphs:
        words = paragraph.split()
        looks_like_blank = (
            STYLE_RE.search(paragraph)
            and len(words) <= 18
            and not paragraph.lower().startswith(("the ", "an ", "a "))
            and "runs small" not in paragraph.lower()
        )
        if looks_like_blank:
            style.append(paragraph)
        else:
            description.append(paragraph)
    chart = None
    if parser.tables:
        rows = parser.tables[0]
        headers = rows[0]
        body = rows[1:]
        if body:
            chart = {"headers": headers, "rows": body}
    return {
        "description": description,
        "style": style,
        "details": parser.details,
        "sizeChart": chart,
    }


def view_of(src: str) -> str:
    name = src.lower()
    if re.search(r"[_-]back\b", name) or "_back" in name:
        return "back"
    if re.search(r"[_-]front\b", name) or "_front" in name:
        return "front"
    if "lifestyle" in name or "mockup" in name:
        return "lifestyle"
    return "photo"


SKIP_COLOR_WORDS = {"heather", "grey", "gray", "dark", "drk", "blend", "solid", "the"}


def filename_matches_color(src: str, color: str) -> bool:
    name = re.sub(r"[^a-z0-9]+", " ", src.lower().split("/")[-1].split("?")[0])
    color_n = re.sub(r"[^a-z0-9]+", " ", color.lower()).strip()
    if color_n and color_n in name:
        return True
    words = [w for w in color_n.split() if len(w) > 2]
    distinctive = [w for w in words if w not in SKIP_COLOR_WORDS]
    keys = distinctive or words
    return any(re.search(rf"\b{re.escape(w)}\b", name) for w in keys)


def option_indexes(product: dict) -> tuple[int | None, int | None]:
    color_i = size_i = None
    for i, option in enumerate(product.get("options") or [], start=1):
        name = (option.get("name") or "").lower()
        if "color" in name or "colour" in name:
            color_i = i
        elif "size" in name:
            size_i = i
    return color_i, size_i


def option_value(variant: dict, index: int | None) -> str:
    if not index:
        return ""
    return clean(variant.get(f"option{index}") or "")


def categories_for(product: dict, parsed: dict) -> list[str]:
    title = product.get("title") or ""
    handle = product.get("handle") or ""
    blob = " ".join([title, handle, " ".join(parsed["description"]), " ".join(parsed["style"])]).lower()
    cats: list[str] = []
    if "hoodie" in title.lower() or "hooded" in blob:
        cats.append("hoodies")
    if re.search(r"\btee\b", title.lower()) or "t-shirt" in title.lower():
        cats.append("tees")
    if "women" in title.lower() or "women" in handle.lower():
        cats.append("womens")
    if "youth" in title.lower() or "youth" in handle.lower() or re.search(r"\bkid", title.lower()):
        cats.append("kids")
    if "rooted" in handle.lower() or "rooted different" in title.lower():
        cats.append("rooted-different")
    return cats


def paragraphs_from_html(body: str) -> list[str]:
    parser = BodyParser()
    parser.feed(body or "")
    return parser.paragraphs


def load_products() -> list[dict]:
    products: list[dict] = []
    page = 1
    while page <= 10:
        payload = fetch_json(f"{STORE}/products.json?limit=250&page={page}")
        batch = payload.get("products") or []
        if not batch:
            break
        products.extend(batch)
        if len(batch) < 250:
            break
        page += 1
    return products


def normalize_product(product: dict, now: datetime) -> dict:
    parsed = parse_body(product.get("body_html") or "")
    color_i, size_i = option_indexes(product)
    images_raw = product.get("images") or []
    id_to_src = {img.get("id"): img.get("src") for img in images_raw}

    variants = []
    for variant in product.get("variants") or []:
        featured = variant.get("featured_image") or {}
        src = featured.get("src") if isinstance(featured, dict) else None
        if not src:
            src = id_to_src.get(variant.get("image_id"))
        variants.append(
            {
                "id": variant.get("id"),
                "title": variant.get("title") or "",
                "sku": variant.get("sku") or "",
                "color": option_value(variant, color_i),
                "size": option_value(variant, size_i),
                "price": float(variant.get("price") or 0),
                "compareAt": float(variant["compare_at_price"])
                if variant.get("compare_at_price")
                else None,
                "available": bool(variant.get("available")),
                "image": src,
            }
        )

    variant_colors: dict[int, set[str]] = {}
    for variant in variants:
        if variant["id"] is None:
            continue
        # filled below from image variant_ids
        variant_colors.setdefault(int(variant["id"]), set())

    color_by_variant = {int(v["id"]): v["color"] for v in variants if v["id"] is not None}

    images = []
    for img in images_raw:
        src = img.get("src") or ""
        variant_ids = [int(v) for v in (img.get("variant_ids") or [])]
        colors = sorted({color_by_variant.get(vid, "") for vid in variant_ids if color_by_variant.get(vid)})
        images.append(
            {
                "id": img.get("id"),
                "src": src,
                "alt": img.get("alt") or "",
                "width": img.get("width"),
                "height": img.get("height"),
                "view": view_of(src),
                "colors": colors,
            }
        )

    known_colors = []
    for variant in variants:
        if variant["color"] and variant["color"] not in known_colors:
            known_colors.append(variant["color"])

    for img in images:
        if img["colors"]:
            continue
        if img["view"] in ("lifestyle", "photo"):
            matched = [color for color in known_colors if filename_matches_color(img["src"], color)]
            img["colors"] = matched

    for index, img in enumerate(images):
        if img["view"] == "back" and not img["colors"] and index > 0:
            prev = images[index - 1]
            if prev["view"] == "front" and prev["colors"]:
                img["colors"] = list(prev["colors"])

    sizes = []
    for variant in variants:
        if variant["size"] and variant["size"] not in sizes:
            sizes.append(variant["size"])
    prices = [v["price"] for v in variants] or [0]
    published = product.get("published_at") or product.get("created_at") or ""
    published_dt = None
    if published:
        try:
            published_dt = datetime.fromisoformat(published)
        except ValueError:
            published_dt = None
    is_new = False
    if published_dt:
        if published_dt.tzinfo is None:
            published_dt = published_dt.replace(tzinfo=timezone.utc)
        is_new = published_dt >= now - timedelta(days=NEW_WINDOW_DAYS)

    tags = product.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    limited = any(re.search(r"limited", str(tag), re.I) for tag in tags) or bool(
        re.search(r"limited", product.get("title") or "", re.I)
    )

    return {
        "id": product.get("id"),
        "handle": product.get("handle"),
        "title": product.get("title") or "",
        "url": f"{STORE}/products/{product.get('handle')}",
        "vendor": product.get("vendor") or "",
        "productType": product.get("product_type") or "",
        "tags": tags,
        "publishedAt": product.get("published_at"),
        "createdAt": product.get("created_at"),
        "updatedAt": product.get("updated_at"),
        "categories": categories_for(product, parsed),
        "description": parsed["description"],
        "style": parsed["style"],
        "details": parsed["details"],
        "sizeChart": parsed["sizeChart"],
        "colors": known_colors,
        "sizes": sizes,
        "priceMin": min(prices),
        "priceMax": max(prices),
        "available": any(v["available"] for v in variants),
        "isNew": is_new,
        "limited": limited,
        "images": images,
        "variants": variants,
    }


def main() -> int:
    now = datetime.now(timezone.utc)
    try:
        raw_products = load_products()
        meta = fetch_json(f"{STORE}/meta.json")
        shipping = fetch_json(f"{STORE}/policies/shipping-policy.json")
        refund = fetch_json(f"{STORE}/policies/refund-policy.json")
    except Exception as exc:  # noqa: BLE001 — surface the failure and keep the last catalog
        print(f"Catalog sync failed: {exc}", file=sys.stderr)
        if OUT.exists():
            print(f"Leaving existing catalog in place: {OUT}", file=sys.stderr)
            return 0
        return 1

    products = [normalize_product(p, now) for p in raw_products]
    if not products:
        print("Shopify returned no products.", file=sys.stderr)
        return 1

    catalog = {
        "syncedAt": now.isoformat(),
        "source": f"{STORE}/products.json",
        "storeUrl": STORE,
        "currency": meta.get("currency") or "USD",
        "shop": {
            "name": meta.get("name") or "",
            "city": meta.get("city") or "",
            "province": meta.get("province") or "",
            "country": meta.get("country") or "",
            "domain": meta.get("domain") or "",
            "shipsTo": meta.get("ships_to_countries") or [],
            "productCount": meta.get("published_products_count"),
        },
        "links": {
            "store": f"{STORE}/",
            "contact": f"{STORE}/pages/contact",
            "shipping": f"{STORE}/policies/shipping-policy",
            "refund": f"{STORE}/policies/refund-policy",
            "privacy": f"{STORE}/policies/privacy-policy",
            "terms": f"{STORE}/policies/terms-of-service",
            "account": f"{STORE}/account/login",
            "website": "https://trenchchimps.com/",
            "x": "https://x.com/trenchchimps",
            "opensea": "https://opensea.io/collection/trench-chimps",
        },
        "policies": {
            "shipping": paragraphs_from_html((shipping.get("policy") or {}).get("body") or ""),
            "returns": paragraphs_from_html((refund.get("policy") or {}).get("body") or ""),
        },
        "categoryRules": {
            "hoodies": "Title contains hoodie, or the description says hooded.",
            "tees": "Title contains tee or t-shirt.",
            "womens": "Title or handle contains women.",
            "kids": "Title or handle contains youth or kid.",
            "rooted-different": "Title or handle contains Rooted Different.",
            "note": "The Shopify store does not publish these as collections. Grouping is from product wording only.",
        },
        "badges": {
            "new": f"published_at within {NEW_WINDOW_DAYS} days of sync",
            "soldOut": "no variant has available=true",
            "limited": "tag or title contains limited",
        },
        "products": products,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(products)} products to {OUT}")
    for product in products:
        avail = sum(1 for v in product["variants"] if v["available"])
        print(
            f"  {product['handle']}: ${product['priceMin']:.2f}–${product['priceMax']:.2f} "
            f"{avail}/{len(product['variants'])} in stock  cats={','.join(product['categories']) or '-'}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
