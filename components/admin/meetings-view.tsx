"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  Clock,
  Loader2,
  Plus,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fetchJson, useLoader } from "@/lib/use-api";
import { titleCase } from "@/lib/format";
import type {
  ClientAccount,
  Meeting,
  MeetingProvider,
  MeetingStatus,
  Project,
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
import { AdminPage } from "@/components/admin/admin-page";
import {
  DataTable,
  type Column,
  type RowAction,
} from "@/components/admin/data-table";

const STATUS_CLASS: Record<MeetingStatus, string> = {
  requested: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  scheduled: "bg-brand-secondary/10 text-brand-secondary dark:text-blue-400",
  completed: "bg-success/10 text-success",
  cancelled: "bg-muted text-muted-foreground",
};

const PROVIDER: Record<MeetingProvider, { label: string; className: string }> = {
  calcom: {
    label: "Cal.com",
    className: "bg-secondary text-muted-foreground",
  },
  google_meet: {
    label: "Google Meet",
    className: "bg-accent-cyan/10 text-cyan-700 dark:text-cyan-400",
  },
};

const DURATIONS = [15, 30, 45, 60, 90, 120];

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Now + 1 hour, rounded to the next half hour, as a datetime-local value. */
function defaultStart() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() > 30 ? 60 : 30, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type MeetingsData = {
  meetings: Meeting[];
  clients: ClientAccount[];
  projects: Project[];
};

async function loadMeetings(): Promise<MeetingsData> {
  const [m, c, p] = await Promise.all([
    fetchJson<{ meetings: Meeting[] }>("/api/meetings"),
    fetchJson<{ clients: ClientAccount[] }>("/api/clients"),
    fetchJson<{ projects: Project[] }>("/api/projects"),
  ]);
  return { meetings: m.meetings, clients: c.clients, projects: p.projects };
}

type Draft = {
  clientId: string;
  projectId: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  description: string;
};

const EMPTY: Draft = {
  clientId: "",
  projectId: "none",
  title: "",
  startsAt: "",
  durationMinutes: 30,
  description: "",
};

export function MeetingsView() {
  const { data, error, loading, reload } = useLoader<MeetingsData>(loadMeetings);
  const meetings = data?.meetings ?? [];
  const clients = React.useMemo(() => data?.clients ?? [], [data]);
  const projects = React.useMemo(() => data?.projects ?? [], [data]);

  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  /** Set when the failure is "you haven't connected Google Calendar". */
  const [needsConnect, setNeedsConnect] = React.useState(false);

  /* --- confirming a client's request --- */
  const [confirming, setConfirming] = React.useState<Meeting | null>(null);
  const [confirmDraft, setConfirmDraft] = React.useState({
    startsAt: "",
    durationMinutes: 30,
  });
  const [rowBusy, setRowBusy] = React.useState<string | null>(null);
  const [rowError, setRowError] = React.useState<string | null>(null);
  const [rowNeedsConnect, setRowNeedsConnect] = React.useState(false);

  const requested = meetings.filter((m) => m.status === "requested");

  /** Prefill with the slot the client asked for — the admin can move it. */
  function openConfirm(m: Meeting) {
    const d = new Date(m.scheduledAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    setConfirmDraft({
      startsAt: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      durationMinutes: 30,
    });
    setRowError(null);
    setRowNeedsConnect(false);
    setConfirming(m);
  }

  async function confirm() {
    if (!confirming) return;
    setRowBusy(confirming.id);
    setRowError(null);
    setRowNeedsConnect(false);
    try {
      await fetchJson(`/api/meetings/${confirming.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          startsAt: confirmDraft.startsAt,
          durationMinutes: confirmDraft.durationMinutes,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      setConfirming(null);
      reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not confirm.";
      setRowError(message);
      setRowNeedsConnect(/connect/i.test(message));
    } finally {
      setRowBusy(null);
    }
  }

  async function decline(m: Meeting) {
    setRowBusy(m.id);
    setRowError(null);
    try {
      await fetchJson(`/api/meetings/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });
      reload();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Could not decline.");
    } finally {
      setRowBusy(null);
    }
  }

  const patch = (part: Partial<Draft>) => setDraft((d) => ({ ...d, ...part }));

  const clientName = (id: string | null) =>
    clients.find((c) => c.id === id)?.name ?? null;

  // Only the chosen client's projects — attaching someone else's is rejected
  // by the API anyway, so don't offer it.
  const clientProjects = projects.filter((p) => p.clientId === draft.clientId);

  /*
   * Base UI's <SelectValue> renders the raw *value* unless the root is given an
   * `items` map. Without these the trigger shows a bare UUID instead of a name.
   */
  const clientItems = clients.map((c) => ({
    value: c.id,
    label: `${c.name} — ${c.email}`,
  }));
  const projectItems = [
    { value: "none", label: "No project" },
    ...clientProjects.map((p) => ({ value: p.id, label: p.name })),
  ];
  const durationItems = DURATIONS.map((d) => ({
    value: String(d),
    label: `${d} minutes`,
  }));

  function openCreate() {
    setDraft({ ...EMPTY, startsAt: defaultStart() });
    setFormError(null);
    setNeedsConnect(false);
    setOpen(true);
  }

  async function schedule() {
    if (!draft.clientId) return setFormError("Pick a client.");
    if (!draft.title.trim()) return setFormError("Title is required.");
    if (!draft.startsAt) return setFormError("Pick a date and time.");

    setSaving(true);
    setFormError(null);
    setNeedsConnect(false);
    try {
      await fetchJson("/api/meetings/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: draft.clientId,
          projectId: draft.projectId === "none" ? null : draft.projectId,
          title: draft.title.trim(),
          startsAt: draft.startsAt,
          durationMinutes: draft.durationMinutes,
          // Send the admin's real zone so "3pm" means 3pm to them.
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          description: draft.description || undefined,
        }),
      });
      setOpen(false);
      reload();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not schedule.";
      setFormError(message);
      setNeedsConnect(/connect/i.test(message));
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<Meeting>[] = [
    {
      key: "attendee",
      header: "Attendee",
      cell: (m) => (
        <div>
          <span className="font-medium">{m.attendeeName}</span>
          <span className="block text-xs text-muted-foreground">
            {clientName(m.clientId) ? m.attendeeEmail : `${m.attendeeEmail} · lead`}
          </span>
        </div>
      ),
    },
    {
      key: "title",
      header: "Title",
      cell: (m) => <span className="text-muted-foreground">{m.title}</span>,
    },
    {
      key: "when",
      header: "When",
      cell: (m) => (
        <span className="text-muted-foreground tabular-nums">
          {fmtDateTime(m.scheduledAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (m) => (
        <Badge
          className={cn(
            "rounded-full border-0 text-xs font-medium whitespace-nowrap",
            STATUS_CLASS[m.status]
          )}
        >
          {titleCase(m.status)}
        </Badge>
      ),
    },
    {
      key: "provider",
      header: "Provider",
      cell: (m) => (
        <Badge
          className={cn(
            "rounded-full border-0 text-xs font-medium whitespace-nowrap",
            PROVIDER[m.provider].className
          )}
        >
          {PROVIDER[m.provider].label}
        </Badge>
      ),
    },
  ];

  /* Requested meetings get confirm/decline; confirmed ones get a join link. */
  const actions: RowAction<Meeting>[] = [
    {
      icon: Check,
      label: (m) =>
        m.status === "requested" ? `Confirm ${m.title}` : `Join ${m.title}`,
      onClick: (m) => {
        if (m.status === "requested") openConfirm(m);
        else if (m.meetingUrl) window.open(m.meetingUrl, "_blank", "noopener");
      },
    },
    {
      icon: X,
      label: (m) => `Decline ${m.title}`,
      onClick: decline,
      destructive: true,
      confirm: {
        title: "Decline this request?",
        description: "The client will see it as cancelled —",
        confirmLabel: "Decline",
      },
    },
  ];

  return (
    <AdminPage
      eyebrow="Clients"
      title="Meetings"
      description="Bookings from Cal.com, plus Google Meets you schedule here."
      action={
        <Button onClick={openCreate} disabled={loading || !!error} className="gap-2">
          <Plus className="size-4" />
          Schedule Google Meet
        </Button>
      }
    >
      {requested.length > 0 && (
        <p className="mb-6 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          <Clock className="size-4 shrink-0" />
          {requested.length} client{" "}
          {requested.length === 1 ? "request is" : "requests are"} waiting to be
          confirmed.
        </p>
      )}

      {rowError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {rowError}
          {rowNeedsConnect && (
            <Link
              href="/admin/settings/calendar"
              className="mt-1 block font-medium underline underline-offset-4"
            >
              Go to Settings → Calendar
            </Link>
          )}
        </div>
      )}

      <DataTable<Meeting>
        rows={meetings}
        columns={columns}
        actions={actions}
        getRowId={(m) => m.id}
        busyIds={rowBusy ? [rowBusy] : []}
        loading={loading}
        error={error}
        onRetry={reload}
        noun={{ one: "meeting", many: "meetings" }}
        empty={{
          icon: CalendarDays,
          title: "No meetings yet",
          description:
            "Cal.com bookings land here automatically, or schedule a Google Meet yourself.",
          action: { label: "Schedule Google Meet", onClick: openCreate },
        }}
      />

      {/* Schedule a Google Meet */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule a Google Meet</DialogTitle>
            <DialogDescription>
              Creates the event on your Google Calendar with a Meet link, invites
              the client, and shows it in their portal.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {formError}
              {needsConnect && (
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
            <div className="space-y-2">
              <Label htmlFor="mt-client">Client</Label>
              {clients.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  No clients yet — a meeting needs one.
                </p>
              ) : (
                <Select
                  items={clientItems}
                  value={draft.clientId}
                  onValueChange={(v) =>
                    // Reset the project: the old one belongs to another client.
                    patch({ clientId: v as string, projectId: "none" })
                  }
                >
                  <SelectTrigger id="mt-client" className="w-full">
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

            <div className="space-y-2">
              <Label htmlFor="mt-project">Project (optional)</Label>
              <Select
                items={projectItems}
                value={draft.projectId}
                onValueChange={(v) => patch({ projectId: v as string })}
              >
                <SelectTrigger id="mt-project" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {clientProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mt-title">Title</Label>
              <Input
                id="mt-title"
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="Design review"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mt-start">Date &amp; time</Label>
                <Input
                  id="mt-start"
                  type="datetime-local"
                  value={draft.startsAt}
                  onChange={(e) => patch({ startsAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mt-duration">Duration</Label>
                <Select
                  items={durationItems}
                  value={String(draft.durationMinutes)}
                  onValueChange={(v) =>
                    patch({ durationMinutes: Number(v as string) })
                  }
                >
                  <SelectTrigger id="mt-duration" className="w-full">
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

            <div className="space-y-2">
              <Label htmlFor="mt-desc">Agenda (optional)</Label>
              <Textarea
                id="mt-desc"
                rows={3}
                value={draft.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={saving} />}>
              Cancel
            </DialogClose>
            <Button
              onClick={schedule}
              disabled={saving || clients.length === 0}
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CalendarDays className="size-4" />
              )}
              {saving ? "Scheduling…" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm a client's request → mints the Google Meet */}
      <Dialog
        open={!!confirming}
        onOpenChange={(o) => !o && setConfirming(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm this request</DialogTitle>
            <DialogDescription>
              {confirming && (
                <>
                  <span className="font-medium text-foreground">
                    {confirming.attendeeName}
                  </span>{" "}
                  asked for “{confirming.title}”. Confirming creates the Google
                  Meet, invites them, and notifies them in their portal.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cf-start">Date &amp; time</Label>
              <Input
                id="cf-start"
                type="datetime-local"
                value={confirmDraft.startsAt}
                onChange={(e) =>
                  setConfirmDraft((d) => ({ ...d, startsAt: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Prefilled with the slot they asked for — change it if that
                doesn&apos;t work.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cf-duration">Duration</Label>
              <Select
                items={durationItems}
                value={String(confirmDraft.durationMinutes)}
                onValueChange={(v) =>
                  setConfirmDraft((d) => ({
                    ...d,
                    durationMinutes: Number(v as string),
                  }))
                }
              >
                <SelectTrigger id="cf-duration" className="w-full">
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

          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={!!rowBusy} />}
            >
              Cancel
            </DialogClose>
            <Button onClick={confirm} disabled={!!rowBusy} className="gap-2">
              {rowBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {rowBusy ? "Creating Meet…" : "Confirm & create Meet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
