import type { Metadata } from "next";

import { TeamView } from "@/components/admin/cms/team-view";

export const metadata: Metadata = { title: "Team — Axonill Admin" };

export default function Page() {
  return <TeamView />;
}
