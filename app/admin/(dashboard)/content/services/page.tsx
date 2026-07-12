import type { Metadata } from "next";

import { ServicesView } from "@/components/admin/cms/services-view";

export const metadata: Metadata = { title: "Services — Axonill Admin" };

export default function Page() {
  return <ServicesView />;
}
