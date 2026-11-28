import "server-only";

import { getAccessToken } from "@/lib/google-calendar-token";
import { securityEvent } from "@/lib/http-security";
import { safeMeetingLink } from "@/lib/meeting-link";
import {
  createMeetEvent,
  calendarSlotIsOpen,
  moveMeetEvent,
  deleteEvent,
  GoogleApiError,
  meetLinkOf,
} from "@/lib/google-calendar";

/**
 * Turn Google's error into something the admin can act on.
 *
 * These failures are almost always *configuration* — the Calendar API isn't
 * switched on in the Cloud project, or the grant is missing a scope. Telling
 * someone to "try again" on a permanently misconfigured project is useless, so
 * name the actual problem and where to fix it.
 */
function explainGoogleFailure(error: unknown): string {
  if (!(error instanceof GoogleApiError)) {
    return "Couldn't reach Google Calendar. Check your connection and try again.";
  }

  switch (error.reason) {
    case "accessNotConfigured":
      return (
        "The Google Calendar API isn't enabled for this Google Cloud project. " +
        "Enable it in the Cloud console (APIs & Services → Library → Google " +
        "Calendar API → Enable), wait a minute, then try again."
      );

    case "insufficientPermissions":
    case "forbidden":
      return (
        "The connected Google account didn't grant calendar access. " +
        "Reconnect in Settings → Calendar and leave the calendar permission ticked."
      );

    case "rateLimitExceeded":
    case "userRateLimitExceeded":
      return "Google is rate-limiting this account. Wait a moment and try again.";

    case "invalidGrant":
      return "Google rejected the stored credentials. Reconnect in Settings → Calendar.";

    default:
      return "Google rejected the calendar event. Review the connection and try again.";
  }
}

export type MeetResult =
  | { ok: true; eventId: string; meetingUrl: string; accessToken: string }
  | { ok: false; status: 409 | 502; error: string; reason?: string };

/**
 * Create a Google Meet event on the admin's calendar.
 *
 * Shared by "Schedule Google Meet" (admin-initiated) and "confirm a client
 * request" — both must behave identically, including the rollback when Google
 * hands back an event with no Meet link.
 */
export async function createMeet(opts: {
  adminUserId: string;
  summary: string;
  description?: string;
  start: Date;
  durationMinutes: number;
  timeZone: string;
  attendeeEmail: string;
  checkAvailability?: boolean;
}): Promise<MeetResult> {
  const token = await getAccessToken(opts.adminUserId);
  if (!token.ok) {
    // The request is fine — the *connection* is the problem.
    return { ok: false, status: 409, error: token.message, reason: token.reason };
  }

  const end = new Date(opts.start.getTime() + opts.durationMinutes * 60_000);

  let event;
  try {
    if (opts.checkAvailability && !await calendarSlotIsOpen(token.accessToken, opts.start, end))
      return { ok: false, status: 409, error: "This time overlaps an event on the connected calendar." };
    event = await createMeetEvent({
      accessToken: token.accessToken,
      summary: opts.summary,
      description: opts.description,
      start: opts.start,
      end,
      timeZone: opts.timeZone,
      attendeeEmails: [opts.attendeeEmail],
    });
  } catch (error) {
    securityEvent("calendar_event_create_failed", { actorId: opts.adminUserId });
    return {
      ok: false,
      status: 502,
      error: explainGoogleFailure(error),
    };
  }

  const meetingUrl = safeMeetingLink(meetLinkOf(event));
  if (!meetingUrl) {
    // An event with no Meet link isn't what was asked for — don't keep it.
    await deleteEvent(token.accessToken, event.id);
    return {
      ok: false,
      status: 502,
      error:
        "Google created the event without a Meet link. It has been removed — check that Google Meet is enabled for this account.",
    };
  }

  return {
    ok: true,
    eventId: event.id,
    meetingUrl,
    accessToken: token.accessToken,
  };
}

/** Undo a created event when we fail to persist it locally. */
export const rollbackMeet = deleteEvent;

export async function rescheduleMeet(adminUserId: string, eventId: string, start: Date, durationMinutes: number, timeZone: string) {
  const token = await getAccessToken(adminUserId);
  if (!token.ok) return { ok: false, status: 409, error: token.message, reason: token.reason } as const;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  try {
    if (!await calendarSlotIsOpen(token.accessToken, start, end, eventId))
      return { ok: false, status: 409, error: "This time overlaps an event on the connected calendar." } as const;
    await moveMeetEvent(token.accessToken, eventId, start, end, timeZone);
    return { ok: true } as const;
  } catch (error) {
    securityEvent("calendar_event_move_failed", { actorId: adminUserId });
    return { ok: false, status: 502, error: explainGoogleFailure(error) } as const;
  }
}
