import { notFound, requireAdmin } from "@/lib/api";
import { quoteHandler } from "@/lib/quotation-api";
import { quotationPdfResponse } from "@/lib/quotation-pdf";
import { publicQuotation } from "@/lib/quotation-public";
import { effectiveQuoteStatus, loadQuotation } from "@/lib/quotation-store";

export const dynamic = "force-dynamic";
export const GET = quoteHandler("quotation.admin.pdf", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const row = await loadQuotation((await context.params).id);
  if (!row) return notFound("Quotation not found.");
  return quotationPdfResponse(publicQuotation({ ...row, status: effectiveQuoteStatus(row) }),request);
});
