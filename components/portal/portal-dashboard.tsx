"use client";

import * as React from "react";
import {
  Briefcase,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  CircleDot,
  Clock,
  Download,
  FileText,
  ListChecks,
  Paperclip,
  Receipt,
  RotateCcw,
  Video,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fetchJson, useLoader } from "@/lib/use-api";
import {
  PROJECT_STAGES,
  type Invoice,
  type Meeting,
  type Milestone,
  type MilestoneStatus,
  type Project,
  type ProjectFile,
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
import { Separator } from "@/components/ui/separator";
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  PanelSkeleton,
} from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ---------------------------------- types --------------------------------- */

export type PortalUser = {
  id: string;
  name: string;
  email: string;
  company: string | null;
};

type PortalData = {
  project: Project | null;
  milestones: Milestone[];
  files: ProjectFile[];
  invoices: Invoice[];
  meetings: Meeting[];
};

/* ---------------------------------- utils --------------------------------- */

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const fmtMoney = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

const titleCase = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ------------------------------ status metadata ---------------------------- */

const MILESTONE_STATUS: Record<
  MilestoneStatus,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: {
    label: "Pending",
    className: "bg-muted text-muted-foreground",
    icon: Clock,
  },
  in_progress: {
    label: "In Progress",
    className: "bg-brand-secondary/10 text-brand-secondary dark:text-blue-400",
    icon: CircleDot,
  },
  awaiting_approval: {
    label: "Awaiting Approval",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: CircleAlert,
  },
  approved: {
    label: "Approved",
    className: "bg-success/10 text-success",
    icon: CheckCircle2,
  },
  changes_requested: {
    label: "Changes Requested",
    className: "bg-destructive/10 text-destructive",
    icon: RotateCcw,
  },
};

const INVOICE_STATUS: Record<Invoice["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-brand-secondary/10 text-brand-secondary dark:text-blue-400",
  paid: "bg-success/10 text-success",
  overdue: "bg-destructive/10 text-destructive",
};

/* --------------------------------- loader --------------------------------- */

async function loadPortal(): Promise<PortalData> {
  // Meetings aren't project-scoped — a client can have one booked before any
  // project exists, so fetch them regardless.
  const [{ projects }, { meetings }] = await Promise.all([
    fetchJson<{ projects: Project[] }>("/api/projects"),
    fetchJson<{ meetings: Meeting[] }>("/api/meetings"),
  ]);
  const project = projects[0] ?? null;

  if (!project) {
    return { project: null, milestones: [], files: [], invoices: [], meetings };
  }

  const [ms, fl, inv] = await Promise.all([
    fetchJson<{ milestones: Milestone[] }>(
      `/api/projects/${project.id}/milestones`
    ),
    fetchJson<{ files: ProjectFile[] }>(`/api/projects/${project.id}/files`),
    fetchJson<{ invoices: Invoice[] }>(
      `/api/invoices?projectId=${project.id}`
    ),
  ]);

  return {
    project,
    milestones: ms.milestones,
    files: fl.files,
    invoices: inv.invoices,
    meetings,
  };
}

/* -------------------------------- dashboard -------------------------------- */

