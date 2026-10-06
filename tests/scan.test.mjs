import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeStoreInput,
  auditProduct,
  auditCatalog,
  fetchCatalog,
  scanStore,
  fileBase,
  thumbUrl,
  ScanError,
  PAGE_SIZE,
  isNonPhysical,
} from "../assets/scan.js";

const cdn = (name, w = 2048, h = 2048, id = Math.floor(Math.random() * 1e9)) => ({
  id,
  src: `https://cdn.shopify.com/s/files/1/0001/files/${name}?v=1`,
  width: w,
  height: h,
  variant_ids: [],
});

const product = (over = {}) => ({
  id: 1,
  title: "Linen Shirt",
  handle: "linen-shirt",
  product_type: "Shirts",
  options: [{ name: "Size", values: ["S", "M"] }],
  variants: [
    { id: 11, option1: "S", featured_image: null },
    { id: 12, option1: "M", featured_image: null },
  ],
  images: [cdn("linen-front.jpg"), cdn("linen-back.jpg"), cdn("linen-detail.jpg"), cdn("linen-model.jpg")],
  ...over,
});

test("normalizeStoreInput handles the shapes merchants paste", () => {
  assert.equal(normalizeStoreInput("allbirds.com"), "https://allbirds.com");
  assert.equal(normalizeStoreInput("  HTTPS://www.Allbirds.com/collections/men?x=1 "), "https://www.allbirds.com");
  assert.equal(normalizeStoreInput("my-shop"), "https://my-shop.myshopify.com");
  assert.equal(normalizeStoreInput("my-shop.myshopify.com/admin"), "https://my-shop.myshopify.com");
  assert.equal(normalizeStoreInput("shop.example.co.uk:443"), "https://shop.example.co.uk");
  assert.throws(() => normalizeStoreInput(""), (e) => e instanceof ScanError && e.kind === "input");
  assert.throws(() => normalizeStoreInput("not a url!"), (e) => e.kind === "input");
});

test("a healthy product passes clean", () => {
  const r = auditProduct(product());
  assert.equal(r.severity, "none");
  assert.deepEqual(r.findings, []);
  assert.equal(r.scores.coverage, 88);
  assert.equal(r.scores.variants, 100);
});

test("no images is critical; one image is high; two is medium", () => {
  assert.equal(auditProduct(product({ images: [] })).severity, "critical");
  assert.equal(auditProduct(product({ images: [cdn("a.jpg")] })).severity, "high");
  assert.equal(auditProduct(product({ images: [cdn("a.jpg"), cdn("b.jpg")] })).severity, "medium");
});

test("color value with no photo while others have one is critical", () => {
  const imgs = [cdn("sand.jpg", 2048, 2048, 101), cdn("sand-2.jpg", 2048, 2048, 102), cdn("sand-3.jpg", 2048, 2048, 103)];
  const p = product({
    options: [{ name: "Color", values: ["Sand", "Black", "Navy"] }],
    variants: [
      { id: 1, option1: "Sand", featured_image: { id: 101 } },
      { id: 2, option1: "Black", featured_image: null },
      { id: 3, option1: "Navy", featured_image: null },
    ],
    images: imgs,
  });
  const r = auditProduct(p);
  assert.equal(r.severity, "critical");
  assert.equal(r.findings[0].code, "variant_missing_image");
  assert.match(r.findings[0].detail, /“Black” and “Navy”/);
  assert.equal(r.scores.variants, 33);
});

test("variant links via image.variant_ids count as linked", () => {
  const a = cdn("sand.jpg", 2048, 2048, 101);
  a.variant_ids = [1];
  const b = cdn("black.jpg", 2048, 2048, 102);
  b.variant_ids = [2];
  const p = product({
    options: [{ name: "Colour", values: ["Sand", "Black"] }],
    variants: [
      { id: 1, option1: "Sand", featured_image: null },
      { id: 2, option1: "Black", featured_image: null },
    ],
    images: [a, b, cdn("c.jpg")],
  });
  assert.equal(auditProduct(p).severity, "none");
});

test("unlinked colors: critical when photos < colors, medium otherwise", () => {
  const opts = [{ name: "Color", values: ["Red", "Blue", "Green", "Black", "White"] }];
  const variants = opts[0].values.map((v, i) => ({ id: i + 1, option1: v, featured_image: null }));
  const few = auditProduct(product({ options: opts, variants }));
  assert.equal(few.findings[0].code, "variants_share_gallery");
  assert.equal(few.severity, "critical");
  const many = auditProduct(
    product({ options: opts, variants, images: Array.from({ length: 6 }, (_, i) => cdn(`x${i}.jpg`)) }),
  );
  assert.equal(many.findings[0].code, "variants_unlinked");
  assert.equal(many.severity, "medium");
});

