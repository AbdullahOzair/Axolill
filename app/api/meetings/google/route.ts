import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  badRequest,
  db,
  json,
  newId,
  parseBody,
  requireAdmin,
} from "@/lib/api";
import { meeting, project, user } from "@/lib/db/schema";
import { createMeet, rollbackMeet } from "@/lib/meet-scheduler";

export const dynamic = "force-dynamic";

const scheduleMeet = z.object({
  clientId: z.string().min(1),
  projectId: z.string().min(1).nullable().optional(),
  title: z.string().min(1).max(200),
  /** Local wall-clock start, e.g. "2026-08-14T15:30" — interpreted in timeZone. */
  startsAt: z.iso.datetime({ local: true }).or(z.iso.datetime()),
  durationMinutes: z.number().int().min(5).max(480),
  timeZone: z.string().min(1).max(64).default("UTC"),
  description: z.string().max(2000).optional(),
});

/**
 * POST — admin only. Creates a Google Calendar event with a Meet link and
 * records it as a `meeting` row (provider = "google_meet").
 *
 * Because the row carries clientId/projectId, the client sees it in /portal
 * without any extra step.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const body = await parseBody(request, scheduleMeet);
  if (body instanceof Response) return body;

  // The attendee is the client — look them up rather than trusting the caller.
  const [client] = await db()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
    .from(user)
    .where(eq(user.id, body.clientId))
    .limit(1);

  if (!client || client.role !== "client") {
    return badRequest("That client doesn't exist.");
  }

  // A project, if given, must actually belong to that client — otherwise the
  // meeting would surface on the wrong client's portal.
  if (body.projectId) {
    const [owned] = await db()
      .select({ clientId: project.clientId })
      .from(project)
      .where(eq(project.id, body.projectId))
      .limit(1);

    if (!owned) return badRequest("That project doesn't exist.");
    if (owned.clientId !== client.id) {
      return badRequest("That project belongs to a different client.");
    }
  }

  const start = new Date(body.startsAt);
  if (Number.isNaN(start.getTime())) return badRequest("Invalid start time.");

  const meet = await createMeet({
    adminUserId: auth.user.id,
    summary: body.title,
    description: body.description,
    start,
    durationMinutes: body.durationMinutes,
    timeZone: body.timeZone,
    attendeeEmail: client.email,
  });
  if (!meet.ok) {
    return json({ error: meet.error, reason: meet.reason }, meet.status);
  }

  try {
    const [created] = await db()
      .insert(meeting)
      .values({
        id: newId(),
        leadId: null,
        clientId: client.id,
        projectId: body.projectId ?? null,
        title: body.title,
        attendeeName: client.name,
        attendeeEmail: client.email,
        scheduledAt: start,
        meetingUrl: meet.meetingUrl,
        status: "scheduled",
        googleEventId: meet.eventId,
        provider: "google_meet",
      })
      .returning();

    return json({ meeting: created }, 201);
  } catch (error) {
    // The event exists at Google but we can't record it — roll it back rather
    // than leave a Meet on the calendar that the app has no knowledge of.
    console.error("[google-calendar] persist failed, rolling back event", error);
    await rollbackMeet(meet.accessToken, meet.eventId);
    return json(
      { error: "Couldn't save the meeting. The calendar event was removed." },
      500
    );
  }
}
