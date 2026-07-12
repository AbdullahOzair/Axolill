import { z } from "zod";

import { badRequest, db, json, newId, parseBody, requireAdmin } from "@/lib/api";
import { lead } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Public — the marketing contact form posts here. Creates a Lead. */
const createLead = z.object({
  name: z.string().min(1).max(120),
  email: z.email(),
  company: z.string().max(160).optional(),
  service: z.string().max(80).optional(),
  budgetRange: z.string().max(40).optional(),
  message: z.string().min(1).max(5000),
  source: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  const body = await parseBody(request, createLead);
  if (body instanceof Response) return body;

  const row = {
    id: newId(),
    name: body.name,
    email: body.email,
    company: body.company ?? null,
    service: body.service ?? null,
    budgetRange: body.budgetRange ?? null,
    message: body.message,
    // status defaults to "new" in the schema
    source: body.source ?? "Website",
  };

  try {
    const [created] = await db().insert(lead).values(row).returning();
    return json({ lead: created }, 201);
  } catch (error) {
    console.error("POST /api/contact failed", error);
    return badRequest("Could not save your message");
  }
}

/** Admin-only — the /admin leads table reads this. */
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const rows = await db()
    .select()
    .from(lead)
    .orderBy(desc(lead.createdAt));

  return json({ leads: rows });
}
