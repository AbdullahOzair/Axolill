"use client";

import { useState, type FormEvent } from "react";

import { AdminPage } from "@/components/admin/admin-page";
import { Button } from "@/components/ui/button";
import {
  GROUP_LABELS, INQUIRY_COUNTRIES, INQUIRY_GROUPS, INQUIRY_PRIORITIES, INQUIRY_STAGES, INQUIRY_TYPES,
  STAGE_LABELS, inquiryCountry, type InquiryGroup, type InquiryServiceChoice, type InquiryStage,
} from "@/lib/inquiries";
import { InquiryAnalytics, type Analytics } from "./inquiry-analytics";
import { InquiryDrawer, type InquiryRow, type TeamOption } from "./inquiry-detail";
import { inquiryMutation, useInquiryQuery } from "./inquiry-query";
import styles from "./conversions.module.css";

const API = "/api/admin/inquiries";
const COUNTRIES = INQUIRY_COUNTRIES.map((code) => ({ code, name: inquiryCountry(code) })).sort((a, b) => a.name.localeCompare(b.name));
type Results = { inquiries: InquiryRow[]; total: number; team: TeamOption[] };
type Range = { from: string; to: string };
const PRESETS = ["Today", "Last 7 days", "Last 30 days", "This month", "Custom"] as const;
type Preset = typeof PRESETS[number];