export function PortalDashboard({ user }: { user: PortalUser }) {
  const { data, error, loading, reload, setData } =
    useLoader<PortalData>(loadPortal);

  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  /** Approve / request changes — PATCHes the API, then reconciles local state. */
  async function setStatus(id: string, status: MilestoneStatus) {
    if (!data?.project) return;
    setPendingId(id);
    setActionError(null);
    try {
      const { milestone } = await fetchJson<{ milestone: Milestone }>(
        `/api/projects/${data.project.id}/milestones/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      setData((prev) => ({
        ...prev,
        milestones: prev.milestones.map((m) =>
          m.id === milestone.id ? milestone : m
        ),
      }));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not update the milestone."
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="grid gap-8 lg:grid-cols-[280px_1fr] lg:gap-10">
        {/* Sidebar */}
        {loading ? (
          <CardSkeleton className="lg:sticky lg:top-24 lg:h-fit" />
        ) : data?.project ? (
          <Sidebar
            project={data.project}
            user={user}
            milestones={data.milestones}
          />
        ) : (
          <div />
        )}

        <main className="min-w-0 space-y-8">
          {loading ? (
            <>
              <PanelSkeleton rows={1} />
              <PanelSkeleton rows={3} />
              <PanelSkeleton rows={2} />
            </>
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : !data?.project ? (
            <>
              <EmptyState
                title="No active project yet"
                description="Once we kick off your project it'll show up here, with milestones, files, and invoices."
              />
              {/* A meeting can be booked before the project starts. */}
              {data && (
                <MeetingList
                  meetings={data.meetings}
                  projectId={null}
                  onChanged={reload}
                />
              )}
            </>
          ) : (
            <>
              {actionError && (
                <ErrorState message={actionError} className="p-6" />
              )}
              <StageProgress project={data.project} />
              <MeetingList
                meetings={data.meetings}
                projectId={data.project.id}
                onChanged={reload}
              />
              <MilestoneChecklist
                milestones={data.milestones}
                onSetStatus={setStatus}
                pendingId={pendingId}
              />
              <FileList
                projectId={data.project.id}
                files={data.files}
                milestones={data.milestones}
              />
              <InvoiceList invoices={data.invoices} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/* --------------------------------- sidebar --------------------------------- */

function Sidebar({
  project,
  user,
  milestones,
}: {
  project: Project;
  user: PortalUser;
  milestones: Milestone[];
}) {
  const approved = milestones.filter((m) => m.status === "approved").length;

  return (
    <aside className="lg:sticky lg:top-24 lg:h-fit">
      <div className="rounded-2xl border border-border/60 bg-background/60 p-5 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-brand-secondary to-accent-cyan text-white shadow-sm">
            <Briefcase className="size-4" />
          </span>
          <Badge variant="secondary" className="rounded-full text-xs font-medium">
            Active project
          </Badge>
        </div>

        <h2 className="mt-4 font-heading text-lg leading-snug font-semibold">
          {project.name}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{project.service}</p>

        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Progress
            </span>
            <span className="font-heading text-sm font-bold tabular-nums">
              {project.progress}%
            </span>
          </div>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuenow={project.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Project progress"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-secondary to-accent-cyan transition-[width] duration-500"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>

        <Separator className="my-5" />

        <dl className="space-y-3 text-sm">
          <MetaRow icon={CircleDot} label="Stage" value={titleCase(project.stage)} />
          <MetaRow icon={Wallet} label="Budget" value={fmtMoney(project.budget)} />
          <MetaRow icon={Calendar} label="Started" value={fmtDate(project.startDate)} />
          <MetaRow icon={Calendar} label="Target" value={fmtDate(project.targetDate)} />
          <MetaRow
            icon={ListChecks}
            label="Milestones"
            value={`${approved} of ${milestones.length} approved`}
          />
        </dl>

        <Separator className="my-5" />

        <div>
          <p className="text-xs font-medium text-muted-foreground">Signed in as</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{user.name}</p>
          <p className="text-sm text-muted-foreground">
            {user.company ?? user.email}
          </p>
        </div>
      </div>
    </aside>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

/* ------------------------------ stage progress ----------------------------- */

function StageProgress({ project }: { project: Project }) {
  const currentIndex = PROJECT_STAGES.indexOf(project.stage);

  return (
    <Panel
      title="Delivery stage"
      description={`Stage ${currentIndex + 1} of ${PROJECT_STAGES.length} — ${titleCase(project.stage)}`}
    >
      <ol className="flex items-start gap-1 overflow-x-auto pb-1 sm:gap-2">
        {PROJECT_STAGES.map((stage, i) => {
          const done = i < currentIndex;
          const current = i === currentIndex;
          return (
            <li key={stage} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <span
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    i === 0
                      ? "bg-transparent"
                      : done || current
                        ? "bg-gradient-to-r from-brand-secondary to-accent-cyan"
                        : "bg-secondary"
                  )}
                />
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors",
                    done &&
                      "bg-gradient-to-br from-brand-secondary to-accent-cyan text-white",
                    current &&
                      "bg-gradient-to-br from-brand-secondary to-accent-cyan text-white ring-4 ring-brand-secondary/20",
                    !done && !current && "bg-secondary text-muted-foreground"
                  )}
                  aria-current={current ? "step" : undefined}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    i === PROJECT_STAGES.length - 1
                      ? "bg-transparent"
                      : done
                        ? "bg-gradient-to-r from-brand-secondary to-accent-cyan"
                        : "bg-secondary"
                  )}
                />
              </div>
              <span
                className={cn(
                  "mt-2 truncate text-center text-[11px] font-medium sm:text-xs",
                  current
                    ? "text-foreground"
                    : done
                      ? "text-muted-foreground"
                      : "text-muted-foreground/70"
                )}
              >
                {titleCase(stage)}
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/* --------------------------- milestone checklist --------------------------- */

function MilestoneChecklist({
  milestones,
  onSetStatus,
  pendingId,
}: {
  milestones: Milestone[];
  onSetStatus: (id: string, status: MilestoneStatus) => void;
  pendingId: string | null;
}) {
  const ordered = [...milestones].sort((a, b) => a.order - b.order);

  return (
    <Panel
      title="Milestones"
      description="Review deliverables and approve them, or send them back for changes."
      icon={ListChecks}
    >
      {ordered.length === 0 ? (
        <EmptyState
          title="No milestones yet"
          description="Milestones will appear here as we plan the work."
        />
      ) : (
        <ul className="space-y-3">
          {ordered.map((m) => {
            const meta = MILESTONE_STATUS[m.status];
            const Icon = meta.icon;
            const needsAction = m.status === "awaiting_approval";
            const busy = pendingId === m.id;

            return (
              <li
                key={m.id}
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  needsAction
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-border/60 bg-background/40",
                  busy && "opacity-60"
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <Icon
                      className={cn(
                        "mt-0.5 size-5 shrink-0",
                        m.status === "approved" && "text-success",
                        m.status === "awaiting_approval" &&
                          "text-amber-600 dark:text-amber-400",
                        m.status === "changes_requested" && "text-destructive",
                        m.status === "in_progress" &&
                          "text-brand-secondary dark:text-blue-400",
                        m.status === "pending" && "text-muted-foreground"
                      )}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground tabular-nums">
                          {String(m.order).padStart(2, "0")}
                        </span>
                        <h3 className="font-heading text-base font-semibold">
                          {m.title}
                        </h3>
                        <Badge
                          className={cn(
                            "rounded-full border-0 text-xs font-medium",
                            meta.className
                          )}
                        >
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-pretty text-muted-foreground">
                        {m.description}
                      </p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="size-3.5" />
                        Due {fmtDate(m.dueDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2 sm:pl-4">
                    {needsAction ? (
                      <>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => onSetStatus(m.id, "approved")}
                        >
                          <Check />
                          {busy ? "Saving…" : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => onSetStatus(m.id, "changes_requested")}
                        >
                          Request changes
                        </Button>
                      </>
                    ) : m.status === "approved" ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-success">
                        <CheckCircle2 className="size-4" />
                        Approved
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* --------------------------------- files ---------------------------------- */

function FileList({
  projectId,
  files,
  milestones,
}: {
  projectId: string;
  files: ProjectFile[];
  milestones: Milestone[];
}) {
  const milestoneTitle = (id: string | null) =>
    id ? (milestones.find((m) => m.id === id)?.title ?? "—") : "General";

  return (
    <Panel
      title="Files"
      description="Deliverables and assets shared on this project."
      icon={Paperclip}
    >
      {files.length === 0 ? (
        <EmptyState title="No files yet" />
      ) : (
        <ul className="divide-y divide-border/60">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {f.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {milestoneTitle(f.milestoneId)}
                  </p>
                </div>
              </div>
              {/* Streams the object back out of R2 */}
              <a
                href={`/api/projects/${projectId}/files/${f.id}`}
                aria-label={`Download ${f.name}`}
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground outline-none transition-colors hover:border-brand-secondary/40 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Download className="size-4" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* -------------------------------- invoices -------------------------------- */

function InvoiceList({ invoices }: { invoices: Invoice[] }) {
  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <Panel
      title="Invoices"
      description={
        invoices.length === 0
          ? undefined
          : outstanding > 0
            ? `${fmtMoney(outstanding)} outstanding across open invoices.`
            : "All invoices are settled."
      }
      icon={Receipt}
    >
      {invoices.length === 0 ? (
        <EmptyState title="No invoices yet" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Due date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {inv.number}
                  </TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap">
                    {fmtMoney(inv.amount, inv.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "rounded-full border-0 text-xs font-medium",
                        INVOICE_STATUS[inv.status]
                      )}
                    >
                      {titleCase(inv.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                    {fmtDate(inv.dueDate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}

/* -------------------------------- meetings --------------------------------- */

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Now + 1 day at the next half hour, as a datetime-local value. */
function defaultPreferred() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() > 30 ? 60 : 30, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MeetingList({
  meetings,
  projectId,
  onChanged,
}: {
  meetings: Meeting[];
  projectId: string | null;
  onChanged: () => void;
}) {
  const now = Date.now();

  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [preferredAt, setPreferredAt] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [ackId, setAckId] = React.useState<string | null>(null);

  const pending = meetings.filter((m) => m.status === "requested");
  const upcoming = meetings
    .filter(
      (m) => m.status === "scheduled" && new Date(m.scheduledAt).getTime() >= now
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
  const past = meetings
    .filter((m) => !pending.includes(m) && !upcoming.includes(m))
    .sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    )
    .slice(0, 3);

  // Confirmed but not yet acknowledged → the in-portal notification.
  const justConfirmed = meetings.filter(
    (m) => m.confirmedAt && !m.clientSeenAt && m.status === "scheduled"
  );

  const ordered = [...pending, ...upcoming, ...past];

  function openRequest() {
    setTitle("");
    setPreferredAt(defaultPreferred());
    setFormError(null);
    setOpen(true);
  }

  async function submit() {
    if (!title.trim()) return setFormError("What's the call about?");
    if (!preferredAt) return setFormError("Pick a preferred time.");

    setSaving(true);
    setFormError(null);
    try {
      await fetchJson("/api/meetings/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          preferredAt,
          projectId,
        }),
      });
      setOpen(false);
      onChanged();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Could not send the request."
      );
    } finally {
      setSaving(false);
    }
  }

  async function acknowledge(id: string) {
    setAckId(id);
    try {
      await fetchJson(`/api/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge" }),
      });
      onChanged();
    } catch {
      // Dismissing a notice is cosmetic — never block the portal on it.
    } finally {
      setAckId(null);
    }
  }

  return (
    <>
      {/* Confirmation notice — shows once, until dismissed. */}
      {justConfirmed.map((m) => (
        <div
          key={m.id}
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-success/30 bg-success/10 p-4 text-sm"
        >
          <CheckCircle2 className="size-5 shrink-0 text-success" />
          <p className="min-w-0 flex-1 text-foreground">
            <span className="font-medium">{m.title}</span> is confirmed for{" "}
            <span className="tabular-nums">{fmtWhen(m.scheduledAt)}</span>. Your
            Google Meet link is ready.
          </p>
          {m.meetingUrl && (
            <Button
              render={
                <a href={m.meetingUrl} target="_blank" rel="noopener noreferrer" />
              }
              // It's a real link out to Meet, not a button.
              nativeButton={false}
              size="sm"
              className="gap-2"
            >
              <Video className="size-4" />
              Join
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => acknowledge(m.id)}
            disabled={ackId === m.id}
          >
            {ackId === m.id ? "…" : "Got it"}
          </Button>
        </div>
      ))}

      <Panel
        title="Meetings"
        description={
          upcoming.length
            ? `${upcoming.length} upcoming`
            : pending.length
              ? "Waiting on us to confirm."
              : "Nothing scheduled right now."
        }
        icon={CalendarDays}
      >
        <div className="mb-4">
          <Button onClick={openRequest} size="sm" className="gap-2">
            <Video className="size-4" />
            Book a Google Meet
          </Button>
        </div>

        {ordered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No meetings yet. Request a call and we&apos;ll confirm a time.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {ordered.map((m) => {
              const isUpcoming = upcoming.includes(m);
              const isPending = m.status === "requested";
              return (
                <li
                  key={m.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-xl border p-4",
                    isPending
                      ? "border-amber-500/30 bg-amber-500/5"
                      : isUpcoming
                        ? "border-border/60 bg-background/60"
                        : "border-border/60 bg-muted/30"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{m.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {isPending ? "Requested for " : ""}
                      {fmtWhen(m.scheduledAt)}
                    </p>
                  </div>

                  {isPending ? (
                    <Badge className="rounded-full border-0 bg-amber-500/10 text-xs font-medium whitespace-nowrap text-amber-700 dark:text-amber-400">
                      Awaiting confirmation
                    </Badge>
                  ) : (
                    m.status !== "scheduled" && (
                      <Badge
                        variant="secondary"
                        className="rounded-full text-xs whitespace-nowrap"
                      >
                        {titleCase(m.status)}
                      </Badge>
                    )
                  )}

                  {/* Only offer "Join" for a confirmed meeting still ahead. */}
                  {isUpcoming && m.meetingUrl && (
                    <Button
                      render={
                        <a
                          href={m.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                      // It's a real link out to Meet, not a button.
                      nativeButton={false}
                      size="sm"
                      className="gap-2"
                    >
                      <Video className="size-4" />
                      Join
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* Request a call */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Book a Google Meet</DialogTitle>
            <DialogDescription>
              Tell us what you&apos;d like to talk about and when suits you.
              We&apos;ll confirm a time and send the Meet link here.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {formError}
            </p>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="req-title">What&apos;s it about?</Label>
              <Input
                id="req-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Design review"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-when">Preferred date &amp; time</Label>
              <Input
                id="req-when"
                type="datetime-local"
                value={preferredAt}
                onChange={(e) => setPreferredAt(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={saving} />}>
              Cancel
            </DialogClose>
            <Button onClick={submit} disabled={saving} className="gap-2">
              {saving && <RotateCcw className="size-4 animate-spin" />}
              {saving ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* --------------------------------- shell ---------------------------------- */

function Panel({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-background/60 p-5 shadow-sm backdrop-blur sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        {Icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-secondary/10 to-accent-cyan/10 text-brand-secondary ring-1 ring-brand-secondary/15 dark:text-blue-400">
            <Icon className="size-4" />
          </span>
        )}
        <div>
          <h2 className="font-heading text-lg font-semibold">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}
