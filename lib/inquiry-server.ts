import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { asc, eq } from "drizzle-orm";

import { db, forbidden } from "@/lib/api";
import { inquirySettings, service } from "@/lib/db/schema";
import { sameOrigin } from "@/lib/http-security";
import { inquiryServiceChoices } from "@/lib/inquiries";
import { limitEndpoint } from "@/lib/rate-limit";

export const INQUIRY_SETTINGS_ID = "work-with-us";

export async function allowPublicInquiry(request: Request, action: "inquiry" | "inquiry_events") {
  const { env } = getCloudflareContext();
  if (!sameOrigin(request, env.BETTER_AUTH_URL)) return forbidden("Invalid request origin");
  return limitEndpoint(request, action);
}

export async function loadInquirySettings() {
  return (await db().select().from(inquirySettings).where(eq(inquirySettings.id, INQUIRY_SETTINGS_ID)).get()) ??
    { id: INQUIRY_SETTINGS_ID, domesticCountry: "PK", serviceGroups: {} };
}

export async function loadInquiryServices() {
  const [settings, services] = await Promise.all([
    loadInquirySettings(),
    db().select({ id: service.id, title: service.title, items: service.items }).from(service)
      .where(eq(service.published, true)).orderBy(asc(service.order), asc(service.id)),
  ]);
  return inquiryServiceChoices(services, settings.serviceGroups);
}
