"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { ScrollReveal } from "@/components/reveal";

import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { PortfolioItem } from "@/lib/data-model";
import { portfolioLiveUrl, portfolioProjectPath } from "@/lib/portfolio-links";
import { fetchJson, useLoader } from "@/lib/use-api";
import { CatalogControls } from "./catalog-controls";
import { ProjectScrollPreview } from "./portfolio-preview";
import layout from "@/components/site-layout.module.css";
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
    <section id="work" aria-labelledby="portfolio-heading" aria-busy={loading} className={`${styles.section} ${layout.section} scroll-mt-16 font-sans`}>
      <div className={layout.content}>
        <ScrollReveal as="header" effect="text" className={layout.header}>
          <p className={`${styles.eyebrow} ${layout.eyebrow}`}>Our work</p>
          <h2 id="portfolio-heading" className={`${layout.title} mt-3 font-heading font-semibold`}>
            Selected <span className={styles.accent}>Projects</span>
          </h2>
          <p className={layout.intro}>
            Explore the websites, applications, and digital experiences we&apos;ve brought to life.
          </p>
        </ScrollReveal>

        <div className={layout.body}>
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
                {visible.map((project, index) => <ProjectCard key={project.id} project={project} index={index} />)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ProjectCard({ project, index }: { project: PortfolioItem; index: number }) {
  const { title, category, description, tags, coverImage } = project;
  const liveUrl = portfolioLiveUrl(project.liveUrl);
  const caseStudy = portfolioProjectPath(project);

  return (
    <ScrollReveal as="li" effect="up" index={index} className={styles.galleryItem}>
      <article className={styles.card}>
        <ProjectScrollPreview key={JSON.stringify([coverImage, project.screenshotImage, category])} project={project} liveUrl={liveUrl} />
        <div className={styles.cardCopy}>
          <p className={styles.category}>{category}</p>
          <h3 className={styles.cardTitle}>{title}</h3>
          {description && <p className={styles.preview}>{description}</p>}
          {tags.length > 0 && <ProjectTags tags={tags.slice(0, 3)} />}
          <div className={styles.actions}>
            {liveUrl && (
              <a className={styles.liveLink} href={liveUrl} target="_blank" rel="noopener noreferrer">
                Live Preview <ArrowUpRight size={15} aria-hidden />
              </a>
            )}
            <Link href={caseStudy} prefetch={false}>View Case Study <ArrowRight size={15} aria-hidden /></Link>
          </div>
        </div>
      </article>
    </ScrollReveal>
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
      {Array.from({ length: PROJECTS_PER_PAGE }, (_, index) => (
        <div key={index} aria-hidden className={styles.galleryItem}>
          <div className={styles.card}>
            <Skeleton className={`${styles.viewport} w-full rounded-none motion-reduce:animate-none`} />
            <div className={styles.cardCopy}>
              <Skeleton className="h-3 w-24 motion-reduce:animate-none" />
              <Skeleton className="h-7 w-3/4 motion-reduce:animate-none" />
              <Skeleton className="h-4 w-5/6 motion-reduce:animate-none" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
