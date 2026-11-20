"use client";

import { useEffect, useRef, type ComponentType, type ReactNode } from "react";
import { Building2, Clock, Code2, Compass, Eye, PenTool, Rocket, Star, Target } from "lucide-react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";

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

function AboutReveal({ children, delay = 0, className }: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.12 });
  const reduce = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={false}
      animate={inView && reduce === false ? { opacity: [0.55, 1], y: [12, 0] } : { opacity: 1, y: 0 }}
      transition={{
        duration: reduce === false ? 0.46 : 0,
        delay: reduce === false ? delay : 0,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

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
    <div ref={ref} className="min-w-0 bg-card p-3 transition-colors duration-200 hover:bg-muted/80 sm:px-4 sm:py-3.5">
      <dt className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
        <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-brand-secondary dark:text-blue-300" />
        {label}
      </dt>
      <dd className="mt-1.5 font-heading text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
        <span className="sr-only">{value}{suffix}</span>
        <span aria-hidden="true"><span ref={digits}>{value}</span><span className="text-brand-secondary dark:text-blue-300">{suffix}</span></span>
      </dd>
    </div>
  );
}

export function About() {
  return (
    <section id="about" aria-labelledby="about-heading" className="relative scroll-mt-16 py-14 font-sans sm:py-18">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-8">
          <div className="min-w-0">
            <AboutReveal>
              <p className="flex items-center gap-2 text-[0.6875rem] font-semibold tracking-[0.15em] text-brand-secondary uppercase dark:text-blue-300">
                <span aria-hidden="true" className="h-px w-6 bg-current" />
                About Axonill
              </p>
              <h2 id="about-heading" className="mt-3 max-w-xl font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
                Behind every great product is a team that{" "}
                <span className="text-brand-secondary dark:text-blue-300">refused to settle.</span>
              </h2>
            </AboutReveal>
            <AboutReveal delay={0.07} className="mt-4 max-w-[58ch] space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              <p className="font-medium text-foreground">Before Axonill was a company, it was three friends who couldn&apos;t stop building.</p>
              <p>
                Weekends turned into side projects. Hackathons turned into late-night launches. Every project taught us the same lesson: great software isn&apos;t about adding more features. It&apos;s about getting the details right and never settling for good enough.
              </p>
              <p>
                Today, we bring that same passion to every client. You work directly with the people designing and building your product, with strategy, design and engineering moving as one. Your idea gets the same care we once gave our own.
              </p>
              <p className="border-l-2 border-brand-secondary pl-3 font-medium text-foreground dark:border-blue-300">
                We never stopped building. Now we build for you.
              </p>
            </AboutReveal>
          </div>

          <AboutReveal delay={0.06}>
            <div className="relative isolate overflow-hidden rounded-xl border border-border/60 bg-background/60 p-4 text-foreground backdrop-blur sm:p-5 lg:p-6">
              <div aria-hidden="true" className="pointer-events-none absolute -top-20 -right-16 -z-10 size-52 rounded-full border border-brand-secondary/15 ring-16 ring-brand-secondary/5" />
              <div className="group">
                <Target aria-hidden className="mb-2 size-5 text-brand-secondary transition-colors duration-200 group-hover:text-foreground dark:text-blue-300" />
                <h3 className="font-heading text-lg font-medium tracking-tight lg:text-xl">Our mission</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  To transform the unique identity and vision of every brand into tailored digital experiences by combining creative thinking, thoughtful design and innovative technology. We build purpose-driven websites, applications and interactive solutions that help businesses express their individuality, engage their customers and create meaningful digital value.
                </p>
              </div>
              <div className="group mt-4 border-t border-border/60 pt-4">
                <Eye aria-hidden className="mb-2 size-5 text-brand-secondary transition-colors duration-200 group-hover:text-foreground dark:text-blue-300" />
                <h3 className="font-heading text-lg font-medium tracking-tight lg:text-xl">Our vision</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  To shape a digital future where every brand has the opportunity to stand out through unique, meaningful and purpose-built digital experiences.
                </p>
              </div>
            </div>
          </AboutReveal>
        </div>

        <AboutReveal className="mt-6 sm:mt-8">
          <h3 className="font-heading text-lg font-semibold tracking-tight lg:text-xl">Our expertise</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {expertise.map(({ title, detail, icon: Icon }) => (
              <li key={title} className="group flex min-w-0 gap-2 rounded-lg border border-border bg-card p-3 transition-colors duration-200 hover:border-brand-secondary/50 sm:px-3.5">
                <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-secondary motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:-translate-y-0.5 dark:text-blue-300" />
                <div>
                  <h4 className="font-heading text-sm font-semibold">{title}</h4>
                  <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted-foreground">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </AboutReveal>

        <dl aria-label="Axonill in numbers" className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
          {stats.map((stat) => <StatCounter key={stat.label} stat={stat} />)}
        </dl>
      </div>
    </section>
  );
}
