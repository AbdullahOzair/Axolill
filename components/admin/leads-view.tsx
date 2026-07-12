"use client";

import * as React from "react";
import {
  CalendarDays,
  Filter,
  Inbox,
  Mail,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fetchJson, useLoader } from "@/lib/use-api";
import type { Lead, LeadStatus, Meeting, Project } from "@/lib/data-model";
import { Badge } from "@/components/ui/badge";
import {
  ErrorState,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/ui/states";
import { AdminPage } from "@/components/admin/admin-page";
import {
  DataTable,
  type Column,
  type RowAction,
} from "@/components/admin/data-table";

const LEAD_STATUS: Record<LeadStatus, { label: string; className: string }> = {
  new: {
    label: "New",
    className: "bg-brand-secondary/10 text-brand-secondary dark:text-blue-400",
  },
  contacted: {
    label: "Contacted",
    className: "bg-accent-cyan/10 text-cyan-700 dark:text-cyan-400",
  },
  qualified: {
    label: "Qualified",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  won: { label: "Won", className: "bg-success/10 text-success" },
  lost: { label: "Lost", className: "bg-muted text-muted-foreground" },
};

const FILTERS: ("all" | LeadStatus)[] = [
  "all",
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
];

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

type AdminData = { leads: Lead[]; projects: Project[]; meetings: Meeting[] };

async function loadAdmin(): Promise<AdminData> {
  const [l, p, m] = await Promise.all([
    fetchJson<{ leads: Lead[] }>("/api/contact"),
    fetchJson<{ projects: Project[] }>("/api/projects"),
    fetchJson<{ meetings: Meeting[] }>("/api/meetings"),
  ]);
  return { leads: l.leads, projects: p.projects, meetings: m.meetings };
}

export function LeadsView() {
  const { data, error, loading, reload } = useLoader<AdminData>(loadAdmin);
  const [filter, setFilter] = React.useState<"all" | LeadStatus>("all");

  const leads = data?.leads ?? [];
  const projects = data?.projects ?? [];
  const meetings = data?.meetings ?? [];

  const openLeads = leads.filter(
    (l) => l.status !== "won" && l.status !== "lost"
  ).length;
  const qualified = leads.filter((l) => l.status === "qualified").length;
  const won = leads.filter((l) => l.status === "won").length;
  const winRate = leads.length ? Math.round((won / leads.length) * 100) : 0;
  const pipelineValue = projects.reduce((sum, p) => sum + p.budget, 0);
  const upcoming = meetings.filter((m) => m.status === "scheduled").length;

  const visible =
    filter === "all" ? leads : leads.filter((l) => l.status === filter);

  const columns: Column<Lead>[] = [
    {
      key: "name",
      header: "Name",
      cell: (l) => <span className="font-medium">{l.name}</span>,
    },
    {
      key: "company",
      header: "Company",
      cell: (l) => (
        <span className="text-muted-foreground">{l.company ?? "—"}</span>
      ),
    },
    {
      key: "service",
      header: "Service",
      cell: (l) => (
        <span className="text-muted-foreground">{l.service ?? "—"}</span>
      ),
    },
    {
      key: "budget",
      header: "Budget",
      cell: (l) => (
        <span className="text-muted-foreground tabular-nums">
          {l.budgetRange ?? "—"}
        </span>
      ),
    },
    {
      key: "source",
      header: "Source",
      cell: (l) => (
        <span className="text-muted-foreground">{l.source ?? "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (l) => (
        <Badge
          className={cn(
            "rounded-full border-0 text-xs font-medium whitespace-nowrap",
            LEAD_STATUS[l.status].className
          )}
        >
          {LEAD_STATUS[l.status].label}
        </Badge>
      ),
    },
  ];

  const actions: RowAction<Lead>[] = [
    {
      icon: Mail,
      label: (l) => `Email ${l.name}`,
      onClick: (l) => window.open(`mailto:${l.email}`, "_self"),
    },
  ];

  return (
    <AdminPage
      eyebrow="Leads"
      title="Leads"
      description="Enquiries from the website contact form."
    >
      {loading ? (
        <div className="space-y-6">
          <StatCardsSkeleton />
          <section className="admin-surface">
            <TableSkeleton rows={6} />
          </section>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Users}
              label="Open leads"
              value={String(openLeads)}
              hint={`${leads.length} total · ${qualified} qualified`}
            />
            <StatCard
              icon={Target}
              label="Win rate"
              value={`${winRate}%`}
              hint={`${won} won of ${leads.length}`}
            />
            <StatCard
              icon={TrendingUp}
              label="Project value"
              value={fmtMoney(pipelineValue)}
              hint={`${projects.length} active projects`}
            />
            <StatCard
              icon={CalendarDays}
              label="Upcoming meetings"
              value={String(upcoming)}
              hint={`${meetings.length} total booked`}
            />
          </div>

          {/* Status filter — the table itself is the shared DataTable. */}
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "all" ? "All" : LEAD_STATUS[f].label}
              </button>
            ))}
          </div>

          <DataTable<Lead>
            rows={visible}
            columns={columns}
            actions={actions}
            getRowId={(l) => l.id}
            noun={{ one: "lead", many: "leads" }}
            empty={
              leads.length === 0
                ? {
                    icon: Inbox,
                    title: "No leads yet",
                    description:
                      "Submissions from the website contact form will land here.",
                  }
                : {
                    icon: Filter,
                    title: `No ${LEAD_STATUS[filter as LeadStatus]?.label.toLowerCase() ?? ""} leads`,
                    description: "Nothing matches this status right now.",
                    action: { label: "Show all leads", onClick: () => setFilter("all") },
                  }
            }
          />
        </div>
      )}
    </AdminPage>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-5 shadow-sm transition-colors hover:border-brand-secondary/40">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand-secondary/10 to-accent-cyan/10 text-brand-secondary ring-1 ring-brand-secondary/15 dark:text-blue-400">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 font-heading text-3xl font-bold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
