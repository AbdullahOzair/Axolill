import { z } from "zod";

import { json, mutationJson, notFound, parseBody, requireAdmin } from "@/lib/api";
import { quoteHandler } from "@/lib/quotation-api";
import { createQuotationShare, revokeQuotationShare } from "@/lib/quotation-share";
import { quoteInputSchema, quoteDateToday } from "@/lib/quotations";
import { changeQuotation, convertQuotation, copyQuotation, loadQuotation, quotationDetail, recordQuotationPayment,
  saveQuotation, setQuotationArchived } from "@/lib/quotation-store";
import { badRequest } from "@/lib/api";
import { db, newId } from "@/lib/api";
import { quotationActivity } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const version = z.number().int().nonnegative();

export const GET = quoteHandler("quotation.detail", async (_request: Request, context: Context) => {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  return json(await quotationDetail((await context.params).id));
});

export const PATCH = quoteHandler("quotation.edit", async (request: Request, context: Context) => {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, z.object({ version, input: quoteInputSchema }));
  if (body instanceof Response) return body;
  const row = await loadQuotation((await context.params).id);
  if (!row) return notFound("Quotation not found.");
  return mutationJson(auth.user, "quotation.edit", { quote: await saveQuotation(auth.user.id, body.input, row, body.version) });
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["submit", "approve", "return", "sent", "accept", "decline", "revise", "cancel"]),
    version, note: z.string().trim().max(1200).default("") }),
  z.object({ action: z.enum(["duplicate", "revision"]) }),
  z.object({ action: z.enum(["archive", "restore", "delete"]), version }),
  z.object({ action: z.literal("share"), version, days: z.number().int().min(1).max(90) }),
  z.object({ action: z.literal("revoke"), shareId: z.uuid() }),
  z.object({ action: z.literal("delivery_failure"), note: z.string().trim().min(1).max(1200) }),
  z.object({ action: z.literal("invoice"), version, projectId: z.string().max(160), due: z.iso.date() }),
  z.object({ action: z.literal("payment"), amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    receipt: z.string().trim().min(1).max(100), receivedOn: z.iso.date() }),
]);

export const POST = quoteHandler("quotation.action", async (request: Request, context: Context) => {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, actionSchema);
  if (body instanceof Response) return body;
  const row = await loadQuotation((await context.params).id);
  if (!row) return notFound("Quotation not found.");
  const actor = auth.user.id;
  let result;
  if (body.action === "delivery_failure") {
    if (row.archived || row.status !== "approved") return badRequest("Only approved quotations can log a delivery failure.");
    await db().insert(quotationActivity).values({ id: newId(), quotationId: row.id, actorId: actor, kind: "delivery_failure", details: body.note });
  } else if ("note" in body) {
    if (["sent", "accept", "decline", "revise"].includes(body.action) && !body.note)
      return badRequest("Record how the delivery or client response was verified.");
    result = { quote: await changeQuotation(row, body.action, actor, body.version, body.note) };
  } else if (body.action === "duplicate" || body.action === "revision") {
    result = { quote: await copyQuotation(row, actor, body.action === "revision") };
  } else if (body.action === "invoice") {
    result = await convertQuotation(row, actor, body.projectId, body.due, body.version);
  } else if (body.action === "share") {
    result = await createQuotationShare(row, actor, body.days, body.version);
  } else if (body.action === "revoke") {
    await revokeQuotationShare(row.id, body.shareId, actor);
  } else if (body.action === "payment") {
    if (body.receivedOn > quoteDateToday()) return badRequest("Receipt date cannot be in the future.");
    await recordQuotationPayment(row, actor, body.amount, body.receipt, body.receivedOn);
  } else if (body.action === "archive" || body.action === "restore" || body.action === "delete") {
    await setQuotationArchived(row, actor, body.action, body.version);
  }
  return mutationJson(auth.user, "quotation." + body.action, result ?? { ok: true });
});
