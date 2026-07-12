import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  db,
  json,
  loadProject,
  notFound,
  parseBody,
  requireAdmin,
  requireSession,
  toDate,
} from "@/lib/api";
import { invoice } from "@/lib/db/schema";

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
export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const found = await findInvoice(id);
  if (!found) return notFound("Invoice not found");

  // Ownership is derived from the parent project.
  const project = await loadProject(found.projectId, auth.user);
  if (project instanceof Response) return notFound("Invoice not found");

  return json({ invoice: found });
}

/** PATCH — admin only (e.g. mark paid). */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const found = await findInvoice(id);
  if (!found) return notFound("Invoice not found");

  const body = await parseBody(request, patchInvoice);
  if (body instanceof Response) return body;

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

  return json({ invoice: updated });
}

/** DELETE — admin only. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const found = await findInvoice(id);
  if (!found) return notFound("Invoice not found");

  await db().delete(invoice).where(eq(invoice.id, id));
  return json({ deleted: id });
}
