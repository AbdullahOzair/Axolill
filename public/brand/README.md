# Brand assets

## Source artwork (yours — don't edit)

| File | What it is | Used? |
|------|-----------|-------|
| `Symbol_Logo.png` | The isometric mark alone | ✅ **source of truth** |
| `Main_Logo.png` | Mark, alternate crop | — |
| `Text_Logo.png` | "AXONILL" wordmark, purple | — (see below) |
| `Simplified_Logo.png` | Mark + "SOFTWARE COMPANY" tagline | — |

## Generated derivatives (do not hand-edit)

Produced by [`scripts/generate-icons.mjs`](../../scripts/generate-icons.mjs) from
`Symbol_Logo.png`. Re-run after changing the source artwork:

```bash
node scripts/generate-icons.mjs
```

| File | Size | Purpose |
|------|------|---------|
| `mark.png` | 144×144 | **What the UI renders** — trimmed & squared |
| `og-image.png` | 1200×630 | Social share card |
| `../../app/icon.png` | 128×128 | Favicon (Next auto-detects) |
| `../../app/apple-icon.png` | 180×180 | iOS home-screen icon |

`Symbol_Logo.png` is 251×151 and **mostly padding** — rendering it directly would shrink the
mark to a fraction of its box. That's why `mark.png` exists.

## How it's used in code

Always via `<BrandMark />` ([components/brand-mark.tsx](../../components/brand-mark.tsx)) —
navbar, footer, auth card, and the page loader.

**Resolution ceiling:** the source mark is only ~95×133 real pixels. Keep rendered sizes
≤64px. Don't blow it up for hero use — recreate it as SVG first.

**The wordmark stays as live Poppins text**, not `Text_Logo.png`: the raster version is purple
(fails contrast on the dark background), can't be selected, and can't adapt to light/dark.
