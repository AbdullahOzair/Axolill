import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { z } from "zod";

import { getServerSession } from "@/lib/auth";
import * as schema from "@/lib/db/schema";
import { boundedBody, JSON_BODY_LIMIT, PRIVATE_CACHE, sameOrigin, securityEvent } from "@/lib/http-security";

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
  Response.json(data, { status, headers: { "Cache-Control": PRIVATE_CACHE } });

export const badRequest = (message: string, details?: unknown) =>
  json({ error: message, details }, 400);

export const unauthorized = () =>
  json({ error: "Not signed in" }, 401);

export const forbidden = (message = "Forbidden") =>
  json({ error: message }, 403);

export const notFound = (message = "Not found") =>
  json({ error: message }, 404);

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
export async function requireSession(writeRequest?: Request): Promise<
  { user: SessionUser } | Response
> {
  const session = await getServerSession();
  if (!session) return unauthorized();
  if (writeRequest && !sameOrigin(writeRequest, getCloudflareContext().env.BETTER_AUTH_URL)) {
    securityEvent("mutation_origin_rejected", { actorId: session.user.id });
    return forbidden("Invalid request origin");
  }
  return { user: session.user as unknown as SessionUser };
}

export async function requireAdmin(writeRequest?: Request): Promise<
  { user: SessionUser } | Response
> {
  const result = await requireSession(writeRequest);
  if (result instanceof Response) return result;
  if (result.user.role !== "admin") {
    securityEvent("admin_access_denied", { actorId: result.user.id });
    return forbidden("Admins only");
  }
  return result;
}

export async function requireClient(writeRequest?: Request): Promise<
  { user: SessionUser } | Response
> {
  const result = await requireSession(writeRequest);
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
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "Expected application/json" }, 415);
  }

  let raw: unknown;
  try {
    const bytes = await boundedBody(request, JSON_BODY_LIMIT);
    if (bytes instanceof Response) return bytes;
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return badRequest("Body must be valid JSON");
  }
  const result = input.safeParse(raw);
  if (!result.success) {
    return badRequest("Validation failed", result.error.issues);
  }
  return result.data;
}

export async function parseMultipart(request: Request, limit: number) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    return json({ error: "Expected multipart/form-data" }, 415);
  }

  try {
    const bytes = await boundedBody(request, limit);
    if (bytes instanceof Response) return bytes;
    return await new Response(bytes, { headers: { "Content-Type": contentType } }).formData();
  } catch {
    return badRequest("Invalid multipart body");
  }
}

export function mutationJson<T>(user: SessionUser, action: string, data: T, status = 200) {
  if (user.role === "admin") {
    securityEvent("admin_mutation_succeeded", { action, actorId: user.id, status });
  }
  return json(data, status);
}

/* --------------------------------- misc ------------------------------------ */

export const newId = () => crypto.randomUUID();

/** Coerce an ISO date string to a Date (schema stores unix timestamps). */
export const toDate = (iso: string) => new Date(iso);
