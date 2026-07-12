"use client";

import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ErrorState, TableSkeleton } from "@/components/ui/states";

/* --------------------------------- types ---------------------------------- */

export type Column<T> = {
  /** Unique per table — also the <th> text unless `header` is a node. */
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Extra classes on both the <th> and <td>. */
  className?: string;
  align?: "left" | "right";
};

export type RowAction<T> = {
  icon: LucideIcon;
  /** Tooltip + aria-label. Row-specific so screen readers get "Delete Web Development". */
  label: (row: T) => string;
  onClick: (row: T) => void;
  destructive?: boolean;
  /** When set, the action opens a confirm dialog instead of firing instantly. */
  confirm?: {
    title: string;
    /** Shown above the row's label. */
    description: React.ReactNode;
    confirmLabel?: string;
  };
};

export type EmptyState = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
};

/* -------------------------------- component -------------------------------- */

/**
 * The one admin table. Every list page renders through this so density,
 * empty states, motion and pagination can't drift apart.
 *
 * Density comes from the `admin-table` utility (CLAUDE.md → Admin Design
 * System): 56px rows, 20px cell padding, muted 12px headers, hover-only
 * highlight, no zebra.
 */
export function DataTable<T>({
  rows,
  columns,
  getRowId,
  actions,
  empty,
  loading,
  error,
  onRetry,
  busyIds = [],
  noun = { one: "row", many: "rows" },
  pageSize = 10,
  className,
}: {
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  actions?: RowAction<T>[];
  empty: EmptyState;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Rows with an in-flight mutation — dimmed and non-interactive. */
  busyIds?: string[];
  noun?: { one: string; many: string };
  pageSize?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [page, setPage] = React.useState(0);
  const [pending, setPending] = React.useState<{
    action: RowAction<T>;
    row: T;
  } | null>(null);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

  // Deleting the last row on the last page would strand us past the end.
  React.useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);

  const start = page * pageSize;
  const visible = rows.slice(start, start + pageSize);

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.03 } },
  };
  const rowVariant: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
    },
  };

  if (loading) {
    return (
      <section className="admin-surface overflow-hidden">
        <TableSkeleton rows={5} />
      </section>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  if (rows.length === 0) {
    return <EmptyPanel empty={empty} />;
  }

  const colSpan = columns.length + (actions?.length ? 1 : 0);

  return (
    <>
      <section className={cn("admin-surface overflow-hidden", className)}>
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={cn(
                      c.align === "right" && "text-right",
                      c.className
                    )}
                  >
                    {c.header}
                  </th>
                ))}
                {actions?.length ? (
                  <th className="w-px text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>

            {/* Re-keyed per page so a page change replays the stagger. */}
            <motion.tbody
              key={page}
              variants={container}
              initial="hidden"
              animate="show"
            >
              {visible.map((row) => {
                const id = getRowId(row);
                const busy = busyIds.includes(id);

                return (
                  <motion.tr
                    key={id}
                    variants={rowVariant}
                    className={cn(busy && "pointer-events-none opacity-50")}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          c.align === "right" && "text-right",
                          c.className
                        )}
                      >
                        {c.cell(row)}
                      </td>
                    ))}

                    {actions?.length ? (
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          {actions.map((action, i) => (
                            <IconAction
                              key={i}
                              action={action}
                              row={row}
                              busy={busy}
                              onRequest={() =>
                                action.confirm
                                  ? setPending({ action, row })
                                  : action.onClick(row)
                              }
                            />
                          ))}
                        </div>
                      </td>
                    ) : null}
                  </motion.tr>
                );
              })}
            </motion.tbody>

            {/* Footer lives in the table so it aligns with the card edges. */}
            <tfoot>
              <tr>
                <td colSpan={colSpan} className="!h-auto border-t border-border/45 !py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Showing {start + 1}–{start + visible.length} of{" "}
                      {rows.length}{" "}
                      {rows.length === 1 ? noun.one : noun.many}
                    </p>

                    {pageCount > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          Page {page + 1} of {pageCount}
                        </span>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label="Previous page"
                          disabled={page === 0}
                          onClick={() => setPage((p) => p - 1)}
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label="Next page"
                          disabled={page >= pageCount - 1}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <ConfirmDialog
        pending={pending}
        onClose={() => setPending(null)}
        onConfirm={(action, row) => {
          action.onClick(row);
          setPending(null);
        }}
      />
    </>
  );
}

/* ------------------------------- empty state ------------------------------- */

function EmptyPanel({ empty }: { empty: EmptyState }) {
  const Icon = empty.icon ?? Inbox;

  return (
    <section className="admin-surface flex flex-col items-center justify-center px-6 py-20 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-secondary/10 to-accent-cyan/10 text-brand-secondary ring-1 ring-brand-secondary/15 dark:text-blue-400">
        <Icon className="size-6" />
      </span>

      <h3 className="mt-5 font-heading text-base font-semibold">
        {empty.title}
      </h3>
      {empty.description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {empty.description}
        </p>
      )}

      {empty.action && (
        <Button onClick={empty.action.onClick} className="mt-6">
          {empty.action.label}
        </Button>
      )}
    </section>
  );
}

/* ------------------------------- row actions ------------------------------- */

function IconAction<T>({
  action,
  row,
  busy,
  onRequest,
}: {
  action: RowAction<T>;
  row: T;
  busy: boolean;
  onRequest: () => void;
}) {
  const label = action.label(row);
  const Icon = action.icon;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            disabled={busy}
            onClick={onRequest}
            className={cn(
              "grid size-8 place-items-center rounded-lg text-muted-foreground outline-none",
              // Background fades in on hover rather than appearing instantly.
              "transition-colors duration-150",
              "focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-40",
              action.destructive
                ? "hover:bg-destructive/10 hover:text-destructive"
                : "hover:bg-accent hover:text-foreground"
            )}
          />
        }
      >
        <Icon className="size-4" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/* ----------------------------- confirm dialog ------------------------------ */

function ConfirmDialog<T>({
  pending,
  onClose,
  onConfirm,
}: {
  pending: { action: RowAction<T>; row: T } | null;
  onClose: () => void;
  onConfirm: (action: RowAction<T>, row: T) => void;
}) {
  const [working, setWorking] = React.useState(false);

  // Reset when a new confirmation is raised.
  React.useEffect(() => {
    if (pending) setWorking(false);
  }, [pending]);

  const confirm = pending?.action.confirm;

  return (
    <Dialog open={!!pending} onOpenChange={(o) => !o && onClose()}>
      {/* Base UI's DialogContent already carries the zoom/fade-in animation. */}
      <DialogContent className="sm:max-w-md">
        {pending && confirm && (
          <>
            <DialogHeader>
              <DialogTitle>{confirm.title}</DialogTitle>
              <DialogDescription>
                {confirm.description}{" "}
                <span className="font-medium text-foreground">
                  {pending.action.label(pending.row)}
                </span>
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <DialogClose
                render={<Button variant="outline" disabled={working} />}
              >
                Cancel
              </DialogClose>
              <Button
                variant={pending.action.destructive ? "destructive" : "default"}
                disabled={working}
                onClick={() => {
                  setWorking(true);
                  onConfirm(pending.action, pending.row);
                }}
                className="gap-2"
              >
                {working && <Loader2 className="size-4 animate-spin" />}
                {confirm.confirmLabel ?? "Confirm"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
