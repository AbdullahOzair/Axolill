import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { db, json, mutationJson, notFound, requireAdmin } from "@/lib/api";
import { googleCalendarConnection } from "@/lib/db/schema";
import { CALENDAR_SCOPE, revokeToken } from "@/lib/google-calendar";
import { openCalendarToken } from "@/lib/calendar-token-crypto";
import { securityEvent, withApiErrors } from "@/lib/http-security";

export const dynamic = "force-dynamic";

/**
 * GET — connection status for the signed-in admin.
 *
 * Tokens NEVER leave the server. The client only needs to know whether a
 * connection exists, when it was made, and whether the grant is still good.
 */
export const GET = withApiErrors("GET /api/admin/google-calendar", async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const rows = await db()
    .select({
      connectedAt: googleCalendarConnection.connectedAt,
      expiresAt: googleCalendarConnection.expiresAt,
      scope: googleCalendarConnection.scope,
    })
    .from(googleCalendarConnection)
    .where(eq(googleCalendarConnection.adminUserId, auth.user.id))
    .limit(1);

  const row = rows[0];
  if (!row) return json({ connection: null });

  return json({
    connection: {
      connectedAt: row.connectedAt,
      // The access token expiring is normal and self-healing (we refresh it);
      // it is NOT the same as the connection being broken.
      accessTokenExpiresAt: row.expiresAt,
      scope: row.scope,
      hasCalendarScope: row.scope.split(" ").includes(CALENDAR_SCOPE),
    },
  });
});

/** DELETE — disconnect: revoke the grant at Google, then drop the row. */
export const DELETE = withApiErrors("DELETE /api/admin/google-calendar", async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const rows = await db()
    .select()
    .from(googleCalendarConnection)
    .where(eq(googleCalendarConnection.adminUserId, auth.user.id))
    .limit(1);

  const row = rows[0];
  if (!row) return notFound("No Google Calendar connection");

  // Revoking the refresh token invalidates the whole grant (access tokens too).
  const { env } = getCloudflareContext();
  let revoked = false;
  try {
    const refreshToken = await openCalendarToken(
      row.refreshToken, env.GOOGLE_CALENDAR_TOKEN_KEY, `${auth.user.id}:refresh`
    );
    revoked = await revokeToken(refreshToken);
  } catch {
    securityEvent("calendar_revoke_failed", { actorId: auth.user.id });
  }

  await db()
    .delete(googleCalendarConnection)
    .where(eq(googleCalendarConnection.adminUserId, auth.user.id));

  // We delete our row either way — a revoke failure at Google must not leave
  // the admin stuck with a connection they can't remove from our side.
  return mutationJson(auth.user, "DELETE /api/admin/google-calendar", { disconnected: true, revokedAtGoogle: revoked });
});
