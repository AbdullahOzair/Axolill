import { json } from "@/lib/api";
import { withApiErrors } from "@/lib/http-security";
import { loadInquiryServices } from "@/lib/inquiry-server";

export const dynamic = "force-dynamic";
export const GET = withApiErrors("GET /api/inquiries/services", async function GET() {
  return json({ services: await loadInquiryServices() });
});
