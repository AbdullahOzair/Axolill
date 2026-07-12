import type { Metadata } from "next";

import { requireUser } from "@/lib/auth";
import { BookCall } from "@/components/portal/book-call";

// Per-user + reads D1 at request time — never prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book a call — Axonill",
  description:
    "Schedule a free 30-minute discovery call with the Axonill team.",
};

export default async function BookPage() {
  await requireUser("/portal/book");

  return <BookCall />;
}
