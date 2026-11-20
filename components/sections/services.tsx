"use client";

import * as React from "react";

import { iconFor } from "@/components/icon-map";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { Service } from "@/lib/data-model";
import { fetchJson, useLoader } from "@/lib/use-api";
import { observeBasketDrop } from "./service-basket-drop";
import { enableBasketDrag } from "./service-basket-drag";
import styles from "./services.module.css";

async function loadServices(): Promise<Service[]> {
  const { services } = await fetchJson<{ services: Service[] }>("/api/services");
  return services.filter((service) => service.published);
}

export function Services() {
  const { data, error, loading, reload } = useLoader<Service[]>(loadServices);

  return (
    <section id="services" aria-labelledby="services-heading" aria-busy={loading} className={`${styles.section} scroll-mt-16 py-14 font-sans sm:py-18`}>
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <header className="max-w-2xl">
          <p className={styles.eyebrow}>
            <span aria-hidden />
            What we do
          </p>
          <h2 id="services-heading" className="mt-3 font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            Services built to <span className={styles.titleAccent}>ship and scale</span>
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
            End-to-end product capability under one roof — pick a single service
            or let us take the whole thing from idea to launch.
          </p>
        </header>

        <div className={styles.catalog}>
          {data?.map((service) => (
            <ServiceBasket key={service.id} service={service} Icon={iconFor(service.icon)} />
          ))}
          {loading && !data && <ServicesLoading />}
          {error && <ErrorState message={error} onRetry={reload} className="col-span-full" />}
          {!loading && !error && data?.length === 0 && (
            <EmptyState
              title="No services published yet"
              description="Services added in the admin will appear here once published."
              className="col-span-full"
            />
          )}
        </div>
      </div>
    </section>
  );
}

function ServicesLoading() {
  return (
    <div className={styles.basket} role="status">
      <span className="sr-only">Loading services…</span>
      <div className={styles.basketHeader} aria-hidden>
        <span className={styles.loadingIcon} />
        <span className={styles.loadingTitle} />
      </div>
      <div className={styles.tray} aria-hidden>
        <span className={styles.loadingPill} />
        <span className={styles.loadingPill} />
      </div>
    </div>
  );
}

function ServiceBasket({ service, Icon }: { service: Service; Icon: ReturnType<typeof iconFor> }) {
  const trayRef = React.useRef<HTMLUListElement>(null);
  const played = React.useRef(false);
  const headingId = React.useId();
  const { id, title, summary, items } = service;

  React.useLayoutEffect(() => {
    const tray = trayRef.current;
    if (!tray || !items.length || played.current) return;
    return observeBasketDrop(tray, () => { played.current = true; });
  }, [items]);

  React.useEffect(() => {
    const tray = trayRef.current;
    if (tray && items.length) return enableBasketDrag(tray);
  }, [items]);

  const counts = new Map<string, number>();
  return (
    <article data-service-id={id} aria-labelledby={headingId} className={styles.basket}>
      <header className={styles.basketHeader}>
        <span className={styles.categoryIcon}><Icon aria-hidden size={21} strokeWidth={1.7} /></span>
        <div className={styles.categoryCopy}>
          <h3 id={headingId} className="font-heading text-lg leading-tight font-semibold tracking-tight lg:text-xl">
            <a href="#contact" className={styles.categoryLink}>{title}</a>
          </h3>
          {summary && <p className={styles.summary}>{summary}</p>}
        </div>
      </header>

      {items.length > 0 && (
        <ul ref={trayRef} data-service-tray aria-labelledby={headingId} className={styles.tray}>
          {items.map((label) => {
            const occurrence = (counts.get(label) ?? 0) + 1;
            counts.set(label, occurrence);
            const diameter = Math.max(68, Math.round(26 + Math.sqrt(Array.from(label).length) * 19));
            return (
              <li key={JSON.stringify([label, occurrence])} data-service-pill className={styles.pill}
                style={{ "--ball-diameter": `${diameter}px` } as React.CSSProperties}>
                <div className={styles.pillLabel}>
                  <span>{label}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
