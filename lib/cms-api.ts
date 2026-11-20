import "server-only";

import { asc, eq } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { z } from "zod";

import {
  db,
  json,
  mutationJson,
  newId,
  notFound,
  parseBody,
  requireAdmin,
} from "@/lib/api";
import { getServerSession } from "@/lib/auth";
import { withApiErrors } from "@/lib/http-security";

/**
 * Shared CRUD for the CMS tables (service, technology, portfolio_item,
 * team_member). Encodes the same contract as /api/testimonials:
 *
 *   GET     public — published only. Admins additionally see drafts.
 *   POST    admin  — zod-validated.
 *   PATCH   admin  — partial, zod-validated.
 *   DELETE  admin
 *
 * Rows are always returned ordered by `order` ascending.
 */

/** The shape every CMS table shares. */
type CmsTable = SQLiteTable & {
  id: SQLiteColumn;
  order: SQLiteColumn;
  published: SQLiteColumn;
  updatedAt: SQLiteColumn;
};

export function collectionRoute<S extends z.ZodType>(opts: {
  table: CmsTable;
  createSchema: S;
  /** Response keys, e.g. { list: "services", item: "service" }. */
  listKey: string;
  itemKey: string;
  /** Map a validated body to column values (fill defaults here). */
  toValues: (body: z.infer<S>) => Record<string, unknown>;
}) {
  async function GET() {
    const session = await getServerSession();
    const isAdmin = session?.user?.role === "admin";

    const base = db().select().from(opts.table);

    // Drafts are hidden from the public site; admins see everything.
    const rows = isAdmin
      ? await base.orderBy(asc(opts.table.order))
      : await base
          .where(eq(opts.table.published, true))
          .orderBy(asc(opts.table.order));

    return json({ [opts.listKey]: rows });
  }

  async function POST(request: Request) {
    const auth = await requireAdmin(request);
    if (auth instanceof Response) return auth;

    const body = await parseBody(request, opts.createSchema);
    if (body instanceof Response) return body;

    const [created] = await db()
      .insert(opts.table)
      .values({ id: newId(), ...opts.toValues(body) })
      .returning();

    return mutationJson(auth.user, "cms." + opts.itemKey + ".POST", { [opts.itemKey]: created }, 201);
  }

  return {
    GET: withApiErrors(`cms.${opts.itemKey}.GET`, GET),
    POST: withApiErrors(`cms.${opts.itemKey}.POST`, POST),
  };
}

export function itemRoute<S extends z.ZodType>(opts: {
  table: CmsTable;
  patchSchema: S;
  itemKey: string;
  /** Map a validated partial body to column values. */
  toValues: (body: z.infer<S>) => Record<string, unknown>;
}) {
  type Ctx = { params: Promise<{ id: string }> };

  async function PATCH(request: Request, { params }: Ctx) {
    const auth = await requireAdmin(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    const body = await parseBody(request, opts.patchSchema);
    if (body instanceof Response) return body;

    const values = opts.toValues(body);
    if (Object.keys(values).length === 0) {
      return notFound("Nothing to update");
    }

    const [updated] = await db()
      .update(opts.table)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(opts.table.id, id))
      .returning();

    if (!updated) return notFound("Not found");
    return mutationJson(auth.user, "cms." + opts.itemKey + ".PATCH", { [opts.itemKey]: updated });
  }

  async function DELETE(request: Request, { params }: Ctx) {
    const auth = await requireAdmin(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    const [deleted] = await db()
      .delete(opts.table)
      .where(eq(opts.table.id, id))
      .returning();

    if (!deleted) return notFound("Not found");
    return mutationJson(auth.user, "cms." + opts.itemKey + ".DELETE", { deleted: id });
  }

  return {
    PATCH: withApiErrors(`cms.${opts.itemKey}.PATCH`, PATCH),
    DELETE: withApiErrors(`cms.${opts.itemKey}.DELETE`, DELETE),
  };
}

/** Strips undefined keys so a PATCH only touches the fields that were sent. */
export function definedOnly(obj: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}
