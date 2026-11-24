import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin } from "lucide-react";

import { ProjectScrollPreview } from "@/components/sections/portfolio-preview";
import styles from "@/components/sections/portfolio.module.css";
import { db } from "@/lib/api";
import { portfolioItem } from "@/lib/db/schema";
import { portfolioCaseStudyPath, portfolioIdFromSlug, portfolioLiveUrl, portfolioProjectPath } from "@/lib/portfolio-links";

export const dynamic = "force-dynamic";

const getProject = cache(async (slug: string) => {
  const id = portfolioIdFromSlug(slug);
  if (!id) notFound();
  const [project] = await db().select().from(portfolioItem)
    .where(and(eq(portfolioItem.id, id), eq(portfolioItem.published, true))).limit(1);
  if (!project) notFound();
  return project;
});

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProject((await params).slug);
  return {
    title: `${project.title} | Axonill Portfolio`,
    description: project.description || undefined,
    alternates: { canonical: portfolioProjectPath(project) },
  };
}

export default async function CaseStudyPage({ params }: Props) {
  const project = await getProject((await params).slug);
  const liveUrl = portfolioLiveUrl(project.liveUrl);
  const additional = portfolioCaseStudyPath(project.caseStudyUrl);
  const details = project.caseStudyDetails;

  return (
    <article className={`${styles.section} ${styles.detail} font-sans`} aria-labelledby="case-study-title">
      <div className={styles.content}>
        <Link href="/#work" className={styles.backLink}><ArrowLeft size={17} aria-hidden /> Back to Portfolio</Link>
        <div className={styles.caseLayout}>
          <div className={styles.casePreview}>
            <ProjectScrollPreview project={project} liveUrl={liveUrl} />
          </div>
          <div className={styles.caseCopy}>
            <header className={styles.detailSection}>
              <p className={styles.eyebrow}>{project.category}</p>
              <h1 id="case-study-title" className={styles.caseTitle}>{project.title}</h1>
              {details?.location && <p className={styles.location}><MapPin size={15} aria-hidden />{details.location}</p>}
              {project.tags.length > 0 && <TagList items={project.tags} />}
            </header>

            {project.description && (
              <section className={styles.detailSection}>
                <h2 className={styles.detailLabel}>Project overview</h2>
                <p className={styles.fullDescription}>{project.description}</p>
              </section>
            )}

            {Boolean(details?.highlights?.length) && (
              <section className={styles.detailSection}>
                <h2 className={styles.detailLabel}>Project highlights</h2>
                <ul className={styles.highlights}>
                  {details?.highlights?.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
                </ul>
              </section>
            )}

            {Boolean(details?.technologyStack?.length) && (
              <section className={styles.detailSection}>
                <h2 className={styles.detailLabel}>Technology stack</h2>
                <TagList items={details?.technologyStack ?? []} />
              </section>
            )}

            <div className={styles.actions}>
              {liveUrl && <a className={styles.liveLink} href={liveUrl} target="_blank" rel="noopener noreferrer">View Live Site <ArrowUpRight size={16} aria-hidden /></a>}
              <Link href="/#contact">Start a Similar Project <ArrowRight size={16} aria-hidden /></Link>
              {additional && additional !== portfolioProjectPath(project) && (
                <Link href={additional} prefetch={false}>Additional Case Study <ArrowRight size={16} aria-hidden /></Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function TagList({ items }: { items: string[] }) {
  return <ul className={styles.tags}>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>;
}
