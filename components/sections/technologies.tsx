"use client";

import * as React from "react";
import {
  AppWindow,
  BrainCircuit,
  Cloud,
  Database,
  type LucideIcon,
  Server,
  Smartphone,
  Wrench,
} from "lucide-react";

import { EmptyState, ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TECHNOLOGY_CATEGORIES,
  type Technology,
  type TechnologyCategory,
} from "@/lib/data-model";
import { fetchJson, useLoader } from "@/lib/use-api";
import { CatalogControls } from "./catalog-controls";
import styles from "./technologies.module.css";

/** The category icons are a presentation choice, independent of CMS records. */
const CATEGORY_ICONS = {
  Frontend: AppWindow,
  Backend: Server,
  Databases: Database,
  Mobile: Smartphone,
  AI: BrainCircuit,
  Cloud: Cloud,
  Tools: Wrench,
} satisfies Record<TechnologyCategory, LucideIcon>;

const TECHNOLOGIES_PER_PAGE = 8;

async function loadTechnologies(): Promise<Technology[]> {
  const { technologies } = await fetchJson<{ technologies: Technology[] }>("/api/technologies");
  return technologies.filter((technology) => technology.published);
}

export function Technologies() {
  const { data, error, loading, reload } = useLoader<Technology[]>(loadTechnologies);
  const [selected, setSelected] = React.useState<TechnologyCategory | null>(null);
  const [page, setPage] = React.useState(0);

  const groups = React.useMemo(() => TECHNOLOGY_CATEGORIES.map((category) => ({
    category,
    items: (data ?? []).filter((technology) => technology.category === category),
  })).filter(({ items }) => items.length > 0), [data]);
  const active = groups.length > 1 && groups.some(({ category }) => category === selected) ? selected : null;
  const matching = active ? groups.filter(({ category }) => category === active) : groups;
  const pages = matching.flatMap(({ category, items }) =>
    Array.from({ length: Math.ceil(items.length / TECHNOLOGIES_PER_PAGE) }, (_, index) => ({
      category,
      items: items.slice(index * TECHNOLOGIES_PER_PAGE, (index + 1) * TECHNOLOGIES_PER_PAGE),
    })),
  );
  const currentPage = Math.min(page, Math.max(0, pages.length - 1));
  const visible = pages[currentPage];

  return (
    <section
      id="technologies"
      aria-labelledby="technologies-heading"
      aria-busy={loading}
      className={`${styles.section} scroll-mt-16 py-14 font-sans sm:py-18`}
    >
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <header className="max-w-2xl">
          <p className={styles.eyebrow}>Our stack</p>
          <h2 id="technologies-heading" className="mt-3 font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            Technologies <span className={styles.accent}>we build with</span>
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
            A modern, battle-tested toolkit across the whole stack — chosen for
            speed, reliability, and long-term maintainability.
          </p>
        </header>

        <div className="mt-7">
          {loading && !data ? (
            <StackSkeleton />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : !visible ? (
            <EmptyState
              title="No technologies published yet"
              description="Technologies added in the admin will appear here once published."
            />
          ) : (
            <div className={styles.catalog}>
              {(groups.length > 1 || pages.length > 1) && (
                <div className={styles.toolbar}>
                  <CatalogControls
                    filter={groups.length > 1 ? {
                      label: "Filter technologies by category",
                      allLabel: "All technologies",
                      categories: groups.map(({ category }) => category),
                      selected: active,
                      onChange: (category) => {
                        setSelected(groups.find((group) => group.category === category)?.category ?? null);
                        setPage(0);
                      },
                    } : undefined}
                    label="Technology pages"
                    page={currentPage}
                    pageCount={pages.length}
                    onPageChange={setPage}
                  />
                </div>
              )}
              <div className={styles.rows}>
                <StackRow key={visible.category} category={visible.category} items={visible.items} />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StackRow({ category, items }: { category: TechnologyCategory; items: Technology[] }) {
  const Icon = CATEGORY_ICONS[category];
  const id = React.useId();
  return (
    <div className={styles.row} data-stack-category={category}>
      <div className={styles.category}>
        <span className={styles.categoryIcon}><Icon aria-hidden size={19} strokeWidth={1.7} /></span>
        <h3 id={id} className="min-w-0 font-heading text-base font-semibold tracking-tight">{category}</h3>
      </div>
      <ul aria-labelledby={id} className={styles.tools}>
        {items.map(({ id, name }) => (
          <li key={id} className={styles.tool}>
            <span aria-hidden className={styles.toolMark} />
            <span className={styles.toolName}>{name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StackSkeleton() {
  return (
    <div role="status" className={styles.catalog}>
      <span className="sr-only">Loading technologies…</span>
      <div aria-hidden className={styles.row}>
        <div className={styles.category}>
          <Skeleton className={styles.categoryIcon} />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className={styles.tools}>
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
