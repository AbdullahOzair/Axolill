"use client";

import * as React from "react";
import Link from "next/link";
import Cal, { getCalApi } from "@calcom/embed-react";
import { ArrowLeft, CalendarDays, Clock, Video } from "lucide-react";
import { useTheme } from "next-themes";

const CAL_NAMESPACE = "discovery-call";
/** Point this at your real Cal.com event: e.g. "axonill/discovery-call". */
const CAL_LINK =
  process.env.NEXT_PUBLIC_CAL_LINK ?? "axonill/discovery-call";

export function BookCall() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const calTheme = resolvedTheme === "dark" ? "dark" : "light";

  React.useEffect(() => {
    if (!mounted) return;

    (async () => {
      const cal = await getCalApi({ namespace: CAL_NAMESPACE });
      cal("ui", {
        theme: calTheme,
        // Map the Axonill palette onto Cal's theme variables (CLAUDE.md).
        cssVarsPerTheme: {
          light: {
            "cal-brand": "#0F172A",
            "cal-text": "#0F172A",
            "cal-text-emphasis": "#0F172A",
            "cal-bg": "#FFFFFF",
            "cal-bg-emphasis": "#F1F5F9",
            "cal-border": "#E2E8F0",
            "cal-border-emphasis": "#2563EB",
          },
          dark: {
            "cal-brand": "#2563EB",
            "cal-text": "#F8FAFC",
            "cal-text-emphasis": "#F8FAFC",
            "cal-bg": "#0F172A",
            "cal-bg-emphasis": "#1E293B",
            "cal-border": "#1E293B",
            "cal-border-emphasis": "#2563EB",
          },
        },
        hideEventTypeDetails: false,
        layout: "month_view",
      });
    })();
  }, [mounted, calTheme]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      {/* Header */}
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ArrowLeft className="size-4" />
        Back to portal
      </Link>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wider text-brand-secondary uppercase dark:text-blue-400">
            Scheduling
          </p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Book a call
          </h1>
          <p className="mt-2 max-w-xl text-pretty text-muted-foreground">
            Pick a time that works for you and we&apos;ll send over a calendar
            invite with the meeting link.
          </p>
        </div>

        <ul className="flex flex-wrap gap-2">
          <Pill icon={Clock}>30 minutes</Pill>
          <Pill icon={Video}>Google Meet</Pill>
          <Pill icon={CalendarDays}>Free</Pill>
        </ul>
      </div>

      {/* Cal.com inline embed.
          The embed sizes to its parent, so the wrapper must have an explicit
          height — with `height: 100%` alone it collapses to zero. */}
      <div className="mt-8 h-[680px] overflow-hidden rounded-2xl border border-border/60 bg-background/60 shadow-sm backdrop-blur sm:h-[760px]">
        {mounted ? (
          <Cal
            namespace={CAL_NAMESPACE}
            calLink={CAL_LINK}
            className="h-full w-full"
            style={{ width: "100%", height: "100%", overflow: "scroll" }}
            config={{ layout: "month_view", theme: calTheme }}
          />
        ) : (
          // Avoids embedding with the wrong theme before it resolves.
          <div className="grid h-full place-items-center">
            <div className="flex flex-col items-center gap-3">
              <span className="size-8 animate-spin rounded-full border-2 border-border border-t-brand-secondary" />
              <p className="text-sm text-muted-foreground">
                Loading calendar…
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Can&apos;t find a slot that works?{" "}
        <Link
          href="/#contact"
          className="rounded-sm font-medium text-brand-secondary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-blue-400"
        >
          Send us a message instead
        </Link>
        .
      </p>
    </div>
  );
}

function Pill({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
      <Icon className="size-3.5 text-brand-secondary dark:text-blue-400" />
      {children}
    </li>
  );
}
