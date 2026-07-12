"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { fetchJson, useLoader } from "@/lib/use-api";
import type { Testimonial } from "@/lib/data-model";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Reveal } from "@/components/reveal";

const AUTO_ADVANCE_MS = 6000;

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * The API already hides drafts from anonymous callers, but an *admin* browsing
 * the marketing site gets every row back — so filter here too. The homepage must
 * never surface an unpublished testimonial.
 */
async function loadTestimonials(): Promise<Testimonial[]> {
  const { testimonials } = await fetchJson<{ testimonials: Testimonial[] }>(
    "/api/testimonials"
  );
  return testimonials.filter((t) => t.published);
}

export function Testimonials() {
  const reduce = useReducedMotion();
  const { data, error, loading, reload } =
    useLoader<Testimonial[]>(loadTestimonials);

  const [[index, direction], setState] = React.useState<[number, number]>([
    0, 0,
  ]);
  const [paused, setPaused] = React.useState(false);

  const testimonials = React.useMemo(() => data ?? [], [data]);
  const count = testimonials.length;

  const paginate = React.useCallback(
    (dir: number) => {
      if (count === 0) return; // guard: modulo by zero -> NaN index
      setState(([current]) => [(current + dir + count) % count, dir]);
    },
    [count]
  );

  const goTo = React.useCallback((target: number) => {
    setState(([current]) => [target, target > current ? 1 : -1]);
  }, []);

  // Data can arrive (or shrink) after mount — keep the index in range.
  React.useEffect(() => {
    setState(([current, dir]) =>
      current >= count ? [0, dir] : [current, dir]
    );
  }, [count]);

  // Auto-advance, paused on hover/focus. Disabled entirely under reduced motion.
  React.useEffect(() => {
    if (paused || reduce || count < 2) return;
    const id = window.setInterval(() => paginate(1), AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [paused, reduce, paginate, index, count]);

  const active = testimonials[index];

  const slideVariants = {
    enter: (dir: number) =>
      reduce ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? 64 : -64 },
    center: { opacity: 1, x: 0 },
    exit: (dir: number) =>
      reduce ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? -64 : 64 },
  };

  return (
    <section id="testimonials" className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
        {/* Header */}
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium tracking-wider text-brand-secondary uppercase dark:text-blue-400">
            Testimonials
          </p>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-5xl">
            What our clients say
          </h2>
        </Reveal>

        {loading ? (
          <CarouselSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} className="mt-14" />
        ) : count === 0 || !active ? (
          <EmptyState
            title="No testimonials yet"
            description="Client stories will appear here once they're published."
            className="mt-14"
          />
        ) : (
          /* Carousel — unchanged below this point, only the data source moved. */
          <div
            className="relative mt-14"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
            role="group"
            aria-roledescription="carousel"
            aria-label="Client testimonials"
          >
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/60 px-6 py-10 shadow-sm backdrop-blur sm:px-12 sm:py-14">
              <Quote
                aria-hidden
                className="mx-auto mb-6 size-9 text-brand-secondary/30"
              />

              {/* min-height keeps layout stable across varying quote lengths */}
              <div className="relative min-h-[13rem] sm:min-h-[11rem]">
                <AnimatePresence custom={direction} mode="wait" initial={false}>
                  <motion.figure
                    key={active.id}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      duration: reduce ? 0.25 : 0.4,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="absolute inset-0 flex flex-col items-center text-center"
                    aria-roledescription="slide"
                    aria-label={`${index + 1} of ${count}`}
                  >
                    <div
                      className="mb-5 flex gap-0.5"
                      role="img"
                      aria-label={`Rated ${active.rating} out of 5 stars`}
                    >
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          aria-hidden
                          className={cn(
                            "size-4",
                            i < active.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30"
                          )}
                        />
                      ))}
                    </div>

                    <blockquote className="max-w-2xl font-heading text-lg font-medium text-balance sm:text-xl">
                      &ldquo;{active.quote}&rdquo;
                    </blockquote>

                    <figcaption className="mt-6 flex items-center gap-3">
                      <Avatar size="lg">
                        <AvatarFallback className="bg-gradient-to-br from-brand-secondary to-accent-cyan font-semibold text-white">
                          {initials(active.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <div className="text-sm font-semibold text-foreground">
                          {active.name}
                        </div>
                        {active.role && (
                          <div className="text-xs text-muted-foreground">
                            {active.role}
                          </div>
                        )}
                      </div>
                    </figcaption>
                  </motion.figure>
                </AnimatePresence>
              </div>
            </div>

            {/* Controls — hidden for a single testimonial, there's nowhere to go. */}
            {count > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  aria-label="Previous testimonial"
                  onClick={() => paginate(-1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>

                {/* Dots */}
                <div className="flex items-center gap-2">
                  {testimonials.map((t, i) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => goTo(i)}
                      aria-label={`Go to testimonial ${i + 1}`}
                      aria-current={i === index}
                      className={cn(
                        "h-2 rounded-full outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        i === index
                          ? "w-6 bg-brand-secondary"
                          : "w-2 bg-border hover:bg-muted-foreground/50"
                      )}
                    />
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  aria-label="Next testimonial"
                  onClick={() => paginate(1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Mirrors the carousel card's shape so the layout doesn't jump when data lands. */
function CarouselSkeleton() {
  return (
    <div className="relative mt-14">
      <div className="rounded-2xl border border-border/60 bg-background/60 px-6 py-10 shadow-sm backdrop-blur sm:px-12 sm:py-14">
        <Skeleton className="mx-auto mb-6 size-9 rounded-md" />

        <div className="flex min-h-[13rem] flex-col items-center sm:min-h-[11rem]">
          {/* stars */}
          <div className="mb-5 flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="size-4 rounded-sm" />
            ))}
          </div>

          {/* quote */}
          <div className="w-full max-w-2xl space-y-3">
            <Skeleton className="mx-auto h-6 w-11/12" />
            <Skeleton className="mx-auto h-6 w-10/12" />
            <Skeleton className="mx-auto h-6 w-7/12" />
          </div>

          {/* attribution */}
          <div className="mt-8 flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        </div>
      </div>

      {/* controls */}
      <div className="mt-8 flex items-center justify-center gap-4">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex items-center gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-2 w-2 rounded-full" />
          ))}
        </div>
        <Skeleton className="size-8 rounded-full" />
      </div>
    </div>
  );
}
