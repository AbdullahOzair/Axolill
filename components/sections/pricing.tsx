"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { PRICING_TIERS } from "@/lib/pricing-tiers";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function Pricing() {
  const reduce = useReducedMotion();

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.12 } },
  };
  const item: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 24 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium tracking-wider text-brand-secondary uppercase dark:text-blue-400">
            Pricing
          </p>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-5xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">
            Pick the engagement that fits where you are — every tier is a fixed,
            upfront quote with no surprises.
          </p>
        </div>

        {/* Tiers */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-16 grid items-center gap-6 lg:grid-cols-3 lg:gap-8"
        >
          {PRICING_TIERS.map((tier) => (
            <motion.div key={tier.name} variants={item}>
              <Card
                className={cn(
                  "relative h-full overflow-hidden transition-all duration-300",
                  tier.featured
                    ? "border-brand-secondary/60 bg-background shadow-xl shadow-brand-secondary/10 lg:scale-105"
                    : "border-border/60 bg-background/60 backdrop-blur hover:-translate-y-1 hover:border-brand-secondary/40 hover:shadow-lg"
                )}
              >
                {tier.featured && (
                  <>
                    {/* Accent glow for the featured tier */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -top-16 left-1/2 -z-10 size-48 -translate-x-1/2 rounded-full bg-brand-secondary/20 blur-3xl"
                    />
                    <span className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-brand-secondary to-accent-cyan" />
                    <div className="absolute top-4 right-4">
                      <Badge className="gap-1 rounded-full bg-brand-secondary text-white shadow-sm">
                        <Sparkles className="size-3" />
                        Most Popular
                      </Badge>
                    </div>
                  </>
                )}

                <CardHeader className={cn(tier.featured && "pt-7")}>
                  <CardTitle className="font-heading text-lg">
                    {tier.name}
                  </CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-heading text-4xl font-bold tracking-tight text-foreground">
                      {tier.price}
                    </span>
                    {tier.cadence && (
                      <span className="text-sm text-muted-foreground">
                        {tier.cadence}
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <CheckCircle2
                          className={cn(
                            "mt-0.5 size-4.5 shrink-0",
                            tier.featured
                              ? "text-brand-secondary"
                              : "text-brand-success"
                          )}
                        />
                        <span className="text-sm text-muted-foreground">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="mt-auto">
                  {tier.featured ? (
                    <Link
                      href="#contact"
                      className="group relative inline-flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 hover:shadow-md hover:shadow-brand-secondary/25 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-brand-secondary to-accent-cyan opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      <span className="relative z-10">{tier.cta}</span>
                    </Link>
                  ) : (
                    <Link
                      href="#contact"
                      className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-background px-6 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {tier.cta}
                    </Link>
                  )}
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
