import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, desc, eq, sql } from "drizzle-orm";

import { db, newId } from "@/lib/api";
import { invoice, lead, project, quotation, quotationActivity, quotationInvoice, quotationPayment, quotationShare,
  quotationSettings, service, teamMember, user } from "@/lib/db/schema";
import { publicQuotation } from "@/lib/quotation-public";
import { calculateQuote, DEFAULT_QUOTE_SETTINGS, quoteDateToday, type QuoteInput, type QuoteStatus } from "@/lib/quotations";

export const quoteD1 = () => getCloudflareContext().env.DB;
export type QuoteRow = typeof quotation.$inferSelect;

export class QuoteError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

export function quoteExpiresAt(date: string) {
  return Date.parse(date + "T19:00:00.000Z") / 1000;
}

export const expirable = ["draft", "pending_approval", "approved", "sent", "viewed", "revision_requested"] as const;
export function effectiveQuoteStatus(row: QuoteRow): QuoteStatus {
  return row.expiry < quoteDateToday() && expirable.some(status => status === row.status) ? "expired" : row.status;
}

export async function quotationDefaults() {
  return (await db().select().from(quotationSettings).where(eq(quotationSettings.id, "company")).get())?.data ?? DEFAULT_QUOTE_SETTINGS;
}

export async function loadQuotation(id: string) {
  return db().select().from(quotation).where(and(eq(quotation.id, id), eq(quotation.deleted, false))).get();
}

export async function quotationDetail(id: string) {
  const quote = await loadQuotation(id);
  if (!quote) throw new QuoteError("Quotation not found.", 404);
  const database = db();
  const [history, revisions, conversion, links] = await Promise.all([
    database.select({ id: quotationActivity.id, kind: quotationActivity.kind, details: quotationActivity.details,
      createdAt: quotationActivity.createdAt, actor: user.name }).from(quotationActivity)
      .leftJoin(user, eq(quotationActivity.actorId, user.id)).where(eq(quotationActivity.quotationId, id))
      .orderBy(desc(quotationActivity.createdAt), desc(quotationActivity.id)).limit(100),
    database.select({ id: quotation.id, revision: quotation.revision, status: quotation.status })
      .from(quotation).where(and(eq(quotation.number, quote.number), eq(quotation.deleted, false))).orderBy(desc(quotation.revision)),
    database.select({ id: quotationInvoice.id, invoiceId: quotationInvoice.invoiceId, status: invoice.status, number: invoice.number })
      .from(quotationInvoice).leftJoin(invoice, eq(quotationInvoice.invoiceId, invoice.id)).where(eq(quotationInvoice.quotationId, id)).get(),
    database.select({ id: quotationShare.id, expiresAt: quotationShare.expiresAt, revokedAt: quotationShare.revokedAt,
      viewedAt: quotationShare.viewedAt, usedAt: quotationShare.usedAt }).from(quotationShare)
      .where(eq(quotationShare.quotationId, id)).orderBy(desc(quotationShare.createdAt)).limit(20),
  ]);
  const receipts = conversion ? await database.select().from(quotationPayment)
    .where(eq(quotationPayment.conversionId, conversion.id)).orderBy(desc(quotationPayment.receivedOn)) : [];
  return { quote: { ...quote, storedStatus: quote.status, status: effectiveQuoteStatus(quote) }, history, revisions, conversion, receipts, links };
}

function activity(id: string, quoteId: string, actor: string | null, kind: string, details = "") {
  return quoteD1().prepare(`insert into quotation_activity (id,quotationId,actorId,kind,details)
    select ?,id,?,?,? from quotation where id=? and lastActionId=?`).bind(id, actor, kind, details, quoteId, id);
}

