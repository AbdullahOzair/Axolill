import "server-only";

import { getAccessToken } from "@/lib/google-calendar-token";
import {
  createMeetEvent,
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
      // Surface Google's own words — this route is admin-only, so the detail
      // is safe to show and is the fastest route to a fix.
      return `Google rejected the event (${error.status}): ${error.message}`;
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
}): Promise<MeetResult> {
  const token = await getAccessToken(opts.adminUserId);
  if (!token.ok) {
    // The request is fine — the *connection* is the problem.
    return { ok: false, status: 409, error: token.message, reason: token.reason };
  }

  const end = new Date(opts.start.getTime() + opts.durationMinutes * 60_000);

  let event;
  try {
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
    console.error("[google-calendar] event creation failed", error);
    return {
      ok: false,
      status: 502,
      error: explainGoogleFailure(error),
    };
  }

  const meetingUrl = meetLinkOf(event);
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
