import { scanStore, thumbUrl, SEVERITIES } from "./scan.js";

const INSTALL_URL = "https://apps.shopify.com/aharoll-asset-auditor";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SEV_LABEL = { critical: "Critical", high: "High", medium: "Medium", low: "Low", none: "Clean" };
const SEV_SHORT = { critical: "Crit", high: "High", medium: "Med", low: "Low", none: "OK" };

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const track = (name, params = {}) => {
  try {
    window.gtag?.("event", name, params);
  } catch {}
};
const installHref = (campaign) => `${INSTALL_URL}?utm_source=aharoll.com&utm_medium=landing&utm_campaign=${campaign}`;

/* Sample catalog: what an Asset Audit report looks like. Photo blades reuse
   Aharoll's own demo photos; the rest are flat colour chips, as in a swatch guide. */
const photo = (src, pos, zoom, label) => ({ src, pos, zoom, label });
const tone = (hex, label) => ({ tone: hex, label });
const empty = (label) => ({ empty: true, label });

const SAMPLE = [
  {
    title: "Wool beanie, Moss",
    severity: "critical",
    chips: [empty("No photo"), empty("No photo"), empty("No photo")],
    scores: { coverage: 0, variants: 0, seo: 0 },
    findings: [
      { severity: "critical", title: "No product photos", detail: "Listed and buyable, but shoppers see a placeholder." },
    ],
  },
  {
    title: "Linen crossbody bag",
    severity: "critical",
    chips: [photo("/assets/sample/bag.webp", "50% 50%", 1, "Front"), photo("/assets/sample/bag.webp", "50% 34%", 2.2, "Detail"), empty("Black?")],
    scores: { coverage: 55, variants: 50, seo: 70 },
    findings: [
      { severity: "critical", title: "No photo for color “Black”", detail: "Shoppers pick Black and still see Sand." },
      { severity: "high", title: "Missing back and inside view", detail: "Bags need both. Shoppers check pockets and straps." },
      { severity: "medium", title: "Background drifts", detail: "Front shot on warm gray; the rest of your bags are on white." },
    ],
  },
  {
    title: "Oxford shirt, Sky",
    severity: "critical",
    chips: [tone("#a9c1d6", "Front"), tone("#9fb7cc", "Back"), empty("White?")],
    scores: { coverage: 75, variants: 34, seo: 90 },
    findings: [
      { severity: "critical", title: "3 colors, 2 photos", detail: "White and Stripe share Sky's gallery. Picking them never changes the image." },
    ],
  },
  {
    title: "Bouclé 3-seat sofa",
    severity: "high",
    chips: [photo("/assets/sample/sofa.webp", "50% 70%", 1.15, "In room"), empty("Angle"), empty("Material")],
    scores: { coverage: 30, variants: 100, seo: 85 },
    findings: [
      { severity: "high", title: "Only one photo", detail: "Furniture needs an angled view and a material close-up." },
      { severity: "low", title: "Alt text missing", detail: "Screen readers and Google Images get nothing." },
    ],
  },
  {
    title: "Suede chelsea boot",
    severity: "high",
    chips: [tone("#8a6a4f", "Side"), tone("#7d5f46", "Front"), empty("Sole")],
    scores: { coverage: 60, variants: 100, seo: 80 },
    findings: [
      { severity: "high", title: "No sole shot", detail: "Shoe shoppers check grip and wear. Shoes need lateral, front, back, sole and detail." },
    ],
  },
  {
    title: "Gold huggie earrings",
    severity: "high",
    chips: [tone("#d8b55a", "Hero"), tone("#cfa94c", "Close-up"), empty("Scale")],
    scores: { coverage: 70, variants: 100, seo: 75 },
    findings: [
      { severity: "high", title: "No scale reference", detail: "Without an on-ear shot, nobody can tell how big 12mm is." },
    ],
  },
  {
    title: "Framed print, Autumn Pass",
    severity: "medium",
    chips: [photo("/assets/sample/print.webp", "50% 50%", 1, "4:5"), photo("/assets/sample/print.webp", "50% 55%", 1.6, "1:1"), photo("/assets/sample/print.webp", "48% 62%", 2.6, "3:2")],
    scores: { coverage: 88, variants: 100, seo: 90 },
    findings: [
      { severity: "medium", title: "Mixed crops", detail: "Photos come in 4:5, 1:1 and 3:2. The gallery jumps as shoppers swipe." },
    ],
  },
  {
    title: "Merino crew, Oat",
    severity: "medium",
    chips: [tone("#d9ccb4", "Front"), tone("#e7e3da", "Back"), tone("#cdbd9f", "Detail")],
    scores: { coverage: 88, variants: 100, seo: 60 },
    findings: [
      { severity: "medium", title: "Lighting shifts between shots", detail: "Front is warm, back is cool. The color looks like two different sweaters." },
      { severity: "low", title: "2 generic filenames", detail: "Like IMG_2041.jpg. Image search can't tell what it shows." },
    ],
  },
  {
    title: "Ceramic mug set",
    severity: "medium",
    chips: [tone("#b9c4b4", "Hero"), tone("#b9c4b4", "Hero"), tone("#aab6a5", "Stack")],
    scores: { coverage: 75, variants: 100, seo: 85 },
    findings: [
      { severity: "medium", title: "Near-duplicate photos", detail: "Shots 1 and 2 are the same angle. Swap one for an in-hand or scale shot." },
    ],
  },
  {
    title: "Butter croissant box",
    severity: "low",
    chips: [photo("/assets/sample/croissant.webp", "45% 50%", 1.3, "Hero"), photo("/assets/sample/croissant.webp", "30% 40%", 2.4, "Detail"), photo("/assets/sample/croissant.webp", "70% 55%", 1.8, "Open")],
    scores: { coverage: 88, variants: 100, seo: 55 },
    findings: [
      { severity: "low", title: "3 of 3 photos missing alt text", detail: "Fine for shoppers, invisible to search and screen readers." },
    ],
  },
  {
    title: "Canvas tote, Natural",
    severity: "low",
    chips: [tone("#e3dccb", "Front"), tone("#d9d1bd", "Back"), tone("#cfc6b0", "Inside")],
    scores: { coverage: 100, variants: 100, seo: 70 },
    findings: [{ severity: "low", title: "Weak alt text", detail: "Every image says “tote”. Describe the view instead." }],
  },
  {
    title: "Linen shirt, Sand",
    severity: "none",
    chips: [tone("#cdbb98", "Front"), tone("#c6b28d", "Back"), tone("#bfa985", "Model")],
    scores: { coverage: 100, variants: 100, seo: 100 },
    findings: [],
  },
];

