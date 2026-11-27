import { json, requireAdmin } from "@/lib/api";
import { quoteHandler } from "@/lib/quotation-api";
import { quotationAnalytics, readQuoteFilters } from "@/lib/quotation-analytics";

export const dynamic = "force-dynamic";
export const GET = quoteHandler("quotation.analytics", async (request: Request) => {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  return json(await quotationAnalytics(readQuoteFilters(request)));
});
