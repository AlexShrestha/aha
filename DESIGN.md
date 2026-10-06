---
name: Asset Audit by Aharoll
description: The catalog as a swatch fan guide, sorted by what's broken.
colors:
  booth-gray: "#d8d9d5"
  booth-gray-deep: "#cbccc7"
  blade-white: "#fbfbf8"
  blade-edge: "#e6e7e2"
  ink: "#121413"
  ink-soft: "#454946"
  ink-muted: "#545854"
  rule: "#b4b6b0"
  cover-black: "#151716"
  cover-ink: "#f3f3ef"
  cover-ink-soft: "#a9aca6"
  severity-critical: "#e2321f"
  severity-high: "#f17c1c"
  severity-medium: "#e0ad1a"
  severity-low: "#8aac84"
  severity-none: "#ecede8"
typography:
  display:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(2.4rem, 4.9vw, 4.6rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(2rem, 3.8vw, 3.4rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 125"
  title:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.15
    fontVariation: "'wdth' 112"
  body:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
    fontVariation: "'wdth' 100"
  code:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 118"
    fontFeature: "'tnum'"
rounded:
  chip: "2px"
  blade: "6px"
  cover: "10px"
spacing:
  "1": "8px"
  "2": "16px"
  "3": "24px"
  "4": "40px"
  "5": "64px"
  "6": "112px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.blade-white}"
    rounded: "{rounded.blade}"
    height: "48px"
    padding: "0 22px"
  button-scan:
    backgroundColor: "{colors.severity-medium}"
    textColor: "{colors.ink}"
    rounded: "{rounded.blade}"
    height: "48px"
  button-light:
    backgroundColor: "{colors.blade-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.blade}"
  blade:
    backgroundColor: "{colors.blade-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.blade}"
  cover:
    backgroundColor: "{colors.cover-black}"
    textColor: "{colors.cover-ink}"
    rounded: "{rounded.cover}"
  severity-chip:
    rounded: "{rounded.chip}"
    width: "28px"
    height: "18px"
---

# Design System: Asset Audit by Aharoll

## Overview

**North star: the swatch fan guide.** A product catalog laid out like a printer's formula guide. Each product is a blade riveted at one pivot. Its gallery photos are the chips, a missing shot is a hatched empty chip, and the blade tip is painted with the product's severity. The page is that one object, seen from the front. A black cover blade stands upright over the rivet and holds the page's action (the store scan). Sections further down are the guide's other surfaces: blades laid flat as an inspection sheet, a coverage guide, a severity strip.

The world is quiet and precise, like a color-proofing booth. Severity is the only saturated color on the page, so red always means something.

## Colors

- **Booth Gray** (`booth-gray`) is the ground everywhere. It's the neutral of a color-viewing booth, chosen because merchants read this in daylight at a desk. **Booth Gray Deep** marks the report section.
- **Blade White** for every blade, sheet and table row. **Blade Edge** is the 1px hairline that separates blades and rows.
- **Ink** for type and primary buttons. **Ink Soft** for body copy on gray. **Ink Muted** only for labels and codes, and must stay at 4.5:1 or better on Booth Gray.
- **Cover Black** for the cover blade, the assurance bar, the upsell and the closing band. Text on it uses **Cover Ink** and **Cover Ink Soft**.
- **Severity ramp**: Critical vermilion, High orange, Medium ochre, Low sage, None blank. These are the only saturated colors. They appear as blade tips, chips, tally tiles, row tips and bar segments. Never use them as decoration.
- Medium ochre doubles as the action color on dark surfaces (the Scan button, input focus, caret, text selection), because it reads as the guide's highlighter.

## Typography

One family: **Archivo**, used across its width axis.

- **Display / headline**: width 125, weight 800, tight leading (0.95 to 1) with negative tracking. Hero and section headings only.
- **Title**: width 112, weight 700. Product names, sheet and panel titles, FAQ questions.
- **Body**: width 100, weight 400, 17px / 1.55. Measure 46 to 68ch.
- **Code**: width 118, weight 600, uppercase, 0.08em tracking, tabular figures. The guide's formula codes: severity labels, blade numbers, `COV 35 / VAR 40 / SEO 25`, shot labels. Labels only, never sentences.

## Layout

- Container max 1280px plus a fluid gutter `clamp(16px, 4vw, 56px)`. Section rhythm 112px desktop, 64px under 760px.
- **Hero**: fixed to the viewport (`clamp(700px, 100svh - 68px, 960px)`). The headline sits top-left, with lede and severity legend top-right. The fan fills the remaining height as a `container-type: size` box; blade length is `min(560px, 100cqh - 12px, 46cqw)`. The cover blade is pinned bottom-center over the pivot.
- **Under 760px**: the hero flows. The fan box is `clamp(250px, 34svh, 340px)` with 58px blades and a 150° spread, and the cover drops below the fan, full width.
- Section heads use a two-column grid: heading left, lede right, bottom-aligned. One column under 1080px.

## Elevation & Depth

Physical, low and directional, like paper on a desk. Blades get a 1px edge ring plus a soft shadow cast down-left (`-6px 10px 22px -14px`). Flat sheets get `0 24px 50px -30px`. Lift means moving along the blade's own radius (`translateY` after the rotation), never scaling. There are no glows and no hard offset shadows.

## Shapes

- Blades have small top corners (6px) and a fully rounded rivet end (`border-radius: 6px 6px bw/2 bw/2`).
- Chips are 2px squares.
- The cover has 10px top corners and sits flush to the bottom edge.
- The rivet is a 12 to 14px metal disc (radial gradient).
- A **hatched empty** is a 45° hairline hatch over Blade White inside a 1px rule. It's the one notation for "missing" across fan chips, sheet shots, row thumbnails and the optional coverage chips.
- A **wax-pencil mark** is the red 2px hand-drawn ellipse that circles a missing shot.

## Components

- **Blade** (`.blade`, a button) has, in order: severity tip with code and number, product name (up to 3 lines), three chips, formula codes, rivet. Hover and focus lift it 16px along its radius; selection lifts it 34px and desaturates the others (filter, not opacity).
- **Cover** holds a code head, a title, the scan form (dark input with an ochre focus ring, ochre Scan button), status (role=status), a progress hairline (scaleX) and fine print. After a scan, the same cover shows a tally of four severity tiles and two actions.
- **Detail panel**: the pulled blade laid flat. It has a severity tip bar, thumbnails, three scores on hairline columns and the findings list. It sits at the top-right on desktop and becomes a bottom sheet under 1080px.
- **Inspection sheet**: a horizontal blade with a severity tip on the left edge and five shots, each a 4:5 image or hatched empty with a note underneath.
- **Guide row**: a blade laid flat holding the category name and its required shots as chips (filled is required, hatched is optional).
- **Severity strip** (`.ladder`): four chips in one strip with definitions below.
- **Report**: a severity bar (segments flex by count), a common-problems list, filter chips and product rows (severity tip, thumbnail, title, findings).
- **Buttons**: Ink primary, Blade White light, ghost with a 1.5px inset ring. All have 6px radius, width 112 at weight 650, and a 1px lift on hover.

## Do's and Don'ts

- Do put every saturated color on a severity meaning. If it isn't a severity, it's gray, white or black.
- Do show a missing thing as a hatched empty with a code label, never as an icon.
- Do keep the action inside the world: the scan lives on the cover blade.
- Do use real product photos (the visitor's after a scan; Aharoll's own demo assets in the sample). Flat tone chips stand in for photos in the sample fan.
- Don't add eyebrow or kicker labels above headings. Code labels belong on objects (blades, sheets, chips), not over section titles.
- Don't use a second typeface, or monospace as decoration. Codes are Archivo at width 118.
- Don't use gradients, glass or glow. The only gradients are the rivet's metal and the hatch notation.
- Don't fabricate proof: no invented reviews, logos or stats. Third-party numbers carry a source link.
