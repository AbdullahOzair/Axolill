import { notFound } from "@/lib/api";
import { quoteHandler } from "@/lib/quotation-api";
import { quotationPdfResponse } from "@/lib/quotation-pdf";
import { publicQuotation } from "@/lib/quotation-public";
import { lookupQuotationShare } from "@/lib/quotation-share";
import { limitEndpoint } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const GET = quoteHandler("quotation.public.pdf", async (request: Request, context: { params: Promise<{ token: string }> }) => {
  const limit = await limitEndpoint(request,"quote_pdf");
  if (limit) return limit;
  const record = await lookupQuotationShare((await context.params).token);
  if (!record) return notFound("This quotation link is unavailable or has expired.");
  return quotationPdfResponse(publicQuotation(record.quote),request);
});
