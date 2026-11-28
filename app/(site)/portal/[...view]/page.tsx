import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { project } from "@/lib/db/schema";
import { ActiveProject } from "@/components/portal/active-project";
import { ClientWorkspace } from "@/components/portal/client-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Client Portal | Axonill", robots: { index: false, follow: false } };

const destinations = ["overview", "requests", "quotations", "meetings", "messages", "settings", "help", "notifications", "project", "projects"];

export default async function PortalView({ params }: { params: Promise<{ view: string[] }> }) {
  const [view, id, tab, extra] = (await params).view;
  if (extra || (tab && (view !== "project" || !["overview","timeline","milestones","files","quotations","invoices","meetings","messages","changes","reports","handover","support","service","notifications"].includes(tab))) || !destinations.includes(view) || (id && !["requests", "quotations", "project", "messages"].includes(view))) notFound();
  const { user } = await requireUser("/portal/" + [view,id,tab].filter(Boolean).join("/"));
  if (user.role === "admin") redirect("/admin");
  if (view === "project") {
    if (!id) notFound();
    const owned = await db().select({ id: project.id }).from(project)
      .where(and(eq(project.id, id), eq(project.clientId, user.id))).get();
    if (!owned) notFound();
    return <ActiveProject key={id + ":" + (tab ?? "overview")} id={id} tab={tab ?? "overview"} name={user.name}/>;
  }
  return <ClientWorkspace key={view + (id ?? "")} name={user.name} view={view} id={id} />;
}
