import type { Metadata } from "next";

import { ProjectsView } from "@/components/admin/projects-view";

export const metadata: Metadata = { title: "Projects — Axonill Admin" };

export default function Page() {
  return <ProjectsView />;
}
