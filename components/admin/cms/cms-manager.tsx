"use client";

import * as React from "react";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { fetchJson, useLoader } from "@/lib/use-api";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import {
  FormDialog,
  FORM_ERROR,
  type FieldErrors,
} from "@/components/admin/form-dialog";
import { AdminPage } from "@/components/admin/admin-page";
import {
  DataTable,
  type Column as DataColumn,
  type RowAction,
} from "@/components/admin/data-table";
import { PublishSwitch } from "@/components/admin/publish-switch";

/**
 * Every CMS row shares these. `order` is optional: `testimonial` has no order
 * column, so that list simply doesn't render (or sort by) the column.
 */
type Row = { id: string; published: boolean; order?: number };

/** Kept for the existing view files — a column of the shared table. */
export type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

/**
 * Generic CMS screen: list + create/edit dialog + publish toggle + delete.
 * Used by Services, Technologies, Portfolio, Team and Testimonials so they
 * can't drift apart. The table itself is the shared <DataTable>.
 */
export function CmsManager<T extends Row, D extends object>({
  title,
  description,
  eyebrow = "Content",
  endpoint,
  listKey,
  columns,
  emptyDraft,
  toDraft,
  renderForm,
  validate,
  labelOf,
  addLabel = "Add",
  orderable = true,
}: {
  title: string;
  description: string;
  /** Sidebar group this page belongs to — shown as the header eyebrow. */
  eyebrow?: string;
  /** e.g. "/api/services" */
  endpoint: string;
  /** response key for the collection, e.g. "services" */
  listKey: string;
  columns: Column<T>[];
  emptyDraft: D;
  toDraft: (row: T) => D;
  renderForm: (
    draft: D,
    patch: (p: Partial<D>) => void,
    errors: FieldErrors
  ) => React.ReactNode;
  /** Return { field: message } for anything invalid; {} when the form is good. */
  validate?: (draft: D) => FieldErrors;
  /** Human label for a row, used in the delete confirmation. */
  labelOf: (row: T) => string;
  addLabel?: string;
  /** False for entities with no `order` column (e.g. testimonials). */
  orderable?: boolean;
}) {
  const load = React.useCallback(
    () =>
      fetchJson<Record<string, T[]>>(endpoint).then((res) => res[listKey] ?? []),
    [endpoint, listKey]
  );
  const { data, error, loading, reload } = useLoader<T[]>(load);
  const rows = data ?? [];

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<T | null>(null);
  const [draft, setDraft] = React.useState<D>(emptyDraft);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors>({});

  /** Rows whose publish toggle or delete is mid-flight. */
  const [busyIds, setBusyIds] = React.useState<string[]>([]);
  const [rowError, setRowError] = React.useState<string | null>(null);

  /** Editing a field clears its error — don't keep shouting once it's fixed. */
  const singular = title.replace(/s$/, "");

  /** Editing a field clears its error — don't keep shouting once it's fixed. */
  const patch = (p: Partial<D>) => {
    setDraft((d) => ({ ...d, ...p }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(p)) delete next[k];
      return next;
    });
  };

  const openCreate = React.useCallback(() => {
    setEditing(null);
    setDraft(emptyDraft);
    setErrors({});
    setOpen(true);
  }, [emptyDraft]);

  function openEdit(row: T) {
    setEditing(row);
    setDraft(toDraft(row));
    setErrors({});
    setOpen(true);
  }

  async function save() {
    const found = validate?.(draft) ?? {};
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      await fetchJson(editing ? `${endpoint}/${editing.id}` : endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setOpen(false);
      toast.success(
        editing ? `${labelOf(editing)} updated` : `${singular} created`,
        {
          description: editing
            ? "Your changes are live if the item is published."
            : "It stays unpublished until you toggle it on.",
        }
      );
      reload();
    } catch (err) {
      setErrors({
        [FORM_ERROR]: err instanceof Error ? err.message : "Could not save.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(row: T, next: boolean) {
    setBusyIds((b) => [...b, row.id]);
    setRowError(null);
    try {
      await fetchJson(`${endpoint}/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      });
      toast.success(next ? `${labelOf(row)} published` : `${labelOf(row)} unpublished`);
      reload();
    } catch (err) {
      setRowError(
        err instanceof Error ? err.message : "Could not update publish state."
      );
    } finally {
      setBusyIds((b) => b.filter((id) => id !== row.id));
    }
  }

  async function remove(row: T) {
    setBusyIds((b) => [...b, row.id]);
    setRowError(null);
    try {
      await fetchJson(`${endpoint}/${row.id}`, { method: "DELETE" });
      toast.success(`${labelOf(row)} deleted`);
      reload();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusyIds((b) => b.filter((id) => id !== row.id));
    }
  }

  /* The caller's columns, plus the three every CMS list shares. */
  const tableColumns: DataColumn<T>[] = [
    ...columns.map((c) => ({
      key: c.header,
      header: c.header,
      cell: c.cell,
      className: c.className,
    })),
    ...(orderable
      ? [
          {
            key: "order",
            header: "Order",
            className: "w-20",
            cell: (row: T) => (
              <span className="text-muted-foreground tabular-nums">
                {row.order}
              </span>
            ),
          },
        ]
      : []),
    {
      key: "published",
      header: "Published",
      className: "w-28",
      cell: (row) => (
        <PublishSwitch
          checked={row.published}
          disabled={busyIds.includes(row.id)}
          onCheckedChange={(next) => togglePublished(row, next)}
          aria-label={`Publish ${labelOf(row)}`}
        />
      ),
    },
  ];

  const actions: RowAction<T>[] = [
    {
      icon: Pencil,
      label: (row) => `Edit ${labelOf(row)}`,
      onClick: openEdit,
    },
    {
      icon: Trash2,
      label: (row) => `Delete ${labelOf(row)}`,
      onClick: remove,
      destructive: true,
      confirm: {
        title: `Delete this ${singular.toLowerCase()}?`,
        description: "This can't be undone —",
        confirmLabel: "Delete",
      },
    },
  ];

  return (
    <AdminPage
      eyebrow={eyebrow}
      title={title}
      description={description}
      action={
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          {addLabel}
        </Button>
      }
    >
      {rowError && <ErrorState message={rowError} className="mb-6" />}

      <DataTable<T>
        rows={rows}
        columns={tableColumns}
        actions={actions}
        getRowId={(row) => row.id}
        busyIds={busyIds}
        loading={loading}
        error={error}
        onRetry={reload}
        noun={{ one: singular.toLowerCase(), many: title.toLowerCase() }}
        empty={{
          icon: Sparkles,
          title: `No ${title.toLowerCase()} yet`,
          description: `Nothing here yet. Create the first ${singular.toLowerCase()} and it'll appear on the site once published.`,
          action: { label: addLabel, onClick: openCreate },
        }}
      />

      {/* Create / edit — the shared form shell. */}
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? `Edit ${singular.toLowerCase()}` : addLabel}
        description={
          editing
            ? "Changes go live as soon as the item is published."
            : "New items start unpublished until you toggle them on."
        }
        error={errors[FORM_ERROR]}
        saving={saving}
        onSubmit={save}
        submitLabel={editing ? "Save changes" : "Create"}
      >
        {renderForm(draft, patch, errors)}
      </FormDialog>
    </AdminPage>
  );
}
