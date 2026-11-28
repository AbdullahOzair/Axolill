import "server-only";

import { and, asc, count, desc, eq, getTableColumns, gte, lt, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/api";
import { inquiry, inquiryActivity, inquiryNote, inquiryService, lead, meeting, teamMember, user } from "@/lib/db/schema";
import { INQUIRY_PRIORITIES, INQUIRY_STAGES, INQUIRY_TYPES, inquiryCountry } from "@/lib/inquiries";
import { countryCode } from "@/lib/inquiry-validation";

const filters = z.object({
  q: z.string().trim().max(100).optional(),
  stage: z.enum(INQUIRY_STAGES).optional(),
  type: z.enum(INQUIRY_TYPES).optional(),
  priority: z.enum(INQUIRY_PRIORITIES).optional(),
  country: countryCode.optional(),
  assignee: z.string().max(160).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  sort: z.enum(["newest", "oldest", "name", "followUp"]).default("newest"),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  export: z.literal("csv").optional(),
}).refine(({ from, to }) => !from || !to || from <= to);

export function parseInquiryFilters(url: string) {
  return filters.safeParse(Object.fromEntries(new URL(url).searchParams));
}

export function endOfDate(value: string) {
  return new Date(new Date(value + "T00:00:00Z").getTime() + 86_400_000);
}

export const inquiryFields = {
  ...(() => {
    const { fingerprint: _fingerprint, sessionId: _sessionId, ...safe } = getTableColumns(inquiry);
    void _fingerprint;
    void _sessionId;
    return safe;
  })(),
  name: lead.name, email: lead.email, company: lead.company, description: lead.message,
  unreadPortalMessages: sql<number>`(select count(*) from portal_request_event e inner join portal_request p on p.id=e.requestId
    where p.leadId=${inquiry.id} and e.kind='client_message' and e.readAt is null)`.mapWith(Number),
  source: lead.source, createdAt: lead.createdAt, updatedAt: lead.updatedAt, assignee: teamMember.name,
};

export const baseInquiries = () => db().select(inquiryFields).from(inquiry)
  .innerJoin(lead, eq(lead.id, inquiry.id)).leftJoin(teamMember, eq(teamMember.id, inquiry.assigneeId));

export async function listInquiries(filter: z.infer<typeof filters>) {
  const rules: (SQL | undefined)[] = [
    filter.stage && eq(inquiry.stage, filter.stage) || undefined,
    filter.type && eq(inquiry.type, filter.type) || undefined,
    filter.priority && eq(inquiry.priority, filter.priority) || undefined,
    filter.country && eq(inquiry.country, filter.country) || undefined,
    filter.from && gte(lead.createdAt, new Date(filter.from + "T00:00:00Z")) || undefined,
    filter.to && lt(lead.createdAt, endOfDate(filter.to)) || undefined,
    filter.assignee ? (filter.assignee === "unassigned" ? sql`${inquiry.assigneeId} is null` : eq(inquiry.assigneeId, filter.assignee)) : undefined,
  ];
  if (filter.q) {
    const phrase = filter.q.toLowerCase();
    rules.push(sql`(instr(lower(${lead.name}), ${phrase}) > 0 or instr(lower(${lead.email}), ${phrase}) > 0
        or instr(lower(${inquiry.reference}), ${phrase}) > 0 or instr(lower(coalesce(${inquiry.title}, '')), ${phrase}) > 0
        or exists (select 1 from ${inquiryService} where ${inquiryService.inquiryId} = ${inquiry.id}
          and instr(lower(${inquiryService.label}), ${phrase}) > 0))`);
  }
  const where = and(...rules);
  const sorts = {
    newest: [desc(lead.createdAt), desc(inquiry.id)],
    oldest: [asc(lead.createdAt), asc(inquiry.id)],
    name: [asc(lead.name), asc(inquiry.id)],
    followUp: [sql`${inquiry.followUpAt} is null`, asc(inquiry.followUpAt), desc(inquiry.id)],
  };
  const database = db();
  const [{ total }] = await database.select({ total: count() }).from(inquiry)
    .innerJoin(lead, eq(lead.id, inquiry.id)).where(where);
  if (filter.export && total > 5000) return { total, rows: [], overflow: true };
  const records = await baseInquiries().where(where).orderBy(...sorts[filter.sort])
    .limit(filter.export ? 5000 : filter.size).offset(filter.export ? 0 : (filter.page - 1) * filter.size);
  const rows = await attachInquiryServices(records);
  return { total, rows, overflow: false };
}

async function attachInquiryServices<T extends { id: string }>(rows: T[]) {
  const ids = rows.map(({ id }) => id);
  const labels = new Map<string, string[]>();
  if (ids.length) {
    const database = db();
    const keys = JSON.stringify(ids);
    const services = await database.select({ inquiryId: inquiryService.inquiryId, label: inquiryService.label })
      .from(inquiryService)
      .where(sql`${inquiryService.inquiryId} in (select value from json_each(${keys}))`)
      .orderBy(asc(inquiryService.label));
    for (const item of services) {
      const existing = labels.get(item.inquiryId) ?? [];
      existing.push(item.label);
      labels.set(item.inquiryId, existing);
    }
  }
  return rows.map((row) => ({ ...row, services: labels.get(row.id) ?? [] }));
}

export async function inquireDetail(id: string) {
  const current = await baseInquiries().where(eq(inquiry.id, id)).get();
  if (!current) return null;
  const database = db();
  const [services, activity, notes, meetings, matchingClients, team] = await Promise.all([
    database.select({ serviceId: inquiryService.serviceId, label: inquiryService.label, group: inquiryService.group })
      .from(inquiryService).where(eq(inquiryService.inquiryId, id)).orderBy(asc(inquiryService.label)),
    database.select({
      id: inquiryActivity.id, kind: inquiryActivity.kind, previousStage: inquiryActivity.previousStage,
      newStage: inquiryActivity.newStage, description: inquiryActivity.description, createdAt: inquiryActivity.createdAt, admin: user.name,
    }).from(inquiryActivity).leftJoin(user, eq(user.id, inquiryActivity.adminId))
      .where(eq(inquiryActivity.inquiryId, id)).orderBy(desc(inquiryActivity.createdAt), desc(inquiryActivity.id)),
    database.select({ id: inquiryNote.id, content: inquiryNote.content, createdAt: inquiryNote.createdAt, updatedAt: inquiryNote.updatedAt, admin: user.name })
      .from(inquiryNote).leftJoin(user, eq(user.id, inquiryNote.adminId))
      .where(eq(inquiryNote.inquiryId, id)).orderBy(desc(inquiryNote.createdAt)),
    database.select().from(meeting).where(eq(meeting.leadId, id)).orderBy(desc(meeting.scheduledAt)),
    database.select({ id: user.id, name: user.name, email: user.email })
      .from(user).where(and(eq(user.role, "client"), sql`lower(${user.email}) = ${current.email.toLowerCase()}`)),
    database.select({ id: teamMember.id, name: teamMember.name }).from(teamMember).orderBy(asc(teamMember.name)),
  ]);
  return { inquiry: current, services, activity, notes, meetings, matchingClients, team };
}

type CsvRow = Awaited<ReturnType<typeof listInquiries>>["rows"][number];

export function inquiryCsv(rows: CsvRow[]) {
  const cell = (value: string | number | null | Date) => {
    const text = value instanceof Date ? value.toISOString() : String(value ?? "");
    return '"' + (/^\s*[=+@-]|^[\t\r\n]/u.test(text) ? "'" : "") + text.replaceAll('"', '""') + '"';
  };
  const header = ["Reference", "Name", "Email", "Phone", "Company", "Type", "Services", "Country", "Budget", "Currency",
    "Status", "Priority", "Assignee", "Submitted UTC", "Follow-up UTC", "Source"];
  return [header, ...rows.map((row) => [
    row.reference, row.name, row.email, row.phone, row.company, row.type, row.services.join(", "), inquiryCountry(row.country),
    row.budget, row.currency, row.stage, row.priority, row.assignee, row.createdAt, row.followUpAt, row.source,
  ])].map((row) => row.map(cell).join(",")).join("\r\n");
}
