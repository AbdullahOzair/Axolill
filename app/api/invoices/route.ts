import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  db,
  json,
  loadProject,
  newId,
  parseBody,
  requireAdmin,
  requireSession,
  toDate,
} from "@/lib/api";
import { invoice, project } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const createInvoice = z.object({
  projectId: z.string().min(1),
  number: z.string().min(1).max(60),
  amount: z.number().nonnegative(),
  currency: z.string().length(3).optional(),
  status: z.enum(["draft", "sent", "paid", "overdue"]).optional(),
  dueDate: z.iso.datetime().or(z.iso.date()),
});

/**
 * GET — admins see all invoices; clients see only invoices for their own
 * projects (joined through project.clientId).
 * Optional ?projectId= filter.
 */
export async function GET(request: Request) {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;

  const projectId = new URL(request.url).searchParams.get("projectId");

  if (auth.user.role === "admin") {
    const rows = projectId
      ? await db()
          .select()
          .from(invoice)
          .where(eq(invoice.projectId, projectId))
          .orderBy(desc(invoice.dueDate))
      : await db().select().from(invoice).orderBy(desc(invoice.dueDate));
    return json({ invoices: rows });
  }

  // Client: scope to their own projects.
  const rows = await db()
    .select({ invoice })
    .from(invoice)
    .innerJoin(project, eq(invoice.projectId, project.id))
    .where(eq(project.clientId, auth.user.id))
    .orderBy(desc(invoice.dueDate));

  const invoices = rows
    .map((r) => r.invoice)
    .filter((i) => (projectId ? i.projectId === projectId : true));

  return json({ invoices });
}

/** POST — admin only. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const body = await parseBody(request, createInvoice);
  if (body instanceof Response) return body;

  // Make sure the project exists before attaching an invoice to it.
  const found = await loadProject(body.projectId, auth.user);
  if (found instanceof Response) return found;

  const [created] = await db()
    .insert(invoice)
    .values({
      id: newId(),
      projectId: body.projectId,
      number: body.number,
      amount: body.amount,
      currency: body.currency ?? "USD",
      status: body.status ?? "draft",
      dueDate: toDate(body.dueDate),
    })
    .returning();

  return json({ invoice: created }, 201);
}
