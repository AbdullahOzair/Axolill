import { and, eq } from "drizzle-orm";

import {
  db,
  filesBucket,
  json,
  loadProject,
  notFound,
  requireAdmin,
  requireSession,
} from "@/lib/api";
import { projectFile } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

async function findFile(projectId: string, fileId: string) {
  const rows = await db()
    .select()
    .from(projectFile)
    .where(
      and(eq(projectFile.id, fileId), eq(projectFile.projectId, projectId))
    )
    .limit(1);
  return rows[0];
}

/** GET — stream the object out of R2 (owner or admin). */
export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;

  const { id, fileId } = await params;
  const project = await loadProject(id, auth.user);
  if (project instanceof Response) return project;

  const record = await findFile(id, fileId);
  if (!record) return notFound("File not found");

  const object = await filesBucket().get(record.fileUrl);
  if (!object) return notFound("File missing from storage");

  // NOTE: don't use object.writeHttpMetadata(headers) here — it rejects Next's
  // Headers instance (different realm). Set the fields explicitly instead.
  const headers = new Headers();
  headers.set(
    "content-type",
    object.httpMetadata?.contentType ?? "application/octet-stream"
  );
  headers.set("etag", object.httpEtag);
  headers.set(
    "content-disposition",
    `attachment; filename="${encodeURIComponent(record.name)}"`
  );
  // Private file — never let a shared cache hold it.
  headers.set("cache-control", "private, no-store");

  return new Response(object.body, { headers });
}

/** DELETE — admin only. Removes the R2 object and the row. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const { id, fileId } = await params;
  const project = await loadProject(id, auth.user);
  if (project instanceof Response) return project;

  const record = await findFile(id, fileId);
  if (!record) return notFound("File not found");

  await filesBucket().delete(record.fileUrl);
  await db().delete(projectFile).where(eq(projectFile.id, fileId));

  return json({ deleted: fileId });
}
