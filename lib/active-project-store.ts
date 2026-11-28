import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, newId, type SessionUser } from "@/lib/api";
import { inquiry, invoice, meeting, milestone, portalNotificationRead, portalRequest, portalRequestEvent, project, projectFile,
  projectWorkspace, projectWorkspaceEntry, quotation, quotationInvoice, quotationPayment, teamMember } from "@/lib/db/schema";
import { entryFields, minorAmount, projectConfigSchema, projectStageProgress, projectWords, type ActiveEntryInput, type ActiveProjectConfig } from "@/lib/active-project";
import { quoteD1, effectiveQuoteStatus } from "@/lib/quotation-store";
import { calculateQuote } from "@/lib/quotations";
import { safeMeetingLink } from "@/lib/meeting-link";

export type ProjectRow = typeof project.$inferSelect;
type Entry = typeof projectWorkspaceEntry.$inferSelect;
const currentTime = () => Math.floor(Date.now() / 1000);
const quoteReady = ["accepted", "invoiced"];
export const currencyDigits = (currency: string) => {
  try { return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2; }
  catch { return 2; }
};

export async function addActivity(projectId: string, actorId: string, title: string, body = "", reference = "") {
  await db().insert(projectWorkspaceEntry).values({ id: newId(), projectId, actorId, kind: "activity", state: "published",
    data: entryFields.parse({ kind: "activity", title, body, reference }) });
}

