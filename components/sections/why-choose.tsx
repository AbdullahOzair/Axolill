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
  type LucideIcon,
} from "lucide-react";
import { ScrollReveal } from "@/components/reveal";
import styles from "./why-choose.module.css";

type Differentiator = {
  title: string;
  description: string;
  icon: LucideIcon;
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

const GROUPS = [
  { id: "build", heading: "How we build", reasons: REASONS.slice(0, 5) },
  { id: "partner", heading: "How we partner", reasons: REASONS.slice(5) },
];

export function WhyChoose() {
  return (
    <section id="why-choose" aria-labelledby="why-choose-heading" className={`${styles.section} scroll-mt-16 py-14 font-sans sm:py-18`}>
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal as="header" effect="text" className="max-w-2xl">
          <p className={styles.eyebrow}>Why Axonill</p>
          <h2 id="why-choose-heading" className="mt-3 font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            Ten reasons <span className={styles.accent}>teams choose us</span>
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
            The advantages that make Axonill a partner worth betting your product on.
          </p>
        </ScrollReveal>

        <div className={styles.groups}>
          {GROUPS.map(({ id, heading, reasons }, index) => (
            <ScrollReveal key={id} effect={index === 0 ? "from-left" : "from-right"} className={styles.group} data-group={id}>
              <div className={styles.groupHeader}>
                <h3 id={`why-choose-${id}`} className="font-heading text-lg font-semibold tracking-tight sm:text-xl">{heading}</h3>
              </div>
              <ul aria-labelledby={`why-choose-${id}`} className={styles.list}>
                {reasons.map(({ title, description, icon: Icon }) => (
                  <li key={title} className={styles.reason}>
                    <span aria-hidden className={styles.icon}><Icon size={17} strokeWidth={1.7} /></span>
                    <div className="min-w-0">
                      <h4 className={styles.reasonTitle}>{title}</h4>
                      <p className={styles.description}>{description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
