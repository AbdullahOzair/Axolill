import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, filesBucket, newId, type SessionUser } from "@/lib/api";
import { inquiry, inquiryActivity, meeting, portalAttachment, portalNotificationRead, portalRequest, portalRequestEvent, project, quotation, user, inquiryService } from "@/lib/db/schema";
import { loadInquiryServices, loadInquirySettings } from "@/lib/inquiry-server";
import { safeMeetingLink } from "@/lib/meeting-link";
import { defaultBudgetRanges, getWorkspaceStatus, validateBrief, type WorkspaceInput } from "@/lib/portal-workspace";
import { effectiveQuoteStatus } from "@/lib/quotation-store";

export const workspaceD1 = () => getCloudflareContext().env.DB;

export function workspacePolicy() {
  const env = getCloudflareContext().env;
  const ranges = { ...defaultBudgetRanges };
  if (env.PORTAL_BUDGET_RANGES) {
    try {
      const custom = JSON.parse(env.PORTAL_BUDGET_RANGES) as Partial<Record<keyof typeof ranges, unknown>>;
      for (const currency of Object.keys(ranges) as (keyof typeof ranges)[]) {
        const list = custom?.[currency];
        if (Array.isArray(list) && list.length <= 12 && list.every((entry) => typeof entry === "string" && entry.trim() && entry.length <= 100)) ranges[currency] = list;
      }
    } catch { /* Use the default estimates if configuration is malformed. */ }
  }
  return { responseTime: env.PORTAL_RESPONSE_TIME?.trim().slice(0, 180) || "", ranges };
}

export async function workspaceRequest(id: string, ownerId?: string) {
  return db().select().from(portalRequest).where(and(eq(portalRequest.id, id), ownerId ? eq(portalRequest.ownerId, ownerId) : undefined)).get();
}

export type WorkspaceRow = NonNullable<Awaited<ReturnType<typeof workspaceRequest>>>;

const publicQuoteStates = ["sent", "viewed", "accepted", "declined", "revision_requested", "invoiced", "cancelled"] as const;
const quoteFields = { canRespond: sql<number>`not exists (
  select 1 from quotation newer where newer.number=${quotation.number} and newer.revision>${quotation.revision} and newer.deleted=0
)`.mapWith(Boolean), id: quotation.id, clientId: quotation.clientId, leadId: quotation.leadId, number: quotation.number,
  revision: quotation.revision, status: quotation.status, expiry: quotation.expiry, updatedAt: quotation.updatedAt, sentAt: quotation.sentAt };

export function ownedQuotations(ownerId: string) {
  return db().select(quoteFields).from(quotation).where(and(eq(quotation.clientId, ownerId), eq(quotation.deleted, false),
    eq(quotation.archived, false), inArray(quotation.status, publicQuoteStates), isNotNull(quotation.sentAt))).orderBy(desc(quotation.revision), desc(quotation.updatedAt));
}

export async function workspaceQuotations(ownerId: string) {
  return (await ownedQuotations(ownerId)).filter((row) => row.sentAt !== null)
    .map((row) => ({ ...row, status: effectiveQuoteStatus(row) }));
}

export async function workspaceEvents(id: string) {
  return db().select({ id: portalRequestEvent.id, kind: portalRequestEvent.kind, body: portalRequestEvent.body,
    createdAt: portalRequestEvent.createdAt, readAt: portalRequestEvent.readAt })
    .from(portalRequestEvent).where(eq(portalRequestEvent.requestId, id))
    .orderBy(portalRequestEvent.createdAt, portalRequestEvent.id);
}