/* Fan geometry */
const fan = $("#fan");
const stage = $("#fan-stage");
const detail = $("#detail");
let current = { items: SAMPLE, sample: true, origin: null };
let selected = -1;

function spread() {
  const w = fan.clientWidth;
  if (w < 520) return { total: 150, max: 9 };
  if (w < 900) return { total: 140, max: 11 };
  return { total: 132, max: 13 };
}

function chipHTML(c) {
  if (c.empty) return `<span class="blade__chip blade__chip--empty" data-label="${esc(c.label)}"></span>`;
  if (c.tone) return `<span class="blade__chip blade__chip--tone" style="--tone:${c.tone}" data-label="${esc(c.label)}"></span>`;
  const style = `${c.pos ? `--pos:${c.pos};` : ""}${c.zoom ? `--zoom:${c.zoom};` : ""}`;
  return `<span class="blade__chip" style="${style}"><img src="${esc(c.src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>`;
}

function bladeHTML(item, i, angle, delay) {
  const n = item.findings.length;
  const label = `${item.title}. ${SEV_LABEL[item.severity]}. ${n ? `${n} issue${n > 1 ? "s" : ""}` : "No issues"}.`;
  return `<button type="button" class="blade sev-${item.severity}" data-i="${i}" style="--a:0deg;--target:${angle}deg;--d:${delay}ms;z-index:${100 - Math.round(Math.abs(angle))}" aria-label="${esc(label)}">
    <span class="blade__tip code"><span>${SEV_SHORT[item.severity]}</span><span>${String(i + 1).padStart(2, "0")}</span></span>
    <span class="blade__label">${esc(item.title)}</span>
    <span class="blade__chips">${item.chips.map(chipHTML).join("")}</span>
    <span class="blade__codes code"><span>Cov ${item.scores.coverage}</span><span>Var ${item.scores.variants}</span><span>Seo ${item.scores.seo}</span></span>
    <span class="blade__rivet" aria-hidden="true"></span>
  </button>`;
}

