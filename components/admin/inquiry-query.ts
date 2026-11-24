"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/use-api";

export function useInquiryQuery<T>(url: string, revision = 0) {
  const key = url + "|" + revision;
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    fetchJson<T>(url, { signal: controller.signal })
      .then((data) => setResult({ key, data }))
      .catch((error: Error) => { if (!controller.signal.aborted) setResult({ key, error: error.message }); });
    return () => controller.abort();
  }, [url, key]);
  return result?.key === key ? result : undefined;
}

export function inquiryMutation<T = { ok: boolean }>(url: string, body: unknown, method = "PATCH") {
  return fetchJson<T>(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
