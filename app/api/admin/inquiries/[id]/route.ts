import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { badRequest, db, json, mutationJson, notFound, parseBody, requireAdmin } from "@/lib/api";
import { inquiryActivity, inquiryNote, teamMember } from "@/lib/db/schema";
import { withApiErrors } from "@/lib/http-security";
import { baseInquiries, inquireDetail } from "@/lib/inquiry-admin";
import { STAGE_LABELS } from "@/lib/inquiries";
import { inquiryUpdate } from "@/lib/inquiry-validation";
import { inquiry } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export const GET = withApiErrors("GET inquiry detail", async function GET(_request: Request, context: Context) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const detail = await inquireDetail((await context.params).id);
  return detail ? json(detail) : notFound("Inquiry not found");
});

const adminAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), changes: inquiryUpdate }).strict(),
  z.object({ action: z.literal("note"), content: z.string().trim().min(1).max(4000) }).strict(),
]);

export const PATCH = withApiErrors("PATCH inquiry", async function PATCH(request: Request, context: Context) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, adminAction);
  if (body instanceof Response) return body;

  const { id } = await context.params;
  const current = await baseInquiries().where(eq(inquiry.id, id)).get();
  if (!current) return notFound("Inquiry not found");
  if (body.action === "note") {
    const database = db();
    await database.batch([
      database.insert(inquiryNote).values({ id: crypto.randomUUID(), inquiryId: id, adminId: auth.user.id, content: body.content }),
      database.insert(inquiryActivity).values({
        id: crypto.randomUUID(), inquiryId: id, kind: "note", description: "Added an internal note.", adminId: auth.user.id,
      }),
    ]);
    return mutationJson(auth.user, "inquiry.note", { ok: true }, 201);
  }

  const changes = body.changes;
  const stage = changes.stage ?? current.stage;
  const stageChanged = stage !== current.stage;
  if (current.stage === "converted" && stageChanged) return badRequest("A converted inquiry stays linked to its client.");
  const reason = stage === "lost" ? changes.lostReason ?? current.lostReason : null;
  if (stage === "lost" && !reason) return badRequest("Enter a reason for marking this inquiry lost.");

  const assignee = changes.assigneeId === undefined ? current.assigneeId : changes.assigneeId;
  if (assignee && changes.assigneeId !== undefined && !(await db().select({ id: teamMember.id })
    .from(teamMember).where(eq(teamMember.id, assignee)).get())) return badRequest("Select an existing team member.");

  const followUp = changes.followUpAt === undefined ? current.followUpAt : changes.followUpAt ? new Date(changes.followUpAt) : null;
  const priority = changes.priority ?? current.priority;
  const updatedFields = [
    stageChanged ? "Moved from " + STAGE_LABELS[current.stage] + " to " + STAGE_LABELS[stage] + "." : "",
    current.priority !== priority ? "Priority set to " + priority + "." : "",
    current.assigneeId !== assignee ? (assignee ? "Updated team assignment." : "Cleared team assignment.") : "",
    current.followUpAt?.getTime() !== followUp?.getTime() ? (followUp ? "Updated the follow-up date." : "Cleared the follow-up date.") : "",
    reason !== current.lostReason ? "Updated the lost reason." : "",
  ].filter(Boolean);

  if (!updatedFields.length) return json({ ok: true });
  const event = crypto.randomUUID();
  const legacyStage = { new: "new", contacted: "contacted", qualified: "qualified", meeting: "qualified",
    proposal: "qualified", negotiation: "qualified", converted: "won", lost: "lost" }[stage];
  const d1 = getCloudflareContext().env.DB;
  const result = await d1.batch([
    d1.prepare(`insert into inquiry_activity (id,inquiryId,kind,previousStage,newStage,description,adminId)
      select ?,id,?,?,?,?,? from inquiry where id=? and version=?`)
      .bind(event, stageChanged ? "stage" : "update", current.stage, stage, updatedFields.join(" "), auth.user.id, id, current.version),
    d1.prepare(`update inquiry set stage=?,priority=?,assigneeId=?,followUpAt=?,lostReason=?,version=version+1
      where id=? and version=?`)
      .bind(stage, priority, assignee, followUp ? Math.floor(followUp.getTime() / 1000) : null, reason, id, current.version),
    d1.prepare(`update lead set status=?,updatedAt=unixepoch() where id=? and exists(select 1 from inquiry_activity where id=?)`)
      .bind(legacyStage, id, event),
  ]);
  if (!result[1].meta.changes) return json({ error: "This inquiry changed. Refresh and try again." }, 409);
  return mutationJson(auth.user, "inquiry.update", { ok: true });
});
