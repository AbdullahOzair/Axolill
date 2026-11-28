import { and, desc, eq, sql } from "drizzle-orm";

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
import { limitEndpoint } from "@/lib/rate-limit";
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
    .where(and(eq(projectFile.projectId, id), auth.user.role === "admin" ? undefined : eq(projectFile.clientVisible, true)))
    .orderBy(desc(projectFile.createdAt));

  return json({ files: auth.user.role === "admin" ? rows : rows.map(({ fileUrl, uploadedBy, ...record }) => { void fileUrl; void uploadedBy; return record; }) });
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

  const limited = auth.user.role === "client" ? await limitEndpoint(request, "portal_upload", auth.user.id) : null;
  if (limited) return limited;
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

  if (auth.user.role === "client" && milestoneId) return badRequest("Clients can upload project reference files.");
  const folder = auth.user.role === "client" ? "Client uploads" : String(form.get("folder") || (milestoneId ? "Milestone deliverables" : "Project documents")).trim();
  if (!folder || folder.length > 100) return badRequest("Enter a folder name up to 100 characters.");
  const clientVisible = auth.user.role === "client" || form.get("visibility") !== "internal";
  const previousId = auth.user.role === "admin" ? String(form.get("previousVersionId") ?? "") || null : null;
  if (previousId && !await db().select({ id: projectFile.id }).from(projectFile).where(and(
    eq(projectFile.id, previousId), eq(projectFile.projectId, id), eq(projectFile.clientVisible, clientVisible),
    milestoneId ? eq(projectFile.milestoneId, milestoneId) : sql`${projectFile.milestoneId} is null`)).get())
    return badRequest("Choose a previous file in the same milestone and visibility.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const safeType = starts(37,80,68,70,45) ? "application/pdf" :
    starts(137,80,78,71,13,10,26,10) ? "image/png" : starts(255,216,255) ? "image/jpeg" :
    starts(82,73,70,70) && bytes[8]===87 && bytes[9]===69 && bytes[10]===66 && bytes[11]===80 ? "image/webp" : null;
  if (auth.user.role === "client" && !safeType) return badRequest("Upload a valid PDF, PNG, JPEG, or WebP file.");
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
        folder, clientVisible, fileType: safeType ?? "application/octet-stream", fileSize: uploaded.sizeBytes, previousVersionId: previousId,
      })
      .returning();

    const { fileUrl, uploadedBy, ...safe } = created;
    void fileUrl;
    void uploadedBy;
    return mutationJson(auth.user, "POST /api/projects/[id]/files", { file: auth.user.role === "admin" ? created : safe }, 201);
  } catch {
    // Don't leave an orphaned object behind if the DB row fails.
    securityEvent("project_upload_record_failed", { actorId: auth.user.id });
    await filesBucket().delete(key).catch(() => securityEvent("project_upload_cleanup_failed"));
    return badRequest("Could not record the upload");
  }
});
