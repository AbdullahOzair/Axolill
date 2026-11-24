import { badRequest, filesBucket, mutationJson, newId, parseMultipart, requireAdmin } from "@/lib/api";
import { CMS_IMAGE_MAX_BYTES as MAX_BYTES, matchesCmsImageType } from "@/lib/cms-image";
import { securityEvent, withApiErrors } from "@/lib/http-security";

export const dynamic = "force-dynamic";

/**
 * POST — admin-only image upload for CMS content (portfolio covers, team photos).
 *
 * multipart/form-data, field: `file`
 * Returns the R2 object key; store it in `portfolio_item.coverImage` /
 * `team_member.photoUrl`, and serve it back via GET /api/media/<key>.
 */
export const POST = withApiErrors("POST /api/media", async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const form = await parseMultipart(request, MAX_BYTES + 64 * 1024);
  if (form instanceof Response) return form;

  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("Missing `file` field");
  if (file.size === 0) return badRequest("File is empty");
  if (file.size > MAX_BYTES) {
    return badRequest(`Image exceeds the ${MAX_BYTES / 1024 / 1024}MB limit`);
  }
  if (!(await matchesCmsImageType(file))) {
    return badRequest("Only PNG, JPEG, WebP, AVIF or GIF images are allowed");
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 100);
  const key = `cms/${newId()}-${safeName}`;

  try {
    // R2 needs a body of known length — File.stream() is length-unknown in
    // workerd, so buffer it (safe under the 5MB cap).
    const bytes = await file.arrayBuffer();

    await filesBucket().put(key, bytes, {
      httpMetadata: { contentType: file.type },
      customMetadata: { uploadedBy: auth.user.id },
    });
  } catch {
    securityEvent("cms_upload_failed", { actorId: auth.user.id });
    return badRequest("Upload failed");
  }

  return mutationJson(auth.user, "POST /api/media", { key, url: `/api/media/${key}` }, 201);
});
