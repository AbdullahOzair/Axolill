# Axonill

_Innovating Digital Experiences._ — marketing site + client portal, deployed to Cloudflare Workers.

- **Next.js 16** (App Router) · React 19 · TypeScript · **Tailwind v4** · shadcn/ui · framer-motion
- **Cloudflare D1** (SQLite) + **R2** (file uploads), via **Drizzle ORM**
- **better-auth** — email/password + Google OAuth
- Deployed with **@opennextjs/cloudflare**

See [CLAUDE.md](CLAUDE.md) for the brand/design system and [DATA_MODEL.md](DATA_MODEL.md)
for the entity model.

---

## Getting started

Use Node.js 22 or newer with the current Wrangler and Next.js versions.

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
| `GOOGLE_CALENDAR_TOKEN_KEY` | Optional AES-256 key for encrypting Calendar grants. Generate 32 random bytes and encode them as 64 hexadecimal characters. |
| `NEXT_PUBLIC_CAL_LINK` | The Cal.com event embedded at `/portal/book` (in `.env.local`) |
| `NEXT_PUBLIC_SITE_URL` | Canonical public URL used for site metadata |

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
# Create or promote an admin and generate a password
npm run create-admin -- you@axonill.com --name "Your Name"

# Rotate an existing production admin password after approval
npm run create-admin -- you@axonill.com --rotate-password --remote
```

- New admins and promoted clients receive a generated password, displayed once in the operator’s terminal. Store it in the approved password manager.
- Promotion and password rotation revoke old sessions, pending MFA sign-ins, and trusted devices. Existing admin accounts keep their password unless rotation is requested.
- Admins can enable an authenticator under **Settings → Security** and save the single-use recovery codes. If both the device and codes are lost, an authorized operator can use `--reset-mfa` to clear enrollment, rotate the password, and revoke sessions. Re-enroll immediately after recovery.

They then sign in at **`/admin/login`** (no signup link, no Google button). A client who tries
those credentials there is rejected with "This account doesn't have admin access."

It uses Drizzle to build the statements (type-safe against `lib/db/schema.ts`) and runs them
through `wrangler d1 execute`, so it works against both databases with the wrangler auth you
already have — no extra API token. Source: [scripts/create-admin.ts](scripts/create-admin.ts).

Google sign-in stays available for clients. Google linking requires a verified local email and a verified Google identity. An unlinked, unverified password account can still use password sign-in. Admins use password sign-in, with an authenticator or recovery code after enrollment.

---

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server (Turbopack), with Cloudflare bindings |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run test:security` | Run security regression tests |
| `npm run create-admin -- <email> [--rotate-password] [--remote]` | Create, promote, or recover administrator access |
| `npm run db:generate` | Generate a migration from `lib/db/schema.ts` |
| `npm run db:migrate:local` | Apply migrations to local D1 |
| `npm run db:migrate:remote` | Apply migrations to production D1 |
| `npm run cf:types` | Regenerate binding types from `wrangler.jsonc` |
| `npm run cf:build` / `cf:preview` / `cf:deploy` | OpenNext build / preview / deploy |
| `node scripts/generate-icons.mjs` | Rebuild favicon/OG/mark from the source logo |

---

## Security rollout

1. **Before deploying**, confirm the active Worker version, record its deployment ID, and take a D1 backup or Time Travel bookmark. Review **Google Search Console → Security issues** for affected URLs. Inspect those URLs, redirects, CMS content, and Worker changes. Rotate previously exposed credentials through an approved operator and investigate recent admin sign-ins and mutations.
2. **Validate in local or staging Cloudflare.** Apply the D1 migrations, build with `npm run cf:build`, and preview the Worker. Check the homepage, CMS data, signup, Google sign-in, admin password and authenticator sign-in, recovery codes, lead intake and attachment downloads, Calendar, and the signed Cal.com webhook. Check that signed-out API access returns 401, unauthorized role access returns 403, and private responses are uncached.
3. **Verify Google configuration.** For the canonical HTTPS origin in `BETTER_AUTH_URL`, register both exact callback paths in the Google OAuth client: `/api/auth/callback/google` and `/api/admin/google-calendar/callback`. Test the Calendar grant with an approved account. Calendar consent links already open when the new Worker goes live must be restarted.
4. **Configure the Cloudflare edge.** In **SSL/TLS → Edge Certificates**, enable **Always Use HTTPS** and verify the HTTP-to-HTTPS redirect. Enable HSTS after confirming HTTPS for every hostname its policy will cover. Use **Full (strict)** for any separately proxied origin, and restrict direct origin access where applicable. In **Security → Security rules**, enable the managed rules available on the plan and observe matches before tightening. Apply bot protection to public forms and sign-in where appropriate, while allowing Google callbacks and signed Cal.com webhooks. Review whether the `workers.dev` alias is needed and close it separately if unused.
5. **Check cache and CSP.** Verify that Cloudflare cache rules respect the application’s private responses and public media policy. The application sends a report-only CSP and separate enforced anti-framing and MIME-sniffing headers. Inspect CSP messages in the browser across Next.js hydration, theme switching, Google Maps, and Cal.com. Add tested hashes or nonces for framework and application scripts before enforcing CSP. Assign each header to a single layer to avoid conflicts.
6. **Deploy with explicit approval.** Apply `0004_admin_two_factor.sql` through the production D1 migration command before deploying the new Worker. The migration adds a table and a disabled-by-default flag. Run the post-deploy smoke checks again on the real HTTPS origin and verify cookie flags and security headers in the browser.
7. **Enable Calendar encryption after the Worker is stable.** Add `GOOGLE_CALENDAR_TOKEN_KEY` through the Worker secret store. New and refreshed grants are encrypted, and legacy grants remain readable until refreshed or reconnected. Keep the key available to every Worker version that reads encrypted rows. Roll back application code to the prior validated version if needed, keeping the additive schema in place. After enabling encryption, roll back only to a Worker that can decrypt those rows, or reconnect the affected Calendars under an approved recovery plan.
8. **Monitor and resolve the browser warning.** In Cloudflare Workers observability, filter structured events for `component=security`. Review repeated rate limits, rejected origins, MFA changes, Calendar failures, and privileged mutations. Invocation logging is disabled so OAuth callback query strings stay out of Worker request logs. Configure alerts through the team’s monitoring sink. When flagged URLs are fixed and verified, request a review in Search Console.

