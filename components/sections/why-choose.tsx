"use client";

import * as React from "react";
import {
  Blocks,
  BrainCircuit,
  Headset,
  Layers,
  MessagesSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

type Differentiator = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const REASONS: Differentiator[] = [
  {
    title: "Modern Stack",
    description: "We build on today's best-in-class, future-proof technologies.",
    icon: Layers,
  },
  {
    title: "Clean UI/UX",
    description: "Interfaces that are intuitive, accessible, and a pleasure to use.",
    icon: Sparkles,
  },
  {
    title: "Scalable Architecture",
    description: "Systems designed to grow from first user to millions.",
    icon: Blocks,
  },
  {
    title: "AI-Driven",
    description: "Smart features and automation baked in where they add real value.",
    icon: BrainCircuit,
  },
  {
    title: "Fast Delivery",
    description: "Tight, visible increments get you to market sooner.",
    icon: Zap,
  },
  {
    title: "Transparent Communication",
    description: "Clear updates and no surprises, at every stage of the build.",
    icon: MessagesSquare,
  },
  {
    title: "Agile",
    description: "Iterative sprints that adapt as your priorities evolve.",
    icon: RefreshCw,
  },
  {
    title: "QA",
    description: "Rigorous automated and manual testing before anything ships.",
    icon: ShieldCheck,
  },
  {
    title: "Post-launch Support",
    description: "We stick around to monitor, maintain, and keep improving.",
    icon: Headset,
  },
  {
    title: "Affordable Pricing",
    description: "Premium engineering at rates that respect your budget.",
    icon: Wallet,
  },
];

export function WhyChoose() {
  const reduce = useReducedMotion();

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.07 } },
  };
  const item: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <section id="why-choose" className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium tracking-wider text-brand-secondary uppercase dark:text-blue-400">
            Why Axonill
          </p>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-5xl">
            Ten reasons teams choose us
          </h2>
          <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">
            The advantages that make Axonill a partner worth betting your product
            on.
          </p>
        </div>

        {/* 5×2 on desktop, 2-col on tablet, single column on mobile */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-5"
        >
          {REASONS.map(({ title, description, icon: Icon }) => (
            <motion.div
              key={title}
              variants={item}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-background/40 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-brand-secondary/40 hover:shadow-lg hover:shadow-brand-secondary/10"
            >
              {/* Glass sheen on hover */}
              <div
                aria-hidden
                className="pointer-events-none absolute -top-12 left-1/2 size-32 -translate-x-1/2 rounded-full bg-brand-secondary/20 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100"
              />
              <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-brand-secondary/10 to-accent-cyan/10 text-brand-secondary ring-1 ring-brand-secondary/15 transition-transform duration-300 group-hover:scale-105">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 font-heading text-base font-semibold">
                {title}
              </h3>
              <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
                {description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
