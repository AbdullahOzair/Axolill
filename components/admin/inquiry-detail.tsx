"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { inquireDetail } from "@/lib/inquiry-admin";
import { GROUP_LABELS, INQUIRY_PRIORITIES, INQUIRY_STAGES, STAGE_LABELS, inquiryCountry, type InquiryStage } from "@/lib/inquiries";
import { safeMeetingLink } from "@/lib/meeting-link";
import { inquiryMutation, useInquiryQuery } from "./inquiry-query";
import styles from "./conversions.module.css";

type Wire<T> = T extends Date ? string : T extends object ? { [K in keyof T]: Wire<T[K]> } : T;
export type InquiryDetail = Wire<NonNullable<Awaited<ReturnType<typeof inquireDetail>>>>;
export type InquiryRow = InquiryDetail["inquiry"] & { services: string[] };
export type TeamOption = { id: string; name: string };

const displayDate = (value: string | null) => value ? new Date(value).toLocaleString() : "—";
const localDate = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function InquiryDrawer({ id, suggestedStage, revision, onClose, refresh }: {
  id: string; suggestedStage?: InquiryStage; revision: number; onClose: () => void; refresh: () => void;
}) {
  const url = "/api/admin/inquiries/" + encodeURIComponent(id);
  const result = useInquiryQuery<InquiryDetail>(url, revision);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className={styles.drawer + " sm:max-w-[48rem]"}>
        <DialogTitle className="pr-8 text-xl">{result?.data?.inquiry.reference ?? "Inquiry details"}</DialogTitle>
        <DialogDescription>Contact, requirements, and internal lead history.</DialogDescription>
        {result?.data
          ? <InquiryPanels data={result.data} url={url} suggestedStage={suggestedStage} refresh={refresh} />
          : <p role={result?.error ? "alert" : "status"}>{result?.error ?? "Loading inquiry…"}</p>}
      </DialogContent>
    </Dialog>
  );
}

