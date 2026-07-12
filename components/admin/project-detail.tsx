"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Download,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { fetchJson, useLoader } from "@/lib/use-api";
import { dateInputValue, fmtDate, fmtMoney, titleCase, today } from "@/lib/format";
import {
  PROJECT_STAGES,
  type Invoice,
  type Milestone,
  type MilestoneStatus,
  type Project,
  type ProjectFile,
  type ProjectStage,
} from "@/lib/data-model";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, PanelSkeleton } from "@/components/ui/states";
import {
  Field,
  FormDialog,
  FORM_ERROR,
  type FieldErrors,
} from "@/components/admin/form-dialog";

const MILESTONE_STATUSES: MilestoneStatus[] = [
  "pending",
  "in_progress",
  "awaiting_approval",
  "approved",
  "changes_requested",
];

const MILESTONE_STATUS_CLASS: Record<MilestoneStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress:
    "bg-brand-secondary/10 text-brand-secondary dark:text-blue-400",
  awaiting_approval: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved: "bg-success/10 text-success",
  changes_requested: "bg-destructive/10 text-destructive",
};

const INVOICE_STATUSES: Invoice["status"][] = [
  "draft",
  "sent",
  "paid",
  "overdue",
];

const INVOICE_STATUS_CLASS: Record<Invoice["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-brand-secondary/10 text-brand-secondary dark:text-blue-400",
  paid: "bg-success/10 text-success",
  overdue: "bg-destructive/10 text-destructive",
};

const MAX_BYTES = 25 * 1024 * 1024;

/*
 * Base UI's <SelectValue> shows the raw *value* unless the root gets an `items`
 * map — otherwise the trigger reads "develop" / "in_progress" / a bare UUID.
 */
const STAGE_ITEMS = PROJECT_STAGES.map((s, i) => ({
  value: s,
  label: `${i + 1}. ${titleCase(s)}`,
}));
const MILESTONE_STATUS_ITEMS = MILESTONE_STATUSES.map((s) => ({
  value: s,
  label: titleCase(s),
}));
const INVOICE_STATUS_ITEMS = INVOICE_STATUSES.map((s) => ({
  value: s,
  label: titleCase(s),
}));

type DetailData = {
  milestones: Milestone[];
  files: ProjectFile[];
  invoices: Invoice[];
};

/* -------------------------------------------------------------------------- */

