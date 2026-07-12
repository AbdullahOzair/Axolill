"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import {
  motion,
  useReducedMotion,
  type Variants,
  type Transition,
} from "framer-motion";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  NextjsIcon,
  PythonIcon,
  ReactIcon,
} from "@/components/brand-icons";
import { MagneticButton } from "@/components/magnetic-button";

const HEADLINE_LEAD = "Turning ideas into";
const HEADLINE_ACCENT = "scalable digital products";

type FloatingIcon = {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  className: string; // positioning
  color: string; // icon color
  drift: { x: number[]; y: number[]; duration: number; delay: number };
};

const FLOATING_ICONS: FloatingIcon[] = [
  {
    label: "React",
    Icon: ReactIcon,
    className: "left-[6%] top-[24%] sm:left-[10%]",
    color: "text-[#61DAFB]",
    drift: { x: [0, 8, 0], y: [0, -16, 0], duration: 7, delay: 0 },
  },
  {
    label: "Next.js",
    Icon: NextjsIcon,
    className: "right-[8%] top-[18%] sm:right-[14%]",
    color: "text-foreground",
    drift: { x: [0, -10, 0], y: [0, 14, 0], duration: 8.5, delay: 0.6 },
  },
  {
    label: "Python",
    Icon: PythonIcon,
    className: "left-[12%] bottom-[16%] sm:left-[18%]",
    color: "text-[#3776AB] dark:text-[#4B8BBE]",
    drift: { x: [0, 12, 0], y: [0, 12, 0], duration: 9, delay: 1.1 },
  },
  {
    label: "AI",
    Icon: ({ className }) => <Sparkles className={className} />,
    className: "right-[10%] bottom-[22%] sm:right-[16%]",
    color: "text-accent-cyan",
    drift: { x: [0, -8, 0], y: [0, -12, 0], duration: 7.8, delay: 0.3 },
  },
];

export function Hero() {
  const reduce = useReducedMotion();
  const sectionRef = React.useRef<HTMLElement>(null);

  // Parallax: update CSS vars on mousemove via rAF — no state updates.
  React.useEffect(() => {
    if (reduce) return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse) return;

    let rafId: number;
    const el = sectionRef.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        // Normalised offset from center: -1 → +1
        const nx = (e.clientX - rect.left) / rect.width - 0.5;
        const ny = (e.clientY - rect.top) / rect.height - 0.5;

        // Drive each parallax blob wrapper
        el.querySelectorAll<HTMLElement>("[data-parallax-x]").forEach((node) => {
          const fx = parseFloat(node.dataset.parallaxX ?? "0");
          const fy = parseFloat(node.dataset.parallaxY ?? "0");
          const tx = nx * window.innerWidth * fx;
          const ty = ny * window.innerHeight * fy;
          node.style.transform = `translate3d(${tx}px,${ty}px,0)`;
        });
      });
    };

    el.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      el.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafId);
    };
  }, [reduce]);


  // Entrance variants — collapse to a plain fade (no travel) when reduced motion.
  const container: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduce ? 0 : 0.08,
        delayChildren: reduce ? 0 : 0.1,
      },
    },
  };

  const item: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 18 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduce ? 0.3 : 0.55, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative isolate overflow-hidden"
      aria-labelledby="hero-heading"
    >
      <HeroBackground reduce={!!reduce} />
      <FloatingIcons reduce={!!reduce} />

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center"
        >
          <motion.div variants={item}>
            <Badge
              variant="secondary"
              className="mb-6 gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 backdrop-blur"
            >
              <Sparkles className="size-3.5 text-accent-cyan" />
              <span className="text-xs font-medium">
                Digital product studio
              </span>
            </Badge>
          </motion.div>

          <motion.h1
            id="hero-heading"
            variants={item}
            className="max-w-4xl font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl lg:text-7xl"
          >
            {HEADLINE_LEAD}{" "}
            <span className="bg-gradient-to-r from-brand-secondary via-accent-cyan to-brand-secondary bg-clip-text text-transparent">
              {HEADLINE_ACCENT}
            </span>
            .
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-6 max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg"
          >
            Axonill partners with founders and teams to design, build, and ship
            premium software — from first sketch to production scale — with
            strategy, design, and engineering under one roof.
          </motion.p>

          <motion.div
            variants={item}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
          >
            {/* Primary — gradient reveal on hover + magnetic pull */}
            <MagneticButton strength={8}>
              <Link
                href="#contact"
                className="group relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 hover:shadow-md hover:shadow-brand-secondary/25 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-brand-secondary to-accent-cyan opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="relative z-10 flex items-center gap-2">
                  Book a Free Call
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </span>
              </Link>
            </MagneticButton>

            {/* Secondary — outline + magnetic pull */}
            <MagneticButton strength={8}>
              <Link
                href="#work"
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background/60 px-6 text-sm font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Play className="size-4 text-brand-secondary transition-transform duration-300 group-hover:scale-110" />
                See Our Work
              </Link>
            </MagneticButton>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/** Grid + slowly morphing gradient-mesh blobs with mouse-parallax. */
