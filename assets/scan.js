// Free storefront scan for Asset Audit by Aharoll.
// Runs entirely in the visitor's browser against a store's public
// /products.json (Shopify serves it with CORS *). Deterministic checks only;
// the AI vision checks (backgrounds, angles, lighting, missing shot types)
// live in the Shopify app. Severity rules mirror aharoll-asset-auditor/analysis_rules.md:
// SEO findings never raise severity above low.

export const SEVERITIES = ["critical", "high", "medium", "low", "none"];
const RANK = Object.fromEntries(SEVERITIES.map((s, i) => [s, i]));

export const PAGE_SIZE = 250;
export const MAX_PAGES = 4; // 1,000 products is plenty for a free preview
export const ALT_SAMPLE = 36; // per-product requests for alt text, so keep it small
export const LOW_RES_PX = 800; // below this most themes cannot zoom

const VISUAL_OPTION = /^(colou?rs?|shades?|finish(es)?|patterns?|prints?|metals?|materials?|wash(es)?|tones?|fabrics?)$/i;
const SWATCH_NAME = /swatch|colou?r[-_ ]?(chip|dot)/i;
const NON_PHYSICAL = /\b(gift ?cards?|e-?gift|shipping protection|package protection|route protection|returns? coverage|insurance|warranty|donation|gift wrap(ping)?|service fee|custom(ization)? fee)\b/i;
const GENERIC_NAME = /^(img|image|dsc|dscn|dcim|pxl|photo|pic|screenshot|screen[ _-]?shot|untitled|whatsapp[ _-]?image|capture|p\d{6,}|mvimg|gopr)[\W_]*\d*|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}|^[\d_\- ]+$/i;

export class ScanError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

/** Turn whatever the visitor typed into an https origin. */
export function normalizeStoreInput(raw) {
  let s = String(raw ?? "").trim().toLowerCase();
  if (!s) throw new ScanError("input", "Enter your store's web address.");
  s = s.replace(/^[a-z]+:\/\//, "").replace(/^\/+/, "");
  s = s.split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.$/, "");
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s)) {
    throw new ScanError("input", "That doesn't look like a web address. Try yourstore.com or yourstore.myshopify.com.");
  }
  return `https://${s}`;
}

function withTimeout(fetchImpl, url, ms, signal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new ScanError("timeout", "The store took too long to answer.")), ms);
  const onAbort = () => ctrl.abort(signal.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  return fetchImpl(url, { signal: ctrl.signal, headers: { Accept: "application/json" } }).finally(() => {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  });
}

async function readProductsPage(fetchImpl, origin, page, signal) {
  const url = `${origin}/products.json?limit=${PAGE_SIZE}&page=${page}`;
  let res;
  try {
    res = await withTimeout(fetchImpl, url, 15000, signal);
  } catch (err) {
    if (err instanceof ScanError) throw err;
    if (signal?.aborted) throw new ScanError("aborted", "Scan cancelled.");
    throw new ScanError("blocked", "We couldn't reach that store's public catalog.");
  }
  if (res.url && /\/password(\b|$)/.test(new URL(res.url).pathname)) {
    throw new ScanError("password", "This store is password-protected, so its catalog isn't public.");
  }
  if (res.status === 404) throw new ScanError("not_shopify", "That site doesn't expose a Shopify catalog.");
  if (res.status === 429) throw new ScanError("rate_limited", "The store is rate-limiting requests. Try again in a minute.");
  if (!res.ok) throw new ScanError("blocked", `The store answered with an error (${res.status}).`);
  let data;
  try {
    data = await res.json();
  } catch {
    throw new ScanError("not_shopify", "That site doesn't expose a Shopify catalog.");
  }
  if (!data || !Array.isArray(data.products)) {
    throw new ScanError("not_shopify", "That site doesn't expose a Shopify catalog.");
  }
  return data.products;
}

/** Fetch the public catalog, following page numbers until a short page. */
export async function fetchCatalog(origin, { fetchImpl = globalThis.fetch, signal, onProgress, maxPages = MAX_PAGES } = {}) {
  const all = [];
  let truncated = false;
  for (let page = 1; page <= maxPages; page++) {
    const products = await readProductsPage(fetchImpl, origin, page, signal);
    all.push(...products);
    onProgress?.({ phase: "catalog", loaded: all.length });
    if (products.length < PAGE_SIZE) break;
    if (page === maxPages) truncated = true;
  }
  if (all.length === 0) throw new ScanError("empty", "That store has no published products.");
  return { products: all, truncated };
}

