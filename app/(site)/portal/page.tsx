import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/api";
import { project } from "@/lib/db/schema";
import { ClientWorkspace } from "@/components/portal/client-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Client Portal | Axonill", robots: { index: false, follow: false } };

export default async function PortalPage() {
  const { user } = await requireUser("/portal");
  if (user.role === "admin") redirect("/admin");
  const latest = await db().select({ id: project.id }).from(project).where(eq(project.clientId, user.id))
    .orderBy(desc(project.createdAt)).get();
  if (latest) redirect("/portal/project/" + latest.id);
  return <ClientWorkspace name={user.name} view="overview" />;
}
