import { filesBucket, notFound } from "@/lib/api";

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
export async function GET(_request: Request, { params }: Ctx) {
  const { key: segments } = await params;
  const key = segments.join("/");

  if (!key.startsWith("cms/")) {
    return notFound("Not found");
  }

  const object = await filesBucket().get(key);
  if (!object) return notFound("Image not found");

  const headers = new Headers();
  headers.set(
    "content-type",
    object.httpMetadata?.contentType ?? "application/octet-stream"
  );
  headers.set("etag", object.httpEtag);
  // Public, immutable — the key changes whenever the image is replaced.
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}
