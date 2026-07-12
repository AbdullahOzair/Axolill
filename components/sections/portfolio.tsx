"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { fetchJson, useLoader } from "@/lib/use-api";
import type { PortfolioItem } from "@/lib/data-model";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Reveal } from "@/components/reveal";
import { TiltCard } from "@/components/tilt-card";

/** Canonical tab order; any extra category from the CMS is appended. */
const KNOWN_CATEGORIES = [
  "Web Development",
  "Mobile Apps",
  "UI/UX",
  "AI Solutions",
  "Machine Learning",
  "Dashboards",
  "Data Analytics",
];

async function loadPortfolio(): Promise<PortfolioItem[]> {
  const { portfolio } = await fetchJson<{ portfolio: PortfolioItem[] }>(
    "/api/portfolio"
  );
  return portfolio.filter((p) => p.published);
}

export function Portfolio() {
  const reduce = useReducedMotion();
  const { data, error, loading, reload } =
    useLoader<PortfolioItem[]>(loadPortfolio);
  const projects = React.useMemo(() => data ?? [], [data]);

  const [active, setActive] = React.useState<string>("All");

  /** Tabs come from the data — a filter with nothing behind it is dead UI. */
  const filters = React.useMemo(() => {
    const present = new Set(projects.map((p) => p.category));
    const ordered = KNOWN_CATEGORIES.filter((c) => present.has(c));
    const extras = [...present].filter((c) => !KNOWN_CATEGORIES.includes(c));
    return ["All", ...ordered, ...extras];
  }, [projects]);

  // The active tab can disappear when content changes.
  React.useEffect(() => {
    if (!filters.includes(active)) setActive("All");
  }, [filters, active]);

  const visible =
    active === "All"
      ? projects
      : projects.filter((p) => p.category === active);

  return (
    <section id="work" className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium tracking-wider text-brand-secondary uppercase dark:text-blue-400">
            Our work
          </p>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-5xl">
            Selected projects
          </h2>
          <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">
            A cross-section of what we&apos;ve shipped — filter by the kind of
            work you&apos;re looking for.
          </p>
        </Reveal>

        {loading ? (
          <GridSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} className="mt-12" />
        ) : projects.length === 0 ? (
          <EmptyState
            title="No projects published yet"
            description="Work added in the admin will appear here once published."
            className="mt-12"
          />
        ) : (
          <>
            {/* Filter tabs */}
            <Tabs
              value={active}
              onValueChange={(v) => setActive(v as string)}
              className="mt-10 items-center"
            >
              <div className="w-full max-w-full overflow-x-auto pb-1">
                <TabsList className="mx-auto h-auto flex-wrap justify-center gap-1">
                  {filters.map((filter) => (
                    <TabsTrigger
                      key={filter}
                      value={filter}
                      className="h-8 flex-none px-3"
                    >
                      {filter}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>

            {/* Animated grid */}
            <motion.div
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {visible.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    reduce={!!reduce}
                  />
                ))}
              </AnimatePresence>
            </motion.div>

            {visible.length === 0 && (
              <p className="mt-12 text-center text-sm text-muted-foreground">
                No projects in this category yet — check back soon.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function ProjectCard({
  project,
  reduce,
}: {
  project: PortfolioItem;
  reduce: boolean;
}) {
  const { title, category, description, tags, coverImage } = project;

  return (
    <motion.div
      layout={!reduce}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <TiltCard maxTilt={6}>
        <Card className="group h-full gap-0 overflow-hidden border-border/60 bg-background/60 pt-0 backdrop-blur transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-secondary/40 hover:shadow-xl hover:shadow-brand-secondary/10">
          {/* Cover image if one was uploaded; otherwise the gradient band. */}
          <div className="relative h-32 overflow-hidden bg-gradient-to-br from-brand-secondary/15 via-accent-cyan/10 to-brand-success/10">
            {coverImage ? (
              <Image
                src={`/api/media/${coverImage}`}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklch,var(--color-brand-secondary)_25%,transparent),transparent_55%)]" />
            )}

            <span className="absolute top-3 left-3">
              <Badge className="rounded-full bg-background/80 text-foreground backdrop-blur">
                {category}
              </Badge>
            </span>
            <ArrowUpRight className="absolute right-3 bottom-3 size-5 text-foreground/40 transition-all duration-300 group-hover:right-2.5 group-hover:bottom-2.5 group-hover:text-brand-secondary" />
          </div>

          <CardHeader className="pt-5">
            <CardTitle className="font-heading text-lg">{title}</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col">
            {description && (
              <p className="text-sm text-pretty text-muted-foreground">
                {description}
              </p>
            )}
            {tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className={cn(
                      "rounded-full border border-border/60 bg-secondary/60 px-2.5 py-0.5 text-xs font-medium",
                      "text-muted-foreground"
                    )}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TiltCard>
    </motion.div>
  );
}

function GridSkeleton() {
  return (
    <>
      <div className="mt-10 flex flex-wrap justify-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-md" />
        ))}
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-border/60 bg-background/60"
          >
            <Skeleton className="h-32 w-full rounded-none" />
            <div className="p-6">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-1.5 h-4 w-4/5" />
              <div className="mt-4 flex gap-1.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