function renderFan(items, { animate = true } = {}) {
  const { total, max } = spread();
  const shown = items.slice(0, max);
  // Worst product stands at the center, the rest alternate outward by severity.
  const order = [];
  shown.forEach((_, k) => (k % 2 === 0 ? order.push(k) : order.unshift(k)));
  const step = shown.length > 1 ? total / (shown.length - 1) : 0;
  stage.innerHTML = order
    .map((itemIdx, pos) => {
      const angle = shown.length > 1 ? -total / 2 + pos * step : 0;
      const delay = animate && !reduceMotion ? 80 + Math.abs(angle) * 6 : 0;
      return bladeHTML(shown[itemIdx], itemIdx, angle.toFixed(2), delay.toFixed(0));
    })
    .join("");
  selected = -1;
  fan.classList.remove("has-selection");
  const open = () => stage.querySelectorAll(".blade").forEach((b) => b.style.setProperty("--a", b.style.getPropertyValue("--target")));
  if (!animate || reduceMotion) open();
  else requestAnimationFrame(() => requestAnimationFrame(open));
}

function closeFan() {
  fan.classList.add("is-closed");
  closeDetail();
  return new Promise((r) => setTimeout(r, reduceMotion ? 0 : 420));
}

function openFan(items) {
  fan.classList.remove("is-closed");
  renderFan(items);
}

/* Detail panel */
function thumbsHTML(item) {
  if (item.images) {
    if (!item.images.length) return `<div class="row__img--empty" aria-hidden="true"></div>`;
    return item.images
      .slice(0, 12)
      .map((im) => `<div><img src="${esc(thumbUrl(im.src, 160))}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>`)
      .join("");
  }
  return item.chips
    .map((c) =>
      c.src
        ? `<div style="--pos:${c.pos};--zoom:${c.zoom}"><img src="${esc(c.src)}" alt=""></div>`
        : c.tone
          ? `<div style="--tone:${c.tone}"></div>`
          : `<div class="row__img--empty"></div>`,
    )
    .join("");
}

function openDetail(i) {
  const item = current.items[i];
  if (!item) return;
  selected = i;
  fan.classList.add("has-selection");
  stage.querySelectorAll(".blade").forEach((b) => b.classList.toggle("is-selected", Number(b.dataset.i) === i));
  const link = current.origin && item.handle ? `<a href="${esc(current.origin)}/products/${esc(item.handle)}" target="_blank" rel="noopener">View on your store</a>` : "";
  const foot = current.sample
    ? "Sample from a full Asset Audit report."
    : item.findings.length
      ? `${link} · The app's AI vision also checks backgrounds, angles and missing shots.`
      : `${link} · No structural issues. The app's AI vision checks what the photos show.`;
  detail.className = `detail sev-${item.severity}`;
  detail.innerHTML = `<div class="detail__tip code"><span>${SEV_LABEL[item.severity]}</span><span>${item.type ? esc(item.type) : ""}</span>
      <button class="detail__close" type="button" aria-label="Close details"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="detail__body">
      <h3 id="detail-title">${esc(item.title)}</h3>
      <div class="detail__thumbs">${thumbsHTML(item)}</div>
      <div class="detail__scores">
        <div><b>${item.scores.coverage}</b><span class="code">Coverage</span></div>
        <div><b>${item.scores.variants}</b><span class="code">Variants</span></div>
        <div><b>${item.scores.seo}</b><span class="code">SEO</span></div>
      </div>
      ${
        item.findings.length
          ? `<ul class="findings">${item.findings
              .map((f) => `<li><span class="chip sev-${f.severity}" aria-label="${SEV_LABEL[f.severity]}"></span><div><b>${esc(f.title)}</b><p>${esc(f.detail)}</p></div></li>`)
              .join("")}</ul>`
          : `<p>No issues found.</p>`
      }
      <p class="detail__foot">${foot}</p>
    </div>`;
  requestAnimationFrame(() => detail.classList.add("is-open"));
  $(".detail__close", detail).addEventListener("click", () => closeDetail(true));
  track("blade_open", { severity: item.severity, sample: current.sample });
}

function closeDetail(returnFocus = false) {
  if (selected < 0) return;
  const was = selected;
  selected = -1;
  detail.classList.remove("is-open");
  fan.classList.remove("has-selection");
  stage.querySelectorAll(".blade.is-selected").forEach((b) => b.classList.remove("is-selected"));
  if (returnFocus) stage.querySelector(`.blade[data-i="${was}"]`)?.focus();
}

