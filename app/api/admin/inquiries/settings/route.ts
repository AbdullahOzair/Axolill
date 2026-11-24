import { badRequest, db, json, mutationJson, parseBody, requireAdmin } from "@/lib/api";
import { inquirySettings } from "@/lib/db/schema";
import { withApiErrors } from "@/lib/http-security";
import { INQUIRY_SETTINGS_ID, loadInquiryServices, loadInquirySettings } from "@/lib/inquiry-server";
import { inquiryConfiguration } from "@/lib/inquiry-validation";

export const dynamic = "force-dynamic";
export const GET = withApiErrors("GET inquiry settings", async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const [settings, services] = await Promise.all([loadInquirySettings(), loadInquiryServices()]);
  return json({ settings, services });
});

export const PATCH = withApiErrors("PATCH inquiry settings", async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, inquiryConfiguration);
  if (body instanceof Response) return body;
  const serviceKeys = new Set((await loadInquiryServices()).map((choice) => choice.key));
  if (Object.keys(body.serviceGroups).some((key) => !serviceKeys.has(key))) return badRequest("Refresh the service catalogue before saving.");
  await db().insert(inquirySettings).values({ id: INQUIRY_SETTINGS_ID, ...body })
    .onConflictDoUpdate({ target: inquirySettings.id, set: body });
  return mutationJson(auth.user, "inquiry.settings", { ok: true });
});
