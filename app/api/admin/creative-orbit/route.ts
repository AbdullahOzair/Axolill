import { sql } from "drizzle-orm";

import { badRequest, db, json, mutationJson, newId, parseBody, requireAdmin } from "@/lib/api";
import { ORBIT_LIMIT, orbitImageSchema, orbitOrderSchema, orbitSettingsSchema } from "@/lib/creative-orbit";
import { isOrbitImage, ORBIT_SETTINGS_ID, readCreativeOrbit } from "@/lib/creative-orbit-server";
import { creativeOrbitSettings } from "@/lib/db/schema";
import { withApiErrors } from "@/lib/http-security";

export const dynamic = "force-dynamic";

export const GET = withApiErrors("GET admin creative orbit", async () => {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  return json(await readCreativeOrbit(true));
});

export const POST = withApiErrors("POST admin creative orbit", async (request: Request) => {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, orbitImageSchema);
  if (body instanceof Response) return body;
  if (!(await isOrbitImage(body.imageKey))) return badRequest("Upload a supported image first.");

  const id = newId();
  // Check the capacity and allocate display order in the same write.
  const created = await db().get<{ id: string }>(sql`
    INSERT INTO creative_orbit_image (id, imageKey, title, alt, active, displayOrder)
    SELECT ${id}, ${body.imageKey}, ${body.title || null}, ${body.alt}, ${Number(body.active)},
      COALESCE(MAX(displayOrder), -1) + 1
    FROM creative_orbit_image
    HAVING COUNT(*) < ${ORBIT_LIMIT}
    RETURNING id
  `);
  if (!created) return json({ error: `The orbit already has ${ORBIT_LIMIT} images.` }, 409);
  return mutationJson(auth.user, "creative-orbit.create", created, 201);
});

export const PUT = withApiErrors("PUT admin creative orbit order", async (request: Request) => {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, orbitOrderSchema);
  if (body instanceof Response) return body;

  // Reject stale lists without partially reordering the remaining rows.
  const updated = await db().all<{ id: string }>(sql`
    WITH requested AS (SELECT CAST(key AS INTEGER) AS position, value AS id FROM json_each(${JSON.stringify(body.ids)}))
    UPDATE creative_orbit_image
    SET displayOrder = (SELECT position FROM requested WHERE requested.id = creative_orbit_image.id),
      updatedAt = unixepoch()
    WHERE (SELECT COUNT(*) FROM creative_orbit_image) = ${body.ids.length}
      AND (SELECT COUNT(*) FROM requested JOIN creative_orbit_image USING (id)) = ${body.ids.length}
    RETURNING id
  `);
  if (!updated.length) return json({ error: "The image list changed. Refresh and reorder it again." }, 409);
  return mutationJson(auth.user, "creative-orbit.reorder", { ok: true });
});

export const PATCH = withApiErrors("PATCH admin creative orbit settings", async (request: Request) => {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, orbitSettingsSchema);
  if (body instanceof Response) return body;
  await db().insert(creativeOrbitSettings).values({ id: ORBIT_SETTINGS_ID, ...body })
    .onConflictDoUpdate({ target: creativeOrbitSettings.id, set: body });
  return mutationJson(auth.user, "creative-orbit.settings", { ok: true });
});
