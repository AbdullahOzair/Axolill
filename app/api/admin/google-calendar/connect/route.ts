import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

import { forbidden, requireAdmin } from "@/lib/api";
import {
  buildConsentUrl,
  callbackUrl,
  CALENDAR_STATE_COOKIE,
  CALENDAR_STATE_TTL_SECONDS,
  calendarStateCookieOptions,
  signState,
} from "@/lib/google-calendar";
import { PRIVATE_CACHE, withApiErrors } from "@/lib/http-security";

export const dynamic = "force-dynamic";

/**
 * GET — start the Google Calendar consent flow.
 *
 * This is a top-level navigation (not fetch): the browser must actually land on
 * Google's consent screen, so we 302 rather than return JSON.
 */
export const GET = withApiErrors("GET /api/admin/google-calendar/connect", async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  if (request.headers.get("sec-fetch-site") === "cross-site") return forbidden();

  const { env } = getCloudflareContext();
  const redirectUri = callbackUrl(env.BETTER_AUTH_URL);

  const state = await signState(env.BETTER_AUTH_SECRET, auth.user.id);
  const url = buildConsentUrl({
    clientId: env.GOOGLE_CLIENT_ID,
    redirectUri,
    state,
  });

  const response = NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": PRIVATE_CACHE, "Referrer-Policy": "no-referrer" },
  });
  response.cookies.set(CALENDAR_STATE_COOKIE, state, {
    ...calendarStateCookieOptions(env.BETTER_AUTH_URL),
    maxAge: CALENDAR_STATE_TTL_SECONDS,
  });
  return response;
});
