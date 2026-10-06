# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JS on Vercel (repo `aha`, domain aharoll.com). No build step. The Shopify app itself lives in a separate repo (`aha-auditor-shopify`) on auditor.aharoll.com; nothing on this site may change the app's URLs, OAuth, or listing.

## Users

Shopify merchants and their e-commerce/merch leads: small-to-mid catalogs (roughly 20 to 2,000 SKUs), apparel, shoes, bags, jewelry, furniture, home. They arrive from the Shopify App Store listing, search, or outreach, usually on a laptop between other admin work. Job: find out what's wrong with their product media before shoppers do, and know what to fix first.

## Product Purpose

Asset Audit by Aharoll (Shopify App Store: https://apps.shopify.com/aharoll-asset-auditor, launched 2026-05-07) scans every product's photos and videos with AI vision and flags inconsistencies (backgrounds, angles, lighting, crop), missing shots (back view, detail, lifestyle, on-model, category-specific), variant problems (color variants with no media, wrong or reused media) and SEO/accessibility gaps (alt text, filenames). Each product gets a severity (critical/high/medium/low) and three scores: Asset Coverage, Variant Integrity, SEO Accessibility. Read-only: it never edits products, themes, or settings.

Success on this site: a merchant installs from the App Store.

## Positioning

Category-aware merchandising rules, not generic image SEO. The audit knows a shoe needs a sole shot and a bag needs an inside view, treats a color variant with no image as critical, and refuses to escalate size-only variants. SEO findings never inflate severity. Neighbors (image compressors, alt-text writers, Path Catalog Health) optimize files or metadata; this audits what the shopper actually sees.

## Operating Context

Install from App Store, open in Shopify admin, Run audit, sort by severity, open a product, fix, re-run. Scope: read_products only.

## Capabilities and Constraints

- Severity rules and category coverage templates: `aharoll-asset-auditor/analysis_rules.md`.
- Public storefront `/products.json` and `/products/<handle>.json` return CORS `*`, so this site can run a free, browser-only structural scan of any public Shopify store (image counts, variants without assigned images, mixed aspect ratios, low resolution, generic filenames, missing alt text). The AI vision checks (background, angle, lighting, missing angle types) run only inside the app.
- Pricing (as listed on the App Store, authoritative): $20/month for 100 products, or $200/year.

## Brand Commitments

Name: "Asset Audit by Aharoll" on the store; "Aharoll" as company. Customer-facing copy is AI-native (no mention of human fulfillment). Contact: aleks@aharoll.com.

## Evidence on Hand

- No reviews yet (0 on the App Store as of 2026-10-06). No customer logos, testimonials, or case studies may be invented.
- Listing screenshots in `aha-auditor-shopify/public/screenshots/` are mockups with sample data.
- Third-party research usable with citation: Baymard (56% of users explore product images first on a PDP).
- The free live scan produces real, visitor-specific evidence.

## Product Principles

1. Prove on the visitor's own store before asking for anything.
2. Severity over volume: tell them what to fix first.
3. Honest boundaries: say what the free scan checks and what only the app checks.
4. Read-only and safe: say it plainly, merchants fear apps that touch their theme.
