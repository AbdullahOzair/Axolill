"use client";

import { ArrowRight, Compass, Lightbulb, PanelsTopLeft, Check } from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";

import { ScrollReveal } from "@/components/reveal";
import type { InquiryType } from "@/lib/inquiries";
import { InquiryDialog } from "./inquiry-dialog";
import { useInquiryTracking } from "./inquiry-tracking";
import layout from "@/components/site-layout.module.css";
import styles from "./pricing.module.css";

const PATHS = [
  { type: "IDEA", title: "I have an idea.", icon: Lightbulb, description: "Something in mind but not sure how to bring it to life? Let's figure it out together.",
    features: ["Idea validation", "Product strategy", "Creative exploration", "Technical guidance"], cta: "Explore my idea" },
  { type: "PROJECT", title: "I have a project.", icon: PanelsTopLeft, description: "Know what you need? Let's turn your requirements into something exceptional.",
    features: ["Dedicated expertise", "Tailored solutions", "Project planning", "Customized proposal"], cta: "Discuss my project" },
  { type: "GUIDANCE", title: "I need guidance.", icon: Compass, description: "Facing a challenge or unsure where to start? Let's find the right direction.",
    features: ["Expert consultation", "Business challenges", "Digital opportunities", "Strategic recommendations"], cta: "Let's talk" },
] as const satisfies readonly { type: InquiryType; title: string; icon: typeof Compass; description: string; features: readonly string[]; cta: string }[];

export function Pricing() {
  const section = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [dialog, setDialog] = useState<{ type: InquiryType; title: string; origin: CSSProperties; key: string }>();
  const [open, setOpen] = useState(false);
  const tracking = useInquiryTracking(section);

  return (
    <section id="work-with-us" ref={section} aria-labelledby="work-with-us-heading" className={`${styles.section} ${layout.section}`}>
      <span className={styles.legacyAnchor} id="pricing" aria-hidden />
      <div className={layout.content}>
        <ScrollReveal as="header" effect="text" className={layout.header}>
          <p className={`${styles.eyebrow} ${layout.eyebrow}`}>Let&apos;s work together</p>
          <h2 id="work-with-us-heading" className={`${layout.title} ${layout.stackedTitle} font-heading font-bold`}>
            Great things begin <span className={styles.accent}>with a conversation.</span>
          </h2>
          <p className={layout.intro}>Whatever stage you&apos;re at, we&apos;re here to help you take the next step.</p>
        </ScrollReveal>

        <div className={styles.grid}>
          {PATHS.map(({ type, title, icon: Icon, description, features, cta }, index) => (
            <ScrollReveal key={type} index={index}>
              <article className={styles.card} data-featured={type === "PROJECT"}>
                <Icon className={styles.pathIcon} size={26} aria-hidden />
                <h3 className="font-heading">{title}</h3>
                <p>{description}</p>
                <ul>
                  {features.map((feature) => <li key={feature}><Check size={15} aria-hidden />{feature}</li>)}
                </ul>
                <button
                  type="button"
                  className={styles.cta}
                  aria-haspopup="dialog"
                  onClick={(event) => {
                    opener.current = event.currentTarget;
                    const rect = event.currentTarget.closest("article")!.getBoundingClientRect();
                    const origin = {
                      "--card-x": Math.max(-350, Math.min(350, rect.x + rect.width / 2 - innerWidth / 2)) + "px",
                      "--card-y": Math.max(-220, Math.min(220, rect.y + rect.height / 2 - innerHeight / 2)) + "px",
                      "--card-scale": Math.min(0.96, Math.max(0.65, rect.width / 650)),
                    } as CSSProperties;
                    setDialog({ type, title, origin, key: crypto.randomUUID() });
                    setOpen(true);
                    tracking.select(type);
                  }}
                >
                  {cta}<ArrowRight size={17} aria-hidden />
                </button>
              </article>
            </ScrollReveal>
          ))}
        </div>

        <label className={styles.consent}>
          <input type="checkbox" checked={tracking.consent} onChange={(event) => tracking.setConsent(event.currentTarget.checked)} />
          Help us improve your experience (optional)
        </label>
      </div>
      {dialog && (
        <InquiryDialog key={dialog.key} journey={dialog} open={open} close={() => setOpen(false)} opener={opener} tracking={tracking} />
      )}
    </section>
  );
}
