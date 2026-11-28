import { withApiErrors } from "@/lib/http-security";
import { and, eq, sql } from "drizzle-orm";

import {
  db,
  filesBucket,
  mutationJson,
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
export const GET = withApiErrors("GET /api/projects/[id]/files/[fileId]", async function GET(request: Request, { params }: Ctx) {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;

  const { id, fileId } = await params;
  const project = await loadProject(id, auth.user);
  if (project instanceof Response) return project;

  const record = await findFile(id, fileId);
  if (!record || (!record.clientVisible && auth.user.role !== "admin")) return notFound("File not found");

  const object = await filesBucket().get(record.fileUrl);
  if (!object) return notFound("File missing from storage");

  // NOTE: don't use object.writeHttpMetadata(headers) here — it rejects Next's
  // Headers instance (different realm). Set the fields explicitly instead.
  const headers = new Headers();
  const preview = new URL(request.url).searchParams.get("preview") === "1" &&
    ["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(record.fileType ?? "");
  headers.set("content-type", preview ? record.fileType! : "application/octet-stream");
  if (preview) headers.set("content-security-policy", "sandbox; default-src 'none'");
  headers.set("x-content-type-options", "nosniff");
  headers.set("etag", object.httpEtag);
  headers.set(
    "content-disposition",
    `${preview ? "inline" : "attachment"}; filename="${encodeURIComponent(record.name)}"`
  );
  // Private file — never let a shared cache hold it.
  headers.set("cache-control", "private, no-store");

  return new Response(object.body, { headers });
});

/** DELETE — admin only. Removes the R2 object and the row. */
export const DELETE = withApiErrors("DELETE /api/projects/[id]/files/[fileId]", async function DELETE(request: Request, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { id, fileId } = await params;
  const project = await loadProject(id, auth.user);
  if (project instanceof Response) return project;

  const record = await findFile(id, fileId);
  if (!record) return notFound("File not found");

  const [removed] = await db().delete(projectFile).where(and(eq(projectFile.projectId, id), eq(projectFile.id, fileId),
    sql`not exists(select 1 from project_file where previousVersionId=${fileId})`,
    sql`not exists(select 1 from project_workspace_entry where projectId=${id} and (json_extract(data,'$.fileId')=${fileId}
      or exists(select 1 from json_each(data,'$.files') where value=${fileId})))`)).returning({ key: projectFile.fileUrl });
  if (!removed) return new Response(JSON.stringify({ error: "This file is part of the project history." }), { status: 409, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
  await filesBucket().delete(removed.key);
  return mutationJson(auth.user, "DELETE /api/projects/[id]/files/[fileId]", { deleted: fileId });
});