async function draftData(input: QuoteInput, existing?: QuoteRow) {
  const database = db();
  const configured = await quotationDefaults();
  const settings = existing?.branding ?? configured;
  const digits = input.currency === existing?.currency ? existing.digits : configured.currencies.find(c => c.code === input.currency)?.digits;
  if (digits === undefined) throw new QuoteError("Select an enabled currency.");
  let totals;
  try { totals = calculateQuote(input); } catch (error) {
    throw new QuoteError(error instanceof Error ? error.message : "Invalid quotation totals.");
  }
  const [source, staff, services, matches] = await Promise.all([
    input.inquiryId ? database.select({ id: lead.id }).from(lead).where(eq(lead.id, input.inquiryId)).get() : undefined,
    input.assigneeId ? database.select({ id: teamMember.id }).from(teamMember).where(eq(teamMember.id, input.assigneeId)).get() : undefined,
    database.select({ id: service.id }).from(service),
    database.select({ id: user.id, role: user.role, email: user.email }).from(user)
      .where(input.clientId ? eq(user.id, input.clientId) : sql`lower(${user.email}) = ${input.client.email}`),
  ]);
  if (input.inquiryId && !source) throw new QuoteError("The original inquiry or lead no longer exists.");
  if (input.assigneeId && !staff) throw new QuoteError("Select a valid team member.");
  if (input.lines.some(line => line.serviceId && !services.some(s => s.id === line.serviceId) &&
    !existing?.input.lines.some(previous => previous.serviceId === line.serviceId))) throw new QuoteError("A line references a service that no longer exists.");
  if (input.clientId && matches[0]?.role !== "client") throw new QuoteError("Select an existing client.");
  if (input.clientId && matches[0]?.email.toLowerCase() !== input.client.email) throw new QuoteError("The recipient email must match the selected client account.");
  if (!input.clientId && (matches.length > 1 || matches.some(match => match.role !== "client"))) throw new QuoteError("This email cannot be linked automatically. Verify the recipient and select the correct client.");
  return { settings, digits, totals };
}

export async function saveQuotation(actor: string, input: QuoteInput, existing?: QuoteRow, expected?: number) {
  if (existing && (existing.status !== "draft" || existing.archived || existing.version !== expected))
    throw new QuoteError("The draft changed or is locked. Reload before editing.", 409);
  const { settings, digits, totals } = await draftData(input, existing);
  const d1 = quoteD1();
  const id = existing?.id ?? newId();
  const event = newId();
  const year = Number(quoteDateToday().slice(0, 4));
  const operations: D1PreparedStatement[] = [];
  const editGuard = existing ? " and exists(select 1 from quotation where id=? and version=? and status='draft' and archived=0 and deleted=0)" : "";
  const editKeys = existing ? [id, expected] : [];
  if (input.createClient && !input.clientId) {
    operations.push(d1.prepare(`insert into user (id,email,name,company,phone,role)
      select ?,?,?,?,?,'client' where not exists(select 1 from user where lower(email)=?)${editGuard}
      on conflict do nothing`).bind(newId(), input.client.email, input.client.name, input.client.company || null,
      input.client.phone || null, input.client.email, ...editKeys));
  }
  const client = input.clientId
    ? "(select id from user where id=? and role='client' and lower(email)=?)"
    : "(select min(id) from user where lower(email)=? having count(*)=1 and min(role)='client')";
  const clientParams = input.clientId ? [input.clientId, input.client.email] : [input.client.email];
  const requireLink = input.createClient || Boolean(input.clientId);
  const clientGuard = requireLink ? ` and ${client} is not null` : "";
  const fields = [input.inquiryId, input.assigneeId, input.issue, input.expiry, input.currency, digits,
    JSON.stringify({ ...input, createClient: false }), totals.oneTime.total, totals.monthly.total,
    totals.oneTime.profit, totals.monthly.profit, event];
  if (existing) {
    operations.push(d1.prepare(`update quotation set clientId=${client},leadId=?,assigneeId=?,issue=?,expiry=?,currency=?,digits=?,
      input=?,oneTime=?,monthly=?,oneTimeProfit=?,monthlyProfit=?,lastActionId=?,version=version+1,updatedAt=unixepoch()
      where id=? and version=? and status='draft' and archived=0 and deleted=0${clientGuard}`).bind(
      ...clientParams, ...fields, id, expected, ...(requireLink ? clientParams : [])));
  } else {
    operations.push(d1.prepare(`insert into quotation
      (id,number,year,sequence,clientId,leadId,assigneeId,issue,expiry,currency,digits,input,oneTime,monthly,oneTimeProfit,monthlyProfit,lastActionId,branding)
      select ?, ? || '-' || printf('%04d', ?) || '-' || printf(?, nextNumber), ?, nextNumber,${client},?,?,?,?,?,?,?,?,?,?,?,?,?
      from (select coalesce(max(sequence),0)+1 as nextNumber from quotation where year=?)
      where 1=1${clientGuard}`).bind(id, settings.prefix, year, "%0" + settings.sequenceDigits + "d", year,
      ...clientParams, ...fields, JSON.stringify(settings), year, ...(requireLink ? clientParams : [])));
  }
  operations.push(activity(event, id, actor, existing ? "edited" : "created"));
  const result = await d1.batch(operations);
  if (!result.at(-2)?.meta.changes) throw new QuoteError("The quotation or client changed. Reload and try again.", 409);
  return (await loadQuotation(id))!;
}

