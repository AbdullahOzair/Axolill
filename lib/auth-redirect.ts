import { BOOK_CALL_CALLBACK } from "./booking-intent";

/** Only return to the signed-in area or the fixed public booking callback. */
export function authRedirect(value: string | null, area: "/admin" | "/portal") {
  if (area === "/portal" && value === BOOK_CALL_CALLBACK) return BOOK_CALL_CALLBACK;
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) {
    return area;
  }

  const base = "https://internal.invalid";
  const destination = new URL(value, base);
  if (
    destination.origin !== base ||
    (destination.pathname !== area && !destination.pathname.startsWith(`${area}/`)) ||
    destination.pathname === "/admin/login"
  ) {
    return area;
  }
  return destination.pathname + destination.search + destination.hash;
}