export async function activeProjectData(row: ProjectRow, actor: SessionUser) {
  const admin = actor.role === "admin";
  const database = db();
  const [settings, milestones, files, bills, events, projects, link, appointments, people, read] = await Promise.all([
    database.select().from(projectWorkspace).where(eq(projectWorkspace.projectId, row.id)).get(),
    database.select().from(milestone).where(eq(milestone.projectId, row.id)).orderBy(milestone.order),
    database.select({ id: projectFile.id, milestoneId: projectFile.milestoneId, name: projectFile.name,
      createdAt: projectFile.createdAt, folder: projectFile.folder, fileType: projectFile.fileType, fileSize: projectFile.fileSize,
      previousVersionId: projectFile.previousVersionId, clientVisible: projectFile.clientVisible })
      .from(projectFile).where(and(eq(projectFile.projectId, row.id), admin ? undefined : eq(projectFile.clientVisible, true))).orderBy(desc(projectFile.createdAt)),
    database.select({ row: invoice, conversion: quotationInvoice.id, quotationId: quotationInvoice.quotationId }).from(invoice)
      .leftJoin(quotationInvoice, eq(quotationInvoice.invoiceId, invoice.id)).where(and(eq(invoice.projectId, row.id),
        admin ? undefined : sql`${invoice.status}!='draft'`)).orderBy(desc(invoice.dueDate)),
    database.select().from(projectWorkspaceEntry).where(and(eq(projectWorkspaceEntry.projectId, row.id),
      admin ? undefined : sql`(${projectWorkspaceEntry.kind} not in ('report','handover') or ${projectWorkspaceEntry.state}='published')`)).orderBy(asc(projectWorkspaceEntry.createdAt)),
    database.select({ id: project.id, name: project.name, service: project.service, progress: project.progress }).from(project)
      .where(eq(project.clientId, row.clientId)).orderBy(desc(project.createdAt)),
    database.select({ leadId: inquiry.id, managerId: inquiry.assigneeId, requestId: portalRequest.id, requestState: portalRequest.state,
      reference: portalRequest.reference }).from(inquiry).leftJoin(portalRequest, eq(portalRequest.leadId, inquiry.id))
      .where(eq(inquiry.convertedProjectId, row.id)).get(),
    database.select({ id: meeting.id, leadId: meeting.leadId, title: meeting.title, status: meeting.status,
      scheduledAt: meeting.scheduledAt, meetingUrl: meeting.meetingUrl, confirmedAt: meeting.confirmedAt, updatedAt: meeting.updatedAt,
      provider: meeting.provider, requestedChangeAt: meeting.requestedChangeAt, durationMinutes: meeting.durationMinutes })
      .from(meeting).where(and(eq(meeting.clientId, row.clientId), sql`(${meeting.projectId}=${row.id} or
        (${meeting.projectId} is null and ${meeting.leadId} in (select id from inquiry where convertedProjectId=${row.id})))`)),
    database.select({ id: teamMember.id, name: teamMember.name, role: teamMember.role, photoUrl: teamMember.photoUrl })
      .from(teamMember).where(eq(teamMember.published, true)),
    database.select({ key: portalNotificationRead.key }).from(portalNotificationRead).where(eq(portalNotificationRead.userId, actor.id)),
  ]);
  const config = settings?.config ?? projectConfigSchema.parse({ status: row.progress > 0 ? "active" : "preparing", managerId: link?.managerId ?? "" });
  const explicitQuoteIds = events.filter((event) => ["change", "support"].includes(event.kind) && event.data.quoteId).map((event) => event.data.quoteId);
  const approvedQuoteIds = events.filter((event) => event.data.quoteId && (event.kind === "support" || (event.kind === "change" && event.state === "approved"))).map((event) => event.data.quoteId);
  const invoiceQuoteIds = bills.flatMap((bill) => bill.quotationId ? [bill.quotationId] : []);
  const codes = [...new Set([...explicitQuoteIds, ...invoiceQuoteIds])];
  const quotes = await database.select().from(quotation).where(and(eq(quotation.clientId, row.clientId), eq(quotation.deleted, false),
    sql`(${quotation.id} in (select value from json_each(${JSON.stringify(codes)})) or
      ${quotation.number} in (select number from quotation where clientId=${row.clientId} and id in (select value from json_each(${JSON.stringify(codes)}))) or
      (${quotation.leadId} is not null and ${quotation.leadId}=${link?.leadId ?? null}))`)).orderBy(desc(quotation.revision));
  const quoteOptions = admin ? await database.select({ id: quotation.id, number: quotation.number, revision: quotation.revision, status: quotation.status })
    .from(quotation).where(and(eq(quotation.clientId, row.clientId), eq(quotation.deleted, false), eq(quotation.archived, false),
      sql`(${quotation.leadId} is null or ${quotation.leadId}=${link?.leadId ?? null})`)).orderBy(desc(quotation.updatedAt)) : [];
  const clientQuotes = quotes.filter((quote) => quote.sentAt !== null && !quote.archived && !["draft","pending_approval","approved"].includes(quote.status));
  const source = clientQuotes.filter((quote) => quoteReady.includes(quote.status) && !explicitQuoteIds.includes(quote.id))
    .sort((a, b) => (a.acceptedAt ?? Number.MAX_SAFE_INTEGER) - (b.acceptedAt ?? Number.MAX_SAFE_INTEGER))[0];
  const extraQuotes = [...new Map(clientQuotes.filter((quote) => approvedQuoteIds.includes(quote.id) && quoteReady.includes(quote.status))
    .map((quote) => [quote.number, quote])).values()].filter((quote) => quote.number !== source?.number);
  const conversions = bills.flatMap((bill) => bill.conversion ? [bill.conversion] : []);
  const receipts = conversions.length ? await database.select({ id: quotationPayment.id, conversionId: quotationPayment.conversionId,
    receipt: quotationPayment.receipt, amount: quotationPayment.amount, receivedOn: quotationPayment.receivedOn })
    .from(quotationPayment).where(sql`${quotationPayment.conversionId} in (select value from json_each(${JSON.stringify(conversions)}))`) : [];
  const invoices = bills.map(({ row: bill, conversion, quotationId }) => {
    const linkedQuote = quotes.find(({ id }) => id === quotationId);
    const digits = linkedQuote?.digits ?? currencyDigits(bill.currency);
    const amount = Math.round(bill.amount * 10 ** digits);
    const payments = conversion ? receipts.filter((receipt) => receipt.conversionId === conversion) :
      events.filter((event) => event.kind === "proof" && event.state === "verified" && event.data.invoiceId === bill.id)
        .map((event) => ({ id: event.id, receipt: event.data.receipt ?? event.data.reference, amount: event.data.amountMinor ?? 0, receivedOn: event.data.date }));
    const paid = payments.reduce((sum, item) => sum + item.amount, 0);
    return { ...bill, digits, minor: amount, payments, paid, recurring: Boolean(linkedQuote && linkedQuote.oneTime === 0 && linkedQuote.monthly > 0),
      balance: bill.status === "paid" ? 0 : Math.max(0, amount - paid),
      displayStatus: bill.status === "sent" && bill.dueDate.getTime() < Date.now() ? "overdue" : bill.status };
  });
  const agreements = [...(source ? [source] : []), ...extraQuotes].map((quote) => ({
    id: quote.id, number: quote.number, revision: quote.revision, currency: quote.currency, digits: quote.digits,
    oneTime: quote.oneTime, monthly: quote.monthly, original: quote.id === source?.id, title: quote.input.title,
    schedule: calculateQuote(quote.input).milestones, acceptedAt: quote.acceptedAt,
  }));
  const rates = new Map<string, { currency: string; digits: number; original: number; extras: number; monthly: number; contracted: number; invoiced: number; oneTimeInvoiced: number; verified: number; outstanding: number; unbilled: number; hasAgreement: boolean }>();
  const group = (currency: string, digits: number) => {
    const key = currency + ":" + digits;
    if (!rates.has(key)) rates.set(key, { currency, digits, original: 0, extras: 0, monthly: 0, contracted: 0, invoiced: 0, oneTimeInvoiced: 0, verified: 0, outstanding: 0, unbilled: 0, hasAgreement: false });
    return rates.get(key)!;
  };
  for (const item of agreements) {
    const result = group(item.currency, item.digits);
    result.hasAgreement = true;
    if (item.original) result.original += item.oneTime; else result.extras += item.oneTime;
    result.monthly += item.monthly;
    result.contracted += item.oneTime;
  }
  for (const bill of invoices.filter(({ status }) => status !== "draft")) {
    const result = group(bill.currency, bill.digits);
    result.invoiced += bill.minor;
    if (!bill.recurring) result.oneTimeInvoiced += bill.minor;
    result.verified += bill.paid; result.outstanding += bill.balance;
  }
  for (const item of rates.values()) item.unbilled = Math.max(0, item.contracted - item.oneTimeInvoiced);
  const publicEntries = events.filter((event) => admin || (event.kind === "module" ? Boolean(event.data.module && config.modules.includes(event.data.module)) : event.kind !== "feedback" || event.actorId === actor.id))
    .map(({ actorId, ...event }) => ({ ...event, own: actorId === actor.id,
      ...(admin || event.kind !== "milestone_review" ? {} : { actorId }) }));
  const readKeys = new Set(read.map(({ key }) => key));
  const notify = (key: string, title: string, tab: string, time: number, item?: string) =>
    ({ key: "project:" + row.id + ":" + key, title, url: "/portal/project/" + row.id + "/" + tab + (item ? "#" + item : ""),
      time, read: readKeys.has("project:" + row.id + ":" + key) });
  const notifications = [
    notify("active", "Project workspace available", "overview", row.createdAt.getTime() / 1000),
    ...milestones.filter((item) => item.status === "awaiting_approval")
      .map((item) => notify("review:" + item.id + ":" + item.reviewVersion, item.title + " is ready for review", "milestones", item.updatedAt.getTime() / 1000, item.id)),
    ...files.filter((file) => file.clientVisible).map((file) => notify("file:" + file.id, "File shared: " + file.name, "files", file.createdAt.getTime() / 1000, file.id)),
    ...invoices.filter((bill) => bill.status !== "draft").flatMap((bill) => [
      notify("invoice:" + bill.id, "Invoice " + bill.number + " is available", "invoices", bill.createdAt.getTime() / 1000, bill.id),
      ...(bill.balance > 0 && bill.dueDate.getTime() / 1000 - currentTime() < 3 * 86400 ? [notify("due:" + bill.id, "Payment due for " + bill.number, "invoices", bill.dueDate.getTime() / 1000 - 3 * 86400, bill.id)] : []),
    ]),
    ...appointments.filter((item)=>item.confirmedAt).map((item)=>notify("meeting:"+item.id+":"+item.confirmedAt!.getTime(),"Meeting confirmed or updated: "+item.title,"meetings",item.confirmedAt!.getTime()/1000)),
    ...events.filter((entry) => entry.kind !== "feedback" &&
      !(entry.kind === "message" && entry.actorId === actor.id) && (entry.kind === "module" ? Boolean(entry.data.module && config.modules.includes(entry.data.module)) : !["open", "pending"].includes(entry.state)))
      .map((entry) => notify("event:" + entry.id + ":" + entry.version, entry.kind === "message" ? "New project message" :
        entry.kind === "proof" ? "Payment proof " + entry.state : entry.kind === "milestone_review" ? "Milestone review recorded" : entry.data.title || "Project updated", entry.kind === "activity" ? "timeline" : entry.kind === "milestone_review" ? "milestones" :
        entry.kind === "message" ? "messages" : entry.kind === "proof" ? "invoices" : entry.kind === "report" ? "reports" :
        entry.kind === "change" ? "changes" : entry.kind === "module" ? "service" : entry.kind === "handover" ? "handover" : "support", entry.updatedAt, entry.kind === "milestone_review" ? entry.data.reference : entry.id)),
  ].sort((a, b) => b.time - a.time);
  const staffNotifications = admin ? events.filter((entry)=>entry.actorId===row.clientId &&
    ["message","milestone_review","proof","change","support","feedback"].includes(entry.kind)).map((entry)=>{
    const area = entry.kind==="message" ? (entry.data.parentId ? "requests" : "messages") :
      ["support","change"].includes(entry.kind) ? "requests" : entry.kind==="proof" ? "payments" : "reviews";
    const title = entry.kind==="milestone_review" ? "Client " + (entry.state==="approved" ? "approved a milestone" : "requested milestone changes") :
      entry.kind==="proof" ? "New payment proof" : entry.kind==="feedback" ? "New client feedback" :
      entry.kind==="message" ? "New client message" : entry.data.title;
    return { ...notify("staff:"+entry.id,title,"overview",entry.createdAt), url: area };
  }).sort((a,b)=>b.time-a.time) : [];
  const requestMessages = link?.requestId ? await database.select({ id: portalRequestEvent.id, kind: portalRequestEvent.kind,
    body: portalRequestEvent.body, createdAt: portalRequestEvent.createdAt }).from(portalRequestEvent)
    .where(and(eq(portalRequestEvent.requestId, link.requestId), inArray(portalRequestEvent.kind, ["client_message", "staff_message", "needs_info"]))) : [];
  return { project: row, reference: link?.reference ?? row.id, link, settingsVersion: settings?.version ?? 0, config,
    progress: projectStageProgress(config.stages, row.progress), projects, milestones, files, invoices, financial: [...rates.values()], agreements,
    quotes: (admin ? quotes : clientQuotes).map(({ id, number, revision, status, expiry, input }) => ({ id, number, revision,
      status: effectiveQuoteStatus({ status, expiry }), expiry, title: input.title })),
    events: publicEntries, quoteOptions, appointments: appointments.map((item) => ({ ...item, meetingUrl: safeMeetingLink(item.meetingUrl) })),
    requestMessages, notifications: admin ? staffNotifications : notifications,
    team: people.filter((person) => config.team.includes(person.id) || config.managerId === person.id),
    teamOptions: admin ? people : [],
  };
}

