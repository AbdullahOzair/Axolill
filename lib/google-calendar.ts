import "server-only";

/**
 * Google Calendar OAuth — deliberately SEPARATE from the better-auth login flow.
 *
 * Signing in with Google (better-auth `socialProviders.google`) only asks for
 * identity scopes and never receives a refresh token we control. This flow is
 * an admin-only, incremental-authorisation grant: it asks for
 * `calendar.events`, forces `access_type=offline` + `prompt=consent` so Google
 * actually returns a refresh token, and stores that token in
 * `google_calendar_connection`.
 *
 * It reuses the same OAuth *client* (GOOGLE_CLIENT_ID/SECRET) — that's fine and
 * normal — but it is a different authorisation request with its own redirect
 * URI, which must be registered in the Google Cloud console:
 *
 *   {BETTER_AUTH_URL}/api/admin/google-calendar/callback
 */

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

export const callbackUrl = (baseUrl: string) =>
  new URL("/api/admin/google-calendar/callback", baseUrl).href;

export const CALENDAR_STATE_COOKIE = "axonill_calendar_state";
export const CALENDAR_STATE_TTL_SECONDS = 10 * 60;

export const calendarStateCookieOptions = (baseUrl: string) => ({
  httpOnly: true,
  secure: new URL(baseUrl).protocol === "https:",
  sameSite: "lax" as const,
  path: "/api/admin/google-calendar/callback",
});

/* ---------------------------------- state ---------------------------------- */

const enc = new TextEncoder();

const b64url = (bytes: ArrayBuffer | Uint8Array) => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...view))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

async function hmac(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}

/** Constant-time compare — a fast `!==` on a MAC leaks timing. */
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const STATE_TTL_MS = CALENDAR_STATE_TTL_SECONDS * 1000;

/**
 * The `state` param is a signed `{adminUserId, issuedAt, nonce}`. Google echoes
 * it back verbatim, so signing it lets the callback prove the request started
 * here (CSRF) *and* that it was started by this same admin.
 */
export async function signState(secret: string, adminUserId: string) {
  const payload = b64url(
    enc.encode(
      JSON.stringify({
        uid: adminUserId,
        ts: Date.now(),
        n: b64url(crypto.getRandomValues(new Uint8Array(12))),
      })
    )
  );
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyState(
  secret: string,
  state: string | null
): Promise<{ uid: string } | null> {
  if (!state || state.length > 512) return null;
  const [payload, mac, extra] = state.split(".");
  if (!payload || !mac || extra !== undefined) return null;

  const expected = await hmac(secret, payload);
  if (!timingSafeEqual(mac, expected)) return null;

  try {
    const json = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0)
        )
      )
    ) as { uid?: string; ts?: number };

    if (typeof json.uid !== "string" || typeof json.ts !== "number" || !Number.isFinite(json.ts)) return null;
    const age = Date.now() - json.ts;
    if (age < 0 || age > STATE_TTL_MS) return null;
    return { uid: json.uid };
  } catch {
    return null;
  }
}

/* ---------------------------------- flow ----------------------------------- */

export function buildConsentUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPE,
    // Both are required to be handed a refresh token. Without `prompt=consent`
    // Google silently omits refresh_token on every grant after the first.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: opts.state,
  });
  return `${AUTH_ENDPOINT}?${params}`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

export class GoogleTokenError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string
  ) {
    super(message);
    this.name = "GoogleTokenError";
  }
}

export async function exchangeCode(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
      grant_type: "authorization_code",
      code: opts.code,
    }),
  });

  if (!res.ok) {
    const raw = await res.text();
    let code: string | null = null;
    let message = raw;
    try {
      const body = JSON.parse(raw) as {
        error?: string;
        error_description?: string;
      };
      code = body.error ?? null;
      message = body.error_description ?? body.error ?? raw;
    } catch {
      // Google may return a non-JSON error body.
    }
    throw new GoogleTokenError(res.status, code, message);
  }
  return (await res.json()) as TokenResponse;
}

/** Exchange a stored refresh token for a fresh access token. */
export async function refreshAccessToken(opts: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      grant_type: "refresh_token",
      refresh_token: opts.refreshToken,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as TokenResponse;
}

/* --------------------------------- events ---------------------------------- */

const EVENTS_ENDPOINT =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export type CalendarEvent = {
  id: string;
  hangoutLink?: string;
  htmlLink?: string;
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
};

/**
 * Create a Calendar event with a Google Meet conference attached.
 *
 * `conferenceDataVersion=1` is mandatory — without it Google silently ignores
 * the `conferenceData.createRequest` and you get an event with no Meet link.
 * `requestId` must be unique per creation attempt; Google dedupes on it.
 */
