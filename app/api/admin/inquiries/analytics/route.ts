import { sql } from "drizzle-orm";
import { z } from "zod";

import { badRequest, db, json, requireAdmin } from "@/lib/api";
import { withApiErrors } from "@/lib/http-security";
import { endOfDate } from "@/lib/inquiry-admin";
import { loadInquirySettings } from "@/lib/inquiry-server";

export const dynamic = "force-dynamic";

const range = z.object({ from: z.iso.date(), to: z.iso.date() }).refine(({ from, to }) => from <= to);
type Bucket = { label: string; value: number };
type TypeBucket = Bucket & { converted: number };
type Metrics = {
  total: number; new: number; qualified: number; meetings: number; proposals: number; converted: number; convertedClients: number; lost: number;
  averageResponseSeconds: number | null; pending: number; overdue: number; upcoming: number; unassigned: number; upcomingMeetings: number;
  qualifiedFunnel: number; proposalFunnel: number; convertedFunnel: number;
};

export const GET = withApiErrors("GET inquiry analytics", async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const filter = range.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!filter.success) return badRequest("Choose a valid start and end date.");

  const from = Date.parse(filter.data.from + "T00:00:00Z") / 1000;
  const to = endOfDate(filter.data.to).getTime() / 1000;
  const now = Math.floor(Date.now() / 1000);
  const week = now + 7 * 86_400;
  const period = to - from > 62 * 86_400 ? "%Y-%m" : "%Y-%m-%d";
  const database = db();
  const settings = await loadInquirySettings();
  const cohort = sql`with cohort as (
    select i.*, l.createdAt, coalesce(l.source, 'Work With Us') as source
    from inquiry i join lead l on l.id=i.id where l.createdAt>=${from} and l.createdAt<${to}
  )`;

  const [metrics, type, timeline, countries, markets, services, sources, visitor] = await Promise.all([
    database.get<Metrics>(sql`
      ${cohort}, milestones as (
        select a.inquiryId,
          min(case when a.kind='stage' and a.newStage='contacted' then a.createdAt end) as firstContact,
          min(case when a.kind='stage' and a.newStage='qualified' then a.createdAt end) as qualifiedAt,
          min(case when a.kind='stage' and a.newStage='proposal' then a.createdAt end) as proposalAt
        from inquiry_activity a join cohort c on c.id=a.inquiryId group by a.inquiryId
      )
      select count(*) total,
        count(*) filter (where c.stage='new') new,
        count(*) filter (where m.qualifiedAt is not null) qualified,
        (select count(*) from meeting join cohort eligible on eligible.id=meeting.leadId where meeting.status in ('scheduled','completed')) meetings,
        count(*) filter (where m.proposalAt is not null) proposals,
        count(*) filter (where c.convertedAt is not null) converted,
        count(distinct c.convertedClientId) convertedClients,
        count(*) filter (where c.stage='lost') lost,
        avg(m.firstContact-c.createdAt) averageResponseSeconds,
        count(*) filter (where c.stage not in ('converted','lost') and c.followUpAt is not null) pending,
        count(*) filter (where c.stage not in ('converted','lost') and c.followUpAt < ${now}) overdue,
        count(*) filter (where c.stage not in ('converted','lost') and c.followUpAt between ${now} and ${week}) upcoming,
        count(*) filter (where c.stage not in ('converted','lost') and c.assigneeId is null) unassigned,
        (select count(*) from meeting join cohort eligible on eligible.id=meeting.leadId
          where meeting.status='scheduled' and meeting.scheduledAt>=${now}) upcomingMeetings,
        count(*) filter (where m.qualifiedAt is not null) qualifiedFunnel,
        count(*) filter (where m.proposalAt>=m.qualifiedAt) proposalFunnel,
        count(*) filter (where m.proposalAt>=m.qualifiedAt and c.convertedAt>=m.proposalAt) convertedFunnel
      from cohort c left join milestones m on m.inquiryId=c.id`),
    database.all<TypeBucket>(sql`${cohort} select type label,count(*) value,count(convertedAt) converted from cohort group by type order by type`),
    database.all<Bucket>(sql`${cohort} select strftime(${period},createdAt,'unixepoch') label,count(*) value from cohort group by label order by label`),
    database.all<Bucket>(sql`${cohort} select country label,count(*) value from cohort group by country order by value desc,label`),
    database.all<Bucket>(sql`${cohort} select case when country=${settings.domesticCountry} then 'Domestic' else 'International' end label,count(*) value from cohort group by label`),
    database.all<Bucket>(sql`${cohort} select s.label,count(distinct s.inquiryId) value from inquiry_service s join cohort c on c.id=s.inquiryId
      group by s.label order by value desc,s.label limit 12`),
    database.all<Bucket>(sql`${cohort} select source label,count(*) value from cohort group by source order by value desc,source limit 12`),
    database.get<{ viewed: number; selected: number; started: number; submitted: number; anySubmitted: number }>(sql`
      with visitors as (
        select sessionId,createdAt from inquiry_event where event='viewed' and createdAt>=${from} and createdAt<${to}
      ), paths as (
        select v.sessionId,e.type,
          min(case when e.event='selected' then e.createdAt end) selectedAt,
          min(case when e.event='started' then e.createdAt end) startedAt,
          min(case when e.event='submitted' then e.createdAt end) submittedAt
        from visitors v join inquiry_event e on v.sessionId=e.sessionId and e.createdAt>=v.createdAt and e.type is not null
        group by v.sessionId,e.type
      )
      select (select count(*) from visitors) viewed,
        count(distinct case when selectedAt is not null then sessionId end) selected,
        count(distinct case when startedAt>=selectedAt then sessionId end) started,
        count(distinct case when startedAt>=selectedAt and submittedAt>=startedAt then sessionId end) submitted,
        count(distinct case when submittedAt is not null then sessionId end) anySubmitted
      from paths`),
  ]);
  return json({ metrics, type, timeline, countries, markets, services, sources, visitor, domesticCountry: settings.domesticCountry });
});
