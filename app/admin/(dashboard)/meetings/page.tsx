import type { Metadata } from "next";

import { MeetingsView } from "@/components/admin/meetings-view";

export const metadata: Metadata = { title: "Meetings — Axonill Admin" };

export default function Page() {
  return <MeetingsView />;
}