The Worker rate bindings are `AUTH_RATE_LIMITER` and `CONTACT_RATE_LIMITER`. The first allows 15 authentication requests per minute per source IP. The second allows five contact submissions per minute per IP and five intake or meeting requests per minute per account for each action. Limits are approximate per Cloudflare location. Confirm the namespace IDs are unique in the account before deployment. Portal intake accepts up to eight attachments, 25 MiB per file and 30 MiB total.

For a repeatable Workerd check, run `npm run cf:build`, then `node tests/cloudflare-security.mjs --prepare`. Use the resulting directory path in `npx wrangler dev --local --config "<directory>/wrangler.json" --persist-to "<directory>/.wrangler/state" --port 8791`. In another terminal set `AXONILL_TEST_FIXTURE` to that directory and run `node tests/cloudflare-security.mjs`. The test uses synthetic accounts and isolated D1 and R2 storage.

### Hardening changes by file

- **Authentication and admin recovery** changed `lib/auth.ts`, `lib/auth-client.ts`, `lib/auth-redirect.ts`, `app/api/auth/[...all]/route.ts`, `components/auth/auth-form.tsx`, `components/auth/admin-login-form.tsx`, `app/admin/(dashboard)/settings/security/page.tsx`, `components/admin/security-settings.tsx`, `components/admin/admin-sidebar.tsx`, and `scripts/create-admin.ts` for constrained redirects, role checks, optional MFA, and session revocation.
- **D1 schema** changed `lib/db/schema.ts`, `drizzle/0004_admin_two_factor.sql`, `drizzle/meta/0004_snapshot.json`, and `drizzle/meta/_journal.json` to store authenticator enrollment and recovery state.
- **Shared API protections** changed `lib/api.ts`, `lib/cms-api.ts`, `lib/http-security.ts`, `lib/rate-limit.ts`, `lib/cms-image.ts`, and `lib/r2-upload.ts` for origin checks, bounded parsing, rate limits, response cache policy, image signatures, and redacted logs.
- **Lead, invoice, CMS, and project endpoints** applied those protections in `app/api/admin/leads/[id]/route.ts`, `app/api/clients/route.ts`, `app/api/contact/route.ts`, `app/api/invoices/route.ts`, `app/api/invoices/[id]/route.ts`, `app/api/media/route.ts`, `app/api/media/[...key]/route.ts`, `app/api/portal/intake/route.ts`, `app/api/projects/route.ts`, `app/api/projects/[id]/route.ts`, `app/api/projects/[id]/files/route.ts`, `app/api/projects/[id]/files/[fileId]/route.ts`, `app/api/projects/[id]/milestones/route.ts`, `app/api/projects/[id]/milestones/[milestoneId]/route.ts`, `app/api/testimonials/route.ts`, and `app/api/testimonials/[id]/route.ts`. The other CMS collections inherit the shared changes through `lib/cms-api.ts`.
- **Calendar and meetings** changed `app/api/admin/google-calendar/route.ts`, `app/api/admin/google-calendar/connect/route.ts`, `app/api/admin/google-calendar/callback/route.ts`, `app/api/meetings/route.ts`, `app/api/meetings/[id]/route.ts`, `app/api/meetings/google/route.ts`, `app/api/meetings/request/route.ts`, `lib/google-calendar.ts`, `lib/google-calendar-token.ts`, `lib/calendar-token-crypto.ts`, `lib/meet-scheduler.ts`, and `lib/meeting-link.ts` for browser-bound OAuth state, token encryption, and safe links and webhook handling.
- **Build and deployment** changed `package.json`, `package-lock.json`, `eslint.config.mjs`, `tsconfig.json`, `next.config.ts`, `open-next.config.ts`, `wrangler.jsonc`, `cloudflare-env.d.ts`, `worker-configuration.d.ts`, `.dev.vars.example`, `CLAUDE.md`, and `README.md` for supported dependencies, headers, Worker bindings, and rollout instructions. `tests/security.test.ts` and `tests/cloudflare-security.mjs` cover the repository and Worker checks.

---

## Cloudflare resources

Defined in [wrangler.jsonc](wrangler.jsonc):

- **`DB`** → D1 database `axonill` — relational data
- **`FILES`** → R2 bucket `axonill-files` — project file uploads

Both must exist in the Cloudflare account pinned by `account_id` in `wrangler.jsonc`. If
`wrangler d1 list` doesn't show `axonill`, you're logged into the wrong account — run
`npx wrangler login`.
