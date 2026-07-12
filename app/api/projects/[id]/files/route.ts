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

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

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
  if (file.size === 0) return badRequest("File is empty");
  if (file.size > MAX_BYTES) {
    return badRequest(`File exceeds the ${MAX_BYTES / 1024 / 1024}MB limit`);
  }

  const rawMilestoneId = form.get("milestoneId");
  const milestoneId =
    typeof rawMilestoneId === "string" && rawMilestoneId.length > 0
      ? rawMilestoneId
      : null;

  const fileId = newId();
  // Sanitise the name — it lands in an object key.
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const key = `projects/${id}/${fileId}-${safeName}`;

  try {
    // R2 requires a body of known length. `file.stream()` is length-unknown in
    // workerd, so buffer it — safe because uploads are capped at MAX_BYTES.
    const bytes = await file.arrayBuffer();

    await filesBucket().put(key, bytes, {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
      },
      customMetadata: {
        projectId: id,
        uploadedBy: auth.user.id,
      },
    });
  } catch (error) {
    console.error("R2 upload failed", error);
    return badRequest("Upload failed");
  }

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
