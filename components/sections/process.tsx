"use client";

import * as React from "react";
import {
  Compass,
  Search,
  PenTool,
  Code2,
  FlaskConical,
  Rocket,
  LifeBuoy,
} from "lucide-react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";

import { cn } from "@/lib/utils";

type Step = {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

// Mirrors the Project.stage enum in DATA_MODEL.md
const STEPS: Step[] = [
  {
    name: "Discover",
    description:
      "We dig into your goals, users, and constraints to frame the real problem.",
    icon: Compass,
  },
  {
    name: "Research",
    description:
      "Market, competitor, and technical research that de-risks the roadmap.",
    icon: Search,
  },
  {
    name: "Design",
    description:
      "Wireframes to polished UI and a design system your product can grow into.",
    icon: PenTool,
  },
  {
    name: "Develop",
    description:
      "Clean, tested, scalable code shipped in tight, visible increments.",
    icon: Code2,
  },
  {
    name: "Test",
    description:
      "Automated and manual QA across devices to catch issues before users do.",
    icon: FlaskConical,
  },
  {
    name: "Deploy",
    description:
      "Smooth, automated releases to production with zero-drama rollouts.",
    icon: Rocket,
  },
  {
    name: "Support",
    description:
      "Monitoring, iteration, and ongoing support to keep you scaling.",
    icon: LifeBuoy,
  },
];

export function Process() {
  const reduce = useReducedMotion();
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Draw the line as the timeline scrolls through the viewport.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.8", "end 0.6"],
  });
  const drawn = useSpring(scrollYProgress, {
    stiffness: 60,
    damping: 20,
    restDelta: 0.001,
  });

  return (
    <section
      id="process"
      className="relative overflow-x-clip py-24 sm:py-32"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium tracking-wider text-brand-secondary uppercase dark:text-blue-400">
            How we work
          </p>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-5xl">
            A development process built for clarity
          </h2>
          <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">
            Seven deliberate steps take your product from a first conversation
            all the way to a scaling, supported release.
          </p>
        </div>

        {/* Timeline */}
        <div ref={containerRef} className="relative mt-16 sm:mt-20">
          {/* Vertical line: static track + animated fill */}
          <div
            aria-hidden
            className="absolute top-0 bottom-0 left-5 w-0.5 -translate-x-1/2 bg-border md:left-1/2"
          >
            <motion.div
              className="h-full w-full origin-top bg-gradient-to-b from-brand-secondary to-accent-cyan"
              style={{ scaleY: reduce ? 1 : drawn }}
            />
          </div>

          <ol className="space-y-10 md:space-y-2">
            {STEPS.map((step, i) => (
              <TimelineStep
                key={step.name}
                step={step}
                index={i}
                isLeft={i % 2 === 0}
                reduce={!!reduce}
              />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function TimelineStep({
  step,
  index,
  isLeft,
  reduce,
}: {
  step: Step;
  index: number;
  isLeft: boolean;
  reduce: boolean;
}) {
  const { name, description, icon: Icon } = step;
  const number = String(index + 1).padStart(2, "0");

  return (
    <li className="relative md:grid md:grid-cols-2 md:items-center md:gap-x-16 md:py-6">
      {/* Node on the line */}
      <motion.div
        aria-hidden
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-90px" }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="absolute top-1 left-5 z-10 -translate-x-1/2 md:top-1/2 md:left-1/2 md:-translate-y-1/2"
      >
        <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-brand-secondary to-accent-cyan text-sm font-bold text-white shadow-lg ring-4 ring-background">
          {number}
        </span>
      </motion.div>

      {/* Content — alternates sides on desktop */}
      <motion.div
        initial={
          reduce
            ? { opacity: 0 }
            : { opacity: 0, x: isLeft ? -24 : 24, y: 8 }
        }
        whileInView={{ opacity: 1, x: 0, y: 0 }}
        viewport={{ once: true, margin: "-90px" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "pl-16 md:pl-0",
          isLeft
            ? "md:col-start-1 md:pr-16 md:text-right"
            : "md:col-start-2 md:pl-16 md:text-left"
        )}
      >
        <div className="rounded-xl border border-border/60 bg-background/60 p-5 backdrop-blur transition-colors hover:border-brand-secondary/40">
          <div
            className={cn(
              "flex items-center gap-2",
              isLeft && "md:flex-row-reverse"
            )}
          >
            <Icon className="size-4 text-brand-secondary" />
            <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Step {number}
            </span>
          </div>
          <h3 className="mt-2 font-heading text-xl font-semibold">{name}</h3>
          <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
            {description}
          </p>
        </div>
      </motion.div>
    </li>
  );
}