stage.addEventListener("click", (e) => {
  const blade = e.target.closest(".blade");
  if (!blade) return;
  const i = Number(blade.dataset.i);
  if (i === selected) closeDetail();
  else openDetail(i);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDetail(true);
  if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && e.target.classList?.contains("blade")) {
    const blades = [...stage.querySelectorAll(".blade")];
    const k = blades.indexOf(e.target) + (e.key === "ArrowRight" ? 1 : -1);
    blades[(k + blades.length) % blades.length]?.focus();
    e.preventDefault();
  }
});

document.addEventListener("click", (e) => {
  if (selected >= 0 && !e.target.closest(".blade, .detail")) closeDetail();
});

/* Scan flow */
const form = $("#scan-form");
const input = $("#store");
const btn = $("#scan-btn");
const statusEl = $("#status");
const progress = $("#progress");
const coverForm = $("#cover-form");
const coverResult = $("#cover-result");
const report = $("#report");
let controller = null;

const ERRORS = {
  blocked: (h) => `We couldn't read ${h}'s public catalog. If it's a Shopify store, the app can audit it from your admin.`,
  not_shopify: (h) => `${h} doesn't expose a Shopify catalog. Is it the right address? Try your .myshopify.com domain.`,
  password: () => "This store is password-protected, so the catalog isn't public yet. The app audits it from your admin.",
  empty: (h) => `${h} has no published products to scan.`,
  rate_limited: () => "The store is rate-limiting requests right now. Give it a minute and try again.",
  timeout: () => "The store took too long to answer. Try again, or use your .myshopify.com address.",
};

function setStatus(text, isError = false) {
  statusEl.innerHTML = text;
  statusEl.classList.toggle("is-error", isError);
}

function setProgress(p) {
  progress.classList.toggle("is-on", p !== null);
  progress.querySelector("span").style.setProperty("--p", String((p ?? 0) / 100));
}

function toBlade(r) {
  const chips = r.images.slice(0, 3).map((im) => ({ src: thumbUrl(im.src, 240) }));
  while (chips.length < 3) chips.push({ empty: true, label: "No photo" });
  return { ...r, chips };
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (controller) return;
  const raw = input.value;
  controller = new AbortController();
  btn.disabled = true;
  btn.textContent = "Scanning";
  setStatus("Reading your catalog…");
  setProgress(8);
  track("scan_start");
  const started = performance.now();
  const closing = closeFan();
  try {
    const result = await scanStore(raw, {
      signal: controller.signal,
      onProgress: (p) => {
        if (p.phase === "catalog") {
          setStatus(`Reading your catalog… ${p.loaded.toLocaleString()} products`);
          setProgress(Math.min(60, 10 + p.loaded / 20));
        } else {
          setStatus(`Checking photos and alt text… ${p.done}/${p.total}`);
          setProgress(60 + (35 * p.done) / p.total);
        }
      },
    });
    await closing;
    setProgress(100);
    showResult(result, Math.round(performance.now() - started));
  } catch (err) {
    await closing;
    let host = raw.trim();
    try {
      host = new URL(/^https?:/.test(host) ? host : `https://${host}`).hostname;
    } catch {}
    const msg = err.kind === "input" ? err.message : (ERRORS[err.kind] ?? ERRORS.blocked)(esc(host));
    setStatus(`${msg}${err.kind !== "input" ? ` <a href="${installHref("scan_error")}" data-install="scan_error">Install the app</a>` : ""}`, true);
    setProgress(null);
    openFan(current.items);
    track("scan_error", { kind: err.kind || "unknown" });
    if (err.kind === "input") input.focus();
  } finally {
    controller = null;
    btn.disabled = false;
    btn.textContent = "Scan";
  }
});