/** Alt text is only in /products/<handle>.json, so sample a few products. */
export async function fetchAltText(origin, handles, { fetchImpl = globalThis.fetch, signal, concurrency = 6, onProgress } = {}) {
  const out = new Map();
  let i = 0;
  let done = 0;
  async function worker() {
    while (i < handles.length) {
      const handle = handles[i++];
      try {
        const res = await withTimeout(fetchImpl, `${origin}/products/${encodeURIComponent(handle)}.json`, 10000, signal);
        if (res.ok) {
          const { product } = await res.json();
          const alts = new Map();
          for (const img of product?.images ?? []) alts.set(String(img.id), (img.alt ?? "").trim());
          out.set(handle, alts);
        }
      } catch {
        if (signal?.aborted) return;
      }
      onProgress?.({ phase: "alt", done: ++done, total: handles.length });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, handles.length) }, worker));
  return out;
}

export function fileBase(src) {
  try {
    const name = decodeURIComponent(new URL(src).pathname.split("/").pop() || "");
    return name.replace(/_(\d+x\d*|\d*x\d+|pico|icon|thumb|small|compact|medium|large|grande|original|master)(?=\.)/i, "");
  } catch {
    return "";
  }
}

export function thumbUrl(src, width = 240) {
  try {
    const u = new URL(src);
    if (u.hostname.endsWith("cdn.shopify.com") || u.pathname.includes("/cdn/shop/")) u.searchParams.set("width", String(width));
    return u.toString();
  } catch {
    return src;
  }
}