export async function verifyProjectProof(row: ProjectRow, entry: Entry, reviewer: SessionUser, receipt: string, receivedOn: string) {
  const database = db();
  const found = await database.select({ bill: invoice, conversion: quotationInvoice, digits: quotation.digits }).from(invoice)
    .leftJoin(quotationInvoice, eq(quotationInvoice.invoiceId, invoice.id))
    .leftJoin(quotation, eq(quotation.id, quotationInvoice.quotationId))
    .where(and(eq(invoice.id, entry.data.invoiceId), eq(invoice.projectId, row.id))).get();
  if (!found || !["sent", "overdue"].includes(found.bill.status)) return false;
  const digits = found.digits ?? currencyDigits(found.bill.currency);
  const amount = minorAmount(entry.data.amount, digits);
  if (!amount) return false;
  const eventId = newId();
  const savedData = JSON.stringify({ ...entry.data, receipt, date: receivedOn, receivedOn, reviewedAt: currentTime(), amountMinor: amount, currency: found.bill.currency, digits });
  const d1 = quoteD1();
  const total = Math.round(found.bill.amount * 10 ** digits);
  const verified = `select coalesce(sum(cast(json_extract(data,'$.amountMinor') as integer)),0) from project_workspace_entry
    where projectId=? and kind='proof' and state='verified' and json_extract(data,'$.invoiceId')=?`;
  const guard = "exists(select 1 from invoice where id=? and projectId=? and status in ('sent','overdue') and amount=? and currency=?)";
  const operations = [];
  if (found.conversion) {
    operations.push(d1.prepare(`insert or ignore into quotation_payment (id,conversionId,receipt,amount,receivedOn,createdBy)
      select ?,?,?,?,?,? from project_workspace_entry where id=? and projectId=? and version=? and state='pending' and ${guard}
      and ? <= ? - (select coalesce(sum(amount),0) from quotation_payment where conversionId=?)`)
      .bind(eventId, found.conversion.id, receipt, amount, receivedOn, reviewer.id, entry.id, row.id, entry.version,
        found.bill.id, row.id, found.bill.amount, found.bill.currency, amount, total, found.conversion.id));
    operations.push(d1.prepare("update project_workspace_entry set data=?,state='verified',version=version+1,updatedAt=unixepoch() where id=? and exists(select 1 from quotation_payment where id=?)")
      .bind(savedData, entry.id, eventId));
    operations.push(d1.prepare(`update invoice set status='paid',updatedAt=unixepoch() where id=? and exists(select 1 from quotation_payment where id=?)
      and (select sum(amount) from quotation_payment where conversionId=?)=?`).bind(found.bill.id, eventId, found.conversion.id, total));
  } else {
    operations.push(d1.prepare(`update project_workspace_entry set data=?,state='verified',version=version+1,updatedAt=unixepoch()
      where id=? and projectId=? and version=? and state='pending' and ${guard} and ?<=?-(${verified})
      and not exists(select 1 from project_workspace_entry where projectId=? and kind='proof' and state='verified' and json_extract(data,'$.receipt')=?)`)
      .bind(savedData, entry.id, row.id, entry.version, found.bill.id, row.id, found.bill.amount, found.bill.currency,
        amount, total, row.id, found.bill.id, row.id, receipt));
    operations.push(d1.prepare(`update invoice set status='paid',updatedAt=unixepoch() where id=? and (${verified})=?`)
      .bind(found.bill.id, row.id, found.bill.id, total));
  }
  return Boolean((await d1.batch(operations))[0].meta.changes);
}