function showResult(res, ms) {
  const bladeItems = res.results.map(toBlade);
  current = { items: bladeItems, sample: false, origin: res.origin };
  setProgress(null);
  setStatus("");
  $("#cover-kicker").textContent = "Free scan";
  $("#cover-source").textContent = res.host;
  stage.setAttribute("aria-label", `${res.host}: products fanned out by severity, worst first. Select a blade for its findings.`);
  coverForm.hidden = true;
  coverResult.hidden = false;
  const c = res.counts;
  coverResult.innerHTML = `
    <h2>${res.flagged.toLocaleString()} of ${res.results.length.toLocaleString()} products flagged</h2>
    <div class="tally">
      <div class="sev-critical" style="--c:var(--crit)"><b>${c.critical}</b><span class="code">Critical</span></div>
      <div class="sev-high" style="--c:var(--high)"><b>${c.high}</b><span class="code">High</span></div>
      <div class="sev-medium" style="--c:var(--med)"><b>${c.medium}</b><span class="code">Medium</span></div>
      <div class="sev-low" style="--c:var(--low)"><b>${c.low}</b><span class="code">Low</span></div>
    </div>
    <div class="cover__actions">
      <a class="btn btn--light" href="#report">See the full report</a>
      <button class="btn btn--ghost" type="button" id="scan-again">Scan another</button>
    </div>`;
  $("#scan-again").addEventListener("click", resetScan);
  openFan(bladeItems);
  renderReport(res);
  track("scan_complete", { products: res.results.length, flagged: res.flagged, critical: c.critical, ms });
}

function resetScan() {
  coverResult.hidden = true;
  coverForm.hidden = false;
  report.hidden = true;
  $("#cover-source").textContent = "Sample catalog shown";
  current = { items: SAMPLE, sample: true, origin: null };
  closeFan().then(() => openFan(SAMPLE));
  input.select();
  input.focus();
}

/* Report */
const ISSUE_COPY = {
  no_images: "No product photos",
  variant_missing_image: "A color or finish has no photo",
  variants_share_gallery: "More colors than photos",
  variants_unlinked: "Color picks don't switch the photo",
  single_image: "Only one photo",
  two_images: "Only two photos",
  mixed_ratios: "Mixed crops in one gallery",
  low_res: `Photos too small to zoom`,
  duplicate_across: "Main photo reused on other products",
  generic_filenames: "Generic filenames",
  missing_alt: "Missing alt text",
};

let filter = "all";
let pageSize = 30;

function rowHTML(r) {
  const img = r.images[0]
    ? `<div class="row__img"><img src="${esc(thumbUrl(r.images[0].src, 120))}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>`
    : `<div class="row__img row__img--empty" aria-hidden="true"></div>`;
  return `<li class="row sev-${r.severity}">${img}
    <div><div class="row__title"><a href="${esc(current.origin)}/products/${esc(r.handle)}" target="_blank" rel="noopener">${esc(r.title)}</a></div>
    <div class="row__finds">${r.findings.length ? r.findings.map((f) => esc(f.title)).join(" · ") : "No structural issues"}</div></div>
    <span class="row__sev code">${SEV_SHORT[r.severity]}</span></li>`;
}

function renderRows(res) {
  const list = res.results.filter((r) => (filter === "all" ? r.severity !== "none" : r.severity === filter));
  $("#rows").innerHTML = list.length ? list.slice(0, pageSize).map(rowHTML).join("") : `<li class="report__fine">Nothing at this severity.</li>`;
  const more = $("#more");
  more.hidden = list.length <= pageSize;
  more.textContent = `Show ${Math.min(30, list.length - pageSize)} more of ${list.length - pageSize}`;
}

