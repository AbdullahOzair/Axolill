"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function BackToTop() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={scrollToTop}
          aria-label="Back to top"
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.9 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.94 }}
          className="group fixed right-5 bottom-5 z-50 grid size-11 place-items-center overflow-hidden rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-black/5 transition-shadow hover:shadow-brand-secondary/25 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:right-8 sm:bottom-8"
        >
          <span className="absolute inset-0 bg-gradient-to-br from-brand-secondary to-accent-cyan opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <ArrowUp className="relative z-10 size-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