export async function workspaceData(ownerId: string, detailId?: string) {
  const database = db();
  const [requests, quotes, rawMeetings, availableProjects, read, catalog, profile] = await Promise.all([
    database.select().from(portalRequest).where(eq(portalRequest.ownerId, ownerId)).orderBy(desc(portalRequest.updatedAt)),
    workspaceQuotations(ownerId),
    database.select({ id: meeting.id, leadId: meeting.leadId, title: meeting.title, status: meeting.status,
      scheduledAt: meeting.scheduledAt, meetingUrl: meeting.meetingUrl, confirmedAt: meeting.confirmedAt, updatedAt: meeting.updatedAt, provider: meeting.provider, requestedChangeAt: meeting.requestedChangeAt, durationMinutes: meeting.durationMinutes })
      .from(meeting).where(eq(meeting.clientId, ownerId)).orderBy(desc(meeting.scheduledAt)),
    database.select({ id: project.id, name: project.name }).from(project).where(eq(project.clientId, ownerId)).orderBy(desc(project.createdAt)),
    database.select({ key: portalNotificationRead.key }).from(portalNotificationRead).where(eq(portalNotificationRead.userId, ownerId)),
    loadInquiryServices(),
    database.select({ name: user.name, email: user.email, company: user.company, phone: user.phone }).from(user).where(eq(user.id, ownerId)).get(),
  ]);
  const leadIds = requests.flatMap(({ leadId }) => leadId ? [leadId] : []);
  const meetings = rawMeetings.map((row) => ({ ...row, meetingUrl: safeMeetingLink(row.meetingUrl) }));
  const linkedKeys = JSON.stringify(leadIds);
  const [linked, events, inquiryEvents, serviceSnapshots] = leadIds.length ? await Promise.all([
    database.select({ id: inquiry.id, stage: inquiry.stage, projectId: inquiry.convertedProjectId }).from(inquiry).where(sql`${inquiry.id} in (select value from json_each(${linkedKeys}))`),
    database.select({ id: portalRequestEvent.id, requestId: portalRequestEvent.requestId, kind: portalRequestEvent.kind,
      body: portalRequestEvent.body, createdAt: portalRequestEvent.createdAt }).from(portalRequestEvent)
      .innerJoin(portalRequest, eq(portalRequest.id, portalRequestEvent.requestId)).where(eq(portalRequest.ownerId, ownerId)),
    database.select({ id: inquiryActivity.id, leadId: inquiryActivity.inquiryId, stage: inquiryActivity.newStage, createdAt: inquiryActivity.createdAt })
      .from(inquiryActivity).where(and(sql`${inquiryActivity.inquiryId} in (select value from json_each(${linkedKeys}))`, inArray(inquiryActivity.kind, ["stage", "conversion", "meeting"]))),
    database.select({ id: inquiryService.inquiryId, name: inquiryService.label }).from(inquiryService).where(sql`${inquiryService.inquiryId} in (select value from json_each(${linkedKeys}))`),
  ]) : [[], [], [], []];
  const notifications: { key: string; title: string; url: string; time: number; read: boolean }[] = [];
  const readKeys = new Set(read.map(({ key }) => key));
  function notify(key: string, title: string, url: string, time: number) {
    notifications.push({ key, title, url, time, read: readKeys.has(key) });
  }
  const now = Date.now();
  for (const q of quotes) {
    const href = "/portal/quotations/" + q.id;
    notify("quote:" + q.id, q.revision > 1 ? "A revised quotation is available" : "A quotation is available", href, q.sentAt ?? q.updatedAt);
    const expiry = Date.parse(q.expiry + "T23:59:59Z");
    if (["sent", "viewed", "expired"].includes(q.status) && expiry - now <= 3 * 86400000)
      notify("expiry:" + q.id, "Quotation " + q.number + " expires soon", href, Math.floor((expiry - 3 * 86400000) / 1000));
  }
  for (const m of meetings) {
    if (m.confirmedAt)
      notify("meeting:" + m.id + ":" + m.confirmedAt.toISOString(), "Meeting confirmed or updated: " + m.title, "/portal/meetings", m.confirmedAt.getTime() / 1000);
  }
  const rows = requests.map((row) => {
    const link = linked.find(({ id }) => id === row.leadId);
    const projectId = availableProjects.some(({ id }) => id === link?.projectId) ? link?.projectId ?? null : null;
    const allQuotes = quotes.filter((quote) => quote.leadId === row.leadId && row.leadId);
    const requestedMeetings = meetings.filter((item) => item.leadId === row.leadId && row.leadId);
    const status = getWorkspaceStatus(row.state, link?.stage ?? null, projectId, allQuotes[0]?.status ?? null,
      requestedMeetings.some((item) => item.status === "scheduled" && item.scheduledAt.getTime() > now));
    const ownEvents = events.filter((event) => event.requestId === row.id);
    const milestones = inquiryEvents.filter((item) => item.leadId === row.leadId);
    const url = "/portal/requests/" + row.id;
    for (const event of ownEvents) {
      const title = event.kind === "staff_message" ? "New message from Axonill" :
        event.kind === "needs_info" ? "Axonill needs more information" :
        event.kind === "submitted" ? "We received your request" :
        event.kind === "status" ? event.body : "";
      if (title) notify("event:" + event.id, title, url, event.createdAt);
    }
    for (const event of milestones) {
      if (event.stage === "converted" && projectId) notify("inquiry:" + event.id, "Your project workspace is ready", url, event.createdAt.getTime() / 1000);
      else if (event.stage && event.stage !== "converted") notify("inquiry:" + event.id, "Your request status was updated", url, event.createdAt.getTime() / 1000);
    }
    return { ...row, status, projectId, services: row.leadId ? serviceSnapshots.filter(({ id }) => id === row.leadId).map(({ name }) => name) : catalog.filter(({ key }) => row.input.services.includes(key)).map(({ label }) => label), quotes: allQuotes, meetings: requestedMeetings,
      updatedAt: Math.max(row.updatedAt, ...ownEvents.map((item) => item.createdAt), ...allQuotes.map((item) => item.updatedAt),
        ...milestones.map((item) => item.createdAt.getTime() / 1000)),
      events: detailId === row.id ? ownEvents : [],
      history: detailId === row.id ? milestones.map((event) => ({ id: event.id, createdAt: event.createdAt.getTime() / 1000,
        body: event.stage === "converted" && projectId ? "Project workspace created" : "Axonill updated your request status" })) : [],
    };
  });
  const attachments = detailId && rows.some((row) => row.id === detailId) ? await workspaceAttachments(detailId) : [];
  return { requests: rows, quotes, meetings, projects: availableProjects, profile, catalog, attachments, policy: workspacePolicy(),
    notifications: notifications.sort((a, b) => b.time - a.time) };
}

