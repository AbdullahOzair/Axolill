/** Shared display formatters for the admin + portal screens. */

export const titleCase = (s: string) =>
  s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const fmtMoney = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

/** `<input type="date">` wants YYYY-MM-DD; the API hands back a full ISO stamp. */
export const dateInputValue = (iso: string) => iso.slice(0, 10);

/** Today as YYYY-MM-DD, for date inputs and API date fields. */
export const today = () => new Date().toISOString().slice(0, 10);

export const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
