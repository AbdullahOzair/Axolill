"use client";

import * as React from "react";
import Link from "next/link";
import {
  animate,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  FolderKanban,
  Inbox,
  Layers,
  Video,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fetchJson, useLoader } from "@/lib/use-api";
import { titleCase } from "@/lib/format";
import type {
  Lead,
  LeadStatus,
  Meeting,
  MeetingProvider,
  PortfolioItem,
  Project,
  Service,
  TeamMember,
  Technology,
  Testimonial,
} from "@/lib/data-model";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { AdminPage } from "@/components/admin/admin-page";

/* --------------------------------- loader --------------------------------- */

type OverviewData = {
  projects: Project[];
  leads: Lead[];
  meetings: Meeting[];
  published: number;
};

/** Everything the overview needs, in one parallel fan-out. */
async function loadOverview(): Promise<OverviewData> {
  const [p, l, m, svc, tech, port, team, test] = await Promise.all([
    fetchJson<{ projects: Project[] }>("/api/projects"),
    fetchJson<{ leads: Lead[] }>("/api/contact"),
    fetchJson<{ meetings: Meeting[] }>("/api/meetings"),
    fetchJson<{ services: Service[] }>("/api/services"),
    fetchJson<{ technologies: Technology[] }>("/api/technologies"),
    fetchJson<{ portfolio: PortfolioItem[] }>("/api/portfolio"),
    fetchJson<{ team: TeamMember[] }>("/api/team"),
    fetchJson<{ testimonials: Testimonial[] }>("/api/testimonials"),
  ]);

  // Admins get drafts back too, so count only what's actually live on the site.
  const published =
    svc.services.filter((x) => x.published).length +
    tech.technologies.filter((x) => x.published).length +
    port.portfolio.filter((x) => x.published).length +
    team.team.filter((x) => x.published).length +
    test.testimonials.filter((x) => x.published).length;

  return {
    projects: p.projects,
    leads: l.leads,
    meetings: m.meetings,
    published,
  };
}

/* -------------------------------- overview -------------------------------- */

const LEAD_STATUS: Record<LeadStatus, string> = {
  new: "bg-brand-secondary/10 text-brand-secondary dark:text-blue-400",
  contacted: "bg-accent-cyan/10 text-cyan-700 dark:text-cyan-400",
  qualified: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  won: "bg-success/10 text-success",
  lost: "bg-muted text-muted-foreground",
};

const PROVIDER: Record<MeetingProvider, string> = {
  calcom: "Cal.com",
  google_meet: "Google Meet",
};

