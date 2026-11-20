/** Only return to pages within the appropriate signed-in area. */
export function authRedirect(value: string | null, area: "/admin" | "/portal") {
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
