import type { Metadata } from "next";

import { ClientsView } from "@/components/admin/clients-view";

export const metadata: Metadata = { title: "Clients — Axonill Admin" };

export default function Page() {
  return <ClientsView />;
}
