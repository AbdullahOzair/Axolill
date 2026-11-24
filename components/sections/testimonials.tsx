"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Pause, Play, Quote, Star } from "lucide-react";

import { ScrollReveal } from "@/components/reveal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { Testimonial } from "@/lib/data-model";
import { fetchJson, useLoader } from "@/lib/use-api";
import { mountTestimonialRail } from "./testimonial-rail";
import styles from "./testimonials.module.css";
import layout from "@/components/site-layout.module.css";

async function loadTestimonials(): Promise<Testimonial[]> {
  const { testimonials } = await fetchJson<{ testimonials: Testimonial[] }>("/api/testimonials");
  return testimonials.filter((testimonial) => testimonial.published);
}

export function Testimonials() {
  const { data, error, loading, reload } = useLoader<Testimonial[]>(loadTestimonials);
  const [review, setReview] = React.useState<Testimonial | null>(null);
  const [reading, setReading] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const viewport = React.useRef<HTMLDivElement>(null);
  const player = React.useRef<ReturnType<typeof mountTestimonialRail>>(undefined);
  const opener = React.useRef<HTMLButtonElement>(null);
  const viewportId = React.useId();
  const multiple = !error && (data?.length ?? 0) > 1;

  React.useLayoutEffect(() => {
    const element = viewport.current;
    const section = element?.closest<HTMLElement>("#testimonials");
    if (!multiple || !section || !element) return;
    const controls = mountTestimonialRail(section, element);
    player.current = controls;
    return () => {
      controls?.dispose();
      player.current = undefined;
    };
  }, [data, multiple]);

  React.useLayoutEffect(() => {
    player.current?.setPaused(paused || reading);
  }, [data, multiple, paused, reading]);

  function readReview(testimonial: Testimonial, trigger: HTMLButtonElement) {
    opener.current = trigger;
    setReview(testimonial);
    setReading(true);
  }

  return (
    <section id="testimonials" aria-labelledby="testimonials-heading" aria-busy={loading} className={`${styles.section} ${layout.section} scroll-mt-16 font-sans`}>
      <div className={layout.content}>
        <div className={styles.headingRow}>
          <header className={layout.header}>
            <ScrollReveal effect="fade"><p className={`${styles.eyebrow} ${layout.eyebrow}`}>Client stories</p></ScrollReveal>
            <ScrollReveal effect="up" index={1}>
              <h2 id="testimonials-heading" className={`${layout.title} ${layout.stackedTitle} font-heading font-bold`}>
                Good work speaks.{" "}
                <span className={styles.accent}>Our clients speak louder.</span>
              </h2>
            </ScrollReveal>
            <ScrollReveal effect="up" index={2}>
              <p className={layout.intro}>Real experiences from the people we&apos;ve had the pleasure of building with.</p>
            </ScrollReveal>
          </header>
          {multiple && (
            <div className={styles.controls} role="group" aria-label="Testimonial navigation">
              <button type="button" aria-label="Previous testimonial" aria-controls={viewportId} onClick={() => player.current?.move(-1)}>
                <ChevronLeft aria-hidden size={18} />
              </button>
              <button type="button" aria-label="Next testimonial" aria-controls={viewportId} onClick={() => player.current?.move(1)}>
                <ChevronRight aria-hidden size={18} />
              </button>
              <button
                type="button"
                aria-label={paused ? "Resume automatic scrolling" : "Pause automatic scrolling"}
                aria-controls={viewportId}
                className={styles.playback}
                onClick={() => setPaused((value) => !value)}
              >
                {paused ? <Play aria-hidden size={15} /> : <Pause aria-hidden size={15} />}
              </button>
            </div>
          )}
        </div>

        <div className={layout.body}>
          {loading && !data ? (
            <div role="status" className={styles.skeleton}>
              <span className="sr-only">Loading testimonials</span>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="mt-2 h-10 w-48" />
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : !data?.length ? (
            <EmptyState title="No testimonials yet" description="Client stories will appear here once they're published." />
          ) : data.length === 1 ? (
            <ScrollReveal className={styles.single}><TestimonialCard testimonial={data[0]} onRead={readReview} /></ScrollReveal>
          ) : (
            <TestimonialCarousel
              testimonials={data}
              viewportRef={viewport}
              viewportId={viewportId}
              onRead={readReview}
            />
          )}
        </div>
      </div>
      <Dialog open={reading} onOpenChange={setReading}>
        <DialogContent finalFocus={() => opener.current} className="max-h-[85dvh] overflow-y-auto p-6 motion-reduce:animate-none sm:max-w-xl sm:p-8">
          {review && (
            <>
              <DialogTitle className="pr-8 text-lg">Client story from {review.name}</DialogTitle>
              {review.role && <p className="text-muted-foreground">{review.role}</p>}
              <DialogDescription render={<blockquote />} className={styles.fullQuote}>{review.quote}</DialogDescription>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function TestimonialCarousel({
  testimonials, viewportRef, viewportId, onRead,
}: {
  testimonials: Testimonial[];
  viewportRef: React.RefObject<HTMLDivElement | null>;
  viewportId: string;
  onRead: (testimonial: Testimonial, trigger: HTMLButtonElement) => void;
}) {
  return (
    <ScrollReveal effect="fade" role="group" aria-roledescription="carousel" aria-label="Client testimonials" className={styles.carousel}>
      <div id={viewportId} ref={viewportRef} className={styles.viewport} data-few={testimonials.length === 2 || undefined}>
        <div className={styles.track}>
          {[0, 1, 2, 3].map((copy) => (
            <ul key={copy} aria-hidden={copy !== 1 || undefined} data-testimonial-group className={styles.group}>
              {testimonials.map((testimonial, index) => (
                <li key={testimonial.id} style={{ "--card-delay": `${Math.min(index, 3) * 75}ms` } as React.CSSProperties}>
                  <TestimonialCard testimonial={testimonial} copy={copy !== 1} onRead={onRead} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </ScrollReveal>
  );
}

function TestimonialCard({
  testimonial, copy = false, onRead,
}: {
  testimonial: Testimonial;
  copy?: boolean;
  onRead: (testimonial: Testimonial, trigger: HTMLButtonElement) => void;
}) {
  const { name, role, quote, rating } = testimonial;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const previewRef = React.useRef<HTMLQuoteElement>(null);
  const [hasMore, setHasMore] = React.useState(false);

  React.useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const measure = () => setHasMore(preview.scrollHeight > preview.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(preview);
    document.fonts.addEventListener("loadingdone", measure);
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [quote]);

  return (
    <figure className={styles.card}>
      <div className={styles.cardTop}>
        <Quote aria-hidden size={20} className={styles.quoteIcon} />
        {rating >= 1 && rating <= 5 && (
          <div role="img" aria-label={`Rated ${rating} out of 5 stars`} className={styles.rating}>
            {Array.from({ length: 5 }, (_, index) => <Star key={index} aria-hidden size={13} data-filled={index < rating} />)}
          </div>
        )}
      </div>
      <div>
        <blockquote ref={previewRef} className={styles.quote}>{quote}</blockquote>
        {hasMore && (
          <button type="button" tabIndex={copy ? -1 : undefined} aria-haspopup="dialog" aria-label={`Read more from ${name}`} className={styles.readMore} onClick={(event) => onRead(testimonial, event.currentTarget)}>Read more <ChevronRight size={13} aria-hidden /></button>
        )}
      </div>
      <figcaption className={styles.author}>
        <Avatar size="sm" aria-hidden>
          <AvatarFallback className={styles.initials}>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className={styles.name}>{name}</div>
          {role && <div className={styles.role}>{role}</div>}
        </div>
      </figcaption>
    </figure>
  );
}
