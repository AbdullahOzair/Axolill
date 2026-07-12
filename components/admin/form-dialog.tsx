"use client";

import * as React from "react";
import { CircleAlert, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

/* --------------------------------- errors ---------------------------------- */

/** field name → message. `_form` holds errors that aren't tied to one field. */
export type FieldErrors = Record<string, string>;
export const FORM_ERROR = "_form";

/* -------------------------------- container -------------------------------- */

/**
 * The one admin form shell. Every create/edit dialog renders through this so
 * the entrance, the scroll behaviour, the sticky footer and the saving state
 * can't drift apart between screens.
 *
 * The scale+fade entrance comes from DialogContent itself (data-open:zoom-in-95
 * + fade-in-0) — it isn't re-implemented here.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  error,
  saving,
  onSubmit,
  submitLabel = "Save",
  savingLabel = "Saving…",
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /** Form-level error (not tied to a field). */
  error?: string | null;
  saving?: boolean;
  onSubmit: () => void;
  submitLabel?: string;
  savingLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog
      open={open}
      // Don't let a click-outside discard a form mid-save.
      onOpenChange={(next) => {
        if (saving && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={cn(
          // Grid rows: header / scrolling body / sticky footer.
          "grid max-h-[85vh] grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0 sm:max-w-lg",
          className
        )}
      >
        <DialogHeader className="border-b border-border/60 px-6 py-5 text-left">
          <DialogTitle className="font-heading text-lg">{title}</DialogTitle>
          {description && (
            <DialogDescription className="mt-1">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Body scrolls; the footer never leaves the viewport. */}
        <form
          id="admin-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="min-h-0 overflow-y-auto px-6 py-5"
        >
          {error && (
            <p
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex flex-col gap-5">{children}</div>
        </form>

        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-card/60 px-6 py-4 backdrop-blur">
          <DialogClose render={<Button variant="outline" disabled={saving} />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="admin-form"
            disabled={saving}
            className="gap-2"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? savingLabel : submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------- field ---------------------------------- */

/**
 * Label above the control, help text under it, error text below that.
 * Wires up `aria-invalid` / `aria-describedby` so the message is announced
 * rather than merely coloured red.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Receives the wiring the control needs. */
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  }) => React.ReactNode;
  className?: string;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-destructive">
            *
          </span>
        )}
      </Label>

      {children({
        id,
        "aria-invalid": !!error,
        "aria-describedby": describedBy,
      })}

      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          className="flex items-center gap-1.5 text-xs font-medium text-destructive"
        >
          <CircleAlert className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
