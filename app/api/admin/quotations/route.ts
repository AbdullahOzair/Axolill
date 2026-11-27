import { parseBody, requireAdmin, mutationJson, json } from "@/lib/api";
import { quoteHandler } from "@/lib/quotation-api";
import { quoteInputSchema } from "@/lib/quotations";
import { saveQuotation } from "@/lib/quotation-store";
import { listQuotations, readQuoteFilters } from "@/lib/quotation-analytics";

export const dynamic = "force-dynamic";

export const GET = quoteHandler("quotation.list", async (request: Request) => {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  return json(await listQuotations(readQuoteFilters(request)));
});

export const POST = quoteHandler("quotation.create", async (request: Request) => {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const input = await parseBody(request, quoteInputSchema);
  if (input instanceof Response) return input;
  return mutationJson(auth.user, "quotation.create", { quote: await saveQuotation(auth.user.id, input) }, 201);
});
