import type { Metadata } from "next";
import { ConversionsView } from "@/components/admin/conversions-view";

export const metadata: Metadata = { title: "Leads & Conversions — Axonill Admin" };

export default function Page() {
  return <ConversionsView />;
}
