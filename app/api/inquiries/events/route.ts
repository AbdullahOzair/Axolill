import { eq } from "drizzle-orm";

import { db, json, parseBody } from "@/lib/api";
import { inquiryEvent } from "@/lib/db/schema";
import { withApiErrors } from "@/lib/http-security";
import { allowPublicInquiry } from "@/lib/inquiry-server";
import { funnelEvent } from "@/lib/inquiry-validation";

export const dynamic = "force-dynamic";
export const POST = withApiErrors("POST /api/inquiries/events", async function POST(request: Request) {
  const limited = await allowPublicInquiry(request, "inquiry_events");
  if (limited) return limited;
  const body = await parseBody(request, funnelEvent);
  if (body instanceof Response) return body;

  const database = db();
  const viewedId = body.sessionId + ":viewed";
  if (body.event !== "viewed" && !(await database.select({ id: inquiryEvent.id }).from(inquiryEvent)
    .where(eq(inquiryEvent.id, viewedId)).get())) return json({ accepted: false });

  const id = body.event === "viewed" ? viewedId : [body.sessionId, body.event, body.type, "step" in body ? body.step : ""].join(":");
  await database.insert(inquiryEvent).values({
    id, event: body.event, sessionId: body.sessionId,
    type: "type" in body ? body.type : null, step: "step" in body ? body.step : null,
    referral: body.event === "viewed" ? body.referral ?? null : null,
    campaign: body.event === "viewed" ? body.campaign ?? null : null,
  }).onConflictDoNothing();
  return json({ accepted: true });
});
