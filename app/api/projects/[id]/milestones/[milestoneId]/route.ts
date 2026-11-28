import { withApiErrors } from "@/lib/http-security";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  db,
  forbidden,
  json,
  mutationJson,
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

export const PATCH = withApiErrors("PATCH /api/projects/[id]/milestones/[milestoneId]", async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireSession(request);
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
  const isAdmin = auth.user.role === "admin";

  // Enforce the client approval rules.
  if (!isAdmin) {
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
    .where(and(
      eq(milestone.id, milestoneId),
      eq(milestone.projectId, id),
      isAdmin ? undefined : eq(milestone.status, "awaiting_approval")
    ))
    .returning();

  if (!updated) return json({ error: "The milestone changed. Refresh and try again." }, 409);
  return mutationJson(auth.user, "PATCH /api/projects/[id]/milestones/[milestoneId]", { milestone: updated });
});

/** DELETE — admin only. */
export const DELETE = withApiErrors("DELETE /api/projects/[id]/milestones/[milestoneId]", async function DELETE(request: Request, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { id, milestoneId } = await params;
  const found = await loadProject(id, auth.user);
  if (found instanceof Response) return found;

  await db()
    .delete(milestone)
    .where(and(eq(milestone.id, milestoneId), eq(milestone.projectId, id)));

  return mutationJson(auth.user, "DELETE /api/projects/[id]/milestones/[milestoneId]", { deleted: milestoneId });
});
