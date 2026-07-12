import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";

import { db } from "@/lib/api";
import { googleCalendarConnection } from "@/lib/db/schema";
import { refreshAccessToken } from "@/lib/google-calendar";

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

  const stillValid = conn.expiresAt.getTime() - SKEW_MS > Date.now();
  if (stillValid) return { ok: true, accessToken: conn.accessToken };

  const { env } = getCloudflareContext();

  try {
    const fresh = await refreshAccessToken({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      refreshToken: conn.refreshToken,
    });

    const expiresAt = new Date(Date.now() + fresh.expires_in * 1000);

    await db()
      .update(googleCalendarConnection)
      .set({
        accessToken: fresh.access_token,
        expiresAt,
        // Google usually omits refresh_token on refresh — keep the stored one.
        ...(fresh.refresh_token ? { refreshToken: fresh.refresh_token } : {}),
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarConnection.adminUserId, adminUserId));

    return { ok: true, accessToken: fresh.access_token };
  } catch (error) {
    console.error("[google-calendar] refresh failed", error);
    return {
      ok: false,
      reason: "refresh_failed",
      // A revoked/expired grant can't be repaired by retrying — say so.
      message:
        "Google rejected the stored credentials. Reconnect Google Calendar in Settings → Calendar.",
    };
  }
}