test("size-only variants never trigger variant findings", () => {
  const p = product({
    options: [{ name: "Size", values: ["XS", "S", "M", "L", "XL", "XXL"] }],
    variants: ["XS", "S", "M", "L", "XL", "XXL"].map((v, i) => ({ id: i, option1: v, featured_image: null })),
  });
  assert.equal(auditProduct(p).severity, "none");
});

test("mixed aspect ratios and low resolution are medium", () => {
  const p = product({ images: [cdn("a.jpg", 2000, 2000), cdn("b.jpg", 1600, 2000), cdn("c.jpg", 600, 600), cdn("d.jpg")] });
  const r = auditProduct(p);
  const codes = r.findings.map((f) => f.code);
  assert.ok(codes.includes("mixed_ratios"));
  assert.ok(codes.includes("low_res"));
  assert.match(r.findings.find((f) => f.code === "mixed_ratios").detail, /1:1, 4:5/);
  assert.equal(r.severity, "medium");
});

test("swatch images are ignored; option names pluralize properly", () => {
  const imgs = [cdn("a.jpg", 1600, 2000), cdn("b.jpg", 1600, 2000), cdn("c.jpg", 1600, 2000), cdn("shirt_PDP_swatch.jpg", 234, 234), cdn("dot.png", 120, 120)];
  assert.equal(auditProduct(product({ images: imgs })).severity, "none");
  const a = cdn("gold.jpg", 2048, 2048, 5);
  const p = product({
    options: [{ name: "Finish", values: ["Gold", "Silver", "Rose"] }],
    variants: [
      { id: 1, option1: "Gold", featured_image: { id: 5 } },
      { id: 2, option1: "Silver", featured_image: null },
      { id: 3, option1: "Rose", featured_image: null },
    ],
    images: [a, cdn("x.jpg"), cdn("y.jpg")],
  });
  assert.equal(auditProduct(p).findings[0].title, "No photo for 2 finishes");
});

test("SEO-only problems cap at low severity", () => {
  const imgs = [cdn("IMG_2041.jpg", 2048, 2048, 1), cdn("DSC00012.JPG", 2048, 2048, 2), cdn("good-name.jpg", 2048, 2048, 3), cdn("x.jpg", 2048, 2048, 4)];
  const alt = new Map([["1", ""], ["2", ""], ["3", "Linen shirt front"], ["4", "Back"]]);
  const r = auditProduct(product({ images: imgs }), { altByImage: alt });
  assert.equal(r.severity, "low");
  assert.deepEqual(r.findings.map((f) => f.code).sort(), ["generic_filenames", "missing_alt"]);
  assert.ok(r.findings.every((f) => f.group === "seo"));
  assert.equal(r.altChecked, true);
  assert.ok(r.scores.seo < 100);
});

test("fileBase strips Shopify size suffixes and thumbUrl adds width", () => {
  assert.equal(fileBase("https://cdn.shopify.com/s/files/1/files/shirt_1024x1024.jpg?v=3"), "shirt.jpg");
  assert.equal(fileBase("https://cdn.shopify.com/s/files/1/files/shirt.jpg"), "shirt.jpg");
  assert.equal(thumbUrl("https://cdn.shopify.com/s/files/1/files/a.jpg?v=3", 200), "https://cdn.shopify.com/s/files/1/files/a.jpg?v=3&width=200");
  assert.equal(thumbUrl("https://example.com/a.jpg", 200), "https://example.com/a.jpg");
});

test("non-physical items are excluded from the audit", () => {
  assert.equal(isNonPhysical({ title: "Gift Card", variants: [{ requires_shipping: false }] }), true);
  assert.equal(isNonPhysical({ title: "Free Returns Coverage", variants: [{ requires_shipping: true }] }), true);
  assert.equal(isNonPhysical({ title: "Shipping Protection" }), true);
  assert.equal(isNonPhysical({ title: "Tipped Laces", variants: [{ requires_shipping: true }] }), false);
  const rep = auditCatalog([product(), product({ id: 9, title: "E-Gift Card", images: [] })]);
  assert.equal(rep.results.length, 1);
  assert.equal(rep.excluded, 1);
});