export async function createMeetEvent(opts: {
  accessToken: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  timeZone: string;
  attendeeEmails: string[];
}): Promise<CalendarEvent> {
  const url = new URL(EVENTS_ENDPOINT);
  url.searchParams.set("conferenceDataVersion", "1");
  url.searchParams.set("sendUpdates", "all");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: opts.summary,
      description: opts.description,
      start: { dateTime: opts.start.toISOString(), timeZone: opts.timeZone },
      end: { dateTime: opts.end.toISOString(), timeZone: opts.timeZone },
      attendees: opts.attendeeEmails.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    }),
  });

  if (!res.ok) {
    throw await googleError(res);
  }
  return (await res.json()) as CalendarEvent;
}

/**
 * Google's failures here are usually *configuration*, not transient — the API
 * isn't enabled, the grant is missing a scope. Collapsing them all into
 * "try again" hides the one thing the admin needs to know, so keep the reason.
 */
export class GoogleApiError extends Error {
  constructor(
    /** HTTP status. */
    readonly status: number,
    /** e.g. "accessNotConfigured", "insufficientPermissions". */
    readonly reason: string | null,
    message: string
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

async function googleError(res: Response): Promise<GoogleApiError> {
  const raw = await res.text();
  try {
    const body = JSON.parse(raw) as {
      error?: { message?: string; errors?: { reason?: string }[] };
    };
    return new GoogleApiError(
      res.status,
      body.error?.errors?.[0]?.reason ?? null,
      body.error?.message ?? raw
    );
  } catch {
    return new GoogleApiError(res.status, null, raw);
  }
}

/** The Meet URL lives in one of two places depending on the response shape. */
export function meetLinkOf(event: CalendarEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  const entry = event.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === "video"
  );
  return entry?.uri ?? null;
}

/** Best-effort cancellation — used when we can't persist the meeting locally. */
export async function deleteEvent(accessToken: string, eventId: string) {
  try {
    await fetch(`${EVENTS_ENDPOINT}/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // Swallow: the caller is already handling a failure.
  }
}

/**
 * Tell Google to drop the grant. Best-effort: if this fails we still delete our
 * row, otherwise a half-revoked connection would be stuck forever.
 */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function calendarSlotIsOpen(accessToken: string, start: Date, end: Date, ignoreEventId?: string) {
  const url = new URL(EVENTS_ENDPOINT);
  url.searchParams.set("timeMin", start.toISOString());
  url.searchParams.set("timeMax", end.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("fields", "nextPageToken,items(id,status,transparency)");
  const response = await fetch(url, { headers: { Authorization: "Bearer " + accessToken } });
  if (!response.ok) throw await googleError(response);
  const result = await response.json() as { nextPageToken?: string; items?: { id: string; status?: string; transparency?: string }[] };
  return !result.nextPageToken && !result.items?.some((event) => event.id !== ignoreEventId && event.status !== "cancelled" && event.transparency !== "transparent");
}

export async function moveMeetEvent(accessToken: string, id: string, start: Date, end: Date, timeZone: string) {
  const response = await fetch(EVENTS_ENDPOINT + "/" + encodeURIComponent(id) + "?sendUpdates=all", {
    method: "PATCH",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ start: { dateTime: start.toISOString(), timeZone }, end: { dateTime: end.toISOString(), timeZone } }),
  });
  if (!response.ok) throw await googleError(response);
}

export type CalendarBusyPeriod = { start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } };

/** Read time ranges only. Event titles, attendees, and descriptions stay in Calendar. */
export async function calendarBusyPeriods(accessToken: string, from: Date, to: Date) {
  const url = new URL(EVENTS_ENDPOINT);
  url.searchParams.set("timeMin", from.toISOString());
  url.searchParams.set("timeMax", to.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("fields", "nextPageToken,items(start,end,status,transparency)");
  const periods: CalendarBusyPeriod[] = [];
  for (let page = 0; page < 5; page++) {
    const response = await fetch(url, { headers: { Authorization: "Bearer " + accessToken } });
    if (!response.ok) throw await googleError(response);
    const result = await response.json() as { nextPageToken?: string; items?: (CalendarBusyPeriod & { status?: string; transparency?: string })[] };
    for (const event of result.items ?? []) {
      if (event.start && event.end && event.status !== "cancelled" && event.transparency !== "transparent") periods.push({ start: event.start, end: event.end });
    }
    if (!result.nextPageToken) return periods;
    url.searchParams.set("pageToken", result.nextPageToken);
  }
  throw new Error("The calendar has too many events to calculate availability.");
}
