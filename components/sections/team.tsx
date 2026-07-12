"use client";

import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { fetchJson, useLoader } from "@/lib/use-api";
import type { TeamMember } from "@/lib/data-model";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

async function loadTeam(): Promise<TeamMember[]> {
  const { team } = await fetchJson<{ team: TeamMember[] }>("/api/team");
  return team.filter((m) => m.published);
}

export function Team() {
  const reduce = useReducedMotion();
  const { data, error, loading, reload } = useLoader<TeamMember[]>(loadTeam);
  const team = data ?? [];

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
    <section id="team" className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium tracking-wider text-brand-secondary uppercase dark:text-blue-400">
            Meet the team
          </p>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-5xl">
            The people behind your product
          </h2>
          <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">
            No account managers, no hand-offs — you work directly with the people
            designing and building your product.
          </p>
        </div>

        {loading ? (
          <GridSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} className="mt-16" />
        ) : team.length === 0 ? (
          <EmptyState
            title="No team members published yet"
            description="People added in the admin will appear here once published."
            className="mt-16"
          />
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {team.map((member) => (
              <motion.div key={member.id} variants={item}>
                <Card className="group relative h-full overflow-hidden border-border/60 bg-background/60 backdrop-blur transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-secondary/40 hover:shadow-xl hover:shadow-brand-secondary/10">
                  {/* Glow */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -top-16 left-1/2 -z-10 size-40 -translate-x-1/2 rounded-full bg-brand-secondary/20 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100"
                  />

                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <Avatar className="size-14">
                        {member.photoUrl && (
                          <AvatarImage
                            src={`/api/media/${member.photoUrl}`}
                            alt=""
                          />
                        )}
                        <AvatarFallback className="bg-gradient-to-br from-brand-secondary to-accent-cyan text-base font-semibold text-white">
                          {initials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <CardTitle className="font-heading text-lg">
                          {member.name}
                        </CardTitle>
                        <p className="mt-0.5 text-sm font-medium text-brand-secondary dark:text-blue-400">
                          {member.role}
                        </p>
                      </div>
                    </div>

                    {member.bio && (
                      <CardDescription className="mt-4 text-sm text-pretty">
                        {member.bio}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent>
                    {member.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {member.skills.map((skill) => (
                          <Badge
                            key={skill}
                            variant="secondary"
                            className="rounded-full border border-border/60 bg-secondary/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors group-hover:border-brand-secondary/30"
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}

function GridSkeleton() {
  return (
    <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/60 bg-background/60 p-6"
        >
          <div className="flex items-center gap-4">
            <Skeleton className="size-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <Skeleton className="mt-5 h-4 w-full" />
          <Skeleton className="mt-1.5 h-4 w-5/6" />
          <div className="mt-5 flex flex-wrap gap-1.5">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-5 w-16 rounded-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
