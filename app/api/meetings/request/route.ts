import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  badRequest,
  db,
  json,
  newId,
  parseBody,
  requireSession,
  toDate,
} from "@/lib/api";
import { meeting, project } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const requestMeeting = z.object({
  title: z.string().min(1).max(200),
  projectId: z.string().min(1).nullable().optional(),
  /** The client's preferred slot — the admin can move it when confirming. */
  preferredAt: z.iso.datetime({ local: true }).or(z.iso.datetime()),
});

/** Stop a client from spamming open requests. */
const MAX_OPEN_REQUESTS = 3;

/**
 * POST — a client asks the agency for a call.
 *
 * Creates a `requested` meeting with NO meetingUrl. An admin confirms it in
 * /admin/meetings, which is what actually mints the Google Meet link.
 */
export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;

  const body = await parseBody(request, requestMeeting);
  if (body instanceof Response) return body;

  const start = toDate(body.preferredAt);
  if (Number.isNaN(start.getTime())) return badRequest("Invalid date/time.");
  if (start.getTime() < Date.now()) {
    return badRequest("Pick a time in the future.");
  }

  // A project, if named, must be the requester's own.
  if (body.projectId) {
    const [owned] = await db()
      .select({ clientId: project.clientId })
      .from(project)
      .where(eq(project.id, body.projectId))
      .limit(1);

    // Don't leak whether someone else's project exists.
    if (!owned || owned.clientId !== auth.user.id) {
      return badRequest("That project doesn't exist.");
    }
  }

  const open = await db()
    .select({ id: meeting.id })
    .from(meeting)
    .where(
      and(
        eq(meeting.clientId, auth.user.id),
        eq(meeting.status, "requested")
      )
    );

  if (open.length >= MAX_OPEN_REQUESTS) {
    return badRequest(
      "You already have a few pending requests. We'll confirm those first."
    );
  }

  const [created] = await db()
    .insert(meeting)
    .values({
      id: newId(),
      leadId: null,
      clientId: auth.user.id,
      projectId: body.projectId ?? null,
      title: body.title.trim(),
      // Identity comes from the session, never the request body.
      attendeeName: auth.user.name,
      attendeeEmail: auth.user.email,
      scheduledAt: start,
      meetingUrl: null,
      status: "requested",
      googleEventId: null,
      provider: "google_meet",
    })
    .returning();

  return json({ meeting: created }, 201);
}
