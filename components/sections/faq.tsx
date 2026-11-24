"use client";

import { CalendarDays, CircleHelp, Clock3, Globe2, LifeBuoy, Sparkles, Users, type LucideIcon } from "lucide-react";
import { useId, useRef, useState, type CSSProperties } from "react";

import { ScrollReveal } from "@/components/reveal";
import styles from "./faq.module.css";
import layout from "@/components/site-layout.module.css";

type FaqItem = {
  question: string;
  answer: string;
  icon?: LucideIcon;
};

const FAQS: FaqItem[] = [
  {
    question: "How long does a typical project take?",
    icon: Clock3,
    answer:
      "It depends on scope, but most engagements ship in 4–12 weeks. A focused MVP can be live in as little as two weeks, while a full product with backend, AI, and cloud infrastructure usually runs 8–12 weeks. After our first call we give you a fixed timeline with clear milestones.",
  },
  {
    question: "Who do you work with?",
    icon: Users,
    answer:
      "Founders, startups, and product teams of every size — from a solo founder validating an idea to established companies scaling a mission-critical system. If you have an ambitious idea and want it built well, we're a fit.",
  },
  {
    question: "How do client sessions and booking work?",
    icon: CalendarDays,
    answer:
      "It starts with a free discovery call you can book right from this site. From there we schedule regular check-ins throughout the project, share progress in a shared portal, and stay reachable between sessions — you're never left guessing where things stand.",
  },
  {
    question: "Do you offer post-launch support?",
    icon: LifeBuoy,
    answer:
      "Yes. Every tier includes a support window after launch, and we offer ongoing retainers for monitoring, maintenance, and continued iteration. We'd rather be your long-term product partner than disappear at handoff.",
  },
  {
    question: "Can you integrate AI into my product?",
    icon: Sparkles,
    answer:
      "Absolutely — it's one of our core strengths. From LLM-powered chat and support agents to RAG pipelines, recommendations, and computer vision, we integrate AI where it delivers real value, not just as a buzzword.",
  },
  {
    question: "Do you work with international clients?",
    icon: Globe2,
    answer:
      "We do. Axonill works with clients across time zones and handles remote collaboration, async updates, and scheduling around your hours as standard. Distance has never been a barrier to shipping great work together.",
  },
];

export function Faq() {
  const id = useId();
  const pointerRow = useRef<string | null>(null);
  const [active, setActive] = useState<{ question: string; byHover: boolean } | null>(null);

  return (
    <section id="faq" aria-labelledby="faq-heading" className={`${styles.section} ${layout.section} scroll-mt-16 font-sans`}>
      <div className={layout.content}>
        <ScrollReveal as="header" className={layout.header}>
          <p className={`${styles.eyebrow} ${layout.eyebrow}`}>FAQ</p>
          <h2 id="faq-heading" className={`${layout.title} ${layout.stackedTitle} font-heading font-bold`}>
            Your questions. <span className={styles.accent}>Our answers.</span>
          </h2>
          <p className={layout.intro}>A little clarity before we start building together.</p>
        </ScrollReveal>

        <ul className={styles.list}>
          {FAQS.map(({ question, answer, icon: Icon = CircleHelp }, index) => {
            const questionId = `${id}-question-${index}`;
            const answerId = `${id}-answer-${index}`;
            const open = active?.question === question;
            return (
              <ScrollReveal
                as="li"
                key={question}
                className={styles.entry}
                style={{ "--faq-delay": `${Math.min(index, 7) * 75}ms` } as CSSProperties}
                onPointerMove={(event) => {
                  // Pointer movement avoids opening a new row as a previous answer collapses under a stationary cursor.
                  if (event.pointerType !== "mouse" || pointerRow.current === question ||
                    !window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches) return;
                  pointerRow.current = question;
                  setActive((current) => current?.question === question ? current : { question, byHover: true });
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType !== "mouse" || pointerRow.current !== question) return;
                  pointerRow.current = null;
                  setActive((current) => current?.question === question && current.byHover ? null : current);
                }}
              >
                <div className={styles.card} data-open={open}>
                  <h3 className="font-heading">
                    <button
                      type="button"
                      className={styles.question}
                      id={questionId}
                      aria-expanded={open}
                      aria-controls={answerId}
                      onClick={() => setActive((current) => current?.question === question ? null : { question, byHover: false })}
                    >
                      <Icon className={styles.icon} size={18} aria-hidden />
                      <span>{question}</span>
                    </button>
                  </h3>
                  <div className={styles.answer} id={answerId} role="region" aria-labelledby={questionId} aria-hidden={!open} inert={!open}>
                    <div className={styles.answerClip}><p>{answer}</p></div>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
