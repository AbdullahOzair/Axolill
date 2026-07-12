"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { BrandMark, MARK_SRC } from "@/components/brand-mark";

const SESSION_KEY = "axonill:loaded";

export function PageLoader() {
  const reduce = useReducedMotion();
  const [loading, setLoading] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);

    // Skip if we've already shown it this session, or if reduced motion.
    const alreadyShown =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(SESSION_KEY) === "1";

    if (alreadyShown || reduce) {
      setLoading(false);
      return;
    }

    // Lock scroll while the loader is up.
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => setLoading(false), 1500);

    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [reduce]);

  React.useEffect(() => {
    if (!loading && mounted) {
      document.body.style.overflow = "";
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* ignore storage errors (private mode etc.) */
      }
    }
  }, [loading, mounted]);

  // Avoid SSR/hydration flash: render nothing until mounted decides.
  if (!mounted) return null;

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          key="page-loader"
          className="fixed inset-0 z-[100] grid place-items-center bg-background"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          aria-hidden
        >
          <motion.div
            className="flex flex-col items-center gap-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            // On exit, drift up toward where the navbar logo sits.
            exit={{ opacity: 0, y: -80, scale: 0.72 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.span
              className="relative grid size-16 place-items-center"
              initial={{ rotate: -12, scale: 0.6 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 14,
              }}
            >
              {/* cyan glow pulse behind the mark */}
              <motion.span
                aria-hidden
                className="absolute inset-0 -z-10 rounded-full bg-accent-cyan/40 blur-xl"
                animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.85, 1.2, 0.85] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* gentle idle float */}
              <motion.span
                className="block"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <BrandMark size={64} priority />
              </motion.span>

              {/*
                Sheen sweep. The MASK lives on this static wrapper (locked to the
                logo silhouette) while the gradient child slides underneath it —
                masking the moving element instead would drag the mask along and
                paint a rectangle over the transparent PNG.
              */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden"
                style={{
                  WebkitMaskImage: `url(${MARK_SRC})`,
                  maskImage: `url(${MARK_SRC})`,
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                }}
              >
                <motion.span
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                  initial={{ x: "-130%" }}
                  animate={{ x: "130%" }}
                  transition={{
                    duration: 1.1,
                    delay: 0.4,
                    ease: "easeInOut",
                  }}
                />
              </span>
            </motion.span>

            <motion.span
              className="font-heading text-lg font-semibold tracking-tight text-foreground"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
            >
              Axonill
            </motion.span>

            {/* progress bar */}
            <motion.span
              className="mt-1 h-0.5 w-24 origin-left rounded-full bg-gradient-to-r from-brand-secondary to-accent-cyan"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.1, ease: "easeInOut" }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