const changes: Partial<Record<string, { from: QuoteStatus[]; to: QuoteStatus }>> = {
  submit: { from: ["draft"], to: "pending_approval" },
  approve: { from: ["pending_approval"], to: "approved" },
  return: { from: ["pending_approval", "approved"], to: "draft" },
  sent: { from: ["approved"], to: "sent" },
  accept: { from: ["sent", "viewed"], to: "accepted" },
  decline: { from: ["sent", "viewed"], to: "declined" },
  revise: { from: ["sent", "viewed"], to: "revision_requested" },
  cancel: { from: ["draft", "pending_approval", "approved", "sent", "viewed", "revision_requested"], to: "cancelled" },
};

type PublicResponse = { shareId: string; codeHash: string };

export async function changeQuotation(row: QuoteRow, action: string, actor: string | null, version: number, note = "", recipient?: PublicResponse) {
  const transition = changes[action];
  if (!transition || !transition.from.includes(row.status) || row.archived || row.version !== version ||
    (action !== "cancel" && effectiveQuoteStatus(row) === "expired")) throw new QuoteError("This action is unavailable for the current quotation.", 409);
  if (!actor && (!recipient || !["accept", "decline", "revise"].includes(action))) throw new QuoteError("Recipient confirmation is required.", 403);
  const event = newId();
  const d1 = quoteD1();
  const valid = recipient ? ` and exists(select 1 from quotation_share where id=? and quotationId=quotation.id
      and codeHash=? and usedAt is null and revokedAt is null and expiresAt>unixepoch())` : "";
  const results = await d1.batch([
    d1.prepare(`update quotation set status=?,version=version+1,lastActionId=?,updatedAt=unixepoch(),
      sentAt=case when ?='sent' then unixepoch() else sentAt end,
      acceptedAt=case when ?='accepted' then unixepoch() else acceptedAt end
      where id=? and version=? and status=? and deleted=0 and archived=0
      and (?='cancel' or expiry>=?)
      and not exists(select 1 from quotation newer where newer.number=quotation.number and newer.revision>quotation.revision and newer.deleted=0)${valid}`)
      .bind(transition.to, event, transition.to, transition.to, row.id, version, row.status, action, quoteDateToday(),
        ...(recipient ? [recipient.shareId, recipient.codeHash] : [])),
    ...(recipient ? [d1.prepare(`update quotation_share set usedAt=unixepoch() where id=? and
      exists(select 1 from quotation where id=? and lastActionId=?)`).bind(recipient.shareId, row.id, event)] : []),
    ...(["return","cancel"].includes(action) ? [d1.prepare(`update quotation_share set revokedAt=unixepoch()
      where quotationId=? and revokedAt is null and exists(select 1 from quotation where id=? and lastActionId=?)`)
      .bind(row.id,row.id,event)] : []),
    activity(event, row.id, actor, actor ? action : "recipient_" + action, note),
  ]);
  if (!results[0].meta.changes) throw new QuoteError("This quotation changed. Reload and try again.", 409);
  return (await loadQuotation(row.id))!;
}

