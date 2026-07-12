# Axonill

**Tagline:** _Innovating Digital Experiences._

Axonill is a premium digital studio / client platform. This file documents the brand and
design system. It is the **source of truth for brand, design, and styling** — pair it with
[DATA_MODEL.md](DATA_MODEL.md), which is the source of truth for entities and fields. Don't
introduce new brand colors, fonts, or data fields without updating the matching file first.

---

## Tech Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (CSS-first config via `@theme` in [app/globals.css](app/globals.css))
- **shadcn/ui** (components in `components/ui`, style preset `base-nova`, icon library `lucide`)
- **framer-motion** for animation
- **lucide-react** for icons

---

## Brand Colors

Defined once as CSS variables in [app/globals.css](app/globals.css) and exposed as Tailwind
utilities. **Always use the tokens/utilities — never hardcode hex values in components.**

| Role           | Hex       | Brand token          | Tailwind utility (examples)              |
|----------------|-----------|----------------------|------------------------------------------|
| Primary        | `#0F172A` | `--brand-primary`    | `bg-brand` / `text-brand`                |
| Secondary      | `#2563EB` | `--brand-secondary`  | `bg-brand-secondary` / `text-brand-secondary` |
| Accent         | `#06B6D4` | `--brand-accent`     | `bg-accent-cyan` / `text-accent-cyan`    |
| Success        | `#10B981` | `--brand-success`    | `bg-success` / `text-success`            |
| Background     | `#F8FAFC` | `--background`       | `bg-background`                          |
| Dark background| `#020617` | `--background` (dark)| `bg-background` under `.dark`            |

### Semantic mapping (shadcn tokens)

These map the brand palette onto shadcn's semantic tokens so all shadcn components inherit
the brand automatically:

- `--primary` → `#0F172A` (light) / `#2563EB` (dark) — default buttons & key actions.
- `--foreground` → `#0F172A` (light) / `#F8FAFC` (dark) — body ink.
- `--ring` → `#2563EB` — focus rings.
- `--card` → `#FFFFFF` (light) / `#0F172A` (dark) — elevated surfaces.
- Charts `--chart-1..5` use blue → cyan → emerald → navy → slate.

Dark mode is class-based: add `class="dark"` to `<html>`.

---

## Logo & Assets

Source artwork lives in [public/brand/](public/brand/). **Always render the mark via the
`BrandMark` component** ([components/brand-mark.tsx](components/brand-mark.tsx)) — never
inline an `<img>` or re-create it as a CSS gradient square.

| File | Purpose |
|------|---------|
| `Symbol_Logo.png` | Original artwork (mark only). **Source of truth** — don't edit. |
| `mark.png` | Trimmed + squared derivative. **This is what the UI renders.** |
| `Text_Logo.png`, `Main_Logo.png`, `Simplified_Logo.png` | Original variants, currently unused. |
| `og-image.png`, `app/icon.png`, `app/apple-icon.png` | Generated derivatives. |

Derivatives are produced by [scripts/generate-icons.mjs](scripts/generate-icons.mjs)
(dependency-free). Re-run it if the source artwork changes:

```bash
node scripts/generate-icons.mjs
```

**⚠️ Resolution ceiling.** The source mark is only ~95×133 real pixels. It is crisp at
≤64px and degrades quickly above that — so the mark is used at 36px (navbar, footer),
44px (auth card) and 64px (page loader), and **must not be scaled up for hero-sized use**.
Fixing this properly means recreating the mark as SVG (also the prerequisite for animating
the three tiles independently).

**Logo colour vs brand palette.** The mark's cyan tiles (`#00A0C0`) match the brand accent,
but its purple→magenta body (`#703090` → `#A04090`) is **deliberately outside** the site
palette below. The logo keeps its own identity; do **not** recolour the site to match it,
and do not add purple to the palette.

The mark is drawn in exactly four places: navbar, footer, auth card, page loader. The
`Axonill` wordmark beside it is **live Poppins text**, not `Text_Logo.png` — the raster
wordmark is purple (fails contrast on the dark background), unselectable, and can't theme.

---

## Typography

- **Headings:** **Poppins** — loaded via `next/font/google`, variable `--font-poppins`,
  utility `font-heading`. Applied automatically to `h1`–`h6` (see the base layer in
  `globals.css`). Weights 400–800.
- **Body:** **Inter** — variable `--font-inter`, utility `font-sans`. Default on `<html>`.

Headings use tight tracking (`tracking-tight`) for a premium, modern feel.

---

## Design Direction

Inspired by **Apple, Linear, Stripe, and Vercel**: minimal, premium, confident.

- **Restraint over decoration.** Generous whitespace, strong typographic hierarchy, few
  accent colors. Let the layout breathe.
