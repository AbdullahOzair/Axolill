import { withApiErrors } from "@/lib/http-security";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  db,
  mutationJson,
  notFound,
  parseBody,
  requireAdmin,
} from "@/lib/api";
import { testimonial } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const patchTestimonial = z
  .object({
    name: z.string().min(1).max(120),
    role: z.string().max(160),
    quote: z.string().min(1).max(2000),
    rating: z.number().int().min(1).max(5),
    published: z.boolean(), // the publish/unpublish toggle
  })
  .partial();

/** PATCH — admin only (e.g. toggle `published`). */
export const PATCH = withApiErrors("PATCH /api/testimonials/[id]", async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await parseBody(request, patchTestimonial);
  if (body instanceof Response) return body;

  const [updated] = await db()
    .update(testimonial)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(testimonial.id, id))
    .returning();

  if (!updated) return notFound("Testimonial not found");
  return mutationJson(auth.user, "PATCH /api/testimonials/[id]", { testimonial: updated });
});

/** DELETE — admin only. */
export const DELETE = withApiErrors("DELETE /api/testimonials/[id]", async function DELETE(request: Request, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const [deleted] = await db()
    .delete(testimonial)
    .where(eq(testimonial.id, id))
    .returning();

  if (!deleted) return notFound("Testimonial not found");
  return mutationJson(auth.user, "DELETE /api/testimonials/[id]", { deleted: id });
});
