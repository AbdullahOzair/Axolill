import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  db,
  json,
  loadProject,
  parseBody,
  requireAdmin,
  requireSession,
  toDate,
} from "@/lib/api";
import { project } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const updateProject = z
  .object({
    name: z.string().min(1).max(160),
    service: z.string().min(1).max(80),
    stage: z.enum([
      "discover",
      "research",
      "design",
      "develop",
      "test",
      "deploy",
      "support",
    ]),
    progress: z.number().int().min(0).max(100),
    budget: z.number().nonnegative(),
    startDate: z.iso.datetime().or(z.iso.date()),
    targetDate: z.iso.datetime().or(z.iso.date()),
  })
  .partial();

/** GET — owner or admin. */
export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const found = await loadProject(id, auth.user);
  if (found instanceof Response) return found;

  return json({ project: found });
}

/** PATCH — admin only. */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const found = await loadProject(id, auth.user);
  if (found instanceof Response) return found;

  const body = await parseBody(request, updateProject);
  if (body instanceof Response) return body;

  const { startDate, targetDate, ...rest } = body;

  const [updated] = await db()
    .update(project)
    .set({
      ...rest,
      ...(startDate ? { startDate: toDate(startDate) } : {}),
      ...(targetDate ? { targetDate: toDate(targetDate) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(project.id, id))
    .returning();

  return json({ project: updated });
}

/** DELETE — admin only. Cascades to milestones/files/invoices via FKs. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const found = await loadProject(id, auth.user);
  if (found instanceof Response) return found;

  await db().delete(project).where(eq(project.id, id));
  return json({ deleted: id });
}
