"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FaqItem = {
  question: string;
  answer: string;
};

const FAQS: FaqItem[] = [
  {
    question: "How long does a typical project take?",
    answer:
      "It depends on scope, but most engagements ship in 4–12 weeks. A focused MVP can be live in as little as two weeks, while a full product with backend, AI, and cloud infrastructure usually runs 8–12 weeks. After our first call we give you a fixed timeline with clear milestones.",
  },
  {
    question: "Who do you work with?",
    answer:
      "Founders, startups, and product teams of every size — from a solo founder validating an idea to established companies scaling a mission-critical system. If you have an ambitious idea and want it built well, we're a fit.",
  },
  {
    question: "How do client sessions and booking work?",
    answer:
      "It starts with a free discovery call you can book right from this site. From there we schedule regular check-ins throughout the project, share progress in a shared portal, and stay reachable between sessions — you're never left guessing where things stand.",
  },
  {
    question: "Do you offer post-launch support?",
    answer:
      "Yes. Every tier includes a support window after launch, and we offer ongoing retainers for monitoring, maintenance, and continued iteration. We'd rather be your long-term product partner than disappear at handoff.",
  },
  {
    question: "Can you integrate AI into my product?",
    answer:
      "Absolutely — it's one of our core strengths. From LLM-powered chat and support agents to RAG pipelines, recommendations, and computer vision, we integrate AI where it delivers real value, not just as a buzzword.",
  },
  {
    question: "Do you work with international clients?",
    answer:
      "We do. Axonill works with clients across time zones and handles remote collaboration, async updates, and scheduling around your hours as standard. Distance has never been a barrier to shipping great work together.",
  },
];

export function Faq() {
  const reduce = useReducedMotion();

  return (
    <section id="faq" className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium tracking-wider text-brand-secondary uppercase dark:text-blue-400">
            FAQ
          </p>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-5xl">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">
            Everything you need to know before we get started. Still curious?
            Book a call and ask us anything.
          </p>
        </div>

        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12"
        >
          {/* single-open: `multiple` defaults to false */}
          <Accordion className="w-full">
            {FAQS.map((faq, i) => (
              <AccordionItem
                key={faq.question}
                value={`item-${i}`}
                className="rounded-xl border border-border/60 bg-background/60 px-5 backdrop-blur transition-colors hover:border-brand-secondary/40 data-open:border-brand-secondary/40 [&:not(:last-child)]:mb-3"
              >
                <AccordionTrigger className="py-5 text-left font-heading text-base font-semibold hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm text-pretty text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
