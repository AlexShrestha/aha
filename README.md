# aharoll.com

Static site on Vercel. No build step: every file is served as-is.

| Path | What it is |
|---|---|
| `/` (`index.html`) | Landing page for **Asset Audit by Aharoll** (Shopify App Store: https://apps.shopify.com/aharoll-asset-auditor) |
| `/lp/` | Catalog-to-video landing (private beta) |
| `/blog/` | Blog |
| `/legal/app/` | Privacy, terms, support, pricing pages for the Shopify app |
| `/legacy/` | Previous homepage, kept for reference (`noindex`) |

## Landing page

- `index.html`: markup, meta, JSON-LD (SoftwareApplication + FAQ).
- `assets/landing.css`: the "swatch fan" visual system. Tokens are on `:root`.
- `assets/landing.js`: renders the fan, the detail panel, the scan flow and the report.
- `assets/scan.js`: free storefront scan, a pure ES module with no DOM access.
- `assets/sample/`: sample-fan photos, resized from Aharoll's own demo assets in `lp/assets/`.
- `assets/og.png`: social card, a capture of the hero.

### Free scan

The visitor types a store address and the browser reads `https://<store>/products.json` directly. Shopify serves it with `Access-Control-Allow-Origin: *`, so there's no backend and nothing is stored. It reads up to 1,000 products (4 pages × 250), then alt text for a sample of 36 products via `/products/<handle>.json`.

The checks are deterministic. Severities follow `aharoll-asset-auditor/analysis_rules.md`:

| Code | Severity | Rule |
|---|---|---|
| `no_images` | critical | Published product with zero photos |
| `variant_missing_image` | critical | A color/finish/pattern value has no linked photo while others do |
| `variants_share_gallery` | critical | No color linked to a photo, and fewer photos than colors |
| `single_image` | high | One photo |
| `two_images` | medium | Two photos |
| `variants_unlinked` | medium | Enough photos, but none linked to a color |
| `mixed_ratios` | medium | More than one aspect ratio in a gallery (2% tolerance) |
| `low_res` | medium | Shortest side under 800px |
| `duplicate_across` | medium | Main photo is the same file as another product's main photo |
| `generic_filenames` | low | `IMG_1234`, `DSC…`, `Screenshot…`, UUIDs, and similar |
| `missing_alt` | low | Empty alt text (sampled products only) |

- SEO findings never push a product above low.
- Size-only options are never checked for variant images.
- Swatch images (filename contains "swatch", or a square of 300px or less) are ignored.
- Gift cards, shipping protection and fees are excluded (`isNonPhysical`).

The AI vision checks (backgrounds, angles, lighting, missing shot types per category) live only in the app. The page says so wherever results appear.

Deep link: `/?store=yourstore.com` runs a scan on load.

### Analytics

gtag events: `scan_start`, `scan_complete` (product, flagged and critical counts, duration), `scan_error` (kind), `blade_open`, `install_click` (placement). Install links carry `utm_source=aharoll.com&utm_medium=landing&utm_campaign=<placement>`.

### Tests

```sh
node --test tests/scan.test.mjs
```

The tests cover input normalization, every rule above, pagination, error mapping (blocked, not Shopify, password, empty, rate-limited), the `www.` retry and alt-text sampling. Node 22+ is required; there are no dependencies.

### Design context

`PRODUCT.md` holds product truth, `DESIGN.md` the visual system, and `.impeccable/surfaces/index-html.md` the direction contract for this page. They're used by the [impeccable](https://github.com/pbakaus/impeccable) design skill.