function HeroBackground({ reduce }: { reduce: boolean }) {
  const blobTransition = (duration: number): Transition => ({
    duration,
    repeat: Infinity,
    repeatType: "mirror",
    ease: "easeInOut",
  });

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {/* Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,black,transparent)] dark:opacity-30" />

      {/*
        Parallax wrapper pattern:
        - Each blob lives inside a <div data-parallax-x data-parallax-y>.
        - The Hero mousemove listener queries [data-parallax-x] and updates
          their translateX/Y directly, no React state, no re-render.
        - Framer Motion handles the slow organic drift on the inner blob div.
      */}

      {/* Blob 1 — blue/secondary, top-left */}
      <div
        data-parallax-x="-0.04"
        data-parallax-y="-0.03"
        className="absolute -top-24 left-1/4 will-change-transform"
        style={{ transition: reduce ? undefined : "transform 0.15s linear" }}
      >
        <motion.div
          className="size-[36rem] rounded-full bg-brand-secondary/25 blur-3xl dark:bg-brand-secondary/20"
          animate={
            reduce ? undefined : { x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.1, 0.95, 1] }
          }
          transition={reduce ? undefined : blobTransition(18)}
        />
      </div>

      {/* Blob 2 — cyan, top-right */}
      <div
        data-parallax-x="0.035"
        data-parallax-y="0.025"
        className="absolute top-10 right-1/4 will-change-transform"
        style={{ transition: reduce ? undefined : "transform 0.15s linear" }}
      >
        <motion.div
          className="size-[30rem] rounded-full bg-accent-cyan/25 blur-3xl dark:bg-accent-cyan/15"
          animate={
            reduce ? undefined : { x: [0, -30, 25, 0], y: [0, 25, -15, 0], scale: [1, 0.95, 1.1, 1] }
          }
          transition={reduce ? undefined : blobTransition(22)}
        />
      </div>

      {/* Blob 3 — green/success, bottom */}
      <div
        data-parallax-x="0.02"
        data-parallax-y="-0.025"
        className="absolute bottom-0 left-1/3 will-change-transform"
        style={{ transition: reduce ? undefined : "transform 0.15s linear" }}
      >
        <motion.div
          className="size-[26rem] rounded-full bg-brand-success/15 blur-3xl"
          animate={
            reduce ? undefined : { x: [0, 20, -25, 0], y: [0, -20, 15, 0], scale: [1, 1.08, 0.9, 1] }
          }
          transition={reduce ? undefined : blobTransition(20)}
        />
      </div>
    </div>
  );
}


/** Glassy floating tech-icon cards drifting slowly. */
function FloatingIcons({ reduce }: { reduce: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden md:block">
      {FLOATING_ICONS.map(({ label, Icon, className, color, drift }) => (
        <motion.div
          key={label}
          className={cn("absolute", className)}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: reduce ? 0 : 0.4 + drift.delay }}
        >
          <motion.div
            className="grid size-14 place-items-center rounded-2xl border border-border/60 bg-background/50 shadow-lg backdrop-blur-md lg:size-16"
            animate={
              reduce
                ? undefined
                : { x: drift.x, y: drift.y }
            }
            transition={
              reduce
                ? undefined
                : {
                    duration: drift.duration,
                    delay: drift.delay,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut",
                  }
            }
          >
            <Icon className={cn("size-7 lg:size-8", color)} />
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}
