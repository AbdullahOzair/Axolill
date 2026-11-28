import { withApiErrors } from "@/lib/http-security";
import { limitEndpoint } from "@/lib/rate-limit";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { badRequest, db, json, mutationJson, newId, notFound, parseBody, requireSession, toDate } from "@/lib/api";
import { meeting } from "@/lib/db/schema";
import { createMeet, rescheduleMeet, rollbackMeet } from "@/lib/meet-scheduler";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
const dateTime = z.iso.datetime({ local: true }).or(z.iso.datetime());
const patchMeeting = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), startsAt: dateTime.optional(), durationMinutes: z.number().int().min(5).max(480).default(30), timeZone: z.string().min(1).max(64).default("UTC") }),
  z.object({ action: z.enum(["acknowledge", "decline", "cancel"]) }),
  z.object({ action: z.literal("reschedule"), startsAt: dateTime }),
]);

export const PATCH = withApiErrors("PATCH /api/meetings/[id]", async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const database = db();
  const found = await database.select().from(meeting).where(eq(meeting.id, id)).get();
  const isAdmin = auth.user.role === "admin";
  if (!found || (!isAdmin && found.clientId !== auth.user.id)) return notFound("Meeting not found");
  const body = await parseBody(request, patchMeeting);
  if (body instanceof Response) return body;
  const unlocked = sql`(${meeting.confirmationLock} is null or ${meeting.confirmationLockedAt} < unixepoch()-120)`;
  const record = and(eq(meeting.id, id), eq(meeting.status, found.status), unlocked);
  const conflict = () => json({ error: "This meeting changed, or its time overlaps another meeting. Refresh and choose another slot." }, 409);

  if (body.action === "acknowledge") {
    if (isAdmin) return badRequest("Only the client can acknowledge.");
    const [updated] = await database.update(meeting).set({ clientSeenAt: new Date() }).where(eq(meeting.id, id)).returning();
    return json({ meeting: updated });
  }

  if (body.action === "cancel" || body.action === "decline") {
    if ((body.action === "decline") !== isAdmin) return notFound("Meeting not found");
    if (found.status !== "requested" && !found.requestedChangeAt) return badRequest("Only pending requests may be cancelled here.");
    const [updated] = await database.update(meeting).set({
      status: found.status === "requested" ? "cancelled" : found.status,
      requestedChangeAt: null, updatedAt: new Date(),
    }).where(record).returning();
    return updated ? mutationJson(auth.user, "meeting.request.cancel", { meeting: updated }) : conflict();
  }

  if (body.action === "reschedule") {
    if (isAdmin || (found.status !== "requested" && !(found.status === "scheduled" && found.scheduledAt.getTime() > Date.now() &&
      found.provider === "google_meet" && found.googleEventId))) return badRequest("This meeting cannot be rescheduled here.");
    const limited = await limitEndpoint(request, "meeting_request", auth.user.id);
    if (limited) return limited;
    const start = toDate(body.startsAt);
    if (!(start.getTime() > Date.now())) return badRequest("Choose a future date and time.");
    const timestamp = Math.floor(start.getTime() / 1000);
    if (timestamp === Math.floor(found.scheduledAt.getTime() / 1000) || timestamp === (found.requestedChangeAt?.getTime() ?? 0) / 1000)
      return badRequest("Choose a different time.");
    const [saved] = await database.update(meeting).set({
      ...(found.status === "requested" ? { scheduledAt: start } : { requestedChangeAt: start }), updatedAt: new Date(),
    }).where(and(record, sql`not exists(select 1 from meeting existing where existing.id!=${id}
      and existing.clientId=${auth.user.id} and existing.status in ('requested','scheduled')
      and existing.scheduledAt < ${timestamp + found.durationMinutes * 60}
      and existing.scheduledAt+existing.durationMinutes*60>${timestamp})`)).returning();
    return saved ? mutationJson(auth.user, "meeting.reschedule.request", { meeting: saved }) : conflict();
  }

  if (!isAdmin || body.action !== "confirm") return notFound("Meeting not found");
  const moving = found.status === "scheduled" && found.requestedChangeAt && found.googleEventId && found.provider === "google_meet";
  if ((!moving && found.status !== "requested") || !found.clientId) return badRequest("Select a pending meeting request.");
  const start = body.startsAt ? toDate(body.startsAt) : found.requestedChangeAt ?? found.scheduledAt;
  if (!(start.getTime() > Date.now())) return badRequest("Choose a future time before confirming.");
  const organizer = found.calendarOwnerId ?? auth.user.id;
  if (moving && organizer !== auth.user.id) return badRequest("The calendar owner must confirm this change.");
  const timestamp = Math.floor(start.getTime() / 1000);
  const lock = newId();
  const [claimed] = await database.update(meeting).set({ confirmationLock: lock, confirmationLockedAt: sql`unixepoch()` })
    .where(and(record, found.requestedChangeAt ? eq(meeting.requestedChangeAt, found.requestedChangeAt) : isNull(meeting.requestedChangeAt),
      sql`not exists(select 1 from meeting existing where existing.id!=${id}
        and (existing.status='scheduled' and (existing.clientId=${found.clientId} or existing.calendarOwnerId=${organizer})
        and existing.scheduledAt<${timestamp + body.durationMinutes * 60}
        and existing.scheduledAt+existing.durationMinutes*60>${timestamp}
        or existing.confirmationLock is not null and existing.confirmationLockedAt>=unixepoch()-120))`)).returning({ id: meeting.id });
  if (!claimed) return conflict();
  const locked = and(eq(meeting.id, id), eq(meeting.confirmationLock, lock));
  let created: { accessToken: string; eventId: string } | undefined;
  try {
    let googleEventId = found.googleEventId;
    let meetingUrl = found.meetingUrl;
    if (moving && googleEventId) {
      const result = await rescheduleMeet(organizer, googleEventId, start, body.durationMinutes, body.timeZone);
      if (!result.ok) return json({ error: result.error, reason: result.reason }, result.status);
    } else {
      const result = await createMeet({ adminUserId: organizer, summary: found.title, start, durationMinutes: body.durationMinutes,
        timeZone: body.timeZone, attendeeEmail: found.attendeeEmail, checkAvailability: true });
      if (!result.ok) return json({ error: result.error, reason: result.reason }, result.status);
      googleEventId = result.eventId;
      meetingUrl = result.meetingUrl;
      created = result;
    }
    const now = new Date();
    const [updated] = await database.update(meeting).set({
      status: "scheduled", scheduledAt: start, meetingUrl, googleEventId, durationMinutes: body.durationMinutes, calendarOwnerId: organizer,
      requestedChangeAt: null, provider: "google_meet", confirmedAt: now, clientSeenAt: null, updatedAt: now,
      confirmationLock: null, confirmationLockedAt: null,
    }).where(locked).returning();
    if (!updated) return conflict();
    created = undefined;
    return mutationJson(auth.user, moving ? "meeting.reschedule.confirm" : "meeting.confirm", { meeting: updated });
  } finally {
    if (created) await rollbackMeet(created.accessToken, created.eventId);
    await database.update(meeting).set({ confirmationLock: null, confirmationLockedAt: null }).where(locked).run();
  }
});
