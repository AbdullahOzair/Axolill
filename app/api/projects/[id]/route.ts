import { withApiErrors } from "@/lib/http-security";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  db,
  json,
  mutationJson,
  loadProject,
  parseBody,
  requireAdmin,
  requireSession,
  toDate,
} from "@/lib/api";
import { project } from "@/lib/db/schema";
import { recordLegacyProjectUpdate } from "@/lib/active-project-api";

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
export const GET = withApiErrors("GET /api/projects/[id]", async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const found = await loadProject(id, auth.user);
  if (found instanceof Response) return found;

  return json({ project: found });
});

/** PATCH — admin only. */
export const PATCH = withApiErrors("PATCH /api/projects/[id]", async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireAdmin(request);
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

  await recordLegacyProjectUpdate(found, auth.user.id, body);
  return mutationJson(auth.user, "PATCH /api/projects/[id]", { project: updated });
});

/** DELETE — admin only. Cascades to milestones/files/invoices via FKs. */
export const DELETE = withApiErrors("DELETE /api/projects/[id]", async function DELETE(request: Request, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const found = await loadProject(id, auth.user);
  if (found instanceof Response) return found;

  await db().delete(project).where(eq(project.id, id));
  return mutationJson(auth.user, "DELETE /api/projects/[id]", { deleted: id });
});