export async function workspaceAttachments(id: string) {
  return db().select({ id: portalAttachment.id, name: portalAttachment.name, size: portalAttachment.size, eventId: portalAttachment.eventId })
    .from(portalAttachment).where(eq(portalAttachment.requestId, id));
}

export async function submitWorkspace(row: WorkspaceRow, profile: SessionUser, input: WorkspaceInput, version: number) {
  const problem = validateBrief(input);
  if (problem) return problem;
  const [catalog, settings, account] = await Promise.all([
    loadInquiryServices(), loadInquirySettings(), db().select({ company: user.company, phone: user.phone, name: user.name, email: user.email })
      .from(user).where(eq(user.id, profile.id)).get(),
  ]);
  const choices = catalog.filter((item) => input.services.includes(item.key));
  if (choices.length !== new Set(input.services).size) return "A selected service is no longer available. Choose an updated service.";
  const labels = choices.map(({ label }) => label);
  const agency = workspaceD1();
  const title = input.title || input.area || "Guidance request";
  const description = [input.description, input.objectives && "Goals: " + input.objectives, input.audience && "Audience: " + input.audience,
    input.features && "Requested features: " + input.features, input.area && "Help with: " + input.area].filter(Boolean).join("\n\n");
  const budget = input.budget === null ? input.budgetRange : String(input.budget);
  const timeline = input.timeline === "Custom date" ? input.date : input.timeline;
  const guard = "exists(select 1 from portal_request where id=? and ownerId=? and version=? and state='draft')";
  const values = [row.id, profile.id, version] as const;
  const activityId = newId();
  const result = await agency.batch([
    agency.prepare(`insert into lead (id,clientId,name,email,company,service,budgetRange,message,wantsCall,status,source)
      select ?,?,?,?,?,?,?,?,?,'new','portal_workspace' where ${guard}`)
      .bind(row.id, profile.id, account?.name ?? profile.name, account?.email ?? profile.email, account?.company ?? null, labels.join(", ") || (input.unsure ? "Not sure yet" : null),
        budget ? input.currency + " " + budget : null, description, input.consultation ? 1 : 0, ...values),
    agency.prepare(`insert into inquiry (id,reference,fingerprint,type,country,phone,title,objectives,situation,categories,budget,currency,timeline,website,consultation)
      select ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? where ${guard}`)
      .bind(row.id, row.reference, "portal-workspace:" + row.id, input.type, settings.domesticCountry, account?.phone ?? null,
        title, input.objectives || null, input.description, JSON.stringify(input.area ? [input.area] : []), input.budget,
        budget ? input.currency : null, timeline || null, input.website || null, input.communication || (input.consultation ? "Google Meet" : null), ...values),
    ...choices.map((service) => agency.prepare(`insert into inquiry_service (id,inquiryId,serviceId,label,"group") select ?,?,?,?,? where ${guard}`)
      .bind(newId(), row.id, service.serviceId, service.label, service.group, ...values)),
    agency.prepare(`insert into inquiry_activity (id,inquiryId,kind,newStage,description) select ?,?,'created','new','Submitted from the client portal.' where ${guard}`)
      .bind(activityId, row.id, ...values),
    agency.prepare(`insert into portal_request_event (id,requestId,actorId,kind,body) select ?,?,?,'submitted','Request submitted' where ${guard}`)
      .bind(newId(), row.id, profile.id, ...values),
    agency.prepare("update portal_request set leadId=id,state='submitted',input=?,version=version+1,submittedAt=unixepoch(),updatedAt=unixepoch() where id=? and ownerId=? and version=? and state='draft'")
      .bind(JSON.stringify(input), ...values),
  ]);
  return result.at(-1)?.meta.changes ? null : "This draft changed. Reopen it and try again.";
}

export async function removeDraft(row: WorkspaceRow) {
  const database = workspaceD1();
  const [keys, removed] = await database.batch<{ key: string }>([
    database.prepare("select objectKey as key from portal_attachment where requestId=?").bind(row.id),
    database.prepare("delete from portal_request where id=? and state='draft' and version=?").bind(row.id, row.version),
  ]);
  if (!removed.meta.changes) return false;
  await Promise.allSettled(keys.results.map(({ key }) => filesBucket().delete(key)));
  return true;
}