function InquiryPanels({ data, url, suggestedStage, refresh }: {
  data: InquiryDetail; url: string; suggestedStage?: InquiryStage; refresh: () => void;
}) {
  const { inquiry: lead, services, activity, notes, meetings, matchingClients, team } = data;
  const clientResults = useInquiryQuery<{ clients: { id: string; name: string; email: string }[] }>("/api/clients");
  const [stage, setStage] = useState(suggestedStage && suggestedStage !== "converted" ? suggestedStage : lead.stage);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [includeProject, setIncludeProject] = useState(false);

  async function run(event: FormEvent<HTMLFormElement>, operation: (data: FormData) => Promise<unknown>) {
    event.preventDefault();
    if (saving) return;
    const values = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try { await operation(values); refresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save this change."); }
    finally { setSaving(false); }
  }

  const phone = lead.phone;
  const phoneDigits = phone?.replace(/\D/g, "");
  const phoneLink = phone?.startsWith("+") ? "https://wa.me/" + phoneDigits : phoneDigits ? "tel:" + phoneDigits : undefined;
  const field = (data: FormData, key: string) => String(data.get(key) ?? "");
  return (
    <div className={styles.details}>
      <div className={styles.detailHeading}>
        <div><h2>{lead.name}</h2><p>{lead.type} · {inquiryCountry(lead.country)} · {displayDate(lead.createdAt)}</p></div>
        <a href={"mailto:" + encodeURIComponent(lead.email)}>Email</a>
        {phoneLink && <a href={phoneLink} target={phone?.startsWith("+") ? "_blank" : undefined} rel="noopener noreferrer">
          {phone?.startsWith("+") ? "WhatsApp" : "Call"}
        </a>}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      <section className={styles.panel}>
        <h3>Inquiry requirements</h3>
        <dl className={styles.summary}>
          <div><dt>Email</dt><dd>{lead.email}</dd></div>
          {lead.company && <div><dt>Company</dt><dd>{lead.company}</dd></div>}
          {phone && <div><dt>Phone</dt><dd>{phone}</dd></div>}
          {lead.title && <div><dt>Project title</dt><dd>{lead.title}</dd></div>}
          <div><dt>Categories</dt><dd>{lead.categories.map((cat) => GROUP_LABELS[cat as keyof typeof GROUP_LABELS] ?? cat).join(", ")}</dd></div>
          {services.length > 0 && <div><dt>Services</dt><dd>{services.map(({ label }) => label).join(", ")}</dd></div>}
          {lead.timeline && <div><dt>Timeline</dt><dd>{lead.timeline}</dd></div>}
          {lead.budget !== null && <div><dt>Budget</dt><dd>{lead.budget.toLocaleString()} {lead.currency ?? ""}</dd></div>}
          {lead.currency && lead.budget === null && <div><dt>Preferred currency</dt><dd>{lead.currency}</dd></div>}
          {lead.website && <div><dt>Existing website</dt><dd>{lead.website}</dd></div>}
          {lead.consultation && <div><dt>Consultation preference</dt><dd>{lead.consultation}</dd></div>}
          <div><dt>Source</dt><dd>{lead.source ?? "Work With Us"}</dd></div>
          {lead.situation && <div className={styles.full}><dt>Current situation</dt><dd>{lead.situation}</dd></div>}
          <div className={styles.full}><dt>{lead.type === "GUIDANCE" ? "Main challenge" : "Description"}</dt><dd>{lead.description}</dd></div>
          {lead.objectives && <div className={styles.full}><dt>{lead.type === "GUIDANCE" ? "Desired outcome" : "Business objectives"}</dt><dd>{lead.objectives}</dd></div>}
        </dl>
      </section>

      <form className={styles.panel} onSubmit={(event) => run(event, (values) => inquiryMutation(url, { action: "update", changes: {
        stage: stage === "converted" ? undefined : stage, priority: field(values, "priority"),
        assigneeId: field(values, "assigneeId") || null,
        followUpAt: field(values, "followUp") ? new Date(field(values, "followUp")).toISOString() : null,
        lostReason: field(values, "reason").trim() || undefined,
      }}))}>
        <h3>Lead status and follow-up</h3>
        <div className={styles.formGrid}>
          <label>Status
            <select value={stage} disabled={lead.stage === "converted"} onChange={(event) => setStage(event.currentTarget.value as InquiryStage)}>
              {INQUIRY_STAGES.filter((value) => value !== "converted" || lead.stage === value).map((value) => <option key={value} value={value}>{STAGE_LABELS[value]}</option>)}
            </select>
          </label>
          <label>Priority<select name="priority" defaultValue={lead.priority}>
            {INQUIRY_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select></label>
          <label>Assigned team member<select name="assigneeId" defaultValue={lead.assigneeId ?? ""}>
            <option value="">Unassigned</option>{team.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select></label>
          <label>Next follow-up (local time)<input type="datetime-local" name="followUp" defaultValue={localDate(lead.followUpAt)} /></label>
          {stage === "lost" && <label className={styles.full}>Lost reason<textarea name="reason" maxLength={1000} required defaultValue={lead.lostReason ?? ""} /></label>}
        </div>
        <Button type="submit" disabled={saving}>Save lead changes</Button>
      </form>

      <section className={styles.panel}>
        <h3>Internal notes</h3>
        {notes.length ? <ul className={styles.history}>{notes.map((note) => <li key={note.id}><p>{note.content}</p><small>{note.admin ?? "Former admin"} · {displayDate(note.createdAt)}</small></li>)}</ul> : <p>No internal notes yet.</p>}
        <form className={styles.miniForm} onSubmit={(event) => run(event, (values) => inquiryMutation(url, { action: "note", content: field(values, "note") }))}>
          <label>Add note<textarea name="note" rows={2} maxLength={4000} required /></label>
          <Button type="submit" disabled={saving}>Add note</Button>
        </form>
      </section>

      <details className={styles.panel}>
        <summary>Schedule a Google Meet</summary>
        {meetings.length > 0 && <ul className={styles.history}>{meetings.map((meeting) => {
          const href = safeMeetingLink(meeting.meetingUrl);
          return <li key={meeting.id}><p>{meeting.title} · {meeting.status}</p>
            <small>{displayDate(meeting.scheduledAt)}</small>
            {href && <a href={href} target="_blank" rel="noopener noreferrer">Open meeting</a>}</li>;
        })}</ul>}
        <form className={styles.miniForm} onSubmit={(event) => run(event, (values) => inquiryMutation(url + "/meeting", {
          title: field(values, "meetingTitle"), startsAt: new Date(field(values, "startsAt")).toISOString(),
          durationMinutes: Number(field(values, "duration")), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }, "POST"))}>
          <div className={styles.formGrid}>
            <label>Title<input name="meetingTitle" required maxLength={200} defaultValue="Axonill consultation" /></label>
            <label>Start (local time)<input name="startsAt" type="datetime-local" required /></label>
            <label>Minutes<input name="duration" type="number" min={5} max={480} defaultValue={30} required /></label>
          </div>
          <Button type="submit" disabled={saving}>Schedule meeting</Button>
        </form>
      </details>

      {lead.convertedAt ? <section className={styles.panel}>
        <h3>Conversion recorded</h3>
        <p>{displayDate(lead.convertedAt)} · {lead.convertedProjectId ? "Client and project linked" : "Client linked"}</p>
        <a href="/admin/clients">View clients</a>{" · "}<a href="/admin/projects">View projects</a>
      </section> : (
        <details className={styles.panel} open={suggestedStage === "converted" || undefined}>
          <summary>Convert to client</summary>
          <p>Create a client record or link an existing client. Any matching email is checked again when saving.</p>
          <form className={styles.miniForm} onSubmit={(event) => run(event, (values) => inquiryMutation(url + "/convert", {
            clientId: field(values, "client") || undefined,
            project: includeProject ? {
              name: field(values, "projectName"), service: field(values, "projectService"),
              start: field(values, "projectStart"), target: field(values, "projectTarget"),
            } : undefined,
          }, "POST"))}>
            <label>Client account<select name="client" defaultValue={matchingClients.length === 1 ? matchingClients[0].id : ""}>
              <option value="">Create a client or link the matching email ({lead.email})</option>
              {(clientResults?.data?.clients ?? matchingClients).map((client) => (
                <option key={client.id} value={client.id}>{client.name} · {client.email}</option>
              ))}
            </select></label>
            <label className={styles.check}><input type="checkbox" checked={includeProject} onChange={(event) => setIncludeProject(event.currentTarget.checked)} /> Create a related project</label>
            {includeProject && <div className={styles.formGrid}>
              <label>Project name<input name="projectName" defaultValue={lead.title ?? lead.name + " project"} required maxLength={160} /></label>
              <label>Service<input name="projectService" defaultValue={services[0]?.label.slice(0, 80) ?? "Consultation"} required maxLength={80} /></label>
              <label>Start date<input name="projectStart" type="date" required /></label>
              <label>Target date<input name="projectTarget" type="date" required /></label>
            </div>}
            <Button type="submit" disabled={saving}>Convert to client</Button>
          </form>
        </details>
      )}

      <section className={styles.panel}>
        <h3>Activity history</h3>
        <ol className={styles.history}>{activity.map((item) => <li key={item.id}>
          <p>{item.description}</p><small>{item.admin ?? "System"} · {displayDate(item.createdAt)}</small>
        </li>)}</ol>
      </section>
    </div>
  );
}
