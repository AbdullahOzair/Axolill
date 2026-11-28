import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/api";
import { googleCalendarConnection, meeting } from "@/lib/db/schema";
import { calendarBusyPeriods } from "@/lib/google-calendar";
import { getAccessToken } from "@/lib/google-calendar-token";
import { securityEvent } from "@/lib/http-security";

const bookingHours = z.object({
  timeZone: z.string().min(1).max(64),
  weekdays: z.array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])).min(1).max(7),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24),
  calendarAdminId: z.string().optional(),
}).refine((data) => data.endHour > data.startHour);

export async function portalAvailability(clientId: string) {
  const env = getCloudflareContext().env;
  if (!env.PORTAL_BOOKING_HOURS) return { mode: "request", slots: [] };
  try {
    const policy = bookingHours.parse(JSON.parse(env.PORTAL_BOOKING_HOURS));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: policy.timeZone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
    const local = (at: number) => Object.fromEntries(parts.formatToParts(at).map(({ type, value }) => [type, value]));
    const connections = await db().select({ id: googleCalendarConnection.adminUserId }).from(googleCalendarConnection)
      .where(policy.calendarAdminId ? eq(googleCalendarConnection.adminUserId, policy.calendarAdminId) : undefined).limit(2);
    if (connections.length !== 1) return { mode: "request", slots: [] };
    const owner = connections[0].id;
    const token = await getAccessToken(owner);
    if (!token.ok) return { mode: "request", slots: [] };
    const halfHour = 30 * 60 * 1000;
    const from = Math.ceil((Date.now() + 60 * 60 * 1000) / halfHour) * halfHour;
    const to = from + 7 * 86400000;
    const [busy, bookings] = await Promise.all([
      calendarBusyPeriods(token.accessToken, new Date(from), new Date(to)),
      db().select({ at: meeting.scheduledAt, duration: meeting.durationMinutes }).from(meeting)
        .where(and(eq(meeting.clientId, clientId), inArray(meeting.status, ["scheduled", "requested"]),
          sql`${meeting.scheduledAt} >= ${Math.floor(from / 1000) - 8 * 3600} and ${meeting.scheduledAt} < ${Math.ceil(to / 1000)}`)),
    ]);
    const slots: string[] = [];
    for (let at = from; at + halfHour <= to; at += halfHour) {
      const wall = local(at);
      const hm = Number(wall.hour) * 60 + Number(wall.minute);
      if (!policy.weekdays.some((day) => day === wall.weekday) || hm < policy.startHour * 60 || hm + 30 > policy.endHour * 60) continue;
      const day = [wall.year, wall.month, wall.day].join("-");
      if (bookings.some((booking) => booking.at.getTime() < at + halfHour && booking.at.getTime() + booking.duration * 60000 > at)) continue;
      if (busy.some(({ start, end }) => start.date && end.date ? start.date <= day && end.date > day :
        Date.parse(start.dateTime ?? "") < at + halfHour && Date.parse(end.dateTime ?? "") > at)) continue;
      slots.push(new Date(at).toISOString());
    }
    return { mode: "availability", slots };
  } catch {
    securityEvent("portal_calendar_availability_unavailable");
    return { mode: "request", slots: [] };
  }
}