export async function copyQuotation(row: QuoteRow, actor: string, revision: boolean) {
  if (!revision) {
    const input = { ...row.input, clientId: row.clientId, inquiryId: row.leadId, assigneeId: row.assigneeId, createClient: false };
    const issue = quoteDateToday();
    return saveQuotation(actor, { ...input, issue, expiry: new Date(Date.parse(issue) + row.branding.validityDays * 86_400_000).toISOString().slice(0, 10) });
  }
  if (row.status === "draft" || row.archived || row.status === "invoiced") throw new QuoteError("This quotation cannot be revised.", 409);
  const d1 = quoteD1();
  const id = newId();
  const event = newId();
  const issue = quoteDateToday();
  const expiry = new Date(Date.parse(issue) + row.branding.validityDays * 86_400_000).toISOString().slice(0, 10);
  const results = await d1.batch([
    d1.prepare(`insert into quotation (id,number,year,sequence,revision,previousId,clientId,leadId,assigneeId,issue,expiry,currency,digits,input,branding,oneTime,monthly,oneTimeProfit,monthlyProfit,lastActionId)
      select ?,number,year,sequence,(select max(revision)+1 from quotation where number=q.number),id,clientId,leadId,assigneeId,?,?,currency,digits,
        json_set(input,'$.issue',?,'$.expiry',?),branding,oneTime,monthly,oneTimeProfit,monthlyProfit,?
      from quotation q where id=? and version=? and deleted=0 and archived=0 and status not in ('draft','invoiced')
      and not exists(select 1 from quotation newer where newer.number=q.number and newer.revision>q.revision and newer.deleted=0)`)
      .bind(id, issue, expiry, issue, expiry, event, row.id, row.version),
    activity(event, id, actor, "revision_created", "Revises " + row.number + " / " + row.revision),
    d1.prepare(`update quotation_share set revokedAt=unixepoch() where revokedAt is null
      and quotationId in (select id from quotation where number=? and id<>?)
      and exists(select 1 from quotation where id=? and lastActionId=?)`).bind(row.number,id,id,event),
  ]);
  if (!results[0].meta.changes) throw new QuoteError("Only the latest eligible quotation can be revised.", 409);
  return (await loadQuotation(id))!;
}

export async function setQuotationArchived(row: QuoteRow, actor: string, action: "archive" | "restore" | "delete", version: number) {
  if (action === "delete" && (row.status !== "draft" || row.sentAt)) throw new QuoteError("Only drafts that have never been sent may be deleted.");
  const d1 = quoteD1();
  const event = newId();
  const batch = await d1.batch([
    d1.prepare(`update quotation set archived=?,deleted=?,lastActionId=?,updatedAt=unixepoch(),version=version+1
      where id=? and version=? and deleted=0`).bind(Number(action !== "restore"), Number(action === "delete"), event, row.id, version),
    activity(event, row.id, actor, action),
    ...(action !== "restore" ? [d1.prepare(`update quotation_share set revokedAt=unixepoch()
      where quotationId=? and revokedAt is null and exists(select 1 from quotation where id=? and lastActionId=?)`)
      .bind(row.id,row.id,event)] : []),
  ]);
  if (!batch[0].meta.changes) throw new QuoteError("This quotation changed.", 409);
}

