import { getCloudflareContext } from "@opennextjs/cloudflare";

import { requireAdmin } from "@/lib/api";
import { buildConsentUrl, signState } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

/**
 * GET — start the Google Calendar consent flow.
 *
 * This is a top-level navigation (not fetch): the browser must actually land on
 * Google's consent screen, so we 302 rather than return JSON.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const { env } = getCloudflareContext();

  const state = await signState(env.BETTER_AUTH_SECRET, auth.user.id);
  const url = buildConsentUrl({
    clientId: env.GOOGLE_CLIENT_ID,
    baseUrl: env.BETTER_AUTH_URL,
    state,
  });

  return Response.redirect(url, 302);
}
