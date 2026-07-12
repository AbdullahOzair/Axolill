"use client";

import * as React from "react";
import {
  AppWindow,
  BrainCircuit,
  Cloud,
  Database,
  Server,
  Smartphone,
  Wrench,
} from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { fetchJson, useLoader } from "@/lib/use-api";
import {
  TECHNOLOGY_CATEGORIES,
  type Technology,
  type TechnologyCategory,
} from "@/lib/data-model";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

/** Presentation only — the category icon isn't stored in the DB. */
const CATEGORY_ICONS: Record<
  TechnologyCategory,
  React.ComponentType<{ className?: string }>
> = {
  Frontend: AppWindow,
  Backend: Server,
  Databases: Database,
  Mobile: Smartphone,
  AI: BrainCircuit,
  Cloud: Cloud,
  Tools: Wrench,
};

async function loadTechnologies(): Promise<Technology[]> {
  const { technologies } = await fetchJson<{ technologies: Technology[] }>(
    "/api/technologies"
  );
  return technologies.filter((t) => t.published);
}

export function Technologies() {
  const reduce = useReducedMotion();
  const { data, error, loading, reload } =
    useLoader<Technology[]>(loadTechnologies);

  /**
   * The API returns a flat list; the section renders one card per category.
   * Categories with nothing published are dropped entirely.
   */
  const groups = React.useMemo(() => {
    const rows = data ?? [];
    return TECHNOLOGY_CATEGORIES.map((category) => ({
      category,
      items: rows.filter((t) => t.category === category),
    })).filter((g) => g.items.length > 0);
  }, [data]);

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.08 } },
  };
  const item: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <section id="technologies" className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium tracking-wider text-brand-secondary uppercase dark:text-blue-400">
            Our stack
          </p>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-5xl">
            Technologies we build with
          </h2>
          <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">
            A modern, battle-tested toolkit across the whole stack — chosen for
            speed, reliability, and long-term maintainability.
          </p>
        </div>

        {loading ? (
          <GridSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} className="mt-16" />
        ) : groups.length === 0 ? (
          <EmptyState
            title="No technologies published yet"
            description="Technologies added in the admin will appear here once published."
            className="mt-16"
          />
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {groups.map(({ category, items }) => {
              const Icon = CATEGORY_ICONS[category];
              return (
                <motion.div
                  key={category}
                  variants={item}
                  className="rounded-xl border border-border/60 bg-background/60 p-6 backdrop-blur transition-colors hover:border-brand-secondary/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-brand-secondary/10 to-accent-cyan/10 text-brand-secondary ring-1 ring-brand-secondary/15">
                      <Icon className="size-4.5" />
                    </span>
                    <h3 className="font-heading text-lg font-semibold">
                      {category}
                    </h3>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {items.map((tech) => (
                      <Badge
                        key={tech.id}
                        variant="secondary"
                        className="cursor-default rounded-full border border-border/60 bg-secondary/60 px-3 py-1 text-sm font-medium text-secondary-foreground transition-transform duration-200 hover:scale-110 hover:border-brand-secondary/40 hover:text-foreground"
                      >
                        {tech.name}
                      </Badge>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </section>
  );
}

function GridSkeleton() {
  return (
    <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/60 bg-background/60 p-6"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-7 w-20 rounded-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
