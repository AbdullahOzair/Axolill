"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, CircleHelp, ClipboardList, FileText, LayoutDashboard, Lightbulb, Menu, MessageSquare, Settings, Sparkles, UserRound, X } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";
import { fetchJson, useLoader } from "@/lib/use-api";
import { journeys, requestInput, statusActions, workspaceStatuses } from "@/lib/portal-workspace";
import type { workspaceData } from "@/lib/portal-workspace-store";
import { QUOTE_LABELS } from "@/lib/quotations";
import type { PublicQuote } from "@/lib/quotation-public";
import { QuotationDocument } from "@/components/quotation-document";
import { PrintQuotation, QuotationClientResponse } from "@/components/quotation-client-response";
import { attachmentAccept, BriefSummary, Field, RequestWizard, sendWorkspace, workspaceApi } from "./request-wizard";
import { WorkspaceMeetings } from "./workspace-meetings";
import "./workspace.css";
import "@/components/admin/quotes/quotes.css";

type Wire<T> = T extends Date ? string : T extends object ? { [K in keyof T]: Wire<T[K]> } : T;
export type Workspace = Wire<Awaited<ReturnType<typeof workspaceData>>>;
type RequestRow = Workspace["requests"][number];
const navigation = [
  ["overview", "Overview", LayoutDashboard], ["projects", "My Projects", LayoutDashboard], ["requests", "My Requests", ClipboardList], ["quotations", "Quotations", FileText],
  ["meetings", "Meetings", CalendarDays], ["messages", "Messages", MessageSquare], ["settings", "Account Settings", Settings],
  ["help", "Help & Support", CircleHelp],
] as const;
const titles: Record<string, string> = Object.fromEntries(navigation.map(([key, title]) => [key, title]));
const stages = ["Submitted", "Review", "Quotation", "Project"];
const stageIndex: Partial<Record<RequestRow["status"], number>> = {
  submitted: 0, under_review: 1, needs_info: 1, meeting: 1, preparing: 1, quote_ready: 2, revision: 2, accepted: 2, awaiting: 2, created: 3,
};
export const workspaceTitle = (row: RequestRow) => row.input.title || row.input.area || journeys.find((journey) => journey.id === row.input.type)?.title || "Untitled request";
const fmt = (value: string | number, time = false) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", ...(time ? { timeStyle: "short" } : {}) })
  .format(new Date(typeof value === "number" ? value * 1000 : value));
const requestLink = (row: RequestRow) => "/portal/requests/" + row.id;

function Empty({ children }: { children: ReactNode }) {
  return <p className="axp-note axp-empty">{children}</p>;
}

function Panel({ title, children, link }: { title: string; children: ReactNode; link?: { label: string; href: string } }) {
  return <section className="axp-card"><div className="axp-row"><h2>{title}</h2>{link && <Link href={link.href}>{link.label}</Link>}</div>{children}</section>;
}

function NotificationRows({ items, onRead }: {
  items: Workspace["notifications"]; onRead?: (key?: string) => void;
}) {
  return items.length ? <ul className="axp-list">{items.map((item) => <li className="axp-row" key={item.key}>
    <div><Link href={item.url}>{item.title}</Link><p className="axp-note">{fmt(item.time, true)}</p></div>
    {!item.read && (onRead ? <button type="button" className="axp-inline-action" onClick={() => onRead(item.key)}>Mark as read</button> : <span className="axp-badge">New</span>)}
  </li>)}</ul> : <Empty>You’re all caught up.</Empty>;
}

function Requests({ items, conversations = false }: { items: RequestRow[]; conversations?: boolean }) {
  return items.length ? <ul className="axp-list">{items.map((row) => <li key={row.id}>
    <div className="axp-row"><Link href={conversations ? "/portal/messages/" + row.id : requestLink(row)}>{workspaceTitle(row)}</Link><span className="axp-badge">{workspaceStatuses[row.status]}</span></div>
    <p className="axp-note axp-break">{row.status === "draft" ? "Draft" : row.reference} · {row.submittedAt ? "Submitted " + fmt(row.submittedAt) + " · " : ""}Updated {fmt(row.updatedAt)}</p>
    {row.services.length > 0 && <p className="axp-note">{row.services.join(", ")}</p>}
    <p className="axp-note">{statusActions[row.status]}</p>
  </li>)}</ul> : <Empty>You haven’t started a request. Choose an option on the overview to get started.</Empty>;
}

