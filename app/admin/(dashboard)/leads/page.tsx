import type { Metadata } from "next";

import { LeadsView } from "@/components/admin/leads-view";

export const metadata: Metadata = { title: "Leads — Axonill Admin" };

export default function AdminLeadsPage() {
  return <LeadsView />;
}
