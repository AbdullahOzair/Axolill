import { Suspense } from "react";
import type { Metadata } from "next";

import { CalendarSettings } from "@/components/admin/calendar-settings";

export const metadata: Metadata = { title: "Calendar — Axonill Admin" };

export default function Page() {
  // useSearchParams() (for the OAuth callback's ?connected / ?error) needs a
  // Suspense boundary or the whole route opts out of static rendering.
  return (
    <Suspense fallback={null}>
      <CalendarSettings />
    </Suspense>
  );
}
