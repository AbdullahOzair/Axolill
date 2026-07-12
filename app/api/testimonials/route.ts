import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  db,
  json,
  newId,
  parseBody,
  requireAdmin,
} from "@/lib/api";
import { getServerSession } from "@/lib/auth";
import { testimonial } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const createTestimonial = z.object({
  name: z.string().min(1).max(120),
  role: z.string().max(160).optional(),
  quote: z.string().min(1).max(2000),
  rating: z.number().int().min(1).max(5).optional(),
  published: z.boolean().optional(),
});

/**
 * GET — public. Anonymous callers get only published testimonials (what the
 * marketing carousel renders); admins get everything, including drafts.
 */
export async function GET() {
  const session = await getServerSession();
  const isAdmin = session?.user?.role === "admin";

  const base = db().select().from(testimonial);

  const rows = isAdmin
    ? await base.orderBy(desc(testimonial.createdAt))
    : await base
        .where(eq(testimonial.published, true))
        .orderBy(desc(testimonial.createdAt));

  return json({ testimonials: rows });
}

/** POST — admin only. Unpublished by default. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const body = await parseBody(request, createTestimonial);
  if (body instanceof Response) return body;

  const [created] = await db()
    .insert(testimonial)
    .values({
      id: newId(),
      name: body.name,
      role: body.role ?? null,
      quote: body.quote,
      rating: body.rating ?? 5,
      published: body.published ?? false,
    })
    .returning();

  return json({ testimonial: created }, 201);
}
