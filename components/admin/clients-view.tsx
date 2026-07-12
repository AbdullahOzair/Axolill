"use client";

import * as React from "react";
import {
  Building2,
  CalendarDays,
  Eye,
  FolderKanban,
  Mail,
  Phone,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fetchJson, useLoader } from "@/lib/use-api";
import { fmtDate, fmtMoney, initials, titleCase } from "@/lib/format";
import {
  PROJECT_STAGES,
  type ClientAccount,
  type Invoice,
  type Project,
} from "@/lib/data-model";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ErrorState, StatCardsSkeleton } from "@/components/ui/states";
import { AdminPage } from "@/components/admin/admin-page";
import {
  DataTable,
  type Column,
  type RowAction,
} from "@/components/admin/data-table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const INVOICE_STATUS: Record<Invoice["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-brand-secondary/10 text-brand-secondary dark:text-blue-400",
  paid: "bg-success/10 text-success",
  overdue: "bg-destructive/10 text-destructive",
};

/* --------------------------------- loader --------------------------------- */

type ClientsData = {
  clients: ClientAccount[];
  projects: Project[];
  invoices: Invoice[];
};

/**
 * One fetch of each collection instead of per-client requests: an admin's
 * /api/projects and /api/invoices already return *everything*, so the detail
 * view is a filter, not a round-trip.
 */
async function loadClients(): Promise<ClientsData> {
  const [c, p, i] = await Promise.all([
    fetchJson<{ clients: ClientAccount[] }>("/api/clients"),
    fetchJson<{ projects: Project[] }>("/api/projects"),
    fetchJson<{ invoices: Invoice[] }>("/api/invoices"),
  ]);
  return { clients: c.clients, projects: p.projects, invoices: i.invoices };
}

/* ---------------------------------- view ---------------------------------- */