function Quotes({ items }: { items: Workspace["quotes"] }) {
  return items.length ? <ul className="axp-list">{items.map((quote) => <li key={quote.id} className="axp-row">
    <div><Link href={"/portal/quotations/" + quote.id}>{quote.number}</Link><p className="axp-note">Revision {quote.revision} · Valid through {quote.expiry}</p></div>
    <span className="axp-badge">{QUOTE_LABELS[quote.status]}</span>
  </li>)}</ul> : <Empty>Quotations will appear here after Axonill sends them.</Empty>;
}

export function ClientWorkspace({ name, view, id }: { name: string; view: string; id?: string }) {
  const router = useRouter();
  const query = (view === "requests" || view === "messages") && id ? "?request=" + encodeURIComponent(id) : "";
  const state = useLoader(() => fetchJson<Workspace>(workspaceApi + query));
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const lock = useRef(false);
  const data = state.data;
  const active = data?.requests.find((item) => item.id === id);
  const unseen = data?.notifications.filter((item) => !item.read) ?? [];
  const unread = unseen.filter(({ title }) => title === "New message from Axonill" || title === "Axonill needs more information").length;
  const pending = data?.quotes.filter((item) => item.canRespond && ["sent", "viewed"].includes(item.status)) ?? [];
  const profileName = data?.profile?.name ?? name;

  async function act(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFeedback("");
    try { await task(); }
    catch (failure) { setFeedback(failure instanceof Error ? failure.message : "Please try again."); }
    finally { lock.current = false; setBusy(false); }
  }

  function mark(key?: string) {
    void act(async () => {
      await sendWorkspace("/notifications", "POST", key ? { key } : {});
      state.setData((previous) => ({ ...previous, notifications: previous.notifications.map((item) => !key || item.key === key ? { ...item, read: true } : item) }));
    });
  }

  const start = (type: typeof journeys[number]["id"]) => void act(async () => {
    const row = await sendWorkspace<{ id: string }>("/requests", "POST", requestInput.parse({ type }));
    router.push("/portal/requests/" + row.id);
  });

  return <div className="axp-shell">
    <header className="axp-header">
      <div className="axp-header-main">
        <button type="button" className="axp-icon axp-menu" aria-label={expanded ? "Close portal navigation" : "Open portal navigation"}
          aria-controls="axp-nav" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <X size={20} /> : <Menu size={20} />}</button>
        <Link href="/portal/overview" className="axp-wordmark">Client Portal</Link>
      </div>
      <div className="axp-header-main">
        <Link href="/portal/notifications" className="axp-icon" aria-label={"Notifications" + (unseen.length ? ", " + unseen.length + " unread" : "")}>
          <Bell size={19} />{unseen.length > 0 && <span aria-hidden="true">{unseen.length}</span>}
        </Link>
        <details className="axp-profile">
          <summary aria-label="Client profile"><UserRound size={17} /><span>{profileName}</span></summary>
          <div><Link href="/portal/settings">Account Settings</Link>
            <button type="button" disabled={signingOut} onClick={async () => {
              setSigningOut(true);
              try {
                const result = await signOut();
                if (result.error) throw new Error(result.error.message ?? "Could not sign out.");
                window.location.assign("/");
              } catch (failure) {
                setFeedback(failure instanceof Error ? failure.message : "Could not sign out.");
                setSigningOut(false);
              }
            }}>Sign out</button></div>
        </details>
      </div>
    </header>
    <div className="axp-body">
      <nav id="axp-nav" className="axp-nav" aria-label="Client portal" data-open={expanded}>
        {navigation.map(([href, label, Icon]) => <Link key={href} href={"/portal/" + href} onClick={() => setExpanded(false)}
          aria-current={view === href ? "page" : undefined}>
          <Icon size={17} aria-hidden="true" />{label}
          {href === "messages" && unread > 0 && <span className="axp-count" aria-label={unread + " unread"}>{unread}</span>}
          {href === "quotations" && pending.length > 0 && <span className="axp-count" aria-label={pending.length + " pending"}>{pending.length}</span>}
        </Link>)}
        {data?.projects.length ? <Link href={"/portal/project/" + data.projects[0].id}><LayoutDashboard size={17} />Project Workspace</Link> : null}
      </nav>
      <main className="axp-main axp-stack">
        <div className="axp-heading"><h1>{view === "overview" ? "Welcome, " + (profileName.trim().split(/\s+/)[0] || "there") : titles[view] ?? "Notifications"}</h1>
          {view === "overview" && <p>Start a request, review a quotation, or check your next meeting.</p>}</div>
        {feedback && <p className="axp-feedback" role="alert">{feedback}</p>}
        {state.loading && !data ? <div className="axp-loading" role="status" aria-label="Loading portal"><i/><i/><i/></div> :
          state.error ? <Panel title="Couldn’t load your portal"><p role="alert">{state.error}</p><Button onClick={state.reload} variant="outline">Try again</Button></Panel> :
          data && <>
            {view === "overview" && <>
              {pending.length > 0 && <Panel title="Quotations requiring attention" link={{ label: "All quotations", href: "/portal/quotations" }}><Quotes items={pending} /></Panel>}
              {data.requests.some((row) => row.status === "needs_info") && <Panel title="Requests that need your input"><Requests items={data.requests.filter((row) => row.status === "needs_info")} /></Panel>}
              {data.projects.length > 0 && <Panel title="Project workspaces"><ul className="axp-list">{data.projects.map((item) => <li key={item.id}>
                <Link href={"/portal/project/" + item.id}>{item.name}</Link></li>)}</ul></Panel>}
              <section><h2 className="axp-subheading">Start a new request</h2><div className="axp-journeys">
                {journeys.map((journey, index) => {
                  const Icon = [Lightbulb, ClipboardList, Sparkles][index];
                  return <button type="button" className="axp-card axp-journey" key={journey.id} disabled={busy} onClick={() => start(journey.id)}>
                    <Icon size={20} aria-hidden="true" /><strong>{journey.title}</strong><span>{journey.description}</span>
                  </button>;
                })}
              </div></section>
              <div className="axp-cols">
                <Panel title="Recent requests" link={{ label: "My Requests", href: "/portal/requests" }}><Requests items={data.requests.slice(0, 3)} /></Panel>
                <Panel title="Upcoming meetings" link={{ label: "Meetings", href: "/portal/meetings" }}>
                  {data.meetings.some((item) => item.status === "scheduled" && Date.parse(item.scheduledAt) > Date.now()) ?
                    <ul className="axp-list">{data.meetings.filter((item) => item.status === "scheduled" && Date.parse(item.scheduledAt) > Date.now())
                      .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)).slice(0, 3).map((item) => <li key={item.id}>
                        <strong>{item.title}</strong><p className="axp-note">{fmt(item.scheduledAt, true)}</p></li>)}</ul> :
                    <Empty>No upcoming meetings.</Empty>}
                </Panel>
              </div>
              {data.notifications.length > 0 && <Panel title="Recent updates" link={{ label: "Notifications", href: "/portal/notifications" }}><NotificationRows items={data.notifications.slice(0, 5)} /></Panel>}
            </>}
            {view === "projects" && <Panel title="Your projects" link={{ label: "Start a new request", href: "/portal/overview" }}>
              {data.projects.length ? <ul className="axp-list">{data.projects.map((item) => <li key={item.id}><Link href={"/portal/project/" + item.id}>{item.name}</Link></li>)}</ul> :
                <Empty>Your projects will appear after Axonill confirms the work.</Empty>}
            </Panel>}
            {view === "requests" && !id && <Panel title="Project requests" link={{ label: "Start a new request", href: "/portal/overview" }}><Requests items={data.requests} /></Panel>}
            {view === "requests" && id && (active ? active.status === "draft" ?
              <>
                <RequestWizard key={active.id} id={active.id} input={active.input} version={active.version} catalog={data.catalog} ranges={data.policy.ranges} attachments={data.attachments} />
                <Button variant="outline" className="axp-fit" disabled={busy} onClick={() => {
                  if (window.confirm("Delete this draft and its attachments?")) void act(async () => {
                    await sendWorkspace("/requests/" + id, "DELETE"); router.push("/portal/requests");
                  });
                }}>Delete draft</Button>
              </> : <RequestDetail row={active} data={data} busy={busy} refresh={state.reload} act={act} /> :
              <Panel title="Request unavailable"><Empty>This request is unavailable.</Empty></Panel>)}
            {view === "quotations" && (id ? <PortalQuote id={id} revisions={data.quotes} refresh={state.reload} /> : <Panel title="Your quotations"><Quotes items={data.quotes} /></Panel>)}
            {view === "meetings" && <WorkspaceMeetings meetings={data.meetings} requests={data.requests} refresh={state.reload} />}
            {view === "messages" && (active ? <RequestConversation row={active} attachments={data.attachments} refresh={state.reload} /> :
              <Panel title="Request conversations"><Requests conversations items={data.requests.filter((item) => item.status !== "draft")} /></Panel>)}
            {view === "notifications" && <>
              {unseen.length > 0 && <Button className="axp-fit" variant="outline" disabled={busy} onClick={() => mark()}>Mark all as read</Button>}
              <Panel title="Recent notifications"><NotificationRows items={data.notifications} onRead={mark} /></Panel>
            </>}
            {view === "settings" && data.profile && <Account profile={data.profile} changed={(profile) => state.setData((prev) => ({ ...prev, profile }))} />}
            {view === "help" && <Panel title="How can we help?">
              <p>For an update on a request, open its conversation to contact the Axonill team. You can also request a call to discuss what you need.</p>
              <div className="axp-actions"><Link href="/portal/messages">Open conversations</Link><Link href="/portal/meetings">Request a meeting</Link>
                <Link href="/portal/overview">Start a request</Link></div>
            </Panel>}
          </>}
      </main>
    </div>
  </div>;
}

