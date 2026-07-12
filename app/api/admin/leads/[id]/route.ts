import { eq } from "drizzle-orm";

import { db, json, notFound, requireAdmin } from "@/lib/api";
import * as schema from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/leads/[id]
 *
 * Admin-only. Returns the lead, its linked client (User) if present, and all
 * LeadAttachment rows so the detail panel can render them without a second
 * fetch.
 */
export async function GET(
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
}

/**
 * PATCH /api/admin/leads/[id]
 *
 * Admin-only. Currently supports a single action: `{ status }` update.
 * Used by "Convert to Project" to mark the lead as "won".
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const { id } = await params;

  let body: { status?: string };
  try {
    body = (await req.json()) as { status?: string };
  } catch {
    body = {};
  }

  const validStatuses = ["new", "contacted", "qualified", "won", "lost"] as const;
  type LeadStatus = (typeof validStatuses)[number];

  if (
    body.status !== undefined &&
    !validStatuses.includes(body.status as LeadStatus)
  ) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  const rows = await db()
    .update(schema.lead)
    .set({
      ...(body.status ? { status: body.status as LeadStatus } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.lead.id, id))
    .returning();

  if (!rows[0]) return notFound("Lead not found");
  return json({ lead: rows[0] });
}
