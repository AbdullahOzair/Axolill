"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { fetchJson, useLoader } from "@/lib/use-api";
import { staffRequestStatuses, workspaceStatuses } from "@/lib/portal-workspace";
import styles from "./conversions.module.css";

type Thread = {
  state: string;
  events: { id: string; kind: string; body: string; createdAt: number; readAt: number | null }[];
  attachments: { id: string; name: string; eventId: string | null }[];
};

export function PortalInquiryThread({ leadId }: { leadId: string }) {
  const endpoint = "/api/admin/portal-requests/" + leadId;
  const { data, error, loading, reload } = useLoader(() => fetchJson<Thread>(endpoint));
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  if (loading && !data) return <p role="status">Loading client conversation…</p>;
  if (error || !data) return <p role="alert">{error ?? "Client conversation unavailable."}</p>;

  const post = (path: string, method: string, body: unknown) => fetchJson(endpoint + path, body instanceof FormData ? { method, body } :
    { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  async function run(event: FormEvent<HTMLFormElement>, save: (data: FormData) => Promise<unknown>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    setBusy(true); setFailure(""); setNotice("");
    try { await save(new FormData(form)); form.reset(); setNotice("Saved to the client portal."); reload(); }
    catch (exception) { setFailure(exception instanceof Error ? exception.message : "Could not save this update."); }
    finally { setBusy(false); }
  }

  const messages = data.events.filter((event) => ["staff_message", "client_message", "needs_info"].includes(event.kind));
  const canSend = !["closed", "cancelled"].includes(data.state);
  return <section className={styles.panel}>
    <h3>Client portal conversation</h3>
    <p>Messages here are visible to the client. Add private comments in Internal notes.</p>
    {failure && <p className={styles.error} role="alert">{failure}</p>}
    {notice && <p role="status">{notice}</p>}
    {data.attachments.some((item) => !item.eventId) && <ul>{data.attachments.filter((item) => !item.eventId).map((file) =>
      <li key={file.id}><a className="underline" href={endpoint + "/attachments/" + file.id}>{file.name}</a></li>)}</ul>}
    {messages.some((item) => item.kind === "client_message" && !item.readAt) && <Button type="button" className="justify-self-start" variant="outline" disabled={busy} onClick={async () => {
      setBusy(true); setFailure("");
      try { await post("/read", "POST", {}); reload(); }
      catch (exception) { setFailure(exception instanceof Error ? exception.message : "Could not mark as read."); }
      finally { setBusy(false); }
    }}>Mark client messages as read</Button>}
    <ul className="grid gap-2">
      {messages.map((message) => <li key={message.id} className="rounded-lg border border-border p-3">
        <strong>{message.kind === "client_message" ? "Client" : message.kind === "needs_info" ? "Information requested" : "Axonill"}</strong>
        <span className="ml-2 text-xs text-muted-foreground">{new Date(message.createdAt * 1000).toLocaleString()}</span>
        <p className="whitespace-pre-wrap wrap-anywhere">{message.body}</p>
        {data.attachments.filter((item) => item.eventId === message.id).map((file) =>
          <a key={file.id} className="underline" href={endpoint + "/attachments/" + file.id}>{file.name}</a>)}
      </li>)}
    </ul>
    {canSend && <form className="grid gap-2" onSubmit={(event) => run(event, (value) => {
      const file = value.get("file");
      return file instanceof File && file.size ? post("/attachments", "POST", value) :
        post("/messages", "POST", { text: value.get("message"), action: value.get("action") });
    })}>
      <label className="grid gap-1">Message<textarea name="message" required rows={3} maxLength={4000} className="rounded border border-border p-2"/></label>
      <label className="grid gap-1">Action<select name="action" className="rounded border border-border p-2">
        <option value="message">Send a message</option><option value="needs_info">Request more information</option></select></label>
      <label>Attachment (optional) <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.webp" /></label>
      <Button type="submit" className="justify-self-start" disabled={busy}>Send to client</Button>
    </form>}
    {data.state !== "cancelled" && <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(event) => run(event, (value) => post("/status", "PATCH", { state: value.get("state") }))}>
      <label className="grid gap-1">Client-facing status<select name="state" className="rounded border border-border p-2" defaultValue={staffRequestStatuses.find((item) => item === data.state) ?? ""} required>
        <option value="">Select a status</option>{staffRequestStatuses.map((status) => <option value={status} key={status}>{workspaceStatuses[status]}</option>)}</select></label>
      <Button type="submit" variant="outline" disabled={busy}>Update status</Button>
    </form>}
  </section>;
}
