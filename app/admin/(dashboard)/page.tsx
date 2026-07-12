import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth";
import { Overview } from "@/components/admin/overview";

export const metadata: Metadata = { title: "Overview — Axonill Admin" };

export default async function AdminIndexPage() {
  // The layout already guards /admin, but we need the session for the greeting.
  const session = await requireAdmin("/admin");

  return <Overview name={session.user.name} />;
}
