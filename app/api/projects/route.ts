import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  db,
  json,
  newId,
  parseBody,
  requireAdmin,
  requireSession,
  toDate,
} from "@/lib/api";
import { project } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const STAGES = [
  "discover",
  "research",
  "design",
  "develop",
  "test",
  "deploy",
  "support",
] as const;

const createProject = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1).max(160),
  service: z.string().min(1).max(80),
  stage: z.enum(STAGES).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  budget: z.number().nonnegative().optional(),
  startDate: z.iso.datetime().or(z.iso.date()),
  targetDate: z.iso.datetime().or(z.iso.date()),
});

/** GET — admins see every project; clients see only their own. */
export async function GET() {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;

  const query = db().select().from(project);
  const rows =
    auth.user.role === "admin"
      ? await query.orderBy(desc(project.createdAt))
      : await query
          .where(eq(project.clientId, auth.user.id))
          .orderBy(desc(project.createdAt));

  return json({ projects: rows });
}

/** POST — admin only. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const body = await parseBody(request, createProject);
  if (body instanceof Response) return body;

  const [created] = await db()
    .insert(project)
    .values({
      id: newId(),
      clientId: body.clientId,
      name: body.name,
      service: body.service,
      stage: body.stage ?? "discover",
      progress: body.progress ?? 0,
      budget: body.budget ?? 0,
      startDate: toDate(body.startDate),
      targetDate: toDate(body.targetDate),
    })
    .returning();

  return json({ project: created }, 201);
}
