"use client";

import * as React from "react";
import { Building2, Clock, Rocket, Star, Target } from "lucide-react";
import {
  animate,
  motion,
  useInView,
  useReducedMotion,
  type Variants,
} from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";

type Stat = {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  icon: React.ComponentType<{ className?: string }>;
};

const STATS: Stat[] = [
  { label: "Projects delivered", value: 120, suffix: "+", icon: Rocket },
  { label: "Industries served", value: 15, suffix: "+", icon: Building2 },
  { label: "Avg. delivery time", value: 6, suffix: " wks", icon: Clock },
  { label: "Client satisfaction", value: 98, suffix: "%", icon: Star },
];

function formatValue(v: number, decimals = 0) {
  const n = decimals > 0 ? Number(v.toFixed(decimals)) : Math.round(v);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function StatCounter({ stat, index }: { stat: Stat; index: number }) {
  const { value, suffix, decimals = 0, label, icon: Icon } = stat;
  const numberRef = React.useRef<HTMLSpanElement>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();

  React.useEffect(() => {
    if (!inView || !numberRef.current) return;

    if (reduce) {
      numberRef.current.textContent = formatValue(value, decimals);
      return;
    }

    const controls = animate(0, value, {
      duration: 1.8,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        if (numberRef.current) {
          numberRef.current.textContent = formatValue(latest, decimals);
        }
      },
    });
    return () => controls.stop();
  }, [inView, value, decimals, reduce]);

  return (
    <motion.div
      ref={cardRef}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="h-full border-border/60 bg-background/60 backdrop-blur transition-colors hover:border-brand-secondary/40">
        <CardContent className="flex flex-col gap-3 p-6">
          <span className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-brand-secondary/10 to-accent-cyan/10 text-brand-secondary ring-1 ring-brand-secondary/15">
            <Icon className="size-5" />
          </span>
          <div className="font-heading text-4xl font-bold tracking-tight text-foreground tabular-nums sm:text-5xl">
            {/* JS-driven; SSR/no-JS fallback shows the final value */}
            <span ref={numberRef}>{formatValue(value, decimals)}</span>
            {suffix && <span className="text-brand-secondary">{suffix}</span>}
          </div>
          <p className="text-sm text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function About() {
  const reduce = useReducedMotion();

  const container: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : 0.12 },
    },
  };
  const item: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <section id="about" className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
          {/* Story + mission */}
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
          >
            <motion.p
              variants={item}
              className="text-xs font-medium tracking-wider text-brand-secondary uppercase dark:text-blue-400"
            >
              About Axonill
            </motion.p>

            <motion.h2
              variants={item}
              className="mt-4 max-w-xl font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-5xl"
            >
              A modern software agency, built by three{" "}
              <span className="bg-gradient-to-r from-brand-secondary to-accent-cyan bg-clip-text text-transparent">
                Air University
              </span>{" "}
              graduates.
            </motion.h2>

            <motion.div
              variants={item}
              className="mt-6 space-y-4 text-base text-pretty text-muted-foreground"
            >
              <p>
                Axonill began with three friends and a shared conviction: that
                great software should feel effortless. Fresh out of Air
                University, we&apos;d spent late nights shipping side projects,
                entering hackathons, and obsessing over the details most teams
                skip — and we wanted to do it for a living.
              </p>
              <p>
                So we built the studio we always wanted to work with. No bloated
                process, no hand-offs that lose the plot — just a tight team that
                takes an idea from first sketch to production scale, with
                strategy, design, and engineering working as one.
              </p>
            </motion.div>

            {/* Mission callout */}
            <motion.div
              variants={item}
              className="mt-8 flex gap-4 rounded-xl border border-border/60 bg-secondary/50 p-5"
            >
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-secondary to-accent-cyan text-white shadow-sm">
                <Target className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Our mission
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  To turn ambitious ideas into scalable digital products — and to
                  make world-class software design and engineering accessible to
                  the teams building what&apos;s next.
                </p>
              </div>
            </motion.div>
          </motion.div>

          {/* Stat counters */}
          <div className="grid grid-cols-2 gap-4 sm:gap-5">
            {STATS.map((stat, i) => (
              <StatCounter key={stat.label} stat={stat} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
