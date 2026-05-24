# LoveAll · Icon Assets

Two marks, ten files, one folder (`/icons`).

## What's in `/icons`

| File | Use | Notes |
| --- | --- | --- |
| `loveall-4D-light.svg` | App icon, light theme | Primary — wired into `manifest.json` |
| `loveall-4D-dark.svg` | App icon, dark theme | Primary |
| `loveall-4D-favicon-light.svg` | Browser tab ≤32px, light | Heavier stroke — wired into `index.html` |
| `loveall-4D-favicon-dark.svg` | Browser tab ≤32px, dark | Heavier stroke — wired into `index.html` |
| `loveall-4D-glyph.svg` | In-app glyph, no background | `currentColor` — manifest monochrome layer |
| `loveall-5A-light.svg` | Brand glyph, light theme | Typographic 00 |
| `loveall-5A-dark.svg` | Brand glyph, dark theme | Typographic 00 |
| `loveall-5A-favicon-light.svg` | Small-size, light | Weight 500 |
| `loveall-5A-favicon-dark.svg` | Small-size, dark | Weight 500 |
| `loveall-5A-glyph.svg` | In-app glyph, no background | `currentColor` |
| `icon-192.png` / `icon-512.png` | iOS `apple-touch-icon` + PWA PNG fallback | Same 4D mark, rasterized |

All SVG canvases are 1024×1024 with a 22.37% corner radius (Apple's iOS squircle approximation).
The mark sits in the central 68% of the canvas.

---

## How they're wired up in this repo

### `index.html`

```html
<meta name="theme-color" content="#fafaf7" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#0a0e1a" media="(prefers-color-scheme: dark)" />
<link rel="manifest" href="manifest.json" />
<link rel="icon" type="image/svg+xml" href="icons/loveall-4D-favicon-light.svg"
      media="(prefers-color-scheme: light)" />
<link rel="icon" type="image/svg+xml" href="icons/loveall-4D-favicon-dark.svg"
      media="(prefers-color-scheme: dark)" />
<link rel="apple-touch-icon" href="icons/icon-192.png" />
```

### `manifest.json`

```json
{
  "icons": [
    { "src": "icons/loveall-4D-light.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" },
    { "src": "icons/loveall-4D-glyph.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "monochrome" },
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

The PNGs are kept as the iOS home-screen fallback (`apple-touch-icon` doesn't accept SVG) and as a generic PWA fallback.

### Regenerating the PNG fallbacks

When the SVG art changes, rebuild the PNGs from the new 1024 canvas:

```bash
brew install librsvg
rsvg-convert -w 192 -h 192 icons/loveall-4D-light.svg > icons/icon-192.png
rsvg-convert -w 512 -h 512 icons/loveall-4D-light.svg > icons/icon-512.png
# Optional, for crisper iOS home-screen rendering:
rsvg-convert -w 180 -h 180 icons/loveall-4D-light.svg > icons/apple-touch-icon.png
```

### In-app use

The `glyph` variants inherit text color, so they can sit anywhere an icon-font glyph would:

```html
<img src="icons/loveall-4D-glyph.svg" alt="" style="width: 32px; color: var(--ink);" />
```

Or inline the SVG to style with CSS directly:

```html
<svg viewBox="0 0 1024 1024" width="32" height="32"
     fill="none" stroke="currentColor" stroke-width="31">
  <ellipse cx="410" cy="512" rx="174" ry="235"/>
  <ellipse cx="614" cy="512" rx="174" ry="235"/>
</svg>
```

---

## Source of truth

Parameters everything else is derived from. Tweak here; the rendered SVGs follow.

### 4D · Interlocked Zeros

```
Canvas:        1024 × 1024
Corner radius: 229 (22.37%)
Ring stroke:   31 (standard)  /  78 (favicon)
Left ring:     cx 410, cy 512, rx 174, ry 235
Right ring:    cx 614, cy 512, rx 174, ry 235
Overlap:       ~38px (≈22% of ring width)
```

Source SVG, light:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" rx="229" fill="#fafaf7"/>
  <g fill="none" stroke="#1a1a1a" stroke-width="31">
    <ellipse cx="410" cy="512" rx="174" ry="235"/>
    <ellipse cx="614" cy="512" rx="174" ry="235"/>
  </g>
</svg>
```

### 5A · Typographic 00

```
Canvas:        1024 × 1024
Corner radius: 229 (22.37%)
Font family:   -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui
Font size:     640
Font weight:   300 (standard)  /  500 (favicon)
Tabular nums:  on  (font-feature-settings: 'tnum')
Letter spacing: -15
Text anchor:    middle, baseline central
Position:       x 512, y 554  (slight optical descend from mathematical center)
```

Source SVG, light:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" rx="229" fill="#fafaf7"/>
  <text x="512" y="554" text-anchor="middle" dominant-baseline="central"
        font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif"
        font-size="640" font-weight="300"
        font-feature-settings="'tnum'" letter-spacing="-15"
        fill="#1a1a1a">00</text>
</svg>
```

> **Caveat.** 5A uses the system-font stack. On Apple devices this resolves to
> SF Pro Display and renders perfectly. On platforms without it, the fallback
> font's "0" will render — close, but not identical. To make 5A portable as a
> fixed asset (PNG, OG image, anything rasterized off-Apple), convert the `<text>`
> element to outline paths in a vector editor before exporting.

### Colors

| Token | Light | Dark |
| --- | --- | --- |
| Background | `#fafaf7` (paper cream) | `#0a0e1a` (night navy) |
| Mark | `#1a1a1a` (ink) | `#f5f3ec` (night accent) |

OKLCH equivalents are in `DESIGN.md` for color-management-aware pipelines.

---

## Open ends

- **macOS desktop `.icns`?** Convert from PNG with `iconutil`.
- **Android adaptive icon?** Use `loveall-4D-glyph.svg` as the foreground; pair with a paper-cream or night-navy `<color>` resource as the background.
- **Tinted iOS 18+ icon?** Use `loveall-4D-glyph.svg` as the tintable layer; iOS composites against the user's chosen tint.
- **Wordmark "LoveAll" lockup paired with the icon?** Not made yet.
