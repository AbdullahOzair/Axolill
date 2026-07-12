import type { Metadata } from "next";

import { TestimonialsView } from "@/components/admin/cms/testimonials-view";

export const metadata: Metadata = { title: "Testimonials — Axonill Admin" };

export default function Page() {
  return <TestimonialsView />;
}
