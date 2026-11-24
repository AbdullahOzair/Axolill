import type { Metadata } from "next";

import { CreativeOrbitView } from "@/components/admin/cms/creative-orbit-view";

export const metadata: Metadata = { title: "Creative Orbit | Axonill Admin" };

export default function Page() {
  return <CreativeOrbitView />;
}
