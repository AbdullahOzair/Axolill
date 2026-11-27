"use client";
import { useState, type ReactNode } from "react";

export const adminQuotePath = "/admin/quotations";
export const quoteApi = "/api/admin/quotations";

export async function requestQuote<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, { method, cache: "no-store", ...(body === undefined ? {} : {
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }) });
  const result = await response.json() as { error?: string; details?: { path?: (string|number)[]; message: string }[] };
  if (!response.ok) {
    const problem = Array.isArray(result.details) ? result.details[0] : undefined;
    const prefix = problem?.path?.length ? problem.path.map(String).join(" / ") + " · " : "";
    throw new Error(problem ? prefix + problem.message : result.error ?? "The request failed.");
  }
  return result as T;
}

export const errorText = (error: unknown) => error instanceof Error ? error.message : "Something went wrong.";
export const stamp = (timestamp: number) => new Intl.DateTimeFormat("en", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi",
}).format(timestamp * 1000);

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="quote-field"><span>{label}</span>{children}</label>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="quote-panel"><h2>{title}</h2>{children}</section>;
}

export function Decimal({ value, digits = 2, max = 99_999_999_999, onChange }: {
  value: number; digits?: number; max?: number; onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const scale = 10 ** digits;
  const rendered = (value / scale).toFixed(digits);
  return <input inputMode={digits ? "decimal" : "numeric"} value={editing ?? rendered}
    onFocus={event => { setEditing(rendered); event.currentTarget.select(); }}
    onBlur={() => setEditing(null)}
    onChange={event => {
      const raw = event.currentTarget.value;
      const [whole, fraction = ""] = raw.split(".");
      if (!/^\d*(\.\d*)?$/.test(raw) || fraction.length > digits || (digits === 0 && raw.includes("."))) return;
      const amount = Number((whole || "0") + fraction.padEnd(digits, "0"));
      if (!Number.isSafeInteger(amount) || amount > max) return;
      setEditing(raw); onChange(amount);
    }} />;
}

export function QuoteErrorMessage({ value }: { value: string }) {
  return value ? <p className="quote-error" role="alert">{value}</p> : null;
}
