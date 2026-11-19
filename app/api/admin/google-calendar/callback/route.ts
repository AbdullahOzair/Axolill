import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";

import { db, newId, requireAdmin } from "@/lib/api";
import { googleCalendarConnection } from "@/lib/db/schema";
import {
  CALENDAR_SCOPE,
  exchangeCode,
  GoogleTokenError,
  verifyState,
} from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

const SETTINGS = "/admin/settings/calendar";

/** Send the admin back to the settings page with a human-readable outcome. */
const back = (origin: string, params: Record<string, string>) =>
  Response.redirect(
    `${origin}${SETTINGS}?${new URLSearchParams(params)}`,
    302
  );

export async function GET(request: Request) {
  // Still admin-only: the callback writes a token to the DB.
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const { env } = getCloudflareContext();
  const url = new URL(request.url);
  const origin = url.origin;
  const redirectUri = `${origin}/api/admin/google-calendar/callback`;

  // The user can decline on Google's screen.
  const denied = url.searchParams.get("error");
  if (denied) {
    return back(origin, {
      error:
        denied === "access_denied"
          ? "Consent was declined — Google Calendar is not connected."
          : `Google returned an error: ${denied}`,
    });
  }

  const code = url.searchParams.get("code");
  if (!code) return back(origin, { error: "Google didn't return a code." });

  /**
   * CSRF: `state` is signed with BETTER_AUTH_SECRET and carries the admin id
   * that started the flow. An attacker can't forge it, and a state minted for
   * a *different* admin must not be redeemable in this session — otherwise one
   * admin could graft their calendar grant onto another admin's account.
   */
  const state = await verifyState(
    env.BETTER_AUTH_SECRET,
    url.searchParams.get("state")
  );
  if (!state) {
    return back(origin, {
      error: "This authorisation link is invalid or has expired. Try again.",
    });
  }
  if (state.uid !== auth.user.id) {
    return back(origin, {
      error: "That authorisation was started by a different account.",
    });
  }

  let tokens;
  try {
    tokens = await exchangeCode({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri,
      code,
    });
  } catch (error) {
    if (error instanceof GoogleTokenError) {
      console.error("[google-calendar] token exchange failed", {
        status: error.status,
        code: error.code,
        message: error.message,
        redirectUri,
      });
      const message =
        error.code === "invalid_client"
          ? "Google OAuth client credentials are invalid. Check the production Client ID and Client Secret."
          : error.code === "invalid_grant"
            ? "Google rejected this authorization code. Start the connection again."
            : "Google rejected the token exchange. Check the OAuth client and redirect URI, then try again.";
      return back(origin, { error: message });
    }

    console.error("[google-calendar] unexpected token exchange failure", error);
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

  // One connection per admin (unique index on adminUserId), so reconnecting
  // replaces the existing grant rather than piling up rows.
  const existing = await db()
    .select({ id: googleCalendarConnection.id })
    .from(googleCalendarConnection)
    .where(eq(googleCalendarConnection.adminUserId, auth.user.id))
    .limit(1);

  if (existing[0]) {
    await db()
      .update(googleCalendarConnection)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        scope: tokens.scope ?? "",
        connectedAt: now,
        updatedAt: now,
      })
      .where(eq(googleCalendarConnection.adminUserId, auth.user.id));
  } else {
    await db().insert(googleCalendarConnection).values({
      id: newId(),
      adminUserId: auth.user.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scope: tokens.scope ?? "",
      connectedAt: now,
    });
  }

  return back(origin, { connected: "1" });
}
