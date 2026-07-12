# Axonill — Complete Functionality & Overview

_Last updated: 12 July 2026_

Axonill is a **marketing website + client portal + admin dashboard** for a digital agency,
built to run on Cloudflare Workers.

---

## 1. Tech stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 15** (App Router) · React 19 · TypeScript |
| Styling | **Tailwind CSS v4** (CSS-first `@theme`) · shadcn/ui (Base UI) · framer-motion |
| Database | **Cloudflare D1** (SQLite) via **Drizzle ORM** |
| File storage | **Cloudflare R2** |
| Auth | **better-auth** (email/password + Google OAuth) |
| Validation | **zod** |
| Scheduling | **Cal.com** embed + webhook |
| Deployment | **@opennextjs/cloudflare** → Cloudflare Workers |

---

## 2. Site map

| Route | Access | Purpose |
|---|---|---|
| `/` | public | Marketing homepage (13 sections) |
| `/login` | public | Client sign-in — email/password **+ Google** |
| `/signup` | public | Client sign-up — email/password **+ Google** |
| `/portal` | **client** (signed in) | Client dashboard |
| `/portal/book` | **client** | Cal.com booking widget |
| `/admin` | **admin only** | Staff dashboard |
| `/admin/login` | public | Staff sign-in — **email/password only** (no signup, no Google) |

Unauthenticated `/portal` → `/login?next=…`. Unauthenticated `/admin` → `/admin/login?next=…`.
A signed-in **client** hitting `/admin` is redirected to `/portal`.

---

## 3. Marketing homepage

13 sections, all responsive (verified at 375 / 768 / 1440), dark + light mode,
WCAG-audited contrast, and `prefers-reduced-motion` respected throughout.

| # | Section | Notes |
|---|---|---|
| 1 | **Hero** | Animated gradient-mesh background, floating tech icons (React/Next/Python/AI), staggered entrance |
| 2 | **Trusted By** | Infinite CSS marquee of 8 client wordmarks, pauses on hover |
| 3 | **About** | Origin story + 4 stat counters that count up when scrolled into view |
| 4 | **Services** | 6 cards with sub-service checklists, hover lift + glow |
| 5 | **Process** | 7-stage timeline (Discover→Support), line **draws itself** as you scroll, alternates L/R |
| 6 | **Technologies** | 7 categories, badge grid, hover scale |
| 7 | **Portfolio** | 8 filter tabs, cards animate in/out with `AnimatePresence` |
| 8 | **Why Choose** | 10 differentiators, 5×2 glassmorphic grid |
| 9 | **Testimonials** | Auto-advancing carousel — **live from `/api/testimonials`**, published-only |
| 10 | **Team** | 3 members, avatars, skills, socials |
| 11 | **Pricing** | 3 tiers, middle one highlighted ("Most Popular") |
| 12 | **FAQ** | shadcn Accordion, 6 questions |
| 13 | **Contact** | Form → **creates a real Lead** · Google Maps embed · email/WhatsApp links |

**Global chrome:** sticky glassmorphic navbar (session-aware), page-load logo animation,
footer, back-to-top button, dark/light toggle.

---

## 4. Authentication

### Roles

| | Clients | Admins |
|---|---|---|
| Sign up | `/signup` (email/password **or Google**) | ❌ **never** |
| Google | ✅ | ❌ |
| Sign in | `/login` | `/admin/login` (email + password only) |
| Created by | themselves | **`npm run create-admin` (CLI only)** |

Signup **always** produces `role="client"` — including via Google. Clients cannot self-assign
the role (`input: false` in the better-auth config), and there is **no bootstrap hook**, so no
sequence of website actions can ever produce an admin.

A client who tries their credentials at `/admin/login` is rejected with
*"This account doesn't have admin access."*

### Creating an admin

```bash
npm run create-admin -- you@axonill.com --name "Your Name" --password "secret123"
npm run create-admin -- you@axonill.com --password "secret123" --remote   # production
```

- User doesn't exist → creates them with `role="admin"` + a password credential
- User exists (incl. Google-only) → promotes them and sets/replaces the password
- Omit `--password` → a strong one is generated and printed once

### Session-aware navbar

- **Logged out** → "Log in" + "Sign up"
- **Logged in** → avatar + name → dropdown with **Client portal** (or **Admin dashboard** if
  admin) and **Sign out** (hard-redirects to `/`)
- Works on desktop and in the mobile sheet

---

## 5. Client portal (`/portal`)

Reads **live data from D1** via the API. Skeleton loading, error + retry, and empty states.

- **Active project card** — name, service, progress %, stage, budget, start/target dates,
  milestones approved count
- **7-stage progress bar** — Discover → Research → Design → Develop → Test → Deploy → Support
- **Milestone checklist** — statuses: pending / in progress / awaiting approval / approved /
  changes requested. The client can **Approve** or **Request changes** on milestones awaiting
  their approval (and *only* those — enforced server-side)
- **File list** — downloads stream from R2
- **Invoice table** — number, amount, status (draft/sent/paid/overdue), due date, outstanding total
- **`/portal/book`** — Cal.com inline widget, theme-synced to the site