function RequestDetail({ row, data, busy, act, refresh }: {
  row: RequestRow; data: Workspace; busy: boolean; act: (task: () => Promise<void>) => Promise<void>; refresh: () => void;
}) {
  const [submitted] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("submitted"));
  const index = stageIndex[row.status];
  const files = data.attachments.filter((item) => !item.eventId);
  const activity = [...row.history, ...row.events.filter((item) => ["status", "submitted"].includes(item.kind))].sort((a, b) => b.createdAt - a.createdAt);
  return <>
    {submitted && <div className="axp-card axp-confirm" role="status"><strong>Request received</strong>
      <p>{data.policy.responseTime || "Axonill will review your request and post an update here."}</p></div>}
    <Panel title={workspaceTitle(row)} link={{ label: "All requests", href: "/portal/requests" }}>
      <div className="axp-row"><p className="axp-note axp-break">{row.reference}</p><span className="axp-badge">{workspaceStatuses[row.status]}</span></div>
      <p>{statusActions[row.status]}</p>
      {index !== undefined && <ol className="axp-steps">{stages.map((item, i) => <li key={item} data-complete={i < index} aria-current={i === index ? "step" : undefined}>{item}</li>)}</ol>}
      {row.projectId ? <Link className="axp-primary-link" href={"/portal/project/" + row.projectId}>Open Project Workspace</Link> :
        !["cancelled", "closed", "accepted", "awaiting"].includes(row.status) && <Button className="axp-fit" variant="outline" type="button" disabled={busy}
          onClick={() => { if (window.confirm("Cancel this project request?")) void act(async () => { await sendWorkspace("/requests/" + row.id + "/cancel", "POST"); refresh(); }); }}>Cancel request</Button>}
    </Panel>
    <Panel title="Request summary"><BriefSummary input={row.input} catalog={data.catalog} attached={[]} />
      {files.map((file) => <a key={file.id} href={workspaceApi + "/requests/" + row.id + "/attachments/" + file.id}>{file.name}</a>)}</Panel>
    <Panel title="Related quotations"><Quotes items={row.quotes} /></Panel>
    <Panel title="Related meetings" link={{ label: "Meetings", href: "/portal/meetings?request=" + row.id }}>
      {row.meetings.length ? <ul className="axp-list">{row.meetings.map((item) => <li key={item.id}><strong>{item.title}</strong>
        <p className="axp-note">{fmt(item.scheduledAt, true)} · {item.status === "requested" ? "Awaiting confirmation" : item.status}</p></li>)}</ul> :
        <Empty>{row.input.consultation ? "Consultation requested in your brief. You can also suggest a time in Meetings." : "No meetings linked to this request yet."}</Empty>}
    </Panel>
    <RequestConversation row={row} attachments={data.attachments} refresh={refresh} />
    <Panel title="Activity history">
      {activity.length > 0 ? <ul className="axp-list">{activity.map((item) => <li key={item.id}><strong>{item.body}</strong><p className="axp-note">{fmt(item.createdAt, true)}</p></li>)}</ul> :
        <Empty>No updates yet.</Empty>}
    </Panel>
  </>;
}

