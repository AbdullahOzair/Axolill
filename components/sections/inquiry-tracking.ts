"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { InquiryType } from "@/lib/inquiries";

const CONSENT_KEY = "axonill-inquiry-analytics";
type Event = { event: "viewed"; referral?: string; campaign?: Record<string, string> } |
  { event: "selected"; type: InquiryType } | { event: "started"; type: InquiryType; step: number };

function attribution(): Pick<Extract<Event, { event: "viewed" }>, "referral" | "campaign"> {
  const search = new URLSearchParams(location.search);
  const campaign: Record<string, string> = {};
  for (const key of ["source", "medium", "campaign", "term", "content"]) {
    const value = search.get("utm_" + key);
    if (value && /^[A-Za-z0-9._-]{1,80}$/.test(value)) campaign[key] = value;
  }
  let referral: string | undefined;
  if (document.referrer) {
    const host = new URL(document.referrer).hostname;
    if (host !== location.hostname && /^[a-z0-9.-]{1,253}$/.test(host)) referral = host;
  }
  return { referral, campaign: Object.keys(campaign).length ? campaign : undefined };
}

export function useInquiryTracking(section: RefObject<HTMLElement | null>) {
  const [consent, updateConsent] = useState(false);
  const session = useRef<string | undefined>(undefined);
  const view = useRef<string | undefined>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let saved: string | null = null;
    try { saved = sessionStorage.getItem(CONSENT_KEY); }
    catch { return; }
    if (saved && /^[a-f0-9-]{36}$/.test(saved)) {
      session.current = saved;
      const timer = window.setTimeout(() => updateConsent(true), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const send = useCallback((event: Event) => {
    const target = session.current;
    if (!target) return;
    queue.current = queue.current.catch(() => {}).then(async () => {
      if (session.current !== target) return;
      const response = await fetch("/api/inquiries/events", {
        method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...event, sessionId: target }), signal: AbortSignal.timeout(5000),
      });
      if (!response.ok && event.event === "viewed") view.current = undefined;
    }).catch(() => {
      if (event.event === "viewed") view.current = undefined;
    });
  }, []);

  const trackView = useCallback(() => {
    if (!session.current || view.current === session.current) return;
    view.current = session.current;
    send({ event: "viewed", ...attribution() });
  }, [send]);

  useEffect(() => {
    if (!consent || !section.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        trackView();
        observer.disconnect();
      }
    }, { threshold: 0.18 });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, [consent, section, trackView]);

  return {
    consent,
    setConsent(value: boolean) {
      updateConsent(value);
      if (value) {
        session.current = crypto.randomUUID();
        try { sessionStorage.setItem(CONSENT_KEY, session.current); } catch { /* Page-only consent. */ }
        trackView();
      } else {
        try { sessionStorage.removeItem(CONSENT_KEY); } catch { /* No persisted consent. */ }
        session.current = undefined;
      }
    },
    select(type: InquiryType) { trackView(); send({ event: "selected", type }); },
    step(type: InquiryType, step: number) { send({ event: "started", type, step }); },
    async submissionSession() {
      // Analytics is best-effort and should never block inquiry submission.
      await Promise.race([queue.current, new Promise<void>((resolve) => setTimeout(resolve, 350))]);
      return session.current;
    },
  };
}
