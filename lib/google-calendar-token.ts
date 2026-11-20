import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/api";
import { googleCalendarConnection } from "@/lib/db/schema";
import { refreshAccessToken } from "@/lib/google-calendar";
import { isSealedCalendarToken, openCalendarToken, sealCalendarToken } from "@/lib/calendar-token-crypto";
import { securityEvent } from "@/lib/http-security";

/** Refresh a little early — a token that expires mid-flight is a failed booking. */
const SKEW_MS = 60_000;

export type TokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "not_connected" | "refresh_failed"; message: string };

/**
 * Return a usable access token for the given admin, refreshing it first if it
 * has expired. The refreshed token is written back so the next request doesn't
 * have to round-trip to Google again.
 */
export async function getAccessToken(adminUserId: string): Promise<TokenResult> {
  const rows = await db()
    .select()
    .from(googleCalendarConnection)
    .where(eq(googleCalendarConnection.adminUserId, adminUserId))
    .limit(1);

  const conn = rows[0];
  if (!conn) {
    return {
      ok: false,
      reason: "not_connected",
      message:
        "Google Calendar isn't connected. Connect it in Settings → Calendar first.",
    };
  }

  const { env } = getCloudflareContext();
  const key = env.GOOGLE_CALENDAR_TOKEN_KEY;
  const accessContext = `${adminUserId}:access`;
  const refreshContext = `${adminUserId}:refresh`;

  try {
    if (conn.expiresAt.getTime() - SKEW_MS > Date.now()) {
      return { ok: true, accessToken: await openCalendarToken(conn.accessToken, key, accessContext) };
    }

    const refreshToken = await openCalendarToken(conn.refreshToken, key, refreshContext);
    const fresh = await refreshAccessToken({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      refreshToken,
    });

    const expiresAt = new Date(Date.now() + fresh.expires_in * 1000);
    const storedRefresh = fresh.refresh_token
      ? await sealCalendarToken(fresh.refresh_token, key, refreshContext)
      : key && !isSealedCalendarToken(conn.refreshToken)
        ? await sealCalendarToken(refreshToken, key, refreshContext)
        : conn.refreshToken;

    await db()
      .update(googleCalendarConnection)
      .set({
        accessToken: await sealCalendarToken(fresh.access_token, key, accessContext),
        expiresAt,
        refreshToken: storedRefresh,
        updatedAt: new Date(),
      })
      .where(and(
        eq(googleCalendarConnection.id, conn.id),
        eq(googleCalendarConnection.accessToken, conn.accessToken)
      ));

    return { ok: true, accessToken: fresh.access_token };
  } catch {
    securityEvent("calendar_token_unavailable", { actorId: adminUserId });
    return {
      ok: false,
      reason: "refresh_failed",
      // A revoked/expired grant can't be repaired by retrying — say so.
      message:
        "Google rejected the stored credentials. Reconnect Google Calendar in Settings → Calendar.",
    };
  }
}
