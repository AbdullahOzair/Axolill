"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  Download,
  Eye,
  Filter,
  FolderPlus,
  Inbox,
  Loader2,
  Mail,
  Package,
  Paperclip,
  Phone,
  Target,
  TrendingUp,
  Users,
  Video,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fetchJson, useLoader } from "@/lib/use-api";
import { fmtDate, today } from "@/lib/format";
import type {
  ClientAccount,
  Lead,
  LeadAttachment,
  LeadStatus,
  Meeting,
  Project,
  User,
} from "@/lib/data-model";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ErrorState,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/ui/states";
import { AdminPage } from "@/components/admin/admin-page";
import {
  DataTable,
  type Column,
  type RowAction,
} from "@/components/admin/data-table";
import {
  Field,
  FormDialog,
  FORM_ERROR,
  type FieldErrors,
} from "@/components/admin/form-dialog";

/* ─────────────────────────── constants ─────────────────────────── */

const LEAD_STATUS: Record<LeadStatus, { label: string; className: string }> = {
  new: {
    label: "New",
    className: "bg-brand-secondary/10 text-brand-secondary dark:text-blue-400",
  },
  contacted: {
    label: "Contacted",
    className: "bg-accent-cyan/10 text-cyan-700 dark:text-cyan-400",
  },
  qualified: {
    label: "Qualified",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  won: { label: "Won", className: "bg-success/10 text-success" },
  lost: { label: "Lost", className: "bg-muted text-muted-foreground" },
};

const FILTERS: ("all" | LeadStatus)[] = [
  "all",
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
];

const DURATIONS = [15, 30, 45, 60, 90, 120];

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Now + 1 hour, rounded to the next half hour, as a datetime-local value. */
function defaultStart() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() > 30 ? 60 : 30, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** today() + N days as YYYY-MM-DD */
function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ─────────────────────────── data types ────────────────────────── */

type AdminData = {
  leads: Lead[];
  projects: Project[];
  meetings: Meeting[];
  clients: ClientAccount[];
};

type LeadDetail = {
  lead: Lead;
  client: User | null;
  attachments: LeadAttachment[];
};

type ConvertDraft = {
  clientId: string;
  name: string;
  service: string;
  targetDate: string;
};

type MeetDraft = {
  clientId: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  description: string;
};

/* ─────────────────────────── loader ────────────────────────────── */

async function loadAdmin(): Promise<AdminData> {
  const [l, p, m, c] = await Promise.all([
    fetchJson<{ leads: Lead[] }>("/api/contact"),
    fetchJson<{ projects: Project[] }>("/api/projects"),
    fetchJson<{ meetings: Meeting[] }>("/api/meetings"),
    fetchJson<{ clients: ClientAccount[] }>("/api/clients"),
  ]);
  return {
    leads: l.leads,
    projects: p.projects,
    meetings: m.meetings,
    clients: c.clients,
  };
}

/* ═══════════════════════ LeadsView (root) ═══════════════════════ */

export function LeadsView() {
  const { data, error, loading, reload } = useLoader<AdminData>(loadAdmin);
  const [filter, setFilter] = React.useState<"all" | LeadStatus>("all");

  // ── detail panel ──────────────────────────────────────────────
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
  const [detail, setDetail] = React.useState<LeadDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  // ── convert to project dialog ─────────────────────────────────
  const [convertOpen, setConvertOpen] = React.useState(false);
  const [convertDraft, setConvertDraft] = React.useState<ConvertDraft>({
    clientId: "",
    name: "",
    service: "",
    targetDate: "",
  });
  const [convertSaving, setConvertSaving] = React.useState(false);
  const [convertErrors, setConvertErrors] = React.useState<FieldErrors>({});

  // ── schedule meet dialog ──────────────────────────────────────
  const [meetOpen, setMeetOpen] = React.useState(false);
  const [meetDraft, setMeetDraft] = React.useState<MeetDraft>({
    clientId: "",
    title: "",
    startsAt: "",
    durationMinutes: 30,
    description: "",
  });
  const [meetSaving, setMeetSaving] = React.useState(false);
  const [meetError, setMeetError] = React.useState<string | null>(null);
  const [meetNeedsConnect, setMeetNeedsConnect] = React.useState(false);

  const leads = data?.leads ?? [];
  const projects = data?.projects ?? [];
  const meetings = data?.meetings ?? [];
  const clients = data?.clients ?? [];

  const openLeads = leads.filter(
    (l) => l.status !== "won" && l.status !== "lost"
  ).length;
  const qualified = leads.filter((l) => l.status === "qualified").length;
  const won = leads.filter((l) => l.status === "won").length;
  const winRate = leads.length ? Math.round((won / leads.length) * 100) : 0;
  const pipelineValue = projects.reduce((sum, p) => sum + p.budget, 0);
  const upcoming = meetings.filter((m) => m.status === "scheduled").length;

  const visible =
    filter === "all" ? leads : leads.filter((l) => l.status === filter);

  // ── open detail ───────────────────────────────────────────────
  async function openDetail(l: Lead) {
    setSelectedLead(l);
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetchJson<LeadDetail>(`/api/admin/leads/${l.id}`);
      setDetail(res);
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : "Could not load lead details."
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedLead(null);
    setDetail(null);
  }

  // ── open convert dialog ───────────────────────────────────────
  function openConvert() {
    if (!selectedLead) return;
    setConvertDraft({
      clientId: selectedLead.clientId ?? "",
      name: `${selectedLead.name}'s project`,
      service: selectedLead.service ?? "",
      targetDate: addDays(60),
    });
    setConvertErrors({});
    setConvertOpen(true);
  }

  async function saveConvert() {
    const errs: FieldErrors = {};
    if (!convertDraft.clientId) errs.clientId = "A client is required.";
    if (!convertDraft.name.trim()) errs.name = "Give the project a name.";
    if (!convertDraft.service.trim()) errs.service = "What kind of work is this?";
    if (!convertDraft.targetDate) errs.targetDate = "Pick a target date.";
    if (Object.keys(errs).length) return setConvertErrors(errs);

    setConvertSaving(true);
    setConvertErrors({});
    try {
      await fetchJson("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: convertDraft.clientId,
          name: convertDraft.name.trim(),
          service: convertDraft.service.trim(),
          startDate: today(),
          targetDate: convertDraft.targetDate,
        }),
      });
      // Mark lead as won
      if (selectedLead) {
        await fetchJson(`/api/admin/leads/${selectedLead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "won" }),
        });
      }
      setConvertOpen(false);
      closeDetail();
      reload();
    } catch (err) {
      setConvertErrors({
        [FORM_ERROR]: err instanceof Error ? err.message : "Could not create project.",
      });
    } finally {
      setConvertSaving(false);
    }
  }

  // ── open schedule meet ────────────────────────────────────────
  function openScheduleMeet() {
    if (!selectedLead) return;
    setMeetDraft({
      clientId: selectedLead.clientId ?? "",
      title: `Intro call — ${selectedLead.name}`,
      startsAt: defaultStart(),
      durationMinutes: 30,
      description: "",
    });
    setMeetError(null);
    setMeetNeedsConnect(false);
    setMeetOpen(true);
  }

  async function saveMeet() {
    if (!meetDraft.clientId) return setMeetError("Pick a client.");
    if (!meetDraft.title.trim()) return setMeetError("Title is required.");
    if (!meetDraft.startsAt) return setMeetError("Pick a date and time.");

    setMeetSaving(true);
    setMeetError(null);
    setMeetNeedsConnect(false);
    try {
      await fetchJson("/api/meetings/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: meetDraft.clientId,
          projectId: null,
          title: meetDraft.title.trim(),
          startsAt: meetDraft.startsAt,
          durationMinutes: meetDraft.durationMinutes,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          description: meetDraft.description || undefined,
        }),
      });
      setMeetOpen(false);
      reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not schedule.";
      setMeetError(msg);
      setMeetNeedsConnect(/connect/i.test(msg));
    } finally {
      setMeetSaving(false);
    }
  }

  // ── table columns ─────────────────────────────────────────────
  const columns: Column<Lead>[] = [
    {
      key: "name",
      header: "Name",
      cell: (l) => <span className="font-medium">{l.name}</span>,
    },
    {
      key: "company",
      header: "Company",
      cell: (l) => (
        <span className="text-muted-foreground">{l.company ?? "—"}</span>
      ),
    },
    {
      key: "service",
      header: "Service",
      cell: (l) => (
        <span className="text-muted-foreground">{l.service ?? "—"}</span>
      ),
    },
    {
      key: "budget",
      header: "Budget",
      cell: (l) => (
        <span className="text-muted-foreground tabular-nums">
          {l.budgetRange ?? "—"}
        </span>
      ),
    },
    {
      key: "source",
      header: "Source",
      cell: (l) => (
        <span className="text-muted-foreground">{l.source ?? "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (l) => (
        <Badge
          className={cn(
            "rounded-full border-0 text-xs font-medium whitespace-nowrap",
            LEAD_STATUS[l.status].className
          )}
        >
          {LEAD_STATUS[l.status].label}
        </Badge>
      ),
    },
  ];

  const actions: RowAction<Lead>[] = [
    {
      icon: Eye,
      label: (l) => `View ${l.name}`,
      onClick: openDetail,
    },
    {
      icon: Mail,
      label: (l) => `Email ${l.name}`,
      onClick: (l) => window.open(`mailto:${l.email}`, "_self"),
    },
  ];

  // ── client items for select ───────────────────────────────────
  const clientItems = clients.map((c) => ({
    value: c.id,
    label: c.company ? `${c.name} — ${c.company}` : c.name,
  }));

  const durationItems = DURATIONS.map((d) => ({
    value: String(d),
    label: `${d} minutes`,
  }));

  return (
    <AdminPage
      eyebrow="Leads"
      title="Leads"
      description="Enquiries from the website contact form and client portal."
    >
      {loading ? (
        <div className="space-y-6">
          <StatCardsSkeleton />
          <section className="admin-surface">
            <TableSkeleton rows={6} />
          </section>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Users}
              label="Open leads"
              value={String(openLeads)}
              hint={`${leads.length} total · ${qualified} qualified`}
            />
            <StatCard
              icon={Target}
              label="Win rate"
              value={`${winRate}%`}
              hint={`${won} won of ${leads.length}`}
            />
            <StatCard
              icon={TrendingUp}
              label="Project value"
              value={fmtMoney(pipelineValue)}
              hint={`${projects.length} active projects`}
            />
            <StatCard
              icon={CalendarDays}
              label="Upcoming meetings"
              value={String(upcoming)}
              hint={`${meetings.length} total booked`}
            />
          </div>

          {/* Status filter */}
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "all" ? "All" : LEAD_STATUS[f].label}
              </button>
            ))}
          </div>

          <DataTable<Lead>
            rows={visible}
            columns={columns}
            actions={actions}
            getRowId={(l) => l.id}
            noun={{ one: "lead", many: "leads" }}
            empty={
              leads.length === 0
                ? {
                    icon: Inbox,
                    title: "No leads yet",
                    description:
                      "Submissions from the website contact form will land here.",
                  }
                : {
                    icon: Filter,
                    title: `No ${LEAD_STATUS[filter as LeadStatus]?.label.toLowerCase() ?? ""} leads`,
                    description: "Nothing matches this status right now.",
                    action: {
                      label: "Show all leads",
                      onClick: () => setFilter("all"),
                    },
                  }
            }
          />
        </div>
      )}

      {/* ── Lead detail panel ───────────────────────────────────── */}
      <LeadDetailPanel
        lead={selectedLead}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onClose={closeDetail}
        onConvert={openConvert}
        onScheduleMeet={openScheduleMeet}
      />

      {/* ── Convert to Project dialog ────────────────────────────── */}
      <FormDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        title="Convert to project"
        description="Creates a new project pre-filled from this lead and marks it as won."
        error={convertErrors[FORM_ERROR]}
        saving={convertSaving}
        onSubmit={saveConvert}
        submitLabel="Create project"
        savingLabel="Creating…"
      >
        <Field id="cv-client" label="Client" error={convertErrors.clientId} required>
          {(f) =>
            clients.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                No clients yet — create a client account first.
              </p>
            ) : (
              <Select
                items={clientItems}
                value={convertDraft.clientId}
                onValueChange={(v) =>
                  setConvertDraft((d) => ({ ...d, clientId: v as string }))
                }
              >
                <SelectTrigger
                  id={f.id}
                  aria-invalid={f["aria-invalid"]}
                  aria-describedby={f["aria-describedby"]}
                  className="w-full"
                >
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.company ? ` — ${c.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          }
        </Field>

        <Field id="cv-name" label="Project name" error={convertErrors.name} required>
          {(f) => (
            <Input
              {...f}
              value={convertDraft.name}
              onChange={(e) =>
                setConvertDraft((d) => ({ ...d, name: e.target.value }))
              }
              placeholder="Acme Web Platform"
            />
          )}
        </Field>

        <Field
          id="cv-service"
          label="Service"
          hint="The type of work — e.g. Web Development, AI Automation."
          error={convertErrors.service}
          required
        >
          {(f) => (
            <Input
              {...f}
              value={convertDraft.service}
              onChange={(e) =>
                setConvertDraft((d) => ({ ...d, service: e.target.value }))
              }
              placeholder="Web Development"
            />
          )}
        </Field>

        <Field
          id="cv-target"
          label="Target date"
          hint="Defaults to 60 days from today — adjust as needed."
          error={convertErrors.targetDate}
          required
        >
          {(f) => (
            <Input
              {...f}
              type="date"
              value={convertDraft.targetDate}
              onChange={(e) =>
                setConvertDraft((d) => ({ ...d, targetDate: e.target.value }))
              }
            />
          )}
        </Field>
      </FormDialog>

      {/* ── Schedule Google Meet dialog ──────────────────────────── */}
      <Dialog open={meetOpen} onOpenChange={setMeetOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule a Google Meet</DialogTitle>
            <DialogDescription>
              Creates the event on your Google Calendar with a Meet link,
              invites the client, and shows it in their portal.
            </DialogDescription>
          </DialogHeader>

          {meetError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {meetError}
              {meetNeedsConnect && (
                <Link
                  href="/admin/settings/calendar"
                  className="mt-1 block font-medium underline underline-offset-4"
                >
                  Go to Settings → Calendar
                </Link>
              )}
            </div>
          )}

          <div className="space-y-4 py-2">
            {/* Client */}
            <div className="space-y-2">
              <Label htmlFor="sm-client">Client</Label>
              {clients.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  No clients yet.
                </p>
              ) : (
                <Select
                  items={clientItems}
                  value={meetDraft.clientId}
                  onValueChange={(v) =>
                    setMeetDraft((d) => ({ ...d, clientId: v as string }))
                  }
                >
                  <SelectTrigger id="sm-client" className="w-full">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {c.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="sm-title">Title</Label>
              <Input
                id="sm-title"
                value={meetDraft.title}
                onChange={(e) =>
                  setMeetDraft((d) => ({ ...d, title: e.target.value }))
                }
                placeholder="Intro call"
              />
            </div>

            {/* Date + duration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sm-start">Date &amp; time</Label>
                <Input
                  id="sm-start"
                  type="datetime-local"
                  value={meetDraft.startsAt}
                  onChange={(e) =>
                    setMeetDraft((d) => ({ ...d, startsAt: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sm-duration">Duration</Label>
                <Select
                  items={durationItems}
                  value={String(meetDraft.durationMinutes)}
                  onValueChange={(v) =>
                    setMeetDraft((d) => ({
                      ...d,
                      durationMinutes: Number(v as string),
                    }))
                  }
                >
                  <SelectTrigger id="sm-duration" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Agenda */}
            <div className="space-y-2">
              <Label htmlFor="sm-desc">Agenda (optional)</Label>
              <Textarea
                id="sm-desc"
                rows={3}
                value={meetDraft.description}
                onChange={(e) =>
                  setMeetDraft((d) => ({ ...d, description: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={meetSaving} />}>
              Cancel
            </DialogClose>
            <Button
              onClick={saveMeet}
              disabled={meetSaving || clients.length === 0}
              className="gap-2"
            >
              {meetSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CalendarDays className="size-4" />
              )}
              {meetSaving ? "Scheduling…" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}

/* ══════════════════════ LeadDetailPanel ════════════════════════ */

function LeadDetailPanel({
  lead,
  detail,
  loading,
  error,
  onClose,
  onConvert,
  onScheduleMeet,
}: {
  lead: Lead | null;
  detail: LeadDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConvert: () => void;
  onScheduleMeet: () => void;
}) {
  if (!lead) return null;

  const client = detail?.client ?? null;
  const attachments = detail?.attachments ?? [];
  const canConvert = !!lead.clientId;

  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="grid max-h-[90vh] grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0 sm:max-w-xl">
        {/* Header */}
        <DialogHeader className="border-b border-border/60 px-6 py-5 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="font-heading text-lg leading-tight">
                {lead.name}
              </DialogTitle>
              <a
                href={`mailto:${lead.email}`}
                className="mt-0.5 block text-sm text-brand-secondary underline-offset-4 hover:underline dark:text-blue-400"
              >
                {lead.email}
              </a>
            </div>
            <Badge
              className={cn(
                "shrink-0 rounded-full border-0 text-xs font-medium",
                LEAD_STATUS[lead.status].className
              )}
            >
              {LEAD_STATUS[lead.status].label}
            </Badge>
          </div>
          {lead.company && (
            <DialogDescription className="mt-1">
              {lead.company}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Body */}
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          {!loading && !error && (
            <div className="space-y-6">
              {/* ── Meta row ────────────────────────────────────── */}
              <div className="grid gap-3 sm:grid-cols-2">
                {lead.packageName && (
                  <DetailRow
                    icon={Package}
                    label="Package"
                    value={
                      <Badge className="rounded-full bg-brand-secondary/10 text-brand-secondary dark:text-blue-400">
                        {lead.packageName}
                      </Badge>
                    }
                  />
                )}
                {lead.budgetRange && (
                  <DetailRow
                    icon={TrendingUp}
                    label="Budget"
                    value={lead.budgetRange}
                  />
                )}
                {lead.service && (
                  <DetailRow
                    icon={FolderPlus}
                    label="Service"
                    value={lead.service}
                  />
                )}
                {lead.source && (
                  <DetailRow
                    icon={Target}
                    label="Source"
                    value={lead.source}
                  />
                )}
              </div>

              {/* ── Client ──────────────────────────────────────── */}
              {client ? (
                <section>
                  <SectionHeading>Linked client</SectionHeading>
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 p-4">
                    <Initials name={client.name} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-tight">{client.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {client.email}
                      </p>
                      {client.company && (
                        <p className="text-xs text-muted-foreground">
                          {client.company}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {client.phone && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <a
                                href={`tel:${client.phone}`}
                                aria-label={`Call ${client.name}`}
                                className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              />
                            }
                          >
                            <Phone className="size-4" />
                          </TooltipTrigger>
                          <TooltipContent>{client.phone}</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Link
                              href="/admin/clients"
                              aria-label="Go to clients"
                              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            />
                          }
                        >
                          <Users className="size-4" />
                        </TooltipTrigger>
                        <TooltipContent>View in Clients</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </section>
              ) : (
                <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  No linked client — submitted anonymously from the website.
                </p>
              )}

              {/* ── Wants call ──────────────────────────────────── */}
              <section>
                <SectionHeading>Call request</SectionHeading>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {lead.wantsCall ? (
                    <>
                      <Badge className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        Wants an intro call
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onScheduleMeet}
                        disabled={!lead.clientId}
                        className="gap-1.5"
                      >
                        <Video className="size-3.5" />
                        Schedule Google Meet
                      </Button>
                      {!lead.clientId && (
                        <p className="text-xs text-muted-foreground">
                          Link to a client first to schedule.
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No call requested.
                    </span>
                  )}
                </div>
              </section>

              {/* ── Message / description ───────────────────────── */}
              {lead.message && (
                <section>
                  <SectionHeading>Message</SectionHeading>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {lead.message}
                  </p>
                </section>
              )}

              {/* ── Attachments ─────────────────────────────────── */}
              {attachments.length > 0 && (
                <section>
                  <SectionHeading>
                    Attachments ({attachments.length})
                  </SectionHeading>
                  <ul className="mt-3 space-y-2">
                    {attachments.map((att) => (
                      <li
                        key={att.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{att.name}</span>
                          <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                            {fmtFileSize(att.sizeBytes)}
                          </span>
                        </span>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <a
                                href={`/api/media/${att.r2Key}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Download ${att.name}`}
                                className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              />
                            }
                          >
                            <Download className="size-4" />
                          </TooltipTrigger>
                          <TooltipContent>Download</TooltipContent>
                        </Tooltip>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-card/60 px-6 py-4 backdrop-blur">
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={onConvert}
                  disabled={!canConvert || loading}
                  className="gap-2"
                />
              }
            >
              <FolderPlus className="size-4" />
              Convert to Project
            </TooltipTrigger>
            {!canConvert && (
              <TooltipContent>
                Link to a client first to convert.
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════ small helpers ══════════════════════════ */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h4>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-background/40 p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function Initials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-secondary/20 to-accent-cyan/20 text-sm font-semibold text-brand-secondary ring-2 ring-brand-secondary/20 dark:text-blue-400">
      {initials}
    </span>
  );
}

/* ══════════════════════ StatCard ═══════════════════════════════ */

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-5 shadow-sm transition-colors hover:border-brand-secondary/40">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand-secondary/10 to-accent-cyan/10 text-brand-secondary ring-1 ring-brand-secondary/15 dark:text-blue-400">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 font-heading text-3xl font-bold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