function recentRange(preset: Exclude<Preset, "Custom">): Range {
  const to = new Date().toISOString().slice(0, 10);
  const days = preset === "Last 7 days" ? 6 : preset === "Last 30 days" ? 29 : 0;
  const from = preset === "This month" ? to.slice(0, 7) + "-01" :
    new Date(Date.parse(to) - days * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
}

export function ConversionsView() {
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState<"table" | "board">("table");
  const [page, setPage] = useState(1);
  const [preset, setPreset] = useState<Preset>("Last 30 days");
  const [range, setRange] = useState<Range>(() => recentRange("Last 30 days"));
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, open] = useState<{ id: string; stage?: InquiryStage }>();
  const [moving, setMoving] = useState<string>();
  const [error, setError] = useState("");
  const [settings, showSettings] = useState(false);
  const refresh = () => setRevision((value) => value + 1);

  const size = view === "table" ? 20 : 40;
  const rangeQuery = new URLSearchParams(range);
  const query = new URLSearchParams({ ...filters, ...range, page: String(page), size: String(size) });
  const list = useInquiryQuery<Results>(API + "?" + query, revision);
  const analytics = useInquiryQuery<Analytics>(API + "/analytics?" + rangeQuery, revision);
  const team = list?.data?.team ?? [];

  function setDateRange(next: Range) { setRange(next); setPage(1); }

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setFilters(Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== "")) as Record<string, string>);
    setPage(1);
  }

  async function move(row: InquiryRow, stage: InquiryStage) {
    if (row.stage === stage || row.stage === "converted" || moving) return;
    if (stage === "lost" || stage === "converted") {
      open({ id: row.id, stage });
      return;
    }
    setMoving(row.id);
    setError("");
    try {
      await inquiryMutation(API + "/" + encodeURIComponent(row.id), { action: "update", changes: { stage } });
      refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Status could not be changed.");
    } finally { setMoving(undefined); }
  }

  return (
    <AdminPage eyebrow="Business" title="Leads & Conversions" description="Manage Work With Us inquiries from first contact to conversion."
      action={<div className={styles.toolbar}>
        <Button variant="outline" onClick={refresh}>Refresh</Button>
        <Button variant="outline" onClick={() => showSettings((value) => !value)} aria-expanded={settings}>Reporting settings</Button>
      </div>}>
      <div className={styles.workspace}>
        {settings && <Settings revision={revision} onSave={refresh} />}
        <section className={styles.panel} aria-label="Date filters">
          <div className={styles.toolbar}>
            <label>Reporting period<select value={preset} onChange={(event) => {
              const next = event.currentTarget.value as Preset;
              setPreset(next);
              if (next !== "Custom") setDateRange(recentRange(next));
            }}>{PRESETS.map((name) => <option key={name}>{name}</option>)}</select></label>
            {preset === "Custom" && <form className={styles.toolbar} onSubmit={(event) => {
              event.preventDefault();
              const fields = new FormData(event.currentTarget);
              setDateRange({ from: String(fields.get("from")), to: String(fields.get("to")) });
            }}>
              <label>From<input type="date" name="from" defaultValue={range.from} required /></label>
              <label>Through<input type="date" name="to" defaultValue={range.to} required /></label>
              <Button type="submit">Apply dates</Button>
            </form>}
          </div>
        </section>

        {analytics?.data ? <InquiryAnalytics data={analytics.data} /> : (
          <p className={styles.panel} role={analytics?.error ? "alert" : "status"}>{analytics?.error ?? "Loading conversion analytics…"}</p>
        )}

        <section className={styles.panel} aria-labelledby="inquiry-records-heading">
          <div className={styles.recordHeading}>
            <h2 id="inquiry-records-heading">Inquiry records</h2>
            <div className={styles.toolbar}>
              <Button type="button" size="sm" variant={view === "table" ? "default" : "outline"} aria-pressed={view === "table"}
                onClick={() => { setView("table"); setPage(1); }}>Table</Button>
              <Button type="button" size="sm" variant={view === "board" ? "default" : "outline"} aria-pressed={view === "board"}
                onClick={() => { setView("board"); setPage(1); }}>Kanban</Button>
              <a className={styles.csv} href={API + "?" + new URLSearchParams({ ...filters, ...range, export: "csv" })}>Export CSV</a>
            </div>
          </div>
          <form className={styles.toolbar} onSubmit={filter}>
            <label>Search<input name="q" type="search" maxLength={100} placeholder="Name, reference, or service" /></label>
            <label>Status<select name="stage"><option value="">All statuses</option>
              {INQUIRY_STAGES.map((stage) => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}</select></label>
            <label>Type<select name="type"><option value="">All types</option>{INQUIRY_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>Priority<select name="priority"><option value="">All priorities</option>{INQUIRY_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
            <label>Country<select name="country"><option value="">All countries</option>
              {COUNTRIES.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}</select></label>
            <label>Assignee<select name="assignee"><option value="">All assignees</option><option value="unassigned">Unassigned</option>
              {team.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>
            <label>Sort<select name="sort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option>
              <option value="name">Name</option><option value="followUp">Next follow-up</option></select></label>
            <Button type="submit">Apply filters</Button>
            <Button type="reset" variant="outline" onClick={() => { setFilters({}); setPage(1); }}>Clear</Button>
          </form>

          {error && <p role="alert" className={styles.error}>{error}</p>}
          {list?.data ? (
            <>
              {list.data.inquiries.length ? view === "table" ? (
                <InquiryTable rows={list.data.inquiries} inspect={(id) => open({ id })} />
              ) : <InquiryBoard rows={list.data.inquiries} inspect={(id) => open({ id })} move={move} moving={moving} /> : (
                <p className={styles.hint}>No inquiries match these filters.</p>
              )}
              <div className={styles.pagination}>
                <p>{list.data.total.toLocaleString()} {list.data.total === 1 ? "inquiry" : "inquiries"} · Page {page} of {Math.max(1, Math.ceil(list.data.total / size))}</p>
                <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button type="button" variant="outline" disabled={page * size >= list.data.total} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </>
          ) : <p role={list?.error ? "alert" : "status"}>{list?.error ?? "Loading inquiries…"}</p>}
        </section>
      </div>
      {selected && <InquiryDrawer key={selected.id + (selected.stage ?? "")} id={selected.id} suggestedStage={selected.stage}
        revision={revision} onClose={() => open(undefined)} refresh={refresh} />}
    </AdminPage>
  );
}

const shortDate = (value: string | null) => value ? new Date(value).toLocaleDateString() : "—";
function InquiryTable({ rows, inspect }: { rows: InquiryRow[]; inspect: (id: string) => void }) {
  return (
    <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Inquiry table">
      <table>
        <thead><tr>{["Reference", "Client", "Type", "Requested services", "Country", "Budget", "Status", "Priority", "Assignee", "Submitted", "Follow-up", "Actions"].map(
          (label) => <th scope="col" key={label}>{label}</th>,
        )}</tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.id}>
            <th scope="row">{row.reference}</th><td>{row.name}</td><td>{row.type}</td>
            <td>{row.services.join(", ") || "—"}</td><td>{inquiryCountry(row.country)}</td>
            <td>{row.budget === null ? "—" : row.budget.toLocaleString() + (row.currency ? " " + row.currency : "")}</td>
            <td>{STAGE_LABELS[row.stage]}</td><td>{row.priority}</td><td>{row.assignee ?? "Unassigned"}</td>
            <td>{shortDate(row.createdAt)}</td><td>{shortDate(row.followUpAt)}</td>
            <td><Button type="button" size="sm" variant="outline" onClick={() => inspect(row.id)} aria-label={`Open inquiry ${row.reference}`}>Open</Button></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function InquiryBoard({ rows, inspect, move, moving }: {
  rows: InquiryRow[]; inspect: (id: string) => void; move: (row: InquiryRow, stage: InquiryStage) => void; moving?: string;
}) {
  const [target, setTarget] = useState<InquiryStage>();
  return (
    <>
      <p className={styles.hint}>Drag a card to move it, or use its status menu. The board shows the current page of results.</p>
      <div className={styles.board} tabIndex={0} role="region" aria-label="Inquiry Kanban board">
        {INQUIRY_STAGES.map((stage) => {
          const matches = rows.filter((row) => row.stage === stage);
          return (
            <section key={stage} className={styles.column} data-target={target === stage}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setTarget(stage); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTarget(undefined); }}
              onDrop={(event) => {
                event.preventDefault();
                setTarget(undefined);
                const dragged = rows.find((row) => row.id === event.dataTransfer.getData("text/plain"));
                if (dragged) move(dragged, stage);
              }}>
              <h3>{STAGE_LABELS[stage]} <small>{matches.length}</small></h3>
              {matches.map((row) => (
                <article key={row.id} draggable={row.stage !== "converted" && !moving} onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", row.id);
                }} onDragEnd={() => setTarget(undefined)}>
                  <button type="button" onClick={() => inspect(row.id)}>{row.name}</button>
                  <p>{row.reference} · {row.type}</p>
                  <p>{inquiryCountry(row.country)} · {row.priority} priority</p>
                  <select aria-label={`Change status for ${row.reference}`} disabled={row.stage === "converted" || !!moving}
                    value={row.stage} onChange={(event) => move(row, event.currentTarget.value as InquiryStage)}>
                    {INQUIRY_STAGES.map((value) => <option key={value} value={value}>{STAGE_LABELS[value]}</option>)}
                  </select>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}

type SettingsData = { settings: { domesticCountry: string; serviceGroups: Record<string, InquiryGroup> }; services: InquiryServiceChoice[] };
function Settings({ revision, onSave }: { revision: number; onSave: () => void }) {
  const result = useInquiryQuery<SettingsData>(API + "/settings", revision);
  const configuration = result?.data;
  const [status, setStatus] = useState<{ error?: string; success?: string }>({});
  const [saving, setSaving] = useState(false);
  return (
    <section className={styles.panel} aria-label="Reporting settings">
      <h2>Reporting settings</h2>
      {configuration ? (
        <form className={styles.miniForm} onSubmit={async (event) => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          const domesticCountry = String(fields.get("domesticCountry"));
          fields.delete("domesticCountry");
          const serviceGroups = Object.fromEntries([...fields].filter(([, value]) => value));
          setSaving(true);
          setStatus({});
          try {
            await inquiryMutation(API + "/settings", { domesticCountry, serviceGroups });
            setStatus({ success: "Settings saved." }); onSave();
          } catch (error) { setStatus({ error: error instanceof Error ? error.message : "Settings could not be saved." }); }
          finally { setSaving(false); }
        }}>
          <label>Domestic market<select name="domesticCountry" defaultValue={configuration.settings.domesticCountry}>
            {COUNTRIES.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}</select></label>
          <details>
            <summary>Project service category mapping</summary>
            <p className={styles.hint}>Map published services to the categories shown on the project inquiry form.</p>
            <div className={styles.formGrid}>{configuration.services.map((service) => (
              <label key={service.key}>{service.label}<select name={service.key} defaultValue={configuration.settings.serviceGroups[service.key] ?? ""}>
                <option value="">Automatic ({GROUP_LABELS[service.group]})</option>
                {INQUIRY_GROUPS.map((group) => <option key={group} value={group}>{GROUP_LABELS[group]}</option>)}</select></label>
            ))}</div>
          </details>
          <Button type="submit" disabled={saving}>Save settings</Button>
        </form>
      ) : <p role={result?.error ? "alert" : "status"}>{result?.error ?? "Loading settings…"}</p>}
      {status.error && <p role="alert" className={styles.error}>{status.error}</p>}
      {status.success && <p role="status">{status.success}</p>}
    </section>
  );
}
