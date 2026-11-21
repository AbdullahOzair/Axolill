"use client";

import { ScrollReveal } from "@/components/reveal";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import type { Technology } from "@/lib/data-model";
import { fetchJson, useLoader } from "@/lib/use-api";
import styles from "./technologies.module.css";

async function loadTechnologies(): Promise<Technology[]> {
  const { technologies } = await fetchJson<{ technologies: Technology[] }>("/api/technologies");
  return technologies.filter((technology) => technology.published);
}

export function Technologies() {
  const { data, error, loading, reload } = useLoader(loadTechnologies);

  return (
    <section
      id="technologies"
      aria-labelledby="technologies-heading"
      aria-busy={loading}
      className={`${styles.section} scroll-mt-16 py-12 font-sans sm:py-16`}
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal as="header" effect="text" className="max-w-2xl">
          <p className={styles.eyebrow}>Our stack</p>
          <h2 id="technologies-heading" className="mt-2.5 font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl">
            Technologies <span className={styles.accent}>we build with</span>
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
            A modern, battle-tested toolkit across the whole stack — chosen for
            speed, reliability, and long-term maintainability.
          </p>
        </ScrollReveal>

        <div className="mt-5 sm:mt-6">
          {loading && !data ? (
            <StackSkeleton />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : !data?.length ? (
            <EmptyState
              title="No technologies published yet"
              description="Technologies added in the admin will appear here once published."
            />
          ) : (
            <StackGrid technologies={data} />
          )}
        </div>
      </div>
    </section>
  );
}

function StackGrid({ technologies }: { technologies: Technology[] }) {
  return (
    <ul aria-label="Technologies" className={styles.grid}>
      {technologies.map(({ id, name }, index) => {
        // Technology records expose a name, so generate an icon for every CMS entry.
        const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
        const [first = "", second] = words;
        const initials = second ? [...first][0] + [...second][0] : [...first].slice(0, 2).join("");

        return (
          <ScrollReveal as="li" key={id} className={styles.item} index={index % 5}>
            <div className={styles.card}>
              <span className={styles.icon} aria-hidden="true">{initials || "◇"}</span>
              <span className={styles.name}>{name}</span>
            </div>
          </ScrollReveal>
        );
      })}
    </ul>
  );
}

function StackSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Loading technologies…</span>
      <div aria-hidden="true" className={styles.grid}>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className={styles.placeholder}>
            <Skeleton className="size-9 rounded-lg motion-reduce:animate-none" />
            <Skeleton className="h-3 w-16 max-w-full motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  );
}
