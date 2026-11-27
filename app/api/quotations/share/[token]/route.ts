import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { forbidden, json, notFound, parseBody } from "@/lib/api";
import { sameOrigin } from "@/lib/http-security";
import { limitEndpoint } from "@/lib/rate-limit";
import { quoteHandler } from "@/lib/quotation-api";
import { publicQuotation } from "@/lib/quotation-public";
import { hashQuoteSecret, lookupQuotationShare, markQuoteViewed } from "@/lib/quotation-share";
import { changeQuotation } from "@/lib/quotation-store";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ token: string }> };
const unavailable = () => notFound("This quotation link is unavailable or has expired.");

export const GET = quoteHandler("quotation.public.read", async (request: Request, context: Context) => {
  const limit = await limitEndpoint(request, "quote_view");
  if (limit) return limit;
  const record = await lookupQuotationShare((await context.params).token);
  return record ? json({ quote: publicQuotation(record.quote) }) : unavailable();
});

const form = z.discriminatedUnion("action", [
  z.object({ action: z.literal("view") }),
  z.object({ action: z.enum(["accept", "decline", "revise"]),
    code: z.string().trim().toLowerCase().regex(/^[a-f0-9]{32}$/), comment: z.string().trim().max(1200).default("") }),
]);

export const POST = quoteHandler("quotation.public.response", async (request: Request, context: Context) => {
  if (!sameOrigin(request, getCloudflareContext().env.BETTER_AUTH_URL)) return forbidden("Invalid request origin.");
  const body = await parseBody(request, form);
  if (body instanceof Response) return body;
  const limit = await limitEndpoint(request, body.action === "view" ? "quote_view" : "quote_response");
  if (limit) return limit;
  const record = await lookupQuotationShare((await context.params).token);
  if (!record) return unavailable();
  if (body.action === "view") {
    if (!record.link.viewedAt) await markQuoteViewed(record.link.id);
    return json({ ok: true });
  }
  const codeHash = await hashQuoteSecret(body.code);
  let difference = 0;
  for (let index = 0; index < codeHash.length; index++) difference |= codeHash.charCodeAt(index) ^ record.link.codeHash.charCodeAt(index);
  if (difference) return forbidden("The verification code is incorrect.");
  const row = await changeQuotation(record.quote, body.action, null, record.quote.version, body.comment,
    { shareId: record.link.id, codeHash });
  return json({ quote: publicQuotation(row) });
});
