import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { z } from "zod";

import { getServerSession } from "@/lib/auth";
import * as schema from "@/lib/db/schema";

/* --------------------------------- db/r2 ---------------------------------- */

/** Drizzle client bound to D1 — must be called inside a request. */
export function db() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}

/** R2 bucket for file uploads. */
export function filesBucket() {
  const { env } = getCloudflareContext();
  return env.FILES;
}

/* -------------------------------- responses -------------------------------- */

export const json = <T>(data: T, status = 200) =>
  Response.json(data, { status });

export const badRequest = (message: string, details?: unknown) =>
  Response.json({ error: message, details }, { status: 400 });

export const unauthorized = () =>
  Response.json({ error: "Not signed in" }, { status: 401 });

export const forbidden = (message = "Forbidden") =>
  Response.json({ error: message }, { status: 403 });

export const notFound = (message = "Not found") =>
  Response.json({ error: message }, { status: 404 });

/* --------------------------------- guards ---------------------------------- */

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "client" | "admin";
};

/**
 * API-flavoured guards. Unlike requireUser()/requireAdmin() in lib/auth.ts
 * (which redirect), these return a Response so route handlers can bail out.
 *
 * Usage:  const auth = await requireSession(); if (auth instanceof Response) return auth;
 */
export async function requireSession(): Promise<
  { user: SessionUser } | Response
> {
  const session = await getServerSession();
  if (!session) return unauthorized();
  return { user: session.user as unknown as SessionUser };
}

export async function requireAdmin(): Promise<
  { user: SessionUser } | Response
> {
  const result = await requireSession();
  if (result instanceof Response) return result;
  if (result.user.role !== "admin") {
    return forbidden("Admins only");
  }
  return result;
}

export async function requireClient(): Promise<
  { user: SessionUser } | Response
> {
  const result = await requireSession();
  if (result instanceof Response) return result;
  if (result.user.role !== "client") {
    return forbidden("Clients only");
  }
  return result;
}

/**
 * Load a project, enforcing ownership: admins can reach any project, clients
 * only their own. Returns a Response (404/403) if they can't.
 */
export async function loadProject(projectId: string, user: SessionUser) {
  const rows = await db()
    .select()
    .from(schema.project)
    .where(eq(schema.project.id, projectId))
    .limit(1);

  const found = rows[0];
  if (!found) return notFound("Project not found");
  if (user.role !== "admin" && found.clientId !== user.id) {
    // Don't leak existence to non-owners.
    return notFound("Project not found");
  }
  return found;
}

/* ------------------------------- validation -------------------------------- */

/** Parse+validate a JSON body. Returns a 400 Response on failure. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  input: S
): Promise<z.infer<S> | Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("Body must be valid JSON");
  }
  const result = input.safeParse(raw);
  if (!result.success) {
    return badRequest("Validation failed", result.error.issues);
  }
  return result.data;
}

/* --------------------------------- misc ------------------------------------ */

export const newId = () => crypto.randomUUID();

/** Coerce an ISO date string to a Date (schema stores unix timestamps). */
export const toDate = (iso: string) => new Date(iso);
