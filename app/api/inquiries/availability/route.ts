import { json } from "@/lib/api";
import { BOOK_CALL_CALLBACK } from "@/lib/booking-intent";

// The existing calendar flow accepts preferred times and confirms them later.
export function GET() {
  return json({ mode: "request", slots: [], bookingHref: BOOK_CALL_CALLBACK, signInRequired: true });
}
