import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { badRequest, db, json, mutationJson, notFound, parseBody, requireAdmin } from "@/lib/api";
import { inquiry, meeting } from "@/lib/db/schema";
import { securityEvent, withApiErrors } from "@/lib/http-security";
import { baseInquiries } from "@/lib/inquiry-admin";
import { createMeet, rollbackMeet } from "@/lib/meet-scheduler";

export const dynamic = "force-dynamic";
const schedule = z.object({
  title: z.string().trim().min(1).max(200),
  startsAt: z.iso.datetime({ offset: true }),
  durationMinutes: z.number().int().min(5).max(480),
  timeZone: z.string().max(64).refine((zone) => {
    try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; }
    catch { return false; }
  }),
}).strict();

export const POST = withApiErrors("POST inquiry meeting", async function POST(
  request: Request, context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, schedule);
  if (body instanceof Response) return body;
  const start = new Date(body.startsAt);
  if (start.getTime() <= Date.now()) return badRequest("Pick a future time.");

  const { id } = await context.params;
  const current = await baseInquiries().where(eq(inquiry.id, id)).get();
  if (!current) return notFound("Inquiry not found");
  const database = db();
  const meetingId = "inquiry-" + id + "-" + Math.floor(start.getTime() / 1000);
  const getMeeting = () => database.select().from(meeting).where(and(eq(meeting.id, meetingId), eq(meeting.leadId, id))).get();
  const existing = await getMeeting();
  if (existing) return existing.status === "scheduled" ? json({ meetingId }) : json({ error: "A meeting already exists for this time." }, 409);

  const result = await createMeet({
    adminUserId: auth.user.id,
    attendeeEmail: current.email,
    summary: body.title,
    start,
    durationMinutes: body.durationMinutes,
    timeZone: body.timeZone,
    checkAvailability: current.source === "portal_workspace",
  });
  if (!result.ok) return json({ error: result.error }, result.status);

  try {
    const d1 = getCloudflareContext().env.DB;
    const event = crypto.randomUUID();
    const writes = await d1.batch([
      d1.prepare(`insert into meeting (id,leadId,clientId,projectId,title,attendeeName,attendeeEmail,scheduledAt,meetingUrl,googleEventId,calendarOwnerId,durationMinutes,confirmedAt,provider,status)
        select ?,i.id,coalesce(i.convertedClientId,l.clientId),i.convertedProjectId,?,l.name,l.email,?,?,?,?,?,unixepoch(),'google_meet','scheduled'
        from inquiry i join lead l on l.id=i.id where i.id=?`)
        .bind(meetingId, body.title, Math.floor(start.getTime() / 1000), result.meetingUrl, result.eventId, auth.user.id, body.durationMinutes, id),
      d1.prepare(`insert into inquiry_activity (id,inquiryId,kind,previousStage,newStage,description,adminId)
        select ?,id,'meeting',stage,case when stage in ('new','contacted','qualified') then 'meeting' else stage end,
        'Scheduled a Google Meet consultation.',? from inquiry where id=?`).bind(event, auth.user.id, id),
      d1.prepare(`update inquiry set stage='meeting',version=version+1 where id=?
        and stage in ('new','contacted','qualified')`).bind(id),
      d1.prepare(`update lead set updatedAt=unixepoch(),
        status=case when (select stage from inquiry where id=?)='meeting' then 'qualified' else status end where id=?`).bind(id, id),
    ]);
    if (!writes[0].meta.changes) throw new Error("Inquiry meeting could not be recorded.");
  } catch (error) {
    await rollbackMeet(result.accessToken, result.eventId).catch(() => securityEvent("inquiry_calendar_rollback_failed"));
    const saved = await getMeeting();
    if (saved) return json({ meetingId });
    throw error;
  }
  return mutationJson(auth.user, "inquiry.meeting", { meetingId }, 201);
});
