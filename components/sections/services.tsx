"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { fetchJson, useLoader } from "@/lib/use-api";
import type { Service } from "@/lib/data-model";
import { iconFor } from "@/components/icon-map";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

/**
 * The API already hides drafts from anonymous callers, but an *admin* browsing
 * the marketing site gets every row back — so filter here too.
 */
async function loadServices(): Promise<Service[]> {
  const { services } = await fetchJson<{ services: Service[] }>("/api/services");
  return services.filter((s) => s.published);
}

export function Services() {
  const reduce = useReducedMotion();
  const { data, error, loading, reload } = useLoader<Service[]>(loadServices);
  const services = data ?? [];

  const container: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : 0.1, delayChildren: 0.05 },
    },
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
    <section id="services" className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium tracking-wider text-brand-secondary uppercase dark:text-blue-400">
            What we do
          </p>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-5xl">
            Services built to ship and scale
          </h2>
          <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">
            End-to-end product capability under one roof — pick a single service
            or let us take the whole thing from idea to launch.
          </p>
        </div>

        {loading ? (
          <CardGridSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} className="mt-16" />
        ) : services.length === 0 ? (
          <EmptyState
            title="No services published yet"
            description="Services added in the admin will appear here once published."
            className="mt-16"
          />
        ) : (
          /* Grid — unchanged; only the data source moved. */
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {services.map((service) => {
              const Icon = iconFor(service.icon);
              return (
                <motion.div key={service.id} variants={item}>
                  <Card className="group relative h-full overflow-hidden border-border/60 bg-background/60 backdrop-blur transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-secondary/40 hover:shadow-xl hover:shadow-brand-secondary/10">
                    {/* Glow */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -inset-px -z-10 rounded-xl bg-gradient-to-br from-brand-secondary/0 via-brand-secondary/0 to-accent-cyan/0 opacity-0 transition-opacity duration-300 group-hover:from-brand-secondary/10 group-hover:to-accent-cyan/10 group-hover:opacity-100"
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -top-16 left-1/2 -z-10 size-40 -translate-x-1/2 rounded-full bg-brand-secondary/20 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100"
                    />

                    <CardHeader>
                      <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-brand-secondary/10 to-accent-cyan/10 text-brand-secondary ring-1 ring-brand-secondary/15 transition-transform duration-300 group-hover:scale-105">
                        <Icon className="size-5.5" />
                      </span>
                      <CardTitle className="mt-4 font-heading text-xl">
                        {service.title}
                      </CardTitle>
                      {service.summary && (
                        <CardDescription className="mt-1.5 text-sm">
                          {service.summary}
                        </CardDescription>
                      )}
                    </CardHeader>

                    <CardContent>
                      <ul className="space-y-2.5">
                        {service.items.map((sub) => (
                          <li
                            key={sub}
                            className="flex items-center gap-2.5 text-sm text-muted-foreground"
                          >
                            <Check className="size-4 shrink-0 text-brand-success" />
                            {sub}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </section>
  );
}

/** Mirrors the card grid so the layout doesn't jump when data lands. */
function CardGridSkeleton() {
  return (
    <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/60 bg-background/60 p-6"
        >
          <Skeleton className="size-11 rounded-xl" />
          <Skeleton className="mt-4 h-6 w-2/3" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-1.5 h-4 w-4/5" />
          <div className="mt-6 space-y-2.5">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
