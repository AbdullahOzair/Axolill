import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  db,
  forbidden,
  json,
  loadProject,
  notFound,
  parseBody,
  requireAdmin,
  requireSession,
  toDate,
} from "@/lib/api";
import { milestone } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; milestoneId: string }> };

/**
 * Clients may ONLY move a milestone that is awaiting their approval into
 * `approved` or `changes_requested` — that's the portal's approve button.
 * Admins may set any field.
 */
const CLIENT_ALLOWED_STATUSES = ["approved", "changes_requested"] as const;

const patchMilestone = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000),
    status: z.enum([
      "pending",
      "in_progress",
      "awaiting_approval",
      "approved",
      "changes_requested",
    ]),
    dueDate: z.iso.datetime().or(z.iso.date()),
    order: z.number().int().min(0),
  })
  .partial();

export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;

  const { id, milestoneId } = await params;
  const found = await loadProject(id, auth.user);
  if (found instanceof Response) return found;

  const rows = await db()
    .select()
    .from(milestone)
    .where(and(eq(milestone.id, milestoneId), eq(milestone.projectId, id)))
    .limit(1);

  const existing = rows[0];
  if (!existing) return notFound("Milestone not found");

  const body = await parseBody(request, patchMilestone);
  if (body instanceof Response) return body;

  // Enforce the client approval rules.
  if (auth.user.role !== "admin") {
    const keys = Object.keys(body);
    const onlyStatus = keys.length === 1 && keys[0] === "status";
    const allowedTarget =
      body.status !== undefined &&
      (CLIENT_ALLOWED_STATUSES as readonly string[]).includes(body.status);

    if (!onlyStatus || !allowedTarget) {
      return forbidden(
        "Clients may only approve or request changes on a milestone"
      );
    }
    if (existing.status !== "awaiting_approval") {
      return forbidden("This milestone is not awaiting your approval");
    }
  }

  const { dueDate, ...rest } = body;

  const [updated] = await db()
    .update(milestone)
    .set({
      ...rest,
      ...(dueDate ? { dueDate: toDate(dueDate) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(milestone.id, milestoneId))
    .returning();

  return json({ milestone: updated });
}

/** DELETE — admin only. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const { id, milestoneId } = await params;
  const found = await loadProject(id, auth.user);
  if (found instanceof Response) return found;

  await db()
    .delete(milestone)
    .where(and(eq(milestone.id, milestoneId), eq(milestone.projectId, id)));

  return json({ deleted: milestoneId });
}
