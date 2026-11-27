import "server-only";
import { z } from "zod";
import { currencyCode, QUOTE_STATUSES, quoteDateToday } from "@/lib/quotations";
import { quoteD1, QuoteError, quotationDefaults } from "@/lib/quotation-store";
import { loadInquirySettings } from "@/lib/inquiry-server";

const filterSchema = z.object({
  q: z.string().trim().max(120).default(""), from: z.iso.date().optional(), to: z.iso.date().optional(),
  currency: currencyCode.optional(), category: z.string().max(100).optional(), region: z.enum(["national", "international"]).optional(),
  status: z.enum(QUOTE_STATUSES).optional(), archived: z.enum(["0", "1"]).default("0"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).refine(value => !value.from || !value.to || value.from <= value.to);

type Filters = z.infer<typeof filterSchema>;
export function readQuoteFilters(request: Request) {
  const result = filterSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!result.success) throw new QuoteError("Select valid quotation filters.");
  return result.data;
}

const status = `case when q.expiry<date('now','+5 hours') and q.status in
  ('draft','pending_approval','approved','sent','viewed','revision_requested') then 'expired' else q.status end`;

function conditions(f: Filters) {
  const rules = ["q.deleted=0", "q.archived=?"];
  const args: (string | number)[] = [Number(f.archived)];
  if (f.archived === "0") rules.push("not exists(select 1 from quotation newer where newer.number=q.number and newer.revision>q.revision and newer.deleted=0)");
  const add = (rule: string, value: string) => { rules.push(rule); args.push(value); };
  if (f.from) add("q.issue>=?", f.from);
  if (f.to) add("q.issue<=?", f.to);
  if (f.currency) add("q.currency=?", f.currency);
  if (f.region) add("json_extract(q.input,'$.client.region')=?", f.region);
  if (f.category) add("exists(select 1 from json_each(q.input,'$.lines') where json_extract(value,'$.category')=?)", f.category);
  if (f.status) add("(" + status + ")=?", f.status);
  if (f.q) add(`instr(lower(q.number || ' ' || json_extract(q.input,'$.client.name') || ' ' ||
    json_extract(q.input,'$.client.email') || ' ' || json_extract(q.input,'$.title')),?)>0`, f.q.toLowerCase());
  return { where: rules.join(" and "), args };
}

export type QuoteListRow = {
  id: string; number: string; revision: number; client: string; title: string; currency: string; digits: number; oneTime: number;
  monthly: number; issue: string; expiry: string; status: (typeof QUOTE_STATUSES)[number]; staff: string | null; updatedAt: number;
};
export async function listQuotations(f: Filters) {
  const { where, args } = conditions(f);
  const d1 = quoteD1();
  const [list, count] = await d1.batch<QuoteListRow | { total: number }>([
    d1.prepare(`select q.id,q.number,q.revision,json_extract(q.input,'$.client.name') client,json_extract(q.input,'$.title') title,
      q.currency,q.digits,q.oneTime,q.monthly,q.issue,q.expiry,${status} status,t.name staff,q.updatedAt
      from quotation q left join team_member t on t.id=q.assigneeId where ${where}
      order by q.updatedAt desc,q.id desc limit 20 offset ?`).bind(...args, (f.page - 1) * 20),
    d1.prepare(`select count(*) total from quotation q where ${where}`).bind(...args),
  ]);
  return { quotes: list.results as QuoteListRow[], total: (count.results[0] as { total: number }).total, page: f.page };
}

type Aggregate = Record<string, string | number | null>;
export async function quotationAnalytics(f: Filters) {
  const { where, args } = conditions(f);
  const d1 = quoteD1();
  const [settings, inquirySettings] = await Promise.all([quotationDefaults(), loadInquirySettings()]);
  const followBy = new Date(Date.parse(quoteDateToday()) + settings.reminderDays * 86_400_000).toISOString().slice(0, 10);
  const ready = `with filtered as (select q.*,${status} effective from quotation q where ${where}) `;
  const accepted = "effective in ('accepted','invoiced')";
  const follow = "effective in ('sent','viewed','revision_requested') and expiry <= ?";
  // Values stay separated by currency, fraction digits, and billing cadence.
  const totals = `count(*) count,coalesce(sum(oneTime),0) oneTime,coalesce(sum(monthly),0) monthly,
    sum(case when ${accepted} then oneTime else 0 end) acceptedOneTime,sum(case when ${accepted} then monthly else 0 end) acceptedMonthly,
    sum(case when ${accepted} then 1 else 0 end) accepted,sum(case when sentAt is not null then 1 else 0 end) sent,
    sum(oneTimeProfit) profit,sum(monthlyProfit) monthlyProfit`;
  const iqRules = ["1=1"];
  const iqArgs: string[] = [];
  const addInquiry = (condition: string, value: string) => { iqRules.push(condition); iqArgs.push(value); };
  if (f.from) addInquiry("date(l.createdAt,'unixepoch','+5 hours')>=?", f.from);
  if (f.to) addInquiry("date(l.createdAt,'unixepoch','+5 hours')<=?", f.to);
  if (f.currency) addInquiry("i.currency=?", f.currency);
  if (f.region) addInquiry(f.region === "national" ? "i.country=?" : "i.country<>?", inquirySettings.domesticCountry);
  if (f.category) addInquiry("exists(select 1 from inquiry_service s where s.inquiryId=i.id and s.\"group\"=?)", f.category);
  const results = await d1.batch<Aggregate>([
    d1.prepare(ready + "select effective status,count(*) count from filtered group by effective").bind(...args),
    d1.prepare(ready + `select currency,digits,${totals} from filtered group by currency,digits order by currency`).bind(...args),
    d1.prepare(ready + `select substr(issue,1,7) month,currency,digits,${totals} from filtered group by month,currency,digits order by month desc`).bind(...args),
    d1.prepare(ready + `select coalesce(nullif(json_extract(l.value,'$.serviceId'),''),json_extract(l.value,'$.name')) key,
      min(json_extract(l.value,'$.name')) label,count(distinct f.id) count from filtered f,json_each(f.input,'$.lines') l
      group by key order by count desc,label limit 12`).bind(...args),
    d1.prepare(ready + `select coalesce(nullif(json_extract(l.value,'$.category'),''),'Uncategorized') category,f.currency,f.digits,
      json_extract(l.value,'$.recurring') recurring,
      sum((json_extract(l.value,'$.unitPrice')*json_extract(l.value,'$.quantity')+500)/1000 -
        (((json_extract(l.value,'$.unitPrice')*json_extract(l.value,'$.quantity')+500)/1000)*json_extract(l.value,'$.discount')+5000)/10000) value
      from filtered f,json_each(f.input,'$.lines') l where json_extract(l.value,'$.optional')=0
      group by category,f.currency,f.digits,recurring order by category`).bind(...args),
    d1.prepare(ready + `select json_extract(input,'$.client.region') region,
      count(distinct coalesce(clientId,lower(json_extract(input,'$.client.email')))) count from filtered group by region`).bind(...args),
    d1.prepare(ready + `select count(*) inquiries,
      sum(exists(select 1 from filtered f where f.leadId=i.id)) quoted,
      sum(exists(select 1 from filtered f where f.leadId=i.id and ${accepted})) accepted
      from inquiry i inner join lead l on l.id=i.id where ${iqRules.join(" and ")}`).bind(...args,...iqArgs),
    d1.prepare(ready + `select id,number,effective status,expiry,json_extract(input,'$.title') title
      from filtered where ${follow} or effective='pending_approval' order by expiry limit 25`).bind(...args, followBy),
    d1.prepare(ready + `select count(*) count from filtered where ${follow}`).bind(...args, followBy),
    d1.prepare(ready + `select a.kind,a.createdAt,f.id,f.number from quotation_activity a inner join filtered f on f.id=a.quotationId
      where a.kind in ('accept','decline','revise','recipient_accept','recipient_decline','recipient_revise')
      order by a.createdAt desc limit 15`).bind(...args),
    d1.prepare(ready + `select f.currency,f.digits,count(*) invoices,cast(sum(round(i.amount*case f.digits when 0 then 1 when 1 then 10 when 2 then 100 else 1000 end)) as integer) invoiced,
      sum(coalesce((select sum(p.amount) from quotation_payment p where p.conversionId=c.id),0)) received
      from filtered f join quotation_invoice c on c.quotationId=f.id join invoice i on i.id=c.invoiceId group by f.currency,f.digits`).bind(...args),
    d1.prepare(`select distinct json_extract(l.value,'$.category') label from quotation q,json_each(q.input,'$.lines') l
      where q.deleted=0 and coalesce(json_extract(l.value,'$.category'),'')<>'' order by label`),
  ]);
  const [statuses,money,months,services,category,regions,funnel,queue,followups,activity,invoices,categories] = results.map(row=>row.results);
  const currencies = [...new Set([...settings.currencies.map(value=>value.code),...money.map(row=>String(row.currency))])];
  return { statuses,money,months,services,category,regions,funnel:funnel[0],queue,followUps:Number(followups[0]?.count ?? 0),activity,invoices,categories,currencies };
}