export async function saveProjectConfig(row: ProjectRow, actor: SessionUser, config: ActiveProjectConfig, note: string, version: number) {
  const d1 = quoteD1();
  const target = config.target ? Date.parse(config.target) / 1000 : row.targetDate.getTime() / 1000;
  const start = config.start ? Date.parse(config.start) / 1000 : row.startDate.getTime() / 1000;
  if (target < start) return false;
  const event = newId();
  const record = await d1.batch([
    d1.prepare(`insert into project_workspace_entry(id,projectId,actorId,kind,state,data)
      select ?,id,?,'activity','published',? from project where id=? and coalesce((select version from project_workspace where projectId=?),0)=?`)
      .bind(event, actor.id, JSON.stringify(entryFields.parse({ kind: "activity", title: config.status === "completed" ? "Project completed" : "Project plan updated",
        body: note || projectWords[config.status] })), row.id, row.id, version),
    d1.prepare(`insert into project_workspace(projectId,config,version) select ?,?,? where exists(select 1 from project_workspace_entry where id=?)
      on conflict(projectId) do update set config=excluded.config,version=excluded.version`).bind(row.id, JSON.stringify(config), version + 1, event),
    d1.prepare(`update project set startDate=?,targetDate=?,updatedAt=unixepoch()
      where id=? and exists(select 1 from project_workspace_entry where id=?)`).bind(start, target, row.id, event),
  ]);
  return Boolean(record[0].meta.changes);
}
