import { json, requireAdmin } from "@/lib/api";
import { quoteHandler, quotationOptions } from "@/lib/quotation-api";

export const dynamic = "force-dynamic";
export const GET = quoteHandler("quotation.options", async (request: Request) => {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  return json(await quotationOptions(new URL(request.url).searchParams.get("source")));
});
