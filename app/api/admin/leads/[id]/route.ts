import { withApiErrors } from "@/lib/http-security";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, json, mutationJson, notFound, parseBody, requireAdmin } from "@/lib/api";
import * as schema from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/leads/[id]
 *
 * Admin-only. Returns the lead, its linked client (User) if present, and all
 * LeadAttachment rows so the detail panel can render them without a second
 * fetch.
 */
export const GET = withApiErrors("GET /api/admin/leads/[id]", async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const { id } = await params;

  // Fetch the lead row.
  const leads = await db()
    .select()
    .from(schema.lead)
    .where(eq(schema.lead.id, id))
    .limit(1);

  const lead = leads[0];
  if (!lead) return notFound("Lead not found");

  // Fetch the linked client (nullable).
  let client: schema.User | null = null;
  if (lead.clientId) {
    const users = await db()
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, lead.clientId))
      .limit(1);
    client = users[0] ?? null;
  }

  // Fetch all attachments for this lead.
  const attachments = await db()
    .select()
    .from(schema.leadAttachment)
    .where(eq(schema.leadAttachment.leadId, id))
    .orderBy(schema.leadAttachment.createdAt);

  return json({ lead, client, attachments });
});

/**
 * PATCH /api/admin/leads/[id]
 *
 * Admin-only. Currently supports a single action: `{ status }` update.
 * Used by "Convert to Project" to mark the lead as "won".
 */
export const PATCH = withApiErrors("PATCH /api/admin/leads/[id]", async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  const body = await parseBody(request, z.object({
    status: z.enum(["new", "contacted", "qualified", "won", "lost"]),
  }));
  if (body instanceof Response) return body;

  const rows = await db()
    .update(schema.lead)
    .set({
      status: body.status,
      updatedAt: new Date(),
    })
    .where(eq(schema.lead.id, id))
    .returning();

  if (!rows[0]) return notFound("Lead not found");
  return mutationJson(auth.user, "PATCH /api/admin/leads/[id]", { lead: rows[0] });
});
