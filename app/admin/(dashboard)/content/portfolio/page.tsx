import type { Metadata } from "next";

import { PortfolioView } from "@/components/admin/cms/portfolio-view";

export const metadata: Metadata = { title: "Portfolio — Axonill Admin" };

export default function Page() {
  return <PortfolioView />;
}