export function Overview({ name }: { name: string }) {
  const { data, error, loading, reload } =
    useLoader<OverviewData>(loadOverview);

  const projects = data?.projects ?? [];
  const leads = data?.leads ?? [];
  const meetings = data?.meetings ?? [];

  const now = Date.now();

  // "Active" = anything not yet in the support (post-launch) stage.
  const active = projects.filter((p) => p.stage !== "support");
  const newLeads = leads.filter((l) => l.status === "new");
  const upcoming = meetings
    .filter(
      (m) =>
        m.status === "scheduled" && new Date(m.scheduledAt).getTime() >= now
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
  const requested = meetings.filter((m) => m.status === "requested");

  const stats: Stat[] = [
    {
      icon: FolderKanban,
      label: "Active projects",
      value: active.length,
      hint:
        projects.length === active.length
          ? `${projects.length} total`
          : `${projects.length - active.length} in support · ${projects.length} total`,
      href: "/admin/projects",
    },
    {
      icon: Inbox,
      label: "New leads",
      value: newLeads.length,
      hint: `${leads.length} ${leads.length === 1 ? "enquiry" : "enquiries"} all-time`,
      href: "/admin/leads",
    },
    {
      icon: CalendarDays,
      label: "Upcoming meetings",
      value: upcoming.length,
      hint: requested.length
        ? `${requested.length} awaiting your confirmation`
        : "Nothing awaiting confirmation",
      emphasis: requested.length > 0,
      href: "/admin/meetings",
    },
    {
      icon: Layers,
      label: "Published content",
      value: data?.published ?? 0,
      hint: "Live on the marketing site",
      href: "/admin/content/services",
    },
  ];

  return (
    <AdminPage
      eyebrow="Overview"
      title={`Welcome back, ${name.split(" ")[0]}`}
      description="What needs your attention today."
    >
      {loading ? (
        <StatsSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat, i) => (
              <StatCard key={stat.label} stat={stat} index={i} />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <MiniList
              title="Recent leads"
              icon={Inbox}
              href="/admin/leads"
              linkLabel="All leads"
              empty="No enquiries yet. Submissions from the contact form land here."
              // The API already returns newest first.
              items={leads.slice(0, 5).map((l) => ({
                id: l.id,
                primary: l.name,
                secondary: l.company ?? l.email,
                badge: {
                  text: titleCase(l.status),
                  className: LEAD_STATUS[l.status],
                },
              }))}
            />

            <MiniList
              title="Upcoming meetings"
              icon={Video}
              href="/admin/meetings"
              linkLabel="All meetings"
              empty="Nothing scheduled. Bookings and Google Meets show up here."
              items={upcoming.slice(0, 5).map((m) => ({
                id: m.id,
                primary: m.title,
                secondary: `${m.attendeeName} · ${new Date(
                  m.scheduledAt
                ).toLocaleString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}`,
                badge: {
                  text: PROVIDER[m.provider],
                  className:
                    m.provider === "google_meet"
                      ? "bg-accent-cyan/10 text-cyan-700 dark:text-cyan-400"
                      : "bg-secondary text-muted-foreground",
                },
              }))}
            />
          </div>
        </div>
      )}
    </AdminPage>
  );
}

/* ------------------------------- stat cards -------------------------------- */

type Stat = {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
  href: string;
  /** Draw attention — something here needs action. */
  emphasis?: boolean;
};

/**
 * Count-up, same approach as the homepage About section: framer's `animate()`
 * writes straight to the text node so a 4-digit tick doesn't re-render React
 * 60 times a second. SSR renders the final value, so no-JS still reads right.
 */
function StatCard({ stat, index }: { stat: Stat; index: number }) {
  const { icon: Icon, label, value, hint, href, emphasis } = stat;
  const numberRef = React.useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  React.useEffect(() => {
    const node = numberRef.current;
    if (!node) return;

    if (reduce) {
      node.textContent = String(value);
      return;
    }

    const controls = animate(0, value, {
      duration: 1.1,
      delay: index * 0.08,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        node.textContent = String(Math.round(latest));
      },
    });
    return () => controls.stop();
  }, [value, index, reduce]);

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <Link
        href={href}
        className={cn(
          "admin-surface group flex h-full flex-col gap-3 p-5 outline-none",
          "transition-colors duration-150 hover:border-brand-secondary/40",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span
            className={cn(
              "grid size-9 place-items-center rounded-lg ring-1 transition-transform duration-200 group-hover:scale-105",
              emphasis
                ? "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400"
                : "bg-gradient-to-br from-brand-secondary/10 to-accent-cyan/10 text-brand-secondary ring-brand-secondary/15 dark:text-blue-400"
            )}
          >
            <Icon className="size-4" />
          </span>
        </div>

        <p className="font-heading text-4xl font-bold tracking-tight tabular-nums">
          {/* JS drives this; the SSR value is the real one for no-JS. */}
          <span ref={numberRef}>{value}</span>
        </p>

        <p
          className={cn(
            "text-xs",
            emphasis
              ? "font-medium text-amber-600 dark:text-amber-400"
              : "text-muted-foreground"
          )}
        >
          {hint}
        </p>
      </Link>
    </motion.div>
  );
}

/* ------------------------------- mini lists -------------------------------- */

type MiniItem = {
  id: string;
  primary: string;
  secondary: string;
  badge: { text: string; className: string };
};

function MiniList({
  title,
  icon: Icon,
  href,
  linkLabel,
  items,
  empty,
}: {
  title: string;
  icon: LucideIcon;
  href: string;
  linkLabel: string;
  items: MiniItem[];
  empty: string;
}) {
  const reduce = useReducedMotion();

  const container: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : 0.05, delayChildren: 0.2 },
    },
  };
  const item: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <section className="admin-surface flex flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border/45 px-5 py-4">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold">
          <Icon className="size-4 text-brand-secondary dark:text-blue-400" />
          {title}
        </h2>
        {/*
          A plain link, not <Button render={<Link/>}>: Base UI's Button expects
          a native <button> and strips button semantics off an anchor.
        */}
        <Link
          href={href}
          className="group/link flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {linkLabel}
          <ArrowRight className="size-3.5 transition-transform duration-200 group-hover/link:translate-x-0.5" />
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <motion.ul
          variants={container}
          initial="hidden"
          animate="show"
          className="divide-y divide-border/45"
        >
          {items.map((row) => (
            <motion.li
              key={row.id}
              variants={item}
              className="flex items-center gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-[var(--admin-hover)]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.primary}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.secondary}
                </p>
              </div>
              <Badge
                className={cn(
                  "shrink-0 rounded-full border-0 text-xs font-medium whitespace-nowrap",
                  row.badge.className
                )}
              >
                {row.badge.text}
              </Badge>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </section>
  );
}

/* -------------------------------- skeleton --------------------------------- */

function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="admin-surface p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-9 rounded-lg" />
            </div>
            <Skeleton className="mt-3 h-10 w-16" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="admin-surface p-5">
            <Skeleton className="h-5 w-36" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="mt-4 flex items-center gap-3">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