test("a shared secondary shot is fine; only a reused hero is flagged", () => {
  const rep = auditCatalog([
    product({ id: 1, title: "A", handle: "a", images: [cdn("a1.jpg"), cdn("size-chart.jpg"), cdn("a3.jpg")] }),
    product({ id: 2, title: "B", handle: "b", images: [cdn("b1.jpg"), cdn("size-chart.jpg"), cdn("b3.jpg")] }),
  ]);
  assert.ok(rep.results.every((r) => r.severity === "none"));
});

test("auditCatalog flags photos reused across products and sorts worst first", () => {
  const shared = "shared-lifestyle.jpg";
  const products = [
    product({ id: 1, title: "Healthy", handle: "h" }),
    product({ id: 2, title: "Tote A", handle: "a", images: [cdn(shared), cdn("a2.jpg"), cdn("a3.jpg")] }),
    product({ id: 3, title: "Tote B", handle: "b", images: [cdn(shared), cdn("b2.jpg"), cdn("b3.jpg")] }),
    product({ id: 4, title: "Ghost", handle: "g", images: [] }),
  ];
  const rep = auditCatalog(products);
  assert.equal(rep.results[0].title, "Ghost");
  assert.equal(rep.results.at(-1).title, "Healthy");
  assert.equal(rep.counts.critical, 1);
  assert.equal(rep.counts.medium, 2);
  assert.equal(rep.flagged, 3);
  const dup = rep.topIssues.find((i) => i.code === "duplicate_across");
  assert.equal(dup.products, 2);
  assert.match(rep.results.find((r) => r.title === "Tote A").findings[0].detail, /Tote B/);
});

function fakeFetch(routes) {
  return async (url) => {
    for (const [pattern, handler] of routes) {
      if (pattern.test(url)) return handler(url);
    }
    throw new TypeError("Failed to fetch");
  };
}
const json = (body, status = 200, url) => ({ ok: status < 400, status, url, json: async () => body });

test("fetchCatalog paginates until a short page", async () => {
  const full = Array.from({ length: PAGE_SIZE }, (_, i) => product({ id: i, handle: `p${i}` }));
  const f = fakeFetch([
    [/page=1/, () => json({ products: full })],
    [/page=2/, () => json({ products: full.slice(0, 10) })],
  ]);
  const { products, truncated } = await fetchCatalog("https://s.com", { fetchImpl: f });
  assert.equal(products.length, PAGE_SIZE + 10);
  assert.equal(truncated, false);
});

test("fetchCatalog reports truncation at the page cap", async () => {
  const full = Array.from({ length: PAGE_SIZE }, (_, i) => product({ id: i }));
  const { truncated } = await fetchCatalog("https://s.com", { fetchImpl: fakeFetch([[/./, () => json({ products: full })]]), maxPages: 2 });
  assert.equal(truncated, true);
});

test("fetchCatalog maps failures to readable kinds", async () => {
  const kind = async (f) => fetchCatalog("https://s.com", { fetchImpl: f }).catch((e) => e.kind);
  assert.equal(await kind(fakeFetch([])), "blocked");
  assert.equal(await kind(fakeFetch([[/./, () => json({}, 404)]])), "not_shopify");
  assert.equal(await kind(fakeFetch([[/./, () => json({ nope: 1 })]])), "not_shopify");
  assert.equal(await kind(fakeFetch([[/./, () => json({ products: [] })]])), "empty");
  assert.equal(await kind(fakeFetch([[/./, () => json({}, 200, "https://s.com/password")]])), "password");
  assert.equal(await kind(fakeFetch([[/./, () => json({}, 429)]])), "rate_limited");
});

test("scanStore retries on www and samples alt text", async () => {
  const p = product({ images: [cdn("a.jpg", 2048, 2048, 7), cdn("b.jpg", 2048, 2048, 8), cdn("c.jpg", 2048, 2048, 9)] });
  const seen = [];
  const f = async (url) => {
    seen.push(url);
    if (url.startsWith("https://brand.com/")) throw new TypeError("Failed to fetch");
    if (url.includes("/products.json")) return json({ products: [p] });
    if (url.includes("/products/linen-shirt.json")) {
      return json({ product: { images: [{ id: 7, alt: "Front" }, { id: 8, alt: "" }, { id: 9, alt: null }] } });
    }
    throw new TypeError("Failed to fetch");
  };
  const rep = await scanStore("brand.com", { fetchImpl: f });
  assert.equal(rep.host, "www.brand.com");
  assert.equal(rep.altSampled, 1);
  assert.equal(rep.results[0].findings[0].code, "missing_alt");
  assert.match(rep.results[0].findings[0].title, /2 of 3/);
  assert.ok(seen.some((u) => u.startsWith("https://www.brand.com/products/linen-shirt.json")));
});