function ratioLabel(r) {
  const known = [[1, "1:1"], [4 / 5, "4:5"], [5 / 4, "5:4"], [3 / 4, "3:4"], [4 / 3, "4:3"], [2 / 3, "2:3"], [3 / 2, "3:2"], [9 / 16, "9:16"], [16 / 9, "16:9"]];
  for (const [v, l] of known) if (Math.abs(r - v) / v < 0.02) return l;
  return r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`;
}

function distinctRatios(images) {
  const groups = [];
  for (const img of images) {
    if (!img.width || !img.height) continue;
    const r = img.width / img.height;
    if (!groups.some((g) => Math.abs(g - r) / g < 0.02)) groups.push(r);
  }
  return groups;
}

const COVERAGE_BY_COUNT = [0, 30, 55, 75, 88, 100];

/**
 * Audit one product. `ctx.altByImage` (Map imageId -> alt) is present only for
 * sampled products; `ctx.dupes` maps file base -> [product titles].
 */
export function auditProduct(product, ctx = {}) {
  // Themes use tiny square "swatch" images for color pickers; they aren't gallery shots.
  const isSwatch = (img) => SWATCH_NAME.test(fileBase(img.src)) || (img.width && img.width === img.height && img.width <= 300);
  const images = (product.images ?? []).filter((img) => !isSwatch(img)).map((img) => ({
    id: String(img.id),
    src: img.src,
    width: img.width ?? 0,
    height: img.height ?? 0,
    variantIds: (img.variant_ids ?? []).map(String),
  }));
  const variants = product.variants ?? [];
  const findings = [];
  const add = (severity, code, title, detail, group) => findings.push({ severity, code, title, detail, group });

  // Coverage
  if (images.length === 0) {
    add("critical", "no_images", "No product photos", "Shoppers see a placeholder. Nothing to judge, nothing to buy.", "coverage");
  } else if (images.length === 1) {
    add("high", "single_image", "Only one photo", "No back, detail or scale shot. Shoppers can't inspect what they're buying.", "coverage");
  } else if (images.length === 2) {
    add("medium", "two_images", "Only two photos", "Thin gallery. Most categories need a detail and an in-context shot.", "coverage");
  }

  // Variant integrity
  let variantScore = 100;
  const visualOptions = (product.options ?? [])
    .map((o, idx) => ({ name: o.name, idx, values: o.values ?? [] }))
    .filter((o) => VISUAL_OPTION.test(String(o.name).trim()) && o.values.length > 1);
  if (visualOptions.length && images.length) {
    const opt = visualOptions[0];
    const key = `option${opt.idx + 1}`;
    const linked = new Set(images.flatMap((i) => i.variantIds));
    const valueHasImage = new Map(opt.values.map((v) => [v, false]));
    for (const v of variants) {
      if (v.featured_image || linked.has(String(v.id))) valueHasImage.set(v[key], true);
    }
    const missing = [...valueHasImage].filter(([, has]) => !has).map(([v]) => v);
    const anyLinked = missing.length < opt.values.length;
    const optName = opt.name.toLowerCase();
    if (anyLinked && missing.length) {
      add("critical", "variant_missing_image", `No photo for ${missing.length} ${plural(optName, missing.length)}`,
        `${listNames(missing)} ${missing.length > 1 ? "have" : "has"} no image. Shoppers pick it and see a different ${optName}.`, "variant");
      variantScore = Math.round(100 * (1 - missing.length / opt.values.length));
    } else if (!anyLinked && images.length < opt.values.length) {
      add("critical", "variants_share_gallery", `${opt.values.length} ${plural(optName, 2)}, ${images.length} photo${images.length > 1 ? "s" : ""}`,
        `Some ${plural(optName, 2)} can't have a photo at all. Picking one never changes the image.`, "variant");
      variantScore = Math.round(40 * (images.length / opt.values.length));
    } else if (!anyLinked) {
      add("medium", "variants_unlinked", `${capitalize(optName)} picks don't switch the photo`,
        `Photos exist but none is linked to a ${optName}, so the gallery doesn't follow the shopper's choice.`, "variant");
      variantScore = 60;
    }
  } else if (visualOptions.length && !images.length) {
    variantScore = 0;
  }

  // Consistency
  const ratios = distinctRatios(images);
  if (ratios.length > 1) {
    add("medium", "mixed_ratios", "Mixed crops", `Photos come in ${ratios.map(ratioLabel).join(", ")}. The gallery jumps as shoppers swipe.`, "consistency");
  }
  const lowRes = images.filter((i) => i.width && i.height && Math.min(i.width, i.height) < LOW_RES_PX);
  if (lowRes.length) {
    add("medium", "low_res", `${lowRes.length} photo${lowRes.length > 1 ? "s" : ""} under ${LOW_RES_PX}px`,
      `Smallest is ${Math.min(...lowRes.map((i) => Math.min(i.width, i.height)))}px. Too small to zoom on most themes.`, "consistency");
  }
  // Shared secondary shots (a how-to, a size chart) are normal; a shared hero is not.
  const sharedWith = (images.length && ctx.dupes?.get(fileBase(images[0].src))?.filter((t) => t !== product.title)) || [];
  if (sharedWith.length) {
    add("medium", "duplicate_across", "Main photo reused on other products", `Same hero as ${listNames(sharedWith)}. Shoppers can't tell them apart in a grid.`, "consistency");
  }

  // SEO (never raises severity past low)
  const generic = images.filter((i) => GENERIC_NAME.test(fileBase(i.src)));
  if (generic.length) {
    add("low", "generic_filenames", `${generic.length} generic filename${generic.length > 1 ? "s" : ""}`,
      `Like ${fileBase(generic[0].src)}. Image search can't tell what it shows.`, "seo");
  }
  let altChecked = false;
  let missingAlt = 0;
  if (ctx.altByImage && images.length) {
    altChecked = true;
    missingAlt = images.filter((i) => !ctx.altByImage.get(i.id)).length;
    if (missingAlt) {
      add("low", "missing_alt", `${missingAlt} of ${images.length} photos missing alt text`,
        "Screen readers say nothing and Google Images has nothing to index.", "seo");
    }
  }

  const coverage = Math.max(0, COVERAGE_BY_COUNT[Math.min(images.length, 5)] - Math.round(20 * (images.length ? lowRes.length / images.length : 0)));
  let seo = 100;
  if (images.length) {
    seo -= Math.round(40 * (generic.length / images.length));
    if (altChecked) seo -= Math.round(60 * (missingAlt / images.length));
  } else {
    seo = 0;
  }

  findings.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  const severity = findings.length ? findings[0].severity : "none";

  return {
    id: String(product.id),
    title: product.title,
    handle: product.handle,
    type: product.product_type || "",
    images,
    findings,
    severity,
    altChecked,
    scores: { coverage, variants: variantScore, seo },
  };
}

