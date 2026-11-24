import { asc } from "drizzle-orm";

import { badRequest, db, json, requireAdmin } from "@/lib/api";
import { teamMember } from "@/lib/db/schema";
import { PRIVATE_CACHE, withApiErrors } from "@/lib/http-security";
import { inquiryCsv, listInquiries, parseInquiryFilters } from "@/lib/inquiry-admin";

export const dynamic = "force-dynamic";
export const GET = withApiErrors("GET /api/admin/inquiries", async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const filter = parseInquiryFilters(request.url);
  if (!filter.success) return badRequest("Check the inquiry filters.");

  const { rows, total, overflow } = await listInquiries(filter.data);
  if (filter.data.export) {
    if (overflow) return badRequest("Narrow your filters to export up to 5,000 inquiries.");
    return new Response("\uFEFF" + inquiryCsv(rows), { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="axonill-inquiries.csv"',
      "Cache-Control": PRIVATE_CACHE,
    }});
  }
  const team = await db().select({ id: teamMember.id, name: teamMember.name }).from(teamMember).orderBy(asc(teamMember.name));
  return json({ inquiries: rows, total, team });
});