export function ProjectDetail({
  project,
  clientName,
  onClose,
  onProjectChange,
}: {
  project: Project | null;
  clientName: string;
  onClose: () => void;
  /** Bubble project edits up so the table re-reads them. */
  onProjectChange: () => void;
}) {
  return (
    <Sheet open={!!project} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl"
      >
        {project && (
          <DetailBody
            // Remount when the admin switches project, so no state leaks across.
            key={project.id}
            project={project}
            clientName={clientName}
            onProjectChange={onProjectChange}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailBody({
  project,
  clientName,
  onProjectChange,
}: {
  project: Project;
  clientName: string;
  onProjectChange: () => void;
}) {
  const load = React.useCallback(async (): Promise<DetailData> => {
    const [m, f, i] = await Promise.all([
      fetchJson<{ milestones: Milestone[] }>(
        `/api/projects/${project.id}/milestones`
      ),
      fetchJson<{ files: ProjectFile[] }>(`/api/projects/${project.id}/files`),
      fetchJson<{ invoices: Invoice[] }>(
        `/api/invoices?projectId=${project.id}`
      ),
    ]);
    return { milestones: m.milestones, files: f.files, invoices: i.invoices };
  }, [project.id]);

  const { data, error, loading, reload } = useLoader<DetailData>(load);

  const milestones = data?.milestones ?? [];
  const files = data?.files ?? [];
  const invoices = data?.invoices ?? [];

  return (
    <>
      <SheetHeader className="border-b border-border/60 p-6 text-left">
        <SheetTitle className="font-heading text-lg">{project.name}</SheetTitle>
        <SheetDescription>
          {clientName} · {project.service} · Due {fmtDate(project.targetDate)}
        </SheetDescription>
      </SheetHeader>

      <Tabs defaultValue="overview" className="p-6">
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="flex-1">
            Overview
          </TabsTrigger>
          <TabsTrigger value="milestones" className="flex-1">
            Milestones
          </TabsTrigger>
          <TabsTrigger value="files" className="flex-1">
            Files
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex-1">
            Invoices
          </TabsTrigger>
        </TabsList>

        {/*
          Only skeleton the very first load. `useLoader` keeps `data` across a
          reload, so gating on `loading` alone would tear the whole tab UI down
          and flash a skeleton after every add/edit/delete.
        */}
        {loading && !data ? (
          <PanelSkeleton rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} className="mt-6" />
        ) : (
          <>
            <TabsContent value="overview" className="mt-6">
              <OverviewPanel
                project={project}
                onSaved={onProjectChange}
                milestones={milestones}
              />
            </TabsContent>

            <TabsContent value="milestones" className="mt-6">
              <MilestonesPanel
                projectId={project.id}
                milestones={milestones}
                onChanged={reload}
              />
            </TabsContent>

            <TabsContent value="files" className="mt-6">
              <FilesPanel
                projectId={project.id}
                files={files}
                milestones={milestones}
                onChanged={reload}
              />
            </TabsContent>

            <TabsContent value="invoices" className="mt-6">
              <InvoicesPanel
                projectId={project.id}
                invoices={invoices}
                onChanged={reload}
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </>
  );
}

/* -------------------------------- overview -------------------------------- */

function OverviewPanel({
  project,
  milestones,
  onSaved,
}: {
  project: Project;
  milestones: Milestone[];
  onSaved: () => void;
}) {
  const [stage, setStage] = React.useState<ProjectStage>(project.stage);
  const [progress, setProgress] = React.useState(project.progress);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const dirty = stage !== project.stage || progress !== project.progress;

  const approved = milestones.filter((m) => m.status === "approved").length;
  const suggested = milestones.length
    ? Math.round((approved / milestones.length) * 100)
    : null;

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await fetchJson(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, progress }),
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="stage">Stage</Label>
        <Select
          items={STAGE_ITEMS}
          value={stage}
          onValueChange={(v) => {
            setStage(v as ProjectStage);
            setSaved(false);
          }}
        >
          <SelectTrigger id="stage" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROJECT_STAGES.map((s, i) => (
              <SelectItem key={s} value={s}>
                {i + 1}. {titleCase(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="progress">Progress</Label>
          <span className="text-sm font-medium tabular-nums">{progress}%</span>
        </div>
        <input
          id="progress"
          type="range"
          min={0}
          max={100}
          step={1}
          value={progress}
          onChange={(e) => {
            setProgress(Number(e.target.value));
            setSaved(false);
          }}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-brand-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-secondary to-accent-cyan transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {suggested !== null && suggested !== progress && (
          <button
            type="button"
            onClick={() => {
              setProgress(suggested);
              setSaved(false);
            }}
            className="text-xs text-brand-secondary underline-offset-4 hover:underline dark:text-blue-400"
          >
            {approved} of {milestones.length} milestones approved — set to{" "}
            {suggested}%
          </button>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border/60 p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Budget</dt>
          <dd className="mt-0.5 font-medium tabular-nums">
            {fmtMoney(project.budget)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Started</dt>
          <dd className="mt-0.5 font-medium tabular-nums">
            {fmtDate(project.startDate)}
          </dd>
        </div>
      </dl>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={!dirty || saving} className="gap-2">
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {saved && !dirty && (
          <span className="text-sm text-success">Saved.</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- milestones -------------------------------- */

type MilestoneDraft = {
  title: string;
  description: string;
  status: MilestoneStatus;
  dueDate: string;
};

function MilestonesPanel({
  projectId,
  milestones,
  onChanged,
}: {
  projectId: string;
  milestones: Milestone[];
  onChanged: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Milestone | null>(null);
  const [draft, setDraft] = React.useState<MilestoneDraft>({
    title: "",
    description: "",
    status: "pending",
    dueDate: today(),
  });
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [busy, setBusy] = React.useState(false);
  const [rowError, setRowError] = React.useState<string | null>(null);

  const base = `/api/projects/${projectId}/milestones`;

  /** Fixing a field clears its error. */
  const patchDraft = (part: Partial<MilestoneDraft>) => {
    setDraft((d) => ({ ...d, ...part }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(part)) delete next[k];
      return next;
    });
  };

  function openCreate() {
    setEditing(null);
    setDraft({
      title: "",
      description: "",
      status: "pending",
      dueDate: today(),
    });
    setErrors({});
    setOpen(true);
  }

  function openEdit(m: Milestone) {
    setEditing(m);
    setDraft({
      title: m.title,
      description: m.description,
      status: m.status,
      dueDate: dateInputValue(m.dueDate),
    });
    setErrors({});
    setOpen(true);
  }

  async function save() {
    const found: FieldErrors = {};
    if (!draft.title.trim()) found.title = "Give the milestone a title.";
    if (!draft.dueDate) found.dueDate = "Pick a due date.";
    if (Object.keys(found).length) return setErrors(found);

    setSaving(true);
    setErrors({});
    try {
      await fetchJson(editing ? `${base}/${editing.id}` : base, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title.trim(),
          description: draft.description,
          status: draft.status,
          dueDate: draft.dueDate,
          // New milestones land at the end of the checklist.
          ...(editing ? {} : { order: milestones.length }),
        }),
      });
      setOpen(false);
      toast.success(
        editing ? `${draft.title.trim()} updated` : `${draft.title.trim()} added`
      );
      onChanged();
    } catch (err) {
      setErrors({
        [FORM_ERROR]: err instanceof Error ? err.message : "Could not save.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(m: Milestone) {
    setBusy(true);
    setRowError(null);
    try {
      await fetchJson(`${base}/${m.id}`, { method: "DELETE" });
      toast.success(`${m.title} deleted`);
      onChanged();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Reorder by swapping the two rows' `order` values. The list is already
   * sorted by `order`, but stored values can be duplicated (the API defaults
   * them to 0), so write positions rather than trusting what's there.
   */
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= milestones.length) return;

    const next = [...milestones];
    [next[index], next[target]] = [next[target], next[index]];

    setBusy(true);
    setRowError(null);
    try {
      await Promise.all(
        next.map((m, i) =>
          m.order === i
            ? null
            : fetchJson(`${base}/${m.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ order: i }),
              })
        )
      );
      onChanged();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Could not reorder.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {milestones.length}{" "}
          {milestones.length === 1 ? "milestone" : "milestones"}
        </p>
        <Button size="sm" onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          Add milestone
        </Button>
      </div>

      {rowError && <ErrorState message={rowError} />}

      {milestones.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No milestones yet. The client&apos;s portal checklist is built from
          these.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {milestones.map((m, i) => (
            <li
              key={m.id}
              className="rounded-xl border border-border/60 bg-background/60 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-0.5">
                  <IconBtn
                    label={`Move ${m.title} up`}
                    disabled={i === 0 || busy}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </IconBtn>
                  <IconBtn
                    label={`Move ${m.title} down`}
                    disabled={i === milestones.length - 1 || busy}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </IconBtn>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{m.title}</span>
                    <Badge
                      className={cn(
                        "rounded-full border-0 text-xs font-medium whitespace-nowrap",
                        MILESTONE_STATUS_CLASS[m.status]
                      )}
                    >
                      {titleCase(m.status)}
                    </Badge>
                  </div>
                  {m.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {m.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    Due {fmtDate(m.dueDate)}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <IconBtn
                    label={`Edit ${m.title}`}
                    disabled={busy}
                    onClick={() => openEdit(m)}
                  >
                    <Pencil className="size-3.5" />
                  </IconBtn>
                  <IconBtn
                    label={`Delete ${m.title}`}
                    disabled={busy}
                    destructive
                    onClick={() => remove(m)}
                  >
                    <Trash2 className="size-3.5" />
                  </IconBtn>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit milestone" : "Add milestone"}
        description="Milestones drive the client's approval checklist in the portal."
        error={errors[FORM_ERROR]}
        saving={saving}
        onSubmit={save}
        submitLabel={editing ? "Save changes" : "Add milestone"}
      >
        <Field id="ms-title" label="Title" error={errors.title} required>
          {(f) => (
            <Input
              {...f}
              value={draft.title}
              onChange={(e) => patchDraft({ title: e.target.value })}
              placeholder="Design system sign-off"
            />
          )}
        </Field>

        <Field
          id="ms-desc"
          label="Description"
          hint="What the client is approving."
          error={errors.description}
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              value={draft.description}
              onChange={(e) => patchDraft({ description: e.target.value })}
            />
          )}
        </Field>

        <Field id="ms-status" label="Status" error={errors.status}>
          {(f) => (
            <Select
              items={MILESTONE_STATUS_ITEMS}
              value={draft.status}
              onValueChange={(v) =>
                patchDraft({ status: v as MilestoneStatus })
              }
            >
              <SelectTrigger
                id={f.id}
                aria-invalid={f["aria-invalid"]}
                aria-describedby={f["aria-describedby"]}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MILESTONE_STATUSES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {titleCase(st)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>

        <Field id="ms-due" label="Due date" error={errors.dueDate} required>
          {(f) => (
            <Input
              {...f}
              type="date"
              value={draft.dueDate}
              onChange={(e) => patchDraft({ dueDate: e.target.value })}
            />
          )}
        </Field>
      </FormDialog>
    </div>
  );
}

/* ---------------------------------- files ---------------------------------- */

function FilesPanel({
  projectId,
  files,
  milestones,
  onChanged,
}: {
  projectId: string;
  files: ProjectFile[];
  milestones: Milestone[];
  onChanged: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [milestoneId, setMilestoneId] = React.useState<string>("none");
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const milestoneTitle = (id: string | null) =>
    id ? (milestones.find((m) => m.id === id)?.title ?? "—") : null;

  const milestoneItems = [
    { value: "none", label: "No milestone" },
    ...milestones.map((m) => ({ value: m.id, label: m.title })),
  ];

  async function upload(file: File) {
    if (file.size === 0) return setError("That file is empty.");
    if (file.size > MAX_BYTES) {
      return setError("File exceeds the 25MB limit.");
    }

    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (milestoneId !== "none") form.append("milestoneId", milestoneId);

      // No Content-Type header — the browser must set the multipart boundary.
      await fetchJson(`/api/projects/${projectId}/files`, {
        method: "POST",
        body: form,
      });
      if (inputRef.current) inputRef.current.value = "";
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function remove(file: ProjectFile) {
    setBusy(true);
    setError(null);
    try {
      await fetchJson(`/api/projects/${projectId}/files/${file.id}`, {
        method: "DELETE",
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-background/60 p-4">
        <Label htmlFor="file-milestone">Attach to milestone</Label>
        <Select
          items={milestoneItems}
          value={milestoneId}
          onValueChange={(v) => setMilestoneId(v as string)}
        >
          <SelectTrigger id="file-milestone" className="mt-2 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No milestone</SelectItem>
            {milestones.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input
          ref={inputRef}
          id="file-input"
          type="file"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
        />
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="mt-3 w-full gap-2"
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {uploading ? "Uploading…" : "Choose a file"}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Up to 25MB. Uploads are visible to the client in their portal.
        </p>
      </div>

      {error && <ErrorState message={error} />}

      {files.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No files yet.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {files.map((file) => {
            const attached = milestoneTitle(file.milestoneId);
            return (
              <li
                key={file.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-4"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {attached ? `Milestone: ${attached}` : "No milestone"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <a
                    href={`/api/projects/${projectId}/files/${file.id}`}
                    aria-label={`Download ${file.name}`}
                    className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground outline-none transition-colors hover:border-brand-secondary/40 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Download className="size-3.5" />
                  </a>
                  <IconBtn
                    label={`Delete ${file.name}`}
                    disabled={busy}
                    destructive
                    onClick={() => remove(file)}
                  >
                    <Trash2 className="size-3.5" />
                  </IconBtn>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------- invoices --------------------------------- */

type InvoiceDraft = {
  number: string;
  amount: number;
  currency: string;
  status: Invoice["status"];
  dueDate: string;
};

function InvoicesPanel({
  projectId,
  invoices,
  onChanged,
}: {
  projectId: string;
  invoices: Invoice[];
  onChanged: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Invoice | null>(null);
  const [draft, setDraft] = React.useState<InvoiceDraft>({
    number: "",
    amount: 0,
    currency: "USD",
    status: "draft",
    dueDate: today(),
  });
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [busy, setBusy] = React.useState(false);
  const [rowError, setRowError] = React.useState<string | null>(null);

  /** Fixing a field clears its error. */
  const patchDraft = (part: Partial<InvoiceDraft>) => {
    setDraft((d) => ({ ...d, ...part }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(part)) delete next[k];
      return next;
    });
  };

  function openCreate() {
    setEditing(null);
    setDraft({
      number: "",
      amount: 0,
      currency: "USD",
      status: "draft",
      dueDate: today(),
    });
    setErrors({});
    setOpen(true);
  }

  function openEdit(inv: Invoice) {
    setEditing(inv);
    setDraft({
      number: inv.number,
      amount: inv.amount,
      currency: inv.currency,
      status: inv.status,
      dueDate: dateInputValue(inv.dueDate),
    });
    setErrors({});
    setOpen(true);
  }

  async function save() {
    const found: FieldErrors = {};
    if (!draft.number.trim()) found.number = "Invoice number is required.";
    if (draft.amount < 0) found.amount = "Amount can't be negative.";
    if (draft.currency.length !== 3) found.currency = "Use a 3-letter code.";
    if (!draft.dueDate) found.dueDate = "Pick a due date.";
    if (Object.keys(found).length) return setErrors(found);

    setSaving(true);
    setErrors({});
    try {
      await fetchJson(
        editing ? `/api/invoices/${editing.id}` : "/api/invoices",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(editing ? {} : { projectId }),
            number: draft.number.trim(),
            amount: draft.amount,
            currency: draft.currency,
            status: draft.status,
            dueDate: draft.dueDate,
          }),
        }
      );
      setOpen(false);
      toast.success(
        editing
          ? `Invoice ${draft.number.trim()} updated`
          : `Invoice ${draft.number.trim()} created`,
        { description: "The client sees it in their portal." }
      );
      onChanged();
    } catch (err) {
      setErrors({
        [FORM_ERROR]: err instanceof Error ? err.message : "Could not save.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(inv: Invoice) {
    setBusy(true);
    setRowError(null);
    try {
      await fetchJson(`/api/invoices/${inv.id}`, { method: "DELETE" });
      toast.success(`Invoice ${inv.number} deleted`);
      onChanged();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}
          {outstanding > 0 && ` · ${fmtMoney(outstanding)} outstanding`}
        </p>
        <Button size="sm" onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          New invoice
        </Button>
      </div>

      {rowError && <ErrorState message={rowError} />}

      {invoices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No invoices yet.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {invoices.map((inv) => (
            <li
              key={inv.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium tabular-nums">{inv.number}</p>
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  Due {fmtDate(inv.dueDate)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {fmtMoney(inv.amount, inv.currency)}
              </span>
              <Badge
                className={cn(
                  "shrink-0 rounded-full border-0 text-xs font-medium",
                  INVOICE_STATUS_CLASS[inv.status]
                )}
              >
                {titleCase(inv.status)}
              </Badge>
              <div className="flex shrink-0 gap-1">
                <IconBtn
                  label={`Edit invoice ${inv.number}`}
                  disabled={busy}
                  onClick={() => openEdit(inv)}
                >
                  <Pencil className="size-3.5" />
                </IconBtn>
                <IconBtn
                  label={`Delete invoice ${inv.number}`}
                  disabled={busy}
                  destructive
                  onClick={() => remove(inv)}
                >
                  <Trash2 className="size-3.5" />
                </IconBtn>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit invoice" : "New invoice"}
        description="The client sees this in their portal as soon as it exists."
        error={errors[FORM_ERROR]}
        saving={saving}
        onSubmit={save}
        submitLabel={editing ? "Save changes" : "Create invoice"}
      >
        <Field id="inv-number" label="Number" error={errors.number} required>
          {(f) => (
            <Input
              {...f}
              value={draft.number}
              onChange={(e) => patchDraft({ number: e.target.value })}
              placeholder="AXN-2026-001"
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field id="inv-amount" label="Amount" error={errors.amount} required>
            {(f) => (
              <Input
                {...f}
                type="number"
                min={0}
                value={draft.amount}
                onChange={(e) =>
                  patchDraft({ amount: Number(e.target.value) || 0 })
                }
              />
            )}
          </Field>

          <Field
            id="inv-currency"
            label="Currency"
            error={errors.currency}
            required
          >
            {(f) => (
              <Input
                {...f}
                maxLength={3}
                value={draft.currency}
                onChange={(e) =>
                  patchDraft({ currency: e.target.value.toUpperCase() })
                }
                placeholder="USD"
              />
            )}
          </Field>
        </div>

        <Field id="inv-status" label="Status" error={errors.status}>
          {(f) => (
            <Select
              items={INVOICE_STATUS_ITEMS}
              value={draft.status}
              onValueChange={(v) =>
                patchDraft({ status: v as Invoice["status"] })
              }
            >
              <SelectTrigger
                id={f.id}
                aria-invalid={f["aria-invalid"]}
                aria-describedby={f["aria-describedby"]}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVOICE_STATUSES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {titleCase(st)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>

        <Field id="inv-due" label="Due date" error={errors.dueDate} required>
          {(f) => (
            <Input
              {...f}
              type="date"
              value={draft.dueDate}
              onChange={(e) => patchDraft({ dueDate: e.target.value })}
            />
          )}
        </Field>
      </FormDialog>
    </div>
  );
}

/* --------------------------------- shared ---------------------------------- */

function IconBtn({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid size-8 place-items-center rounded-lg border border-border text-muted-foreground outline-none transition-colors",
        "hover:bg-muted hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-40",
        destructive
          ? "hover:border-destructive/40 hover:text-destructive"
          : "hover:border-brand-secondary/40"
      )}
    >
      {children}
    </button>
  );
}