- **Depth, not noise.** Subtle borders (`border`), soft shadows, and gentle gradients
  (navy → blue → cyan) rather than heavy skeuomorphism.
- **Premium dark primary buttons** in light mode (Vercel/Linear style); brand-blue actions
  in dark mode.
- **Motion with purpose.** Use framer-motion for entrance reveals, hover micro-interactions,
  and smooth state transitions — fast, eased, never gratuitous. Respect
  `prefers-reduced-motion`.
- **Crisp, consistent radii.** Base radius `0.75rem`; use the `rounded-lg`/`rounded-xl`
  scale, not arbitrary values.
- **Accessibility.** Maintain WCAG AA contrast; visible focus states via `--ring`.

The rules above describe the **marketing site**. `/admin` is a different problem and has
its own system — see below.

---

## Admin Design System

The marketing site is a **showroom**: hero-scale type, full-bleed sections, lots of air,
seen once for 30 seconds. The admin is a **work surface**: dense, calm, read for hours.
Applying marketing typography there is what produced the current "tiny text floating in
too much empty space" — `text-5xl` headings next to 12px table rows.

**Only the brand palette and fonts are shared.** Inside `/admin`, never reach for
`text-4xl`/`text-5xl`, `tracking-tighter`, or hero gradients.

Tokens and utilities live in the `ADMIN DESIGN SYSTEM` block at the bottom of
[app/globals.css](app/globals.css). **Use the utilities — don't re-derive the numbers in
JSX.**

### Layout

| Token | Value | Purpose |
|---|---|---|
| `--admin-content-max` | `1200px` | Tables/forms stop stretching on wide screens |
| `--admin-pad-x` | `16px` → `32px` @640px | Page gutter (mobile → desktop) |
| `--admin-pad-y` | `24px` → `32px` @640px | Page top/bottom padding |

- `admin-page` — the page shell: centred, capped at 1200px, correct gutters.
- `admin-header` — the repeatable header block: **eyebrow → title → description** on the
  left, **primary action aligned right**, separated from the content by a bottom rule with
  24px of air above and below.

```tsx
<div className="admin-page">
  <header className="admin-header">
    <div>
      <p className="admin-eyebrow">Content</p>
      <h1 className="admin-title">Services</h1>
      <p className="admin-description">The cards shown on the homepage.</p>
    </div>
    <Button>Add service</Button>
  </header>
  …
</div>
```

### Typography (admin scale)

| Role | Spec | Utility |
|---|---|---|
| Page title | `text-2xl` / Poppins / semibold / `-0.02em` | `admin-title` |
| Section label / eyebrow | `text-xs` / uppercase / `0.08em` / muted | `admin-eyebrow` |
| Description | `text-sm` / muted | `admin-description` |
| Table header | `text-xs` / medium / muted | (from `admin-table`) |
| Table body | `text-sm` | (from `admin-table`) |

**14px is the floor for primary content.** `text-xs` is for *labels only* — column
headers, eyebrows, badges — never for data a person has to read.

### Table density

Applied by putting `admin-table` on the `<table>`; the row and cell rules cascade, so
screens never repeat padding classes on every cell.

- Row height **56px** (was ~36px), header row 44px.
- Horizontal cell padding **20px** (`--admin-cell-x`, inside the 16–24px band).
- A subtle bottom border per row; the last row sits flush with the card edge.
- Row hover = brand blue at **6%** (12% on dark) — `--admin-hover`.
- **Zebra-free.** Hover carries the row; stripes add noise. Do not add striping.

### Elevation

The canvas sits **behind** the chrome — never level with it. That separation is the fix
for "sidebar and canvas are both flat black".

| Token | Light | Dark |
|---|---|---|
| `--admin-canvas` (page) | `--muted` `#F1F5F9` | `--background` `#020617` |
| `--admin-chrome` (sidebar/topbar/cards) | `--card` `#FFFFFF` | `--card` `#0F172A` |

`admin-surface` is the one glass treatment: `rounded-2xl`, 60%-opacity border, 70%-opacity
chrome fill, `blur(12px)`, soft shadow. **Sidebar, topbar and every card container use it**
— consistently, not ad hoc.

### Motion

The admin currently has none. Keep it near-invisible: this is a tool, not a landing page.

- `admin-enter` — 420ms fade + 8px rise for a page or panel on mount. Stagger children by
  setting `--admin-delay`.
- Row hover is a 150ms background transition (built into `admin-table`).
- Both are disabled under `prefers-reduced-motion`.

No entrance animation on data that updates in place — re-animating a table after every
save is nauseating. Animate the page in once.

---

## Conventions

- Add shadcn components with `npx shadcn@latest add <component>`.
- Icons from `lucide-react` only.
- Keep the palette in `globals.css` authoritative; extend by adding a new `--brand-*` token
  there and documenting it in the table above — not by hardcoding colors in JSX.