export async function convertQuotation(row: QuoteRow, actor: string, projectId: string, due: string, version: number) {
  if (row.status !== "accepted" || row.archived || !row.clientId) throw new QuoteError("An accepted quotation and linked client are required.");
  const destination = projectId ? await db().select().from(project).where(and(eq(project.id, projectId), eq(project.clientId, row.clientId))).get() : null;
  if (projectId && !destination) throw new QuoteError("Select a project belonging to this client.");
  const linked = await db().select().from(quotationInvoice).where(eq(quotationInvoice.quoteNumber, row.number)).get();
  if (linked) throw new QuoteError("This quotation already has an invoice.", 409);

  const d1 = quoteD1();
  const event = newId();
  const invoiceId = newId();
  const destinationId = destination?.id ?? newId();
  const number = row.number + "-R" + row.revision + "-INV";
  const guard = "exists(select 1 from quotation where id=? and lastActionId=?)";
  // Monthly-only agreements generate their first monthly invoice. Mixed agreements invoice their one-time charges.
  const amount = (row.oneTime || row.monthly) / 10 ** row.digits;
  const result = await d1.batch([
    d1.prepare(`update quotation set status='invoiced',version=version+1,updatedAt=unixepoch(),lastActionId=?
      where id=? and version=? and status='accepted' and archived=0 and deleted=0 and clientId is not null
      and (? = 1 or exists(select 1 from project where id=? and clientId=quotation.clientId))
      and not exists(select 1 from quotation newer where newer.number=quotation.number and newer.revision>quotation.revision and newer.deleted=0)
      and not exists(select 1 from quotation_invoice where quoteNumber=quotation.number)`).bind(event, row.id, version, Number(!destination), destinationId),
    ...(!destination ? [d1.prepare(`insert into project(id,clientId,name,service,startDate,targetDate)
      select ?,clientId,?,?,?,? from quotation where id=? and lastActionId=?`).bind(
      destinationId, row.input.title.slice(0, 160), row.input.lines[0].name.slice(0, 80), Date.parse(row.issue)/1000,
      Math.max(Date.parse(due), Date.parse(row.issue))/1000, row.id, event)] : []),
    d1.prepare(`insert into invoice (id,projectId,number,amount,currency,dueDate) select ?,?,?,?,?,? where ${guard}`)
      .bind(invoiceId, destinationId, number, amount, row.currency, Date.parse(due) / 1000, row.id, event),
    d1.prepare(`insert into quotation_invoice (id,quoteNumber,quotationId,invoiceId,snapshot) select ?,?,?,?,? where ${guard}`)
      .bind(newId(), row.number, row.id, invoiceId, JSON.stringify(publicQuotation(row)), row.id, event),
    activity(event, row.id, actor, "invoice_created", number),
  ]);
  if (!result[0].meta.changes) throw new QuoteError("This quotation changed or was already invoiced.", 409);
  return { invoiceId, number, projectId: destinationId };
}

export async function recordQuotationPayment(row: QuoteRow, actor: string, amount: number, receipt: string, receivedOn: string) {
  const d1 = quoteD1();
  const id = newId();
  const result = await d1.batch([
    d1.prepare(`insert into quotation_payment (id,conversionId,receipt,amount,receivedOn,createdBy)
      select ?,c.id,?,?,?,? from quotation_invoice c inner join invoice i on i.id=c.invoiceId
      where c.quotationId=? and ? <= round(i.amount * ?) - coalesce((select sum(p.amount) from quotation_payment p where p.conversionId=c.id),0)
      on conflict do nothing`).bind(id, receipt, amount, receivedOn, actor, row.id, amount, 10 ** row.digits),
    d1.prepare(`insert into quotation_activity (id,quotationId,actorId,kind,details)
      select ?,?,?,'payment_recorded',? where exists(select 1 from quotation_payment where id=?)`).bind(id, row.id, actor, receipt, id),
    d1.prepare(`update invoice set status='paid',updatedAt=unixepoch() where id=(
      select c.invoiceId from quotation_invoice c where c.quotationId=? and exists(select 1 from quotation_payment where id=?)
      and (select sum(p.amount) from quotation_payment p where p.conversionId=c.id)=round(invoice.amount*?))`)
      .bind(row.id, id, 10 ** row.digits),
  ]);
  if (!result[0].meta.changes) throw new QuoteError("Receipt is duplicate, exceeds the invoice balance, or the linked invoice is unavailable.", 409);
}

