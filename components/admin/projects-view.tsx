"use client";

import * as React from "react";
import { FolderKanban, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { fetchJson, useLoader } from "@/lib/use-api";
import { fmtDate, titleCase, today } from "@/lib/format";
import type { ClientAccount, Project } from "@/lib/data-model";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Field,
  FormDialog,
  FORM_ERROR,
  type FieldErrors,
} from "@/components/admin/form-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPage } from "@/components/admin/admin-page";
import {
  DataTable,
  type Column,
  type RowAction,
} from "@/components/admin/data-table";
import { ProjectDetail } from "@/components/admin/project-detail";

type ProjectsData = { projects: Project[]; clients: ClientAccount[] };

async function loadProjects(): Promise<ProjectsData> {
  const [p, c] = await Promise.all([
    fetchJson<{ projects: Project[] }>("/api/projects"),
    fetchJson<{ clients: ClientAccount[] }>("/api/clients"),
  ]);
  return { projects: p.projects, clients: c.clients };
}

type Draft = {
  clientId: string;
  name: string;
  service: string;
  targetDate: string;
};

const EMPTY: Draft = { clientId: "", name: "", service: "", targetDate: "" };

export function ProjectsView() {
  const { data, error, loading, reload } = useLoader<ProjectsData>(loadProjects);
  const projects = data?.projects ?? [];
  // Stable identity — `clientName` below is a dependency of the render path.
  const clients = React.useMemo(() => data?.clients ?? [], [data]);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors>({});

  const clientName = React.useCallback(
    (id: string) => clients.find((c) => c.id === id)?.name ?? "Unknown client",
    [clients]
  );

  // Keep the open detail sheet in sync with a reload.
  const selected = projects.find((p) => p.id === selectedId) ?? null;

  const patch = (part: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...part }));
    // Fixing a field clears its error.
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(part)) delete next[k];
      return next;
    });
  };

  /* Base UI renders the raw value in the trigger unless given an items map. */
  const clientItems = clients.map((c) => ({
    value: c.id,
    label: c.company ? `${c.name} — ${c.company}` : c.name,
  }));

  function openCreate() {
    setDraft({ ...EMPTY, targetDate: today() });
    setErrors({});
    setOpen(true);
  }

  async function create() {
    const found: FieldErrors = {};
    if (!draft.clientId) found.clientId = "Pick a client.";
    if (!draft.name.trim()) found.name = "Give the project a name.";
    if (!draft.service.trim()) found.service = "What kind of work is this?";
    if (!draft.targetDate) found.targetDate = "Pick a target date.";
    if (Object.keys(found).length) return setErrors(found);

    setSaving(true);
    setErrors({});
    try {
      await fetchJson("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: draft.clientId,
          name: draft.name.trim(),
          service: draft.service.trim(),
          // The API requires a startDate; a project created today starts today.
          startDate: today(),
          targetDate: draft.targetDate,
        }),
      });
      setOpen(false);
      toast.success(`${draft.name.trim()} created`, {
        description: "It's live in the client's portal straight away.",
      });
      reload();
    } catch (err) {
      setErrors({
        [FORM_ERROR]: err instanceof Error ? err.message : "Could not create.",
      });
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<Project>[] = [
    {
      key: "name",
      header: "Project",
      cell: (p) => <span className="font-medium">{p.name}</span>,
    },
    {
      key: "client",
      header: "Client",
      cell: (p) => (
        <span className="text-muted-foreground">{clientName(p.clientId)}</span>
      ),
    },
    {
      key: "service",
      header: "Service",
      cell: (p) => <span className="text-muted-foreground">{p.service}</span>,
    },
    {
      key: "stage",
      header: "Stage",
      cell: (p) => (
        <Badge variant="secondary" className="rounded-full text-xs whitespace-nowrap">
          {titleCase(p.stage)}
        </Badge>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      className: "w-44",
      cell: (p) => (
        <div className="flex items-center gap-2.5">
          <div
            className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuenow={p.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${p.name} progress`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-secondary to-accent-cyan"
              style={{ width: `${p.progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {p.progress}%
          </span>
        </div>
      ),
    },
    {
      key: "target",
      header: "Target",
      cell: (p) => (
        <span className="text-muted-foreground tabular-nums">
          {fmtDate(p.targetDate)}
        </span>
      ),
    },
  ];

  const actions: RowAction<Project>[] = [
    {
      icon: Settings2,
      label: (p) => `Manage ${p.name}`,
      onClick: (p) => setSelectedId(p.id),
    },
  ];

  return (
    <AdminPage
      eyebrow="Clients"
      title="Projects"
      description="Everything in flight. Open a project to manage its milestones, files and invoices."
      action={
        <Button onClick={openCreate} disabled={loading || !!error} className="gap-2">
          <Plus className="size-4" />
          New Project
        </Button>
      }
    >
      <DataTable<Project>
        rows={projects}
        columns={columns}
        actions={actions}
        getRowId={(p) => p.id}
        loading={loading}
        error={error}
        onRetry={reload}
        noun={{ one: "project", many: "projects" }}
        empty={{
          icon: FolderKanban,
          title: "No projects yet",
          description: "Set one up for a client and it'll show in their portal straight away.",
          action: { label: "New Project", onClick: openCreate },
        }}
      />

      {/* New project */}
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="New project"
        description="It starts at the Discover stage with 0% progress — set those from the project once it's created."
        error={errors[FORM_ERROR]}
        saving={saving}
        onSubmit={create}
        submitLabel="Create project"
        savingLabel="Creating…"
      >
        <Field id="proj-client" label="Client" error={errors.clientId} required>
          {(f) =>
            clients.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                No clients yet — a project needs one. They appear here once
                someone signs up on the website.
              </p>
            ) : (
              <Select
                items={clientItems}
                value={draft.clientId}
                onValueChange={(v) => patch({ clientId: v as string })}
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

        <Field id="proj-name" label="Name" error={errors.name} required>
          {(f) => (
            <Input
              {...f}
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Axonill Web Platform"
            />
          )}
        </Field>

        <Field id="proj-service" label="Service" error={errors.service} required>
          {(f) => (
            <Input
              {...f}
              value={draft.service}
              onChange={(e) => patch({ service: e.target.value })}
              placeholder="Web Development"
            />
          )}
        </Field>

        <Field
          id="proj-target"
          label="Target date"
          hint="The date you're aiming to deliver by."
          error={errors.targetDate}
          required
        >
          {(f) => (
            <Input
              {...f}
              type="date"
              value={draft.targetDate}
              onChange={(e) => patch({ targetDate: e.target.value })}
            />
          )}
        </Field>
      </FormDialog>

      <ProjectDetail
        project={selected}
        clientName={selected ? clientName(selected.clientId) : ""}
        onClose={() => setSelectedId(null)}
        onProjectChange={reload}
      />
    </AdminPage>
  );
}
