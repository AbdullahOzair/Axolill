"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, CircleAlert, Loader2, Unplug } from "lucide-react";

import { fetchJson, useLoader } from "@/lib/use-api";
import { fmtDate } from "@/lib/format";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";

type Connection = {
  connectedAt: string;
  accessTokenExpiresAt: string;
  scope: string;
  hasCalendarScope: boolean;
};

async function loadConnection(): Promise<Connection | null> {
  const { connection } = await fetchJson<{ connection: Connection | null }>(
    "/api/admin/google-calendar"
  );
  return connection;
}

export function CalendarSettings() {
  const params = useSearchParams();
  const { data, error, loading, reload } =
    useLoader<Connection | null>(loadConnection);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // The OAuth callback redirects back here with the outcome.
  const callbackError = params.get("error");
  const justConnected = params.get("connected") === "1";

  async function disconnect() {
    setDisconnecting(true);
    setActionError(null);
    try {
      await fetchJson("/api/admin/google-calendar", { method: "DELETE" });
      setConfirmOpen(false);
      reload();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not disconnect."
      );
    } finally {
      setDisconnecting(false);
    }
  }

  const connected = !!data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Calendar
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect Google Calendar so booked meetings are written straight to your
          calendar.
        </p>
      </header>

      {callbackError && (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {callbackError}
        </p>
      )}

      {justConnected && connected && (
        <p className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success">
          <CalendarCheck className="mt-0.5 size-4 shrink-0" />
          Google Calendar connected.
        </p>
      )}

      {actionError && <ErrorState message={actionError} />}

      <section className="rounded-2xl border border-border/60 bg-background/60 p-6 shadow-sm">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="mt-4 h-9 w-44" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} className="border-0" />
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-brand-secondary/10 to-accent-cyan/10 text-brand-secondary ring-1 ring-brand-secondary/15 dark:text-blue-400">
                  <CalendarCheck className="size-5" />
                </span>
                <div>
                  <h2 className="font-heading text-base font-semibold">
                    Google Calendar
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Scope: calendar.events — create and update events only.
                  </p>
                </div>
              </div>

              <Badge
                className={
                  connected
                    ? "rounded-full border-0 bg-success/10 text-xs font-medium text-success"
                    : "rounded-full border-0 bg-muted text-xs font-medium text-muted-foreground"
                }
              >
                {connected ? "Connected" : "Not connected"}
              </Badge>
            </div>

            {connected && data && (
              <dl className="mt-5 grid gap-3 rounded-xl border border-border/60 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Connected on</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">
                    {fmtDate(data.connectedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Calendar permission</dt>
                  <dd className="mt-0.5 font-medium">
                    {data.hasCalendarScope ? "Granted" : "Missing — reconnect"}
                  </dd>
                </div>
              </dl>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {/*
                A plain link, not fetch(): the browser has to actually navigate
                to Google's consent screen, and an XHR can't do that.
              */}
              <Button
                render={<a href="/api/admin/google-calendar/connect" />}
                // Base UI assumes a native <button>; this one is genuinely an
                // anchor (a real navigation), so opt out of button semantics.
                nativeButton={false}
                variant={connected ? "outline" : "default"}
                className="gap-2"
              >
                <CalendarCheck className="size-4" />
                {connected ? "Reconnect" : "Connect Google Calendar"}
              </Button>

              {connected && (
                <Button
                  variant="ghost"
                  onClick={() => setConfirmOpen(true)}
                  className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Unplug className="size-4" />
                  Disconnect
                </Button>
              )}
            </div>

            {!connected && (
              <p className="mt-4 text-xs text-muted-foreground">
                You&apos;ll be sent to Google to approve access. This is separate
                from signing in with Google — it grants Axonill permission to
                write events to your calendar.
              </p>
            )}
          </>
        )}
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect Google Calendar?</DialogTitle>
            <DialogDescription>
              Axonill will revoke its access at Google and delete the stored
              token. Meetings already on your calendar stay there, but new
              bookings won&apos;t be added until you reconnect.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={disconnecting} />}
            >
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={disconnect}
              disabled={disconnecting}
              className="gap-2"
            >
              {disconnecting && <Loader2 className="size-4 animate-spin" />}
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
