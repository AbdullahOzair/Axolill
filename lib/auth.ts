import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";

import { account, session, user, verification } from "@/lib/db/schema";
import * as schema from "@/lib/db/schema";

/**
 * better-auth must be constructed **per request**: the D1 binding only exists
 * inside a request context on Cloudflare, so a module-level singleton would
 * capture a stale (or missing) binding. `cache()` dedupes it within a single
 * request without leaking across requests.
 */
export const getAuth = cache(() => {
  const { env } = getCloudflareContext();
  const db = drizzle(env.DB, { schema });

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      // Map better-auth's models onto our Drizzle tables.
      schema: { user, session, account, verification },
    }),

    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },

    // Extra columns we added to the `user` table (from DATA_MODEL.md).
    // `input: false` on role stops clients from self-assigning admin.
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "client",
          input: false,
        },
        company: { type: "string", required: false },
        phone: { type: "string", required: false },
      },
    },

    /*
     * NOTE: there is deliberately NO admin bootstrap hook here.
     *
     * The website can never create an admin. Signup (email/password AND Google)
     * always produces role="client" — `role` is `input: false` above, so a client
     * cannot self-assign it either.
     *
     * Admins exist only via the CLI:  npm run create-admin
     * and sign in at the dedicated /admin/login (no signup, no Google).
     */
  });
});

export type Session = Awaited<
  ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>
>;

/**
 * Returns the current session, or null if signed out.
 *
 * `headers()` is awaited FIRST on purpose: it marks the route dynamic, so Next
 * bails out of static prerendering before we ever touch getCloudflareContext()
 * (which throws if called in a static route).
 */
export const getServerSession = cache(async () => {
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
});

/** Require any signed-in user, else bounce to /login. */
export async function requireUser(returnTo = "/portal") {
  const session = await getServerSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }
  return session;
}

/**
 * Require an admin.
 *  - signed out        -> /admin/login (NOT the client /login: no signup, no Google)
 *  - signed in, client -> /portal
 */
export async function requireAdmin(returnTo = "/admin") {
  const session = await getServerSession();

  if (!session) {
    redirect(`/admin/login?next=${encodeURIComponent(returnTo)}`);
  }
  if (session.user.role !== "admin") {
    redirect("/portal");
  }
  return session;
}
