"use client";

import { useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fetchJson, useLoader } from "@/lib/use-api";
import type { Workspace } from "./client-workspace";
import { Field, workspaceApi } from "./request-wizard";

type Meeting = Workspace["meetings"][number];

const format = (date: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
const localInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function WorkspaceMeetings({ meetings, requests, refresh, projectId }: { meetings: Meeting[]; requests: Workspace["requests"]; refresh: () => void; projectId?: string }) {
  const requestId = useSearchParams().get("request") ?? "";
  const availability = useLoader(() => fetchJson<{ mode: string; slots: string[] }>(workspaceApi + "/availability"));
  const [selectedSlot, setSelectedSlot] = useState("");
  const [change, setChange] = useState<Meeting | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const soon = Date.now();
  const availableRequests = requests.filter((row) => row.leadId && !["closed", "cancelled"].includes(row.status));
  const groups = [
    { title: "Upcoming meetings", rows: meetings.filter((row) => row.status === "scheduled" && Date.parse(row.scheduledAt) > soon).sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)) },
    { title: "Pending requests", rows: meetings.filter((row) => row.status === "requested" || row.requestedChangeAt) },
    { title: "Past meetings", rows: meetings.filter((row) => row.status === "completed" || (row.status === "scheduled" && Date.parse(row.scheduledAt) <= soon)) },
    { title: "Cancelled meetings", rows: meetings.filter((row) => row.status === "cancelled") },
  ];

  async function run(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError(""); setNotice("");
    try { await task(); refresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save your meeting request."); }
    finally { setBusy(false); lock.current = false; }
  }

  const changeMeeting = (id: string, action: string, startsAt?: string) => fetchJson("/api/meetings/" + id, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, startsAt }),
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const time = new Date(selectedSlot || String(fields.get("date")));
    if (!(time.getTime() > Date.now())) return setError("Choose a future date and time.");
    if (meetings.some((item) => item.id !== change?.id && ["requested", "scheduled"].includes(item.status) &&
      Date.parse(item.scheduledAt) < time.getTime() + 30 * 60000 &&
      Date.parse(item.scheduledAt) + item.durationMinutes * 60000 > time.getTime())) return setError("This time overlaps one of your meetings or pending requests.");
    await run(async () => {
      if (change) {
        await changeMeeting(change.id, "reschedule", time.toISOString());
      } else {
        const requestId = String(fields.get("request") || "");
        await fetchJson("/api/meetings/request", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: fields.get("purpose"), preferredAt: time.toISOString(), requestId: requestId || undefined, projectId }) });
      }
      setNotice(change ? "Your new time was submitted." : "Meeting requested. We’ll confirm the time here.");
      form.reset(); setChange(null); setSelectedSlot(""); availability.reload();
    });
  }

  return <>
    <section className="axp-card">
      <h2>{change ? "Suggest a new time" : "Request a Google Meet"}</h2>
      <p className="axp-note">Choose a time in {Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll("_", " ")}. Axonill will check availability and confirm it here.</p>
      <form className="axp-stack axp-narrow" onSubmit={submit} ref={formRef}>
        {change ? <p>{change.title}</p> : <>
          <Field label="What’s the meeting about?"><input name="purpose" required maxLength={200} /></Field>
          {availableRequests.length > 0 && <Field label="Related request (optional)"><select name="request" defaultValue={requestId}>
            <option value="">General discussion</option>{availableRequests.map((row) => <option key={row.id} value={row.id}>{row.input.title || row.input.area || row.reference}</option>)}
          </select></Field>}
        </>}
        {availability.data?.mode === "availability" && <Field label="Available times to request">
          <select value={selectedSlot} onChange={(event) => setSelectedSlot(event.target.value)}>
            <option value="">Suggest a different time</option>{availability.data.slots.map((slot) => <option key={slot} value={slot}>{format(slot)}</option>)}
          </select>
        </Field>}
        {!selectedSlot && <Field label="Preferred date and time"><input key={change?.id ?? "new"} name="date" type="datetime-local" min={localInput(new Date(soon))}
          defaultValue={change?.requestedChangeAt ? localInput(new Date(change.requestedChangeAt)) : ""} required /></Field>}
        {error && <p className="axp-feedback" role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <div className="axp-actions"><Button type="submit" disabled={busy}>{change ? "Request rescheduling" : "Send meeting request"}</Button>
          {change && <Button type="button" variant="outline" onClick={() => { setChange(null); setSelectedSlot(""); }}>Back</Button>}</div>
      </form>
    </section>
    {groups.map((group) => <section key={group.title} className="axp-card">
      <h2>{group.title}</h2>
      {group.rows.length ? <ul className="axp-list">{group.rows.map((row) => <li className="axp-row" key={row.id}>
        <div><strong>{row.title}</strong><p className="axp-note">{format(row.scheduledAt)}</p>
          {group.title === "Pending requests" && <p className="axp-note">{row.requestedChangeAt ? "New time requested: " + format(row.requestedChangeAt) : "Awaiting confirmation"}</p>}</div>
        <div className="axp-actions">
          {group.title === "Upcoming meetings" && row.meetingUrl && <a href={row.meetingUrl} target="_blank" rel="noreferrer">Join meeting</a>}
          {(row.status === "requested" || (group.title === "Upcoming meetings" && row.provider === "google_meet")) &&
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => {
              setChange(row); setSelectedSlot(""); formRef.current?.scrollIntoView({ block: "center" });
            }}>Reschedule</Button>}
          {group.title === "Pending requests" && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => {
            if (!window.confirm("Cancel this pending request?")) return;
            void run(async () => { await changeMeeting(row.id, "cancel"); setNotice("Pending request cancelled."); setChange(null); });
          }}>Cancel pending request</Button>}
        </div>
      </li>)}</ul> : <p className="axp-note axp-empty">None to display.</p>}
    </section>)}
  </>;
}
