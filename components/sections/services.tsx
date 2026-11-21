"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import { gsap } from "gsap";

import { iconFor } from "@/components/icon-map";
import { ScrollReveal } from "@/components/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { Service } from "@/lib/data-model";
import { fetchJson, useLoader } from "@/lib/use-api";
import styles from "./services.module.css";

async function loadServices(): Promise<Service[]> {
  const { services } = await fetchJson<{ services: Service[] }>("/api/services");
  return services.filter((service) => service.published);
}

export function Services() {
  const { data, error, loading, reload } = useLoader(loadServices);

  return (
    <section id="services" aria-labelledby="services-heading" aria-busy={loading} className={`${styles.section} font-sans`}>
      <div className={styles.layout}>
        <div>
          <ScrollReveal as="header" effect="text">
            <p className={styles.eyebrow}>What we do</p>
            <h2 id="services-heading" className={styles.heading}>
              Services built to <span>ship and scale</span>
            </h2>
            <p className={styles.intro}>
              End-to-end product capability under one roof — pick a single service
              or let us take the whole thing from idea to launch.
            </p>
          </ScrollReveal>
          <a href="#service-stack" className={styles.explore}>
            Explore Services <ArrowDownRight aria-hidden size={17} />
          </a>
        </div>

        <div id="service-stack" className={styles.showcase} tabIndex={-1}>
          {loading && !data ? (
            <div className={`${styles.card} ${styles.skeleton}`} role="status">
              <span className="sr-only">Loading services…</span>
              <Skeleton aria-hidden className="size-11" />
              <Skeleton aria-hidden className="h-6 w-2/3" />
              <Skeleton aria-hidden className="h-4 w-full" />
              <Skeleton aria-hidden className="h-4 w-3/4" />
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : data?.length ? (
            <ServiceStack services={data} />
          ) : (
            <EmptyState
              title="No services published yet"
              description="Services added in the admin will appear here once published."
            />
          )}
        </div>
      </div>
    </section>
  );
}

function stackOffset(index: number, active: number, count: number) {
  const distance = (index - active + count) % count;
  return distance > count / 2 ? distance - count : distance;
}

function ServiceStack({ services }: { services: Service[] }) {
  const [selected, setSelected] = useState(0);
  const active = Math.min(selected, services.length - 1);
  const stage = useRef<HTMLUListElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const played = useRef(false);

  useEffect(() => {
    const node = stage.current;
    if (!node || played.current || services.length < 2 || typeof IntersectionObserver === "undefined") return;
    const canAnimate = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    if (!canAnimate.matches) return;

    const cards = Array.from(node.querySelectorAll<HTMLElement>('[data-service-peek="true"]'))
      .sort((left, right) => Number(left.dataset.serviceDepth) - Number(right.dataset.serviceDepth));
    const clear = () => {
      delete node.dataset.forming;
      cards.forEach((card) => card.style.removeProperty("--fan"));
    };
    const timeline = gsap.timeline({ paused: true, onComplete: clear });
    node.dataset.forming = "true";
    gsap.set(cards, { "--fan": 0 });
    timeline.to(cards, {
      "--fan": 1,
      duration: 1,
      ease: "power3.out",
      stagger: 0.1,
    });

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      played.current = true;
      timeline.play();
      observer.disconnect();
    }, { threshold: 0.16 });
    observer.observe(node);

    const onPreferenceChange = () => {
      if (canAnimate.matches) return;
      observer.disconnect();
      timeline.kill();
      clear();
    };
    canAnimate.addEventListener("change", onPreferenceChange);
    return () => {
      observer.disconnect();
      timeline.kill();
      clear();
      canAnimate.removeEventListener("change", onPreferenceChange);
    };
  }, [services.length]);

  function step(direction: number) {
    setSelected((active + direction + services.length) % services.length);
  }

  return (
    <>
      <ul ref={stage} className={styles.stack} aria-label="Service categories">
        {services.map((service, index) => {
          const offset = stackOffset(index, active, services.length);
          return (
            <StackCard
              key={service.id}
              service={service}
              Icon={iconFor(service.icon)}
              offset={offset}
              onSelect={(keyboard) => {
                setSelected(index);
                if (keyboard) controls.current?.focus({ preventScroll: true });
              }}
            />
          );
        })}
      </ul>
      {services.length > 1 && (
        <div ref={controls} className={styles.controls} tabIndex={-1} role="group" aria-label="Browse service cards">
          <span className={styles.position} role="status">
            <span className="sr-only">{services[active].title}, category </span>
            {active + 1} / {services.length}
          </span>
          <button type="button" onClick={() => step(-1)} aria-label="Previous service" className={styles.step}>
            <ArrowLeft aria-hidden size={18} />
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Next service" className={styles.step}>
            <ArrowRight aria-hidden size={18} />
          </button>
        </div>
      )}
    </>
  );
}

function moveSpotlight(event: PointerEvent<HTMLLIElement>) {
  if (event.pointerType !== "mouse") return;
  const { currentTarget } = event;
  const rect = currentTarget.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  const style = currentTarget.style;
  style.setProperty("--spot-x", `${x * 100}%`);
  style.setProperty("--spot-y", `${y * 100}%`);
  style.setProperty("--tilt-x", `${(0.5 - y) * 12}deg`);
  style.setProperty("--tilt-y", `${(x - 0.5) * 12}deg`);
}

function StackCard({ service, Icon, offset, onSelect }: {
  service: Service;
  Icon: ReturnType<typeof iconFor>;
  offset: number;
  onSelect: (keyboard: boolean) => void;
}) {
  const { id, title, summary, items } = service;
  const depth = Math.abs(offset);
  const featured = depth === 0;
  const style = {
    "--side": Math.sign(offset) * (depth > 1 ? 1.7 : depth),
    "--depth": depth,
    "--rest-scale": 1 - Math.min(depth, 2) * 0.045,
    "--layer": featured ? 4 : 3 - depth,
  } as CSSProperties;

  return (
    <li
      className={styles.entry}
      style={style}
      data-service-id={id}
      data-service-front={featured}
      data-service-peek={depth <= 2}
      data-service-depth={depth}
      data-service-side={offset < 0 ? "left" : "right"}
      onPointerMove={moveSpotlight}
    >
      <article className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.icon}><Icon aria-hidden size={22} strokeWidth={1.65} /></span>
          <h3 className={styles.cardTitle}>{title}</h3>
        </div>
        <div className={styles.cardCopy}>
          {summary && <p className={styles.summary}>{summary}</p>}
          {items.length > 0 && (
            <details className={styles.details}>
              <summary>
                View services <ChevronDown aria-hidden size={15} />
              </summary>
              <ul>
                {items.map((label, index) => <li key={`${index}:${label}`}>{label}</li>)}
              </ul>
            </details>
          )}
          <a href="#contact" className={styles.contact}>
            Discuss this service <ArrowUpRight aria-hidden size={15} />
          </a>
        </div>
      </article>
      {!featured && (
        <button type="button" className={styles.select} aria-label={`Show ${title}`}
          onClick={(event) => onSelect(event.detail === 0)}
        >
          <ArrowUpRight aria-hidden size={15} />
        </button>
      )}
    </li>
  );
}
