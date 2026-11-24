import Image from "next/image";
import type { CSSProperties } from "react";

import { ScrollReveal } from "@/components/reveal";
import { WhyChooseGrid } from "./why-choose-grid";
import layout from "@/components/site-layout.module.css";
import styles from "./why-choose.module.css";

const REASONS = [
  {
    icon: "compass",
    title: "Strategy Before Execution",
    description: "We understand your business and goals before deciding what to build.",
  },
  {
    icon: "fingerprint",
    title: "Built Around Your Brand",
    description: "Thoughtful digital experiences shaped around your identity and customers.",
  },
  {
    icon: "collaboration",
    title: "Direct Collaboration",
    description: "Work with the people designing and developing your product.",
  },
  {
    icon: "cubes",
    title: "Engineering With Purpose",
    description: "Reliable, maintainable solutions designed for real business needs.",
  },
  {
    icon: "conversation",
    title: "Clarity at Every Step",
    description: "Clear expectations, transparent progress, and meaningful feedback.",
  },
  {
    icon: "rocket",
    title: "Built for What Comes Next",
    description: "From launch to future improvements, we think beyond the first release.",
  },
];

export function WhyChoose() {
  return (
    <section id="why-choose" aria-labelledby="why-choose-heading" className={`${styles.section} ${layout.section} scroll-mt-16 font-sans`}>
      <div className={layout.content}>
        <ScrollReveal effect="fade"><p className={`${styles.eyebrow} ${layout.eyebrow}`}>Why choose us?</p></ScrollReveal>
        <ScrollReveal as="header" effect="text" className={layout.header}>
          <h2 id="why-choose-heading" className={`${layout.title} ${layout.stackedTitle} font-heading font-bold`}>
            Why work with us?
            <span className={styles.accent}>Because how we build matters.</span>
          </h2>
          <p className={layout.intro}>
            The right digital partner doesn&apos;t just deliver a product. They understand your vision,
            challenge assumptions, and build with your future in mind.
          </p>
        </ScrollReveal>

        <WhyChooseGrid>
          {REASONS.map(({ icon, title, description }, index) => {
            const source = "/brand/why-choose/" + icon + ".webp";
            return (
              <li key={icon} className={styles.cell} data-reason>
                <ScrollReveal effect="scale" className={styles.reason} style={{ "--why-delay": index * 90 + "ms" } as CSSProperties}>
                  <div className={styles.icon} aria-hidden="true">
                    <span className={styles.glass} data-glass style={{ "--glass-image": "url(" + source + ")" } as CSSProperties}>
                      <Image src={source} alt="" width={192} height={192} unoptimized />
                    </span>
                  </div>
                  <div>
                    <h3 className={styles.reasonTitle + " font-heading"}>{title}</h3>
                    <p className={styles.description}>{description}</p>
                  </div>
                </ScrollReveal>
              </li>
            );
          })}
        </WhyChooseGrid>
      </div>
    </section>
  );
}
