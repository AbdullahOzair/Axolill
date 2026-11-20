import { and, desc, eq } from "drizzle-orm";

import {
  badRequest,
  db,
  filesBucket,
  json,
  mutationJson,
  loadProject,
  newId,
  notFound,
  parseMultipart,
  requireSession,
} from "@/lib/api";
import { milestone, projectFile } from "@/lib/db/schema";
import { MAX_UPLOAD_BYTES, safeFileName, uploadFileToR2 } from "@/lib/r2-upload";
import { securityEvent, withApiErrors } from "@/lib/http-security";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET — list files for a project (owner or admin). */
export const GET = withApiErrors("GET /api/projects/[id]/files", async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const found = await loadProject(id, auth.user);
  if (found instanceof Response) return found;

  const rows = await db()
    .select()
    .from(projectFile)
    .where(eq(projectFile.projectId, id))
    .orderBy(desc(projectFile.createdAt));

  return json({ files: rows });
});

/**
 * POST — upload a file to R2 (multipart/form-data).
 *
 * fields: file (required), milestoneId (optional)
 *
 * The R2 object key is stored in ProjectFile.fileUrl; download it back through
 * GET /api/projects/[id]/files/[fileId].
 */
export const POST = withApiErrors("POST /api/projects/[id]/files", async function POST(request: Request, { params }: Ctx) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const found = await loadProject(id, auth.user);
  if (found instanceof Response) return found;

  const form = await parseMultipart(request, MAX_UPLOAD_BYTES + 64 * 1024);
  if (form instanceof Response) return form;

  const file = form.get("file");
  if (!(file instanceof File)) {
    return badRequest("Missing `file` field");
  }

  const rawMilestoneId = form.get("milestoneId");
  const milestoneId =
    typeof rawMilestoneId === "string" && rawMilestoneId.length > 0
      ? rawMilestoneId
      : null;
  if (milestoneId) {
    const [linked] = await db()
      .select({ id: milestone.id })
      .from(milestone)
      .where(and(eq(milestone.id, milestoneId), eq(milestone.projectId, id)))
      .limit(1);
    if (!linked) return notFound("Milestone not found");
  }

  const fileId = newId();
  const key = `projects/${id}/${fileId}-${safeFileName(file.name)}`;

  const uploaded = await uploadFileToR2(file, key, {
    projectId: id,
    uploadedBy: auth.user.id,
  });
  if (uploaded instanceof Response) return uploaded;

  try {
    const [created] = await db()
      .insert(projectFile)
      .values({
        id: fileId,
        projectId: id,
        milestoneId,
        name: file.name,
        fileUrl: key, // R2 object key
        uploadedBy: auth.user.id,
      })
      .returning();

    return mutationJson(auth.user, "POST /api/projects/[id]/files", { file: created }, 201);
  } catch {
    // Don't leave an orphaned object behind if the DB row fails.
    securityEvent("project_upload_record_failed", { actorId: auth.user.id });
    await filesBucket().delete(key).catch(() => securityEvent("project_upload_cleanup_failed"));
    return badRequest("Could not record the upload");
  }
});
