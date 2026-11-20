import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";

import { db, newId, requireAdmin } from "@/lib/api";
import { googleCalendarConnection } from "@/lib/db/schema";
import {
  CALENDAR_SCOPE,
  CALENDAR_STATE_COOKIE,
  calendarStateCookieOptions,
  callbackUrl,
  exchangeCode,
  GoogleTokenError,
  verifyState,
} from "@/lib/google-calendar";
import { sealCalendarToken } from "@/lib/calendar-token-crypto";
import { PRIVATE_CACHE, securityEvent, withApiErrors } from "@/lib/http-security";

export const dynamic = "force-dynamic";

const SETTINGS = "/admin/settings/calendar";

/** Send the admin back to the settings page with a human-readable outcome. */
function back(origin: string, params: Record<string, string>) {
  const response = NextResponse.redirect(
    `${origin}${SETTINGS}?${new URLSearchParams(params)}`,
    { status: 302, headers: { "Cache-Control": PRIVATE_CACHE, "Referrer-Policy": "no-referrer" } }
  );
  response.cookies.set(CALENDAR_STATE_COOKIE, "", {
    ...calendarStateCookieOptions(origin),
    maxAge: 0,
  });
  return response;
}

export const GET = withApiErrors("GET /api/admin/google-calendar/callback", async function GET(request: NextRequest) {
  // Still admin-only: the callback writes a token to the DB.
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const { env } = getCloudflareContext();
  const url = request.nextUrl;
  const origin = new URL(env.BETTER_AUTH_URL).origin;
  const redirectUri = callbackUrl(env.BETTER_AUTH_URL);

  const returnedState = url.searchParams.get("state");
  const browserState = request.cookies.get(CALENDAR_STATE_COOKIE)?.value;
  const state = returnedState && returnedState === browserState
    ? await verifyState(env.BETTER_AUTH_SECRET, returnedState)
    : null;
  if (state?.uid !== auth.user.id) {
    securityEvent("calendar_oauth_state_rejected", { actorId: auth.user.id });
    return back(origin, { error: "This authorisation link is invalid or has expired. Try again." });
  }

  // The user can decline on Google's screen.
  const denied = url.searchParams.get("error");
  if (denied) {
    return back(origin, {
      error:
        denied === "access_denied"
          ? "Consent was declined — Google Calendar is not connected."
          : "Google could not complete the authorisation.",
    });
  }

  const code = url.searchParams.get("code");
  if (!code) return back(origin, { error: "Google didn't return a code." });

  let tokens;
  try {
    tokens = await exchangeCode({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri,
      code,
    });
  } catch (error) {
    securityEvent("calendar_oauth_exchange_failed", { actorId: auth.user.id });
    if (error instanceof GoogleTokenError) {
      const message =
        error.code === "invalid_client"
          ? "Google OAuth client credentials are invalid. Check the production Client ID and Client Secret."
          : error.code === "invalid_grant"
            ? "Google rejected this authorization code. Start the connection again."
            : "Google rejected the token exchange. Check the OAuth client and redirect URI, then try again.";
      return back(origin, { error: message });
    }

    return back(origin, {
      error: "Couldn't exchange the code with Google. Try connecting again.",
    });
  }

  // Without a refresh token the connection is useless the moment the access
  // token expires — treat it as a failure rather than storing a dud row.
  if (!tokens.refresh_token) {
    return back(origin, {
      error:
        "Google didn't return a refresh token. Remove Axonill from your Google account's third-party access, then connect again.",
    });
  }

  const granted = tokens.scope?.split(" ") ?? [];
  if (!granted.includes(CALENDAR_SCOPE)) {
    return back(origin, {
      error:
        "The calendar permission wasn't granted. Connect again and leave the calendar checkbox ticked.",
    });
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const now = new Date();

  const actorId = auth.user.id;
  const key = env.GOOGLE_CALENDAR_TOKEN_KEY;
  try {
    const grant = {
      accessToken: await sealCalendarToken(tokens.access_token, key, `${actorId}:access`),
      refreshToken: await sealCalendarToken(tokens.refresh_token, key, `${actorId}:refresh`),
      expiresAt,
      scope: tokens.scope ?? "",
      connectedAt: now,
      updatedAt: now,
    };
    await db().insert(googleCalendarConnection)
      .values({ id: newId(), adminUserId: actorId, ...grant })
      .onConflictDoUpdate({ target: googleCalendarConnection.adminUserId, set: grant });
  } catch {
    securityEvent("calendar_oauth_store_failed", { actorId });
    return back(origin, { error: "Could not save the Calendar connection. Try again." });
  }

  securityEvent("admin_mutation_succeeded", { actorId, action: "calendar.connect", status: 302 });
  return back(origin, { connected: "1" });
});
