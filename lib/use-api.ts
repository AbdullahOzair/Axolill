"use client";

import * as React from "react";

/** Throwing fetch — surfaces the API's `error` field as the message. */
export async function fetchJson<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

type State<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

/**
 * Runs an async loader on mount, with loading/error state and a reload().
 * `loader` is intentionally not a dependency — pass a stable function.
 */
export function useLoader<T>(loader: () => Promise<T>) {
  const [state, setState] = React.useState<State<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const [nonce, setNonce] = React.useState(0);

  const loaderRef = React.useRef(loader);
  loaderRef.current = loader;

  React.useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    loaderRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            error:
              err instanceof Error ? err.message : "Something went wrong.",
            loading: false,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = React.useCallback(() => setNonce((n) => n + 1), []);
  const setData = React.useCallback(
    (updater: (prev: T) => T) =>
      setState((s) => (s.data ? { ...s, data: updater(s.data) } : s)),
    []
  );

  return { ...state, reload, setData };
}