function renderReport(res) {
  filter = "all";
  pageSize = 30;
  const total = res.results.length;
  const c = res.counts;
  const pct = total ? Math.round((100 * res.flagged) / total) : 0;
  const topSev = SEVERITIES.find((s) => c[s] > 0 && s !== "none");
  const bar = SEVERITIES.filter((s) => c[s] > 0)
    .map((s, k) => `<span class="sev-${s}" style="--n:${c[s]};animation-delay:${k * 90}ms" title="${SEV_LABEL[s]}: ${c[s]}"><span class="code">${c[s] / total > 0.06 ? `${SEV_SHORT[s]} ${c[s]}` : ""}</span></span>`)
    .join("");
  const notes = [
    res.truncated ? `First ${total.toLocaleString()} products scanned.` : "",
    res.excluded ? `${res.excluded} gift card${res.excluded > 1 ? "s" : ""}, fees or protection add-ons skipped.` : "",
    res.altSampled ? `Alt text checked on a sample of ${res.altSampled} products.` : "",
    "Scores are free-scan estimates from catalog structure, not the app's vision audit.",
  ].filter(Boolean);

  report.innerHTML = `<div class="wrap">
    <div class="report__head">
      <div><h2 id="report-title">${esc(res.host)}: ${pct}% of products need attention.</h2>
      <p>${total.toLocaleString()} products, ${res.imageCount.toLocaleString()} photos. ${topSev && topSev !== "low" ? `Start with the ${SEV_LABEL[topSev].toLowerCase()} ones.` : "Mostly polish. Nice catalog."}</p></div>
      <a class="btn" data-install="report_head" href="${installHref("report_head")}">Run the full AI audit</a>
    </div>
    <div class="bar" role="img" aria-label="${SEVERITIES.map((s) => `${SEV_LABEL[s]} ${c[s]}`).join(", ")}">${bar}</div>
    <div class="bar__key">${SEVERITIES.map((s) => `<span><i class="chip sev-${s}"></i>${SEV_LABEL[s]} ${c[s].toLocaleString()}</span>`).join("")}</div>
    <div class="report__cols">
      <div>
        <h3>Most common problems</h3>
        <ul class="issues">${
          res.topIssues.length
            ? res.topIssues
                .slice(0, 8)
                .map((i) => `<li><span class="chip sev-${i.severity}" aria-label="${SEV_LABEL[i.severity]}"></span><span>${esc(ISSUE_COPY[i.code] ?? i.example)}<small>${SEV_LABEL[i.severity]}</small></span><b>${i.products.toLocaleString()}</b></li>`)
                .join("")
            : `<li><span class="chip sev-none"></span><span>No structural problems found</span><b>0</b></li>`
        }</ul>
        <p class="report__fine">Average free-scan scores: Coverage ${res.scores.coverage}, Variants ${res.scores.variants}, SEO ${res.scores.seo}.</p>
      </div>
      <div>
        <h3>Products, worst first</h3>
        <div class="filters" role="group" aria-label="Filter by severity">
          <button type="button" data-f="all" aria-pressed="true">All flagged</button>
          ${SEVERITIES.filter((s) => s !== "none" && c[s] > 0)
            .map((s) => `<button type="button" data-f="${s}" aria-pressed="false"><i class="chip sev-${s}"></i>${SEV_LABEL[s]} ${c[s]}</button>`)
            .join("")}
        </div>
        <ul class="rows" id="rows"></ul>
        <button type="button" class="btn btn--ghost more" id="more" hidden></button>
      </div>
    </div>
    <div class="upsell">
      <div><h3>That was the public-catalog check</h3>
      <p>The app opens every photo with AI vision: <b>background and lighting drift, which angles are there, and which shots each category is missing</b>, like the sole on a shoe or the inside of a bag. Read-only, $20/month for 100 products.</p></div>
      <a class="btn" data-install="report_upsell" href="${installHref("report_upsell")}">Install on Shopify</a>
    </div>
    <p class="report__fine">${notes.join(" ")}</p>
  </div>`;
  report.hidden = false;
  renderRows(res);
  report.querySelectorAll(".filters button").forEach((b) =>
    b.addEventListener("click", () => {
      filter = b.dataset.f;
      pageSize = 30;
      report.querySelectorAll(".filters button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      renderRows(res);
    }),
  );
  $("#more").addEventListener("click", () => {
    pageSize += 30;
    renderRows(res);
  });
}

/* Install clicks */
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-install]");
  if (a) track("install_click", { placement: a.dataset.install });
  const f = e.target.closest("[data-focus-scan]");
  if (f) {
    e.preventDefault();
    document.getElementById("main").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    setTimeout(() => input.focus({ preventScroll: true }), reduceMotion ? 0 : 500);
  }
});

/* Reveal and nav */
const io = new IntersectionObserver(
  (entries) =>
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("is-inview");
        io.unobserve(en.target);
      }
    }),
  { rootMargin: "0px 0px -12% 0px" },
);
document.querySelectorAll(".reveal, .guide, .sheet, .ladder, .price__blades").forEach((el) => io.observe(el));

const nav = $("#nav");
const onScroll = () => nav.classList.toggle("is-stuck", scrollY > 8);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

let lastWidth = innerWidth;
addEventListener("resize", () => {
  if (Math.abs(innerWidth - lastWidth) < 40) return;
  lastWidth = innerWidth;
  renderFan(current.items, { animate: false });
});

$("#year").textContent = new Date().getFullYear();

const params = new URLSearchParams(location.search);
renderFan(SAMPLE);
if (params.get("store")) {
  input.value = params.get("store");
  form.requestSubmit();
}
