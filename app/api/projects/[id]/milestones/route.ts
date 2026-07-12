import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  db,
  json,
  loadProject,
  newId,
  parseBody,
  requireAdmin,
  requireSession,
  toDate,
} from "@/lib/api";
import { milestone } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const createMilestone = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z
    .enum([
      "pending",
      "in_progress",
      "awaiting_approval",
      "approved",
      "changes_requested",
    ])
    .optional(),
  dueDate: z.iso.datetime().or(z.iso.date()),
  order: z.number().int().min(0).optional(),
});

/** GET — owner or admin. Ordered by `order`, as the portal checklist expects. */
export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const found = await loadProject(id, auth.user);
  if (found instanceof Response) return found;

  const rows = await db()
    .select()
    .from(milestone)
    .where(eq(milestone.projectId, id))
    .orderBy(asc(milestone.order));

  return json({ milestones: rows });
}

/** POST — admin only. */
export async function POST(request: Request, { params }: Ctx) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const found = await loadProject(id, auth.user);
  if (found instanceof Response) return found;

  const body = await parseBody(request, createMilestone);
  if (body instanceof Response) return body;

  const [created] = await db()
    .insert(milestone)
    .values({
      id: newId(),
      projectId: id,
      title: body.title,
      description: body.description ?? "",
      status: body.status ?? "pending",
      dueDate: toDate(body.dueDate),
      order: body.order ?? 0,
    })
    .returning();

  return json({ milestone: created }, 201);
}
