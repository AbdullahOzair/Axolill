"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";

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
import { fetchJson } from "@/lib/use-api";

/** Tomorrow, rounded to the next half hour in the visitor's time zone. */
function defaultPreferred() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() > 30 ? 60 : 30, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BookingDialog({ open, onOpenChange, projectId, onSent }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string | null;
  onSent: () => void;
}) {
  const submittingRef = React.useRef(false);

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!submittingRef.current) onOpenChange(next);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book a Google Meet</DialogTitle>
          <DialogDescription>
            Tell us what you&apos;d like to talk about and when suits you.
            We&apos;ll confirm a time and send the Meet link here.
          </DialogDescription>
        </DialogHeader>
        <BookingForm projectId={projectId} submittingRef={submittingRef} onSent={() => {
          onOpenChange(false);
          onSent();
        }} />
      </DialogContent>
    </Dialog>
  );
}

function BookingForm({ projectId, submittingRef, onSent }: {
  projectId?: string | null;
  submittingRef: React.RefObject<boolean>;
  onSent: () => void;
}) {
  const titleId = React.useId();
  const timeId = React.useId();
  const [title, setTitle] = React.useState("");
  const [preferredAt, setPreferredAt] = React.useState(defaultPreferred);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!title.trim()) return setFormError("What's the call about?");
    const preferred = new Date(preferredAt);
    if (Number.isNaN(preferred.getTime())) return setFormError("Pick a preferred time.");

    submittingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      await fetchJson("/api/meetings/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), preferredAt: preferred.toISOString(), projectId }),
      });
      onSent();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not send the request.");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <form className="contents" onSubmit={submit}>
      {formError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor={titleId}>What&apos;s it about?</Label>
          <Input id={titleId} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Design review" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={timeId}>Preferred date &amp; time</Label>
          <Input id={timeId} type="datetime-local" value={preferredAt} onChange={(e) => setPreferredAt(e.target.value)} />
        </div>
      </div>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" disabled={saving} />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={saving} className="gap-2">
          {saving && <RotateCcw className="size-4 animate-spin" />}
          {saving ? "Sending…" : "Send request"}
        </Button>
      </DialogFooter>
    </form>
  );
}