function plural(word, n) {
  if (n === 1 || /s$/.test(word)) return word;
  return /(sh|ch|x|z)$/.test(word) ? `${word}es` : `${word}s`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function listNames(names, max = 3) {
  const quoted = names.slice(0, max).map((n) => `“${n}”`);
  if (names.length > max) return `${quoted.join(", ")} and ${names.length - max} more`;
  if (quoted.length > 1) return `${quoted.slice(0, -1).join(", ")} and ${quoted.at(-1)}`;
  return quoted[0] ?? "";
}

/** Gift cards, shipping protection and fees have no merchandising to audit. */
export function isNonPhysical(product) {
  const variants = product.variants ?? [];
  if (variants.length && variants.every((v) => v.requires_shipping === false)) return true;
  return NON_PHYSICAL.test(`${product.title ?? ""} ${product.product_type ?? ""}`);
}

/** Audit the whole catalog and roll up the store-level picture. */
export function auditCatalog(allProducts, altByHandle = new Map()) {
  const products = allProducts.filter((p) => !isNonPhysical(p));
  const excluded = allProducts.length - products.length;
  const dupes = new Map();
  for (const p of products) {
    const base = p.images?.length ? fileBase(p.images[0].src) : "";
    if (!base) continue;
    if (!dupes.has(base)) dupes.set(base, []);
    dupes.get(base).push(p.title);
  }
  for (const [k, v] of dupes) if (v.length < 2) dupes.delete(k);

  const results = products.map((p) => auditProduct(p, { dupes, altByImage: altByHandle.get(p.handle) }));
  results.sort((a, b) => RANK[a.severity] - RANK[b.severity] || b.findings.length - a.findings.length);

  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
  const byCode = new Map();
  for (const r of results) {
    counts[r.severity]++;
    for (const f of r.findings) {
      const e = byCode.get(f.code) ?? { code: f.code, severity: f.severity, group: f.group, products: 0, example: f.title };
      e.products++;
      if (RANK[f.severity] < RANK[e.severity]) e.severity = f.severity;
      byCode.set(f.code, e);
    }
  }
  const topIssues = [...byCode.values()].sort((a, b) => RANK[a.severity] - RANK[b.severity] || b.products - a.products);
  const imageCount = results.reduce((n, r) => n + r.images.length, 0);
  const avg = (k) => (results.length ? Math.round(results.reduce((n, r) => n + r.scores[k], 0) / results.length) : 0);

  return {
    results,
    excluded,
    counts,
    topIssues,
    imageCount,
    flagged: results.length - counts.none,
    altSampled: results.filter((r) => r.altChecked).length,
    scores: { coverage: avg("coverage"), variants: avg("variants"), seo: avg("seo") },
  };
}

/** Full pipeline used by the page. */
export async function scanStore(input, { fetchImpl = globalThis.fetch, signal, onProgress } = {}) {
  const origin = normalizeStoreInput(input);
  let catalog;
  let usedOrigin = origin;
  try {
    catalog = await fetchCatalog(origin, { fetchImpl, signal, onProgress });
  } catch (err) {
    const host = new URL(origin).hostname;
    if (err.kind !== "blocked" || host.startsWith("www.") || host.endsWith(".myshopify.com")) throw err;
    usedOrigin = `https://www.${host}`;
    catalog = await fetchCatalog(usedOrigin, { fetchImpl, signal, onProgress });
  }
  const sample = catalog.products.filter((p) => (p.images ?? []).length && !isNonPhysical(p)).slice(0, ALT_SAMPLE).map((p) => p.handle);
  const alt = await fetchAltText(usedOrigin, sample, { fetchImpl, signal, onProgress });
  const report = auditCatalog(catalog.products, alt);
  return { origin: usedOrigin, host: new URL(usedOrigin).hostname, truncated: catalog.truncated, ...report };
}
