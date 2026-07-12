import { badRequest, filesBucket, json, newId, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — these are marketing images
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"];

/**
 * POST — admin-only image upload for CMS content (portfolio covers, team photos).
 *
 * multipart/form-data, field: `file`
 * Returns the R2 object key; store it in `portfolio_item.coverImage` /
 * `team_member.photoUrl`, and serve it back via GET /api/media/<key>.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Expected multipart/form-data");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("Missing `file` field");
  if (file.size === 0) return badRequest("File is empty");
  if (file.size > MAX_BYTES) {
    return badRequest(`Image exceeds the ${MAX_BYTES / 1024 / 1024}MB limit`);
  }
  if (!ALLOWED.includes(file.type)) {
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
  } catch (error) {
    console.error("CMS image upload failed", error);
    return badRequest("Upload failed");
  }

  return json({ key, url: `/api/media/${key}` }, 201);
}
