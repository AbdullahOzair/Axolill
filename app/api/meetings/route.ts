import { getCloudflareContext } from "@opennextjs/cloudflare";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db, forbidden, json, requireSession } from "@/lib/api";
import { lead, meeting, user } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/* ---------------------------- signature checking --------------------------- */

/** Constant-time compare — avoids leaking the secret via timing. */
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Cal.com signs the raw body with HMAC-SHA256, sent as x-cal-signature-256. */
async function verifyCalSignature(rawBody: string, signature: string | null) {
  const { env } = getCloudflareContext();
  const secret = env.CAL_WEBHOOK_SECRET;

  // Fail closed: without a configured secret we cannot trust the caller.
  if (!secret) return false;
  if (!signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody)
  );
  const expected = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(expected, signature.toLowerCase());
}

/* --------------------------------- payload --------------------------------- */

const calWebhook = z.object({
  triggerEvent: z.string(),
  payload: z.object({
    uid: z.string(),
    title: z.string().optional(),
    startTime: z.string(),
    attendees: z
      .array(
        z.object({
          name: z.string().optional(),
          email: z.string().optional(),
        })
      )
      .optional(),
    metadata: z.object({ videoCallUrl: z.string().optional() }).optional(),
    location: z.string().optional(),
  }),
});

const STATUS_BY_EVENT: Record<string, "scheduled" | "cancelled"> = {
  BOOKING_CREATED: "scheduled",
  BOOKING_REQUESTED: "scheduled",
  BOOKING_RESCHEDULED: "scheduled",
  BOOKING_CANCELLED: "cancelled",
  BOOKING_REJECTED: "cancelled",
};

/**
 * POST — Cal.com webhook receiver.
 *
 * Idempotent: keyed on Cal's booking `uid`, so re-deliveries update the same
 * row instead of inserting duplicates.
 */
export async function POST(request: Request) {
  // Read the RAW body — signature is over the exact bytes, not re-serialised JSON.
  const rawBody = await request.text();
  const signature = request.headers.get("x-cal-signature-256");

  const valid = await verifyCalSignature(rawBody, signature);
  if (!valid) return forbidden("Invalid webhook signature");

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const result = calWebhook.safeParse(parsed);
  if (!result.success) {
    return json({ error: "Unexpected payload", details: result.error.issues }, 400);
  }

  const { triggerEvent, payload } = result.data;
  const status = STATUS_BY_EVENT[triggerEvent];
  if (!status) {
    // Not an event we track — ack so Cal doesn't retry forever.
    return json({ ignored: triggerEvent });
  }

  const attendee = payload.attendees?.[0];
  const attendeeEmail = attendee?.email ?? "";
  const attendeeName = attendee?.name ?? "Unknown";

  // Best-effort linkage: an existing client user, else an existing lead.
  let clientId: string | null = null;
  let leadId: string | null = null;

  if (attendeeEmail) {
    const [existingUser] = await db()
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, attendeeEmail))
      .limit(1);
    if (existingUser) {
      clientId = existingUser.id;
    } else {
      const [existingLead] = await db()
        .select({ id: lead.id })
        .from(lead)
        .where(eq(lead.email, attendeeEmail))
        .limit(1);
      if (existingLead) leadId = existingLead.id;
    }
  }

  const row = {
    id: payload.uid, // Cal's booking uid == our primary key (idempotency)
    leadId,
    clientId,
    projectId: null,
    title: payload.title ?? "Meeting",
    attendeeName,
    attendeeEmail,
    scheduledAt: new Date(payload.startTime),
    meetingUrl: payload.metadata?.videoCallUrl ?? payload.location ?? null,
    status,
  };

  const [saved] = await db()
    .insert(meeting)
    .values(row)
    .onConflictDoUpdate({
      target: meeting.id,
      set: {
        title: row.title,
        scheduledAt: row.scheduledAt,
        meetingUrl: row.meetingUrl,
        status: row.status,
        updatedAt: new Date(),
      },
    })
    .returning();

  return json({ meeting: saved }, 201);
}

/**
 * GET — admins see every meeting (the /admin Meetings view); a client sees only
 * the meetings booked against them, which is what the portal renders.
 */
export async function GET() {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;

  const rows =
    auth.user.role === "admin"
      ? await db().select().from(meeting).orderBy(desc(meeting.scheduledAt))
      : await db()
          .select()
          .from(meeting)
          .where(eq(meeting.clientId, auth.user.id))
          .orderBy(desc(meeting.scheduledAt));

  return json({ meetings: rows });
}
