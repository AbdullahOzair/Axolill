"use client";

import { useEffect, useRef, type ComponentType } from "react";
import { Building2, Clock, Code2, Compass, Eye, PenTool, Rocket, Star, Target } from "lucide-react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { ScrollReveal } from "@/components/reveal";
import styles from "./about.module.css";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const stats: { label: string; value: number; suffix: string; icon: Icon }[] = [
  { label: "Projects delivered", value: 120, suffix: "+", icon: Rocket },
  { label: "Industries served", value: 15, suffix: "+", icon: Building2 },
  { label: "Avg. delivery time", value: 6, suffix: " wks", icon: Clock },
  { label: "Client satisfaction", value: 98, suffix: "%", icon: Star },
];

const expertise = [
  { title: "Strategy", detail: "Turning a vision into clear priorities.", icon: Compass },
  { title: "Design", detail: "Giving each brand a distinct digital experience.", icon: PenTool },
  { title: "Engineering", detail: "Building websites, apps, and interactive tools.", icon: Code2 },
];

function StatCounter({ stat }: { stat: (typeof stats)[number] }) {
  const { label, value, suffix, icon: Icon } = stat;
  const ref = useRef<HTMLDivElement>(null);
  const digits = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.45 });
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = digits.current;
    if (!node || !inView || reduce !== false) return;

    const controls = animate(0, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (latest) => { node.textContent = String(Math.round(latest)); },
    });

    return () => {
      controls.stop();
      node.textContent = String(value);
    };
  }, [inView, reduce, value]);

  return (
    <div ref={ref} data-revealed={inView} className={`${styles.stat} min-w-0 rounded-lg border border-border/80 bg-card/65 hover:border-brand-secondary/45 motion-safe:transition-[translate,border-color] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5`}>
      <dt className="flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
        <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-brand-secondary dark:text-blue-300" />
        {label}
      </dt>
      <dd className="mt-1.5 font-heading text-[clamp(1.45rem,2.4vw,1.9rem)] leading-tight font-semibold tracking-tight tabular-nums">
        <span className="sr-only">{value}{suffix}</span>
        <span aria-hidden="true"><span ref={digits}>{value}</span><span className="text-brand-secondary dark:text-blue-300">{suffix}</span></span>
      </dd>
    </div>
  );
}

function AboutStatement() {
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.08 });

  return (
    <p ref={ref} data-revealed={inView} className={styles.statement}>
      <span className={styles.statementLine}>We never stopped building.</span>{" "}
      <span className={`${styles.statementLine} ${styles.statementAccent}`}>Now we build for you.</span>
    </p>
  );
}

export function About() {
  return (
    <section id="about" aria-labelledby="about-heading" className="relative scroll-mt-16 py-8 font-sans sm:py-10 lg:py-12">
      <div className={styles.content}>
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-[clamp(1.75rem,4vw,4rem)]">
          <div className="min-w-0">
            <ScrollReveal as="header" effect="text">
              <p className="flex items-center gap-2 text-[0.6875rem] font-semibold tracking-[0.15em] text-brand-secondary dark:text-blue-300 uppercase">
                <span aria-hidden="true" className="h-px w-6 bg-current" />
                About Axonill
              </p>
              <h2 id="about-heading" className="mt-2.5 max-w-[28ch] font-heading text-[1.7rem] leading-[1.14] font-semibold tracking-tight text-balance lg:text-[clamp(2rem,3vw,2.4rem)]">
                Behind every great product is a team that{" "}
                <span className="text-brand-secondary dark:text-blue-300">refused to settle.</span>
              </h2>
            </ScrollReveal>
            <ScrollReveal effect="from-left" className="mt-3 max-w-[66ch] space-y-2.5 text-sm leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">Before Axonill was a company, it was three friends who couldn&apos;t stop building.</p>
              <p>
                Weekends turned into side projects. Hackathons turned into late-night launches. Every project taught us the same lesson: great software isn&apos;t about adding more features. It&apos;s about getting the details right and never settling for good enough.
              </p>
              <p>
                Today, we bring that same passion to every client. You work directly with the people designing and building your product, with strategy, design and engineering moving as one. Your idea gets the same care we once gave our own.
              </p>
            </ScrollReveal>
            <AboutStatement />
          </div>

          <div className="min-w-0 border-t border-border/70 pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-[clamp(1.25rem,2.5vw,2.5rem)]">
            <ScrollReveal as="dl" effect="from-right" aria-label="Axonill in numbers" className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {stats.map((stat) => <StatCounter key={stat.label} stat={stat} />)}
            </ScrollReveal>
            <ScrollReveal effect="from-right">
              <h3 className="mt-4 font-heading text-lg font-semibold tracking-tight lg:text-xl">Our expertise</h3>
              <ul className="mt-2 divide-y divide-border/70">
                {expertise.map(({ title, detail, icon: Icon }) => (
                  <li key={title} className="group flex min-w-0 items-start gap-2.5 py-2">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border/75 text-brand-secondary dark:text-blue-300 group-hover:border-brand-secondary/50 group-hover:bg-brand-secondary/5 motion-safe:transition-colors motion-safe:duration-200">
                      <Icon aria-hidden className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-heading text-sm font-semibold">{title}</h4>
                      <p className="text-[0.8125rem] leading-snug text-muted-foreground">{detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </div>
        </div>

        <div className="mt-6 grid gap-4 border-t border-border/70 pt-4 lg:grid-cols-2 lg:gap-x-10">
          <ScrollReveal effect="from-left">
            <h3 className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight">
              <Target aria-hidden className="size-4 shrink-0 text-brand-secondary dark:text-blue-300" />
              Our mission
            </h3>
            <p className="mt-1.5 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
              To transform the unique identity and vision of every brand into tailored digital experiences by combining creative thinking, thoughtful design and innovative technology. We build purpose-driven websites, applications and interactive solutions that help businesses express their individuality, engage their customers and create meaningful digital value.
            </p>
          </ScrollReveal>
          <ScrollReveal effect="from-right">
            <h3 className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight">
              <Eye aria-hidden className="size-4 shrink-0 text-brand-secondary dark:text-blue-300" />
              Our vision
            </h3>
            <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed text-muted-foreground">
              To shape a digital future where every brand has the opportunity to stand out through unique, meaningful and purpose-built digital experiences.
            </p>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
