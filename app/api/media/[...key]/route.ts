import { eq } from "drizzle-orm";
import { db, filesBucket, notFound, requireAdmin } from "@/lib/api";
import { isCmsImageType } from "@/lib/cms-image";
import { leadAttachment } from "@/lib/db/schema";
import { PRIVATE_CACHE, withApiErrors } from "@/lib/http-security";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ key: string[] }> };

/**
 * GET — public. Streams a CMS image out of R2.
 *
 * These are marketing assets (portfolio covers, team photos) shown on the
 * public homepage, so this is intentionally unauthenticated — unlike the
 * private project files at /api/projects/[id]/files/[fileId].
 *
 * Only the `cms/` prefix is served, so this can't be used to read private
 * project uploads (which live under `projects/`).
 */
export const GET = withApiErrors("GET /api/media/[...key]", async function GET(_request: Request, { params }: Ctx) {
  const { key: segments } = await params;
  const key = segments.join("/");

  if (key.startsWith("leads/")) {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const [attachment] = await db()
      .select({ name: leadAttachment.name })
      .from(leadAttachment)
      .where(eq(leadAttachment.r2Key, key))
      .limit(1);
    if (!attachment) return notFound("Attachment not found");

    const object = await filesBucket().get(key);
    if (!object) return notFound("Attachment not found");
    return new Response(object.body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.name)}"`,
        "Cache-Control": PRIVATE_CACHE,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (!key.startsWith("cms/")) {
    return notFound("Not found");
  }

  const object = await filesBucket().get(key);
  if (!object) return notFound("Image not found");

  const contentType = object.httpMetadata?.contentType ?? "";
  if (!isCmsImageType(contentType)) return notFound("Image not found");

  const headers = new Headers();
  headers.set("content-type", contentType);
  headers.set("x-content-type-options", "nosniff");
  headers.set("etag", object.httpEtag);
  // Public, immutable — the key changes whenever the image is replaced.
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
});