---

## 6. Admin dashboard (`/admin`)

- **Stats cards** — open leads, win rate, project value, upcoming meetings (all computed live)
- **Leads table** — name, company, service, budget, source, **status badge**, filter pills,
  mailto contact
- **Sidebar nav** — Leads · Clients · Projects · Meetings · Testimonials

> ⚠️ Only the **Leads** view is built. Clients / Projects / Meetings / Testimonials show a
> *"not built yet"* placeholder. See §10.

---

## 7. API (13 routes)

All validated with zod and role-guarded. Ownership is enforced: a client can only reach their
own project's data — a non-owner gets **404** (so we don't leak that the project exists).

| Route | Methods | Access |
|---|---|---|
| `/api/auth/[...all]` | GET, POST | better-auth handler |
| `/api/contact` | POST | **public** — creates a Lead (the contact form) |
| `/api/contact` | GET | admin — the leads table |
| `/api/projects` | GET | admin = all · client = own only |
| `/api/projects` | POST | **admin** |
| `/api/projects/[id]` | GET / PATCH / DELETE | owner or admin / **admin** / **admin** |
| `/api/projects/[id]/milestones` | GET / POST | owner or admin / **admin** |
| `…/milestones/[milestoneId]` | PATCH / DELETE | client may **only** approve or request changes / **admin** |
| `/api/projects/[id]/files` | GET / POST | owner or admin · POST uploads to **R2** (25 MB cap) |
| `…/files/[fileId]` | GET / DELETE | streams from R2 / **admin** |
| `/api/invoices` | GET / POST | scoped by role / **admin** |
| `/api/invoices/[id]` | GET / PATCH / DELETE | owner or admin / **admin** / **admin** |
| `/api/meetings` | POST | **Cal.com webhook** — HMAC-verified, idempotent |
| `/api/meetings` | GET | **admin** |
| `/api/testimonials` | GET / POST | public (published only) / **admin** |
| `/api/testimonials/[id]` | PATCH / DELETE | **admin** |

**Cal.com webhook:** verifies `x-cal-signature-256` (HMAC-SHA256), **fails closed** without a
secret, is **idempotent** (keyed on Cal's booking `uid`), and auto-links the booking to an
existing user or lead by email.

---

## 8. Database (Cloudflare D1)

11 tables. Domain tables mirror `DATA_MODEL.md` exactly; auth tables are better-auth's.

**Auth:** `user` · `session` · `account` · `verification`
**Domain:** `project` · `milestone` · `project_file` · `invoice` · `lead` · `meeting` · `testimonial`

`DATA_MODEL.md`'s `User` (role, company, phone) is **merged into** better-auth's `user` table
rather than duplicated.

Everything is foreign-keyed with `ON DELETE CASCADE` from `user` — **deleting a user deletes
all of their projects, milestones, files and invoices.**

**Local vs remote:** `npm run dev` and any command without `--remote` use a **local** SQLite
file (`.wrangler/state/`). The deployed site uses **remote** D1. They are completely separate.

---

## 9. Cloudflare resources

Defined in `wrangler.jsonc` (account pinned via `account_id`):

- **`DB`** → D1 database `axonill`
- **`FILES`** → R2 bucket `axonill-files`

---

## 10. What is NOT built yet

| Gap | Impact |
|---|---|
| **Admin: Projects / Clients / Meetings / Testimonials views** | ⚠️ **Biggest gap.** There is no UI to create a project, so the client portal can only be populated via the API by hand. Every new client sees "No active project yet". |
| **File upload UI** | The R2 upload API works, but nothing in the portal lets you upload — only download. |
| **Password reset / email verification** | better-auth supports both; needs an email provider. |
| **Remote database is empty** | Schema is deployed, but 0 rows. A deployed site would show empty states everywhere. |
| **Never deployed** | `npm run cf:deploy` has not been run; production secrets not set. |
| **Newsletter form** | Footer form is not wired to anything. |
| **Tests / CI** | None. |
| **Placeholders** | `hello@axonill.com`, WhatsApp `1234567890`, team names, Google Maps location. |

---

## 11. Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server (local D1 + R2) |
| `npm run build` / `lint` | Build / lint |
| `npm run create-admin -- <email> --password <pw> [--remote]` | Create/promote an admin |
| `npm run db:generate` | Generate a migration from the schema |
| `npm run db:migrate:local` / `:remote` | Apply migrations |
| `npm run cf:types` | Regenerate binding types |
| `npm run cf:build` / `cf:preview` / `cf:deploy` | OpenNext build / preview / deploy |
| `node scripts/generate-icons.mjs` | Rebuild favicon / OG / logo mark |

---

## 12. Key docs

- **[CLAUDE.md](CLAUDE.md)** — brand & design system (colors, fonts, logo rules) — *source of truth*
- **[DATA_MODEL.md](DATA_MODEL.md)** — entities & fields — *source of truth*
- **[README.md](README.md)** — setup, secrets, admin access
- **[public/brand/README.md](public/brand/README.md)** — logo assets
