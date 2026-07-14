# Axonill

npm run create-admin -- info.axonill@gmail.com --name "Abdullah Ozair" --password "Q1W2E3R4a!" --remote

_Innovating Digital Experiences._ — marketing site + client portal, deployed to Cloudflare Workers.

- **Next.js 15** (App Router) · React 19 · TypeScript · **Tailwind v4** · shadcn/ui · framer-motion
- **Cloudflare D1** (SQLite) + **R2** (file uploads), via **Drizzle ORM**
- **better-auth** — email/password + Google OAuth
- Deployed with **@opennextjs/cloudflare**

See [CLAUDE.md](CLAUDE.md) for the brand/design system and [DATA_MODEL.md](DATA_MODEL.md)
for the entity model.

---

## Getting started

```bash
npm install
cp .dev.vars.example .dev.vars      # then fill in the secrets
npm run db:migrate:local            # create the tables in local D1
npm run dev
```

Open <http://localhost:3000>.

### Secrets

Local secrets live in `.dev.vars` (gitignored) — **not** `.env`. Cloudflare bindings and
these values are exposed to `next dev` through `initOpenNextCloudflareForDev()`.

| Variable | Needed for |
|----------|-----------|
| `BETTER_AUTH_SECRET` | Session signing (any 32+ random bytes) |
| `BETTER_AUTH_URL` | `http://localhost:3000` in dev |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | "Continue with Google" |
| `CAL_WEBHOOK_SECRET` | Verifying the Cal.com booking webhook |
| `NEXT_PUBLIC_CAL_LINK` | The Cal.com event embedded at `/portal/book` (in `.env.local`) |

For production, set each one with `npx wrangler secret put <NAME>`.

---

## Admin access

**Admins can only be created from the command line — never from the website.**

|            | Clients | Admins |
|------------|---------|--------|
| Sign up    | `/signup` (email/password or Google) | ❌ never |
| Google     | ✅ | ❌ |
| Sign in    | `/login` | `/admin/login` — email + password only |
| Created by | themselves | `npm run create-admin` |

Signup **always** produces `role="client"` — including Google. Clients can't self-assign the
role (`input: false` in the better-auth config), and there is no bootstrap hook, so no
sequence of website actions can ever mint an admin.

### Create an admin

```bash
# create a brand-new admin (no website signup needed)
npm run create-admin -- you@axonill.com --name "Your Name" --password "secret123"

# against production D1
npm run create-admin -- you@axonill.com --password "secret123" --remote
```

- If the user **doesn't exist**, it creates them with `role="admin"` and a password credential.
- If the user **already exists** (e.g. they signed up as a client, or via Google), it promotes
  them to admin and sets/replaces the password.
- Omit `--password` and a strong one is generated and printed **once**.

> A Google-only account has no password, so it can't use `/admin/login` until you run this
> with a `--password`.

They then sign in at **`/admin/login`** (no signup link, no Google button). A client who tries
those credentials there is rejected with "This account doesn't have admin access."

It uses Drizzle to build the statements (type-safe against `lib/db/schema.ts`) and runs them
through `wrangler d1 execute`, so it works against both databases with the wrangler auth you
already have — no extra API token. Source: [scripts/create-admin.ts](scripts/create-admin.ts).

Existing users must sign out and back in for a new role to appear in their session.

---

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server (Turbopack), with Cloudflare bindings |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run create-admin -- <email> --password <pw> [--remote]` | Create/promote an admin |
| `npm run db:generate` | Generate a migration from `lib/db/schema.ts` |
| `npm run db:migrate:local` | Apply migrations to local D1 |
| `npm run db:migrate:remote` | Apply migrations to production D1 |
| `npm run cf:types` | Regenerate binding types from `wrangler.jsonc` |
| `npm run cf:build` / `cf:preview` / `cf:deploy` | OpenNext build / preview / deploy |
| `node scripts/generate-icons.mjs` | Rebuild favicon/OG/mark from the source logo |

---

## Cloudflare resources

Defined in [wrangler.jsonc](wrangler.jsonc):

- **`DB`** → D1 database `axonill` — relational data
- **`FILES`** → R2 bucket `axonill-files` — project file uploads

Both must exist in the Cloudflare account pinned by `account_id` in `wrangler.jsonc`. If
`wrangler d1 list` doesn't show `axonill`, you're logged into the wrong account — run
`npx wrangler login`.