function RequestConversation({ row, attachments, refresh }: { row: RequestRow; attachments: Workspace["attachments"]; refresh: () => void }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const messages = row.events.filter((item) => ["client_message", "staff_message", "needs_info"].includes(item.kind));
  const path = "/requests/" + row.id;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    const form = event.currentTarget;
    const content = new FormData(form);
    const file = content.get("file");
    try {
      if (file instanceof File && file.size) {
        await sendWorkspace(path + "/attachments", "POST", content);
        if (row.status === "needs_info") {
          form.reset();
          refresh();
          return;
        }
      } else {
        await sendWorkspace(path + "/messages", "POST", { text: content.get("message"), action: row.status === "needs_info" ? "response" : "message" });
      }
      form.reset();
      refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not send the message."); }
    finally { lock.current = false; setPending(false); }
  }
  return <Panel title="Messages">
    {messages.length ? <ul className="axp-list">{messages.map((item) => <li key={item.id}>
      <div className="axp-row"><strong>{item.kind === "client_message" ? "You" : item.kind === "needs_info" ? "Axonill requested information" : "Axonill"}</strong>
      <span className="axp-note">{fmt(item.createdAt, true)}</span></div><p className="axp-prewrap">{item.body}</p>
      {attachments.filter((file) => file.eventId === item.id).map((file) => <a key={file.id} href={workspaceApi + path + "/attachments/" + file.id}>{file.name}</a>)}
    </li>)}</ul> : <Empty>Send a message if you have a question or an update about this request.</Empty>}
    {!["draft", "cancelled", "closed"].includes(row.status) && <form className="axp-stack" onSubmit={submit}>
      <Field label={row.status === "needs_info" ? "Provide the requested information" : "Your message"}><textarea name="message" required maxLength={4000} rows={3} /></Field>
      <Field label="Attachment (optional)"><input type="file" accept={attachmentAccept} name="file" /></Field>
      {error && <p role="alert" className="axp-feedback">{error}</p>}
      <Button type="submit" className="axp-fit" disabled={pending}>{pending ? "Sending…" : "Send message"}</Button>
    </form>}
  </Panel>;
}

