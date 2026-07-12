import type { Metadata } from "next";

import { requireUser } from "@/lib/auth";
import { PortalDashboard } from "@/components/portal/portal-dashboard";

// Per-user + reads D1 at request time — never prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client Portal — Axonill",
  description:
    "Track your project stage, approve milestones, and review files and invoices.",
};

export default async function PortalPage() {
  // Server-side guard (getServerSession under the hood):
  // signed-out users are redirected to /login?next=/portal.
  const session = await requireUser("/portal");
  const user = session.user;

  return (
    <PortalDashboard
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        company: (user as { company?: string | null }).company ?? null,
      }}
    />
  );
}
