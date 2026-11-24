"use client";

type Bucket = { label: string; value: number };
export type Analytics = {
  metrics: {
    total: number; new: number; qualified: number; meetings: number; proposals: number; converted: number; convertedClients: number; lost: number;
    averageResponseSeconds: number | null; pending: number; overdue: number; upcoming: number; unassigned: number; upcomingMeetings: number;
    qualifiedFunnel: number; proposalFunnel: number; convertedFunnel: number;
  };
  visitor: { viewed: number; selected: number; started: number; submitted: number; anySubmitted: number };
  type: (Bucket & { converted: number })[];
  timeline: Bucket[]; countries: Bucket[]; markets: Bucket[]; services: Bucket[]; sources: Bucket[];
  domesticCountry: string;
};

import { inquiryCountry } from "@/lib/inquiries";
import styles from "./conversions.module.css";

const count = new Intl.NumberFormat("en");
const percent = (current: number, previous: number) => previous ? (current / previous * 100).toFixed(1) + "%" : "—";
const kind = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

function Bars({ title, rows, percentage = false }: { title: string; rows: Bucket[]; percentage?: boolean }) {
  const max = percentage ? 100 : Math.max(1, ...rows.map(({ value }) => value));
  return (
    <figure className={styles.chart}>
      <figcaption>{title}</figcaption>
      {rows.length ? <ul>{rows.map(({ label, value }) => (
        <li key={label}>
          <div><span>{label}</span><strong>{percentage ? value.toFixed(1) + "%" : count.format(value)}</strong></div>
          <span aria-hidden className={styles.bar}><span style={{ width: (value / max * 100) + "%" }} /></span>
        </li>
      ))}</ul> : <p>No data in this date range.</p>}
    </figure>
  );
}

function Funnel({ title, rows, unit }: { title: string; rows: Bucket[]; unit: string }) {
  return (
    <figure className={styles.chart}>
      <figcaption>{title}</figcaption>
      <ol>{rows.map(({ label, value }, index) => (
        <li key={label}>
          <div><span>{label}</span><strong>{count.format(value)} {unit}</strong></div>
          <span aria-hidden className={styles.bar}><span style={{ width: percent(value, rows[0].value).replace("—", "0%") }} /></span>
          {index > 0 && <small>{percent(value, rows[index - 1].value)} from previous stage</small>}
        </li>
      ))}</ol>
    </figure>
  );
}

export function InquiryAnalytics({ data }: { data: Analytics }) {
  const { metrics: m, visitor: v } = data;
  const metricRows = [
    ["Total inquiries", m.total], ["New inquiries", m.new], ["Qualified leads", m.qualified],
    ["Meetings booked", m.meetings], ["Proposals sent", m.proposals], ["Converted clients", m.convertedClients],
    ["Lost leads", m.lost], ["Lead-to-client conversion", percent(m.converted, m.total)],
    ["Average first response", m.averageResponseSeconds === null ? "—" :
      m.averageResponseSeconds < 3600 ? Math.round(m.averageResponseSeconds / 60) + " min" : (m.averageResponseSeconds / 3600).toFixed(1) + " hr"],
    ["Pending follow-ups", m.pending],
  ] as const;
  return (
    <div className={styles.analytics}>
      <div className={styles.alerts} aria-label="Inquiry notifications">
        <span><strong>{m.new}</strong> new</span>
        <span><strong>{m.unassigned}</strong> unassigned</span>
        <span><strong>{m.overdue}</strong> overdue follow-ups</span>
        <span><strong>{m.upcoming}</strong> follow-ups in the next 7 days</span>
        <span><strong>{m.upcomingMeetings}</strong> upcoming consultations</span>
      </div>
      <dl className={styles.metrics}>
        {metricRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{typeof value === "number" ? count.format(value) : value}</dd></div>)}
      </dl>
      <p className={styles.hint}>UTC date range. Inquiries are grouped by submission date and measured through today. First response uses the first move to Contacted. Meetings booked counts scheduled and completed meetings linked to the cohort.</p>
      <div className={styles.chartGrid}>
        <Funnel title="Visitor funnel" unit="sessions" rows={[
          { label: "Work With Us viewed", value: v.viewed }, { label: "Card selected", value: v.selected },
          { label: "Inquiry form started", value: v.started }, { label: "Inquiry submitted", value: v.submitted },
        ]} />
        <Funnel title="Lead conversion funnel" unit="leads" rows={[
          { label: "Inquiry submitted", value: m.total }, { label: "Lead qualified", value: m.qualifiedFunnel },
          { label: "Proposal sent", value: m.proposalFunnel }, { label: "Client converted", value: m.convertedFunnel },
        ]} />
      </div>
      <p className={styles.hint}>Visitor-to-inquiry conversion is {percent(v.anySubmitted, v.viewed)} for consenting sessions first seen during the date range. Both funnels count completed steps in sequence. Direct conversions still count in the overall lead-to-client rate.</p>
      <details className={styles.panel}>
        <summary>Reporting breakdowns</summary>
        <div className={styles.chartGrid}>
          <Bars title="Inquiries by type" rows={data.type.map(({ label, value }) => ({ label: kind(label), value }))} />
          <Bars title="Inquiry trends (UTC)" rows={data.timeline} />
          <Bars title="Most requested services" rows={data.services} />
          <Bars title="Inquiry countries" rows={data.countries.map(({ label, value }) => ({ label: inquiryCountry(label), value }))} />
          <Bars title={`Domestic vs. international · ${inquiryCountry(data.domesticCountry)}`} rows={data.markets} />
          <Bars title="Conversion rate by inquiry type" percentage rows={data.type.map(
            ({ label, value, converted }) => ({ label: kind(label), value: value ? converted / value * 100 : 0 }),
          )} />
          <Bars title="Acquisition sources" rows={data.sources} />
        </div>
      </details>
    </div>
  );
}