function PortalQuote({ id, revisions, refresh }: { id: string; revisions: Workspace["quotes"]; refresh: () => void }) {
  const endpoint = workspaceApi + "/quotations/" + id;
  const { data, error, loading, reload } = useLoader(() => fetchJson<{ quote: PublicQuote }>(endpoint));
  if (loading && !data) return <Panel title="Loading quotation"><p role="status">Loading your quotation…</p></Panel>;
  if (!data || error) return <Panel title="Quotation unavailable" link={{ label: "All quotations", href: "/portal/quotations" }}><Empty>{error ?? "This quotation is unavailable."}</Empty></Panel>;
  const latest = revisions.find((item) => item.number === data.quote.number);
  return <>
    <Panel title={data.quote.number} link={{ label: "All quotations", href: "/portal/quotations" }}>
      <Quotes items={revisions.filter((item) => item.number === data.quote.number)} />
      <div className="axp-actions"><a href={endpoint + "/pdf?view=1"} target="_blank" rel="noreferrer">Preview PDF</a>
        <a href={endpoint + "/pdf"}>Download PDF</a><PrintQuotation /></div>
    </Panel>
    <QuotationDocument quote={data.quote} />
    {latest?.id === id && latest.canRespond && <QuotationClientResponse endpoint={endpoint} status={data.quote.status} onResponse={() => { reload(); refresh(); }} />}
  </>;
}

function Account({ profile, changed }: { profile: NonNullable<Workspace["profile"]>; changed: (value: NonNullable<Workspace["profile"]>) => void }) {
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setNotice("");
    const form = new FormData(event.currentTarget);
    const value = { name: String(form.get("name")), company: String(form.get("company")), phone: String(form.get("phone")) };
    try { await sendWorkspace("/profile", "PATCH", value); changed({ ...profile, ...value }); setNotice("Profile saved."); }
    catch (failure) { setNotice(failure instanceof Error ? failure.message : "Could not update your profile."); }
    finally { setBusy(false); }
  }
  return <Panel title="Profile"><form className="axp-stack axp-narrow" onSubmit={update}>
    <Field label="Name"><input name="name" defaultValue={profile.name} required maxLength={120} /></Field>
    <Field label="Sign-in email"><input value={profile.email} readOnly /></Field>
    <Field label="Company"><input name="company" defaultValue={profile.company ?? ""} maxLength={160} /></Field>
    <Field label="Phone"><input name="phone" type="tel" defaultValue={profile.phone ?? ""} maxLength={40} /></Field>
    {notice && <p role="status">{notice}</p>}<Button type="submit" className="axp-fit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
  </form></Panel>;
}
