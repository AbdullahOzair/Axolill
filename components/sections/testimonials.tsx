"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Pause, Play, Quote, Star } from "lucide-react";
import { ScrollReveal } from "@/components/reveal";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { Testimonial } from "@/lib/data-model";
import { fetchJson, useLoader } from "@/lib/use-api";
import { mountTestimonialRail } from "./testimonial-rail";
import styles from "./testimonials.module.css";

async function loadTestimonials(): Promise<Testimonial[]> {
  const { testimonials } = await fetchJson<{ testimonials: Testimonial[] }>("/api/testimonials");
  return testimonials.filter((testimonial) => testimonial.published);
}

export function Testimonials() {
  const { data, error, loading, reload } = useLoader<Testimonial[]>(loadTestimonials);

  return (
    <section id="testimonials" aria-labelledby="testimonials-heading" aria-busy={loading} className={`${styles.section} scroll-mt-16 py-14 font-sans sm:py-18`}>
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal as="header" effect="text">
          <p className={styles.eyebrow}>Testimonials</p>
          <h2 id="testimonials-heading" className="mt-3 font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            What our <span className={styles.accent}>clients say</span>
          </h2>
        </ScrollReveal>

        <div className="mt-6">
          {loading && !data ? (
            <div role="status" className={styles.skeleton}>
              <span className="sr-only">Loading testimonials…</span>
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
            <ScrollReveal className={styles.single}><TestimonialCard testimonial={data[0]} /></ScrollReveal>
          ) : (
            <TestimonialCarousel testimonials={data} />
          )}
        </div>
      </div>
    </section>
  );
}

function TestimonialCarousel({ testimonials }: { testimonials: Testimonial[] }) {
  const carousel = React.useRef<HTMLDivElement>(null);
  const viewport = React.useRef<HTMLDivElement>(null);
  const player = React.useRef<ReturnType<typeof mountTestimonialRail>>(undefined);
  const [paused, setPaused] = React.useState(false);
  const viewportId = React.useId();

  React.useLayoutEffect(() => {
    if (!carousel.current || !viewport.current) return;
    const controls = mountTestimonialRail(carousel.current, viewport.current);
    player.current = controls;
    return () => {
      player.current = undefined;
      controls?.dispose();
    };
  }, [testimonials]);

  React.useEffect(() => { player.current?.setPaused(paused); }, [paused, testimonials]);

  return (
    <div ref={carousel} role="group" aria-roledescription="carousel" aria-label="Client testimonials" className={styles.carousel}>
      <div className={styles.controls}>
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
      <div id={viewportId} ref={viewport} className={styles.viewport} data-testimonial-viewport>
        <div className={styles.track}>
          {[0, 1, 2, 3].map((copy) => (
            <ul key={copy} aria-hidden={copy !== 1 || undefined} data-testimonial-group className={styles.group}>
              {testimonials.map((testimonial) => <li key={testimonial.id}><TestimonialCard testimonial={testimonial} /></li>)}
            </ul>
          ))}
        </div>
      </div>
    </div>
  );
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  const { name, role, quote, rating } = testimonial;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <figure className={styles.card}>
      <div className={styles.cardTop}>
        <Quote aria-hidden size={21} className={styles.quoteIcon} />
        <div role="img" aria-label={`Rated ${rating} out of 5 stars`} className={styles.rating}>
          {Array.from({ length: 5 }, (_, index) => <Star key={index} aria-hidden size={14} data-filled={index < rating} />)}
        </div>
      </div>
      <blockquote className={styles.quote}>&ldquo;{quote}&rdquo;</blockquote>
      <figcaption className={styles.author}>
        <Avatar size="sm">
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
