import type { Metadata } from "next";

import { TechnologiesView } from "@/components/admin/cms/technologies-view";

export const metadata: Metadata = { title: "Technologies — Axonill Admin" };

export default function Page() {
  return <TechnologiesView />;
}
