import { eq } from "drizzle-orm";

import { badRequest, db, mutationJson, notFound, parseBody, requireAdmin } from "@/lib/api";
import { orbitImageSchema } from "@/lib/creative-orbit";
import { isOrbitImage } from "@/lib/creative-orbit-server";
import { creativeOrbitImage } from "@/lib/db/schema";
import { withApiErrors } from "@/lib/http-security";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const PATCH = withApiErrors("PATCH admin creative orbit image", async (request: Request, context: Context) => {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, orbitImageSchema.partial().refine((value) => Object.keys(value).length > 0));
  if (body instanceof Response) return body;
  if (body.imageKey && !(await isOrbitImage(body.imageKey))) return badRequest("Upload a supported image first.");
  const { id } = await context.params;
  const [updated] = await db().update(creativeOrbitImage).set({ ...body, updatedAt: new Date() })
    .where(eq(creativeOrbitImage.id, id)).returning({ id: creativeOrbitImage.id });
  if (!updated) return notFound("Orbit image not found");
  return mutationJson(auth.user, "creative-orbit.update", { ok: true });
});

export const DELETE = withApiErrors("DELETE admin creative orbit image", async (request: Request, context: Context) => {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const [deleted] = await db().delete(creativeOrbitImage)
    .where(eq(creativeOrbitImage.id, id)).returning({ id: creativeOrbitImage.id });
  if (!deleted) return notFound("Orbit image not found");
  return mutationJson(auth.user, "creative-orbit.delete", { ok: true });
});
