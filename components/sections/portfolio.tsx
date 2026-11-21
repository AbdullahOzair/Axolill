"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowUpRight, PanelsTopLeft, X } from "lucide-react";
import { ScrollReveal } from "@/components/reveal";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { PortfolioItem } from "@/lib/data-model";
import { fetchJson, useLoader } from "@/lib/use-api";
import { CatalogControls } from "./catalog-controls";
import styles from "./portfolio.module.css";

/** Keep the existing filter order and append any new CMS categories. */
const KNOWN_CATEGORIES = [
  "Web Development",
  "Mobile Apps",
  "UI/UX",
  "AI Solutions",
  "Machine Learning",
  "Dashboards",
  "Data Analytics",
];
const PROJECTS_PER_PAGE = 3;

async function loadPortfolio(): Promise<PortfolioItem[]> {
  const { portfolio } = await fetchJson<{ portfolio: PortfolioItem[] }>("/api/portfolio");
  return portfolio.filter((project) => project.published);
}

export function Portfolio() {
  const { data, error, loading, reload } = useLoader<PortfolioItem[]>(loadPortfolio);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(0);
  const projects = data ?? [];

  const present = new Set(projects.map(({ category }) => category));
  const filters = [
    ...KNOWN_CATEGORIES.filter((category) => present.has(category)),
    ...Array.from(present).filter((category) => !KNOWN_CATEGORIES.includes(category)),
  ];
  const active = selected !== null && present.has(selected) ? selected : null;
  const matching = active === null ? projects : projects.filter((project) => project.category === active);
  const pageCount = Math.ceil(matching.length / PROJECTS_PER_PAGE);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const visible = matching.slice(currentPage * PROJECTS_PER_PAGE, (currentPage + 1) * PROJECTS_PER_PAGE);

  return (
    <section id="work" aria-labelledby="portfolio-heading" aria-busy={loading} className={`${styles.section} scroll-mt-16 py-14 font-sans sm:py-18`}>
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal as="header" effect="text" className="max-w-2xl">
          <p className={styles.eyebrow}>Our work</p>
          <h2 id="portfolio-heading" className="mt-3 font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            Selected <span className={styles.accent}>projects</span>
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
            A cross-section of what we&apos;ve shipped. Explore the work by category.
          </p>
        </ScrollReveal>

        <div className="mt-7">
          {loading && !data ? (
            <GridSkeleton />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : !projects.length ? (
            <EmptyState title="No projects published yet" description="Work added in the admin will appear here once published." />
          ) : (
            <div className="grid gap-3">
              <CatalogControls
                filter={filters.length > 1 ? {
                  label: "Filter projects by category",
                  allLabel: "All projects",
                  categories: filters,
                  selected: active,
                  onChange: (category) => { setSelected(category); setPage(0); },
                } : undefined}
                label="Project pages"
                page={currentPage}
                pageCount={pageCount}
                onPageChange={setPage}
              />
              <ul className={styles.gallery}>
                {visible.map((project, index) => <ProjectCard key={project.id} project={project} lead={matching.length === 1} index={index} />)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ProjectCard({ project, lead, index }: { project: PortfolioItem; lead: boolean; index: number }) {
  const { title, category, description, tags, coverImage } = project;

  return (
    <ScrollReveal as="li" effect="scale" index={index} className={styles.galleryItem} data-lead={lead || undefined}>
      <Dialog>
        <article className={styles.card}>
          <ProjectCover key={coverImage} cover={coverImage} />
          <div className={styles.cardCopy}>
            <p className={styles.category}>{category}</p>
            <h3 className={styles.cardTitle}>{title}</h3>
            {description && <p className={styles.preview}>{description}</p>}
            {tags.length > 0 && <ProjectTags tags={tags.slice(0, 3)} />}
            <span aria-hidden className={styles.viewProject}>View project <ArrowUpRight size={16} /></span>
          </div>
          <DialogTrigger type="button" aria-label={`View project: ${title}`} className={styles.trigger} />
        </article>

        <DialogContent
          showCloseButton={false}
          className={`${styles.detail} z-[60] flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl motion-reduce:animate-none!`}
        >
          <div className={styles.detailHeader}>
            <div className="min-w-0">
              <p className={styles.category}>{category}</p>
              <DialogTitle className={styles.detailTitle}>{title}</DialogTitle>
            </div>
            <DialogClose type="button" aria-label="Close project" className={styles.close}>
              <X aria-hidden size={20} />
            </DialogClose>
          </div>

          <div className={styles.detailBody}>
            {coverImage && <ProjectCover key={coverImage} cover={coverImage} expanded alt={`${title} project cover`} />}

            {description && (
              <div className={styles.detailSection}>
                <h3 className={styles.detailLabel}>Overview</h3>
                <DialogDescription className={styles.fullDescription}>{description}</DialogDescription>
              </div>
            )}

            {tags.length > 0 && (
              <div className={styles.detailSection}>
                <h3 className={styles.detailLabel}>Project tags</h3>
                <ProjectTags tags={tags} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ScrollReveal>
  );
}

function ProjectCover({ cover, alt = "", expanded = false }: {
  cover: PortfolioItem["coverImage"];
  alt?: string;
  expanded?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  if (expanded && failed) return null;

  return (
    <div className={expanded ? styles.expandedCover : styles.cover}>
      {cover && !failed ? (
        <Image
          src={`/api/media/${cover}`}
          alt={alt}
          fill
          sizes={expanded ? "(max-width: 640px) 100vw, 896px" : "(max-width: 640px) 100vw, 550px"}
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <div aria-hidden className={styles.coverFallback}>
          <span><PanelsTopLeft size={36} strokeWidth={1.25} /></span>
        </div>
      )}
    </div>
  );
}

function ProjectTags({ tags }: { tags: string[] }) {
  return (
    <ul className={styles.tags}>
      {tags.map((tag, index) => <li key={`${index}-${tag}`}>{tag}</li>)}
    </ul>
  );
}

function GridSkeleton() {
  return (
    <div role="status" className={styles.gallery}>
      <span className="sr-only">Loading projects…</span>
      <div aria-hidden className={styles.galleryItem} data-lead>
        <div className={styles.card}>
          <Skeleton className="min-h-48 w-full rounded-none" />
          <div className={styles.cardCopy}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    </div>
  );
}
