import { withApiErrors } from "@/lib/http-security";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  badRequest,
  db,
  json,
  mutationJson,
  loadProject,
  notFound,
  parseBody,
  requireAdmin,
  requireSession,
  toDate,
} from "@/lib/api";
import { invoice, quotationInvoice } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const patchInvoice = z
  .object({
    number: z.string().min(1).max(60),
    amount: z.number().nonnegative(),
    currency: z.string().length(3),
    status: z.enum(["draft", "sent", "paid", "overdue"]),
    dueDate: z.iso.datetime().or(z.iso.date()),
  })
  .partial();

async function findInvoice(id: string) {
  const rows = await db()
    .select()
    .from(invoice)
    .where(eq(invoice.id, id))
    .limit(1);
  return rows[0];
}

/** GET — admin, or the client who owns the parent project. */
export const GET = withApiErrors("GET /api/invoices/[id]", async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const found = await findInvoice(id);
  if (!found) return notFound("Invoice not found");

  // Ownership is derived from the parent project.
  const project = await loadProject(found.projectId, auth.user);
  if (project instanceof Response) return notFound("Invoice not found");

  const linked = await db().select({ quotation: quotationInvoice.snapshot }).from(quotationInvoice)
    .where(eq(quotationInvoice.invoiceId, id)).get();
  return json({ invoice: found, ...linked });
});

/** PATCH — admin only (e.g. mark paid). */
export const PATCH = withApiErrors("PATCH /api/invoices/[id]", async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const found = await findInvoice(id);
  if (!found) return notFound("Invoice not found");

  const body = await parseBody(request, patchInvoice);
  if (body instanceof Response) return body;
  const linked = await db().select({ id: quotationInvoice.id }).from(quotationInvoice).where(eq(quotationInvoice.invoiceId, id)).get();
  if (linked && ((body.amount !== undefined && body.amount !== found.amount)
    || (body.currency !== undefined && body.currency !== found.currency)
    || (body.number !== undefined && body.number !== found.number)
    || (body.status === "paid" && found.status !== "paid"))) {
    return badRequest("Manage quotation-linked terms and payment receipts from the quotation.");
  }

  // Pull the date out of the spread — it arrives as an ISO string, but the
  // column takes a Date.
  const { dueDate, ...rest } = body;

  const [updated] = await db()
    .update(invoice)
    .set({
      ...rest,
      ...(dueDate ? { dueDate: toDate(dueDate) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(invoice.id, id))
    .returning();

  return mutationJson(auth.user, "PATCH /api/invoices/[id]", { invoice: updated });
});

/** DELETE — admin only. */
export const DELETE = withApiErrors("DELETE /api/invoices/[id]", async function DELETE(request: Request, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const found = await findInvoice(id);
  if (!found) return notFound("Invoice not found");
  const linked = await db().select({ id: quotationInvoice.id }).from(quotationInvoice).where(eq(quotationInvoice.invoiceId, id)).get();
  if (linked) return badRequest("Quotation-linked invoices are retained with the quotation history.");

  await db().delete(invoice).where(eq(invoice.id, id));
  return mutationJson(auth.user, "DELETE /api/invoices/[id]", { deleted: id });
});