export function ClientsView() {
  const { data, error, loading, reload } = useLoader<ClientsData>(loadClients);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const clients = React.useMemo(() => data?.clients ?? [], [data]);
  const projects = React.useMemo(() => data?.projects ?? [], [data]);
  const invoices = React.useMemo(() => data?.invoices ?? [], [data]);

  /** clientId → their projects. Built once so the table isn't O(n²). */
  const projectsByClient = React.useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const p of projects) {
      const list = map.get(p.clientId);
      if (list) list.push(p);
      else map.set(p.clientId, [p]);
    }
    return map;
  }, [projects]);

  const selected = clients.find((c) => c.id === selectedId) ?? null;
  const selectedProjects = selected
    ? (projectsByClient.get(selected.id) ?? [])
    : [];
  const selectedProjectIds = new Set(selectedProjects.map((p) => p.id));
  const selectedInvoices = invoices.filter((inv) =>
    selectedProjectIds.has(inv.projectId)
  );

  const withProjects = clients.filter(
    (c) => (projectsByClient.get(c.id)?.length ?? 0) > 0
  ).length;
  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);

  const columns: Column<ClientAccount>[] = [
    {
      key: "name",
      header: "Name",
      cell: (c) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8">
            {c.image && <AvatarImage src={c.image} alt="" />}
            <AvatarFallback className="bg-gradient-to-br from-brand-secondary to-accent-cyan text-xs font-semibold text-white">
              {initials(c.name)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{c.name}</span>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      cell: (c) => <span className="text-muted-foreground">{c.email}</span>,
    },
    {
      key: "company",
      header: "Company",
      cell: (c) => (
        <span className="text-muted-foreground">{c.company ?? "—"}</span>
      ),
    },
    {
      key: "projects",
      header: "Projects",
      align: "right",
      className: "w-28",
      cell: (c) => {
        const count = projectsByClient.get(c.id)?.length ?? 0;
        return count > 0 ? (
          <Badge variant="secondary" className="rounded-full text-xs tabular-nums">
            {count}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "joined",
      header: "Joined",
      cell: (c) => (
        <span className="text-muted-foreground tabular-nums">
          {fmtDate(c.createdAt)}
        </span>
      ),
    },
  ];

  const actions: RowAction<ClientAccount>[] = [
    {
      icon: Eye,
      label: (c) => `View ${c.name}`,
      onClick: (c) => setSelectedId(c.id),
    },
  ];

  return (
    <AdminPage
      eyebrow="Clients"
      title="Clients"
      description="The people with portal access. Open a client to see their projects and invoices."
    >
      {loading ? (
        <div className="space-y-6">
          <StatCardsSkeleton count={3} />
          <DataTable<ClientAccount>
            rows={[]}
            columns={columns}
            getRowId={(c) => c.id}
            loading
            empty={{ title: "" }}
          />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              icon={Users}
              label="Clients"
              value={String(clients.length)}
              hint={`${withProjects} with an active project`}
            />
            <StatCard
              icon={FolderKanban}
              label="Projects"
              value={String(projects.length)}
              hint={`Across ${withProjects} ${withProjects === 1 ? "client" : "clients"}`}
            />
            <StatCard
              icon={Wallet}
              label="Project value"
              value={fmtMoney(totalBudget)}
              hint={`${invoices.length} ${invoices.length === 1 ? "invoice" : "invoices"} raised`}
            />
          </div>

          <DataTable<ClientAccount>
            rows={clients}
            columns={columns}
            actions={actions}
            getRowId={(c) => c.id}
            noun={{ one: "client", many: "clients" }}
            empty={{
              icon: Users,
              title: "No clients yet",
              description:
                "Anyone who signs up on the website gets the client role and appears here.",
            }}
          />
        </div>
      )}

      <ClientDetail
        client={selected}
        projects={selectedProjects}
        invoices={selectedInvoices}
        onClose={() => setSelectedId(null)}
      />
    </AdminPage>
  );
}

/* -------------------------------- detail ---------------------------------- */

function ClientDetail({
  client,
  projects,
  invoices,
  onClose,
}: {
  client: ClientAccount | null;
  projects: Project[];
  invoices: Invoice[];
  onClose: () => void;
}) {
  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <Sheet open={!!client} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg"
      >
        {client && (
          <>
            <SheetHeader className="border-b border-border/60 p-6">
              <div className="flex items-center gap-3">
                <Avatar className="size-11">
                  {client.image && <AvatarImage src={client.image} alt="" />}
                  <AvatarFallback className="bg-gradient-to-br from-brand-secondary to-accent-cyan text-sm font-semibold text-white">
                    {initials(client.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 text-left">
                  <SheetTitle className="font-heading text-lg">
                    {client.name}
                  </SheetTitle>
                  <SheetDescription className="truncate">
                    Client since {fmtDate(client.createdAt)}
                  </SheetDescription>
                </div>
              </div>

              <dl className="mt-5 space-y-2.5">
                <MetaRow icon={Mail} label="Email" value={client.email} />
                <MetaRow
                  icon={Building2}
                  label="Company"
                  value={client.company ?? "—"}
                />
                <MetaRow
                  icon={Phone}
                  label="Phone"
                  value={client.phone ?? "—"}
                />
                <MetaRow
                  icon={Wallet}
                  label="Outstanding"
                  value={outstanding > 0 ? fmtMoney(outstanding) : "—"}
                />
              </dl>
            </SheetHeader>

            {/* Projects */}
            <section className="border-b border-border/60 p-6">
              <h3 className="flex items-center gap-2 font-heading text-sm font-semibold">
                <FolderKanban className="size-4 text-brand-secondary dark:text-blue-400" />
                Projects
                <span className="text-muted-foreground">
                  ({projects.length})
                </span>
              </h3>

              {projects.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                  No projects yet.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {projects.map((project) => {
                    const stageNo = PROJECT_STAGES.indexOf(project.stage) + 1;
                    return (
                      <li
                        key={project.id}
                        className="rounded-xl border border-border/60 bg-background/60 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">{project.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {project.service} · Due{" "}
                              {fmtDate(project.targetDate)}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className="shrink-0 rounded-full text-xs whitespace-nowrap"
                          >
                            {titleCase(project.stage)}
                          </Badge>
                        </div>

                        <div className="mt-3 flex items-center gap-3">
                          <div
                            className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
                            role="progressbar"
                            aria-valuenow={project.progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${project.name} progress`}
                          >
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-brand-secondary to-accent-cyan transition-[width] duration-500"
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {project.progress}%
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-muted-foreground">
                          Stage {stageNo} of {PROJECT_STAGES.length} ·{" "}
                          {fmtMoney(project.budget)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Invoices */}
            <section className="p-6">
              <h3 className="flex items-center gap-2 font-heading text-sm font-semibold">
                <Receipt className="size-4 text-brand-secondary dark:text-blue-400" />
                Invoices
                <span className="text-muted-foreground">
                  ({invoices.length})
                </span>
              </h3>

              {invoices.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                  No invoices yet.
                </p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {invoices.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 p-4"
                    >
                      <div className="min-w-0">
                        <p className="font-medium tabular-nums">{inv.number}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarDays className="size-3.5" />
                          Due {fmtDate(inv.dueDate)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-semibold tabular-nums">
                          {fmtMoney(inv.amount, inv.currency)}
                        </span>
                        <Badge
                          className={cn(
                            "rounded-full border-0 text-xs font-medium",
                            INVOICE_STATUS[inv.status]
                          )}
                        >
                          {titleCase(inv.status)}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </dt>
      <dd className="min-w-0 truncate font-medium">{value}</dd>
    </div>
  );
}

/* -------------------------------- stat card -------------------------------- */

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
