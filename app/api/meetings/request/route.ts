import { withApiErrors } from "@/lib/http-security";
import { limitEndpoint } from "@/lib/rate-limit";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  badRequest,
  db,
  json,
  mutationJson,
  newId,
  parseBody,
  requireSession,
  toDate,
} from "@/lib/api";
import { meeting, project } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const requestMeeting = z.object({
  title: z.string().trim().min(1).max(200),
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
export const POST = withApiErrors("POST /api/meetings/request", async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;
  const limited = await limitEndpoint(request, "meeting_request", auth.user.id);
  if (limited) return limited;

  const body = await parseBody(request, requestMeeting);
  if (body instanceof Response) return body;

  const start = toDate(body.preferredAt);
  if (Number.isNaN(start.getTime())) return badRequest("Invalid date/time.");
  if (start.getTime() < Date.now()) {
    return badRequest("Pick a time in the future.");
  }

  const database = db();
  // A project, if named, must be the requester's own.
  if (body.projectId) {
    const [owned] = await database
      .select({ clientId: project.clientId })
      .from(project)
      .where(eq(project.id, body.projectId))
      .limit(1);

    // Don't leak whether someone else's project exists.
    if (!owned || owned.clientId !== auth.user.id) {
      return badRequest("That project doesn't exist.");
    }
  }

  const projectId = body.projectId ?? null;
  const scheduledAt = Math.floor(start.getTime() / 1000);
  const pending = and(eq(meeting.clientId, auth.user.id), eq(meeting.status, "requested"));
  const matching = and(
    eq(meeting.clientId, auth.user.id),
    eq(meeting.provider, "google_meet"),
    sql`${meeting.status} in ('requested', 'scheduled')`,
    sql`${meeting.projectId} is ${projectId}`,
    sql`${meeting.scheduledAt} = ${scheduledAt}`,
    sql`lower(trim(${meeting.title})) = lower(${body.title})`,
  );

  // D1 evaluates both guards in the same write, including concurrent requests.
  const inserted = await database.get<{ id: string }>(sql`
    insert into ${meeting} ("id", "clientId", "projectId", "title", "attendeeName",
      "attendeeEmail", "scheduledAt", "status", "provider")
    select ${newId()}, ${auth.user.id}, ${projectId}, ${body.title}, ${auth.user.name},
      ${auth.user.email}, ${scheduledAt}, 'requested', 'google_meet'
    where not exists (select 1 from ${meeting} where ${matching})
      and (select count(*) from ${meeting} where ${pending}) < ${MAX_OPEN_REQUESTS}
    returning "id"
  `);
  if (!inserted) {
    const duplicate = await database.select({ id: meeting.id }).from(meeting).where(matching).get();
    if (duplicate) return json({ error: "You already requested a call for this topic and time." }, 409);
    return badRequest(
      "You already have a few pending requests. We'll confirm those first."
    );
  }

  const created = await database.select().from(meeting).where(eq(meeting.id, inserted.id)).get();

  return mutationJson(auth.user, "POST /api/meetings/request", { meeting: created }, 201);
});
