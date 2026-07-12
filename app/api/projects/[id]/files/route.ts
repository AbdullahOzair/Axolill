import { desc, eq } from "drizzle-orm";

import {
  badRequest,
  db,
  filesBucket,
  json,
  loadProject,
  newId,
  requireSession,
} from "@/lib/api";
import { projectFile } from "@/lib/db/schema";
import { safeFileName, uploadFileToR2 } from "@/lib/r2-upload";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET — list files for a project (owner or admin). */
export async function GET(_request: Request, { params }: Ctx) {
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
}

/**
 * POST — upload a file to R2 (multipart/form-data).
 *
 * fields: file (required), milestoneId (optional)
 *
 * The R2 object key is stored in ProjectFile.fileUrl; download it back through
 * GET /api/projects/[id]/files/[fileId].
 */
export async function POST(request: Request, { params }: Ctx) {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const found = await loadProject(id, auth.user);
  if (found instanceof Response) return found;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Expected multipart/form-data");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return badRequest("Missing `file` field");
  }

  const rawMilestoneId = form.get("milestoneId");
  const milestoneId =
    typeof rawMilestoneId === "string" && rawMilestoneId.length > 0
      ? rawMilestoneId
      : null;

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

    return json({ file: created }, 201);
  } catch (error) {
    // Don't leave an orphaned object behind if the DB row fails.
    console.error("DB insert failed after upload, rolling back R2", error);
    await filesBucket().delete(key);
    return badRequest("Could not record the upload");
  }
}
