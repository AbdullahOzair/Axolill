import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  badRequest,
  db,
  json,
  notFound,
  parseBody,
  requireSession,
  toDate,
} from "@/lib/api";
import { meeting } from "@/lib/db/schema";
import { createMeet } from "@/lib/meet-scheduler";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const patchMeeting = z.discriminatedUnion("action", [
  /** Admin: turn a `requested` meeting into a real Google Meet. */
  z.object({
    action: z.literal("confirm"),
    // Optional overrides — the admin may not accept the client's preferred slot.
    startsAt: z.iso.datetime({ local: true }).or(z.iso.datetime()).optional(),
    durationMinutes: z.number().int().min(5).max(480).default(30),
    timeZone: z.string().min(1).max(64).default("UTC"),
  }),
  /** Admin: turn down a request. */
  z.object({ action: z.literal("decline") }),
  /** Client: dismiss the "your meeting is confirmed" notice. */
  z.object({ action: z.literal("acknowledge") }),
]);

export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;

  const { id } = await params;

  const [found] = await db()
    .select()
    .from(meeting)
    .where(eq(meeting.id, id))
    .limit(1);

  // A client must not learn that another client's meeting exists.
  const isAdmin = auth.user.role === "admin";
  if (!found || (!isAdmin && found.clientId !== auth.user.id)) {
    return notFound("Meeting not found");
  }

  const body = await parseBody(request, patchMeeting);
  if (body instanceof Response) return body;

  /* ------------------------------ acknowledge ----------------------------- */

  if (body.action === "acknowledge") {
    // The client dismissing their own notice. Admins have no notice to dismiss.
    if (isAdmin) return badRequest("Only the client can acknowledge.");

    const [updated] = await db()
      .update(meeting)
      .set({ clientSeenAt: new Date(), updatedAt: new Date() })
      .where(eq(meeting.id, id))
      .returning();

    return json({ meeting: updated });
  }

  /* --------------------------- admin-only actions -------------------------- */

  if (!isAdmin) return notFound("Meeting not found");

  if (body.action === "decline") {
    const [updated] = await db()
      .update(meeting)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(meeting.id, id))
      .returning();

    return json({ meeting: updated });
  }

  /* -------------------------------- confirm -------------------------------- */

  if (found.status !== "requested") {
    return badRequest("Only a requested meeting can be confirmed.");
  }
  if (!found.clientId) {
    return badRequest("This request isn't linked to a client.");
  }

  const start = body.startsAt ? toDate(body.startsAt) : found.scheduledAt;
  if (Number.isNaN(start.getTime())) return badRequest("Invalid start time.");

  const meet = await createMeet({
    adminUserId: auth.user.id,
    summary: found.title,
    start,
    durationMinutes: body.durationMinutes,
    timeZone: body.timeZone,
    attendeeEmail: found.attendeeEmail,
  });
  if (!meet.ok) {
    return json({ error: meet.error, reason: meet.reason }, meet.status);
  }

  const now = new Date();
  const [updated] = await db()
    .update(meeting)
    .set({
      status: "scheduled",
      scheduledAt: start,
      meetingUrl: meet.meetingUrl,
      googleEventId: meet.eventId,
      provider: "google_meet",
      // Drives the in-portal notice; cleared of "seen" so it shows once.
      confirmedAt: now,
      clientSeenAt: null,
      updatedAt: now,
    })
    .where(eq(meeting.id, id))
    .returning();

  return json({ meeting: updated });
}
